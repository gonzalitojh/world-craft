/**
 * Creación de copias de seguridad.
 *
 * La copia normal usa la API online de better-sqlite3 (`db.backup`) para
 * obtener un archivo coherente incluso con WAL; después verifica integridad y
 * versión en solo lectura, calcula el SHA-256 y escribe el manifiesto v2.
 *
 * La copia de preservación (pre-restauración) es en bruto: la base puede estar
 * corrupta o ausente, así que se copian los bytes de la base y sus
 * `-wal`/`-shm`/`-journal` sin abrirla. Su manifiesto admite `schemaVersion:
 * null` e integridad distinta de `ok`.
 *
 * Cualquier fallo deja la carpeta parcial eliminada y se traduce a
 * `DB_BACKUP_FAILED`; nunca se deja una copia a medias que parezca válida.
 */
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

import {
  closeDatabase,
  openDatabase,
  type SqliteDatabase,
} from '../db/connection';
import { DatabaseError } from '../db/errors';
import { DATABASE_FILE_NAME } from '../db/paths';
import { fileExists } from './fs';
import {
  BACKUP_MANIFEST_FORMAT_VERSION,
  type BackupIntegrity,
  type BackupManifest,
  type BackupReason,
  writeBackupManifest,
} from './manifest';
import { computeFileSha256, inspectBackupFile } from './verify';

/** Resultado de crear una copia verificable. */
export interface BackupResult {
  readonly directory: string;
  readonly databaseFile: string;
  readonly manifestFile: string;
  readonly manifest: BackupManifest;
}

export interface CreateBackupOptions {
  readonly database: SqliteDatabase;
  /** Carpeta del motivo (`backups/daily`, `backups/pre-migration`…). */
  readonly parentDir: string;
  readonly reason: Exclude<BackupReason, 'pre-restore'>;
  readonly timestamp: number;
  readonly schemaVersion: number;
}

/** Crea una copia coherente con manifiesto v2 y la verifica antes de devolverla. */
export async function createBackup(
  options: CreateBackupOptions,
): Promise<BackupResult> {
  let directory: string | null = null;

  try {
    directory = await allocateBackupDirectory(
      options.parentDir,
      options.timestamp,
    );

    const partialFile = join(directory, `${DATABASE_FILE_NAME}.partial`);
    const databaseFile = join(directory, DATABASE_FILE_NAME);

    await options.database.backup(partialFile);

    const fileResult = inspectBackupFile(partialFile, options.schemaVersion);

    if (fileResult !== 'ok') {
      throw new DatabaseError('DB_BACKUP_FAILED', { cause: fileResult });
    }

    await rename(partialFile, databaseFile);

    const fileStats = await stat(databaseFile);
    const manifest: BackupManifest = {
      formatVersion: BACKUP_MANIFEST_FORMAT_VERSION,
      reason: options.reason,
      createdAt: new Date(options.timestamp).toISOString(),
      databaseFile: DATABASE_FILE_NAME,
      schemaVersion: options.schemaVersion,
      sizeBytes: fileStats.size,
      sha256: await computeFileSha256(databaseFile),
      integrity: 'ok',
      assetsIncluded: false,
    };

    const manifestFile = await writeBackupManifest(directory, manifest);

    return { directory, databaseFile, manifestFile, manifest };
  } catch (error) {
    if (directory !== null) {
      await rm(directory, { recursive: true, force: true }).catch(() => {
        // La limpieza es best-effort: el llamador no debe usar la copia.
      });
    }

    throw new DatabaseError('DB_BACKUP_FAILED', { cause: error });
  }
}

/**
 * Crea `backups/pre-migration/<timestamp>/` con la base y su manifiesto.
 *
 * Se mantiene como envoltorio de `createBackup` para el arranque y las pruebas
 * heredadas de M0-04.
 */
export async function createPreMigrationBackup(options: {
  readonly database: SqliteDatabase;
  readonly backupRootDir: string;
  readonly timestamp: number;
  readonly schemaVersion: number;
}): Promise<BackupResult> {
  return createBackup({
    database: options.database,
    parentDir: options.backupRootDir,
    reason: 'pre-migration',
    timestamp: options.timestamp,
    schemaVersion: options.schemaVersion,
  });
}

