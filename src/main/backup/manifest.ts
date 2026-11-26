/**
 * Manifiesto de una copia de seguridad.
 *
 * El formato v2 cubre todas las copias (automáticas, pre-migración,
 * pre-restauración y pre-purga) e incluye el motivo, el estado de integridad
 * conocido y la marca de que los assets no van dentro. El lector acepta también
 * el v1 creado por M0-04 para no invalidar copias pre-migración ya existentes.
 * Añadir `pre-purge` o `pre-delete` al enum mantiene el formato v2: los
 * manifiestos anteriores no contienen esos valores y el lector actual sigue
 * aceptándolos.
 *
 * Los errores nunca incluyen rutas ni el contenido del manifiesto.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

import { DATABASE_FILE_NAME } from '../db/paths';

/** Nombre fijo del manifiesto dentro de cada carpeta de copia. */
export const BACKUP_MANIFEST_FILE_NAME = 'manifest.json';

/** Versión actual del formato del manifiesto. */
export const BACKUP_MANIFEST_FORMAT_VERSION = 2;

/** Versión heredada que se sigue leyendo sin reescribir. */
export const LEGACY_BACKUP_MANIFEST_FORMAT_VERSION = 1;

/** Motivos admitidos de una copia. */
export const BACKUP_REASONS = [
  'daily',
  'weekly',
  'monthly',
  'pre-migration',
  'pre-restore',
  'pre-purge',
  'pre-delete',
] as const;

export type BackupReason = (typeof BACKUP_REASONS)[number];

/** Copias que programa el arranque automático. */
export const SCHEDULED_BACKUP_REASONS = ['daily', 'weekly', 'monthly'] as const;

export type ScheduledBackupReason = (typeof SCHEDULED_BACKUP_REASONS)[number];

/** Resultado conocido de `PRAGMA integrity_check` sobre el archivo copiado. */
export const BACKUP_INTEGRITY_STATES = ['ok', 'failed', 'unknown'] as const;

export type BackupIntegrity = (typeof BACKUP_INTEGRITY_STATES)[number];

/**
 * Manifiesto normalizado que consumen el resto de módulos.
 *
 * `formatVersion` conserva el valor leído: una copia v1 se presenta con
 * `integrity: 'ok'` porque el formato anterior solo guardaba copias verificadas.
 */
export interface BackupManifest {
  readonly formatVersion:
    | typeof BACKUP_MANIFEST_FORMAT_VERSION
    | typeof LEGACY_BACKUP_MANIFEST_FORMAT_VERSION;
  readonly reason: BackupReason;
  readonly createdAt: string;
  readonly databaseFile: string;
  readonly schemaVersion: number | null;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly integrity: BackupIntegrity;
  readonly assetsIncluded: false;
}

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const commonFields = {
  createdAt: z.string().datetime(),
  databaseFile: z.literal(DATABASE_FILE_NAME),
  sizeBytes: z.number().int().nonnegative(),
  sha256: sha256Schema,
};

export const backupManifestV1Schema = z
  .object({
    formatVersion: z.literal(LEGACY_BACKUP_MANIFEST_FORMAT_VERSION),
    reason: z.literal('pre-migration'),
    ...commonFields,
    schemaVersion: z.number().int().nonnegative(),
  })
  .strict();

export const backupManifestV2Schema = z
  .object({
    formatVersion: z.literal(BACKUP_MANIFEST_FORMAT_VERSION),
    reason: z.enum(BACKUP_REASONS),
    ...commonFields,
    schemaVersion: z.number().int().nonnegative().nullable(),
    integrity: z.enum(BACKUP_INTEGRITY_STATES),
    assetsIncluded: z.literal(false),
  })
  .strict();

export const backupManifestSchema = z.discriminatedUnion('formatVersion', [
  backupManifestV1Schema,
  backupManifestV2Schema,
]);

/** Normaliza un manifiesto v1 o v2; devuelve `null` si no es válido. */
export function normalizeBackupManifest(raw: unknown): BackupManifest | null {
  const parsed = backupManifestSchema.safeParse(raw);

  if (!parsed.success) {
    return null;
  }

  if (parsed.data.formatVersion === LEGACY_BACKUP_MANIFEST_FORMAT_VERSION) {
    return {
      ...parsed.data,
      integrity: 'ok',
      assetsIncluded: false,
    };
  }

  return parsed.data;
}

/**
 * Manifiesto que puede ofrecerse para restaurar: integridad correcta y versión
 * de esquema conocida.
 */
export type RestorableBackupManifest = BackupManifest & {
  readonly schemaVersion: number;
  readonly integrity: 'ok';
};

/**
 * Indica si el manifiesto permite ofrecer la copia para restaurar.
 *
 * `pre-delete` queda fuera: la restauración guiada solo sustituye la base y
 * esa copia también contiene assets, que no se restauran en ese flujo.
 */
export function isRestorableManifest(
  manifest: BackupManifest,
): manifest is RestorableBackupManifest {
  return (
    manifest.reason !== 'pre-delete' &&
    manifest.integrity === 'ok' &&
    manifest.schemaVersion !== null
  );
}

/** Lee y valida `manifest.json`; devuelve `null` si falta o no encaja. */
export async function tryReadBackupManifest(
  directory: string,
): Promise<BackupManifest | null> {
  try {
    const contents = await readFile(
      join(directory, BACKUP_MANIFEST_FILE_NAME),
      'utf8',
    );

    return normalizeBackupManifest(JSON.parse(contents) as unknown);
  } catch {
    return null;
  }
}

/** Escribe el manifiesto sin sobrescribir; devuelve su ruta absoluta. */
export async function writeBackupManifest(
  directory: string,
  manifest: BackupManifest,
): Promise<string> {
  const file = join(directory, BACKUP_MANIFEST_FILE_NAME);
  const payload: BackupManifest = {
    formatVersion: BACKUP_MANIFEST_FORMAT_VERSION,
    reason: manifest.reason,
    createdAt: manifest.createdAt,
    databaseFile: manifest.databaseFile,
    schemaVersion: manifest.schemaVersion,
    sizeBytes: manifest.sizeBytes,
    sha256: manifest.sha256,
    integrity: manifest.integrity,
    assetsIncluded: false,
  };

  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });

  return file;
}
