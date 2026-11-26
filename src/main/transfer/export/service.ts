/**
 * Exportación de un mundo a un ZIP verificable.
 *
 * Orquesta la instantánea de solo lectura, la construcción de `world.json`, la
 * lectura y verificación de assets, el manifiesto con checksums, la escritura
 * del ZIP en `.partial`, la verificación estructural releyendo el propio ZIP y
 * la publicación con `rename`. Si cualquier paso falla, el `.partial` se
 * elimina y el archivo de destino anterior queda intacto.
 *
 * No conoce Electron: se ejecuta en el utility process y también directamente
 * en las pruebas de integración.
 */
import { createHash } from 'node:crypto';
import { rm, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute } from 'node:path';

import type { WorldCraftDatabase } from '../../db/client';
import type { SqliteDatabase } from '../../db/connection';
import { generateUuidv7, isUuidV7 } from '../../db/ids';
import { resolveAssetFile } from '../../assets/paths';
import { ASSET_MAX_FILE_BYTES } from '../../assets/constants';
import {
  TRANSFER_MANIFEST_MAX_BYTES,
  type TransferEvent,
  type TransferExportResult,
  type TransferWarning,
} from '../../../shared/contracts/transfer';
import { publishArchive } from '../archive/publish';
import { createArchiveWriter, type ArchiveWriter } from '../archive/writer';
import {
  hashArchiveEntry,
  readArchiveEntry,
  readArchiveIndex,
  throwIfAborted,
  type ArchiveLimits,
} from '../archive/reader';
import {
  createManifest,
  parseManifestJson,
  serializeManifest,
  verifyManifestFileSet,
} from '../format/manifest';
import {
  parseWorldTransferJson,
  serializeWorldTransfer,
  verifyWorldAgainstManifest,
} from '../format/world';
import { buildTransferAssetPath } from '../format/paths';
import { toTransferError, TransferError } from '../errors';
import { silentTransferLogger, type TransferLogger } from '../logger';
import { assertFreeSpace, fingerprintFile, type FreeSpaceProbe } from '../fs';
import { TRANSFER_PARTIAL_SUFFIX } from '../constants';
import { buildWorldDataset } from './dataset';
import { readWorldSnapshot } from './snapshot';

/** Opciones de la exportación; todas las dependencias se inyectan. */
export interface ExportServiceOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly assetsDir: string;
  readonly worldId: string;
  readonly destinationFile: string;
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly now?: () => number;
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: TransferEvent) => void;
  readonly logger?: TransferLogger;
  /** Límites del lector; las pruebas los reducen. */
  readonly limits?: ArchiveLimits;
  /** Sonda de espacio inyectable para pruebas. */
  readonly readFreeSpace?: FreeSpaceProbe;
}

