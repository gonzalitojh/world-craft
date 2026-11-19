import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showMessageBox: vi.fn(),
  showErrorBox: vi.fn(),
  showOpenDialog: vi.fn(),
  openPath: vi.fn(),
  relaunch: vi.fn(),
  exit: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    relaunch: mocks.relaunch,
    exit: mocks.exit,
  },
  dialog: {
    showMessageBox: mocks.showMessageBox,
    showErrorBox: mocks.showErrorBox,
    showOpenDialog: mocks.showOpenDialog,
  },
  shell: { openPath: mocks.openPath },
}));

import { resolveDataPaths } from '@/main/db/paths';
import { showSafeModeDialog } from '@/main/safe-mode-dialog';

const temporaryDirectories: string[] = [];

async function createUserDataDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-dialog-'));
  temporaryDirectories.push(directory);

  return directory;
}

beforeEach(() => {
  mocks.showMessageBox.mockReset();
  mocks.showErrorBox.mockReset();
  mocks.showOpenDialog.mockReset();
  mocks.openPath.mockReset();
  mocks.relaunch.mockReset();
  mocks.exit.mockReset();
  mocks.openPath.mockResolvedValue('');
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('composición del aviso de modo seguro', () => {
  it('abre la carpeta de copias y vuelve a mostrar el diálogo', async () => {
    const userDataDir = await createUserDataDirectory();
    const paths = resolveDataPaths(userDataDir);

    await mkdir(paths.backupsDir, { recursive: true });
    mocks.showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 2 });

    await expect(
      showSafeModeDialog('DB_MIGRATION_FAILED', {
        paths,
        migrationsDir: join(userDataDir, 'migrations'),
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('continue');

    expect(mocks.openPath).toHaveBeenCalledWith(paths.backupsDir);
    expect(mocks.showMessageBox).toHaveBeenCalledTimes(2);
    expect(mocks.showErrorBox).not.toHaveBeenCalled();
  });

  it('usa userData cuando no hay rutas de datos resueltas', async () => {
    const userDataDir = await createUserDataDirectory();

    mocks.showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 2 });

    await expect(
      showSafeModeDialog('DB_OPEN_FAILED', {
        paths: null,
        migrationsDir: join(userDataDir, 'migrations'),
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('exit');

    expect(mocks.openPath).toHaveBeenCalledWith(userDataDir);
  });

  it('vuelve al diálogo si abrir la carpeta falla y el usuario continúa', async () => {
    const userDataDir = await createUserDataDirectory();
    const paths = resolveDataPaths(userDataDir);

    await mkdir(paths.backupsDir, { recursive: true });
    mocks.showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 2 });
    mocks.openPath.mockRejectedValueOnce(new Error('sin explorador'));

    await expect(
      showSafeModeDialog('DB_OPEN_FAILED', {
        paths,
        migrationsDir: join(userDataDir, 'migrations'),
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('continue');

    expect(mocks.showErrorBox).toHaveBeenCalledTimes(1);
    expect(mocks.showMessageBox).toHaveBeenCalledTimes(2);
  });

  it('continúa en modo seguro sin abrir carpetas', async () => {
    const userDataDir = await createUserDataDirectory();

    mocks.showMessageBox.mockResolvedValue({ response: 1 });

    await expect(
      showSafeModeDialog('DB_OPEN_FAILED', {
        paths: null,
        migrationsDir: join(userDataDir, 'migrations'),
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('continue');

    expect(mocks.openPath).not.toHaveBeenCalled();
    expect(mocks.showErrorBox).not.toHaveBeenCalled();
  });

  it('sale sin abrir carpetas cuando el usuario elige Salir', async () => {
    const userDataDir = await createUserDataDirectory();

    mocks.showMessageBox.mockResolvedValue({ response: 2 });

    await expect(
      showSafeModeDialog('DB_OPEN_FAILED', {
        paths: null,
        migrationsDir: join(userDataDir, 'migrations'),
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('exit');

    expect(mocks.openPath).not.toHaveBeenCalled();
  });

  it('usa showErrorBox y sale si el diálogo falla', async () => {
    const userDataDir = await createUserDataDirectory();

    mocks.showMessageBox.mockRejectedValue(new Error('fallo de diálogo'));

    await expect(
      showSafeModeDialog('DB_INTEGRITY_FAILED', {
        paths: null,
        migrationsDir: join(userDataDir, 'migrations'),
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('exit');
    expect(mocks.showErrorBox).toHaveBeenCalledTimes(1);
    expect(mocks.openPath).not.toHaveBeenCalled();
  });

  it('ofrece restaurar cuando las rutas están resueltas', async () => {
    const userDataDir = await createUserDataDirectory();
    const paths = resolveDataPaths(userDataDir);

    mocks.showMessageBox.mockResolvedValue({ response: 2 });

    await showSafeModeDialog('DB_INTEGRITY_FAILED', {
      paths,
      migrationsDir: join(userDataDir, 'migrations'),
      userDataDirectory: userDataDir,
    });

    const dialog = mocks.showMessageBox.mock.calls[0]?.[0] as {
      buttons: string[];
    };

    expect(dialog.buttons).toHaveLength(4);
  });
});
