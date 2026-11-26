import { describe, expect, it, vi } from 'vitest';

import type { DataService } from '@/main/data/service';
import { DataError } from '@/main/data/errors';
import { createDataIpcHandlers } from '@/main/ipc/handlers/data';
import { createIpcRouter, type IpcHandlers } from '@/main/ipc/registry';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type {
  DataCounts,
  DataDeleteCounts,
  DataUsage,
} from '@/shared/contracts/data';

const counts: DataCounts = {
  worlds: { active: 1, archived: 0, trash: 0 },
  entities: 2,
  assets: 3,
  backups: 4,
};

const usage: DataUsage = {
  totalBytes: 1,
  totalEntries: 1,
  partial: false,
  categories: {
    database: { bytes: 1, entries: 1, partial: false },
    assets: { bytes: 0, entries: 0, partial: false },
    backups: { bytes: 0, entries: 0, partial: false },
    logs: { bytes: 0, entries: 0, partial: false },
    temporary: { bytes: 0, entries: 0, partial: false },
  },
};

const emptyCounts: DataDeleteCounts = {
  databaseFiles: 0,
  assetFiles: 0,
  logEntries: 0,
  temporaryEntries: 0,
  backupDirectories: 0,
};

function service(overrides: Partial<DataService> = {}): DataService {
  return {
    summary: () => counts,
    usage: async () => usage,
    openFolder: async () => ({ opened: true }),
    planOrphans: () => ({
      purgeableFiles: 0,
      unreferencedFiles: 0,
      orphanThumbnails: 0,
      temporaryFiles: 0,
      missingFiles: 0,
      unexpectedEntries: 0,
      suspiciousLinks: 0,
      recoverableBytes: 0,
    }),
    purgeOrphans: async () => ({
      purgedFiles: 0,
      purgedBytes: 0,
      backupCreated: false,
    }),
    exportAll: async () => ({ status: 'cancelled' }),
    deleteAll: async () => ({
      status: 'deleted',
      restartRequired: true,
      counts: emptyCounts,
      remaining: [],
    }),
    ...overrides,
  };
}

function routeWith(dataService: DataService) {
  return createIpcRouter(
    createDataIpcHandlers(dataService) as unknown as IpcHandlers,
  );
}

describe('handlers IPC de datos', () => {
  it('envuelve las lecturas en DataResult completed', async () => {
    const route = routeWith(service());

    await expect(route(IPC_CHANNELS.dataGetSummary, {})).resolves.toEqual({
      ok: true,
      data: { status: 'completed', data: counts },
    });
    await expect(route(IPC_CHANNELS.dataGetUsage, {})).resolves.toEqual({
      ok: true,
      data: { status: 'completed', data: usage },
    });
    await expect(
      route(IPC_CHANNELS.dataOpenFolder, { folder: 'data' }),
    ).resolves.toEqual({
      ok: true,
      data: { status: 'completed', data: { opened: true } },
    });
    await expect(route(IPC_CHANNELS.dataPlanOrphans, {})).resolves.toMatchObject(
      {
        ok: true,
        data: { status: 'completed' },
      },
    );
  });

  it('convierte DataError en un fallo de dominio ok:true', async () => {
    const route = routeWith(
      service({
        summary: () => {
          throw new DataError('DATA_UNAVAILABLE');
        },
        exportAll: async () => {
          throw new DataError('DATA_BUSY');
        },
        deleteAll: async () => {
          throw new DataError('DATA_BUSY');
        },
      }),
    );

    await expect(route(IPC_CHANNELS.dataGetSummary, {})).resolves.toEqual({
      ok: true,
      data: { status: 'failed', code: 'DATA_UNAVAILABLE' },
    });
    await expect(route(IPC_CHANNELS.dataExportAll, {})).resolves.toEqual({
      ok: true,
      data: { status: 'failed', code: 'DATA_BUSY' },
    });
    await expect(
      route(IPC_CHANNELS.dataDeleteAll, {
        confirmation: 'delete-all-data',
        keepBackups: true,
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        status: 'failed',
        code: 'DATA_BUSY',
        restartRequired: false,
        counts: emptyCounts,
        remaining: [],
      },
    });
  });

  it('no filtra valores ni mensajes de una excepción desconocida', async () => {
    const route = routeWith(
      service({
        usage: async () => {
          throw new Error('C:\\datos\\secreto abc1234');
        },
      }),
    );
    const result = await route(IPC_CHANNELS.dataGetUsage, {});

    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(JSON.stringify(result)).not.toContain('secreto');
  });

  it('valida tokens y payloads antes de llamar al servicio', async () => {
    const purgeOrphans = vi.fn(service().purgeOrphans);
    const deleteAll = vi.fn(service().deleteAll);
    const route = routeWith(
      service({ purgeOrphans, deleteAll }),
    );

    await expect(
      route(IPC_CHANNELS.dataPurgeOrphans, { confirmation: 'otro' }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    await expect(
      route(IPC_CHANNELS.dataDeleteAll, {
        confirmation: 'delete-all-data',
        keepBackups: true,
        extra: true,
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    await expect(
      route(IPC_CHANNELS.dataOpenFolder, { folder: 'otra' }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });

    expect(purgeOrphans).not.toHaveBeenCalled();
    expect(deleteAll).not.toHaveBeenCalled();
  });

  it('pasa solo keepBackups al dominio tras validar el token', async () => {
    const deleteAll = vi.fn(service().deleteAll);
    const route = routeWith(service({ deleteAll }));

    await route(IPC_CHANNELS.dataDeleteAll, {
      confirmation: 'delete-all-data',
      keepBackups: false,
    });

    expect(deleteAll).toHaveBeenCalledWith({ keepBackups: false });
  });
});
