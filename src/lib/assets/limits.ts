/**
 * Límites y tipos de imagen de los assets.
 *
 * Se centralizan para que el pipeline, el servicio, la migración 0007 y los
 * tests compartan la misma verdad. La migración repite los números porque SQL no
 * importa TypeScript; si cambian aquí, hay que crear una migración nueva.
 */

/** Tamaño máximo del archivo subido: 10 MiB. */
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;

/** Píxeles máximos de la imagen de entrada: 25 MP. */
export const MAX_INPUT_PIXELS = 25_000_000;

/** Lado máximo de la imagen de entrada: 8192 px. */
export const MAX_INPUT_DIMENSION = 8192;

/** Lado mínimo de la imagen de entrada: 16 px. */
export const MIN_IMAGE_DIMENSION = 16;

/** Lado máximo del WebP almacenado: 4096 px. */
export const MAX_OUTPUT_DIMENSION = 4096;

/** Lado máximo de la miniatura: 480 px. */
export const THUMBNAIL_DIMENSION = 480;

/** Calidad del WebP principal. */
export const WEBP_QUALITY = 82;

/** Calidad del WebP de la miniatura. */
export const THUMBNAIL_WEBP_QUALITY = 72;

/** MIME de todos los assets procesados. */
export const OUTPUT_ASSET_MIME = 'image/webp';

/** Tipos MIME aceptados en `requestUpload`. */
export const ALLOWED_INPUT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;

/** Tipo MIME de entrada admitido. */
export type AllowedInputMime = (typeof ALLOWED_INPUT_MIME_TYPES)[number];

/** Comprueba si un valor es un MIME de entrada admitido. */
export function isAllowedInputMime(value: string): value is AllowedInputMime {
  return (ALLOWED_INPUT_MIME_TYPES as readonly string[]).includes(value);
}

/** Extensión interna del objeto temporal de una subida directa. */
export const TEMP_UPLOAD_EXTENSION = 'upload';

/** Validez de la URL de subida directa: 10 minutos. */
export const UPLOAD_URL_EXPIRY_SECONDS = 600;

/** Validez por defecto de una URL de descarga: 5 minutos. */
export const DOWNLOAD_URL_EXPIRY_SECONDS = 300;

/** Longitud máxima del texto alternativo. */
export const MAX_ALT_LENGTH = 500;

/** Tamaño de página por defecto de `listAssets`. */
export const DEFAULT_LIST_LIMIT = 50;

/** Tamaño de página máximo de `listAssets`. */
export const MAX_LIST_LIMIT = 200;
