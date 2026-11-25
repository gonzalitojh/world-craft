/**
 * Coordinador de exportación e importación del proceso principal.
 *
 * Es la única pieza que conoce Electron en el flujo de transferencia: abre los
 * diálogos nativos, arranca el utility process y traduce sus mensajes a
 * `TransferProgressEvent`. El resto del dominio (`archive`, `format`, `export`,
 * `import`) sigue siendo puro respecto a Electron.
 *
 * Hay una sola operación activa. El coordinador no expone rutas ni mensajes
 * internos: solo resultados tipados y eventos sin contenido del usuario.
 */
import { utilityProcess } from 'electron';
import { join } from 'node:path';

import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import { generateUuidv7 } from '../db/ids';
import { createWorldRepository } from '../worlds/repository';
import {
  type TransferEvent,
  type TransferExportResult,
  type TransferImportResult,
  type TransferPhase,
  type TransferProgressEvent,
  type TransferRunResult,
  type TransferUnit,
} from '../../shared/contracts/transfer';
import { TRANSFER_PROTOCOL_VERSION } from './constants';
import type { TransferCoordinator } from './coordinator';
import {
  showExportDialog as defaultShowExportDialog,
  showImportDialog as defaultShowImportDialog,
  type ExportDialogInput,
} from './dialogs';
import { toTransferErrorCode, TransferError } from './errors';
import type { PreparedImport } from './import/prepare';
import {
  createImportService,
  type ImportPreparer,
  type ImportService,
} from './import/service';
import { silentTransferLogger, type TransferLogger } from './logger';
import { parseWorkerResponse, type WorkerRequest } from './protocol';

/** Proceso mínimo que necesita el coordinador; se inyecta en pruebas. */
export interface TransferWorkerHandle {
  postMessage(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
  onExit(listener: (code: number) => void): () => void;
  kill(): void;
}

/** Fábrica del worker; por defecto usa `utilityProcess.fork`. */
export type ForkTransferWorker = () => TransferWorkerHandle;

/** Información mínima del mundo para el diálogo y la validación. */
export interface TransferWorldInfo {
  readonly name: string;
  readonly slug: string;
}

/** Opciones inyectables del coordinador. */
export interface TransferCoordinatorOptions {
  /** Base de datos para validar el mundo y ejecutar la transacción de importación. */
  readonly database?: WorldCraftDatabase;
  readonly sqlite?: SqliteDatabase;
  readonly databaseFile: string;
  readonly assetsDir: string;
  readonly importsDir: string;
  readonly assetsTempDir: string;
  readonly assetsWorldsDir: string;
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly forkWorker?: ForkTransferWorker;
  readonly showExportDialog?: (
    input: ExportDialogInput,
  ) => Promise<string | null>;
  readonly showImportDialog?: () => Promise<string | null>;
  /** Resolución del mundo; por defecto usa el repositorio de mundos. */
  readonly findWorld?: (worldId: string) => TransferWorldInfo | null;
  /** Sustituye la creación del servicio de importación en pruebas. */
  readonly importServiceFactory?: (prepare: ImportPreparer) => ImportService;
  readonly now?: () => number;
  readonly generateOperationId?: () => string;
  readonly logger?: TransferLogger;
  /** Destino alternativo a los suscriptores; útil en pruebas. */
  readonly sendEvent?: (event: TransferProgressEvent) => void;
}

type ActiveKind = 'export' | 'import' | null;

/** Crea el coordinador real. */
export function createTransferCoordinator(
  options: TransferCoordinatorOptions,
): TransferCoordinator {
  const now = options.now ?? Date.now;
  const generateOperationId = options.generateOperationId ?? generateUuidv7;
  const logger = options.logger ?? silentTransferLogger;
  const forkWorker = options.forkWorker ?? forkDefaultWorker;
  const showExportDialog = options.showExportDialog ?? defaultShowExportDialog;
  const showImportDialog = options.showImportDialog ?? defaultShowImportDialog;
  const findWorld = options.findWorld ?? createFindWorld(options);
  const listeners = new Set<(event: TransferProgressEvent) => void>();

  let busy = false;
  let activeKind: ActiveKind = null;
  let activeWorker: TransferWorkerHandle | null = null;
  let activeWorkerOperationId: string | null = null;
  let importService: ImportService | null = null;
  let importOperationId: string | null = null;
  let lastPhase: TransferPhase | null = null;
  let disposed = false;

  const publish = (event: TransferProgressEvent): void => {
    try {
      options.sendEvent?.(event);
    } catch {
      // Un consumidor no debe romper la operación.
    }

    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch {
        // Un listener no debe romper la operación ni a los demás.
      }
    }
  };

