/**
 * Medición acotada del uso de disco.
 *
 * Recorre las carpetas con `lstat` y `opendir` sin seguir enlaces simbólicos ni
 * junctions. Un error en una categoría no rompe el total: la categoría queda
 * marcada `partial` y el resto se sigue midiendo. «Temporales» mide exactamente
 * los directorios que elimina el borrado total (`imports/.tmp`, `exports/.tmp`
 * y `assets/.tmp`), de modo que ninguna categoría promete espacio que no se
 * libere. Se detiene al alcanzar `DATA_MEASUREMENT_MAX_ENTRIES` entradas o
 * `DATA_MEASUREMENT_MAX_DURATION_MS` milisegundos, momento en que el resultado
 * también es parcial.
 */
import { lstat, opendir } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  DataUsage,
  DataUsageCategory,
  DataUsageCategoryUsage,
} from '../../shared/contracts/data';
import type { DataPaths } from '../db/paths';
import {
  DATA_MEASUREMENT_MAX_DURATION_MS,
  DATA_MEASUREMENT_MAX_ENTRIES,
  DATA_USAGE_CATEGORIES,
} from './constants';

export type {
  DataUsage,
  DataUsageCategory,
  DataUsageCategoryUsage,
} from '../../shared/contracts/data';

/** Opciones de la medición. */
export interface DataUsageOptions {
  readonly paths: DataPaths;
  readonly maxEntries?: number;
  readonly maxDurationMs?: number;
  readonly now?: () => number;
}

interface Budget {
  readonly maxEntries: number;
  readonly deadline: number;
  readonly now: () => number;
  entries: number;
  partial: boolean;
}

interface MutableCategoryUsage {
  bytes: number;
  entries: number;
  partial: boolean;
}

/** Mide el uso de datos con límites de entradas y tiempo. */
export async function measureDataUsage(
  options: DataUsageOptions,
): Promise<DataUsage> {
  const now = options.now ?? Date.now;
  const budget: Budget = {
    maxEntries: options.maxEntries ?? DATA_MEASUREMENT_MAX_ENTRIES,
    deadline:
      now() + (options.maxDurationMs ?? DATA_MEASUREMENT_MAX_DURATION_MS),
    now,
    entries: 0,
    partial: false,
  };
  const categories: Record<DataUsageCategory, MutableCategoryUsage> = {
    database: emptyCategory(),
    assets: emptyCategory(),
    backups: emptyCategory(),
    logs: emptyCategory(),
    temporary: emptyCategory(),
  };

  await measureDatabaseFiles(options.paths, categories.database, budget);
  // `assets/.tmp` se mide como temporal, no como imagen, para que las
  // categorías coincidan con lo que borra el borrado total.
  await measureTree(
    options.paths.assetsDir,
    categories.assets,
    budget,
    new Set([options.paths.assetsTempDir]),
  );
  await measureTree(options.paths.backupsDir, categories.backups, budget);
  await measureTree(options.paths.logsDir, categories.logs, budget);
  await measureTree(options.paths.importsTempDir, categories.temporary, budget);
  await measureTree(options.paths.exportsTempDir, categories.temporary, budget);
  await measureTree(options.paths.assetsTempDir, categories.temporary, budget);

  const totalBytes = DATA_USAGE_CATEGORIES.reduce(
    (total, category) => total + categories[category].bytes,
    0,
  );
  const totalEntries = DATA_USAGE_CATEGORIES.reduce(
    (total, category) => total + categories[category].entries,
    0,
  );
  const partial =
    budget.partial ||
    DATA_USAGE_CATEGORIES.some((category) => categories[category].partial);

  return {
    totalBytes,
    totalEntries,
    partial,
    categories: {
      database: freezeCategory(categories.database),
      assets: freezeCategory(categories.assets),
      backups: freezeCategory(categories.backups),
      logs: freezeCategory(categories.logs),
      temporary: freezeCategory(categories.temporary),
    },
  };
}

function emptyCategory(): MutableCategoryUsage {
  return { bytes: 0, entries: 0, partial: false };
}

function freezeCategory(
  category: MutableCategoryUsage,
): DataUsageCategoryUsage {
  return {
    bytes: category.bytes,
    entries: category.entries,
    partial: category.partial,
  };
}

async function measureDatabaseFiles(
  paths: DataPaths,
  category: MutableCategoryUsage,
  budget: Budget,
): Promise<void> {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    if (!canContinue(category, budget)) {
      return;
    }

    const file = `${paths.databaseFile}${suffix}`;
    let stats;

    try {
      stats = await lstat(file);
    } catch (error) {
      if (!isMissingFileError(error)) {
        markPartial(category, budget);
      }
      continue;
    }

    if (stats.isSymbolicLink() || !stats.isFile()) {
      markPartial(category, budget);
      continue;
    }

    if (!canContinue(category, budget)) {
      return;
    }

    category.bytes += stats.size;
    countEntry(category, budget);
  }
}

async function measureTree(
  root: string,
  category: MutableCategoryUsage,
  budget: Budget,
  excluded: ReadonlySet<string> = new Set(),
): Promise<void> {
  const pending = [root];

  while (pending.length > 0) {
    if (!canContinue(category, budget)) {
      return;
    }

    const directory = pending.pop();

    if (directory === undefined) {
      return;
    }

    let stats;

    try {
      stats = await lstat(directory);
    } catch (error) {
      if (!isMissingFileError(error)) {
        markPartial(category, budget);
      }
      continue;
    }

    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      markPartial(category, budget);
      continue;
    }

    try {
      const handle = await opendir(directory);

      for await (const entry of handle) {
        if (!canContinue(category, budget)) {
          return;
        }

        const absolute = join(directory, entry.name);

        if (excluded.has(absolute)) {
          continue;
        }

        countEntry(category, budget);

        if (entry.isSymbolicLink()) {
          markPartial(category, budget);
          continue;
        }

        if (entry.isDirectory()) {
          pending.push(absolute);
          continue;
        }

        if (!entry.isFile()) {
          markPartial(category, budget);
          continue;
        }

        try {
          const fileStats = await lstat(absolute);

          if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
            markPartial(category, budget);
            continue;
          }

          category.bytes += fileStats.size;
        } catch (error) {
          if (!isMissingFileError(error)) {
            markPartial(category, budget);
          }
        }
      }
    } catch (error) {
      if (!isMissingFileError(error)) {
        markPartial(category, budget);
      }
    }
  }
}

function canContinue(category: MutableCategoryUsage, budget: Budget): boolean {
  if (budget.entries >= budget.maxEntries || budget.now() >= budget.deadline) {
    markPartial(category, budget);
    return false;
  }

  return true;
}

function countEntry(category: MutableCategoryUsage, budget: Budget): void {
  budget.entries += 1;
  category.entries += 1;
}

function markPartial(category: MutableCategoryUsage, budget: Budget): void {
  category.partial = true;
  budget.partial = true;
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}
