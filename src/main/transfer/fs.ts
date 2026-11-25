/**
 * Utilidades de sistema de archivos de la transferencia.
 *
 * Todas las comprobaciones evitan seguir enlaces: un archivo de asset debe ser
 * regular y no un symlink o una junction. Los errores no incluyen rutas.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, statfs } from 'node:fs/promises';

import { TransferError } from './errors';

/** Huella de un archivo regular. */
export interface FileFingerprint {
  readonly size: number;
  readonly sha256: string;
}

/** Calcula el tamaño y el SHA-256 de un archivo, sin seguir enlaces. */
export async function fingerprintFile(
  filePath: string,
): Promise<FileFingerprint> {
  let stats;

  try {
    stats = await lstat(filePath);
  } catch (error) {
    throw isMissingError(error)
      ? new TransferError('TRANSFER_ASSET_INVALID')
      : new TransferError('TRANSFER_SOURCE_UNREADABLE', { cause: error });
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new TransferError('TRANSFER_ASSET_INVALID');
  }

  const hash = createHash('sha256');
  let size = 0;

  try {
    for await (const chunk of createReadStream(filePath)) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;
      hash.update(buffer);
    }
  } catch (error) {
    throw new TransferError('TRANSFER_SOURCE_UNREADABLE', { cause: error });
  }

  if (size !== stats.size) {
    throw new TransferError('TRANSFER_ASSET_INVALID');
  }

  return { size, sha256: hash.digest('hex') };
}

/** Comprueba que existe un archivo o directorio sin seguirlo. */
export async function pathExists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    return !isMissingError(error);
  }
}

/** Sonda de espacio libre; las pruebas la sustituyen por un valor fijo. */
export type FreeSpaceProbe = (
  directory: string,
  requiredBytes: number,
) => Promise<number>;

/** Margen fijo adicional para el ZIP y los metadatos de SQLite. */
export const TRANSFER_SPACE_MARGIN_BYTES = 64 * 1024 * 1024;

/** Comprueba espacio libre en la unidad del directorio. */
export async function assertFreeSpace(
  directory: string,
  requiredBytes: number,
  probe?: FreeSpaceProbe,
): Promise<void> {
  if (!Number.isFinite(requiredBytes) || requiredBytes < 0) {
    throw new TransferError('TRANSFER_INTERNAL');
  }

  let free: number;

  try {
    if (probe !== undefined) {
      free = await probe(directory, requiredBytes);
    } else {
      const stats = await statfs(directory);
      free = stats.bavail * stats.bsize;
    }
  } catch (error) {
    throw new TransferError('TRANSFER_DESTINATION_UNAVAILABLE', {
      cause: error,
    });
  }

  if (!Number.isFinite(free) || free < 0) {
    throw new TransferError('TRANSFER_INTERNAL');
  }

  if (free < requiredBytes + TRANSFER_SPACE_MARGIN_BYTES) {
    throw new TransferError('TRANSFER_NO_SPACE');
  }
}

function isMissingError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}
