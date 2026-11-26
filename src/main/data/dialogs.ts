/**
 * Diálogo nativo para guardar la biblioteca total.
 *
 * La ruta se queda en el proceso principal. El nombre por defecto incluye la
 * fecha, se sanea para Windows y siempre termina en `.zip`.
 */
import {
  app,
  dialog,
  type SaveDialogOptions,
} from 'electron';
import { join } from 'node:path';

import { messages } from '../messages/es';
import {
  ensureZipExtension,
  sanitizeWindowsFileName,
} from '../transfer/dialogs';
import { getMainWindow } from '../window';

/** Compone `world-craft-<fecha>.zip` sin rutas. */
export function buildLibraryExportFileName(timestamp: number): string {
  const date = new Date(timestamp).toISOString().slice(0, 10);
  const base = sanitizeWindowsFileName(`world-craft-${date}`, 'biblioteca');

  return ensureZipExtension(base);
}

/** Abre el diálogo de guardado y devuelve la ruta o `null` si se cancela. */
export async function showLibraryExportDialog(options?: {
  readonly now?: () => number;
}): Promise<string | null> {
  const now = options?.now ?? Date.now;
  const dialogOptions: SaveDialogOptions = {
    title: messages.data.exportDialogTitle,
    defaultPath: join(
      app.getPath('documents'),
      buildLibraryExportFileName(now()),
    ),
    filters: [
      {
        name: messages.data.exportFilterName,
        extensions: ['zip'],
      },
    ],
  };
  const window = getMainWindow();
  const result =
    window === null
      ? await dialog.showSaveDialog(dialogOptions)
      : await dialog.showSaveDialog(window, dialogOptions);

  return result.canceled || result.filePath === undefined
    ? null
    : ensureZipExtension(result.filePath);
}
