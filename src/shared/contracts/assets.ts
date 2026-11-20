/**
 * Contrato compartido de los assets locales.
 *
 * El renderer nunca recibe rutas del sistema: solo identificadores y metadatos.
 * Las imágenes se muestran con `wc-asset://asset/<id>` o
 * `wc-asset://thumb/<id>`; el proceso principal resuelve la ruta desde SQLite
 * y valida que el asset pertenezca al mundo (ADR 0005).
 */
import type { IpcResult } from './result';

/** Límites visibles de la galería de una ficha. */
export const ASSET_GALLERY_MAX = 20;

/** Resumen de una imagen local. */
export interface AssetSummary {
  readonly id: string;
  readonly worldId: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
  readonly createdAt: number;
}

/** Petición de importación desde un diálogo nativo. */
export interface AssetImportInput {
  readonly worldId: string;
  /** Texto alternativo opcional para todas las imágenes elegidas. */
  readonly alt?: string | undefined;
}

/** Resultado de una importación; vacío si el usuario cancela. */
export interface AssetImportResult {
  readonly imported: readonly AssetSummary[];
}

/** API tipada de assets expuesta por el preload. */
export interface WorldCraftAssetsApi {
  readonly list: (
    worldId: string,
  ) => Promise<IpcResult<readonly AssetSummary[]>>;
  readonly import: (
    input: AssetImportInput,
  ) => Promise<IpcResult<AssetImportResult>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Comprueba la forma de un resumen de asset. */
export function isAssetSummary(value: unknown): value is AssetSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.worldId === 'string' &&
    (value.width === null || typeof value.width === 'number') &&
    (value.height === null || typeof value.height === 'number') &&
    (value.alt === null || typeof value.alt === 'string') &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    value.createdAt >= 0
  );
}

/** Comprueba la forma de una lista de assets. */
export function isAssetList(value: unknown): value is readonly AssetSummary[] {
  return Array.isArray(value) && value.every(isAssetSummary);
}

/** Comprueba la forma del resultado de importación. */
export function isAssetImportResult(
  value: unknown,
): value is AssetImportResult {
  return (
    isRecord(value) &&
    Array.isArray(value.imported) &&
    value.imported.every(isAssetSummary)
  );
}
