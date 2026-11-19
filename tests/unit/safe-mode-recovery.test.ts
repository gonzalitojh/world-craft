import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  relaunch: vi.fn(),
  exit: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    relaunch: mocks.relaunch,
    exit: mocks.exit,
  },
  dialog: {
    showOpenDialog: mocks.showOpenDialog,
  },
}));

import type { DataPaths } from '@/main/db/paths';
import { resolveDataPaths } from '@/main/db/paths';
import { DatabaseError } from '@/main/db/errors';
import { createSafeModeRecovery } from '@/main/safe-mode-recovery';

const migrationsDir = fileURLToPath(new URL('../../drizzle/', import.meta.url));
const temporaryDirectories: string[] = [];

async function createPaths(): Promise<DataPaths> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-recovery-'));
  temporaryDirectories.push(directory);

  const paths = resolveDataPaths(directory);

  // La raíz de copias existe; así las pruebas de contención fallan por
  // `relative` y no porque `realpath` del root no resuelva.
  await mkdir(paths.backupsDir, { recursive: true });

  return paths;
}

beforeEach(() => {
  mocks.showOpenDialog.mockReset();
  mocks.relaunch.mockReset();
  mocks.exit.mockReset();
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('composición de la recuperación en modo seguro', () => {
  it('no ofrece copia si no hay ninguna válida', async () => {
    const paths = await createPaths();
    const recovery = createSafeModeRecovery({ paths, migrationsDir });

    await expect(recovery.findLatestBackup()).resolves.toBeNull();
  });

  it('devuelve null si el usuario cancela la elección de carpeta', async () => {
    const paths = await createPaths();
    const recovery = createSafeModeRecovery({ paths, migrationsDir });

    mocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    await expect(recovery.chooseBackupDirectory()).resolves.toBeNull();
  });

  it('acepta una carpeta dentro de backups y resuelve su ruta real', async () => {
    const paths = await createPaths();
    const candidate = join(paths.backupsDir, 'daily', 'copia');

    await mkdir(candidate, { recursive: true });

    const recovery = createSafeModeRecovery({ paths, migrationsDir });
    mocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [candidate],
    });

    await expect(recovery.chooseBackupDirectory()).resolves.toBe(
      await realpath(candidate),
    );
  });

  it('rechaza una carpeta fuera de backups', async () => {
    const paths = await createPaths();
    const outside = join(paths.userDataDir, 'fuera');

    await mkdir(outside, { recursive: true });

    const recovery = createSafeModeRecovery({ paths, migrationsDir });
    mocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [outside],
    });

    await expect(recovery.chooseBackupDirectory()).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });

  it('rechaza una junction que escapa de backups', async () => {
    const paths = await createPaths();
    const outside = join(paths.userDataDir, 'fuera-junction');
    const link = join(paths.backupsDir, 'enlace');

    await mkdir(outside, { recursive: true });

    try {
      await symlink(
        outside,
        link,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      // Sin permisos para crear enlaces: la prueba de contención normal sigue
      // cubriendo el caso.
      return;
    }

    const recovery = createSafeModeRecovery({ paths, migrationsDir });
    mocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [link],
    });

    await expect(recovery.chooseBackupDirectory()).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });

  it('reinicia la aplicación al restaurar', () => {
    const recovery = createSafeModeRecovery({
      paths: resolveDataPaths(join(tmpdir(), 'world-craft-recovery-relaunch')),
      migrationsDir,
    });

    recovery.relaunch();

    expect(mocks.relaunch).toHaveBeenCalledTimes(1);
    expect(mocks.exit).toHaveBeenCalledWith(0);
  });
});
