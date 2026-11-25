/**
 * Servicio de importación de un mundo.
 *
 * La preparación (ZIP, validación, plan y assets procesados) se delega en
 * `prepare`, que en producción es el utility process y en las pruebas es la
 * misma función in-process. El proceso principal recibe el plan, vuelve a
 * validarlo, comprueba los assets y ejecuta una única transacción: inserta
 * todas las filas, renombra el directorio de assets dentro del callback y, solo
 * entonces, confirma. Una cancelación antes de `saving` limpia todo; una vez
 * abierta la transacción, la operación no se puede cancelar.
 *
 * Nunca hay copia previa: la importación siempre crea un mundo nuevo y no toca
 * los mundos existentes. Un fallo revierte SQLite y elimina los assets
 * publicados, pero no borra nada ajeno.
 */
import { existsSync, renameSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import type { WorldCraftDatabase } from '../../db/client';
import type { SqliteDatabase } from '../../db/connection';
import { generateUuidv7, isUuidV7 } from '../../db/ids';
import { parseRelativeAssetPath, buildRelativePath } from '../../assets/paths';
import {
  type TransferCancelResult,
  type TransferEvent,
  type TransferImportResult,
} from '../../../shared/contracts/transfer';
import { TRANSFER_PLAN_FILE } from '../constants';
import { TransferError, toTransferError } from '../errors';
import { assertFreeSpace, fingerprintFile, type FreeSpaceProbe } from '../fs';
import { silentTransferLogger, type TransferLogger } from '../logger';
import type { ArchiveLimits } from '../archive/reader';
import {
  assertTransferDirectoryInside,
  assertTransferFileInside,
  assertTransferRootDirectory,
  inspectTransferDirectory,
  removeDirectoryIfSafe,
} from '../safe-paths';
import { readImportPlan, type ImportPlan } from './plan';
import {
  prepareImport,
  type PrepareImportOptions,
  type PreparedImport,
} from './prepare';
import { createImportRepository } from './repository';

/** Preparador inyectable: in-process o respaldado por el utility process. */
export type ImportPreparer = (
  options: PrepareImportOptions,
) => Promise<PreparedImport>;

/** Opciones del servicio. */
export interface ImportServiceOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly importsDir: string;
  readonly assetsDir: string;
  readonly assetsWorldsDir: string;
  readonly assetsTempDir: string;
  readonly schemaVersion: number;
  readonly prepare?: ImportPreparer;
  readonly now?: () => number;
  readonly generateId?: () => string;
  readonly generateOperationId?: () => string;
  readonly logger?: TransferLogger;
  readonly limits?: ArchiveLimits;
  /** Sonda de espacio inyectable para pruebas. */
  readonly readFreeSpace?: FreeSpaceProbe;
  /**
   * Comprobación final dentro de la transacción, después del renombrado de
   * assets y antes del commit. Las pruebas la usan para inyectar un fallo y
   * verificar el rollback; en producción puede alojar verificaciones de
   * integridad.
   */
  readonly beforeCommit?: (plan: ImportPlan) => void;
}

/** Callbacks de una importación concreta. */
export interface ImportCallbacks {
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: TransferEvent) => void;
}

/** Servicio público de importación. */
export interface ImportService {
  importWorld(
    archiveFile: string,
    callbacks?: ImportCallbacks,
  ): Promise<TransferImportResult>;
  cancel(): TransferCancelResult;
  isBusy(): boolean;
}

