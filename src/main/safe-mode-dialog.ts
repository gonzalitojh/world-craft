/**
 * Composición Electron del aviso de modo seguro.
 *
 * La lógica del bucle vive en `safe-mode-prompt.ts`; aquí solo se conectan los
 * puertos con `dialog` y `shell` y se construye la recuperación desde copia con
 * las rutas ya resueltas.
 */
import { dialog, shell } from 'electron';
import { statSync } from 'node:fs';

import { APP_NAME } from '../shared/app-info';
import type { DatabaseErrorCode } from './db/errors';
import type { DataPaths } from './db/paths';
import {
  createSafeModePrompt,
  type SafeModeDecision,
} from './safe-mode-prompt';
import { createSafeModeRecovery } from './safe-mode-recovery';

/** Contexto ya resuelto que puede ofrecer el aviso. */
export interface SafeModeDialogOptions {
  /** Rutas resueltas; `null` si la propia carpeta `userData` no era válida. */
  readonly paths: DataPaths | null;
  readonly migrationsDir: string;
  /** Carpeta de respaldo para abrir cuando `paths` es `null`. */
  readonly userDataDirectory: string;
  readonly now?: () => number;
}

/** Muestra el aviso y devuelve la decisión del usuario. */
export async function showSafeModeDialog(
  code: DatabaseErrorCode,
  options: SafeModeDialogOptions,
): Promise<SafeModeDecision> {
  const paths = options.paths;

  return createSafeModePrompt(
    {
      showMessageBox: (messageOptions) => dialog.showMessageBox(messageOptions),
      openPath: (path) => shell.openPath(path),
      showErrorBox: (title, content) => {
        dialog.showErrorBox(title, content);
      },
      isDirectory: (path) => {
        try {
          return statSync(path).isDirectory();
        } catch {
          return false;
        }
      },
    },
    {
      code,
      appName: APP_NAME,
      backupsDirectory: paths?.backupsDir ?? null,
      userDataDirectory: paths?.userDataDir ?? options.userDataDirectory,
      recovery:
        paths === null
          ? null
          : createSafeModeRecovery({
              paths,
              migrationsDir: options.migrationsDir,
              ...(options.now === undefined ? {} : { now: options.now }),
            }),
    },
  );
}
