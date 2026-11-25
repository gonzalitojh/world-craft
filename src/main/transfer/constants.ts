/**
 * Constantes internas de exportación e importación.
 *
 * Los límites públicos viven en `src/shared/contracts/transfer.ts`; aquí solo
 * están los nombres del formato, los temporales y el log.
 */

/** Manifiesto del ZIP; única fuente de verdad de archivos y checksums. */
export const TRANSFER_MANIFEST_FILE = 'manifest.json';

/** Contenido del mundo en JSON. */
export const TRANSFER_WORLD_FILE = 'world.json';

/** Carpeta de assets dentro del ZIP. */
export const TRANSFER_ASSETS_DIR = 'assets';

/** Extensión canónica de un asset exportado. */
export const TRANSFER_ASSET_SUFFIX = '.webp';

/** Sufijo del archivo de exportación mientras se escribe. */
export const TRANSFER_PARTIAL_SUFFIX = '.partial';

/** Nombre del log JSONL de transferencia. */
export const TRANSFER_LOG_MAX_BYTES = 256 * 1024;

/** Número de elementos entre dos eventos de progreso. */
export const TRANSFER_PROGRESS_STEP = 1;

/** Versión de protocolo entre el proceso principal y el worker. */
export const TRANSFER_PROTOCOL_VERSION = 1;

/** Tamaño máximo del `plan.json` temporal de una importación. */
export const TRANSFER_PLAN_MAX_BYTES = 512 * 1024 ** 2;

/** Nombre del plan temporal de una importación. */
export const TRANSFER_PLAN_FILE = 'plan.json';

/** Reserva conservadora por miniatura durante la preflight de espacio. */
export const TRANSFER_THUMBNAIL_RESERVE_BYTES = 64 * 1024;

/** Ratio máximo de compresión admitido en una entrada del ZIP. */
export const TRANSFER_MAX_COMPRESSION_RATIO = 100;
