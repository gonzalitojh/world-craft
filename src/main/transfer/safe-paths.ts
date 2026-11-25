/**
 * Contención real de directorios de transferencia.
 *
 * Reutiliza la inspección de `assets/paths`: `lstat` sin seguir enlaces,
 * `realpath` para detectar junctions y comparación de la ruta real con la
 * esperada. Un enlace, una junction o un escape se traducen siempre a un error
 * estable de transferencia, nunca a una ruta del sistema.
 */
import { lstat, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  assertContained,
  assertDirectoryInside,
  assertFileInside,
  inspectDirectoryInside,
  type AssetDirectoryState,
} from '../assets/paths';
import type { TransferErrorCode } from '../../shared/contracts/transfer';
import { TransferError } from './errors';

/** Opciones de las comprobaciones de contención. */
export interface TransferContainmentOptions {
  readonly create?: boolean;
  readonly code?: TransferErrorCode;
}

/** Inspecciona un directorio sin lanzar; útil para decidir antes de borrar. */
export function inspectTransferDirectory(
  rootDir: string,
  directory: string,
): AssetDirectoryState {
  return inspectDirectoryInside(rootDir, directory);
}

/** Exige que un directorio exista y sea real, sin enlaces, dentro de su raíz. */
export function assertTransferDirectoryInside(
  rootDir: string,
  directory: string,
  options: TransferContainmentOptions = {},
): void {
  try {
    assertDirectoryInside(
      rootDir,
      directory,
      options.create === true ? { create: true } : undefined,
    );
  } catch {
    throw new TransferError(options.code ?? 'TRANSFER_INPUT_INVALID');
  }
}

/** Exige que el propio directorio no sea un enlace respecto a su padre. */
export function assertTransferRootDirectory(
  directory: string,
  options: TransferContainmentOptions = {},
): void {
  assertTransferDirectoryInside(dirname(directory), directory, options);
}

/** Exige que una ruta quede estrictamente dentro de una raíz. */
export function assertTransferContained(
  rootDir: string,
  candidate: string,
  code: TransferErrorCode = 'TRANSFER_INPUT_INVALID',
): void {
  try {
    assertContained(rootDir, candidate);
  } catch {
    throw new TransferError(code);
  }
}

/** Exige que un archivo sea regular y esté contenido, sin seguir enlaces. */
export function assertTransferFileInside(
  rootDir: string,
  filePath: string,
  expectedRelativePath: string,
  code: TransferErrorCode = 'TRANSFER_INPUT_INVALID',
): void {
  try {
    assertFileInside(rootDir, filePath, expectedRelativePath);
  } catch {
    throw new TransferError(code);
  }
}

/**
 * Borra un directorio solo si sigue siendo un directorio real dentro de su
 * raíz. Devuelve `false` si es un enlace, si escapó o si ya no es un directorio.
 */
export async function removeDirectoryIfSafe(
  rootDir: string,
  directory: string,
): Promise<boolean> {
  if (!isSafeAnchor(rootDir)) {
    return false;
  }

  const state = inspectDirectoryInside(rootDir, directory);

  if (state.state === 'missing') {
    return false;
  }

  if (state.state !== 'directory') {
    return false;
  }

  try {
    await rm(directory, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Borra una entrada de una carpeta temporal sin atravesar enlaces.
 *
 * Los enlaces y junctions se rechazan para no tocar su destino; quedan para
 * revisión manual y la limpieza registra el fallo parcial.
 */
export async function removeEntryInside(
  rootDir: string,
  entryPath: string,
): Promise<boolean> {
  if (!isSafeAnchor(rootDir)) {
    return false;
  }

  let stats;

  try {
    stats = await lstat(entryPath);
  } catch {
    return false;
  }

  if (stats.isSymbolicLink()) {
    return false;
  }

  if (stats.isDirectory()) {
    const state = inspectDirectoryInside(rootDir, entryPath);

    if (state.state !== 'directory') {
      return false;
    }
  }

  try {
    await rm(entryPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function isSafeAnchor(directory: string): boolean {
  const root = resolve(directory);

  return inspectDirectoryInside(dirname(root), root).state === 'directory';
}
