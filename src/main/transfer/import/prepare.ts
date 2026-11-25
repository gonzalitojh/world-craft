/**
 * Preparación compartida por el worker y las pruebas de integración.
 *
 * Encadena el staging (ZIP, manifiesto, `world.json` y extracción de assets),
 * la construcción del plan con IDs nuevos y la publicación de los assets
 * procesados en `assets/.tmp/<operationId>/<worldId>`. El proceso principal
 * solo recibe el resumen y el `plan.json`; nunca un payload gigante por IPC.
 *
 * La carpeta temporal se elimina completa si algo falla o se cancela.
 */
import { copyFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type {
  TransferCounts,
  TransferEvent,
  TransferWarning,
} from '../../../shared/contracts/transfer';
import { isUuidV7 } from '../../db/ids';
import { TransferError, toTransferError } from '../errors';
import { fingerprintFile, type FreeSpaceProbe } from '../fs';
import {
  assertTransferContained,
  assertTransferDirectoryInside,
  assertTransferFileInside,
  assertTransferRootDirectory,
  inspectTransferDirectory,
  removeDirectoryIfSafe,
} from '../safe-paths';
import { createImportPlan, writeImportPlan, type ImportPlan } from './plan';
import { stageImport, type StagingOptions } from './staging';

/** Resumen que cruza del worker al proceso principal. */
export interface PreparedImport {
  readonly planFile: string;
  readonly stagingDir: string;
  readonly assetTempDir: string;
  readonly worldId: string;
  readonly worldName: string;
  readonly slug: string;
  readonly slugAdjusted: boolean;
  readonly counts: TransferCounts;
  readonly warnings: readonly TransferWarning[];
  readonly totalAssetBytes: number;
}

/** Opciones de la preparación. */
export interface PrepareImportOptions {
  readonly operationId: string;
  readonly archiveFile: string;
  readonly importsDir: string;
  readonly assetsTempDir: string;
  readonly schemaVersion: number;
  readonly existingSlugs: readonly string[];
  readonly now?: () => number;
  readonly generateId?: () => string;
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: TransferEvent) => void;
  readonly limits?: StagingOptions['limits'];
  /** Sonda de espacio inyectable para pruebas. */
  readonly readFreeSpace?: FreeSpaceProbe;
}

/** Prepara, valida y planifica una importación completa sin tocar SQLite. */
export async function prepareImport(
  options: PrepareImportOptions,
): Promise<PreparedImport> {
  if (!isUuidV7(options.operationId)) {
    throw new TransferError('TRANSFER_INPUT_INVALID');
  }

  const assetsRoot = resolve(options.assetsTempDir);
  const assetTempRoot = resolve(assetsRoot, options.operationId);
  const importsTempRoot = resolve(options.importsDir, '.tmp');
  let stagingDir: string | null = null;

  assertTransferRootDirectory(assetsRoot, { create: true });
  const assetTempState = inspectTransferDirectory(assetsRoot, assetTempRoot);

  if (
    assetTempState.state !== 'missing' &&
    assetTempState.state !== 'directory'
  ) {
    throw new TransferError('TRANSFER_INPUT_INVALID');
  }

  try {
    await rm(assetTempRoot, { recursive: true, force: true });
    assertTransferDirectoryInside(assetsRoot, assetTempRoot, { create: true });

    const staged = await stageImport({
      operationId: options.operationId,
      archiveFile: options.archiveFile,
      importsDir: options.importsDir,
      schemaVersion: options.schemaVersion,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.onEvent === undefined ? {} : { onEvent: options.onEvent }),
      ...(options.limits === undefined ? {} : { limits: options.limits }),
      ...(options.readFreeSpace === undefined
        ? {}
        : { readFreeSpace: options.readFreeSpace }),
    });

    stagingDir = staged.stagingDir;
    assertTransferDirectoryInside(staged.stagingDir, staged.assetsDir);

    const plan = createImportPlan({
      staged,
      existingSlugs: new Set(options.existingSlugs),
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.generateId === undefined
        ? {}
        : { generateId: options.generateId }),
    });
    const planFile = await writeImportPlan(staged.stagingDir, plan);

    throwIfAborted(options.signal);

    const prepared = await prepareAssets({
      plan,
      stagedAssetsDir: staged.assetsDir,
      assetTempRoot,
      signal: options.signal,
      onEvent: options.onEvent,
      warnings: plan.warnings.length,
    });

    return {
      planFile,
      stagingDir: staged.stagingDir,
      assetTempDir: prepared.assetTempDir,
      worldId: plan.worldId,
      worldName: plan.world.name,
      slug: plan.world.slug,
      slugAdjusted: plan.slugAdjusted,
      counts: plan.counts,
      warnings: plan.warnings,
      totalAssetBytes: plan.totalAssetBytes,
    };
  } catch (error) {
    if (stagingDir !== null) {
      await removeDirectoryIfSafe(importsTempRoot, stagingDir);
    }

    await removeDirectoryIfSafe(assetsRoot, assetTempRoot);

    throw toTransferError(error, 'TRANSFER_SOURCE_UNREADABLE');
  }
}