/** Exporta el mundo y devuelve el resultado listo para el renderer. */
export async function exportWorld(
  options: ExportServiceOptions,
): Promise<TransferExportResult> {
  const logger = options.logger ?? silentTransferLogger;
  const now = options.now ?? Date.now;
  // Un sufijo único evita borrar un `.partial` ajeno que ya existiera junto al
  // destino. Sigue siendo un archivo oculto/temporal en la misma unidad, de
  // modo que el `rename` final es atómico.
  const partialFile = `${options.destinationFile}.${generateUuidv7()}${TRANSFER_PARTIAL_SUFFIX}`;
  let writer: ArchiveWriter | null = null;
  let warnings: readonly TransferWarning[] = [];
  let phase: TransferEvent['phase'] = 'preparing';

  try {
    assertExportInput(options);
    throwIfAborted(options.signal);

    const parent = await stat(dirname(options.destinationFile)).catch(
      () => null,
    );

    if (parent === null || !parent.isDirectory()) {
      throw new TransferError('TRANSFER_DESTINATION_UNAVAILABLE');
    }

    const existingDestination = await stat(options.destinationFile).catch(
      () => null,
    );

    if (existingDestination !== null && !existingDestination.isFile()) {
      throw new TransferError('TRANSFER_DESTINATION_UNAVAILABLE');
    }

    const existingDestinationBytes = existingDestination?.size ?? 0;

    options.onEvent?.({
      operation: 'export',
      phase: 'preparing',
      completed: 0,
      total: null,
      warnings: 0,
    });

    const snapshot = readWorldSnapshot({
      database: options.database,
      sqlite: options.sqlite,
      worldId: options.worldId,
    });
    const dataset = buildWorldDataset(snapshot);
    warnings = dataset.warnings;
    throwIfAborted(options.signal);

    const assetRecords = new Map(
      snapshot.assets.map((asset) => [asset.id, asset]),
    );
    const assetFingerprints = new Map<string, string>();

    for (const asset of dataset.world.assets) {
      const record = assetRecords.get(asset.id);

      if (
        record === undefined ||
        record.kind !== 'image' ||
        record.mime !== 'image/webp' ||
        record.size < 0 ||
        record.size > ASSET_MAX_FILE_BYTES
      ) {
        throw new TransferError('TRANSFER_ASSET_INVALID');
      }

      const resolved = resolveAssetOrThrow(
        options.assetsDir,
        options.worldId,
        record,
      );
      const fingerprint = await fingerprintFile(resolved.absolutePath);

      if (
        fingerprint.size !== record.size ||
        fingerprint.sha256 !== record.hash
      ) {
        throw new TransferError('TRANSFER_ASSET_INVALID');
      }

      assetFingerprints.set(asset.id, fingerprint.sha256);
    }

    const worldText = serializeWorldTransfer(dataset.world);
    const worldBuffer = Buffer.from(worldText, 'utf8');
    const worldSha256 = sha256(worldBuffer);
    const files = [
      {
        path: 'world.json',
        size: worldBuffer.byteLength,
        sha256: worldSha256,
      },
      ...dataset.world.assets.map((asset) => ({
        path: buildTransferAssetPath(asset.id),
        size: assetRecords.get(asset.id)?.size ?? 0,
        sha256: assetFingerprints.get(asset.id) ?? '',
      })),
    ];

    const manifest = createManifest({
      schemaVersion: options.schemaVersion,
      appVersion: options.appVersion,
      exportedAt: new Date(now()).toISOString(),
      world: {
        sourceId: snapshot.world.id,
        name: snapshot.world.name,
        slug: snapshot.world.slug,
      },
      counts: dataset.counts,
      files,
      warnings,
    });
    const manifestBuffer = Buffer.from(serializeManifest(manifest), 'utf8');

    const totalSteps = dataset.world.assets.length + 2;
    let completed = 0;
    const totalOutputBytes =
      manifestBuffer.byteLength +
      worldBuffer.byteLength +
      dataset.world.assets.reduce(
        (total, asset) => total + (assetRecords.get(asset.id)?.size ?? 0),
        0,
      );

    await assertFreeSpace(
      dirname(options.destinationFile),
      totalOutputBytes + existingDestinationBytes,
      options.readFreeSpace,
    );

    phase = 'packaging';
    emit(options, phase, completed, totalSteps, warnings.length);

    writer = createArchiveWriter(partialFile, options.signal);
    writer.addBuffer('manifest.json', manifestBuffer, { compress: true });
    completed += 1;
    emit(options, phase, completed, totalSteps, warnings.length);
    writer.addBuffer('world.json', worldBuffer, { compress: true });
    completed += 1;
    emit(options, phase, completed, totalSteps, warnings.length);

    for (const asset of dataset.world.assets) {
      throwIfAborted(options.signal);
      const record = assetRecords.get(asset.id);

      if (record === undefined) {
        throw new TransferError('TRANSFER_ASSET_INVALID');
      }

      const resolved = resolveAssetOrThrow(
        options.assetsDir,
        options.worldId,
        record,
      );

      writer.addFile(buildTransferAssetPath(asset.id), resolved.absolutePath, {
        compress: false,
      });
      completed += 1;
      maybeEmit(options, phase, completed, totalSteps, warnings.length);
    }

    await writer.finalize();
    writer = null;
    throwIfAborted(options.signal);

    phase = 'finalizing';
    await verifyArchive({
      partialFile,
      options,
      warnings,
    });

    throwIfAborted(options.signal);
    phase = 'saving';
    emit(options, phase, 0, 1, warnings.length);

    await publishArchive(partialFile, options.destinationFile);
    emit(options, phase, 1, 1, warnings.length);

    const finalStats = await stat(options.destinationFile);

    logger.log({
      event: 'transfer.operation',
      operation: 'export',
      phase,
      outcome: 'completed',
      warnings: warnings.length,
    });

    return {
      worldId: snapshot.world.id,
      worldName: snapshot.world.name,
      fileName: basename(options.destinationFile),
      size: finalStats.size,
      counts: dataset.counts,
      warnings,
    };
  } catch (error) {
    await writer?.abort().catch(() => undefined);
    await rm(partialFile, { force: true }).catch(() => undefined);

    const transferError = toTransferError(error, 'TRANSFER_SAVE_FAILED');

    if (transferError.code === 'TRANSFER_CANCELLED') {
      logger.log({
        event: 'transfer.operation',
        operation: 'export',
        phase,
        outcome: 'cancelled',
        warnings: warnings.length,
      });
    } else {
      logger.log({
        event: 'transfer.operation',
        operation: 'export',
        phase,
        outcome: 'failed',
        code: transferError.code,
      });
    }

    throw transferError;
  }
}

