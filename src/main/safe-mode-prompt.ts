/**
 * Lógica pura del aviso de modo seguro.
 *
 * No importa Electron: recibe los puertos de diálogo y apertura de carpetas.
 * Así se puede probar el bucle, las decisiones y el respaldo de error sin
 * cargar el runtime de escritorio.
 */
import type { DatabaseErrorCode } from './db/errors';
import { messages } from './messages/es';

/** Decisión del usuario tras el aviso de modo seguro. */
export type SafeModeDecision = 'continue' | 'exit';

/** Opciones mínimas que necesita el puerto de diálogo. */
export interface SafeModeMessageBoxOptions {
  readonly type: 'error';
  readonly title: string;
  readonly message: string;
  readonly detail: string;
  readonly buttons: string[];
  readonly defaultId: number;
  readonly cancelId: number;
  readonly noLink: boolean;
}

/** Puertos que aporta la composición Electron. */
export interface SafeModePromptPorts {
  showMessageBox(
    options: SafeModeMessageBoxOptions,
  ): Promise<{ readonly response: number }>;
  openPath(path: string): Promise<string>;
  showErrorBox(title: string, content: string): void;
  isDirectory(path: string): boolean;
}

export interface SafeModePromptOptions {
  readonly code: DatabaseErrorCode;
  readonly appName: string;
  readonly backupsDirectory: string | null;
  readonly userDataDirectory: string;
}

/**
 * Muestra el aviso en bucle hasta que el usuario decide continuar o salir.
 *
 * Abrir la carpeta no cierra el modo seguro: el aviso vuelve a aparecer. Un
 * fallo al abrir la carpeta también vuelve al aviso; solo se sale sin decisión
 * del usuario si falla el diálogo o el error de respaldo.
 */
export async function createSafeModePrompt(
  ports: SafeModePromptPorts,
  options: SafeModePromptOptions,
): Promise<SafeModeDecision> {
  const safeMode = messages.safeMode;
  const messageBoxOptions: SafeModeMessageBoxOptions = {
    type: 'error',
    title: safeMode.title(options.appName),
    message: safeMode.message,
    detail: `${safeMode.detail[options.code]}\n\n${safeMode.codeLabel}: ${options.code}`,
    buttons: [
      safeMode.buttons.openBackups,
      safeMode.buttons.continueInSafeMode,
      safeMode.buttons.exit,
    ],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  };

  for (;;) {
    let response: number;

    try {
      ({ response } = await ports.showMessageBox(messageBoxOptions));
    } catch {
      showFallbackError(ports, options.appName, 'fallback');

      return 'exit';
    }

    if (response !== 0) {
      return response === 1 ? 'continue' : 'exit';
    }

    try {
      const directory =
        options.backupsDirectory !== null &&
        ports.isDirectory(options.backupsDirectory)
          ? options.backupsDirectory
          : options.userDataDirectory;
      const error = await ports.openPath(directory);

      if (error.length > 0) {
        throw new Error();
      }
    } catch {
      if (!showFallbackError(ports, options.appName, 'openFolderError')) {
        return 'exit';
      }

      continue;
    }
  }
}

/**
 * Muestra el error de respaldo y devuelve si se pudo mostrar.
 *
 * Si el propio respaldo falla, el llamador debe salir para no dejar la app
 * bloqueada sin interfaz.
 */
function showFallbackError(
  ports: Pick<SafeModePromptPorts, 'showErrorBox'>,
  appName: string,
  kind: 'fallback' | 'openFolderError',
): boolean {
  const message = messages.safeMode[kind];

  try {
    ports.showErrorBox(message.title(appName), message.detail);

    return true;
  } catch {
    return false;
  }
}