  const publishWorkerEvent = (
    operation: 'export' | 'import',
    operationId: string,
    event: TransferEvent,
  ): void => {
    const phase = normalizePhase(operation, event.phase, lastPhase);

    lastPhase = phase;
    publish({
      ...event,
      phase,
      operationId,
      unit: unitForPhase(phase),
      cancelable: phase !== 'saving',
    });
  };

  const createImportServiceForRun = (
    prepare: ImportPreparer,
  ): ImportService => {
    if (options.importServiceFactory !== undefined) {
      return options.importServiceFactory(prepare);
    }

    if (options.database === undefined || options.sqlite === undefined) {
      throw new TransferError('TRANSFER_UNAVAILABLE');
    }

    return createImportService({
      database: options.database,
      sqlite: options.sqlite,
      importsDir: options.importsDir,
      assetsDir: options.assetsDir,
      assetsWorldsDir: options.assetsWorldsDir,
      assetsTempDir: options.assetsTempDir,
      schemaVersion: options.schemaVersion,
      prepare,
      now,
      generateOperationId,
      logger,
    });
  };

  const prepareWithWorker: ImportPreparer = async (prepareOptions) => {
    const operationId = prepareOptions.operationId;

    importOperationId = operationId;

    return runWorkerOperation<PreparedImport>({
      operation: 'import',
      operationId,
      request: {
        type: 'import',
        protocolVersion: TRANSFER_PROTOCOL_VERSION,
        operationId,
        archiveFile: prepareOptions.archiveFile,
        importsDir: prepareOptions.importsDir,
        assetsDir: options.assetsDir,
        assetsTempDir: prepareOptions.assetsTempDir,
        schemaVersion: options.schemaVersion,
        existingSlugs: [...prepareOptions.existingSlugs],
        now: (prepareOptions.now ?? now)(),
      },
      onEvent: (event) => publishWorkerEvent('import', operationId, event),
      forkWorker,
      setWorker: (worker, id) => {
        activeWorker = worker;
        activeWorkerOperationId = id;
      },
      clearWorker: () => {
        activeWorker = null;
        activeWorkerOperationId = null;
      },
    });
  };

  const runExport = async (
    worldId: string,
  ): Promise<TransferRunResult<TransferExportResult>> => {
    const world = findWorld(worldId);

    if (world === null) {
      return { status: 'failed', code: 'TRANSFER_SOURCE_NOT_FOUND' };
    }

    const destinationFile = await showExportDialog(world);

    if (destinationFile === null) {
      return { status: 'cancelled' };
    }

    if (disposed) {
      return { status: 'failed', code: 'TRANSFER_UNAVAILABLE' };
    }

    const operationId = generateOperationId();
    const request: WorkerRequest = {
      type: 'export',
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      operationId,
      worldId,
      databaseFile: options.databaseFile,
      destinationFile,
      assetsDir: options.assetsDir,
      appVersion: options.appVersion,
      schemaVersion: options.schemaVersion,
      now: now(),
    };
    const result = await runWorkerOperation<TransferExportResult>({
      operation: 'export',
      operationId,
      request,
      onEvent: (event) => publishWorkerEvent('export', operationId, event),
      forkWorker,
      setWorker: (worker, id) => {
        activeWorker = worker;
        activeWorkerOperationId = id;
      },
      clearWorker: () => {
        activeWorker = null;
        activeWorkerOperationId = null;
      },
    });

    return { status: 'completed', data: result };
  };

  const runImport = async (): Promise<
    TransferRunResult<TransferImportResult>
  > => {
    const archiveFile = await showImportDialog();

    if (archiveFile === null) {
      return { status: 'cancelled' };
    }

    if (disposed) {
      return { status: 'failed', code: 'TRANSFER_UNAVAILABLE' };
    }

    const service = createImportServiceForRun(prepareWithWorker);
    importService = service;

    try {
      const result = await service.importWorld(archiveFile, {
        onEvent: (event) => {
          if (importOperationId !== null) {
            publishWorkerEvent('import', importOperationId, event);
          }
        },
      });

      return { status: 'completed', data: result };
    } finally {
      importService = null;
      importOperationId = null;
    }
  };

