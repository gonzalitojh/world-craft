/**
 * Importación de assets locales.
 *
 * Nunca copia el original: valida por contenido, re-codifica a WebP con
 * miniatura, escribe en `assets/.tmp/<assetId>/`, mueve con `rename` a la ruta
 * final dentro de `assets/worlds/<worldId>/` y guarda los metadatos en una
 * transacción. Si el `INSERT` falla, elimina los archivos recién publicados
 * para no dejar huérfanos silenciosos. Sin deduplicación en M0: dos
 * importaciones del mismo contenido son dos filas con IDs distintos.
 */
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { generateUuidv7, isUuidV7 } from '../db/ids';
import {
  ASSET_ALT_MAX_LENGTH,
  ASSET_CONTAINER_DIR,
  ASSET_MAX_FILE_BYTES,
  ASSET_MIME_WEBP,
} from './constants';
import { AssetError, toAssetError } from './errors';
import { processImage, type ProcessedImage } from './image';
import type { AssetLogger } from './logger';
import { withAssetLock } from './mutex';
import {
  assertAssetRoot,
  assertDirectoryInside,
  buildRelativePath,
  resolveStoreFilePath,
} from './paths';
import type { AssetRecord, AssetRepository } from './store';

/** Origen del archivo: una ruta elegida por el usuario o un búfer ya leído. */
export type ImportAssetSource =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'buffer'; readonly data: Buffer };

/** Datos de una importación de imagen. */
export interface ImportAssetInput {
  readonly worldId: string;
  /** En M0 solo se importan imágenes; el resto de tipos llega con el dominio. */
  readonly kind: 'image';
  readonly alt?: string;
  readonly source: ImportAssetSource;
}

/** Dependencias inyectables de la importación. */
export interface ImportAssetDependencies {
  /** Carpeta `userData`: la raíz de assets debe quedar dentro. */
  readonly userDataDir: string;
  readonly assetsDir: string;
  readonly assetsTempDir: string;
  readonly repository: Pick<AssetRepository, 'insert'>;
  readonly generateId?: () => string;
  readonly now?: () => number;
  readonly logger?: AssetLogger;
  readonly process?: (data: Buffer) => Promise<ProcessedImage>;
}

/** Resultado de una importación correcta. */
export interface ImportedAsset {
  readonly asset: AssetRecord;
  readonly thumbnailRelativePath: string;
}

/**
 * Importa una imagen y devuelve la fila con su ruta relativa.
 *
 * Se serializa con la purga mediante el cerrojo de assets: la fila está
 * insertada antes de que una purga pueda recalcular su plan. Cualquier fallo se
 * devuelve con un código estable y deja el sistema sin archivos nuevos ni filas
 * a medias.
 */
export function importAsset(
  deps: ImportAssetDependencies,
  input: ImportAssetInput,
): Promise<ImportedAsset> {
  return withAssetLock(() => importAssetLocked(deps, input));
}

