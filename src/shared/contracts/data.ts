/**
 * Contrato compartido de datos y mantenimiento (#79).
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal lo usa para construir respuestas, el preload comprueba su forma y
 * el renderer consume los tipos. Ningún resultado incluye rutas, hashes ni
 * nombres internos.
 */
import {
  isTransferCounts,
  isTransferFileName,
  isTransferWarningList,
  type TransferCounts,
  type TransferWarning,
} from './transfer';

/** Carpetas que Ajustes puede abrir. */
export const DATA_FOLDERS = [
  'data',
  'assets',
  'backups',
  'logs',
  'imports',
  'exports',
] as const;

export type DataFolder = (typeof DATA_FOLDERS)[number];

/** Indica si un valor es una carpeta de datos admitida. */
export function isDataFolder(value: unknown): value is DataFolder {
  return (
    typeof value === 'string' &&
    (DATA_FOLDERS as readonly string[]).includes(value)
  );
}

/** Token exacto del borrado total. */
export const DATA_DELETE_ALL_CONFIRMATION = 'delete-all-data';

/** Token exacto de la purga de imágenes huérfanas. */
export const DATA_ORPHAN_PURGE_CONFIRMATION = 'purge-orphans';

/** Formatos abiertos de la biblioteca y de la copia previa al borrado. */
export const DATA_LIBRARY_FORMAT = {
  id: 'world-craft-library',
  version: 1,
} as const;

export const DATA_LIBRARY_SETTINGS_FORMAT = {
  id: 'world-craft-library-settings',
  version: 1,
} as const;

export const DATA_PRE_DELETE_FORMAT = {
  id: 'world-craft-pre-delete',
  version: 1,
} as const;

export const DATA_PRE_DELETE_ASSETS_FORMAT = {
  id: 'world-craft-pre-delete-assets',
  version: 1,
} as const;

/** Categorías de la medición de uso. */
export const DATA_USAGE_CATEGORIES = [
  'database',
  'assets',
  'backups',
  'logs',
  'temporary',
] as const;

export type DataUsageCategory = (typeof DATA_USAGE_CATEGORIES)[number];

/** Categorías del borrado total y de sus resultados parciales. */
export const DATA_DELETE_CATEGORIES = [
  'temporaries',
  'database',
  'assets',
  'logs',
  'backups',
] as const;

export type DataDeleteCategory = (typeof DATA_DELETE_CATEGORIES)[number];

/** Códigos estables de error del servicio de datos. */
export const DATA_ERROR_CODES = [
  'DATA_UNAVAILABLE',
  'DATA_BUSY',
  'DATA_FOLDER_INVALID',
  'DATA_FOLDER_OPEN_FAILED',
  'DATA_COUNTS_FAILED',
  'DATA_ORPHAN_CONFIRMATION_REQUIRED',
  'DATA_ORPHAN_PLAN_FAILED',
  'DATA_ORPHAN_PURGE_FAILED',
  'DATA_LIBRARY_INPUT_INVALID',
  'DATA_LIBRARY_ENTRY_INVALID',
  'DATA_LIBRARY_MANIFEST_INVALID',
  'DATA_LIBRARY_SETTINGS_INVALID',
  'DATA_LIBRARY_WORLD_FAILED',
  'DATA_LIBRARY_DATABASE_FAILED',
  'DATA_LIBRARY_VERIFY_FAILED',
  'DATA_LIBRARY_CREATE_FAILED',
  'DATA_LIBRARY_NO_SPACE',
  'DATA_LIBRARY_DESTINATION_UNAVAILABLE',
  'DATA_DELETE_CONFIRMATION_REQUIRED',
  'DATA_DELETE_ROOT_INVALID',
  'DATA_DELETE_COPY_FAILED',
  'DATA_DELETE_FAILED',
] as const;

export type DataErrorCode = (typeof DATA_ERROR_CODES)[number];

const DATA_ERROR_CODE_SET: ReadonlySet<string> = new Set(DATA_ERROR_CODES);

/** Indica si un valor es un código de datos conocido. */
export function isDataErrorCode(value: unknown): value is DataErrorCode {
  return typeof value === 'string' && DATA_ERROR_CODE_SET.has(value);
}

/** Mundos vivos, archivados y en papelera. */
export interface DataWorldCounts {
  readonly active: number;
  readonly archived: number;
  readonly trash: number;
}

/** Resumen cuantitativo sin rutas ni nombres. */
export interface DataCounts {
  readonly worlds: DataWorldCounts;
  readonly entities: number;
  readonly assets: number;
  readonly backups: number;
}

