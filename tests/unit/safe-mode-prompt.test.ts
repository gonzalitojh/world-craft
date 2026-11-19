import { describe, expect, it, vi } from 'vitest';

import type { RestorableBackup } from '@/main/backup/restore';
import { formatBackupDate, messages } from '@/main/messages/es';
import {
  createSafeModePrompt,
  type SafeModePromptOptions,
  type SafeModePromptPorts,
  type SafeModeRecoveryPorts,
} from '@/main/safe-mode-prompt';

const options: SafeModePromptOptions = {
  code: 'DB_MIGRATION_FAILED' as const,
  appName: 'World Craft',
  backupsDirectory: 'C:\\datos\\backups\\pre-migration',
  userDataDirectory: 'C:\\datos',
  recovery: null,
};

const restorableBackup: RestorableBackup = {
  directory: 'C:\\datos\\backups\\daily\\20261119T100000000Z',
  manifest: {
    formatVersion: 2,
    reason: 'daily',
    createdAt: '2026-11-19T10:00:00.000Z',
    databaseFile: 'world-craft.sqlite',
    schemaVersion: 2,
    sizeBytes: 128,
    sha256: 'a'.repeat(64),
    integrity: 'ok',
    assetsIncluded: false,
  },
};

function createPorts(): {
  ports: SafeModePromptPorts;
  showMessageBox: ReturnType<typeof vi.fn>;
  openPath: ReturnType<typeof vi.fn>;
  showErrorBox: ReturnType<typeof vi.fn>;
  isDirectory: ReturnType<typeof vi.fn>;
} {
  const showMessageBox = vi.fn();
  const openPath = vi.fn(async () => '');
  const showErrorBox = vi.fn();
  const isDirectory = vi.fn(() => true);

  return {
    ports: { showMessageBox, openPath, showErrorBox, isDirectory },
    showMessageBox,
    openPath,
    showErrorBox,
    isDirectory,
  };
}

function createRecovery(): {
  recovery: SafeModeRecoveryPorts;
  findLatestBackup: ReturnType<typeof vi.fn>;
  chooseBackupDirectory: ReturnType<typeof vi.fn>;
  inspectBackup: ReturnType<typeof vi.fn>;
  restoreBackup: ReturnType<typeof vi.fn>;
  relaunch: ReturnType<typeof vi.fn>;
} {
  const findLatestBackup = vi.fn(async () => restorableBackup);
  const chooseBackupDirectory = vi.fn(async () => restorableBackup.directory);
  const inspectBackup = vi.fn(async () => restorableBackup);
  const restoreBackup = vi.fn(async () => ({
    ok: true as const,
    manifest: restorableBackup.manifest,
    preservationDirectory: 'C:\\datos\\backups\\pre-restore\\x',
  }));
  const relaunch = vi.fn();

  return {
    recovery: {
      findLatestBackup,
      chooseBackupDirectory,
      inspectBackup,
      restoreBackup,
      relaunch,
    },
    findLatestBackup,
    chooseBackupDirectory,
    inspectBackup,
    restoreBackup,
    relaunch,
  };
}

