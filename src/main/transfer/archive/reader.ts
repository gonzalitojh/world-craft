/**
 * Lector de ZIP basado en `yauzl`.
 *
 * El formato es una lista blanca: solo `manifest.json`, `world.json` y
 * `assets/<uuidv7>.webp`. Antes de extraer nada se recorre el directorio
 * central y se rechazan rutas peligrosas, enlaces, cifrado, compresión no
 * admitida, duplicados, exceso de entradas y tamaños declarados abusivos.
 * Durante la extracción se vuelven a contar los bytes reales, de modo que un
 * ZIP malicioso no puede mentir sobre el tamaño.
 *
 * Cada entrada se lee con su propio stream y se valida el CRC de yauzl. Nunca
 * se escribe en una ruta derivada del nombre de la entrada: el llamador elige
 * un destino validado y aquí se abre con `wx`, sin seguir enlaces.
 */
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { lstat, rm } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import yauzl, { type Entry, type ZipFile } from 'yauzl';

import {
  TRANSFER_MAX_ASSETS,
  TRANSFER_MAX_ENTRIES,
  TRANSFER_MAX_UNCOMPRESSED_BYTES,
  TRANSFER_MAX_ZIP_BYTES,
  TRANSFER_MANIFEST_MAX_BYTES,
  TRANSFER_WORLD_JSON_MAX_BYTES,
} from '../../../shared/contracts/transfer';
import { ASSET_MAX_FILE_BYTES } from '../../assets/constants';
import { TRANSFER_MAX_COMPRESSION_RATIO } from '../constants';
import { TransferError } from '../errors';
import {
  parseTransferEntryPath,
  type ParsedTransferEntry,
} from '../format/paths';

/** Límites del lector; las pruebas los reducen para ser rápidas. */
export interface ArchiveLimits {
  readonly maxZipBytes?: number;
  readonly maxUncompressedBytes?: number;
  readonly maxEntries?: number;
  readonly maxManifestBytes?: number;
  readonly maxWorldBytes?: number;
  readonly maxAssetBytes?: number;
  readonly maxCompressionRatio?: number;
}

/** Opciones de una lectura directa de entrada. */
export interface ArchiveReadOptions {
  /** `Infinity` desactiva el límite para verificar una exportación propia. */
  readonly maxCompressionRatio?: number;
}

/** Entrada validada del índice central. */
export interface ArchiveEntry<T = ParsedTransferEntry> {
  readonly path: string;
  readonly parsed: T;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly crc32: number;
}

/** Índice de un ZIP ya validado. */
export interface ArchiveIndex<T = ParsedTransferEntry> {
  readonly fileSize: number;
  readonly entries: readonly ArchiveEntry<T>[];
  readonly entriesByPath: ReadonlyMap<string, ArchiveEntry<T>>;
  readonly totalUncompressedBytes: number;
}

/** Política de nombres y límites por tipo para un índice genérico. */
export interface ArchiveEntryPolicy<T extends { readonly kind: string }> {
  readonly parsePath: (path: string) => T;
  /** Límite de tamaño sin comprimir por tipo de entrada. */
  readonly maxBytesByKind?: Readonly<Record<string, number>>;
}

/** Resultado de extraer una entrada a disco. */
export interface ExtractedEntry {
  readonly size: number;
  readonly sha256: string;
}

const OPEN_OPTIONS = {
  autoClose: false,
  lazyEntries: true,
  decodeStrings: true,
  validateEntrySizes: true,
  strictFileNames: true,
} as const;

/**
 * Abre un ZIP y valida su índice central para el formato de un mundo.
 *
 * Es un envoltorio del núcleo genérico: aplica la lista blanca de
 * `world-craft-world` y exige exactamente un manifiesto y un `world.json`.
 */
export async function readArchiveIndex(
  filePath: string,
  limits: ArchiveLimits = {},
  signal?: AbortSignal,
): Promise<ArchiveIndex> {
  const index = await readArchiveIndexWithPolicy(
    filePath,
    {
      parsePath: parseTransferEntryPath,
      maxBytesByKind: {
        manifest: limits.maxManifestBytes ?? TRANSFER_MANIFEST_MAX_BYTES,
        world: limits.maxWorldBytes ?? TRANSFER_WORLD_JSON_MAX_BYTES,
        asset: limits.maxAssetBytes ?? ASSET_MAX_FILE_BYTES,
      },
    },
    limits,
    signal,
  );
  const counts = countKinds(index.entries);

  if (counts.manifest !== 1 || counts.world !== 1) {
    throw new TransferError('TRANSFER_MANIFEST_INVALID');
  }

  if ((counts.asset ?? 0) > TRANSFER_MAX_ASSETS) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  return index;
}

