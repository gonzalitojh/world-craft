/**
 * Rotación de copias automáticas y pre-migración.
 *
 * Reglas aprobadas en M0-07: 7 diarias, 4 semanales, 12 mensuales y 5
 * pre-migración. La issue #77 añade 10 copias `pre-purge` válidas (D3). Las
 * copias pre-restauración no se podan nunca.
 *
 * Guardas de seguridad:
 * - las copias corruptas no cuentan ni se borran;
 * - nunca se borra la copia válida más reciente global;
 * - nunca se borra la última copia válida de un motivo;
 * - cada candidata se vuelve a verificar justo antes de borrarla y, si falla,
 *   se conserva y se cuenta como omitida.
 */
import { rm } from 'node:fs/promises';

import {
  listBackups,
  selectValidBackups,
  type ValidBackupEntry,
} from './inventory';
import { inspectBackup } from './verify';

/** Retención por motivo; `pre-restore` queda fuera a propósito. */
export interface BackupRetention {
  readonly daily: number;
  readonly weekly: number;
  readonly monthly: number;
  readonly preMigration: number;
  /** Copias válidas de `pre-purge` conservadas (D3); por defecto 10. */
  readonly prePurge?: number;
}

export const DEFAULT_BACKUP_RETENTION: BackupRetention = {
  daily: 7,
  weekly: 4,
  monthly: 12,
  preMigration: 5,
  prePurge: 10,
};

/** Carpetas de los motivos que se podan. */
export interface RotationDirectories {
  readonly daily: string;
  readonly weekly: string;
  readonly monthly: string;
  readonly preMigration: string;
  /** Si se indica, se podan también las copias previas a una purga. */
  readonly prePurge?: string;
}

export interface RotationResult {
  readonly removed: number;
  readonly kept: number;
  /** Copias corruptas o inválidas; no cuentan ni se borran. */
  readonly corrupt: number;
  /** Candidatas que dejaron de verificar antes del borrado; se conservan. */
  readonly skipped: number;
  readonly failed: number;
}

/** Entrada mínima para decidir qué copias caducan. */
export interface RotationCandidate {
  readonly directory: string;
  readonly createdAt: string;
}

/**
 * Calcula qué copias sobran de una lista ya ordenada de más reciente a más
 * antigua.
 *
 * Es pura y no toca el disco para poder probar las guardas sin preparar
 * archivos. `protectedDirectories` incluye la copia válida más reciente global
 * y la más reciente del propio motivo.
 */
export function selectExpiredBackups(options: {
  readonly candidates: readonly RotationCandidate[];
  readonly keep: number;
  readonly protectedDirectories: ReadonlySet<string>;
}): string[] {
  const keep = Math.max(0, options.keep);
  const expired: string[] = [];

  options.candidates.forEach((candidate, index) => {
    if (index < keep) {
      return;
    }

    if (options.protectedDirectories.has(candidate.directory)) {
      return;
    }

    expired.push(candidate.directory);
  });

  return expired;
}

export interface RotateBackupsOptions {
  readonly directories: RotationDirectories;
  readonly retention?: BackupRetention;
  /** Versión máxima del journal instalado; una copia futura no es válida. */
  readonly targetSchemaVersion: number;
}

/**
 * Poda las copias sobrantes de cada motivo.
 *
 * No lanza por una copia concreta: los fallos de borrado se cuentan. Un fallo
 * al listar una carpeta deja ese motivo sin podar.
 */
export async function rotateBackups(
  options: RotateBackupsOptions,
): Promise<RotationResult> {
  const retention = options.retention ?? DEFAULT_BACKUP_RETENTION;

  const buckets = [
    {
      key: 'daily',
      directory: options.directories.daily,
      keep: retention.daily,
    },
    {
      key: 'weekly',
      directory: options.directories.weekly,
      keep: retention.weekly,
    },
    {
      key: 'monthly',
      directory: options.directories.monthly,
      keep: retention.monthly,
    },
    {
      key: 'preMigration',
      directory: options.directories.preMigration,
      keep: retention.preMigration,
    },
  ] as const;

  const allBuckets: Array<{
    readonly key: (typeof buckets)[number]['key'] | 'prePurge';
    readonly directory: string;
    readonly keep: number;
  }> = [...buckets];

  if (options.directories.prePurge !== undefined) {
    allBuckets.push({
      key: 'prePurge',
      directory: options.directories.prePurge,
      keep: retention.prePurge ?? 10,
    });
  }

  const validByBucket = new Map<
    (typeof allBuckets)[number]['key'],
    ValidBackupEntry[]
  >();
  let corrupt = 0;

  for (const bucket of allBuckets) {
    let entries;

    try {
      entries = await listBackups(bucket.directory, {
        targetSchemaVersion: options.targetSchemaVersion,
      });
    } catch {
      validByBucket.set(bucket.key, []);
      continue;
    }

    const valid = selectValidBackups(entries);

    corrupt += entries.length - valid.length;
    validByBucket.set(bucket.key, valid);
  }

  const allValid = [...validByBucket.values()].flat();
  const newest = allValid.reduce<ValidBackupEntry | null>(
    (current, entry) =>
      current === null || isNewer(entry, current) ? entry : current,
    null,
  );

  let removed = 0;
  let skipped = 0;
  let failed = 0;

  for (const bucket of allBuckets) {
    const valid = validByBucket.get(bucket.key) ?? [];
    const newestInBucket = valid[0];

    if (newestInBucket === undefined) {
      continue;
    }

    const protectedDirectories = new Set<string>([
      newestInBucket.directory,
      ...(newest === null ? [] : [newest.directory]),
    ]);

    const expired = selectExpiredBackups({
      candidates: valid.map((entry) => ({
        directory: entry.directory,
        createdAt: entry.manifest.createdAt,
      })),
      keep: bucket.keep,
      protectedDirectories,
    });

    for (const directory of expired) {
      // Reverificación obligatoria justo antes del borrado: si la copia cambió
      // o dejó de ser válida, se conserva y se contabiliza como omitida.
      let verified: boolean;

      try {
        verified = (
          await inspectBackup(directory, {
            targetSchemaVersion: options.targetSchemaVersion,
          })
        ).ok;
      } catch {
        verified = false;
      }

      if (!verified) {
        skipped += 1;
        continue;
      }

      try {
        await rm(directory, { recursive: true, force: true });
        removed += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return {
    removed,
    kept: allValid.length - removed,
    corrupt,
    skipped,
    failed,
  };
}

function isNewer(left: ValidBackupEntry, right: ValidBackupEntry): boolean {
  if (left.manifest.createdAt !== right.manifest.createdAt) {
    return left.manifest.createdAt > right.manifest.createdAt;
  }

  return left.directory > right.directory;
}
