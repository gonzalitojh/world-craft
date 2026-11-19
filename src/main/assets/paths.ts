/**
 * Gramática y validación de rutas de assets.
 *
 * Hay dos entradas posibles y ninguna puede escapar de `assets/`:
 *
 * 1. El renderer usa `wc-asset://asset/<uuidv7>` o `wc-asset://thumb/<uuidv7>`.
 *    El ID es la única entrada; la ruta relativa sale siempre de SQLite.
 * 2. La base guarda `worlds/<worldId>/<assetId>.webp` y, para la miniatura,
 *    `worlds/<worldId>/<assetId>.thumb.webp`.
 *
 * La comprobación es doble: patrón estricto de la ruta relativa y contención
 * real con `resolve`/`relative`, `lstat` sin seguir enlaces y `realpath` para
 * detectar junctions de Windows. Los errores nunca incluyen la ruta.
 */
import { lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { isUuidV7 } from '../db/ids';
import {
  ASSET_CONTAINER_DIR,
  ASSET_FILE_SUFFIX,
  ASSET_THUMBNAIL_SUFFIX,
  type AssetVariant,
} from './constants';
import { AssetError } from './errors';

/** Resultado de interpretar una URL del protocolo. */
export interface ParsedAssetUrl {
  readonly variant: AssetVariant;
  readonly assetId: string;
}

/** Partes validadas de una ruta relativa de asset. */
export interface ParsedAssetPath {
  readonly worldId: string;
  readonly assetId: string;
  readonly variant: AssetVariant;
}

/** Opciones para resolver el archivo servible de un asset. */
export interface ResolveAssetFileOptions {
  readonly assetsDir: string;
  readonly relativePath: string;
  readonly worldId: string;
  readonly assetId: string;
  readonly variant: AssetVariant;
}

/** Archivo ya validado, dentro de `assets/`. */
export interface ResolvedAssetFile {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly size: number;
}

/**
 * Gramática cerrada de la URL del protocolo.
 *
 * Es sensible a mayúsculas a propósito: el esquema, el host y el UUID solo
 * admiten la forma canónica en minúsculas. Cualquier query, hash, puerto,
 * userinfo, segmento extra o carácter fuera de `[0-9a-f-]` no encaja.
 */
const ASSET_URL_PATTERN =
  /^wc-asset:\/\/(asset|thumb)\/([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:/;

/** Interpreta una URL `wc-asset://…` o lanza `ASSET_URL_INVALID`. */
export function parseAssetUrl(url: unknown): ParsedAssetUrl {
  if (typeof url !== 'string' || url.length === 0 || url.length > 256) {
    throw new AssetError('ASSET_URL_INVALID');
  }

  const match = ASSET_URL_PATTERN.exec(url);

  if (match === null) {
    throw new AssetError('ASSET_URL_INVALID');
  }

  const variant = match[1] as AssetVariant;
  const assetId = match[2] as string;

  if (!isUuidV7(assetId)) {
    throw new AssetError('ASSET_URL_INVALID');
  }

  return { variant, assetId };
}

/** Construye la ruta relativa canónica de un asset o de su miniatura. */
export function buildRelativePath(input: {
  readonly worldId: string;
  readonly assetId: string;
  readonly variant: AssetVariant;
}): string {
  if (!isUuidV7(input.worldId) || !isUuidV7(input.assetId)) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  const fileName =
    input.variant === 'thumb'
      ? `${input.assetId}${ASSET_THUMBNAIL_SUFFIX}`
      : `${input.assetId}${ASSET_FILE_SUFFIX}`;

  return `${ASSET_CONTAINER_DIR}/${input.worldId}/${fileName}`;
}

/** Deriva la ruta de la miniatura a partir de la del archivo principal. */
export function toThumbnailRelativePath(relativePath: string): string {
  const parsed = parseRelativeAssetPath(relativePath);

  if (parsed.variant !== 'asset') {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  return buildRelativePath({
    worldId: parsed.worldId,
    assetId: parsed.assetId,
    variant: 'thumb',
  });
}

/**
 * Valida una ruta relativa guardada en la base.
 *
 * Solo admite `worlds/<uuidv7>/<uuidv7>.webp` y su variante `.thumb.webp`.
 * Rechaza rutas absolutas, unidades de Windows, UNC, `\`, NUL, segmentos
 * vacíos, `.` y `..`, nombres con mayúsculas y UUID que no sean v7.
 */
export function parseRelativeAssetPath(relativePath: unknown): ParsedAssetPath {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    relativePath.length > 128 ||
    relativePath.includes('\0') ||
    relativePath.includes('\\') ||
    relativePath.startsWith('/') ||
    WINDOWS_DRIVE_PATTERN.test(relativePath) ||
    isAbsolute(relativePath)
  ) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  const segments = relativePath.split('/');

  if (segments.length !== 3) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  const [container, worldId, fileName] = segments as [string, string, string];

  if (container !== ASSET_CONTAINER_DIR || !isUuidV7(worldId)) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  if (fileName.endsWith(ASSET_THUMBNAIL_SUFFIX)) {
    const assetId = fileName.slice(0, -ASSET_THUMBNAIL_SUFFIX.length);

    if (!isUuidV7(assetId)) {
      throw new AssetError('ASSET_PATH_INVALID');
    }

    return { worldId, assetId, variant: 'thumb' };
  }

  if (fileName.endsWith(ASSET_FILE_SUFFIX)) {
    const assetId = fileName.slice(0, -ASSET_FILE_SUFFIX.length);

    if (!isUuidV7(assetId)) {
      throw new AssetError('ASSET_PATH_INVALID');
    }

    return { worldId, assetId, variant: 'asset' };
  }

  throw new AssetError('ASSET_PATH_INVALID');
}

/** Comprueba que `candidate` queda estrictamente dentro de `root`. */
export function assertContained(root: string, candidate: string): void {
  if (typeof root !== 'string' || typeof candidate !== 'string') {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  const relation = relative(root, candidate);

  if (
    relation.length === 0 ||
    relation.startsWith('..') ||
    isAbsolute(relation)
  ) {
    throw new AssetError('ASSET_PATH_INVALID');
  }
}

/**
 * Estado de un directorio que debe quedar dentro de una raíz.
 *
 * `link` cubre symlinks y junctions; `escapes` indica que el destino real ya no
 * corresponde a la ruta esperada. Ambos son inseguros para leer o escribir.
 */
export type AssetDirectoryStateName =
  'directory' | 'missing' | 'link' | 'not-directory' | 'escapes';

/** Resultado de inspeccionar un directorio ancla. */
export interface AssetDirectoryState {
  readonly state: AssetDirectoryStateName;
  readonly absolutePath: string;
}

/**
 * Inspecciona un directorio sin seguirlo y comprueba que su ruta real sigue
 * dentro de `rootDir` y coincide con la esperada.
 *
 * No lanza: la planificación de huérfanos necesita clasificar el estado y la
 * importación decide si un estado concreto es un fallo.
 */
export function inspectDirectoryInside(
  rootDir: string,
  directory: string,
): AssetDirectoryState {
  const root = resolve(rootDir);
  const target = resolve(directory);
  const absolutePath = target;

  let stats;

  try {
    stats = lstatSync(target);
  } catch (error) {
    return {
      state: isMissingFileError(error) ? 'missing' : 'not-directory',
      absolutePath,
    };
  }

  if (stats.isSymbolicLink()) {
    return { state: 'link', absolutePath };
  }

  if (!stats.isDirectory()) {
    return { state: 'not-directory', absolutePath };
  }

  let realRoot: string;
  let realTarget: string;

  try {
    realRoot = realpathSync(root);
    realTarget = realpathSync(target);
  } catch {
    return { state: 'escapes', absolutePath };
  }

  const relation = relative(realRoot, realTarget).split(sep).join('/');
  const expected = relative(root, target).split(sep).join('/');

  if (
    relation.length === 0 ||
    relation.startsWith('..') ||
    isAbsolute(relation) ||
    normalizeForComparison(relation) !== normalizeForComparison(expected)
  ) {
    return { state: 'escapes', absolutePath };
  }

  return { state: 'directory', absolutePath };
}

/**
 * Exige que `directory` sea un directorio real dentro de `rootDir`.
 *
 * Con `create` se crea cuando falta y se vuelve a inspeccionar. Cualquier otro
 * estado lanza `ASSET_PATH_INVALID`: nunca se escribe a través de un enlace.
 */
export function assertDirectoryInside(
  rootDir: string,
  directory: string,
  options?: { readonly create?: boolean },
): void {
  let state = inspectDirectoryInside(rootDir, directory);

  if (state.state === 'missing' && options?.create === true) {
    try {
      mkdirSync(state.absolutePath);
    } catch {
      // Se reevalúa abajo: si no se pudo crear, no es un directorio utilizable.
    }

    state = inspectDirectoryInside(rootDir, directory);
  }

  if (state.state !== 'directory') {
    throw new AssetError('ASSET_PATH_INVALID');
  }
}

/**
 * Calcula la ruta absoluta de escritura de un asset ya validado.
 *
 * No comprueba que el archivo exista, pero sí que el ancla `worlds/` no sea un
 * enlace ni se haya rebasado: lo usa la importación antes del `rename`.
 */
export function resolveStoreFilePath(
  assetsDir: string,
  relativePath: string,
): string {
  parseRelativeAssetPath(relativePath);

  const root = resolve(assetsDir);
  const worlds = inspectDirectoryInside(
    root,
    resolve(root, ASSET_CONTAINER_DIR),
  );

  if (
    worlds.state === 'link' ||
    worlds.state === 'escapes' ||
    worlds.state === 'not-directory'
  ) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  const candidate = resolve(root, relativePath);

  assertContained(root, candidate);

  return candidate;
}

/**
 * Resuelve el archivo servible y comprueba que es regular y está contenido.
 *
 * Lanza `ASSET_NOT_FOUND` si no existe o no es un archivo y
 * `ASSET_PATH_INVALID` si la ruta no encaja, no coincide con el mundo de la
 * fila o pasa por un enlace simbólico o una junction.
 */
export function resolveAssetFile(
  options: ResolveAssetFileOptions,
): ResolvedAssetFile {
  const parsed = parseRelativeAssetPath(options.relativePath);

  if (
    parsed.worldId !== options.worldId ||
    parsed.assetId !== options.assetId ||
    parsed.variant !== options.variant
  ) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  const root = resolve(options.assetsDir);
  const candidate = resolveStoreFilePath(root, options.relativePath);

  let stats;

  try {
    // `lstat` no sigue enlaces: un symlink o una junction se rechazan aunque su
    // destino esté dentro de `assets/`.
    stats = lstatSync(candidate);
  } catch (error) {
    throw isMissingFileError(error)
      ? new AssetError('ASSET_NOT_FOUND')
      : new AssetError('ASSET_STORAGE_FAILED');
  }

  if (stats.isSymbolicLink()) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  if (!stats.isFile()) {
    throw new AssetError('ASSET_NOT_FOUND');
  }

  assertRealContained(root, candidate, options.relativePath);

  return {
    absolutePath: candidate,
    relativePath: options.relativePath,
    size: stats.size,
  };
}

/**
 * Exige que el directorio de assets sea real y esté contenido en `userData`.
 *
 * Un `assets/` enlazado (junction o symlink) sacaría toda la carpeta de datos
 * del árbol del usuario sin que las comprobaciones internas lo notaran, porque
 * usarían su destino como raíz. Se acepta ausente: la composición la crea antes
 * de usarla.
 */
export function assertAssetRoot(userDataDir: string, assetsDir: string): void {
  const state = inspectDirectoryInside(userDataDir, assetsDir);

  if (state.state !== 'directory' && state.state !== 'missing') {
    throw new AssetError('ASSET_PATH_INVALID');
  }
}

/**
 * Exige que un archivo sea regular, no sea un enlace y su ruta real coincida
 * con la esperada dentro de `rootDir`.
 *
 * Lo usa la purga para revalidar cada ruta justo antes de copiarla o borrarla:
 * detecta un directorio padre sustituido por una junction entre la
 * planificación y el borrado.
 */
export function assertFileInside(
  rootDir: string,
  absolutePath: string,
  expectedRelativePath: string,
): void {
  const root = resolve(rootDir);
  const target = resolve(absolutePath);

  assertContained(root, target);

  let stats;

  try {
    stats = lstatSync(target);
  } catch (error) {
    throw isMissingFileError(error)
      ? new AssetError('ASSET_NOT_FOUND')
      : new AssetError('ASSET_STORAGE_FAILED');
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  let realRoot: string;
  let realTarget: string;

  try {
    realRoot = realpathSync(root);
    realTarget = realpathSync(target);
  } catch (error) {
    throw isMissingFileError(error)
      ? new AssetError('ASSET_NOT_FOUND')
      : new AssetError('ASSET_STORAGE_FAILED');
  }

  assertContained(realRoot, realTarget);

  const relation = relative(realRoot, realTarget).split(sep).join('/');

  if (
    normalizeForComparison(relation) !==
    normalizeForComparison(expectedRelativePath)
  ) {
    throw new AssetError('ASSET_PATH_INVALID');
  }
}

/**
 * Compara la ruta real del archivo con la esperada.
 *
 * Detecta junctions en directorios intermedios y cambios de mayúsculas o de
 * nombre resuelto por el sistema de archivos. La comparación es insensible a
 * mayúsculas solo en Windows.
 */
function assertRealContained(
  root: string,
  candidate: string,
  relativePath: string,
): void {
  let realRoot: string;
  let realCandidate: string;

  try {
    realRoot = realpathSync(root);
    realCandidate = realpathSync(candidate);
  } catch (error) {
    throw isMissingFileError(error)
      ? new AssetError('ASSET_NOT_FOUND')
      : new AssetError('ASSET_STORAGE_FAILED');
  }

  assertContained(realRoot, realCandidate);

  const relation = relative(realRoot, realCandidate).split(sep).join('/');

  if (
    normalizeForComparison(relation) !== normalizeForComparison(relativePath)
  ) {
    throw new AssetError('ASSET_PATH_INVALID');
  }
}

function normalizeForComparison(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}
