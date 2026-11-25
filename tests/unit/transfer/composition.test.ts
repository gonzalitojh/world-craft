import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => process.cwd() },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  utilityProcess: { fork: vi.fn() },
  BrowserWindow: class {},
  nativeTheme: {
    shouldUseDarkColors: false,
    themeSource: 'system',
    on: vi.fn(),
  },
}));

vi.mock('@/main/window', () => ({
  getMainWindow: () => null,
}));

import type {
  TransferCounts,
  TransferProgressEvent,
} from '@/shared/contracts/transfer';
import {
  createTransferCoordinator,
  type ForkTransferWorker,
  type TransferWorkerHandle,
} from '@/main/transfer/composition';
import { createUnavailableTransferCoordinator } from '@/main/transfer/unavailable-coordinator';
import type {
  ImportPreparer,
  ImportService,
} from '@/main/transfer/import/service';

const WORLD_ID = '018f1000-0000-7000-8000-000000000001';
const OPERATION_ID = '018f1000-0000-7000-8000-000000000002';
const IMPORT_OPERATION_ID = '018f1000-0000-7000-8000-000000000003';
const ROOT = join(tmpdir(), 'wc-transfer-test');
const DATABASE_FILE = join(ROOT, 'world-craft.sqlite');
const ASSETS_DIR = join(ROOT, 'assets');
const IMPORTS_DIR = join(ROOT, 'imports');
const ASSETS_TEMP_DIR = join(ASSETS_DIR, '.tmp');
const ASSETS_WORLDS_DIR = join(ASSETS_DIR, 'worlds');
const EXPORT_FILE = join(ROOT, 'salida', 'mundo.zip');
const IMPORT_FILE = join(ROOT, 'entrada', 'mundo.zip');
const IMPORT_TEMP_DIR = join(IMPORTS_DIR, '.tmp', 'op');
const PLAN_FILE = join(IMPORT_TEMP_DIR, 'plan.json');
const ASSET_TEMP_OPERATION_DIR = join(ASSETS_TEMP_DIR, 'op', 'world');

const counts: TransferCounts = {
  entities: 1,
  entityTypes: 1,
  relationTypes: 1,
  tags: 1,
  relations: 1,
  versions: 1,
  assets: 1,
};

class FakeWorker implements TransferWorkerHandle {
  readonly posted: unknown[] = [];
  killed = false;
  private messageListener: ((message: unknown) => void) | null = null;
  private exitListener: ((code: number) => void) | null = null;

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  onMessage(listener: (message: unknown) => void): () => void {
    this.messageListener = listener;
    return () => {
      this.messageListener = null;
    };
  }

  onExit(listener: (code: number) => void): () => void {
    this.exitListener = listener;
    return () => {
      this.exitListener = null;
    };
  }

  kill(): void {
    this.killed = true;
    this.exitListener?.(0);
  }

  emit(message: unknown): void {
    this.messageListener?.(message);
  }
}

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    databaseFile: DATABASE_FILE,
    assetsDir: ASSETS_DIR,
    importsDir: IMPORTS_DIR,
    assetsTempDir: ASSETS_TEMP_DIR,
    assetsWorldsDir: ASSETS_WORLDS_DIR,
    appVersion: '0.1.0',
    schemaVersion: 8,
    now: () => 1_800_000_000_000,
    generateOperationId: () => OPERATION_ID,
    ...overrides,
  };
}

function workerResponse(
  operationId: string,
  response: Record<string, unknown>,
) {
  return { protocolVersion: 1, operationId, ...response };
}

