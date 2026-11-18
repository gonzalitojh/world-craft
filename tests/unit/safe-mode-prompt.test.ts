import { describe, expect, it, vi } from 'vitest';

import { messages } from '@/main/messages/es';
import {
  createSafeModePrompt,
  type SafeModePromptPorts,
} from '@/main/safe-mode-prompt';

const options = {
  code: 'DB_MIGRATION_FAILED' as const,
  appName: 'World Craft',
  backupsDirectory: 'C:\\datos\\backups\\pre-migration',
  userDataDirectory: 'C:\\datos',
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
});
