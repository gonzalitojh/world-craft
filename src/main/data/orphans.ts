/**
 * Resumen y purga de imágenes huérfanas para Ajustes.
 *
 * Reutiliza la planificación y la purga verificable del servicio de assets
 * (#66). La frontera de este módulo no expone rutas: el renderer recibe solo
 * recuentos y bytes. La purga exige el token exacto y nunca toca un archivo
 * referenciado por una ficha.
 */
import { lstatSync } from 'node:fs';
import { join } from 'node:path';

import {
  planOrphanCleanup,
  purgeOrphans,
  type OrphanPlan,
} from '../assets/orphans';
import type {
  DataOrphanPurgeResult,
  DataOrphanSummary,
} from '../../shared/contracts/data';
import type { AssetRecord } from '../assets/store';
import { DATA_ORPHAN_PURGE_CONFIRMATION } from './constants';
import { DataError, toDataError } from './errors';

export type {
  DataOrphanPurgeResult,
  DataOrphanSummary,
} from '../../shared/contracts/data';

/** Entrada de la planificación. */
export interface DataOrphanPlanOptions {
  readonly assetsDir: string;
  readonly records: readonly AssetRecord[];
}

/** Dependencias de la purga. */
export interface DataOrphanPurgeDependencies {
  readonly userDataDir: string;
  readonly assetsDir: string;
  readonly orphanBackupsDir: string;
  readonly records: readonly AssetRecord[];
  readonly now?: () => number;
}

/** Confirmación obligatoria de la purga. */
export interface DataOrphanPurgeOptions {
  readonly confirmation: string;
}

/** Planifica los huérfanos y devuelve solo el resumen agregado. */
export function planDataOrphans(
  options: DataOrphanPlanOptions,
): DataOrphanSummary {
  try {
    const plan = planOrphanCleanup({
      assetsDir: options.assetsDir,
      records: options.records,
    });

    return summarizePlan(options.assetsDir, plan);
  } catch (error) {
    throw toDataError(error, 'DATA_ORPHAN_PLAN_FAILED');
  }
}

/**
 * Purga los huérfanos con copia verificable y token explícito.
 *
 * El token se comprueba antes de planificar. El resultado se reduce a
 * contadores: ni la copia ni los archivos purgados revelan sus rutas.
 */
export async function purgeDataOrphans(
  dependencies: DataOrphanPurgeDependencies,
  options: DataOrphanPurgeOptions,
): Promise<DataOrphanPurgeResult> {
  if (options.confirmation !== DATA_ORPHAN_PURGE_CONFIRMATION) {
    throw new DataError('DATA_ORPHAN_CONFIRMATION_REQUIRED');
  }

  let before: DataOrphanSummary;

  try {
    before = planDataOrphans({
      assetsDir: dependencies.assetsDir,
      records: dependencies.records,
    });
  } catch (error) {
    throw toDataError(error, 'DATA_ORPHAN_PLAN_FAILED');
  }

  try {
    const result = await purgeOrphans(
      {
        userDataDir: dependencies.userDataDir,
        assetsDir: dependencies.assetsDir,
        orphanBackupsDir: dependencies.orphanBackupsDir,
        repository: { listAll: () => dependencies.records },
        ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
      },
      { confirmation: options.confirmation },
    );

    return {
      purgedFiles: result.purged.length,
      purgedBytes: before.recoverableBytes,
      backupCreated: result.backupDirectory !== null,
    };
  } catch (error) {
    throw toDataError(error, 'DATA_ORPHAN_PURGE_FAILED');
  }
}

function summarizePlan(
  assetsDir: string,
  plan: OrphanPlan,
): DataOrphanSummary {
  const purgeable = [
    ...plan.unreferencedFiles,
    ...plan.orphanThumbnails,
    ...plan.temporaryFiles,
  ];

  return {
    purgeableFiles: purgeable.length,
    unreferencedFiles: plan.unreferencedFiles.length,
    orphanThumbnails: plan.orphanThumbnails.length,
    temporaryFiles: plan.temporaryFiles.length,
    missingFiles: plan.missingFiles.length,
    unexpectedEntries: plan.unexpectedEntries.length,
    suspiciousLinks: plan.suspiciousLinks.length,
    recoverableBytes: sumFileSizes(assetsDir, purgeable),
  };
}

function sumFileSizes(assetsDir: string, relativePaths: readonly string[]): number {
  let total = 0;

  for (const relativePath of relativePaths) {
    try {
      const stats = lstatSync(join(assetsDir, ...relativePath.split('/')));

      if (!stats.isSymbolicLink() && stats.isFile()) {
        total += stats.size;
      }
    } catch {
      // Un archivo que desaparece entre el plan y el resumen no aporta bytes.
    }
  }

  return total;
}
