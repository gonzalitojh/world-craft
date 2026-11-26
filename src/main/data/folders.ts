/**
 * Apertura segura de las carpetas de datos.
 *
 * La ruta nunca sale del proceso principal: el renderer envía un enum y recibe
 * `{ opened: true }` o un `DataError`. Antes de crear o abrir se comprueba que
 * cada componente existente bajo `userData` sea un directorio real y no un
 * enlace; después de crear se repite la comprobación con `realpath`.
 */
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import type { DataOpenFolderResult } from '../../shared/contracts/data';
import type { DataPaths } from '../db/paths';
import { isDataFolder, type DataFolder } from './constants';
import { DataError, toDataError } from './errors';

export type { DataOpenFolderResult } from '../../shared/contracts/data';

/** Dependencias de la apertura. */
export interface OpenDataFolderOptions {
  readonly paths: DataPaths;
  readonly folder: DataFolder;
  /**
   * Normalmente `shell.openPath`; se inyecta para poder probarlo sin Electron.
   * Electron devuelve un string de error (vacío si abrió bien).
   */
  readonly openPath: (path: string) => Promise<void | string>;
}

/** Resuelve el enum a una ruta ya calculada de `DataPaths`. */
function resolveDataFolderPath(
  paths: DataPaths,
  folder: DataFolder,
): string {
  switch (folder) {
    case 'data':
      return paths.dataDir;
    case 'assets':
      return paths.assetsDir;
    case 'backups':
      return paths.backupsDir;
    case 'logs':
      return paths.logsDir;
    case 'imports':
      return paths.importsDir;
    case 'exports':
      return paths.exportsDir;
  }
}

/**
 * Abre una carpeta tras crearla best-effort y validar su contención real.
 *
 * Cualquier enlace intermedio, una ruta lexicalmente fuera de `userData` o un
 * destino real distinto se rechazan con `DATA_FOLDER_INVALID`. Un fallo de
 * creación o de `openPath` se traduce a `DATA_FOLDER_OPEN_FAILED`.
 */
export async function openDataFolder(
  options: OpenDataFolderOptions,
): Promise<DataOpenFolderResult> {
  if (!isDataFolder(options.folder)) {
    throw new DataError('DATA_FOLDER_INVALID');
  }

  const root = resolve(options.paths.userDataDir);
  let target: string;

  try {
    target = resolve(resolveDataFolderPath(options.paths, options.folder));
  } catch (error) {
    throw toDataError(error, 'DATA_FOLDER_INVALID');
  }

  assertLexicallyInside(root, target);

  try {
    await inspectExistingChain(root, target);
  } catch (error) {
    throw toDataError(error, 'DATA_FOLDER_INVALID');
  }

  try {
    await mkdir(target, { recursive: true });
  } catch (error) {
    throw toDataError(error, 'DATA_FOLDER_OPEN_FAILED');
  }

  try {
    await assertRealDirectoryInside(root, target);
  } catch (error) {
    throw toDataError(error, 'DATA_FOLDER_INVALID');
  }

  try {
    const openError = await options.openPath(target);

    if (typeof openError === 'string' && openError.length > 0) {
      throw new DataError('DATA_FOLDER_OPEN_FAILED');
    }
  } catch (error) {
    throw toDataError(error, 'DATA_FOLDER_OPEN_FAILED');
  }

  return { opened: true };
}

function assertLexicallyInside(root: string, target: string): void {
  const relation = relative(root, target);

  if (
    relation.length === 0 ||
    relation.startsWith('..') ||
    isAbsolute(relation)
  ) {
    throw new DataError('DATA_FOLDER_INVALID');
  }
}

/**
 * Recorre los componentes existentes sin seguir enlaces.
 *
 * Detiene al primer componente ausente: los que faltan los creará `mkdir`. Un
 * archivo o un enlace en cualquier posición invalida la carpeta.
 */
async function inspectExistingChain(
  root: string,
  target: string,
): Promise<void> {
  const segments = relative(root, target).split(/[\\/]/);
  let current = root;

  for (const segment of segments) {
    if (segment.length === 0) {
      throw new DataError('DATA_FOLDER_INVALID');
    }

    current = join(current, segment);

    let stats;

    try {
      stats = await lstat(current);
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }

      throw new DataError('DATA_FOLDER_INVALID', { cause: error });
    }

    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new DataError('DATA_FOLDER_INVALID');
    }
  }
}

async function assertRealDirectoryInside(
  root: string,
  target: string,
): Promise<void> {
  const stats = await lstat(target);

  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new DataError('DATA_FOLDER_INVALID');
  }

  const [realRoot, realTarget] = await Promise.all([
    realpath(root),
    realpath(target),
  ]);
  const relation = relative(realRoot, realTarget);

  if (
    relation.length === 0 ||
    relation.startsWith('..') ||
    isAbsolute(relation)
  ) {
    throw new DataError('DATA_FOLDER_INVALID');
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}
