/**
 * Exportación total de la biblioteca (`world-craft-library` v1).
 *
 * Recibe un destino ya elegido por el diálogo (S6), produce un staging en
 * `exports/.tmp/<operationId>/`, exporta cada mundo con el servicio de #78,
 * crea una copia completa y verificada de SQLite, escribe `settings.json` sin
 * `lastView`/`recentLocation` y publica el ZIP externo de forma atómica.
 *
 * Todo-o-nada: si un mundo falla, no se publica nada y el staging se elimina.
 * Los resultados de dominio nunca contienen rutas; `fileName` es un basename.
 */
import { createHash } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

import type { WorldCraftDatabase } from '../../db/client';
import type { SqliteDatabase } from '../../db/connection';
import { generateUuidv7, isUuidV7 } from '../../db/ids';
import type { PreferencesService } from '../../preferences/service';
import type { WorldsService } from '../../worlds/service';
import type { WorldSummary } from '../../../shared/contracts/worlds';
import type { DataLibraryResult } from '../../../shared/contracts/data';
import type {
  TransferCounts,
  TransferWarning,
} from '../../../shared/contracts/transfer';
import { exportWorld } from '../../transfer/export/service';
import { TRANSFER_PARTIAL_SUFFIX } from '../../transfer/constants';
import {
  readArchiveEntry,
  throwIfAborted,
} from '../../transfer/archive/reader';
import { publishArchive } from '../../transfer/archive/publish';
import {
  createArchiveWriter,
  type ArchiveWriter,
} from '../../transfer/archive/writer';
import {
  assertFreeSpace,
  fingerprintFile,
  type FreeSpaceProbe,
} from '../../transfer/fs';
import { isCancellationError } from '../../transfer/errors';
import { TRANSFER_MANIFEST_FILE } from '../../transfer/constants';
import { TRANSFER_MANIFEST_MAX_BYTES } from '../../../shared/contracts/transfer';
import { parseManifestJson } from '../../transfer/format/manifest';
import {
  assertTransferDirectoryInside,
  assertTransferRootDirectory,
  removeDirectoryIfSafe,
} from '../../transfer/safe-paths';
import type { ArchiveLimits } from '../../transfer/archive/reader';
import type { DataErrorCode } from '../constants';
import { DataError } from '../errors';
import {
  LIBRARY_DATABASE_FILE,
  LIBRARY_DATABASE_PATH,
  LIBRARY_MANIFEST_FILE,
  LIBRARY_SETTINGS_FILE,
  LIBRARY_SETTINGS_MAX_BYTES,
  LIBRARY_WORLDS_DIR,
} from './constants';
import { createLibraryDatabaseSnapshot } from './database';
import { toLibraryError } from './errors';
import {
  createLibraryManifest,
  mergeWarnings,
  serializeLibraryManifest,
  sumCounts,
} from './manifest';
import { buildLibraryWorldPath, parseLibraryEntryPath } from './paths';
import { createLibrarySettings, serializeLibrarySettings } from './settings';
import { verifyLibraryArchive } from './verify';

/** Resultado de exportar toda la biblioteca. */
export type LibraryExportResult = DataLibraryResult;

/** Dependencias del orquestador; todas se inyectan desde composición. */
export interface ExportAllOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly exportsTempDir: string;
  readonly assetsDir: string;
  readonly destinationFile: string;
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly worlds: Pick<WorldsService, 'list'>;
  readonly preferences: Pick<PreferencesService, 'get'>;
  readonly now?: () => number;
  readonly signal?: AbortSignal;
  readonly readFreeSpace?: FreeSpaceProbe;
  readonly generateOperationId?: () => string;
  readonly limits?: ArchiveLimits;
  /** Solo para pruebas de fallo a mitad; en producción es `exportWorld`. */
  readonly exportWorldFile?: typeof exportWorld;
}

interface WorldStage {
  readonly slug: string;
  readonly name: string;
  readonly path: string;
  readonly file: string;
  readonly size: number;
  readonly sha256: string;
  readonly counts: TransferCounts;
  readonly warnings: readonly TransferWarning[];
}

/**
 * Exporta una biblioteca completa y devuelve un resultado de dominio.
 *
 * No lanza por fallos esperados: cancelación y error se devuelven como estado
 * para que el IPC de S6 no degrade el código estable.
 */