describe('coordinador de transferencia', () => {
  it('exporta con el worker, mapea eventos y libera el worker', async () => {
    const worker = new FakeWorker();
    const events: unknown[] = [];
    const coordinator = createTransferCoordinator(
      baseOptions({
        findWorld: () => ({ name: 'Mundo', slug: 'mundo' }),
        showExportDialog: async () => EXPORT_FILE,
        forkWorker: (() => worker) satisfies ForkTransferWorker,
        sendEvent: (event: TransferProgressEvent) => events.push(event),
      }),
    );

    const promise = coordinator.exportWorld(WORLD_ID);

    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    expect(worker.posted[0]).toMatchObject({
      type: 'export',
      operationId: OPERATION_ID,
      worldId: WORLD_ID,
      destinationFile: EXPORT_FILE,
    });

    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'event',
        event: {
          operation: 'export',
          phase: 'packaging',
          completed: 1,
          total: 2,
          warnings: 0,
        },
      }),
    );
    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'event',
        event: {
          operation: 'export',
          phase: 'finalizing',
          completed: 1,
          total: 2,
          warnings: 0,
        },
      }),
    );
    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'result',
        operation: 'export',
        result: {
          worldId: WORLD_ID,
          worldName: 'Mundo',
          fileName: 'mundo.zip',
          size: 100,
          counts,
          warnings: [],
        },
      }),
    );

    await expect(promise).resolves.toEqual({
      status: 'completed',
      data: {
        worldId: WORLD_ID,
        worldName: 'Mundo',
        fileName: 'mundo.zip',
        size: 100,
        counts,
        warnings: [],
      },
    });
    expect(events).toEqual([
      expect.objectContaining({
        operationId: OPERATION_ID,
        phase: 'packaging',
        unit: 'files',
        cancelable: true,
      }),
      expect.objectContaining({
        operationId: OPERATION_ID,
        phase: 'finalizing',
        unit: 'files',
        cancelable: true,
      }),
    ]);
    expect(worker.killed).toBe(true);
    expect(coordinator.isBusy()).toBe(false);
  });

  it('normaliza la fase preparing tardía y mapea steps/files en importación', async () => {
    const worker = new FakeWorker();
    const events: Array<{ phase: string; unit: string; cancelable: boolean }> =
      [];
    const importServiceFactory = (prepare: ImportPreparer): ImportService => ({
      isBusy: () => true,
      cancel: () => ({ cancelled: false }),
      importWorld: async (archiveFile, callbacks) => {
        const prepared = await prepare({
          operationId: IMPORT_OPERATION_ID,
          archiveFile,
          importsDir: IMPORTS_DIR,
          assetsTempDir: ASSETS_TEMP_DIR,
          schemaVersion: 8,
          existingSlugs: ['mundo'],
          now: () => 1,
          ...(callbacks?.onEvent === undefined
            ? {}
            : { onEvent: callbacks.onEvent }),
        });

        callbacks?.onEvent?.({
          operation: 'import',
          phase: 'importing',
          completed: 0,
          total: 1,
          warnings: 0,
        });
        callbacks?.onEvent?.({
          operation: 'import',
          phase: 'saving',
          completed: 0,
          total: 1,
          warnings: 0,
        });

        expect(prepared.slugAdjusted).toBe(true);
        return {
          worldId: WORLD_ID,
          worldName: 'Mundo',
          slug: 'mundo-2',
          slugAdjusted: true,
          counts,
          warnings: [],
        };
      },
    });
    const coordinator = createTransferCoordinator(
      baseOptions({
        showImportDialog: async () => IMPORT_FILE,
        forkWorker: (() => worker) satisfies ForkTransferWorker,
        importServiceFactory,
        sendEvent: (event: TransferProgressEvent) =>
          events.push({
            phase: event.phase,
            unit: event.unit,
            cancelable: event.cancelable,
          }),
      }),
    );

    const promise = coordinator.importWorld();

    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    expect(worker.posted[0]).toMatchObject({
      type: 'import',
      operationId: IMPORT_OPERATION_ID,
      archiveFile: IMPORT_FILE,
      schemaVersion: 8,
      existingSlugs: ['mundo'],
    });

    for (const event of [
      { phase: 'reading', completed: 0, total: null, warnings: 0 },
      { phase: 'extracting', completed: 1, total: 2, warnings: 0 },
      { phase: 'preparing', completed: 2, total: 2, warnings: 0 },
    ]) {
      worker.emit(
        workerResponse(IMPORT_OPERATION_ID, {
          type: 'event',
          event: { operation: 'import', ...event },
        }),
      );
    }
    worker.emit(
      workerResponse(IMPORT_OPERATION_ID, {
        type: 'result',
        operation: 'import',
        result: {
          planFile: PLAN_FILE,
          stagingDir: IMPORT_TEMP_DIR,
          assetTempDir: ASSET_TEMP_OPERATION_DIR,
          worldId: WORLD_ID,
          worldName: 'Mundo',
          slug: 'mundo-2',
          slugAdjusted: true,
          counts,
          warnings: [],
          totalAssetBytes: 10,
        },
      }),
    );

    await expect(promise).resolves.toEqual({
      status: 'completed',
      data: {
        worldId: WORLD_ID,
        worldName: 'Mundo',
        slug: 'mundo-2',
        slugAdjusted: true,
        counts,
        warnings: [],
      },
    });
    expect(events.map((event) => event.phase)).toEqual([
      'reading',
      'extracting',
      'importing',
      'importing',
      'saving',
    ]);
    expect(events.map((event) => event.unit)).toEqual([
      'steps',
      'files',
      'steps',
      'steps',
      'steps',
    ]);
    expect(events[4]?.cancelable).toBe(false);
  });

  it('notifica a los suscriptores y permite desuscribirse', async () => {
    const worker = new FakeWorker();
    const listener = vi.fn();
    const coordinator = createTransferCoordinator(
      baseOptions({
        findWorld: () => ({ name: 'Mundo', slug: 'mundo' }),
        showExportDialog: async () => EXPORT_FILE,
        forkWorker: () => worker,
      }),
    );
    const unsubscribe = coordinator.subscribe(listener);
    const promise = coordinator.exportWorld(WORLD_ID);

    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'event',
        event: {
          operation: 'export',
          phase: 'packaging',
          completed: 1,
          total: 2,
          warnings: 0,
        },
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'event',
        event: {
          operation: 'export',
          phase: 'finalizing',
          completed: 1,
          total: 2,
          warnings: 0,
        },
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);

    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'result',
        operation: 'export',
        result: {
          worldId: WORLD_ID,
          worldName: 'Mundo',
          fileName: 'mundo.zip',
          size: 1,
          counts,
          warnings: [],
        },
      }),
    );
    await expect(promise).resolves.toMatchObject({ status: 'completed' });
  });

  it('no abre el diálogo si el mundo no existe o está en papelera', async () => {
    const showExportDialog = vi.fn(async () => EXPORT_FILE);
    const coordinator = createTransferCoordinator(
      baseOptions({
        findWorld: () => null,
        showExportDialog,
      }),
    );

    await expect(coordinator.exportWorld(WORLD_ID)).resolves.toEqual({
      status: 'failed',
      code: 'TRANSFER_SOURCE_NOT_FOUND',
    });
    expect(showExportDialog).not.toHaveBeenCalled();
  });

  it('devuelve cancelled si se cierra el diálogo y no arranca el worker', async () => {
    const forkWorker = vi.fn();
    const coordinator = createTransferCoordinator(
      baseOptions({
        findWorld: () => ({ name: 'Mundo', slug: 'mundo' }),
        showExportDialog: async () => null,
        forkWorker,
      }),
    );

    await expect(coordinator.exportWorld(WORLD_ID)).resolves.toEqual({
      status: 'cancelled',
    });
    expect(forkWorker).not.toHaveBeenCalled();
  });

  it('rechaza una segunda operación mientras hay una activa', async () => {
    const dialogControl: {
      resolve: (value: string | null) => void;
    } = { resolve: () => {} };
    const dialog = new Promise<string | null>((resolve) => {
      dialogControl.resolve = resolve;
    });
    const coordinator = createTransferCoordinator(
      baseOptions({
        findWorld: () => ({ name: 'Mundo', slug: 'mundo' }),
        showExportDialog: () => dialog,
      }),
    );

    const first = coordinator.exportWorld(WORLD_ID);
    await expect(coordinator.exportWorld(WORLD_ID)).resolves.toEqual({
      status: 'failed',
      code: 'TRANSFER_BUSY',
    });
    await expect(coordinator.importWorld()).resolves.toEqual({
      status: 'failed',
      code: 'TRANSFER_BUSY',
    });

    dialogControl.resolve(null);
    await expect(first).resolves.toEqual({ status: 'cancelled' });
    expect(coordinator.isBusy()).toBe(false);
  });

  it('cancela una exportación enviando cancel al worker', async () => {
    const worker = new FakeWorker();
    const coordinator = createTransferCoordinator(
      baseOptions({
        findWorld: () => ({ name: 'Mundo', slug: 'mundo' }),
        showExportDialog: async () => EXPORT_FILE,
        forkWorker: () => worker,
      }),
    );

    const promise = coordinator.exportWorld(WORLD_ID);

    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    expect(coordinator.cancel()).toEqual({ cancelled: true });
    expect(worker.posted[1]).toMatchObject({
      type: 'cancel',
      operationId: OPERATION_ID,
    });

    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'error',
        code: 'TRANSFER_CANCELLED',
      }),
    );

    await expect(promise).resolves.toEqual({ status: 'cancelled' });
  });

  it('cancela una importación en preparación a través del servicio y del worker', async () => {
    const worker = new FakeWorker();
    const cancel = vi.fn(() => ({ cancelled: true }));
    const importServiceFactory = (prepare: ImportPreparer): ImportService => ({
      isBusy: () => true,
      cancel,
      importWorld: async (archiveFile, callbacks) => {
        await prepare({
          operationId: IMPORT_OPERATION_ID,
          archiveFile,
          importsDir: IMPORTS_DIR,
          assetsTempDir: ASSETS_TEMP_DIR,
          schemaVersion: 8,
          existingSlugs: [],
          now: () => 1,
          ...(callbacks?.onEvent === undefined
            ? {}
            : { onEvent: callbacks.onEvent }),
        });

        return {
          worldId: WORLD_ID,
          worldName: 'Mundo',
          slug: 'mundo',
          slugAdjusted: false,
          counts,
          warnings: [],
        };
      },
    });
    const coordinator = createTransferCoordinator(
      baseOptions({
        showImportDialog: async () => IMPORT_FILE,
        forkWorker: () => worker,
        importServiceFactory,
      }),
    );

    const promise = coordinator.importWorld();

    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    expect(coordinator.cancel()).toEqual({ cancelled: true });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(worker.posted[1]).toMatchObject({
      type: 'cancel',
      operationId: IMPORT_OPERATION_ID,
    });

    worker.emit(
      workerResponse(IMPORT_OPERATION_ID, {
        type: 'error',
        code: 'TRANSFER_CANCELLED',
      }),
    );

    await expect(promise).resolves.toEqual({ status: 'cancelled' });
  });

  it('no permite cancelar durante saving', async () => {
    const worker = new FakeWorker();
    const coordinator = createTransferCoordinator(
      baseOptions({
        findWorld: () => ({ name: 'Mundo', slug: 'mundo' }),
        showExportDialog: async () => EXPORT_FILE,
        forkWorker: () => worker,
      }),
    );
    const promise = coordinator.exportWorld(WORLD_ID);

    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'event',
        event: {
          operation: 'export',
          phase: 'saving',
          completed: 0,
          total: 1,
          warnings: 0,
        },
      }),
    );

    expect(coordinator.cancel()).toEqual({ cancelled: false });
    expect(worker.posted).toHaveLength(1);

    worker.emit(
      workerResponse(OPERATION_ID, {
        type: 'result',
        operation: 'export',
        result: {
          worldId: WORLD_ID,
          worldName: 'Mundo',
          fileName: 'mundo.zip',
          size: 1,
          counts,
          warnings: [],
        },
      }),
    );
    await expect(promise).resolves.toMatchObject({ status: 'completed' });
  });

  it('el coordinador unavailable no abre nada y devuelve TRANSFER_UNAVAILABLE', async () => {
    const coordinator = createUnavailableTransferCoordinator();
    const listener = vi.fn();

    await expect(coordinator.exportWorld(WORLD_ID)).resolves.toEqual({
      status: 'failed',
      code: 'TRANSFER_UNAVAILABLE',
    });
    await expect(coordinator.importWorld()).resolves.toEqual({
      status: 'failed',
      code: 'TRANSFER_UNAVAILABLE',
    });
    expect(coordinator.cancel()).toEqual({ cancelled: false });
    expect(coordinator.isBusy()).toBe(false);
    expect(coordinator.subscribe(listener)).toEqual(expect.any(Function));
    coordinator.dispose();
  });

  it('dispose mata el worker y deja el coordinador no disponible', async () => {
    const worker = new FakeWorker();
    const coordinator = createTransferCoordinator(
      baseOptions({
        findWorld: () => ({ name: 'Mundo', slug: 'mundo' }),
        showExportDialog: async () => EXPORT_FILE,
        forkWorker: () => worker,
      }),
    );

    void coordinator.exportWorld(WORLD_ID);
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));

    coordinator.dispose();

    expect(worker.killed).toBe(true);
    expect(coordinator.isBusy()).toBe(false);
    await expect(coordinator.exportWorld(WORLD_ID)).resolves.toEqual({
      status: 'failed',
      code: 'TRANSFER_UNAVAILABLE',
    });
  });
});