/** Medición de una categoría. */
export interface DataUsageCategoryUsage {
  readonly bytes: number;
  readonly entries: number;
  readonly partial: boolean;
}

/** Medición completa, apta para el renderer: solo números. */
export interface DataUsage {
  readonly totalBytes: number;
  readonly totalEntries: number;
  readonly partial: boolean;
  readonly categories: Readonly<
    Record<DataUsageCategory, DataUsageCategoryUsage>
  >;
}

/** Resumen del plan de huérfanos sin rutas ni nombres de archivo. */
export interface DataOrphanSummary {
  readonly purgeableFiles: number;
  readonly unreferencedFiles: number;
  readonly orphanThumbnails: number;
  readonly temporaryFiles: number;
  readonly missingFiles: number;
  readonly unexpectedEntries: number;
  readonly suspiciousLinks: number;
  readonly recoverableBytes: number;
}

/** Resultado de la purga sin rutas ni nombres. */
export interface DataOrphanPurgeResult {
  readonly purgedFiles: number;
  readonly purgedBytes: number;
  readonly backupCreated: boolean;
}

/** Resultado de abrir una carpeta. */
export interface DataOpenFolderResult {
  readonly opened: true;
}

/** Resultado de la biblioteca total. */
export type DataLibraryResult =
  | {
      readonly status: 'completed';
      readonly fileName: string;
      readonly size: number;
      readonly worlds: number;
      readonly counts: TransferCounts;
      readonly warnings: readonly TransferWarning[];
    }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly code: DataErrorCode };

/** Recuentos del borrado total. */
export interface DataDeleteCounts {
  readonly databaseFiles: number;
  readonly assetFiles: number;
  readonly logEntries: number;
  readonly temporaryEntries: number;
  readonly backupDirectories: number;
}

/** Resultado del borrado total. */
export type DataDeleteResult =
  | {
      readonly status: 'deleted';
      readonly restartRequired: true;
      readonly counts: DataDeleteCounts;
      readonly remaining: readonly [];
    }
  | {
      readonly status: 'partial';
      readonly restartRequired: boolean;
      readonly counts: DataDeleteCounts;
      readonly remaining: readonly DataDeleteCategory[];
    }
  | {
      readonly status: 'failed';
      readonly code: DataErrorCode;
      readonly restartRequired: false;
      readonly counts: DataDeleteCounts;
      readonly remaining: readonly [];
    };

/** Entrada pública del borrado total; el token se fija en el preload. */
export interface DataDeleteRequest {
  readonly keepBackups: boolean;
}

/** Resultado genérico de una operación de datos. */
export type DataResult<T> =
  | { readonly status: 'completed'; readonly data: T }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly code: DataErrorCode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);

  return (
    actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDataWorldCounts(value: unknown): value is DataWorldCounts {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['active', 'archived', 'trash']) &&
    isNonNegativeInteger(value.active) &&
    isNonNegativeInteger(value.archived) &&
    isNonNegativeInteger(value.trash)
  );
}

/** Guarda estricta del resumen. */
export function isDataCounts(value: unknown): value is DataCounts {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['worlds', 'entities', 'assets', 'backups']) &&
    isDataWorldCounts(value.worlds) &&
    isNonNegativeInteger(value.entities) &&
    isNonNegativeInteger(value.assets) &&
    isNonNegativeInteger(value.backups)
  );
}

function isUsageCategory(value: unknown): value is DataUsageCategoryUsage {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['bytes', 'entries', 'partial']) &&
    isNonNegativeInteger(value.bytes) &&
    isNonNegativeInteger(value.entries) &&
    typeof value.partial === 'boolean'
  );
}

/** Guarda estricta de la medición de uso. */
export function isDataUsage(value: unknown): value is DataUsage {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'totalBytes',
      'totalEntries',
      'partial',
      'categories',
    ]) ||
    !isNonNegativeInteger(value.totalBytes) ||
    !isNonNegativeInteger(value.totalEntries) ||
    typeof value.partial !== 'boolean'
  ) {
    return false;
  }

  const categories = value.categories;

  if (
    !isRecord(categories) ||
    !hasExactKeys(categories, DATA_USAGE_CATEGORIES)
  ) {
    return false;
  }

  return DATA_USAGE_CATEGORIES.every((category) =>
    isUsageCategory(categories[category]),
  );
}

