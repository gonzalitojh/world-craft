import { describe, expect, it, vi } from 'vitest';

import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type { DataCounts } from '@/shared/contracts/data';
import {
  createWorldCraftApi,
  type IpcInvoke,
} from '@/shared/contracts/world-craft-api';

const counts: DataCounts = {
  worlds: { active: 1, archived: 0, trash: 0 },
  entities: 2,
  assets: 3,
  backups: 4,
  quarantine: { assets: 0, references: 0 },
};

const usage = {
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

const countsTransfer = {
  entities: 2,
  entityTypes: 1,
  relationTypes: 1,
  tags: 0,
  relations: 0,
  versions: 0,
  assets: 5,
};

const emptyDeleteCounts = {
  databaseFiles: 0,
  assetFiles: 0,
  logEntries: 0,
  temporaryEntries: 0,
  backupDirectories: 0,
};

describe('API de datos del preload', () => {
  it('invoca lecturas y valida sus guardas', async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === IPC_CHANNELS.dataGetSummary) {
        return { ok: true, data: { status: 'completed', data: counts } };
      }

      if (channel === IPC_CHANNELS.dataGetUsage) {
        return { ok: true, data: { status: 'completed', data: usage } };
      }

      return {
        ok: true,
        data: { status: 'completed', data: { opened: true } },
      };
    }) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(api.data.getSummary()).resolves.toEqual({
      ok: true,
      data: { status: 'completed', data: counts },
    });
    await expect(api.data.getUsage()).resolves.toEqual({
      ok: true,
      data: { status: 'completed', data: usage },
    });
    await expect(api.data.openFolder('logs')).resolves.toEqual({
      ok: true,
      data: { status: 'completed', data: { opened: true } },
    });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.dataOpenFolder, {
      folder: 'logs',
    });
  });

  it('propaga failed y cancelación de la biblioteca', async () => {
    const events = [
      { status: 'cancelled' },
      { status: 'failed', code: 'DATA_BUSY' },
      {
        status: 'completed',
        fileName: 'biblioteca.zip',
        size: 10,
        worlds: 0,
        counts: countsTransfer,
        warnings: [],
      },
    ];
    let index = 0;
    const invoke = vi.fn(async () => ({
      ok: true,
      data: events[index++],
    })) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(api.data.exportAll()).resolves.toEqual({
      ok: true,
      data: { status: 'cancelled' },
    });
    await expect(api.data.exportAll()).resolves.toEqual({
      ok: true,
      data: { status: 'failed', code: 'DATA_BUSY' },
    });
    await expect(api.data.exportAll()).resolves.toEqual({
      ok: true,
      data: events[2],
    });
  });

  it('fija los tokens de borrado y purga en el preload', async () => {
    const invoke = vi.fn(async (channel: string) =>
      channel === IPC_CHANNELS.dataDeleteAll
        ? {
            ok: true,
            data: {
              status: 'deleted',
              restartRequired: true,
              counts: emptyDeleteCounts,
              remaining: [],
            },
          }
        : {
            ok: true,
            data: { status: 'completed', data: { opened: true } },
          },
    ) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(
      api.data.deleteAll({ keepBackups: true }),
    ).resolves.toMatchObject({ ok: true, data: { status: 'deleted' } });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.dataDeleteAll, {
      confirmation: 'delete-all-data',
      keepBackups: true,
    });

    await api.data.purgeOrphans();
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.dataPurgeOrphans, {
      confirmation: 'purge-orphans',
    });
  });

  it('degrada respuestas incoherentes y conserva data congelado', async () => {
    const invoke = vi.fn(async () => ({
      ok: true,
      data: { status: 'completed', data: { ...counts, extra: true } },
    })) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(api.data.getSummary()).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(Object.isFrozen(api.data)).toBe(true);
    expect('invoke' in api).toBe(false);
  });

  it('convierte una excepción de transporte en INTERNAL_ERROR', async () => {
    const invoke = vi.fn(async () => {
      throw new Error('transporte');
    }) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(api.data.getUsage()).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
