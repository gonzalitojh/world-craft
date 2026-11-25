/**
 * Contrato compartido de la exportación e importación de mundos.
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal valida los mensajes con Zod, el preload comprueba la forma de los
 * eventos con estas guardas y el renderer consume los tipos sin duplicarlos.
 *
 * El formato del archivo es un ZIP abierto con `manifest.json`, `world.json` y
 * `assets/<uuidv7>.webp`. El manifiesto es la única fuente de verdad sobre los
 * archivos y sus checksums; `world.json` contiene el contenido del mundo sin
 * filas de papelera, actividad, búsqueda ni preferencias.
 *
 * Los eventos y resultados que llegan al renderer no incluyen rutas, IDs
 * internos ni contenido del usuario: solo fase, progreso y recuentos.
 */
import { UUID_V7_PATTERN } from '../entities/uuid';
import type { IpcResult } from './result';

/** Identificador del formato en el manifiesto y en `world.json`. */
export const TRANSFER_FORMAT = 'world-craft-world';

/**
 * Canal unidireccional de progreso.
 *
 * No está en `IPC_CHANNELS` porque no admite `invoke`: el proceso principal lo
 * emite con `webContents.send` y el preload solo se suscribe. Sigue el mismo
 * patrón que `UPDATE_STATE_CHANGED_CHANNEL`.
 */
export const TRANSFER_EVENT_CHANNEL = 'transfer:event';

/** Versión del formato que entiende esta versión de la aplicación. */
export const TRANSFER_FORMAT_VERSION = 1;

/** Operaciones de transferencia. */
export const TRANSFER_OPERATIONS = ['export', 'import'] as const;

export type TransferOperation = (typeof TRANSFER_OPERATIONS)[number];

/**
 * Fases comunes de progreso.
 *
 * Son genéricas para que la interfaz muestre una barra sin conocer los pasos
 * internos. `saving` es la fase no cancelable: la transacción ya está abierta o
 * el ZIP ya se está publicando.
 */
export const TRANSFER_PHASES = [
  'preparing',
  'reading',
  'validating',
  'extracting',
  'importing',
  'packaging',
  'finalizing',
  'saving',
] as const;

export type TransferPhase = (typeof TRANSFER_PHASES)[number];

/** Unidad de la barra de progreso. */
export const TRANSFER_UNITS = ['files', 'steps'] as const;

export type TransferUnit = (typeof TRANSFER_UNITS)[number];

/** Códigos de aviso por contenido saneado; nunca incluyen rutas ni IDs. */
export const TRANSFER_WARNING_CODES = [
  'broken-entity-link',
  'broken-reference-attribute',
  'broken-gallery-asset',
  'missing-entity-image',
  'missing-world-cover',
  'missing-entity-type',
  'missing-relation-type',
  'missing-tag',
  'broken-relation-endpoint',
  'duplicate-relation',
  'unknown-version-origin',
  'invalid-attribute',
  'invalid-version',
] as const;

export type TransferWarningCode = (typeof TRANSFER_WARNING_CODES)[number];

/** Aviso agregado devuelto por una operación. */
export interface TransferWarning {
  readonly code: TransferWarningCode;
  readonly count: number;
}

/** Recuento del contenido transferido. */
export interface TransferCounts {
  readonly entities: number;
  readonly entityTypes: number;
  readonly relationTypes: number;
  readonly tags: number;
  readonly relations: number;
  readonly versions: number;
  readonly assets: number;
}

/** Progreso de una operación, sin datos internos. */
export interface TransferEvent {
  readonly operation: TransferOperation;
  readonly phase: TransferPhase;
  readonly completed: number;
  /** Total de la fase, o `null` si todavía no se conoce. */
  readonly total: number | null;
  /** Número de avisos acumulados hasta el momento. */
  readonly warnings: number;
}

/**
 * Evento de progreso que recibe el renderer.
 *
 * El worker emite `TransferEvent` sin identificador. El coordinador añade el
 * `operationId` de la operación, la unidad de la barra y si la fase se puede
 * cancelar. Los avisos siguen en el evento, pero la interfaz no los anuncia por
 * `aria-live`.
 */
export interface TransferProgressEvent extends TransferEvent {
  readonly operationId: string;
  readonly unit: TransferUnit;
  /** `false` únicamente durante `saving`. */
  readonly cancelable: boolean;
}

/** Resultado de exportar un mundo. */
export interface TransferExportResult {
  readonly worldId: string;
  readonly worldName: string;
  /** Nombre del archivo, sin carpeta. */
  readonly fileName: string;
  readonly size: number;
  readonly counts: TransferCounts;
  readonly warnings: readonly TransferWarning[];
}