export async function exportAll(
  options: ExportAllOptions,
): Promise<LibraryExportResult> {
  let fallback: DataErrorCode = 'DATA_LIBRARY_INPUT_INVALID';
  let writer: ArchiveWriter | null = null;
  const partialFile = `${options.destinationFile}.${generateUuidv7()}${TRANSFER_PARTIAL_SUFFIX}`;
  let stagingRoot: string | null = null;
  let exportsTempRoot: string | null = null;

  try {
    const now = options.now ?? Date.now;
    const exportWorldFile = options.exportWorldFile ?? exportWorld;
    const operationId = (options.generateOperationId ?? generateUuidv7)();

    validateInput(options, operationId);

    const destinationParent = await stat(
      dirname(options.destinationFile),
    ).catch(() => null);

    if (destinationParent === null || !destinationParent.isDirectory()) {
      throw new DataError('DATA_LIBRARY_DESTINATION_UNAVAILABLE');
    }

    const existingDestination = await stat(options.destinationFile).catch(
      () => null,
    );

    if (existingDestination !== null && !existingDestination.isFile()) {
      throw new DataError('DATA_LIBRARY_DESTINATION_UNAVAILABLE');
    }

    const existingBytes = existingDestination?.size ?? 0;

    throwIfAborted(options.signal);

    fallback = 'DATA_LIBRARY_WORLD_FAILED';
    const worldList = readWorldList(options.worlds);
    const worldPaths = planWorldPaths(worldList);

    fallback = 'DATA_LIBRARY_CREATE_FAILED';
    exportsTempRoot = resolve(options.exportsTempDir);
    assertTransferRootDirectory(exportsTempRoot, { create: true });
    stagingRoot = resolve(exportsTempRoot, operationId);
    await removeDirectoryIfSafe(exportsTempRoot, stagingRoot);
    assertTransferDirectoryInside(exportsTempRoot, stagingRoot, {
      create: true,
    });

    const worldsDir = join(stagingRoot, LIBRARY_WORLDS_DIR);
    const databaseDir = join(stagingRoot, 'database');

    await mkdir(worldsDir, { recursive: true });
    await mkdir(databaseDir, { recursive: true });

    throwIfAborted(options.signal);

    fallback = 'DATA_LIBRARY_DATABASE_FAILED';
    const databaseSnapshot = await createLibraryDatabaseSnapshot({
      sqlite: options.sqlite,
      temporaryFile: join(databaseDir, `${LIBRARY_DATABASE_FILE}.tmp`),
      finalFile: join(databaseDir, LIBRARY_DATABASE_FILE),
      schemaVersion: options.schemaVersion,
    });

    throwIfAborted(options.signal);

    const settings = createLibrarySettings(options.preferences.get());
    const settingsBuffer = Buffer.from(
      serializeLibrarySettings(settings),
      'utf8',
    );

    if (settingsBuffer.byteLength > LIBRARY_SETTINGS_MAX_BYTES) {
      throw new DataError('DATA_LIBRARY_SETTINGS_INVALID');
    }

    const settingsSha256 = sha256(settingsBuffer);
    const worldStages: WorldStage[] = [];

    fallback = 'DATA_LIBRARY_WORLD_FAILED';

    for (const world of worldList) {
      throwIfAborted(options.signal);

      const path = worldPaths.get(world.slug);

      if (path === undefined) {
        throw new DataError('DATA_LIBRARY_ENTRY_INVALID');
      }

      const worldFile = join(stagingRoot, ...path.split('/'));

      await exportWorldFile({
        database: options.database,
        sqlite: options.sqlite,
        assetsDir: options.assetsDir,
        worldId: world.id,
        destinationFile: worldFile,
        appVersion: options.appVersion,
        schemaVersion: options.schemaVersion,
        now,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(options.limits === undefined ? {} : { limits: options.limits }),
        ...(options.readFreeSpace === undefined
          ? {}
          : { readFreeSpace: options.readFreeSpace }),
      });

      const worldManifestBuffer = await readArchiveEntry(
        worldFile,
        TRANSFER_MANIFEST_FILE,
        TRANSFER_MANIFEST_MAX_BYTES,
        options.signal,
        { maxCompressionRatio: Number.POSITIVE_INFINITY },
      );
      const worldManifest = parseManifestJson(
        worldManifestBuffer.toString('utf8'),
      );

      if (
        worldManifest.world.slug !== world.slug ||
        worldManifest.world.name !== world.name
      ) {
        throw new DataError('DATA_LIBRARY_WORLD_FAILED');
      }

      const fingerprint = await fingerprintFile(worldFile);

      worldStages.push({
        slug: world.slug,
        name: world.name,
        path,
        file: worldFile,
        size: fingerprint.size,
        sha256: fingerprint.sha256,
        counts: worldManifest.counts,
        warnings: worldManifest.warnings,
      });
    }

    const counts = sumCounts(worldStages.map((world) => world.counts));
    const warnings = mergeWarnings(worldStages.map((world) => world.warnings));
    const manifest = createLibraryManifest({
      schemaVersion: options.schemaVersion,
      appVersion: options.appVersion,
      exportedAt: new Date(now()).toISOString(),
      database: {
        size: databaseSnapshot.size,
        sha256: databaseSnapshot.sha256,
        schemaVersion: options.schemaVersion,
      },
      settings: {
        size: settingsBuffer.byteLength,
        sha256: settingsSha256,
      },
      worlds: worldStages.map((world) => ({
        slug: world.slug,
        name: world.name,
        size: world.size,
        sha256: world.sha256,
        counts: world.counts,
        warnings: world.warnings,
      })),
      counts,
      warnings,
    });
    const manifestBuffer = Buffer.from(
      serializeLibraryManifest(manifest),
      'utf8',
    );
    const totalOutputBytes =
      manifestBuffer.byteLength +
      settingsBuffer.byteLength +
      databaseSnapshot.size +
      worldStages.reduce((total, world) => total + world.size, 0);

    fallback = 'DATA_LIBRARY_NO_SPACE';
    await assertFreeSpace(
      dirname(options.destinationFile),
      totalOutputBytes + existingBytes,
      options.readFreeSpace,
    );

    fallback = 'DATA_LIBRARY_CREATE_FAILED';
    writer = createArchiveWriter(partialFile, options.signal, {
      parsePath: parseLibraryEntryPath,
    });
    writer.addBuffer(LIBRARY_MANIFEST_FILE, manifestBuffer, {
      compress: true,
    });
    writer.addBuffer(LIBRARY_SETTINGS_FILE, settingsBuffer, {
      compress: true,
    });
    writer.addFile(LIBRARY_DATABASE_PATH, databaseSnapshot.file, {
      compress: false,
    });

    for (const world of worldStages) {
      writer.addFile(world.path, world.file, { compress: false });
    }

    await writer.finalize();
    writer = null;
    throwIfAborted(options.signal);

    fallback = 'DATA_LIBRARY_VERIFY_FAILED';
    await verifyLibraryArchive({
      file: partialFile,
      stagedDatabaseFile: databaseSnapshot.file,
      stagedWorldFiles: new Map(
        worldStages.map((world) => [world.path, world.file]),
      ),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });

    throwIfAborted(options.signal);

    fallback = 'DATA_LIBRARY_CREATE_FAILED';
    await publishArchive(partialFile, options.destinationFile);

    const finalStats = await stat(options.destinationFile);

    return {
      status: 'completed',
      fileName: basename(options.destinationFile),
      size: finalStats.size,
      worlds: worldStages.length,
      counts,
      warnings,
    };
  } catch (error) {
    await writer?.abort().catch(() => undefined);
    await rm(partialFile, { force: true }).catch(() => undefined);

    if (isCancellationError(error)) {
      return { status: 'cancelled' };
    }

    return {
      status: 'failed',
      code: toLibraryError(error, fallback).code,
    };
  } finally {
    if (stagingRoot !== null && exportsTempRoot !== null) {
      await removeDirectoryIfSafe(exportsTempRoot, stagingRoot);
    }
  }
}