export interface CreatePreservationCopyOptions {
  /** Base actual, que puede estar corrupta. */
  readonly databaseFile: string;
  /** Carpeta `backups/pre-restore`. */
  readonly parentDir: string;
  readonly timestamp: number;
  /** `null` cuando la base está corrupta y no se puede leer su versión. */
  readonly schemaVersion: number | null;
  readonly integrity: BackupIntegrity;
}

/**
 * Copia en bruto la base actual y sus `-wal`/`-shm`/`-journal` antes de
 * reemplazarla.
 *
 * No abre SQLite: la base puede estar corrupta. Devuelve `null` si no hay base
 * actual que preservar. El manifiesto no autentica los auxiliares, pero estos
 * quedan junto a la base para una recuperación manual.
 */
export async function createPreservationCopy(
  options: CreatePreservationCopyOptions,
): Promise<BackupResult | null> {
  let directory: string | null = null;

  try {
    if (!(await fileExists(options.databaseFile))) {
      return null;
    }

    directory = await allocateBackupDirectory(
      options.parentDir,
      options.timestamp,
    );

    const databaseFile = join(directory, DATABASE_FILE_NAME);
    const fileStats = await copyRawSource(options.databaseFile, databaseFile);

    for (const suffix of ['-wal', '-shm', '-journal'] as const) {
      const auxiliary = `${options.databaseFile}${suffix}`;

      if (await fileExists(auxiliary)) {
        await copyFile(auxiliary, `${databaseFile}${suffix}`);
      }
    }

    const manifest: BackupManifest = {
      formatVersion: BACKUP_MANIFEST_FORMAT_VERSION,
      reason: 'pre-restore',
      createdAt: new Date(options.timestamp).toISOString(),
      databaseFile: DATABASE_FILE_NAME,
      schemaVersion: options.schemaVersion,
      sizeBytes: fileStats.size,
      sha256: await computeFileSha256(databaseFile),
      integrity: options.integrity,
      assetsIncluded: false,
    };

    const manifestFile = await writeBackupManifest(directory, manifest);

    return { directory, databaseFile, manifestFile, manifest };
  } catch (error) {
    if (directory !== null) {
      await rm(directory, { recursive: true, force: true }).catch(() => {
        // La limpieza es best-effort: el llamador pasa a modo seguro.
      });
    }

    throw new DatabaseError('DB_BACKUP_FAILED', { cause: error });
  }
}

/** Nombre de carpeta estable a partir del instante de la copia. */
export function formatBackupDirectoryName(timestamp: number): string {
  return new Date(timestamp)
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.', '');
}

/**
 * Comprueba el estado de integridad de una base sin lanzar.
 *
 * La restauración lo usa para describir la copia de preservación: si la base
 * está corrupta el manifiesto lo refleja en lugar de fingir que es válida.
 */
export function readDatabaseIntegrity(file: string): BackupIntegrity {
  try {
    return inspectBackupFile(file, null) === 'ok' ? 'ok' : 'failed';
  } catch {
    return 'unknown';
  }
}

/**
 * Lee `user_version` de una base que puede estar corrupta.
 *
 * Devuelve `null` si no se puede abrir o leer; nunca propaga el error de
 * SQLite porque la restauración debe continuar sin conexión de escritura.
 */
export function readDatabaseSchemaVersion(file: string): number | null {
  let database: SqliteDatabase | null = null;

  try {
    database = openDatabase({ file, readonly: true });

    const version = database.pragma('user_version', { simple: true });

    return typeof version === 'number' &&
      Number.isInteger(version) &&
      version >= 0
      ? version
      : null;
  } catch {
    return null;
  } finally {
    if (database !== null) {
      closeDatabase(database);
    }
  }
}

async function copyRawSource(
  source: string,
  target: string,
): Promise<{ readonly size: number }> {
  await copyFile(source, target);

  return stat(target);
}

async function allocateBackupDirectory(
  parentDir: string,
  timestamp: number,
): Promise<string> {
  await mkdir(parentDir, { recursive: true });

  const baseName = formatBackupDirectoryName(timestamp);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    const candidate = join(parentDir, `${baseName}${suffix}`);

    try {
      await mkdir(candidate);

      return candidate;
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
    }
  }

  throw new DatabaseError('DB_BACKUP_FAILED');
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}