/**
 * Núcleo genérico del índice central.
 *
 * Valida límites, compresión, duplicados y tamaños máximos por tipo. No impone
 * el conjunto de entradas: cada formato lo comprueba en su envoltorio o en su
 * verificación posterior.
 */
export async function readArchiveIndexWithPolicy<
  T extends { readonly kind: string },
>(
  filePath: string,
  policy: ArchiveEntryPolicy<T>,
  limits: ArchiveLimits = {},
  signal?: AbortSignal,
): Promise<ArchiveIndex<T>> {
  throwIfAborted(signal);

  const maxZipBytes = limits.maxZipBytes ?? TRANSFER_MAX_ZIP_BYTES;
  const maxUncompressedBytes =
    limits.maxUncompressedBytes ?? TRANSFER_MAX_UNCOMPRESSED_BYTES;
  const maxEntries = limits.maxEntries ?? TRANSFER_MAX_ENTRIES;
  const maxCompressionRatio =
    limits.maxCompressionRatio ?? TRANSFER_MAX_COMPRESSION_RATIO;

  const fileSize = await readFileSize(filePath);

  if (fileSize > maxZipBytes) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  const zip = await openZip(filePath);
  const entries: ArchiveEntry<T>[] = [];
  const entriesByPath = new Map<string, ArchiveEntry<T>>();
  let totalUncompressedBytes = 0;

  try {
    for await (const entry of zip.eachEntry()) {
      throwIfAborted(signal);

      if (entries.length >= maxEntries) {
        throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
      }

      const normalized = toArchiveEntry(entry, policy.parsePath);
      const pathKey = normalized.path.toLowerCase();

      assertCompressionRatio(
        normalized.compressedSize,
        normalized.uncompressedSize,
        maxCompressionRatio,
      );

      if (entriesByPath.has(pathKey)) {
        throw new TransferError('TRANSFER_ENTRY_REJECTED');
      }

      totalUncompressedBytes += normalized.uncompressedSize;

      if (totalUncompressedBytes > maxUncompressedBytes) {
        throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
      }

      const kindLimit = policy.maxBytesByKind?.[normalized.parsed.kind];

      if (kindLimit !== undefined && normalized.uncompressedSize > kindLimit) {
        throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
      }

      entries.push(normalized);
      entriesByPath.set(pathKey, normalized);
    }
  } catch (error) {
    throw toArchiveError(error, 'TRANSFER_SOURCE_UNREADABLE');
  } finally {
    closeZip(zip);
  }

  return {
    fileSize,
    entries,
    entriesByPath,
    totalUncompressedBytes,
  };
}

/** Lee una entrada pequeña en memoria (manifiesto o `world.json`). */
export async function readArchiveEntry(
  filePath: string,
  entryPath: string,
  maxBytes: number,
  signal?: AbortSignal,
  options: ArchiveReadOptions = {},
): Promise<Buffer> {
  throwIfAborted(signal);

  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new TransferError('TRANSFER_INTERNAL');
  }

  const zip = await openZip(filePath);

  try {
    const entry = await findEntry(zip, entryPath);

    assertCompressionRatio(
      entry.compressedSize,
      entry.uncompressedSize,
      options.maxCompressionRatio ?? TRANSFER_MAX_COMPRESSION_RATIO,
    );

    if (entry.uncompressedSize > maxBytes) {
      throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
    }

    const stream = await openReadStream(zip, entry);
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of withAbort(stream, signal)) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

      size += buffer.byteLength;

      if (size > maxBytes) {
        throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
      }

      chunks.push(buffer);
    }

    if (size !== entry.uncompressedSize) {
      throw new TransferError('TRANSFER_CHECKSUM_MISMATCH');
    }

    return Buffer.concat(chunks);
  } catch (error) {
    throw toArchiveError(error, 'TRANSFER_SOURCE_UNREADABLE');
  } finally {
    closeZip(zip);
  }
}

