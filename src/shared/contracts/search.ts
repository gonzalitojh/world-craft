/**
 * Contrato compartido de la búsqueda global y de la paleta de comandos.
 *
 * Es un módulo puro: no importa Electron, Node, Zod ni React. El proceso
 * principal valida la entrada con Zod, el preload comprueba la forma de las
 * respuestas con estas guardas y el renderer consume los tipos sin duplicarlos.
 *
 * El resaltado viaja como texto con dos marcadores de control
 * (`SEARCH_HIGHLIGHT_START` y `SEARCH_HIGHLIGHT_END`). El renderer los divide y
 * crea nodos de React: nunca se transporta HTML ni se usa
 * `dangerouslySetInnerHTML`.
 */
import type { IpcResult } from './result';

/** Tipos de documento indexados. */
export const SEARCH_KINDS = ['world', 'entity', 'relation'] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

/** Estados visibles de un documento; la papelera queda fuera del índice. */
export const SEARCH_STATUSES = ['active', 'draft', 'archived'] as const;

export type SearchStatus = (typeof SEARCH_STATUSES)[number];

/** Límites compartidos por la validación del main y la interfaz. */
export const SEARCH_QUERY_MAX_LENGTH = 200;
export const SEARCH_LIMIT_DEFAULT = 30;
export const SEARCH_LIMIT_MAX = 100;
export const SEARCH_SUGGESTION_LIMIT = 8;
export const SEARCH_TOKENS_MAX = 8;
export const SEARCH_OFFSET_MAX = 10_000;

/** Marcadores de resaltado que no pueden aparecer en el texto del usuario. */
export const SEARCH_HIGHLIGHT_START = '\u0001';
export const SEARCH_HIGHLIGHT_END = '\u0002';

/** Filtros combinables de la búsqueda. */
export interface SearchFilters {
  readonly worldId?: string | undefined;
  readonly kind?: SearchKind | undefined;
  readonly entityTypeId?: string | undefined;
  readonly tagId?: string | undefined;
  readonly status?: SearchStatus | undefined;
}

/** Datos de una consulta global. */
export interface SearchQueryInput {
  readonly query: string;
  readonly filters?: SearchFilters | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

/** Un documento encontrado, ya resuelto para la interfaz. */
export interface SearchHit {
  /** Identificador del documento de búsqueda (`<kind>:<sourceId>`). */
  readonly id: string;
  readonly kind: SearchKind;
  /** Identificador del mundo, la ficha o la relación. */
  readonly sourceId: string;
  /**
   * Ficha de contexto para abrir un resultado de relación. Es nula en mundos y
   * fichas.
   */
  readonly contextId: string | null;
  readonly worldId: string;
  readonly worldName: string;
  readonly title: string;
  /** Título con marcadores de resaltado; puede ser igual que `title`. */
  readonly titleHighlight: string;
  /** Fragmento del cuerpo con marcadores de resaltado y elipsis. */
  readonly snippet: string;
  readonly status: SearchStatus;
  readonly isFavorite: boolean;
  readonly updatedAt: number;
}

/** Resultado de una consulta. */
export interface SearchResponse {
  readonly items: readonly SearchHit[];
  readonly total: number;
  readonly tookMs: number;
  /** Términos aproximados usados cuando no había coincidencia exacta. */
  readonly fuzzyTerms: readonly string[];
}

/** Datos para pedir recientes y favoritos. */
export interface SearchSuggestionsInput {
  readonly worldId?: string | undefined;
}

/** Recientes y favoritos para el estado vacío. */
export interface SearchSuggestions {
  readonly recent: readonly SearchHit[];
  readonly favorites: readonly SearchHit[];
}

/** Resultado de reconstruir el índice. */
export interface SearchRebuildResult {
  readonly documents: number;
  readonly tookMs: number;
}

/** API tipada de búsqueda expuesta por el preload. */
export interface WorldCraftSearchApi {
  readonly query: (
    input: SearchQueryInput,
  ) => Promise<IpcResult<SearchResponse>>;
  readonly suggestions: (
    input?: SearchSuggestionsInput,
  ) => Promise<IpcResult<SearchSuggestions>>;
  readonly rebuild: () => Promise<IpcResult<SearchRebuildResult>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Indica si un valor es un tipo de documento admitido. */
export function isSearchKind(value: unknown): value is SearchKind {
  return (
    typeof value === 'string' &&
    (SEARCH_KINDS as readonly string[]).includes(value)
  );
}

/** Indica si un valor es un estado de documento admitido. */
export function isSearchStatus(value: unknown): value is SearchStatus {
  return (
    typeof value === 'string' &&
    (SEARCH_STATUSES as readonly string[]).includes(value)
  );
}

/** Comprueba la forma de un documento encontrado. */
export function isSearchHit(value: unknown): value is SearchHit {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    isSearchKind(value.kind) &&
    typeof value.sourceId === 'string' &&
    (value.contextId === null || typeof value.contextId === 'string') &&
    typeof value.worldId === 'string' &&
    typeof value.worldName === 'string' &&
    typeof value.title === 'string' &&
    typeof value.titleHighlight === 'string' &&
    typeof value.snippet === 'string' &&
    isSearchStatus(value.status) &&
    typeof value.isFavorite === 'boolean' &&
    isTimestamp(value.updatedAt)
  );
}

/** Comprueba la forma de una lista de documentos. */
export function isSearchHitList(value: unknown): value is readonly SearchHit[] {
  return Array.isArray(value) && value.every(isSearchHit);
}

/** Comprueba la forma de una respuesta de búsqueda. */
export function isSearchResponse(value: unknown): value is SearchResponse {
  return (
    isRecord(value) &&
    isSearchHitList(value.items) &&
    typeof value.total === 'number' &&
    Number.isInteger(value.total) &&
    value.total >= 0 &&
    typeof value.tookMs === 'number' &&
    Number.isFinite(value.tookMs) &&
    value.tookMs >= 0 &&
    Array.isArray(value.fuzzyTerms) &&
    value.fuzzyTerms.every((term) => typeof term === 'string')
  );
}

/** Comprueba la forma de las sugerencias. */
export function isSearchSuggestions(
  value: unknown,
): value is SearchSuggestions {
  return (
    isRecord(value) &&
    isSearchHitList(value.recent) &&
    isSearchHitList(value.favorites)
  );
}

/** Comprueba la forma del resultado de reconstrucción. */
export function isSearchRebuildResult(
  value: unknown,
): value is SearchRebuildResult {
  return (
    isRecord(value) &&
    typeof value.documents === 'number' &&
    Number.isInteger(value.documents) &&
    value.documents >= 0 &&
    typeof value.tookMs === 'number' &&
    Number.isFinite(value.tookMs) &&
    value.tookMs >= 0
  );
}