async function importAssetLocked(
  deps: ImportAssetDependencies,
  input: ImportAssetInput,
): Promise<ImportedAsset> {
  const process = deps.process ?? processImage;
  const now = deps.now ?? Date.now;
  const generateId = deps.generateId ?? generateUuidv7;

  try {
    const worldId = validateWorldId(input.worldId);
    const alt = normalizeAlt(input.alt);
    const data = await readSource(input.source);
    const processed = await process(data);

    // El WebP generado también respeta el límite: una re-codificación no debe
    // poder publicar un archivo mayor que el admitido.
    if (
      processed.size > ASSET_MAX_FILE_BYTES ||
      processed.data.byteLength > ASSET_MAX_FILE_BYTES
    ) {
      throw new AssetError('ASSET_TOO_LARGE');
    }

    const assetId = generateId();

    if (!isUuidV7(assetId)) {
      throw new AssetError('ASSET_STORAGE_FAILED');
    }

    const relativePath = buildRelativePath({
      worldId,
      assetId,
      variant: 'asset',
    });
    const thumbnailRelativePath = buildRelativePath({
      worldId,
      assetId,
      variant: 'thumb',
    });
    const finalMain = resolveStoreFilePath(deps.assetsDir, relativePath);
    const finalThumbnail = resolveStoreFilePath(
      deps.assetsDir,
      thumbnailRelativePath,
    );
    const tempDirectory = join(deps.assetsTempDir, assetId);
    const worldDirectory = join(deps.assetsDir, ASSET_CONTAINER_DIR, worldId);
    const createdFiles: string[] = [];

    // La raíz y todos los directorios por los que se escribe deben ser reales y
    // estar contenidos en `assets/`. Una junction en `worlds/<worldId>` o en
    // `.tmp/<assetId>` haría que el `rename` publicara fuera del árbol.
    await mkdir(deps.assetsDir, { recursive: true });
    assertAssetRoot(deps.userDataDir, deps.assetsDir);
    assertDirectoryInside(
      deps.assetsDir,
      join(deps.assetsDir, ASSET_CONTAINER_DIR),
      { create: true },
    );
    assertDirectoryInside(deps.assetsDir, deps.assetsTempDir, { create: true });
    assertDirectoryInside(deps.assetsDir, worldDirectory, { create: true });
    assertDirectoryInside(deps.assetsDir, tempDirectory, { create: true });

    try {
      await writeFile(join(tempDirectory, 'main.webp'), processed.data);
      await writeFile(
        join(tempDirectory, 'thumbnail.webp'),
        processed.thumbnail.data,
      );

      // Nunca se sobrescribe un archivo existente: un ID repetido o una ruta
      // ya ocupada aborta antes de publicar nada.
      if ((await pathExists(finalMain)) || (await pathExists(finalThumbnail))) {
        throw new AssetError('ASSET_STORAGE_FAILED');
      }

      // Se revalidan los padres justo antes de cada `rename`, por si algo
      // cambió entre la creación de los directorios y la publicación.
      assertDirectoryInside(deps.assetsDir, worldDirectory);
      assertDirectoryInside(deps.assetsDir, tempDirectory);
      await rename(join(tempDirectory, 'main.webp'), finalMain);
      createdFiles.push(finalMain);

      assertDirectoryInside(deps.assetsDir, worldDirectory);
      assertDirectoryInside(deps.assetsDir, tempDirectory);
      await rename(join(tempDirectory, 'thumbnail.webp'), finalThumbnail);
      createdFiles.push(finalThumbnail);

      const record: AssetRecord = {
        id: assetId,
        worldId,
        kind: 'image',
        relativePath,
        mime: ASSET_MIME_WEBP,
        size: processed.size,
        width: processed.width,
        height: processed.height,
        alt,
        // Se recalcula sobre los bytes publicados: el hash describe el archivo
        // que el protocolo va a servir, no el de entrada.
        hash: processed.hash,
        createdAt: now(),
      };

      try {
        deps.repository.insert(record);
      } catch (error) {
        // Cualquier fallo del repositorio se normaliza aquí: la importación
        // compensa los archivos publicados y devuelve un código estable.
        throw toAssetError(error, 'ASSET_DATABASE_FAILED');
      }

      deps.logger?.log({ event: 'asset.import', outcome: 'created' });

      return { asset: record, thumbnailRelativePath };
    } catch (error) {
      // Compensación: si la fila no se guardó, no deben quedar archivos ni
      // carpetas vacías del mundo.
      await Promise.all(
        createdFiles.map((file) => rm(file, { force: true }).catch(() => {})),
      );
      await rmdir(dirname(finalMain)).catch(() => {});

      throw error;
    } finally {
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
    }
  } catch (error) {
    const assetError = toAssetError(error, 'ASSET_STORAGE_FAILED');

    deps.logger?.log({
      event: 'asset.import',
      outcome: 'rejected',
      code: assetError.code,
    });

    throw assetError;
  }
}

/**
 * Normaliza el texto alternativo.
 *
 * Se recorta, se limita a 500 caracteres, se rechazan caracteres de control y
 * una cadena vacía se guarda como `null`.
 */
export function normalizeAlt(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AssetError('ASSET_INPUT_INVALID');
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > ASSET_ALT_MAX_LENGTH || /[\p{Cc}]/u.test(trimmed)) {
    throw new AssetError('ASSET_INPUT_INVALID');
  }

  return trimmed;
}

function validateWorldId(value: unknown): string {
  if (!isUuidV7(value)) {
    throw new AssetError('ASSET_INPUT_INVALID');
  }

  return value;
}

async function readSource(source: ImportAssetSource): Promise<Buffer> {
  if (source.kind === 'buffer') {
    const data = source.data;

    if (!Buffer.isBuffer(data) || data.byteLength === 0) {
      throw new AssetError('ASSET_INPUT_INVALID');
    }

    if (data.byteLength > ASSET_MAX_FILE_BYTES) {
      throw new AssetError('ASSET_TOO_LARGE');
    }

    return data;
  }

  if (
    source.kind !== 'path' ||
    typeof source.path !== 'string' ||
    source.path.trim().length === 0 ||
    source.path.includes('\0')
  ) {
    throw new AssetError('ASSET_INPUT_INVALID');
  }

  let stats;

  try {
    // El tamaño se comprueba antes de leer: un archivo enorme no se carga en
    // memoria para luego rechazarlo.
    stats = await stat(source.path);
  } catch (error) {
    throw new AssetError('ASSET_STORAGE_FAILED', { cause: error });
  }

  if (!stats.isFile()) {
    throw new AssetError('ASSET_INPUT_INVALID');
  }

  if (stats.size > ASSET_MAX_FILE_BYTES) {
    throw new AssetError('ASSET_TOO_LARGE');
  }

  const data = await readFile(source.path);

  if (data.byteLength > ASSET_MAX_FILE_BYTES) {
    throw new AssetError('ASSET_TOO_LARGE');
  }

  return data;
}

/** Indica si una ruta existe, sin seguir enlaces. */
async function pathExists(file: string): Promise<boolean> {
  try {
    await lstat(file);

    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }
}
