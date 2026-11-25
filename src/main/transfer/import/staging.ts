/**
 * Preparación segura de una importación.
 *
 * Se ejecuta en el utility process (y directamente en las pruebas). Valida el
 * ZIP, el manifiesto y `world.json`, comprueba checksums y extrae los assets a
 * `imports/.tmp/<operationId>`. Cada asset se detecta por magic bytes, se
 * procesa con sharp con los mismos límites que la importación de imágenes y se
 * guarda como WebP canónico con su miniatura.
 *
 * No toca SQLite ni el directorio definitivo de assets. Un fallo o una
 * cancelación eliminan la carpeta temporal completa.
 */
import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  TRANSFER_MANIFEST_MAX_BYTES,
  TRANSFER_MAX_UNCOMPRESSED_BYTES,
  TRANSFER_WORLD_JSON_MAX_BYTES,
  type TransferEvent,
} from '../../../shared/contracts/transfer';
import { isUuidV7 } from '../../db/ids';
import {
  detectImageFormat,
  processImage,
  type ProcessedImage,
} from '../../assets/image';
import { toAssetError } from '../../assets/errors';
import {
  extractArchiveEntry,
  readArchiveEntry,
  readArchiveIndex,
  throwIfAborted,
  type ArchiveLimits,
} from '../archive/reader';
import {
  TRANSFER_PLAN_MAX_BYTES,
  TRANSFER_THUMBNAIL_RESERVE_BYTES,
} from '../constants';
import { TransferError, toTransferError } from '../errors';
import { assertFreeSpace, type FreeSpaceProbe } from '../fs';
import {
  parseManifestJson,
  verifyManifestFileSet,
  type TransferManifest,
} from '../format/manifest';
import {
  parseWorldTransferJson,
  verifyWorldAgainstManifest,
  type WorldTransfer,
} from '../format/world';
import { buildTransferAssetPath } from '../format/paths';
import {
  assertTransferDirectoryInside,
  assertTransferRootDirectory,
  inspectTransferDirectory,
  removeDirectoryIfSafe,
} from '../safe-paths';

/** Asset extraído y procesado en la carpeta temporal. */
export interface StagedAsset {
  /** ID del asset en el paquete de origen. */
  readonly sourceId: string;
  readonly assetFile: string;
  readonly thumbnailFile: string;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly hash: string;
  readonly thumbnailSize: number;
  readonly alt: string | null;
  readonly createdAt: number;
}

/** Resultado del staging. */
export interface StagedImport {
  readonly operationId: string;
  readonly stagingDir: string;
  readonly assetsDir: string;
  readonly manifest: TransferManifest;
  readonly world: WorldTransfer;
  readonly assets: readonly StagedAsset[];
  readonly totalAssetBytes: number;
}

/** Opciones del staging. */
export interface StagingOptions {
  readonly operationId: string;
  readonly archiveFile: string;
  readonly importsDir: string;
  /** Versión `user_version` que usa la aplicación instalada. */
  readonly schemaVersion: number;
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: TransferEvent) => void;
  readonly limits?: ArchiveLimits;
  /** Sonda de espacio inyectable para pruebas; en producción usa `statfs`. */
  readonly readFreeSpace?: FreeSpaceProbe;
}