/** Guarda estricta del resumen de huérfanos. */
export function isDataOrphanSummary(
  value: unknown,
): value is DataOrphanSummary {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'purgeableFiles',
      'unreferencedFiles',
      'orphanThumbnails',
      'temporaryFiles',
      'missingFiles',
      'unexpectedEntries',
      'suspiciousLinks',
      'recoverableBytes',
    ])
  ) {
    return false;
  }

  return [
    'purgeableFiles',
    'unreferencedFiles',
    'orphanThumbnails',
    'temporaryFiles',
    'missingFiles',
    'unexpectedEntries',
    'suspiciousLinks',
    'recoverableBytes',
  ].every((key) => isNonNegativeInteger(value[key]));
}

/** Guarda estricta del resultado de purga. */
export function isDataOrphanPurgeResult(
  value: unknown,
): value is DataOrphanPurgeResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['purgedFiles', 'purgedBytes', 'backupCreated']) &&
    isNonNegativeInteger(value.purgedFiles) &&
    isNonNegativeInteger(value.purgedBytes) &&
    typeof value.backupCreated === 'boolean'
  );
}

/** Guarda estricta de la apertura de carpeta. */
export function isDataOpenFolderResult(
  value: unknown,
): value is DataOpenFolderResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['opened']) &&
    value.opened === true
  );
}

/** Guarda estricta de la biblioteca total. */
export function isDataLibraryResult(
  value: unknown,
): value is DataLibraryResult {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false;
  }

  if (value.status === 'cancelled') {
    return hasExactKeys(value, ['status']);
  }

  if (value.status === 'failed') {
    return (
      hasExactKeys(value, ['status', 'code']) &&
      isDataErrorCode(value.code)
    );
  }

  return (
    value.status === 'completed' &&
    hasExactKeys(value, [
      'status',
      'fileName',
      'size',
      'worlds',
      'counts',
      'warnings',
    ]) &&
    isTransferFileName(value.fileName) &&
    isNonNegativeInteger(value.size) &&
    isNonNegativeInteger(value.worlds) &&
    isTransferCounts(value.counts) &&
    isTransferWarningList(value.warnings)
  );
}

function isDataDeleteCounts(value: unknown): value is DataDeleteCounts {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'databaseFiles',
      'assetFiles',
      'logEntries',
      'temporaryEntries',
      'backupDirectories',
    ]) &&
    isNonNegativeInteger(value.databaseFiles) &&
    isNonNegativeInteger(value.assetFiles) &&
    isNonNegativeInteger(value.logEntries) &&
    isNonNegativeInteger(value.temporaryEntries) &&
    isNonNegativeInteger(value.backupDirectories)
  );
}

function isDeleteRemaining(
  value: unknown,
): value is readonly DataDeleteCategory[] {
  return (
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((item) =>
      (DATA_DELETE_CATEGORIES as readonly unknown[]).includes(item),
    )
  );
}

/** Guarda estricta del borrado total. */
export function isDataDeleteResult(value: unknown): value is DataDeleteResult {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false;
  }

  if (value.status === 'deleted') {
    return (
      hasExactKeys(value, ['status', 'restartRequired', 'counts', 'remaining']) &&
      value.restartRequired === true &&
      isDataDeleteCounts(value.counts) &&
      Array.isArray(value.remaining) &&
      value.remaining.length === 0
    );
  }

  if (value.status === 'partial') {
    return (
      hasExactKeys(value, ['status', 'restartRequired', 'counts', 'remaining']) &&
      typeof value.restartRequired === 'boolean' &&
      isDataDeleteCounts(value.counts) &&
      isDeleteRemaining(value.remaining)
    );
  }

  return (
    value.status === 'failed' &&
    hasExactKeys(value, [
      'status',
      'code',
      'restartRequired',
      'counts',
      'remaining',
    ]) &&
    isDataErrorCode(value.code) &&
    value.restartRequired === false &&
    isDataDeleteCounts(value.counts) &&
    Array.isArray(value.remaining) &&
    value.remaining.length === 0
  );
}

/** Guarda genérica de `DataResult<T>` con una guarda concreta de `T`. */
export function isDataResult<T>(
  value: unknown,
  guard: (data: unknown) => data is T,
): value is DataResult<T> {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false;
  }

  if (value.status === 'completed') {
    return hasExactKeys(value, ['status', 'data']) && guard(value.data);
  }

  if (value.status === 'cancelled') {
    return hasExactKeys(value, ['status']);
  }

  return (
    value.status === 'failed' &&
    hasExactKeys(value, ['status', 'code']) &&
    isDataErrorCode(value.code)
  );
}