/** Resultado de importar un mundo. */
export interface TransferImportResult {
  readonly worldId: string;
  readonly worldName: string;
  /** Slug final del mundo importado, con sufijo si hubo colisión. */
  readonly slug: string;
  /** Indica si el slug cambió respecto al del paquete para evitar colisión. */
  readonly slugAdjusted: boolean;
  readonly counts: TransferCounts;
  readonly warnings: readonly TransferWarning[];
}

/** Resultado de solicitar la cancelación. */
export interface TransferCancelResult {
  /** `false` si la operación ya estaba en una fase no cancelable. */
  readonly cancelled: boolean;
}

/**
 * Resultado de extremo a extremo de una operación.
 *
 * Se envuelve como `IpcResult` para que un fallo de validación o de transporte
 * siga siendo un error IPC, pero un fallo de dominio viaje como `failed` con su
 * código estable. Así el router no lo degrada a `INTERNAL_ERROR`.
 */
export type TransferRunResult<T> =
  | { readonly status: 'completed'; readonly data: T }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly code: TransferErrorCode };

/** API tipada de transferencia expuesta por el preload. */
export interface WorldCraftTransferApi {
  readonly exportWorld: (
    worldId: string,
  ) => Promise<IpcResult<TransferRunResult<TransferExportResult>>>;
  readonly importWorld: () => Promise<
    IpcResult<TransferRunResult<TransferImportResult>>
  >;
  readonly cancel: () => Promise<IpcResult<TransferCancelResult>>;
  readonly onEvent: (
    listener: (event: TransferProgressEvent) => void,
  ) => () => void;
}

/**
 * Límites de la transferencia (D4).
 *
 * Duplican la propuesta del plan para dejar margen a mundos grandes. Se
 * comprueban antes de extraer y otra vez durante la extracción: el tamaño
 * declarado en el ZIP no es fiable. Los límites por imagen y por registro
 * viven en el servicio de assets y en los contratos de fichas.
 */
export const TRANSFER_MAX_ZIP_BYTES = 8 * 1024 ** 3;
export const TRANSFER_MAX_UNCOMPRESSED_BYTES = 16 * 1024 ** 3;
export const TRANSFER_MAX_ENTRIES = 10_000;
export const TRANSFER_WORLD_JSON_MAX_BYTES = 256 * 1024 ** 2;
export const TRANSFER_MANIFEST_MAX_BYTES = 16 * 1024 ** 2;
export const TRANSFER_MAX_ENTITIES = 50_000;
export const TRANSFER_MAX_VERSIONS = 500_000;
export const TRANSFER_MAX_RELATIONS = 300_000;
export const TRANSFER_MAX_TAGS = 5_000;
export const TRANSFER_MAX_ENTITY_TYPES = 1_000;
export const TRANSFER_MAX_RELATION_TYPES = 1_000;
export const TRANSFER_MAX_ASSETS = 8_000;
export const TRANSFER_MAX_PATH_LENGTH = 140;

/**
 * Códigos estables de error.
 *
 * La interfaz traduce el código; el mensaje interno nunca se muestra. Ningún
 * código transporta rutas, nombres de usuario, IDs ni detalles del sistema de
 * archivos.
 */
export const TRANSFER_ERROR_CODES = [
  'TRANSFER_INPUT_INVALID',
  'TRANSFER_SOURCE_NOT_FOUND',
  'TRANSFER_SOURCE_UNREADABLE',
  'TRANSFER_FORMAT_UNSUPPORTED',
  'TRANSFER_MANIFEST_INVALID',
  'TRANSFER_WORLD_INVALID',
  'TRANSFER_LIMIT_EXCEEDED',
  'TRANSFER_ENTRY_REJECTED',
  'TRANSFER_CHECKSUM_MISMATCH',
  'TRANSFER_ASSET_INVALID',
  'TRANSFER_DESTINATION_UNAVAILABLE',
  'TRANSFER_NO_SPACE',
  'TRANSFER_CANCELLED',
  'TRANSFER_BUSY',
  'TRANSFER_SAVE_FAILED',
  'TRANSFER_UNAVAILABLE',
  'TRANSFER_INTERNAL',
] as const;

export type TransferErrorCode = (typeof TRANSFER_ERROR_CODES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Indica si un valor es una operación de transferencia. */
export function isTransferOperation(
  value: unknown,
): value is TransferOperation {
  return (
    typeof value === 'string' &&
    (TRANSFER_OPERATIONS as readonly string[]).includes(value)
  );
}

/** Indica si un valor es una fase conocida. */
export function isTransferPhase(value: unknown): value is TransferPhase {
  return (
    typeof value === 'string' &&
    (TRANSFER_PHASES as readonly string[]).includes(value)
  );
}

/** Indica si un valor es una unidad de progreso conocida. */
export function isTransferUnit(value: unknown): value is TransferUnit {
  return (
    typeof value === 'string' &&
    (TRANSFER_UNITS as readonly string[]).includes(value)
  );
}

/**
 * Indica si un valor es un nombre de archivo simple.
 *
 * El resultado de exportación llega al renderer y se muestra en la interfaz;
 * nunca debe contener una ruta, un separador ni un intento de traversal.
 */
export function isTransferFileName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('\0') &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes(':')
  );
}

