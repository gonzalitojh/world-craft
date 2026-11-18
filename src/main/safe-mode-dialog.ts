/**
 * Composición Electron del aviso de modo seguro.
 *
 * La lógica del bucle vive en `safe-mode-prompt.ts`; aquí solo se conectan los
 * puertos con `dialog` y `shell`. Las rutas llegan resueltas desde
 * `persistence.ts` para no duplicar la estructura de `userData`.
 */
import { dialog, shell } from 'electron';
import { statSync } from 'node:fs';

import { APP_NAME } from '../shared/app-info';
import type { DatabaseErrorCode } from './db/errors';
import {
  createSafeModePrompt,
  type SafeModeDecision,
} from './safe-mode-prompt';

/** Rutas ya resueltas que puede ofrecer el aviso. */
export interface SafeModeDialogPaths {
  readonly backupsDirectory: string | null;
  readonly userDataDirectory: string;
}

/** Muestra el aviso y devuelve la decisión del usuario. */
export async function showSafeModeDialog(
  code: DatabaseErrorCode,
  paths: SafeModeDialogPaths,
): Promise<SafeModeDecision> {
  return createSafeModePrompt(
    {
      showMessageBox: (options) => dialog.showMessageBox(options),
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
      backupsDirectory: paths.backupsDirectory,
      userDataDirectory: paths.userDataDirectory,
    },
  );
}
