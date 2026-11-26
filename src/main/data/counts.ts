/**
 * Recuentos del resumen de datos.
 *
 * Las consultas se preparan una vez y nunca interpolan nombres, rutas ni SQL
 * del llamador. La lectura de copias solo cuenta directorios inmediatos de cada
 * motivo; un enlace o una entrada ilegible no se sigue ni rompe el resumen.
 */
import { readdirSync } from 'node:fs';

import type { DataCounts } from '../../shared/contracts/data';
import type { SqliteDatabase } from '../db/connection';
import { toDataError } from './errors';

export type { DataCounts, DataWorldCounts } from '../../shared/contracts/data';

/** Dependencias del recuento. */
export interface DataCountsOptions {
  readonly sqlite: SqliteDatabase;
  /** Carpetas de motivo de copias; se cuentan sus subcarpetas directas. */
  readonly backupDirectories: readonly string[];
}

/**
 * Lee los recuentos de la base y de las copias.
 *
 * Los mundos en papelera se cuentan por `deleted_at`; los vivos se reparten
 * entre activos y archivados. Las fichas y los assets cuentan solo el contenido
 * vivo. Un fallo de SQL se traduce a `DATA_COUNTS_FAILED` sin detalles.
 */
export function readDataCounts(options: DataCountsOptions): DataCounts {
  try {
    const worlds = options.sqlite
      .prepare(
        `select
           coalesce(sum(case when deleted_at is not null then 1 else 0 end), 0) as trash,
           coalesce(sum(case when deleted_at is null and status = 'active' then 1 else 0 end), 0) as active,
           coalesce(sum(case when deleted_at is null and status = 'archived' then 1 else 0 end), 0) as archived
         from worlds`,
      )
      .get() as
      | {
          readonly trash: number;
          readonly active: number;
          readonly archived: number;
        }
      | undefined;
    const entities = options.sqlite
      .prepare(
        'select count(*) as total from entities where deleted_at is null',
      )
      .get() as { readonly total: number } | undefined;
    const assets = options.sqlite
      .prepare('select count(*) as total from assets')
      .get() as { readonly total: number } | undefined;

    return {
      worlds: {
        active: worlds?.active ?? 0,
        archived: worlds?.archived ?? 0,
        trash: worlds?.trash ?? 0,
      },
      entities: entities?.total ?? 0,
      assets: assets?.total ?? 0,
      backups: countBackupDirectories(options.backupDirectories),
    };
  } catch (error) {
    throw toDataError(error, 'DATA_COUNTS_FAILED');
  }
}

function countBackupDirectories(directories: readonly string[]): number {
  let total = 0;

  for (const directory of directories) {
    try {
      total += readdirSync(directory, { withFileTypes: true }).filter((entry) =>
        entry.isDirectory(),
      ).length;
    } catch {
      // Una copia ausente o ilegible no aporta recuento ni rompe el resumen.
    }
  }

  return total;
}