  return {
    async exportWorld(worldId) {
      if (disposed) {
        return { status: 'failed', code: 'TRANSFER_UNAVAILABLE' };
      }

      if (busy) {
        return { status: 'failed', code: 'TRANSFER_BUSY' };
      }

      busy = true;
      activeKind = 'export';
      lastPhase = null;
      logger.log({
        event: 'transfer.operation',
        operation: 'export',
        phase: 'preparing',
        outcome: 'started',
        warnings: 0,
      });

      try {
        const result = await runExport(worldId);

        logResult('export', logger, result);
        return result;
      } catch (error) {
        const result = toRunResult<TransferExportResult>(error);
        logResult('export', logger, result);
        return result;
      } finally {
        busy = false;
        activeKind = null;
        lastPhase = null;
      }
    },

    async importWorld() {
      if (disposed) {
        return { status: 'failed', code: 'TRANSFER_UNAVAILABLE' };
      }

      if (busy) {
        return { status: 'failed', code: 'TRANSFER_BUSY' };
      }

      busy = true;
      activeKind = 'import';
      lastPhase = null;
      logger.log({
        event: 'transfer.operation',
        operation: 'import',
        phase: 'preparing',
        outcome: 'started',
        warnings: 0,
      });

      try {
        const result = await runImport();

        logResult('import', logger, result);
        return result;
      } catch (error) {
        const result = toRunResult<TransferImportResult>(error);
        logResult('import', logger, result);
        return result;
      } finally {
        busy = false;
        activeKind = null;
        lastPhase = null;
        importService = null;
        importOperationId = null;
      }
    },

    cancel() {
      // `saving` no es cancelable ni en exportación ni en importación: la
      // transacción o la publicación ya están en curso.
      if (lastPhase === 'saving') {
        return { cancelled: false };
      }

      if (activeKind === 'import' && importService !== null) {
        const result = importService.cancel();

        if (
          result.cancelled &&
          activeWorker !== null &&
          activeWorkerOperationId !== null &&
          activeWorkerOperationId === importOperationId
        ) {
          sendWorkerCancel(activeWorker, activeWorkerOperationId);
        }

        return result;
      }

      if (
        activeKind === 'export' &&
        activeWorker !== null &&
        activeWorkerOperationId !== null
      ) {
        sendWorkerCancel(activeWorker, activeWorkerOperationId);
        return { cancelled: true };
      }

      return { cancelled: false };
    },

    isBusy() {
      return busy;
    },

    subscribe(listener) {
      if (typeof listener !== 'function' || disposed) {
        return () => {};
      }

      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      busy = false;
      activeKind = null;
      lastPhase = null;

      if (activeWorker !== null) {
        const worker = activeWorker;
        activeWorker = null;
        activeWorkerOperationId = null;
        worker.kill();
      }

      importService?.cancel();
      importService = null;
      importOperationId = null;
      listeners.clear();
    },
  };
}

interface RunWorkerOptions {
  readonly operation: 'export' | 'import';
  readonly operationId: string;
  readonly request: WorkerRequest;
  readonly onEvent: (event: TransferEvent) => void;
  readonly forkWorker: ForkTransferWorker;
  readonly setWorker: (
    worker: TransferWorkerHandle,
    operationId: string,
  ) => void;
  readonly clearWorker: () => void;
}

