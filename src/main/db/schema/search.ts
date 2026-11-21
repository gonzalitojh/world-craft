/**
 * Esquema Drizzle de los documentos de búsqueda.
 *
 * `search_documents` es un índice materializado y reconstruible: nunca es la
 * fuente de verdad. Cada fila resume un mundo, una ficha o una relación con el
 * texto que se indexa en `search_fts`, más los campos que permiten filtrar sin
 * unir todas las tablas.
 *
 * La tabla virtual FTS5, el vocabulario, las vistas y los triggers no se
 * representan aquí porque Drizzle Kit no los modela: viven en la migración
 * `0006_search` y se documentan en `docs/base-de-datos/esquema.md`. Los tipos
 * `map`, `manuscript` y `scene` quedan reservados en el CHECK para sus
 * migraciones de M2.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { worlds } from './worlds';

/** Documento indexado para la búsqueda global. */
export const searchDocuments = sqliteTable(
  'search_documents',
  {
    /** `<kind>:<sourceId>`, estable entre reconstrucciones. */
    id: text('id').primaryKey().notNull(),
    kind: text('kind').notNull(),
    sourceId: text('source_id').notNull(),
    /** Ficha de origen de una relación; nula en mundos y fichas. */
    contextId: text('context_id'),
    /** Destino de una relación; nulo en mundos y fichas. */
    relatedId: text('related_id'),
    worldId: text('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    /** Alias y etiquetas; texto adicional sin resaltado principal. */
    keywords: text('keywords').notNull().default(''),
    entityTypeId: text('entity_type_id'),
    status: text('status').notNull().default('active'),
    isFavorite: integer('is_favorite').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('search_documents_kind_source_uq').on(
      table.kind,
      table.sourceId,
    ),
    index('search_documents_world_kind_idx').on(
      table.worldId,
      table.kind,
      table.updatedAt,
    ),
    index('search_documents_world_updated_idx').on(
      table.worldId,
      table.updatedAt,
    ),
    index('search_documents_type_idx').on(table.entityTypeId),
    index('search_documents_favorite_idx').on(table.isFavorite),
    index('search_documents_context_idx').on(table.kind, table.contextId),
    index('search_documents_related_idx').on(table.kind, table.relatedId),
    check(
      'search_documents_kind_check',
      sql`${table.kind} in ('world', 'entity', 'relation', 'map', 'manuscript', 'scene')`,
    ),
    check(
      'search_documents_status_check',
      sql`${table.status} in ('active', 'draft', 'archived')`,
    ),
    check(
      'search_documents_favorite_check',
      sql`${table.isFavorite} in (0, 1)`,
    ),
    check(
      'search_documents_title_check',
      sql`length(${table.title}) between 1 and 300`,
    ),
  ],
);
