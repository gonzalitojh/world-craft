/**
 * Copia previa a las migraciones.
 *
 * Usa la API online de better-sqlite3 (`db.backup`) para obtener una copia
 * consistente incluso con WAL. Después verifica la copia con una conexión de
 * solo lectura, calcula su SHA-256 y escribe un manifiesto. Si algo falla, no
 * se migra: la carpeta parcial se elimina y el arranque pasa a modo seguro.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

import { DATABASE_FILE_NAME } from './paths';
import {
  closeDatabase,
  openDatabase,
  readUserVersion,
  type SqliteDatabase,
} from './connection';
import { DatabaseError } from './errors';
import { checkIntegrity } from './integrity';

/** Versión del formato del manifiesto de copia. */
export const BACKUP_MANIFEST_FORMAT_VERSION = 1;

export const backupManifestSchema = z
  .object({
    formatVersion: z.literal(BACKUP_MANIFEST_FORMAT_VERSION),
    reason: z.literal('pre-migration'),
    createdAt: z.string().datetime(),
    databaseFile: z.literal(DATABASE_FILE_NAME),
    schemaVersion: z.number().int().nonnegative(),
    sizeBytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type BackupManifest = z.infer<typeof backupManifestSchema>;

/** Resultado de crear una copia verificable. */
export interface BackupResult {
  readonly directory: string;
  readonly databaseFile: string;
  readonly manifestFile: string;
  readonly manifest: BackupManifest;
}

export interface CreateBackupOptions {
  readonly database: SqliteDatabase;
  readonly backupRootDir: string;
  readonly timestamp: number;
  readonly schemaVersion: number;
}

/**
 * Crea `backups/pre-migration/<timestamp>/` con la base y su manifiesto.
 *
 * Cualquier fallo se traduce a `DB_BACKUP_FAILED`; el llamador no migra y la
 * app entra en modo seguro.
 */
export async function createPreMigrationBackup(
  options: CreateBackupOptions,
): Promise<BackupResult> {
  let directory: string | null = null;

  try {
    directory = await allocateBackupDirectory(
      options.backupRootDir,
      options.timestamp,
    );

    const partialFile = join(directory, `${DATABASE_FILE_NAME}.partial`);
    const databaseFile = join(directory, DATABASE_FILE_NAME);

    await options.database.backup(partialFile);
    verifyBackupFile(partialFile, options.schemaVersion);
    await rename(partialFile, databaseFile);

    const fileStats = await stat(databaseFile);
    const sha256 = await computeFileSha256(databaseFile);
    const manifest: BackupManifest = {
      formatVersion: BACKUP_MANIFEST_FORMAT_VERSION,
      reason: 'pre-migration',
      createdAt: new Date(options.timestamp).toISOString(),
      databaseFile: DATABASE_FILE_NAME,
      schemaVersion: options.schemaVersion,
      sizeBytes: fileStats.size,
      sha256,
    };

    const manifestFile = join(directory, 'manifest.json');
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });

    return { directory, databaseFile, manifestFile, manifest };
  } catch (error) {
    if (directory !== null) {
      await rm(directory, { recursive: true, force: true }).catch(() => {
        // La limpieza es best-effort: el modo seguro ya impide migrar.
      });
    }

    throw new DatabaseError('DB_BACKUP_FAILED', { cause: error });
  }
}

/**
 * Verifica una copia completa: manifiesto válido, tamaño y SHA-256, integridad
 * SQLite y versión de esquema esperada.
 */
export async function verifyBackup(
  backupDirectory: string,
): Promise<BackupManifest> {
  let manifest: BackupManifest;

  try {
    manifest = backupManifestSchema.parse(
      JSON.parse(
        await readFile(join(backupDirectory, 'manifest.json'), 'utf8'),
      ) as unknown,
    );
  } catch (error) {
    throw new DatabaseError('DB_BACKUP_FAILED', { cause: error });
  }

  const databaseFile = join(backupDirectory, manifest.databaseFile);

  try {
    const fileStats = await stat(databaseFile);

    if (fileStats.size !== manifest.sizeBytes) {
      throw new DatabaseError('DB_BACKUP_FAILED');
    }

    if ((await computeFileSha256(databaseFile)) !== manifest.sha256) {
      throw new DatabaseError('DB_BACKUP_FAILED');
    }

    verifyBackupFile(databaseFile, manifest.schemaVersion);

    return manifest;
  } catch (error) {
    throw new DatabaseError('DB_BACKUP_FAILED', { cause: error });
  }
}

function verifyBackupFile(file: string, expectedVersion: number): void {
  let database: SqliteDatabase | null = null;

  try {
    database = openDatabase({ file, readonly: true });

    if (!checkIntegrity(database).ok) {
      throw new DatabaseError('DB_BACKUP_FAILED');
    }

    if (readUserVersion(database) !== expectedVersion) {
      throw new DatabaseError('DB_BACKUP_FAILED');
    }
  } catch (error) {
    throw new DatabaseError('DB_BACKUP_FAILED', { cause: error });
  } finally {
    if (database !== null) {
      closeDatabase(database);
    }
  }
}

async function allocateBackupDirectory(
  backupRootDir: string,
  timestamp: number,
): Promise<string> {
  await mkdir(backupRootDir, { recursive: true });

  const baseName = formatBackupDirectoryName(timestamp);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    const candidate = join(backupRootDir, `${baseName}${suffix}`);

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

function formatBackupDirectoryName(timestamp: number): string {
  return new Date(timestamp)
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('.', '');
}

async function computeFileSha256(file: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}