/** Lee una entrada y devuelve su SHA-256 sin conservarla en memoria. */
export async function hashArchiveEntry(
  filePath: string,
  entryPath: string,
  maxBytes: number,
  signal?: AbortSignal,
  options: ArchiveReadOptions = {},
): Promise<string> {
  throwIfAborted(signal);

  const zip = await openZip(filePath);

  try {
    const entry = await findEntry(zip, entryPath);

    assertCompressionRatio(
      entry.compressedSize,
      entry.uncompressedSize,
      options.maxCompressionRatio ?? TRANSFER_MAX_COMPRESSION_RATIO,
    );

    if (entry.uncompressedSize > maxBytes) {
      throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
    }

    const stream = await openReadStream(zip, entry);
    const hash = createHash('sha256');
    let size = 0;

    for await (const chunk of withAbort(stream, signal)) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;

      if (size > maxBytes) {
        throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
      }

      hash.update(buffer);
    }

    if (size !== entry.uncompressedSize) {
      throw new TransferError('TRANSFER_CHECKSUM_MISMATCH');
    }

    return hash.digest('hex');
  } catch (error) {
    throw toArchiveError(error, 'TRANSFER_SOURCE_UNREADABLE');
  } finally {
    closeZip(zip);
  }
}

/**
 * Extrae una entrada a un archivo destino.
 *
 * El destino se abre con `wx`: si ya existe, la operación falla sin
 * sobrescribirlo. Al terminar se comprueba el tamaño real y el SHA-256; si
 * algo falla se elimina el archivo parcial.
 */
export async function extractArchiveEntry(
  filePath: string,
  entryPath: string,
  destinationFile: string,
  maxBytes: number,
  signal?: AbortSignal,
  options: ArchiveReadOptions = {},
): Promise<ExtractedEntry> {
  throwIfAborted(signal);

  const zip = await openZip(filePath);
  let created = false;

  try {
    const entry = await findEntry(zip, entryPath);

    assertCompressionRatio(
      entry.compressedSize,
      entry.uncompressedSize,
      options.maxCompressionRatio ?? TRANSFER_MAX_COMPRESSION_RATIO,
    );

    if (entry.uncompressedSize > maxBytes) {
      throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
    }

    const stream = await openReadStream(zip, entry);
    const hash = createHash('sha256');
    let size = 0;

    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        try {
          throwIfAborted(signal);
        } catch (error) {
          callback(error as Error);
          return;
        }

        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.byteLength;

        if (size > maxBytes) {
          callback(new TransferError('TRANSFER_LIMIT_EXCEEDED'));
          return;
        }

        hash.update(buffer);
        callback(null, buffer);
      },
    });

    const output = createWriteStream(destinationFile, {
      flags: 'wx',
      mode: 0o600,
    });

    // Solo se borra el destino si este proceso lo creó. Si el archivo ya
    // existía, `wx` falla sin abrirlo y nunca debe eliminarse.
    output.once('open', () => {
      created = true;
    });

    await pipeline(withAbort(stream, signal), meter, output);

    throwIfAborted(signal);

    if (size !== entry.uncompressedSize) {
      throw new TransferError('TRANSFER_CHECKSUM_MISMATCH');
    }

    return { size, sha256: hash.digest('hex') };
  } catch (error) {
    if (created) {
      await rm(destinationFile, { force: true }).catch(() => undefined);
    }

    throw toArchiveError(error, 'TRANSFER_SOURCE_UNREADABLE');
  } finally {
    closeZip(zip);
  }
}

/** Comprueba que el archivo es regular y legible. */
async function readFileSize(filePath: string): Promise<number> {
  let stats;

  try {
    stats = await lstat(filePath);
  } catch (error) {
    throw isMissingError(error)
      ? new TransferError('TRANSFER_SOURCE_NOT_FOUND')
      : new TransferError('TRANSFER_SOURCE_UNREADABLE', { cause: error });
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new TransferError('TRANSFER_SOURCE_UNREADABLE');
  }

  return stats.size;
}

async function openZip(filePath: string): Promise<ZipFile> {
  try {
    return await yauzl.openPromise(filePath, OPEN_OPTIONS);
  } catch (error) {
    throw toArchiveError(error, 'TRANSFER_SOURCE_UNREADABLE');
  }
}

