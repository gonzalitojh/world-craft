/**
 * Limpieza de carpetas temporales de transferencia al arrancar.
 *
 * Elimina el contenido de `imports/.tmp`, `exports/.tmp` y `assets/.tmp`, que
 * solo contienen operaciones interrumpidas. **Nunca** toca `assets/worlds`: los
 * assets publicados de los mundos son datos del usuario. Tampoco elimina los
 * `.partial` de una carpeta elegida por el usuario: viven junto al destino y
 * podrían ser un archivo ajeno.
 *
 * También retira restos antiguos de staging que quedaron directamente en
 * `imports/<uuid>` antes de mover la preparación a `imports/.tmp`; solo se
 * tocan directorios cuyo nombre es un UUIDv7 y nunca `imports/.tmp`.
 */
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { isUuidV7 } from '../db/ids';
import { silentTransferLogger, type TransferLogger } from './logger';
import {
  assertTransferDirectoryInside,
  assertTransferRootDirectory,
  removeEntryInside,
} from './safe-paths';

/** Opciones de la limpieza. */
export interface CleanupOptions {
  readonly importsTempDir: string;
  readonly exportsTempDir: string;
  readonly assetsTempDir: string;
  readonly logger?: TransferLogger;
}

/** Resultado de la limpieza. */
export interface CleanupResult {
  readonly removed: number;
}

/** Limpia las carpetas temporales y devuelve cuántas entradas eliminó. */
export async function cleanupTransferTempDirectories(
  options: CleanupOptions,
): Promise<CleanupResult> {
  const logger = options.logger ?? silentTransferLogger;
  let removed = 0;
  let failed = 0;

  try {
    for (const directory of [
      options.importsTempDir,
      options.exportsTempDir,
      options.assetsTempDir,
    ]) {
      const result = await cleanDirectory(directory);

      removed += result.removed;
      failed += result.failed;
    }

    const legacy = await cleanLegacyStaging(
      resolve(options.importsTempDir, '..'),
    );

    removed += legacy.removed;
    failed += legacy.failed;

    logger.log({
      event: 'transfer.cleanup',
      outcome: failed > 0 ? 'failed' : 'completed',
      removed,
    });
  } catch (error) {
    logger.log({
      event: 'transfer.cleanup',
      outcome: 'failed',
      removed,
    });

    throw error;
  }

  return { removed };
}

interface CleanupCount {
  readonly removed: number;
  readonly failed: number;
}

async function cleanDirectory(directory: string): Promise<CleanupCount> {
  const root = resolve(directory);
  const parent = dirname(root);

  try {
    assertTransferRootDirectory(parent, { create: true });
    assertTransferDirectoryInside(parent, root, { create: true });
  } catch {
    return { removed: 0, failed: 1 };
  }

  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  let removed = 0;
  let failed = 0;

  for (const entry of entries) {
    if (await removeEntryInside(root, join(root, entry.name))) {
      removed += 1;
    } else {
      failed += 1;
    }
  }

  return { removed, failed };
}

/**
 * Retira los staging antiguos creados directamente en `imports/<uuid>`.
 *
 * Solo se consideran directorios con nombre UUIDv7; cualquier otro contenido de
 * `imports` se conserva por si no pertenece a una operación interrumpida.
 */
async function cleanLegacyStaging(importsDir: string): Promise<CleanupCount> {
  const root = resolve(importsDir);

  try {
    assertTransferRootDirectory(root, { create: true });
  } catch {
    return { removed: 0, failed: 1 };
  }

  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  let removed = 0;
  let failed = 0;

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.name === '.tmp' ||
      !isUuidV7(entry.name)
    ) {
      continue;
    }

    if (await removeEntryInside(root, join(root, entry.name))) {
      removed += 1;
    } else {
      failed += 1;
    }
  }

  return { removed, failed };
}
