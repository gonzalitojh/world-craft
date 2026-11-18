import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showMessageBox: vi.fn(),
  showErrorBox: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock('electron', () => ({
  dialog: {
    showMessageBox: mocks.showMessageBox,
    showErrorBox: mocks.showErrorBox,
  },
  shell: { openPath: mocks.openPath },
}));

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
  mocks.openPath.mockReset();
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
  it('abre backups/pre-migration y vuelve a mostrar el diálogo', async () => {
    const userDataDir = await createUserDataDirectory();
    const backupsDirectory = join(userDataDir, 'backups', 'pre-migration');

    await mkdir(backupsDirectory, { recursive: true });
    mocks.showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 1 });

    await expect(
      showSafeModeDialog('DB_MIGRATION_FAILED', {
        backupsDirectory,
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('continue');

    expect(mocks.openPath).toHaveBeenCalledWith(backupsDirectory);
    expect(mocks.showMessageBox).toHaveBeenCalledTimes(2);
    expect(mocks.showErrorBox).not.toHaveBeenCalled();
  });

  it('usa userData cuando no hay carpeta de copias resuelta', async () => {
    const userDataDir = await createUserDataDirectory();

    mocks.showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 2 });

    await expect(
      showSafeModeDialog('DB_OPEN_FAILED', {
        backupsDirectory: null,
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('exit');

    expect(mocks.openPath).toHaveBeenCalledWith(userDataDir);
  });

  it('vuelve al diálogo si abrir la carpeta falla y el usuario continúa', async () => {
    const userDataDir = await createUserDataDirectory();
    const backupsDirectory = join(userDataDir, 'backups', 'pre-migration');

    await mkdir(backupsDirectory, { recursive: true });
    mocks.showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 1 });
    mocks.openPath.mockRejectedValueOnce(new Error('sin explorador'));

    await expect(
      showSafeModeDialog('DB_OPEN_FAILED', {
        backupsDirectory,
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
        backupsDirectory: null,
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
        backupsDirectory: null,
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
        backupsDirectory: null,
        userDataDirectory: userDataDir,
      }),
    ).resolves.toBe('exit');
    expect(mocks.showErrorBox).toHaveBeenCalledTimes(1);
    expect(mocks.openPath).not.toHaveBeenCalled();
  });
});
