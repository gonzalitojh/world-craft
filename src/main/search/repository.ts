/**
 * Repositorio SQL de la búsqueda global.
 *
 * Usa SQL directo porque FTS5, `bm25`, `snippet`, `highlight` y `fts5vocab` no
 * se representan con Drizzle ORM. Todas las consultas usan parámetros
 * enlazados; el único texto interpolado es la estructura de `MATCH`, construida
 * a partir de tokens entrecomillados en `query.ts`.
 *
 * Los documentos viven en `search_documents`, mantenidos por triggers. Este
 * módulo no conoce Electron ni la interfaz y no escribe fuera de la
 * reconstrucción explícita del índice.
 */
import type { SqliteDatabase } from '../db/connection';
import {
  SEARCH_SUGGESTION_LIMIT,
  type SearchFilters,
} from '../../shared/contracts/search';

/** Documento ya resuelto para la interfaz. */
export interface SearchDocumentRow {
  readonly id: string;
  readonly kind: string;
  readonly sourceId: string;
  readonly contextId: string | null;
  readonly worldId: string;
  readonly worldName: string;
  readonly title: string;
  readonly titleHighlight: string;
  readonly snippet: string;
  readonly status: string;
  readonly isFavorite: boolean;
  readonly updatedAt: number;
}

/** Parámetros de una consulta ya normalizada. */
export interface SearchQueryParams {
  readonly match: string;
  readonly filters: SearchFilters;
  readonly limit: number;
  readonly offset: number;
}

/** Candidato del vocabulario para la expansión aproximada. */
export interface VocabularyCandidate {
  readonly term: string;
  readonly documents: number;
}

/** Operaciones del repositorio de búsqueda. */
export interface SearchRepository {
  search(params: SearchQueryParams): readonly SearchDocumentRow[];
  count(match: string, filters: SearchFilters): number;
  vocabularyCandidates(
    token: string,
    limit?: number,
  ): readonly VocabularyCandidate[];
  suggestions(worldId: string | undefined): {
    readonly recent: readonly SearchDocumentRow[];
    readonly favorites: readonly SearchDocumentRow[];
  };
  rebuild(): number;
}

interface DocumentSqlRow {
  readonly id: string;
  readonly kind: string;
  readonly source_id: string;
  readonly context_id: string | null;
  readonly world_id: string;
  readonly world_name: string;
  readonly title: string;
  readonly title_highlight: string;
  readonly snippet: string;
  readonly status: string;
  readonly is_favorite: number;
  readonly updated_at: number;
}

interface SuggestionSqlRow extends Omit<DocumentSqlRow, 'title_highlight'> {
  readonly snippet: string;
}

const DOCUMENT_COLUMNS = `
  d.id AS id,
  d.kind AS kind,
  d.source_id AS source_id,
  d.context_id AS context_id,
  d.world_id AS world_id,
  w.name AS world_name,
  d.title AS title,
  d.status AS status,
  d.is_favorite AS is_favorite,
  d.updated_at AS updated_at
`;

const SUGGESTION_COLUMNS = `
  d.id AS id,
  d.kind AS kind,
  d.source_id AS source_id,
  d.context_id AS context_id,
  d.world_id AS world_id,
  w.name AS world_name,
  d.title AS title,
  d.status AS status,
  d.is_favorite AS is_favorite,
  d.updated_at AS updated_at,
  CASE
    WHEN length(replace(d.body, char(10), ' ')) > 160
      THEN substr(replace(d.body, char(10), ' '), 1, 160) || '…'
    ELSE replace(d.body, char(10), ' ')
  END AS snippet
`;

const DELETED_WORLD_FILTER = 'w.deleted_at IS NULL';

const DOCUMENT_COLUMNS_INSERT = `
  id, kind, source_id, context_id, related_id, world_id, title, body,
  keywords, entity_type_id, status, is_favorite, created_at, updated_at
`;

interface FilterClause {
  readonly sql: string;
  readonly params: readonly (string | number)[];
}

function buildFilterClause(filters: SearchFilters): FilterClause {
  const conditions: string[] = [DELETED_WORLD_FILTER];
  const params: (string | number)[] = [];

  if (filters.worldId !== undefined) {
    conditions.push('d.world_id = ?');
    params.push(filters.worldId);
  }

  if (filters.kind !== undefined) {
    conditions.push('d.kind = ?');
    params.push(filters.kind);
  }

  if (filters.entityTypeId !== undefined) {
    conditions.push('d.entity_type_id = ?');
    params.push(filters.entityTypeId);
  }

  if (filters.status !== undefined) {
    conditions.push('d.status = ?');
    params.push(filters.status);
  }

  if (filters.tagId !== undefined) {
    conditions.push(
      `EXISTS (
        SELECT 1 FROM entity_tags et
        WHERE et.entity_id = d.source_id AND et.tag_id = ?
      )`,
    );
    params.push(filters.tagId);
  }

  return { sql: conditions.join(' AND '), params };
}

function toDocumentRow(row: DocumentSqlRow): SearchDocumentRow {
  return {
    id: row.id,
    kind: row.kind,
    sourceId: row.source_id,
    contextId: row.context_id,
    worldId: row.world_id,
    worldName: row.world_name,
    title: row.title,
    titleHighlight: row.title_highlight,
    snippet: row.snippet,
    status: row.status,
    isFavorite: row.is_favorite === 1,
    updatedAt: row.updated_at,
  };
}