/** Crea el servicio sobre la base compartida. */
export function createImportService(
  options: ImportServiceOptions,
): ImportService {
  const repository = createImportRepository(options.database);
  const prepare = options.prepare ?? prepareImport;
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? generateUuidv7;
  const generateOperationId = options.generateOperationId ?? generateUuidv7;
  const logger = options.logger ?? silentTransferLogger;

  let active: AbortController | null = null;
  let saving = false;

  return {
    isBusy() {
      return active !== null;
    },

    cancel() {
      if (active === null || saving) {
        return { cancelled: false };
      }

      active.abort();
      return { cancelled: true };
    },

    async importWorld(archiveFile, callbacks) {
      if (active !== null) {
        throw new TransferError('TRANSFER_BUSY');
      }

      if (!isAbsolute(archiveFile) || archiveFile.includes('\0')) {
        throw new TransferError('TRANSFER_INPUT_INVALID');
      }

      const controller = new AbortController();
      const unlinkExternal = linkAbort(callbacks?.signal, controller);
      active = controller;
      saving = false;

      const operationId = generateOperationId();
      const importsTempRoot = resolve(options.importsDir, '.tmp');
      const assetTempRoot = resolve(options.assetsTempDir, operationId);
      let publishedAssetsDir: string | null = null;
      let committed = false;
      let importsSafe = false;
      let assetsSafe = false;

      try {
        assertTransferRootDirectory(resolve(options.importsDir), {
          create: true,
        });
        assertTransferDirectoryInside(options.importsDir, importsTempRoot, {
          create: true,
        });
        importsSafe = true;

        assertTransferRootDirectory(resolve(options.assetsDir), {
          code: 'TRANSFER_DESTINATION_UNAVAILABLE',
        });
        assertTransferDirectoryInside(
          options.assetsDir,
          options.assetsTempDir,
          {
            create: true,
            code: 'TRANSFER_DESTINATION_UNAVAILABLE',
          },
        );
        assertTransferDirectoryInside(
          options.assetsDir,
          options.assetsWorldsDir,
          {
            create: true,
            code: 'TRANSFER_DESTINATION_UNAVAILABLE',
          },
        );
        assetsSafe = true;

        logger.log({
          event: 'transfer.operation',
          operation: 'import',
          phase: 'preparing',
          outcome: 'started',
          warnings: 0,
        });

        throwIfAborted(controller.signal);

        const existingSlugs = repository.listWorldSlugs();
        const prepared = await prepare({
          operationId,
          archiveFile,
          importsDir: options.importsDir,
          assetsTempDir: options.assetsTempDir,
          schemaVersion: options.schemaVersion,
          existingSlugs,
          now,
          generateId,
          signal: controller.signal,
          ...(callbacks?.onEvent === undefined
            ? {}
            : { onEvent: callbacks.onEvent }),
          ...(options.limits === undefined ? {} : { limits: options.limits }),
          ...(options.readFreeSpace === undefined
            ? {}
            : { readFreeSpace: options.readFreeSpace }),
        });

        throwIfAborted(controller.signal);

        validatePreparedPaths(
          prepared,
          operationId,
          options.importsDir,
          importsTempRoot,
          options.assetsTempDir,
          assetTempRoot,
        );

        const plan = await readImportPlan(prepared.planFile);
        validatePreparedImport(prepared, plan);

        const finalAssetsDir = resolve(options.assetsWorldsDir, plan.worldId);

        assertDestinationMissing(options.assetsWorldsDir, finalAssetsDir);

        await assertFreeSpace(
          options.assetsDir,
          plan.totalAssetBytes,
          options.readFreeSpace,
        );
        await verifyPreparedAssets(prepared.assetTempDir, plan);
        throwIfAborted(controller.signal);

        callbacks?.onEvent?.({
          operation: 'import',
          phase: 'importing',
          completed: 0,
          total: 1,
          warnings: plan.warnings.length,
        });

        const assetTempDir = prepared.assetTempDir;

        saving = true;
        callbacks?.onEvent?.({
          operation: 'import',
          phase: 'saving',
          completed: 0,
          total: 1,
          warnings: plan.warnings.length,
        });

        // A partir de aquí no se comprueba la señal: la transacción y el
        // renombrado deben terminar juntos o revertirse juntos.
        options.sqlite.transaction(() => {
          assertTransferDirectoryInside(
            options.assetsDir,
            options.assetsWorldsDir,
            {
              create: true,
              code: 'TRANSFER_DESTINATION_UNAVAILABLE',
            },
          );
          assertDestinationMissing(options.assetsWorldsDir, finalAssetsDir);
          assertTransferDirectoryInside(assetTempRoot, assetTempDir, {
            code: 'TRANSFER_INTERNAL',
          });

          if (existsSync(finalAssetsDir)) {
            throw new TransferError('TRANSFER_DESTINATION_UNAVAILABLE');
          }

          repository.insertPlan(plan);
          renameSync(assetTempDir, finalAssetsDir);
          publishedAssetsDir = finalAssetsDir;
          options.beforeCommit?.(plan);
          repository.finalizePlan(plan);
        })();

        committed = true;
        callbacks?.onEvent?.({
          operation: 'import',
          phase: 'saving',
          completed: 1,
          total: 1,
          warnings: plan.warnings.length,
        });

        logger.log({
          event: 'transfer.operation',
          operation: 'import',
          phase: 'saving',
          outcome: 'completed',
          warnings: plan.warnings.length,
        });

        return {
          worldId: plan.worldId,
          worldName: plan.world.name,
          slug: plan.world.slug,
          slugAdjusted: plan.slugAdjusted,
          counts: plan.counts,
          warnings: plan.warnings,
        };
      } catch (error) {
        if (publishedAssetsDir !== null && !committed) {
          await removeDirectoryIfSafe(
            options.assetsWorldsDir,
            publishedAssetsDir,
          );
        }

        const transferError = toTransferError(error, 'TRANSFER_SAVE_FAILED');
        const failedPhase = saving ? 'saving' : 'preparing';

        if (transferError.code === 'TRANSFER_CANCELLED') {
          logger.log({
            event: 'transfer.operation',
            operation: 'import',
            phase: failedPhase,
            outcome: 'cancelled',
            warnings: 0,
          });
        } else {
          logger.log({
            event: 'transfer.operation',
            operation: 'import',
            phase: failedPhase,
            outcome: 'failed',
            code: transferError.code,
          });
        }

        throw transferError;
      } finally {
        saving = false;
        active = null;
        unlinkExternal();

        // Solo se borran rutas derivadas de valores conocidos y raíces que
        // superaron la inspección real de directorios.
        if (importsSafe) {
          await removeDirectoryIfSafe(
            importsTempRoot,
            resolve(importsTempRoot, operationId),
          );
        }

        if (assetsSafe) {
          await removeDirectoryIfSafe(options.assetsTempDir, assetTempRoot);
        }
      }
    },
  };
}