function closeZip(zip: ZipFile): void {
  try {
    if (zip.isOpen) {
      zip.close();
    }
  } catch {
    // El cierre es best-effort y no debe tapar el error original.
  }
}

async function findEntry(zip: ZipFile, entryPath: string): Promise<Entry> {
  for await (const entry of zip.eachEntry()) {
    if (entry.fileName === entryPath) {
      return entry;
    }
  }

  throw new TransferError('TRANSFER_MANIFEST_INVALID');
}

async function openReadStream(zip: ZipFile, entry: Entry): Promise<Readable> {
  try {
    return await zip.openReadStreamPromise(entry);
  } catch (error) {
    throw toArchiveError(error, 'TRANSFER_SOURCE_UNREADABLE');
  }
}

function assertCompressionRatio(
  compressedSize: number,
  uncompressedSize: number,
  maxRatio: number,
): void {
  if (uncompressedSize === 0) {
    return;
  }

  if (
    !(maxRatio > 0) ||
    compressedSize === 0 ||
    uncompressedSize / compressedSize > maxRatio
  ) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }
}

function toArchiveEntry<T extends { readonly kind: string }>(
  entry: Entry,
  parsePath: (path: string) => T,
): ArchiveEntry<T> {
  const externalMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const isSymlink = (externalMode & 0xf000) === 0xa000;
  const isDirectory =
    entry.fileName.endsWith('/') || (externalMode & 0xf000) === 0x4000;

  if (
    entry.isEncrypted() ||
    !entry.canDecodeFileData() ||
    isSymlink ||
    isDirectory
  ) {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  let parsed: T;

  try {
    parsed = parsePath(entry.fileName);
  } catch {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  if (
    !Number.isSafeInteger(entry.compressedSize) ||
    !Number.isSafeInteger(entry.uncompressedSize) ||
    entry.compressedSize < 0 ||
    entry.uncompressedSize < 0
  ) {
    throw new TransferError('TRANSFER_ENTRY_REJECTED');
  }

  return {
    path: entry.fileName,
    parsed,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
    crc32: entry.crc32,
  };
}

/** Propaga la cancelación al stream de lectura. */
async function* withAbort(
  stream: Readable,
  signal?: AbortSignal,
): AsyncGenerator<Buffer> {
  if (signal === undefined) {
    for await (const chunk of stream) {
      yield toBuffer(chunk);
    }
    return;
  }

  const onAbort = (): void => {
    stream.destroy(new TransferError('TRANSFER_CANCELLED'));
  };

  signal.addEventListener('abort', onAbort, { once: true });

  try {
    throwIfAborted(signal);

    for await (const chunk of stream) {
      throwIfAborted(signal);
      yield toBuffer(chunk);
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }

  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }

  throw new TransferError('TRANSFER_SOURCE_UNREADABLE');
}

/** Lanza `TRANSFER_CANCELLED` si la señal ya está abortada. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new TransferError('TRANSFER_CANCELLED');
  }
}

/** Normaliza errores de yauzl o del sistema de archivos. */
function toArchiveError(
  error: unknown,
  fallback: 'TRANSFER_SOURCE_UNREADABLE',
): TransferError {
  if (error instanceof TransferError) {
    return error;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('crc32') || message.includes('checksum')) {
    return new TransferError('TRANSFER_CHECKSUM_MISMATCH', { cause: error });
  }

  // yauzl rechaza nombres con `..`, rutas absolutas y separadores `\` antes de
  // que la entrada llegue a la política. Se traducen al código estable de
  // entrada rechazada, sin incluir el nombre en el mensaje.
  if (
    message.includes('invalid relative path') ||
    message.includes('absolute path') ||
    message.includes('backslash') ||
    message.includes('invalid characters')
  ) {
    return new TransferError('TRANSFER_ENTRY_REJECTED', { cause: error });
  }

  return new TransferError(fallback, { cause: error });
}

function countKinds<T extends { readonly kind: string }>(
  entries: readonly ArchiveEntry<T>[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    counts[entry.parsed.kind] = (counts[entry.parsed.kind] ?? 0) + 1;
  }

  return counts;
}

function isMissingError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}