describe('aviso de modo seguro', () => {
  it('abre la carpeta de copias y vuelve a mostrar el diálogo', async () => {
    const { ports, showMessageBox, openPath, showErrorBox, isDirectory } =
      createPorts();

    isDirectory.mockReturnValue(true);
    showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 1 });

    await expect(createSafeModePrompt(ports, options)).resolves.toBe(
      'continue',
    );

    expect(openPath).toHaveBeenCalledWith(options.backupsDirectory);
    expect(showMessageBox).toHaveBeenCalledTimes(2);
    expect(showErrorBox).not.toHaveBeenCalled();

    const firstDialog = showMessageBox.mock.calls[0]?.[0] as {
      buttons: string[];
      detail: string;
    };

    expect(firstDialog.buttons).toEqual([
      messages.safeMode.buttons.openBackups,
      messages.safeMode.buttons.continueInSafeMode,
      messages.safeMode.buttons.exit,
    ]);
    expect(firstDialog.detail).toContain('DB_MIGRATION_FAILED');
  });

  it('usa userData si la carpeta de copias no existe', async () => {
    const { ports, showMessageBox, openPath, isDirectory } = createPorts();

    isDirectory.mockReturnValue(false);
    showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 2 });

    await expect(createSafeModePrompt(ports, options)).resolves.toBe('exit');

    expect(openPath).toHaveBeenCalledWith(options.userDataDirectory);
  });

  it('usa userData si no hay ruta de copias resuelta', async () => {
    const { ports, showMessageBox, openPath } = createPorts();

    showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 2 });

    await expect(
      createSafeModePrompt(ports, { ...options, backupsDirectory: null }),
    ).resolves.toBe('exit');

    expect(openPath).toHaveBeenCalledWith(options.userDataDirectory);
  });

  it('continúa en modo seguro sin abrir ninguna carpeta', async () => {
    const { ports, showMessageBox, openPath } = createPorts();

    showMessageBox.mockResolvedValue({ response: 1 });

    await expect(createSafeModePrompt(ports, options)).resolves.toBe(
      'continue',
    );

    expect(openPath).not.toHaveBeenCalled();
  });

  it('sale cuando el usuario elige Salir o cierra el diálogo', async () => {
    const { ports, showMessageBox, openPath } = createPorts();

    showMessageBox
      .mockResolvedValueOnce({ response: 2 })
      .mockResolvedValue({ response: -1 });

    await expect(createSafeModePrompt(ports, options)).resolves.toBe('exit');
    await expect(createSafeModePrompt(ports, options)).resolves.toBe('exit');

    expect(openPath).not.toHaveBeenCalled();
  });

  it('usa el error de respaldo y sale si showMessageBox falla', async () => {
    const { ports, showMessageBox, showErrorBox } = createPorts();

    showMessageBox.mockRejectedValue(new Error('fallo de diálogo'));

    await expect(createSafeModePrompt(ports, options)).resolves.toBe('exit');

    expect(showErrorBox).toHaveBeenCalledWith(
      messages.safeMode.fallback.title(options.appName),
      messages.safeMode.fallback.detail,
    );
    expect(showErrorBox.mock.calls[0]?.[1]).not.toContain(
      options.backupsDirectory,
    );
  });

  it('vuelve al diálogo si abrir la carpeta falla y el usuario continúa', async () => {
    const { ports, showMessageBox, openPath, showErrorBox } = createPorts();

    showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 1 });
    openPath.mockRejectedValueOnce(new Error('sin explorador'));

    await expect(createSafeModePrompt(ports, options)).resolves.toBe(
      'continue',
    );

    expect(showErrorBox).toHaveBeenCalledWith(
      messages.safeMode.openFolderError.title(options.appName),
      messages.safeMode.openFolderError.detail,
    );
    expect(showMessageBox).toHaveBeenCalledTimes(2);
    expect(openPath).toHaveBeenCalledTimes(1);
  });

  it('vuelve al diálogo si abrir la carpeta devuelve error y el usuario sale', async () => {
    const { ports, showMessageBox, openPath, showErrorBox } = createPorts();

    showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 2 });
    openPath.mockResolvedValueOnce('No se pudo abrir');

    await expect(createSafeModePrompt(ports, options)).resolves.toBe('exit');

    expect(showErrorBox).toHaveBeenCalledTimes(1);
    expect(showMessageBox).toHaveBeenCalledTimes(2);
  });

  it('sale si el error de respaldo de la carpeta también falla', async () => {
    const { ports, showMessageBox, openPath, showErrorBox } = createPorts();

    showMessageBox.mockResolvedValue({ response: 0 });
    openPath.mockRejectedValue(new Error('sin explorador'));
    showErrorBox.mockImplementation(() => {
      throw new Error('fallo de respaldo');
    });

    await expect(createSafeModePrompt(ports, options)).resolves.toBe('exit');
    expect(showMessageBox).toHaveBeenCalledTimes(1);
  });

  describe('restauración desde el aviso', () => {
    it('añade el botón solo cuando hay recuperación disponible', async () => {
      const { ports, showMessageBox } = createPorts();
      const { recovery } = createRecovery();

      showMessageBox.mockResolvedValue({ response: 2 });

      await createSafeModePrompt(ports, { ...options, recovery });

      expect(showMessageBox.mock.calls[0]?.[0]).toMatchObject({
        buttons: [
          messages.safeMode.buttons.openBackups,
          messages.safeMode.buttons.restoreBackup,
          messages.safeMode.buttons.continueInSafeMode,
          messages.safeMode.buttons.exit,
        ],
      });
    });

    it('restaura la copia más reciente tras confirmar y reinicia', async () => {
      const { ports, showMessageBox } = createPorts();
      const { recovery, findLatestBackup, restoreBackup, relaunch } =
        createRecovery();

      showMessageBox
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 0 })
        .mockResolvedValueOnce({ response: 0 });

      await expect(
        createSafeModePrompt(ports, { ...options, recovery }),
      ).resolves.toBe('exit');

      expect(findLatestBackup).toHaveBeenCalledTimes(1);
      expect(restoreBackup).toHaveBeenCalledWith(restorableBackup.directory);
      expect(relaunch).toHaveBeenCalledTimes(1);

      const choiceDialog = showMessageBox.mock.calls[1]?.[0] as {
        buttons: string[];
      };
      expect(choiceDialog.buttons).toEqual([
        messages.safeMode.restore.buttons.latest,
        messages.safeMode.restore.buttons.choose,
        messages.safeMode.restore.buttons.cancel,
      ]);

      const confirmDialog = showMessageBox.mock.calls[2]?.[0] as {
        message: string;
        buttons: string[];
        defaultId: number;
      };
      expect(confirmDialog.message).toContain(
        formatBackupDate(restorableBackup.manifest.createdAt),
      );
      expect(confirmDialog.message).toContain('2');
      expect(confirmDialog.buttons).toEqual([
        messages.safeMode.restore.confirm.buttons.restore,
        messages.safeMode.restore.confirm.buttons.cancel,
      ]);
      expect(confirmDialog.defaultId).toBe(1);
    });

    it('vuelve al aviso si no hay copias válidas', async () => {
      const { ports, showMessageBox, showErrorBox } = createPorts();
      const { recovery, findLatestBackup, restoreBackup } = createRecovery();

      findLatestBackup.mockResolvedValue(null);
      showMessageBox
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 0 })
        .mockResolvedValueOnce({ response: 2 });

      await expect(
        createSafeModePrompt(ports, { ...options, recovery }),
      ).resolves.toBe('continue');

      expect(showErrorBox).toHaveBeenCalledWith(
        messages.safeMode.restore.noBackups.title(options.appName),
        messages.safeMode.restore.noBackups.detail,
      );
      expect(restoreBackup).not.toHaveBeenCalled();
    });

    it('permite elegir una carpeta, verifica y cancela la confirmación', async () => {
      const { ports, showMessageBox, showErrorBox } = createPorts();
      const { recovery, chooseBackupDirectory, inspectBackup, restoreBackup } =
        createRecovery();

      showMessageBox
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 2 });

      await expect(
        createSafeModePrompt(ports, { ...options, recovery }),
      ).resolves.toBe('continue');

      expect(chooseBackupDirectory).toHaveBeenCalledTimes(1);
      expect(inspectBackup).toHaveBeenCalledWith(restorableBackup.directory);
      expect(restoreBackup).not.toHaveBeenCalled();
      expect(showErrorBox).not.toHaveBeenCalled();
    });

    it('avisa si la carpeta elegida no es una copia válida', async () => {
      const { ports, showMessageBox, showErrorBox } = createPorts();
      const { recovery, inspectBackup, restoreBackup } = createRecovery();

      inspectBackup.mockResolvedValue(null);
      showMessageBox
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 2 });

      await expect(
        createSafeModePrompt(ports, { ...options, recovery }),
      ).resolves.toBe('continue');

      expect(showErrorBox).toHaveBeenCalledWith(
        messages.safeMode.restore.selectionInvalid.title(options.appName),
        messages.safeMode.restore.selectionInvalid.detail,
      );
      expect(restoreBackup).not.toHaveBeenCalled();
    });

    it('avisa si la carpeta elegida se sale de backups', async () => {
      const { ports, showMessageBox, showErrorBox } = createPorts();
      const { recovery, chooseBackupDirectory, restoreBackup } =
        createRecovery();

      chooseBackupDirectory.mockRejectedValue(new Error('fuera de backups'));
      showMessageBox
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 2 });

      await expect(
        createSafeModePrompt(ports, { ...options, recovery }),
      ).resolves.toBe('continue');

      expect(showErrorBox).toHaveBeenCalledWith(
        messages.safeMode.restore.selectionInvalid.title(options.appName),
        messages.safeMode.restore.selectionInvalid.detail,
      );
      expect(restoreBackup).not.toHaveBeenCalled();
    });

    it('vuelve al aviso si la restauración falla', async () => {
      const { ports, showMessageBox, showErrorBox } = createPorts();
      const { recovery, restoreBackup, relaunch } = createRecovery();

      restoreBackup.mockResolvedValue({
        ok: false,
        code: 'DB_RESTORE_FAILED',
        reason: 'io',
      });
      showMessageBox
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 0 })
        .mockResolvedValueOnce({ response: 0 })
        .mockResolvedValueOnce({ response: 2 });

      await expect(
        createSafeModePrompt(ports, { ...options, recovery }),
      ).resolves.toBe('continue');

      expect(relaunch).not.toHaveBeenCalled();
      expect(showErrorBox).toHaveBeenCalledWith(
        messages.safeMode.restore.failed.title(options.appName),
        expect.stringContaining('DB_RESTORE_FAILED'),
      );
    });

    it('muestra el código de rollback fallido', async () => {
      const { ports, showMessageBox, showErrorBox } = createPorts();
      const { recovery, restoreBackup, relaunch } = createRecovery();

      restoreBackup.mockResolvedValue({
        ok: false,
        code: 'DB_RESTORE_ROLLBACK_FAILED',
        reason: 'rollback',
      });
      showMessageBox
        .mockResolvedValueOnce({ response: 1 })
        .mockResolvedValueOnce({ response: 0 })
        .mockResolvedValueOnce({ response: 0 })
        .mockResolvedValueOnce({ response: 2 });

      await expect(
        createSafeModePrompt(ports, { ...options, recovery }),
      ).resolves.toBe('continue');

      expect(relaunch).not.toHaveBeenCalled();
      expect(showErrorBox).toHaveBeenCalledWith(
        messages.safeMode.restore.failed.title(options.appName),
        expect.stringContaining('DB_RESTORE_ROLLBACK_FAILED'),
      );
    });
  });
});
