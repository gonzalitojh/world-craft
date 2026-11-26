/**
 * Verificación posterior del ZIP externo de la biblioteca.
 *
 * Lee el índice central una sola vez, exige el conjunto exacto de entradas y
 * comprueba tamaños y hashes de `settings.json`, la base y cada mundo. Los
 * paquetes internos se leen desde el staging ya verificado para comprobar que
 * sus recuentos y avisos coinciden con el manifiesto externo.
 */
import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';

import { computeFileSha256, inspectBackupFile } from '../../backup/verify';
import {
  hashArchiveEntry,
  readArchiveEntry,
} from '../../transfer/archive/reader';
import { TRANSFER_MANIFEST_FILE } from '../../transfer/constants';
import { TRANSFER_MANIFEST_MAX_BYTES } from '../../../shared/contracts/transfer';
import { parseManifestJson } from '../../transfer/format/manifest';
import {
  mergeWarnings,
  parseLibraryManifestJson,
  sumCounts,
  verifyLibraryFileSet,
  type LibraryManifest,
} from './manifest';
import { readLibraryArchiveIndex } from './archive';
import { parseLibrarySettingsJson } from './settings';
import { DataError } from '../errors';
import { toLibraryError } from './errors';

/** Dependencias de la verificación. */
export interface VerifyLibraryArchiveOptions {
  readonly file: string;
  readonly stagedDatabaseFile: string;
  /** Ruta del paquete de mundo dentro de la biblioteca → archivo en staging. */
  readonly stagedWorldFiles: ReadonlyMap<string, string>;
  readonly signal?: AbortSignal;
}

/**
 * Verifica la biblioteca y devuelve el manifiesto leído del propio archivo.
 *
 * Cualquier discrepancia lanza un `DataError` con código de verificación; el
 * mensaje nunca contiene rutas, hashes ni nombres.
 */
export async function verifyLibraryArchive(
  options: VerifyLibraryArchiveOptions,
): Promise<LibraryManifest> {
  try {
    const index = await readLibraryArchiveIndex(
      options.file,
      { maxCompressionRatio: Number.POSITIVE_INFINITY },
      options.signal,
    );
    const manifestEntries = index.entries.filter(
      (entry) => entry.parsed.kind === 'manifest',
    );
    const settingsEntries = index.entries.filter(
      (entry) => entry.parsed.kind === 'settings',
    );
    const databaseEntries = index.entries.filter(
      (entry) => entry.parsed.kind === 'database',
    );

    if (
      manifestEntries.length !== 1 ||
      settingsEntries.length !== 1 ||
      databaseEntries.length !== 1
    ) {
      throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
    }

    const manifestEntry = manifestEntries[0];

    if (manifestEntry === undefined) {
      throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
    }

    const manifestBuffer = await readArchiveEntry(
      options.file,
      manifestEntry.path,
      manifestEntry.uncompressedSize,
      options.signal,
      { maxCompressionRatio: Number.POSITIVE_INFINITY },
    );
    const manifest = parseLibraryManifestJson(manifestBuffer.toString('utf8'));
    const actual = new Map<string, number>();

    for (const entry of index.entries) {
      if (entry.parsed.kind !== 'manifest') {
        actual.set(entry.path, entry.uncompressedSize);
      }
    }

    verifyLibraryFileSet(manifest, actual);

    const settingsBuffer = await readArchiveEntry(
      options.file,
      manifest.settings.path,
      manifest.settings.size,
      options.signal,
      { maxCompressionRatio: Number.POSITIVE_INFINITY },
    );

    if (
      settingsBuffer.byteLength !== manifest.settings.size ||
      sha256(settingsBuffer) !== manifest.settings.sha256
    ) {
      throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
    }

    parseLibrarySettingsJson(settingsBuffer.toString('utf8'));

    const databaseHash = await hashArchiveEntry(
      options.file,
      manifest.database.path,
      manifest.database.size,
      options.signal,
      { maxCompressionRatio: Number.POSITIVE_INFINITY },
    );

    if (databaseHash !== manifest.database.sha256) {
      throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
    }

    const stagedDatabase = await stat(options.stagedDatabaseFile).catch(
      () => null,
    );

    if (
      stagedDatabase === null ||
      stagedDatabase.size !== manifest.database.size ||
      (await computeFileSha256(options.stagedDatabaseFile)) !==
        manifest.database.sha256 ||
      inspectBackupFile(
        options.stagedDatabaseFile,
        manifest.schemaVersion,
        manifest.schemaVersion,
      ) !== 'ok'
    ) {
      throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
    }

    for (const world of manifest.worlds) {
      const worldHash = await hashArchiveEntry(
        options.file,
        world.path,
        world.size,
        options.signal,
        { maxCompressionRatio: Number.POSITIVE_INFINITY },
      );
      const staged = options.stagedWorldFiles.get(world.path);
      const stagedStats =
        staged === undefined ? null : await stat(staged).catch(() => null);

      if (
        worldHash !== world.sha256 ||
        staged === undefined ||
        stagedStats === null ||
        stagedStats.size !== world.size ||
        (await computeFileSha256(staged)) !== world.sha256
      ) {
        throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
      }

      const worldManifestBuffer = await readArchiveEntry(
        staged,
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
        worldManifest.world.name !== world.name ||
        !countsEqual(worldManifest.counts, world.counts) ||
        !warningsEqual(worldManifest.warnings, world.warnings)
      ) {
        throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
      }
    }

    if (
      !countsEqual(
        manifest.counts,
        sumCounts(manifest.worlds.map((world) => world.counts)),
      ) ||
      !warningsEqual(
        manifest.warnings,
        mergeWarnings(manifest.worlds.map((world) => world.warnings)),
      )
    ) {
      throw new DataError('DATA_LIBRARY_VERIFY_FAILED');
    }

    return manifest;
  } catch (error) {
    throw toLibraryError(error, 'DATA_LIBRARY_VERIFY_FAILED');
  }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function countsEqual(
  left: {
    readonly entities: number;
    readonly entityTypes: number;
    readonly relationTypes: number;
    readonly tags: number;
    readonly relations: number;
    readonly versions: number;
    readonly assets: number;
  },
  right: {
    readonly entities: number;
    readonly entityTypes: number;
    readonly relationTypes: number;
    readonly tags: number;
    readonly relations: number;
    readonly versions: number;
    readonly assets: number;
  },
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

function warningsEqual(
  left: readonly { readonly code: string; readonly count: number }[],
  right: readonly { readonly code: string; readonly count: number }[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
