/**
 * Programación de copias automáticas al arrancar.
 *
 * Se ejecuta una vez por arranque, después de `ready` y antes de crear la
 * ventana. Calcula el día, la semana ISO y el mes locales; si un motivo no
 * tiene todavía una copia válida de su bucket, la crea aunque hayan pasado
 * semanas. Un fallo se registra y nunca bloquea el arranque. No se copia al
 * cerrar.
 *
 * Para no encarecer el arranque, primero lee solo los manifiestos y verifica en
 * profundidad la candidata del bucket actual. La rotación solo se ejecuta si se
 * creó alguna copia nueva.
 */
import { readUserVersion, type SqliteDatabase } from '../db/connection';
import type { StartupLogEntry } from '../db/logger';
import { createBackup } from './create';
import { listBackupManifests } from './inventory';
import {
  rotateBackups,
  type BackupRetention,
  type RotationDirectories,
  type RotationResult,
} from './rotation';
import {
  SCHEDULED_BACKUP_REASONS,
  type ScheduledBackupReason,
} from './manifest';
import { inspectBackup } from './verify';

/** Buckets calculados con la fecha local del equipo. */
export interface BackupBuckets {
  readonly daily: string;
  readonly weekly: string;
  readonly monthly: string;
}

/** Carpetas que usa la programación y la rotación. */
export type ScheduledBackupDirectories = RotationDirectories;

/** Puerto mínimo de log; en producción es el logger JSONL de arranque. */
export interface ScheduledBackupLogger {
  log(entry: StartupLogEntry): void;
}

export interface RunScheduledBackupsOptions {
  readonly database: SqliteDatabase;
  readonly directories: ScheduledBackupDirectories;
  /** Instante del arranque; inyectable en pruebas. */
  readonly timestamp: number;
  /** Versión máxima del journal instalado; descarta copias futuras. */
  readonly targetSchemaVersion: number;
  /**
   * Fuerza una pasada de rotación aunque no se cree ninguna copia programada.
   * El arranque lo usa cuando acaba de crear una copia pre-migración.
   */
  readonly forceRotation?: boolean;
  readonly logger?: ScheduledBackupLogger;
  readonly retention?: BackupRetention;
}

export interface ScheduledBackupResult {
  readonly created: readonly ScheduledBackupReason[];
  readonly failed: readonly ScheduledBackupReason[];
  readonly rotation: RotationResult;
}

/** Calcula los buckets diario, semanal ISO y mensual en fecha local. */
export function computeBackupBuckets(timestamp: number): BackupBuckets {
  const date = new Date(timestamp);

  return {
    daily: formatDailyBucket(date),
    weekly: formatIsoWeekBucket(date),
    monthly: formatMonthlyBucket(date),
  };
}

