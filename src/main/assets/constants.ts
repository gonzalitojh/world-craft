/**
 * Constantes del servicio de assets locales.
 *
 * Los límites son deliberadamente conservadores: se aplican antes de decodificar
 * y otra vez sobre las dimensiones reales. Cambiarlos exige revisar el ADR 0005
 * y las pruebas de límites.
 */

/** Tipos de asset admitidos por el esquema de base de datos. */
export const ASSET_KINDS = ['image', 'map', 'document', 'other'] as const;

/** Tipo de asset. En M0 solo se importa `image`. */
export type AssetKind = (typeof ASSET_KINDS)[number];

/** Formatos de imagen que se aceptan por contenido real. */
export const SUPPORTED_IMAGE_FORMATS = [
  'png',
  'jpeg',
  'webp',
  'gif',
  'avif',
] as const;

/** Formato detectado por magic bytes. */
export type SupportedImageFormat = (typeof SUPPORTED_IMAGE_FORMATS)[number];

/** Variante de archivo que sirve el protocolo. */
export const ASSET_VARIANTS = ['asset', 'thumb'] as const;

/** Variante: archivo completo o miniatura. */
export type AssetVariant = (typeof ASSET_VARIANTS)[number];

/** Esquema del protocolo propio. */
export const ASSET_URL_SCHEME = 'wc-asset';

/** Carpeta contenedora de los assets de cada mundo. */
export const ASSET_CONTAINER_DIR = 'worlds';

/** Extensión del archivo servible. */
export const ASSET_FILE_SUFFIX = '.webp';

/** Sufijo del archivo de miniatura. */
export const ASSET_THUMBNAIL_SUFFIX = '.thumb.webp';

/** MIME del único formato servible. */
export const ASSET_MIME_WEBP = 'image/webp';

/** MIME admitidos por el protocolo y por la tabla de assets. */
export const ASSET_ALLOWED_MIME_TYPES = [ASSET_MIME_WEBP] as const;

/** Tamaño máximo del archivo de entrada y del archivo servido (25 MB). */
export const ASSET_MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Lado máximo en píxeles de una imagen aceptada. */
export const ASSET_MAX_DIMENSION_PX = 8192;

/** Total máximo de píxeles de una imagen aceptada (24 Mpx). */
export const ASSET_MAX_PIXELS = 24_000_000;

/** Calidad WebP del archivo principal. */
export const ASSET_WEBP_QUALITY = 90;

/** Esfuerzo de compresión WebP (0-6). */
export const ASSET_WEBP_EFFORT = 4;

/** Lado máximo de la miniatura. */
export const ASSET_THUMBNAIL_MAX_PX = 320;

/** Calidad WebP de la miniatura. */
export const ASSET_THUMBNAIL_QUALITY = 80;

/** Longitud máxima del texto alternativo. */
export const ASSET_ALT_MAX_LENGTH = 500;

/** Tamaño máximo antes de rotar el log de assets. */
export const ASSET_LOG_MAX_BYTES = 256 * 1024;

/** Nombre del directorio temporal dentro de `assets/`. */
export const ASSET_TEMP_DIR_NAME = '.tmp';

/** Token exacto que exige la purga de huérfanos. */
export const PURGE_ORPHANS_CONFIRMATION = 'purge-orphans';

/** Versión del manifiesto de copia de huérfanos. */
export const ORPHAN_BACKUP_FORMAT_VERSION = 1;

/** Nombre del manifiesto de una copia de huérfanos. */
export const ORPHAN_BACKUP_MANIFEST_FILE = 'manifest.json';

/** Motivo registrado en el manifiesto de la copia. */
export const ORPHAN_BACKUP_REASON = 'orphan-purge';

/** Indica cómo recuperar los archivos si una purga se interrumpe. */
export const ORPHAN_BACKUP_RECOVERY = 'restore-files-from-this-backup';