/**
 * Servicio de sustitución cuando la base no está disponible (modo seguro).
 *
 * Cualquier importación se rechaza con un error estable; la interfaz muestra
 * que la función no está disponible en lugar de intentar escribir.
 */
export function createUnavailableImportService(): ImportService {
  return {
    isBusy: () => false,
    cancel: () => ({ cancelled: false }),
    importWorld: async () => {
      throw new TransferError('TRANSFER_INTERNAL');
    },
  };
}

function validatePreparedPaths(
  prepared: PreparedImport,
  operationId: string,
  importsDir: string,
  importsTempRoot: string,
  assetsTempDir: string,
  assetTempRoot: string,
): void {
  const expectedStaging = resolve(importsTempRoot, operationId);
  const expectedPlan = resolve(expectedStaging, TRANSFER_PLAN_FILE);
  const expectedAssetTemp = resolve(assetTempRoot, prepared.worldId);

  if (
    resolve(prepared.stagingDir) !== expectedStaging ||
    resolve(prepared.planFile) !== expectedPlan ||
    resolve(prepared.assetTempDir) !== expectedAssetTemp
  ) {
    throw new TransferError('TRANSFER_INTERNAL');
  }

  assertTransferDirectoryInside(importsDir, importsTempRoot, {
    code: 'TRANSFER_INTERNAL',
  });
  assertTransferDirectoryInside(importsDir, expectedStaging, {
    code: 'TRANSFER_INTERNAL',
  });
  assertTransferDirectoryInside(importsTempRoot, expectedStaging, {
    code: 'TRANSFER_INTERNAL',
  });
  assertTransferDirectoryInside(assetsTempDir, assetTempRoot, {
    code: 'TRANSFER_INTERNAL',
  });
  assertTransferFileInside(
    expectedStaging,
    expectedPlan,
    TRANSFER_PLAN_FILE,
    'TRANSFER_INTERNAL',
  );
  assertTransferDirectoryInside(assetTempRoot, expectedAssetTemp, {
    code: 'TRANSFER_INTERNAL',
  });
}