interface VerifyArchiveInput {
  readonly partialFile: string;
  readonly options: ExportServiceOptions;
  readonly warnings: readonly TransferWarning[];
}

async function verifyArchive(input: VerifyArchiveInput): Promise<void> {
  const { options } = input;
  // La ratio protege contra ZIP bombs de terceros; verificar el ZIP que acaba
  // de escribir esta misma operación no debe rechazar un mundo legítimamente
  // muy comprimible.
  const verificationLimits = {
    ...options.limits,
    maxCompressionRatio: Number.POSITIVE_INFINITY,
  };
  const noRatioLimit = {
    maxCompressionRatio: Number.POSITIVE_INFINITY,
  };
  const index = await readArchiveIndex(
    input.partialFile,
    verificationLimits,
    options.signal,
  );
  const actual = new Map<string, number>();

  for (const entry of index.entries) {
    if (entry.parsed.kind !== 'manifest') {
      actual.set(entry.path, entry.uncompressedSize);
    }
  }

  const manifestBuffer = await readArchiveEntry(
    input.partialFile,
    'manifest.json',
    TRANSFER_MANIFEST_MAX_BYTES,
    options.signal,
    noRatioLimit,
  );
  const diskManifest = parseManifestJson(manifestBuffer.toString('utf8'));

  verifyManifestFileSet(diskManifest, actual);

  const worldFile = diskManifest.files.find(
    (file) => file.path === 'world.json',
  );

  if (worldFile === undefined) {
    throw new TransferError('TRANSFER_MANIFEST_INVALID');
  }

  const worldBuffer = await readArchiveEntry(
    input.partialFile,
    'world.json',
    worldFile.size,
    options.signal,
    noRatioLimit,
  );

  if (sha256(worldBuffer) !== worldFile.sha256) {
    throw new TransferError('TRANSFER_CHECKSUM_MISMATCH');
  }

  const world = parseWorldTransferJson(worldBuffer.toString('utf8'));
  verifyWorldAgainstManifest(world, diskManifest);

  const assetFiles = diskManifest.files.filter((file) =>
    file.path.startsWith('assets/'),
  );
  let completed = 1;

  emit(
    options,
    'finalizing',
    completed,
    assetFiles.length + 1,
    input.warnings.length,
  );

  for (const file of assetFiles) {
    const hash = await hashArchiveEntry(
      input.partialFile,
      file.path,
      file.size,
      options.signal,
      noRatioLimit,
    );

    if (hash !== file.sha256) {
      throw new TransferError('TRANSFER_CHECKSUM_MISMATCH');
    }

    completed += 1;
    maybeEmit(
      options,
      'finalizing',
      completed,
      assetFiles.length + 1,
      input.warnings.length,
    );
  }
}

function resolveAssetOrThrow(
  assetsDir: string,
  worldId: string,
  record: { readonly id: string; readonly relativePath: string },
): ReturnType<typeof resolveAssetFile> {
  try {
    return resolveAssetFile({
      assetsDir,
      relativePath: record.relativePath,
      worldId,
      assetId: record.id,
      variant: 'asset',
    });
  } catch (error) {
    throw new TransferError('TRANSFER_ASSET_INVALID', { cause: error });
  }
}

function assertExportInput(options: ExportServiceOptions): void {
  if (
    !isUuidV7(options.worldId) ||
    !isAbsolute(options.destinationFile) ||
    !isAbsolute(options.assetsDir) ||
    options.appVersion.length === 0 ||
    options.appVersion.length > 40 ||
    !Number.isInteger(options.schemaVersion) ||
    options.schemaVersion < 1
  ) {
    throw new TransferError('TRANSFER_INPUT_INVALID');
  }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function emit(
  options: ExportServiceOptions,
  phase: TransferEvent['phase'],
  completed: number,
  total: number | null,
  warnings: number,
): void {
  options.onEvent?.({
    operation: 'export',
    phase,
    completed,
    total,
    warnings,
  });
}

function maybeEmit(
  options: ExportServiceOptions,
  phase: TransferEvent['phase'],
  completed: number,
  total: number,
  warnings: number,
): void {
  const step = Math.max(1, Math.floor(total / 100));

  if (completed === total || completed % step === 0) {
    emit(options, phase, completed, total, warnings);
  }
}