function validateInput(options: ExportAllOptions, operationId: string): void {
  if (
    !isUuidV7(operationId) ||
    !isAbsolute(options.destinationFile) ||
    options.destinationFile.includes('\0') ||
    !isAbsolute(options.exportsTempDir) ||
    !isAbsolute(options.assetsDir) ||
    options.appVersion.length === 0 ||
    options.appVersion.length > 40 ||
    !Number.isInteger(options.schemaVersion) ||
    options.schemaVersion < 1
  ) {
    throw new DataError('DATA_LIBRARY_INPUT_INVALID');
  }

  try {
    parseLibraryEntryPath(LIBRARY_MANIFEST_FILE);
  } catch (error) {
    throw toLibraryError(error, 'DATA_LIBRARY_INPUT_INVALID');
  }
}

function readWorldList(
  worlds: Pick<WorldsService, 'list'>,
): readonly WorldSummary[] {
  try {
    return worlds.list();
  } catch (error) {
    throw toLibraryError(error, 'DATA_LIBRARY_WORLD_FAILED');
  }
}

/**
 * Calcula las rutas de los mundos y rechaza colisiones antes de escribir.
 *
 * La base ya impide slugs duplicados, pero el servicio no confía en una lista
 * inyectada: una colisión debe fallar sin crear staging ni destino.
 */
function planWorldPaths(
  worlds: readonly WorldSummary[],
): ReadonlyMap<string, string> {
  const paths = new Map<string, string>();
  const seen = new Set<string>();

  for (const world of worlds) {
    let path: string;

    try {
      path = buildLibraryWorldPath(world.slug);
    } catch (error) {
      throw toLibraryError(error, 'DATA_LIBRARY_ENTRY_INVALID');
    }

    const key = path.toLowerCase();

    if (seen.has(key)) {
      throw new DataError('DATA_LIBRARY_ENTRY_INVALID');
    }

    seen.add(key);
    paths.set(world.slug, path);
  }

  return paths;
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
