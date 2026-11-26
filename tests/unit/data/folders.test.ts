import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataError } from '@/main/data/errors';
import { openDataFolder } from '@/main/data/folders';
import { resolveDataPaths, type DataPaths } from '@/main/db/paths';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-data-folders-'));
  temporaryDirectories.push(directory);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createPaths(): Promise<DataPaths> {
  const root = await createTemporaryDirectory();
  const paths = resolveDataPaths(root);

  await mkdir(paths.userDataDir, { recursive: true });

  return paths;
}

describe('apertura de carpetas de datos', () => {
  it('abre una carpeta válida y devuelve solo el resultado de dominio', async () => {
    const paths = await createPaths();
    await mkdir(paths.dataDir, { recursive: true });
    const openPath = vi.fn(async (path: string) => {
      void path;
    });

    await expect(
      openDataFolder({ paths, folder: 'data', openPath }),
    ).resolves.toEqual({ opened: true });

    expect(openPath).toHaveBeenCalledTimes(1);
    expect(openPath.mock.calls[0]?.[0]).toBe(paths.dataDir);
  });

  it('crea la carpeta best-effort antes de abrirla', async () => {
    const paths = await createPaths();
    const openPath = vi.fn(async (path: string) => {
      void path;
    });

    await expect(
      openDataFolder({ paths, folder: 'backups', openPath }),
    ).resolves.toEqual({ opened: true });

    expect(openPath.mock.calls[0]?.[0]).toBe(paths.backupsDir);
  });

  it('rechaza una ruta fuera de userData sin llamar a openPath', async () => {
    const paths = await createPaths();
    const outside = await createTemporaryDirectory();
    const openPath = vi.fn(async () => {});

    await expect(
      openDataFolder({
        paths: { ...paths, logsDir: outside },
        folder: 'logs',
        openPath,
      }),
    ).rejects.toMatchObject({ code: 'DATA_FOLDER_INVALID' });

    expect(openPath).not.toHaveBeenCalled();
  });

  it('no sigue un enlace que saque la carpeta de userData', async (context) => {
    const paths = await createPaths();
    const outside = await createTemporaryDirectory();
    const openPath = vi.fn(async () => {});
    await mkdir(paths.backupsDir, { recursive: true }).catch(() => {});

    try {
      await rm(paths.backupsDir, { recursive: true, force: true });
      await symlink(
        outside,
        paths.backupsDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
    }

    try {
      await openDataFolder({ paths, folder: 'backups', openPath });
      throw new Error('La carpeta enlazada no se rechazó.');
    } catch (error) {
      expect(error).toBeInstanceOf(DataError);
      expect((error as DataError).code).toBe('DATA_FOLDER_INVALID');
    }

    expect(openPath).not.toHaveBeenCalled();
  });

  it('traduce el string de error de shell.openPath a un código estable', async () => {
    const paths = await createPaths();
    await mkdir(paths.logsDir, { recursive: true });

    await expect(
      openDataFolder({
        paths,
        folder: 'logs',
        openPath: async () => 'no se pudo abrir',
      }),
    ).rejects.toMatchObject({ code: 'DATA_FOLDER_OPEN_FAILED' });
  });

  it('traduce un fallo de openPath a un código estable sin rutas', async () => {
    const paths = await createPaths();
    await mkdir(paths.logsDir, { recursive: true });

    let caught: unknown;

    try {
      await openDataFolder({
        paths,
        folder: 'logs',
        openPath: () => Promise.reject(new Error(paths.logsDir)),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DataError);
    expect((caught as DataError).code).toBe('DATA_FOLDER_OPEN_FAILED');
    expect((caught as Error).message).not.toContain(paths.logsDir);
  });

  it('rechaza una carpeta no reconocida en tiempo de ejecución', async () => {
    const paths = await createPaths();

    await expect(
      openDataFolder({
        paths,
        folder: 'desconocida' as never,
        openPath: async () => {},
      }),
    ).rejects.toMatchObject({ code: 'DATA_FOLDER_INVALID' });
  });
});
