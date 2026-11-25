/**
 * Diálogos nativos de exportación e importación.
 *
 * Las rutas se generan y se quedan en el proceso principal; el renderer solo
 * recibe el resultado de la operación. El nombre por defecto se sanea para ser
 * válido en Windows: sin caracteres prohibidos, sin punto ni espacio final y
 * sin nombres reservados (`CON`, `NUL`, `COM1`…).
 *
 * Los helpers puros se exportan para probar el saneado sin abrir Electron.
 */
import {
  app,
  dialog,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import { join } from 'node:path';

import { messages } from '../messages/es';
import { getMainWindow } from '../window';
import { isWindowsReservedName } from './format/paths';

/** Datos para componer el nombre por defecto del archivo exportado. */
export interface ExportDialogInput {
  readonly slug: string;
  readonly name: string;
}

// Windows prohíbe los caracteres de control en nombres de archivo.
// eslint-disable-next-line no-control-regex
const INVALID_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g;
const MAX_FILE_NAME_LENGTH = 120;
const ZIP_EXTENSION = '.zip';

/**
 * Sanea un nombre de archivo para Windows.
 *
 * Sustituye caracteres prohibidos, elimina puntos y espacios finales, evita
 * nombres reservados y limita la longitud. Nunca devuelve una ruta.
 */
export function sanitizeWindowsFileName(
  raw: string,
  fallback = 'mundo',
): string {
  const normalized = raw
    .normalize('NFC')
    .replace(INVALID_FILE_NAME_CHARACTERS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, MAX_FILE_NAME_LENGTH)
    .replace(/[. ]+$/g, '');

  const candidate = normalized.length === 0 ? fallback : normalized;
  const safe = isWindowsReservedName(candidate) ? `_${candidate}` : candidate;

  return safe.replace(/[. ]+$/g, '') || fallback;
}

/** Compone el nombre por defecto de una exportación. */
export function buildExportFileName(input: ExportDialogInput): string {
  const source = input.name.trim().length > 0 ? input.name : input.slug;
  const base = sanitizeWindowsFileName(source, 'mundo').replace(/\.zip$/i, '');

  return `${base}${ZIP_EXTENSION}`;
}

/** Añade `.zip` si la ruta elegida no lo lleva ya. */
export function ensureZipExtension(filePath: string): string {
  return /\.zip$/i.test(filePath) ? filePath : `${filePath}${ZIP_EXTENSION}`;
}

/** Abre el diálogo de guardado y devuelve el destino o `null`. */
export async function showExportDialog(
  input: ExportDialogInput,
): Promise<string | null> {
  const options: SaveDialogOptions = {
    title: messages.transfer.exportDialogTitle,
    defaultPath: join(app.getPath('documents'), buildExportFileName(input)),
    filters: [
      {
        name: messages.transfer.exportFilterName,
        extensions: ['zip'],
      },
    ],
  };
  const window = getMainWindow();
  const result =
    window === null
      ? await dialog.showSaveDialog(options)
      : await dialog.showSaveDialog(window, options);

  return result.canceled || result.filePath === undefined
    ? null
    : ensureZipExtension(result.filePath);
}

/** Abre el diálogo de apertura y devuelve el ZIP elegido o `null`. */
export async function showImportDialog(): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: messages.transfer.importDialogTitle,
    properties: ['openFile'],
    filters: [
      {
        name: messages.transfer.importFilterName,
        extensions: ['zip'],
      },
      {
        name: messages.transfer.importAllFilesFilterName,
        extensions: ['*'],
      },
    ],
  };
  const window = getMainWindow();
  const result =
    window === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(window, options);

  return result.canceled ? null : (result.filePaths[0] ?? null);
}