/** Bucket diario `YYYY-MM-DD` en fecha local. */
export function formatDailyBucket(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Bucket semanal ISO `YYYY-Www` a partir de la fecha local. */
export function formatIsoWeekBucket(date: Date): string {
  // Se trabaja con el calendario local pero se avanza en UTC para no repetir
  // un día por el cambio de hora.
  const ThursdayOffset = 4;
  const millisecondsPerDay = 86_400_000;
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayOfWeek = target.getUTCDay() || 7;

  target.setUTCDate(target.getUTCDate() + ThursdayOffset - dayOfWeek);

  const isoYear = target.getUTCFullYear();
  const firstDayOfYear = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(
    ((target.getTime() - firstDayOfYear) / millisecondsPerDay + 1) / 7,
  );

  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Bucket mensual `YYYY-MM` en fecha local. */
export function formatMonthlyBucket(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}`;
}

/**
 * Crea las copias que falten y poda las sobrantes.
 *
 * No lanza: traduce cualquier fallo a `failed` y deja el resultado para el log.
 */
export async function runScheduledBackups(
  options: RunScheduledBackupsOptions,
): Promise<ScheduledBackupResult> {
  const created: ScheduledBackupReason[] = [];
  const failed: ScheduledBackupReason[] = [];
  let schemaVersion: number;

  try {
    schemaVersion = readUserVersion(options.database);
  } catch {
    log(options.logger, {
      event: 'backup.schedule',
      outcome: 'failed',
      reason: 'io',
      created: 0,
      failed: SCHEDULED_REASONS.length,
      pruned: 0,
    });

    return {
      created,
      failed: [...SCHEDULED_REASONS],
      rotation: emptyRotation(),
    };
  }

  const buckets = computeBackupBuckets(options.timestamp);

  for (const reason of SCHEDULED_REASONS) {
    const parentDir = options.directories[reason];

    try {
      if (
        await hasValidBucketCopy(
          parentDir,
          reason,
          buckets[reason],
          options.targetSchemaVersion,
        )
      ) {
        continue;
      }

      await createBackup({
        database: options.database,
        parentDir,
        reason,
        timestamp: options.timestamp,
        schemaVersion,
      });
      created.push(reason);
    } catch {
      failed.push(reason);
    }
  }

  // La rotación solo se ejecuta si hay copias nuevas que puedan hacer sobrar
  // otras (o si el arranque creó una pre-migración). Así el arranque normal no
  // vuelve a verificar todas las copias.
  let rotation: RotationResult = emptyRotation();

  if (created.length > 0 || options.forceRotation === true) {
    try {
      rotation = await rotateBackups({
        directories: options.directories,
        targetSchemaVersion: options.targetSchemaVersion,
        ...(options.retention === undefined
          ? {}
          : { retention: options.retention }),
      });
    } catch {
      rotation = emptyRotation();
    }
  }

  log(
    options.logger,
    failed.length > 0
      ? {
          event: 'backup.schedule',
          outcome: 'failed',
          reason: 'io',
          created: created.length,
          failed: failed.length,
          pruned: rotation.removed,
        }
      : created.length > 0
        ? {
            event: 'backup.schedule',
            outcome: 'created',
            daily: created.includes('daily'),
            weekly: created.includes('weekly'),
            monthly: created.includes('monthly'),
            pruned: rotation.removed,
          }
        : { event: 'backup.schedule', outcome: 'skipped' },
  );

  return { created, failed, rotation };
}

const SCHEDULED_REASONS: readonly ScheduledBackupReason[] =
  SCHEDULED_BACKUP_REASONS;

/**
 * Comprueba si el bucket actual ya tiene una copia válida.
 *
 * Primero lee solo los manifiestos (barato) y descarta motivo, bucket, estado
 * de integridad y versiones futuras. Después verifica en profundidad únicamente
 * las candidatas del bucket actual, que en el caso normal es una sola copia.
 */
async function hasValidBucketCopy(
  directory: string,
  reason: ScheduledBackupReason,
  bucket: string,
  targetSchemaVersion: number,
): Promise<boolean> {
  const entries = await listBackupManifests(directory);
  const candidates: Array<{
    readonly directory: string;
    readonly createdAt: string;
  }> = [];

  for (const entry of entries) {
    const manifest = entry.manifest;

    if (
      manifest === null ||
      manifest.reason !== reason ||
      manifest.integrity !== 'ok' ||
      manifest.schemaVersion === null ||
      manifest.schemaVersion > targetSchemaVersion
    ) {
      continue;
    }

    const createdAt = Date.parse(manifest.createdAt);

    if (
      Number.isNaN(createdAt) ||
      computeBackupBuckets(createdAt)[reason] !== bucket
    ) {
      continue;
    }

    candidates.push({
      directory: entry.directory,
      createdAt: manifest.createdAt,
    });
  }

  candidates.sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));

  for (const candidate of candidates) {
    if (
      (
        await inspectBackup(candidate.directory, {
          targetSchemaVersion,
        })
      ).ok
    ) {
      return true;
    }
  }

  return false;
}

function emptyRotation(): RotationResult {
  return { removed: 0, kept: 0, corrupt: 0, skipped: 0, failed: 0 };
}

function log(
  logger: ScheduledBackupLogger | undefined,
  entry: StartupLogEntry,
): void {
  logger?.log(entry);
}
