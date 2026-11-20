/**
 * Servicio de dominio de la búsqueda global.
 *
 * Orquesta la tokenización, la consulta FTS5, la expansión aproximada, las
 * sugerencias y la reconstrucción. No conoce Electron ni IPC: recibe la
 * conexión compartida y devuelve los tipos del contrato.
 *
 * Reglas:
 * - Una consulta vacía o sin tokens no toca el índice y devuelve una lista
 *   vacía con tiempo cero.
 * - Primero se busca la coincidencia exacta por prefijos; solo si no hay
 *   ninguna se prueba el vocabulario del índice con una distancia de edición
 *   acotada. Nunca se consulta un servicio externo.
 * - Los filtros se combinan en SQL y no amplían el ámbito de un mundo.
 */
import {
  SEARCH_LIMIT_DEFAULT,
  SEARCH_LIMIT_MAX,
  SEARCH_OFFSET_MAX,
  isSearchKind,
  isSearchStatus,
  type SearchHit,
  type SearchKind,
  type SearchQueryInput,
  type SearchRebuildResult,
  type SearchResponse,
  type SearchStatus,
  type SearchSuggestions,
  type SearchSuggestionsInput,
} from '../../shared/contracts/search';
import type { SqliteDatabase } from '../db/connection';
import {
  buildMatchExpression,
  pickFuzzyExpansions,
  tokenizeQuery,
} from './query';
import { createSearchRepository, type SearchDocumentRow } from './repository';

/** Servicio de búsqueda. */
export interface SearchService {
  query(input: SearchQueryInput): SearchResponse;
  suggestions(input?: SearchSuggestionsInput): SearchSuggestions;
  rebuild(): SearchRebuildResult;
}

/** Opciones del servicio; el reloj se inyecta en las pruebas. */
export interface SearchServiceOptions {
  readonly sqlite: SqliteDatabase;
  readonly now?: () => number;
}

function toHit(row: SearchDocumentRow): SearchHit | null {
  if (!isSearchKind(row.kind) || !isSearchStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    kind: row.kind as SearchKind,
    sourceId: row.sourceId,
    contextId: row.contextId,
    worldId: row.worldId,
    worldName: row.worldName,
    title: row.title,
    titleHighlight: row.titleHighlight,
    snippet: row.snippet,
    status: row.status as SearchStatus,
    isFavorite: row.isFavorite,
    updatedAt: row.updatedAt,
  };
}

function toHits(rows: readonly SearchDocumentRow[]): readonly SearchHit[] {
  return rows.map(toHit).filter((hit): hit is SearchHit => hit !== null);
}

/** Crea el servicio sobre la conexión compartida del proceso principal. */
export function createSearchService(
  options: SearchServiceOptions,
): SearchService {
  const repository = createSearchRepository(options.sqlite);
  const now = options.now ?? (() => performance.now());

  const elapsed = (start: number): number =>
    Math.max(0, Math.round(now() - start));

  return {
    query(input) {
      const start = now();
      const tokens = tokenizeQuery(input.query);

      if (tokens.length === 0) {
        return { items: [], total: 0, tookMs: 0, fuzzyTerms: [] };
      }

      const filters = input.filters ?? {};
      const limit = Math.min(
        Math.max(1, input.limit ?? SEARCH_LIMIT_DEFAULT),
        SEARCH_LIMIT_MAX,
      );
      const offset = Math.min(
        Math.max(0, input.offset ?? 0),
        SEARCH_OFFSET_MAX,
      );
      const exactMatch = buildMatchExpression(tokens.map((token) => [token]));
      const exactTotal = repository.count(exactMatch, filters);

      if (exactTotal > 0) {
        return {
          items: toHits(
            repository.search({
              match: exactMatch,
              filters,
              limit,
              offset,
            }),
          ),
          total: exactTotal,
          tookMs: elapsed(start),
          fuzzyTerms: [],
        };
      }

      const groups = tokens.map((token) => [
        token,
        ...pickFuzzyExpansions(token, repository.vocabularyCandidates(token)),
      ]);
      const fuzzyTerms = [
        ...new Set(groups.flatMap((group) => group.slice(1))),
      ];
      const fuzzyMatch = buildMatchExpression(groups);

      if (fuzzyTerms.length === 0 || fuzzyMatch === exactMatch) {
        return {
          items: [],
          total: 0,
          tookMs: elapsed(start),
          fuzzyTerms: [],
        };
      }

      const fuzzyTotal = repository.count(fuzzyMatch, filters);

      if (fuzzyTotal === 0) {
        return {
          items: [],
          total: 0,
          tookMs: elapsed(start),
          fuzzyTerms: [],
        };
      }

      return {
        items: toHits(
          repository.search({
            match: fuzzyMatch,
            filters,
            limit,
            offset,
          }),
        ),
        total: fuzzyTotal,
        tookMs: elapsed(start),
        fuzzyTerms,
      };
    },

    suggestions(input) {
      const suggestions = repository.suggestions(input?.worldId);

      return {
        recent: toHits(suggestions.recent),
        favorites: toHits(suggestions.favorites),
      };
    },

    rebuild() {
      const start = now();
      const documents = repository.rebuild();

      return { documents, tookMs: elapsed(start) };
    },
  };
}

/**
 * Servicio de sustitución cuando la base no está disponible (modo seguro).
 *
 * Cualquier llamada lanza y el router la convierte en `INTERNAL_ERROR`; la
 * interfaz muestra un estado de error en lugar de resultados inventados.
 */
export function createUnavailableSearchService(): SearchService {
  const unavailable = (): never => {
    throw new Error('La búsqueda no está disponible en modo seguro.');
  };

  return {
    query: unavailable,
    suggestions: unavailable,
    rebuild: unavailable,
  };
}