function runWorkerOperation<T>(options: RunWorkerOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let worker: TransferWorkerHandle;
    let settled = false;
    let unsubscribeMessage = (): void => {};
    let unsubscribeExit = (): void => {};

    const finish = (action: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      unsubscribeMessage();
      unsubscribeExit();
      options.clearWorker();

      try {
        worker.kill();
      } catch {
        // El worker pudo terminar solo; la promesa debe resolverse igualmente.
      }

      action();
    };

    try {
      worker = options.forkWorker();
      options.setWorker(worker, options.operationId);
    } catch (error) {
      reject(new TransferError('TRANSFER_INTERNAL', { cause: error }));
      return;
    }

    unsubscribeMessage = worker.onMessage((message) => {
      let response;

      try {
        response = parseWorkerResponse(message);
      } catch (error) {
        finish(() =>
          reject(new TransferError('TRANSFER_INTERNAL', { cause: error })),
        );
        return;
      }

      if (response.operationId !== options.operationId) {
        return;
      }

      if (response.type === 'event') {
        try {
          options.onEvent(response.event);
        } catch (error) {
          finish(() =>
            reject(new TransferError('TRANSFER_INTERNAL', { cause: error })),
          );
        }
        return;
      }

      if (response.type === 'error') {
        finish(() => reject(new TransferError(response.code)));
        return;
      }

      if (
        response.type === 'result' &&
        response.operation === options.operation
      ) {
        finish(() => resolve(response.result as unknown as T));
        return;
      }

      finish(() => reject(new TransferError('TRANSFER_INTERNAL')));
    });

    unsubscribeExit = worker.onExit(() => {
      finish(() => reject(new TransferError('TRANSFER_INTERNAL')));
    });

    try {
      worker.postMessage(options.request);
    } catch (error) {
      finish(() =>
        reject(new TransferError('TRANSFER_INTERNAL', { cause: error })),
      );
    }
  });
}

function sendWorkerCancel(
  worker: TransferWorkerHandle,
  operationId: string,
): void {
  try {
    worker.postMessage({
      type: 'cancel',
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      operationId,
    });
  } catch {
    // Si el worker ya murió, la operación terminará por su propio error.
  }
}

function normalizePhase(
  operation: 'export' | 'import',
  phase: TransferPhase,
  lastPhase: TransferPhase | null,
): TransferPhase {
  // El worker de importación emite `preparing` de nuevo al publicar assets,
  // después de `extracting`. La UI espera una progresión sin retrocesos; se
  // presenta como `importing` y se conserva la unidad de pasos.
  if (
    operation === 'import' &&
    phase === 'preparing' &&
    lastPhase !== null &&
    (lastPhase === 'extracting' ||
      lastPhase === 'importing' ||
      lastPhase === 'saving')
  ) {
    return 'importing';
  }

  return phase;
}

function unitForPhase(phase: TransferPhase): TransferUnit {
  return phase === 'packaging' ||
    phase === 'finalizing' ||
    phase === 'extracting'
    ? 'files'
    : 'steps';
}

function toRunResult<T>(error: unknown): TransferRunResult<T> {
  const code = toTransferErrorCode(error, 'TRANSFER_INTERNAL');

  return code === 'TRANSFER_CANCELLED'
    ? { status: 'cancelled' }
    : { status: 'failed', code };
}

function logResult<T extends { readonly warnings: readonly unknown[] }>(
  operation: 'export' | 'import',
  logger: TransferLogger,
  result: TransferRunResult<T>,
): void {
  if (result.status === 'completed') {
    logger.log({
      event: 'transfer.operation',
      operation,
      phase: 'saving',
      outcome: 'completed',
      warnings: result.data.warnings.length,
    });
    return;
  }

  if (result.status === 'cancelled') {
    logger.log({
      event: 'transfer.operation',
      operation,
      phase: 'preparing',
      outcome: 'cancelled',
      warnings: 0,
    });
    return;
  }

  logger.log({
    event: 'transfer.operation',
    operation,
    phase: 'preparing',
    outcome: 'failed',
    code: result.code,
  });
}

function createFindWorld(
  options: TransferCoordinatorOptions,
): (worldId: string) => TransferWorldInfo | null {
  if (options.database === undefined) {
    return () => null;
  }

  const repository = createWorldRepository(options.database);

  return (worldId) => {
    const record = repository.findById(worldId);

    return record === null || record.deletedAt !== null
      ? null
      : { name: record.name, slug: record.slug };
  };
}

function forkDefaultWorker(): TransferWorkerHandle {
  const child = utilityProcess.fork(
    join(__dirname, 'transfer-worker.cjs'),
    [],
    {
      serviceName: 'world-craft-transfer',
      stdio: 'ignore',
    },
  );

  return {
    postMessage(message) {
      child.postMessage(message);
    },
    onMessage(listener) {
      const handler = (message: unknown): void => {
        listener(message);
      };

      child.on('message', handler);

      return () => child.off('message', handler);
    },
    onExit(listener) {
      const handler = (code: number): void => {
        listener(code);
      };

      child.on('exit', handler);

      return () => child.off('exit', handler);
    },
    kill() {
      try {
        child.kill();
      } catch {
        // El proceso ya pudo terminar.
      }
    },
  };
}
