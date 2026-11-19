/**
 * Verificación de copias de seguridad.
 *
 * Una copia solo se considera utilizable si el manifiesto es válido, el tamaño
 * y el SHA-256 coinciden, `PRAGMA integrity_check` devuelve `ok` y la versión
 * de esquema coincide con la del manifiesto. La verificación es de solo
 * lectura: nunca modifica la copia.
 *
 * Los motivos son estables y enumerados para poder registrarlos sin incluir
 * rutas, nombres, tamaños, hashes ni contenido.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import {
  closeDatabase,
  openDatabase,
  readUserVersion,
  type SqliteDatabase,
} from '../db/connection';
import { DatabaseError } from '../db/errors';
import { checkIntegrity } from '../db/integrity';
import { type BackupManifest, tryReadBackupManifest } from './manifest';

/** Motivo estable de un fallo de verificación o de restauración. */
export type BackupFailureReason =
  'manifest' | 'checksum' | 'integrity' | 'version-ahead' | 'io' | 'lock';

/** Resultado estructurado de verificar una copia. */
export type BackupVerification =
  | { readonly ok: true; readonly manifest: BackupManifest }
  | { readonly ok: false; readonly reason: BackupFailureReason };

export interface VerifyBackupOptions {
  /** Versión exacta que debe declarar el manifiesto y la base copiada. */
  readonly expectedSchemaVersion?: number;
  /** Versión máxima admitida por el journal instalado. */
  readonly targetSchemaVersion?: number;
}

/**
 * Verifica una carpeta de copia completa y clasifica el fallo.
 *
 * No lanza por datos inválidos; los errores inesperados de disco se traducen a
 * `io`. `targetSchemaVersion` rechaza una copia creada por una versión más
 * reciente de la aplicación antes de leer su contenido.
 */
export async function inspectBackup(
  directory: string,
  options?: VerifyBackupOptions,
): Promise<BackupVerification> {
  const manifest = await tryReadBackupManifest(directory);

  if (manifest === null) {
    return { ok: false, reason: 'manifest' };
  }

  if (
    options?.targetSchemaVersion !== undefined &&
    manifest.schemaVersion !== null &&
    manifest.schemaVersion > options.targetSchemaVersion
  ) {
    return { ok: false, reason: 'version-ahead' };
  }

  const databaseFile = join(directory, manifest.databaseFile);

  let fileStats;

  try {
    fileStats = await stat(databaseFile);
  } catch {
    return { ok: false, reason: 'io' };
  }

  if (!fileStats.isFile()) {
    return { ok: false, reason: 'io' };
  }

  if (fileStats.size !== manifest.sizeBytes) {
    return { ok: false, reason: 'checksum' };
  }

  let sha256: string;

  try {
    sha256 = await computeFileSha256(databaseFile);
  } catch {
    return { ok: false, reason: 'io' };
  }

  if (sha256 !== manifest.sha256) {
    return { ok: false, reason: 'checksum' };
  }

  if (manifest.integrity !== 'ok') {
    return { ok: false, reason: 'integrity' };
  }

  const fileResult = inspectBackupFile(
    databaseFile,
    manifest.schemaVersion,
    options?.expectedSchemaVersion,
  );

  if (fileResult !== 'ok') {
    return { ok: false, reason: fileResult };
  }

  return { ok: true, manifest };
}

/**
 * Verifica una copia y lanza `DB_BACKUP_FAILED` si no es utilizable.
 *
 * Es la API que usa el arranque antes de migrar: si falla, no se migra.
 */
export async function verifyBackup(
  directory: string,
  options?: VerifyBackupOptions,
): Promise<BackupManifest> {
  const result = await inspectBackup(directory, options);

  if (!result.ok) {
    throw new DatabaseError('DB_BACKUP_FAILED', { cause: result.reason });
  }

  return result.manifest;
}

/**
 * Comprueba una base copiada en solo lectura: integridad y `user_version`.
 *
 * Devuelve el motivo estable o `'ok'`. Un archivo corrupto o ilegible se trata
 * como fallo de integridad, nunca como éxito.
 */
export function inspectBackupFile(
  file: string,
  schemaVersion: number | null,
  expectedSchemaVersion?: number,
): BackupFailureReason | 'ok' {
  let database: SqliteDatabase | null = null;

  try {
    database = openDatabase({ file, readonly: true });

    if (!checkIntegrity(database).ok) {
      return 'integrity';
    }

    const version = readUserVersion(database);

    if (schemaVersion !== null && version !== schemaVersion) {
      return 'manifest';
    }

    if (
      expectedSchemaVersion !== undefined &&
      version !== expectedSchemaVersion
    ) {
      return 'manifest';
    }

    return 'ok';
  } catch {
    return 'integrity';
  } finally {
    if (database !== null) {
      closeDatabase(database);
    }
  }
}

/** Calcula el SHA-256 de un archivo sin cargarlo entero en memoria. */
export async function computeFileSha256(file: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
