/**
 * Inventario de copias de una carpeta.
 *
 * Cada subcarpeta directa se verifica completa. Las copias corruptas se
 * devuelven marcadas para poder documentarlas, pero no se ofrecen ni cuentan
 * para la retención. El orden es de más reciente a más antigua.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { tryReadBackupManifest, type BackupManifest } from './manifest';
import { inspectBackup, type BackupVerification } from './verify';

/** Entrada del inventario, verificada o no. */
export interface BackupEntry {
  readonly directory: string;
  readonly manifest: BackupManifest | null;
  readonly verification: BackupVerification;
}

/** Copia verificada correctamente. */
export type ValidBackupEntry = BackupEntry & {
  readonly manifest: BackupManifest;
  readonly verification: {
    readonly ok: true;
    readonly manifest: BackupManifest;
  };
};

/** Manifiesto leído sin abrir la base copiada. */
export interface BackupManifestEntry {
  readonly directory: string;
  readonly manifest: BackupManifest | null;
}

/**
 * Lista solo los manifiestos de una carpeta de motivo.
 *
 * Es barato: `readdir` y un JSON por copia, sin calcular SHA-256 ni ejecutar
 * `integrity_check`. Lo usa el programador para descartar rápido copias de otro
 * motivo, de otro bucket, futuras o sin integridad antes de verificar en
 * profundidad la candidata del bucket actual.
 */
export async function listBackupManifests(
  directory: string,
): Promise<BackupManifestEntry[]> {
  const directories = await listBackupDirectories(directory);

  const entries: BackupManifestEntry[] = [];

  for (const backupDirectory of directories) {
    entries.push({
      directory: backupDirectory,
      manifest: await tryReadBackupManifest(backupDirectory),
    });
  }

  return entries.sort(compareManifestEntriesNewestFirst);
}

/**
 * Lista y verifica las copias de una carpeta de motivo.
 *
 * Si la carpeta no existe devuelve una lista vacía; otros errores de disco se
 * propagan para que el llamador decida (la programación los registra y sigue).
 */
export async function listBackups(
  directory: string,
  options?: { readonly targetSchemaVersion?: number },
): Promise<BackupEntry[]> {
  const directories = await listBackupDirectories(directory);
  const backups: BackupEntry[] = [];

  for (const backupDirectory of directories) {
    const verification = await inspectBackup(backupDirectory, options);

    backups.push({
      directory: backupDirectory,
      manifest: verification.ok ? verification.manifest : null,
      verification,
    });
  }

  return backups.sort(compareNewestFirst);
}

/** Filtra las copias que superan la verificación. */
export function selectValidBackups(
  entries: readonly BackupEntry[],
): ValidBackupEntry[] {
  return entries.filter(isValidBackup);
}

function isValidBackup(entry: BackupEntry): entry is ValidBackupEntry {
  return entry.verification.ok;
}

function compareNewestFirst(left: BackupEntry, right: BackupEntry): number {
  return compareCreatedAt(
    left.manifest?.createdAt ?? '',
    right.manifest?.createdAt ?? '',
    left.directory,
    right.directory,
  );
}

function compareManifestEntriesNewestFirst(
  left: BackupManifestEntry,
  right: BackupManifestEntry,
): number {
  return compareCreatedAt(
    left.manifest?.createdAt ?? '',
    right.manifest?.createdAt ?? '',
    left.directory,
    right.directory,
  );
}

function compareCreatedAt(
  leftCreatedAt: string,
  rightCreatedAt: string,
  leftDirectory: string,
  rightDirectory: string,
): number {
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt < rightCreatedAt ? 1 : -1;
  }

  return leftDirectory < rightDirectory
    ? 1
    : leftDirectory > rightDirectory
      ? -1
      : 0;
}

async function listBackupDirectories(directory: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return [];
    }

    throw error;
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(directory, entry.name));
}

function isMissingDirectoryError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}