/** Indica si un valor es un código de aviso conocido. */
export function isTransferWarningCode(
  value: unknown,
): value is TransferWarningCode {
  return (
    typeof value === 'string' &&
    (TRANSFER_WARNING_CODES as readonly string[]).includes(value)
  );
}

/** Indica si un valor es un código de error conocido. */
export function isTransferErrorCode(
  value: unknown,
): value is TransferErrorCode {
  return (
    typeof value === 'string' &&
    (TRANSFER_ERROR_CODES as readonly string[]).includes(value)
  );
}

/** Comprueba la forma de un aviso agregado. */
export function isTransferWarning(value: unknown): value is TransferWarning {
  return (
    isRecord(value) &&
    isTransferWarningCode(value.code) &&
    isNonNegativeInteger(value.count)
  );
}

/** Comprueba la forma de una lista de avisos. */
export function isTransferWarningList(
  value: unknown,
): value is readonly TransferWarning[] {
  return Array.isArray(value) && value.every(isTransferWarning);
}

/** Comprueba la forma de los recuentos. */
export function isTransferCounts(value: unknown): value is TransferCounts {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.entities) &&
    isNonNegativeInteger(value.entityTypes) &&
    isNonNegativeInteger(value.relationTypes) &&
    isNonNegativeInteger(value.tags) &&
    isNonNegativeInteger(value.relations) &&
    isNonNegativeInteger(value.versions) &&
    isNonNegativeInteger(value.assets)
  );
}

/** Comprueba la forma de un evento de progreso. */
export function isTransferEvent(value: unknown): value is TransferEvent {
  return (
    isRecord(value) &&
    isTransferOperation(value.operation) &&
    isTransferPhase(value.phase) &&
    isNonNegativeInteger(value.completed) &&
    (value.total === null || isNonNegativeInteger(value.total)) &&
    isNonNegativeInteger(value.warnings)
  );
}

/** Comprueba la forma de un evento de progreso del renderer. */
export function isTransferProgressEvent(
  value: unknown,
): value is TransferProgressEvent {
  return (
    isTransferEvent(value) &&
    isRecord(value) &&
    typeof value.operationId === 'string' &&
    UUID_V7_PATTERN.test(value.operationId) &&
    isTransferUnit(value.unit) &&
    typeof value.cancelable === 'boolean'
  );
}

/** Comprueba la forma del resultado de exportación. */
export function isTransferExportResult(
  value: unknown,
): value is TransferExportResult {
  return (
    isRecord(value) &&
    typeof value.worldId === 'string' &&
    typeof value.worldName === 'string' &&
    isTransferFileName(value.fileName) &&
    isNonNegativeInteger(value.size) &&
    isTransferCounts(value.counts) &&
    isTransferWarningList(value.warnings)
  );
}

/** Comprueba la forma del resultado de importación. */
export function isTransferImportResult(
  value: unknown,
): value is TransferImportResult {
  return (
    isRecord(value) &&
    typeof value.worldId === 'string' &&
    typeof value.worldName === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.slugAdjusted === 'boolean' &&
    isTransferCounts(value.counts) &&
    isTransferWarningList(value.warnings)
  );
}

/** Comprueba la forma del resultado de cancelación. */
export function isTransferCancelResult(
  value: unknown,
): value is TransferCancelResult {
  return isRecord(value) && typeof value.cancelled === 'boolean';
}

/** Comprueba la forma de un resultado de extremo a extremo. */
export function isTransferRunResult<T>(
  value: unknown,
  guard: (data: unknown) => data is T,
): value is TransferRunResult<T> {
  if (!isRecord(value)) {
    return false;
  }

  if (value.status === 'completed') {
    return 'data' in value && guard(value.data);
  }

  if (value.status === 'cancelled') {
    return true;
  }

  return value.status === 'failed' && isTransferErrorCode(value.code);
}

/** Comprueba el resultado de extremo a extremo de una exportación. */
export function isTransferExportRunResult(
  value: unknown,
): value is TransferRunResult<TransferExportResult> {
  return isTransferRunResult(value, isTransferExportResult);
}

/** Comprueba el resultado de extremo a extremo de una importación. */
export function isTransferImportRunResult(
  value: unknown,
): value is TransferRunResult<TransferImportResult> {
  return isTransferRunResult(value, isTransferImportResult);
}