/** Prepara una importación completa sin escribir en la base ni en assets. */
export async function stageImport(
  options: StagingOptions,
): Promise<StagedImport> {
  if (
    !isUuidV7(options.operationId) ||
    !Number.isInteger(options.schemaVersion) ||
    options.schemaVersion < 1
  ) {
    throw new TransferError('TRANSFER_INPUT_INVALID');
  }

  const importsRoot = resolve(options.importsDir);
  const importsTempRoot = resolve(importsRoot, '.tmp');
  const stagingDir = resolve(importsTempRoot, options.operationId);
  const assetsDir = join(stagingDir, 'assets');

  assertTransferRootDirectory(importsRoot, { create: true });
  assertTransferDirectoryInside(importsRoot, importsTempRoot, {
    create: true,
  });

  const stagingState = inspectTransferDirectory(importsTempRoot, stagingDir);

  if (stagingState.state !== 'missing' && stagingState.state !== 'directory') {
    throw new TransferError('TRANSFER_INPUT_INVALID');
  }

  try {
    await rm(stagingDir, { recursive: true, force: true });
    assertTransferDirectoryInside(importsTempRoot, stagingDir, {
      create: true,
    });
    assertTransferDirectoryInside(stagingDir, assetsDir, { create: true });

    emit(options, 'reading', 0, null);

    const index = await readArchiveIndex(
      options.archiveFile,
      options.limits ?? {},
      options.signal,
    );

    const manifestEntry = index.entries.find(
      (entry) => entry.parsed.kind === 'manifest',
    );

    if (manifestEntry === undefined) {
      throw new TransferError('TRANSFER_MANIFEST_INVALID');
    }

    if (manifestEntry.uncompressedSize > TRANSFER_MANIFEST_MAX_BYTES) {
      throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
    }

    emit(options, 'validating', 0, 2);

    const manifestBuffer = await readArchiveEntry(
      options.archiveFile,
      'manifest.json',
      TRANSFER_MANIFEST_MAX_BYTES,
      options.signal,
    );
    const manifest = parseManifestJson(manifestBuffer.toString('utf8'));

    if (manifest.schemaVersion > options.schemaVersion) {
      throw new TransferError('TRANSFER_FORMAT_UNSUPPORTED');
    }

    const worldEntry = index.entries.find(
      (entry) => entry.parsed.kind === 'world',
    );

    if (worldEntry === undefined) {
      throw new TransferError('TRANSFER_MANIFEST_INVALID');
    }

    if (worldEntry.uncompressedSize > TRANSFER_WORLD_JSON_MAX_BYTES) {
      throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
    }

    const worldBuffer = await readArchiveEntry(
      options.archiveFile,
      'world.json',
      worldEntry.uncompressedSize,
      options.signal,
    );
    const worldFile = manifest.files.find((file) => file.path === 'world.json');

    if (worldFile === undefined) {
      throw new TransferError('TRANSFER_MANIFEST_INVALID');
    }

    const worldSha256 = createHash('sha256').update(worldBuffer).digest('hex');

    if (
      worldBuffer.byteLength !== worldFile.size ||
      worldSha256 !== worldFile.sha256
    ) {
      throw new TransferError('TRANSFER_CHECKSUM_MISMATCH');
    }

    const world = parseWorldTransferJson(worldBuffer.toString('utf8'));

    emit(options, 'validating', 1, 2);
    verifyWorldAgainstManifest(world, manifest);

    const actual = new Map<string, number>();

    for (const entry of index.entries) {
      if (entry.parsed.kind !== 'manifest') {
        actual.set(entry.path, entry.uncompressedSize);
      }
    }

    verifyManifestFileSet(manifest, actual);
    emit(options, 'validating', 2, 2);

    const expectedAssetPaths = new Set(
      world.assets.map((asset) => buildTransferAssetPath(asset.id)),
    );
    const manifestAssetPaths = new Set(
      manifest.files
        .filter((file) => file.path.startsWith('assets/'))
        .map((file) => file.path),
    );

    if (
      expectedAssetPaths.size !== manifestAssetPaths.size ||
      [...expectedAssetPaths].some((path) => !manifestAssetPaths.has(path))
    ) {
      throw new TransferError('TRANSFER_MANIFEST_INVALID');
    }

    const manifestFiles = new Map(
      manifest.files.map((file) => [file.path, file]),
    );
    const stagedAssets: StagedAsset[] = [];
    let totalAssetBytes = 0;
    let totalExtractedBytes =
      manifestBuffer.byteLength + worldBuffer.byteLength;

    // Antes de extraer se reserva el contenido declarado, una estimación de
    // miniaturas y un plan proporcional al mundo (no siempre su máximo). La
    // sonda es inyectable en pruebas.
    const planReserve = Math.min(
      TRANSFER_PLAN_MAX_BYTES,
      worldBuffer.byteLength * 2,
    );

    await assertFreeSpace(
      importsTempRoot,
      index.totalUncompressedBytes +
        world.assets.length * TRANSFER_THUMBNAIL_RESERVE_BYTES +
        planReserve,
      options.readFreeSpace,
    );

    emit(options, 'extracting', 0, world.assets.length);

    for (const [position, asset] of world.assets.entries()) {
      throwIfAborted(options.signal);

      const assetPath = buildTransferAssetPath(asset.id);
      const manifestFile = manifestFiles.get(assetPath);

      if (manifestFile === undefined) {
        throw new TransferError('TRANSFER_MANIFEST_INVALID');
      }

      assertTransferDirectoryInside(stagingDir, assetsDir);
      const extractedFile = join(assetsDir, `${asset.id}.webp`);
      const extracted = await extractArchiveEntry(
        options.archiveFile,
        assetPath,
        extractedFile,
        manifestFile.size,
        options.signal,
      );

      totalExtractedBytes += extracted.size;

      if (totalExtractedBytes > TRANSFER_MAX_UNCOMPRESSED_BYTES) {
        throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
      }

      if (
        extracted.size !== manifestFile.size ||
        extracted.sha256 !== manifestFile.sha256
      ) {
        throw new TransferError('TRANSFER_CHECKSUM_MISMATCH');
      }

      const raw = await readFile(extractedFile);

      if (detectImageFormat(raw) !== 'webp') {
        throw new TransferError('TRANSFER_ASSET_INVALID');
      }

      let processed: ProcessedImage;

      try {
        processed = await processImage(raw);
      } catch (error) {
        throw toTransferError(
          toAssetError(error, 'ASSET_IMAGE_INVALID'),
          'TRANSFER_ASSET_INVALID',
        );
      }

      await writeFile(extractedFile, processed.data);
      const thumbnailFile = join(assetsDir, `${asset.id}.thumb.webp`);
      await writeFile(thumbnailFile, processed.thumbnail.data);

      totalAssetBytes += processed.size + processed.thumbnail.size;
      stagedAssets.push({
        sourceId: asset.id,
        assetFile: extractedFile,
        thumbnailFile,
        width: processed.width,
        height: processed.height,
        size: processed.size,
        hash: processed.hash,
        thumbnailSize: processed.thumbnail.size,
        alt: asset.alt,
        createdAt: asset.createdAt,
      });

      emit(options, 'extracting', position + 1, world.assets.length);
    }

    throwIfAborted(options.signal);

    return {
      operationId: options.operationId,
      stagingDir,
      assetsDir,
      manifest,
      world,
      assets: stagedAssets,
      totalAssetBytes,
    };
  } catch (error) {
    await removeDirectoryIfSafe(importsTempRoot, stagingDir);
    throw toTransferError(error, 'TRANSFER_SOURCE_UNREADABLE');
  }
}

function emit(
  options: StagingOptions,
  phase: TransferEvent['phase'],
  completed: number,
  total: number | null,
  warnings = 0,
): void {
  options.onEvent?.({
    operation: 'import',
    phase,
    completed,
    total,
    warnings,
  });
}
