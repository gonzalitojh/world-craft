/**
 * Contrato compartido del historial de versiones de la descripción.
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal agrupa las versiones automáticas por ráfaga, guarda las manuales
 * con etiqueta y protege las de seguridad previas a una restauración.
 *
 * La lista **no envía el documento ProseMirror completo**: solo metadatos y
 * una vista previa de texto plano recortada. Restaurar es una operación por
 * `versionId` en el proceso principal, así que el renderer nunca manipula el
 * JSON histórico.
 */
import type { IpcResult } from './result';

/** Orígenes de una versión. El texto visible se traduce en la interfaz. */
export const VERSION_ORIGINS = ['auto', 'manual', 'restore'] as const;

export type VersionOrigin = (typeof VERSION_ORIGINS)[number];

/** Longitud máxima de la etiqueta manual. */
export const VERSION_LABEL_MAX_LENGTH = 120;

/** Longitud máxima de la vista previa de texto plano. */
export const VERSION_PREVIEW_MAX_LENGTH = 2_000;

/** Ventana de agrupación de una ráfaga de autoguardado. */
export const VERSION_COALESCE_WINDOW_MS = 300_000;

/** Máximo de versiones automáticas por ficha. */
export const AUTO_VERSION_MAX = 20;

/** Retención de las versiones automáticas. */
export const AUTO_VERSION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Tope duro de versiones manuales por ficha. */
export const MANUAL_VERSION_MAX = 50;

/** Límite de la lista de historial. */
export const VERSION_LIST_LIMIT_DEFAULT = 100;
export const VERSION_LIST_LIMIT_MAX = 200;

/** Metadatos de una versión para el historial. */
export interface EntityVersionSummary {
  readonly id: string;
  readonly entityId: string;
  readonly origin: VersionOrigin;
  readonly label: string | null;
  readonly createdAt: number;
  /** Texto plano recortado; nunca el documento completo. */
  readonly descriptionTextPreview: string;
}

/** Datos para listar el historial de una ficha viva. */
export interface VersionListInput {
  readonly worldId: string;
  readonly entityId: string;
  readonly limit?: number | undefined;
}

/** Datos para guardar una versión manual. */
export interface VersionCreateInput {
  readonly worldId: string;
  readonly entityId: string;
  readonly label: string;
}

/** Resultado de guardar una versión manual. */
export type VersionCreateResult =
  | { readonly created: true; readonly version: EntityVersionSummary }
  | { readonly created: false; readonly reason: 'not-found' | 'manual-limit' };

/** Datos para restaurar una versión concreta. */
export interface VersionRestoreInput {
  readonly worldId: string;
  readonly entityId: string;
  readonly versionId: string;
}

/** Resultado de restaurar una versión. */
export type VersionRestoreResult =
  | { readonly restored: true }
  | { readonly restored: false; readonly reason: 'not-found' | 'unchanged' };

/** API tipada del historial de versiones expuesta por el preload. */
export interface WorldCraftVersionsApi {
  readonly list: (
    input: VersionListInput,
  ) => Promise<IpcResult<readonly EntityVersionSummary[]>>;
  readonly create: (
    input: VersionCreateInput,
  ) => Promise<IpcResult<VersionCreateResult>>;
  readonly restore: (
    input: VersionRestoreInput,
  ) => Promise<IpcResult<VersionRestoreResult>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Indica si un valor es un origen de versión admitido. */
export function isVersionOrigin(value: unknown): value is VersionOrigin {
  return (
    typeof value === 'string' &&
    (VERSION_ORIGINS as readonly string[]).includes(value)
  );
}

/** Comprueba la forma de los metadatos de una versión. */
export function isEntityVersionSummary(
  value: unknown,
): value is EntityVersionSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.entityId === 'string' &&
    isVersionOrigin(value.origin) &&
    (value.label === null || typeof value.label === 'string') &&
    isTimestamp(value.createdAt) &&
    typeof value.descriptionTextPreview === 'string'
  );
}

/** Comprueba la forma de la lista de historial. */
export function isEntityVersionList(
  value: unknown,
): value is readonly EntityVersionSummary[] {
  return Array.isArray(value) && value.every(isEntityVersionSummary);
}

/** Comprueba la forma del resultado de guardar una versión. */
export function isVersionCreateResult(
  value: unknown,
): value is VersionCreateResult {
  if (!isRecord(value) || typeof value.created !== 'boolean') {
    return false;
  }

  if (value.created) {
    return isEntityVersionSummary(value.version);
  }

  return value.reason === 'not-found' || value.reason === 'manual-limit';
}

/** Comprueba la forma del resultado de restaurar una versión. */
export function isVersionRestoreResult(
  value: unknown,
): value is VersionRestoreResult {
  if (!isRecord(value) || typeof value.restored !== 'boolean') {
    return false;
  }

  if (value.restored) {
    return true;
  }

  return value.reason === 'not-found' || value.reason === 'unchanged';
}