interface PrepareAssetsOptions {
  readonly plan: ImportPlan;
  readonly stagedAssetsDir: string;
  readonly assetTempRoot: string;
  readonly signal: AbortSignal | undefined;
  readonly onEvent: ((event: TransferEvent) => void) | undefined;
  readonly warnings: number;
}

async function prepareAssets(options: PrepareAssetsOptions): Promise<{
  readonly assetTempDir: string;
}> {
  const assetTempDir = join(options.assetTempRoot, options.plan.worldId);

  assertTransferDirectoryInside(options.assetTempRoot, assetTempDir, {
    create: true,
  });
  assertTransferDirectoryInside(options.assetTempRoot, assetTempDir);

  const total = options.plan.assets.length;
  const step = Math.max(1, Math.floor(total / 100));

  for (const [index, asset] of options.plan.assets.entries()) {
    throwIfAborted(options.signal);

    const source = join(options.stagedAssetsDir, `${asset.sourceId}.webp`);
    const sourceThumbnail = join(
      options.stagedAssetsDir,
      `${asset.sourceId}.thumb.webp`,
    );
    const destination = join(assetTempDir, `${asset.id}.webp`);
    const destinationThumbnail = join(assetTempDir, `${asset.id}.thumb.webp`);

    assertTransferFileInside(
      options.stagedAssetsDir,
      source,
      `${asset.sourceId}.webp`,
      'TRANSFER_ASSET_INVALID',
    );
    assertTransferFileInside(
      options.stagedAssetsDir,
      sourceThumbnail,
      `${asset.sourceId}.thumb.webp`,
      'TRANSFER_ASSET_INVALID',
    );
    assertTransferContained(assetTempDir, destination);
    assertTransferContained(assetTempDir, destinationThumbnail);

    await moveFile(source, destination);
    await moveFile(sourceThumbnail, destinationThumbnail);

    const mainFingerprint = await fingerprintFile(destination);
    const thumbFingerprint = await fingerprintFile(destinationThumbnail);

    if (
      mainFingerprint.size !== asset.size ||
      mainFingerprint.sha256 !== asset.hash ||
      thumbFingerprint.size !== asset.thumbnailSize
    ) {
      throw new TransferError('TRANSFER_ASSET_INVALID');
    }

    const completed = index + 1;

    if (completed === total || completed % step === 0) {
      options.onEvent?.({
        operation: 'import',
        phase: 'preparing',
        completed,
        total,
        warnings: options.warnings,
      });
    }
  }

  return { assetTempDir };
}

async function moveFile(source: string, destination: string): Promise<void> {
  try {
    await rename(source, destination);
  } catch (error) {
    if (!isCrossDeviceError(error)) {
      throw new TransferError('TRANSFER_SAVE_FAILED', { cause: error });
    }

    await copyFile(source, destination);
    await rm(source, { force: true });
  }
}

function isCrossDeviceError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EXDEV'
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new TransferError('TRANSFER_CANCELLED');
  }
}