function toSuggestionRow(row: SuggestionSqlRow): SearchDocumentRow {
  return {
    id: row.id,
    kind: row.kind,
    sourceId: row.source_id,
    contextId: row.context_id,
    worldId: row.world_id,
    worldName: row.world_name,
    title: row.title,
    titleHighlight: row.title,
    snippet: row.snippet,
    status: row.status,
    isFavorite: row.is_favorite === 1,
    updatedAt: row.updated_at,
  };
}

/** Crea el repositorio sobre la conexión compartida. */
export function createSearchRepository(
  sqlite: SqliteDatabase,
): SearchRepository {
  return {
    search({ match, filters, limit, offset }) {
      const filter = buildFilterClause(filters);
      const rows = sqlite
        .prepare(
          `SELECT
            ${DOCUMENT_COLUMNS},
            highlight(search_fts, 0, char(1), char(2)) AS title_highlight,
            snippet(search_fts, 1, char(1), char(2), '…', 18) AS snippet
          FROM search_fts
          JOIN search_documents d ON d.rowid = search_fts.rowid
          JOIN worlds w ON w.id = d.world_id
          WHERE search_fts MATCH ?
            AND ${filter.sql}
          ORDER BY bm25(search_fts, 12.0, 1.0, 4.0) ASC, d.updated_at DESC
          LIMIT ? OFFSET ?`,
        )
        .all(match, ...filter.params, limit, offset) as DocumentSqlRow[];

      return rows.map(toDocumentRow);
    },

    count(match, filters) {
      const filter = buildFilterClause(filters);
      const row = sqlite
        .prepare(
          `SELECT COUNT(*) AS total
          FROM search_fts
          JOIN search_documents d ON d.rowid = search_fts.rowid
          JOIN worlds w ON w.id = d.world_id
          WHERE search_fts MATCH ?
            AND ${filter.sql}`,
        )
        .get(match, ...filter.params) as { readonly total: number } | undefined;

      return row?.total ?? 0;
    },

    vocabularyCandidates(token, limit = 4_000) {
      if (token.length < 4) {
        return [];
      }

      // La inicial debe coincidir: acota el vocabulario sin convertir el
      // fallback en un recorrido completo para cada pulsación.
      const rows = sqlite
        .prepare(
          `SELECT term, doc AS documents
          FROM search_vocabulary
          WHERE length(term) BETWEEN ? AND ?
            AND term LIKE ?
          ORDER BY doc DESC, term ASC
          LIMIT ?`,
        )
        .all(
          Math.max(1, token.length - 2),
          token.length + 2,
          `${token.slice(0, 1)}%`,
          limit,
        ) as { readonly term: string; readonly documents: number }[];

      return rows;
    },

    suggestions(worldId) {
      const worldCondition = worldId === undefined ? '' : 'AND d.world_id = ?';
      const worldParams = worldId === undefined ? [] : [worldId];
      const recent = sqlite
        .prepare(
          `SELECT ${SUGGESTION_COLUMNS}
          FROM search_documents d
          JOIN worlds w ON w.id = d.world_id
          WHERE ${DELETED_WORLD_FILTER}
            ${worldCondition}
          ORDER BY d.updated_at DESC, d.title ASC
          LIMIT ?`,
        )
        .all(...worldParams, SEARCH_SUGGESTION_LIMIT) as SuggestionSqlRow[];
      const favorites = sqlite
        .prepare(
          `SELECT ${SUGGESTION_COLUMNS}
          FROM search_documents d
          JOIN worlds w ON w.id = d.world_id
          WHERE ${DELETED_WORLD_FILTER}
            AND d.kind = 'entity'
            AND d.is_favorite = 1
            ${worldCondition}
          ORDER BY d.updated_at DESC, d.title ASC
          LIMIT ?`,
        )
        .all(...worldParams, SEARCH_SUGGESTION_LIMIT) as SuggestionSqlRow[];

      return {
        recent: recent.map(toSuggestionRow),
        favorites: favorites.map(toSuggestionRow),
      };
    },

    rebuild() {
      const rebuild = sqlite.transaction(() => {
        // Primero se sanea FTS con el contenido actual: así los triggers de
        // borrado no intentan quitar de un índice ya desincronizado.
        sqlite
          .prepare("INSERT INTO search_fts (search_fts) VALUES ('rebuild')")
          .run();

        sqlite
          .prepare(
            `DELETE FROM search_documents
            WHERE id NOT IN (
              SELECT id FROM search_world_documents
              UNION SELECT id FROM search_entity_documents
              UNION SELECT id FROM search_relation_documents
            )`,
          )
          .run();

        for (const view of [
          'search_world_documents',
          'search_entity_documents',
          'search_relation_documents',
        ]) {
          sqlite
            .prepare(
              `INSERT OR REPLACE INTO search_documents (${DOCUMENT_COLUMNS_INSERT})
              SELECT ${DOCUMENT_COLUMNS_INSERT} FROM ${view}`,
            )
            .run();
        }

        // El contenido ya se indexó por los triggers; `rebuild` verifica y
        // reconstruye la tabla FTS desde search_documents.
        sqlite
          .prepare("INSERT INTO search_fts (search_fts) VALUES ('rebuild')")
          .run();

        const row = sqlite
          .prepare('SELECT COUNT(*) AS total FROM search_documents')
          .get() as { readonly total: number } | undefined;

        return row?.total ?? 0;
      });

      return rebuild();
    },
  };
}
