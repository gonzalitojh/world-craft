import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUnavailableDataService } from '@/main/data/unavailable';
import { resolveDataPaths } from '@/main/db/paths';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('servicio de datos en modo seguro', () => {
  it('devuelve DATA_UNAVAILABLE en lecturas y purgas', async () => {
    const service = createUnavailableDataService();

    expect(() => service.summary()).toThrowError(
      expect.objectContaining({ code: 'DATA_UNAVAILABLE' }),
    );
    await expect(service.usage()).rejects.toMatchObject({
      code: 'DATA_UNAVAILABLE',
    });
    expect(() => service.planOrphans()).toThrowError(
      expect.objectContaining({ code: 'DATA_UNAVAILABLE' }),
    );
    await expect(service.purgeOrphans('purge-orphans')).rejects.toMatchObject({
      code: 'DATA_UNAVAILABLE',
    });
    await expect(service.exportAll()).resolves.toEqual({
      status: 'failed',
      code: 'DATA_UNAVAILABLE',
    });
    await expect(service.deleteAll({ keepBackups: false })).resolves.toEqual({
      status: 'failed',
      code: 'DATA_UNAVAILABLE',
      restartRequired: false,
      counts: {
        databaseFiles: 0,
        assetFiles: 0,
        logEntries: 0,
        temporaryEntries: 0,
        backupDirectories: 0,
      },
      remaining: [],
    });
  });

  it('abre carpetas si las rutas son válidas', async () => {
    const root = await mkdtemp(join(tmpdir(), 'world-craft-unavailable-'));
    temporaryDirectories.push(root);
    const paths = resolveDataPaths(root);
    const openPath = vi.fn(async (path: string) => {
      void path;
    });
    const service = createUnavailableDataService({ paths, openPath });

    await expect(service.openFolder('data')).resolves.toEqual({
      opened: true,
    });
    expect(openPath).toHaveBeenCalledTimes(1);
  });

  it('falla al abrir si no hay rutas u openPath', async () => {
    const service = createUnavailableDataService();

    await expect(service.openFolder('data')).rejects.toMatchObject({
      code: 'DATA_UNAVAILABLE',
    });
  });
});