function validatePreparedImport(
  prepared: PreparedImport,
  plan: ImportPlan,
): void {
  if (
    !isUuidV7(plan.worldId) ||
    plan.worldId !== prepared.worldId ||
    plan.world.slug !== prepared.slug ||
    plan.slugAdjusted !== prepared.slugAdjusted ||
    plan.world.name !== prepared.worldName ||
    !sameCounts(plan.counts, prepared.counts) ||
    plan.totalAssetBytes !== prepared.totalAssetBytes
  ) {
    throw new TransferError('TRANSFER_INTERNAL');
  }

  for (const asset of plan.assets) {
    const parsed = parseRelativeAssetPath(asset.relativePath);
    const thumbnail = parseRelativeAssetPath(asset.thumbnailRelativePath);

    if (
      parsed.variant !== 'asset' ||
      thumbnail.variant !== 'thumb' ||
      parsed.worldId !== plan.worldId ||
      thumbnail.worldId !== plan.worldId ||
      parsed.assetId !== asset.id ||
      thumbnail.assetId !== asset.id ||
      asset.relativePath !==
        buildRelativePath({
          worldId: plan.worldId,
          assetId: asset.id,
          variant: 'asset',
        }) ||
      asset.thumbnailRelativePath !==
        buildRelativePath({
          worldId: plan.worldId,
          assetId: asset.id,
          variant: 'thumb',
        })
    ) {
      throw new TransferError('TRANSFER_INTERNAL');
    }
  }
}

function sameCounts(
  left: TransferImportResult['counts'],
  right: TransferImportResult['counts'],
): boolean {
  return (
    left.entities === right.entities &&
    left.entityTypes === right.entityTypes &&
    left.relationTypes === right.relationTypes &&
    left.tags === right.tags &&
    left.relations === right.relations &&
    left.versions === right.versions &&
    left.assets === right.assets
  );
}

function assertDestinationMissing(
  assetsWorldsDir: string,
  finalAssetsDir: string,
): void {
  const state = inspectTransferDirectory(assetsWorldsDir, finalAssetsDir);

  if (state.state === 'missing') {
    return;
  }

  throw new TransferError('TRANSFER_DESTINATION_UNAVAILABLE');
}

async function verifyPreparedAssets(
  assetTempDir: string,
  plan: ImportPlan,
): Promise<void> {
  for (const asset of plan.assets) {
    const main = await fingerprintFile(join(assetTempDir, `${asset.id}.webp`));
    const thumbnail = await fingerprintFile(
      join(assetTempDir, `${asset.id}.thumb.webp`),
    );

    if (
      main.size !== asset.size ||
      main.sha256 !== asset.hash ||
      thumbnail.size !== asset.thumbnailSize
    ) {
      throw new TransferError('TRANSFER_ASSET_INVALID');
    }
  }
}

function linkAbort(
  external: AbortSignal | undefined,
  controller: AbortController,
): () => void {
  if (external === undefined) {
    return () => {};
  }

  if (external.aborted) {
    controller.abort();
    return () => {};
  }

  const onAbort = (): void => controller.abort();
  external.addEventListener('abort', onAbort, { once: true });

  return () => external.removeEventListener('abort', onAbort);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new TransferError('TRANSFER_CANCELLED');
  }
}
