/**
 * Esquema Drizzle de los assets y de su cuarentena.
 *
 * La base guarda solo metadatos: la ruta es **relativa** a `assets/` y el
 * archivo vive en el sistema de archivos. `world_id` referencia `worlds(id)`
 * con `ON DELETE RESTRICT`: un mundo con assets no puede borrarse de forma
 * física sin moverlos antes a la cuarentena. El hash es SHA-256 del archivo
 * servido (WebP re-codificado), con 64 caracteres hexadecimales.
 *
 * `assets_quarantine` conserva los metadatos de filas cuyo mundo ya no existe
 * (migración) o que se retiraron al purgar un mundo. No tiene FK a `worlds`
 * precisamente porque ese mundo puede haber desaparecido. Los archivos no se
 * mueven ni se borran: la ruta relativa original sigue siendo válida mientras
 * el archivo exista. `assets_quarantine_references` audita los vínculos
 * visibles que se desvincularon para que la cuarentena sea verificable.
 */
import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

import { worlds } from './worlds';

/** Assets locales: imágenes, mapas, documentos y otros archivos. */
export const assets = sqliteTable(
  'assets',
  {
    id: text('id').primaryKey().notNull(),
    // El tipo de retorno explícito evita el ciclo de inferencia `assets ↔ worlds`;
    // la referencia se resuelve de forma perezosa al construir las consultas.
    worldId: text('world_id')
      .notNull()
      .references((): AnySQLiteColumn => worlds.id, {
        onUpdate: 'no action',
        onDelete: 'restrict',
      }),
    kind: text('kind').notNull(),
    relativePath: text('relative_path').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt'),
    hash: text('hash').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('assets_world_idx').on(table.worldId),
    index('assets_hash_idx').on(table.hash),
    check(
      'assets_kind_check',
      sql`${table.kind} in ('image', 'map', 'document', 'other')`,
    ),
    check('assets_size_check', sql`${table.size} >= 0`),
    check(
      'assets_hash_check',
      sql`length(${table.hash}) = 64 AND ${table.hash} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
);

/**
 * Cuarentena de metadatos de assets huérfanos.
 *
 * `reason` distingue los huérfanos detectados al migrar (`world-missing`) de
 * los retirados al purgar un mundo (`world-purged`). `quarantined_at` es el
 * instante en milisegundos desde la época.
 */
export const assetsQuarantine = sqliteTable(
  'assets_quarantine',
  {
    id: text('id').primaryKey().notNull(),
    worldId: text('world_id').notNull(),
    kind: text('kind').notNull(),
    relativePath: text('relative_path').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt'),
    hash: text('hash').notNull(),
    createdAt: integer('created_at').notNull(),
    reason: text('reason').notNull(),
    quarantinedAt: integer('quarantined_at').notNull(),
  },
  (table) => [
    index('assets_quarantine_world_idx').on(table.worldId, table.quarantinedAt),
    index('assets_quarantine_hash_idx').on(table.hash),
    check(
      'assets_quarantine_kind_check',
      sql`${table.kind} in ('image', 'map', 'document', 'other')`,
    ),
    check('assets_quarantine_size_check', sql`${table.size} >= 0`),
    check(
      'assets_quarantine_hash_check',
      sql`length(${table.hash}) = 64 AND ${table.hash} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      'assets_quarantine_reason_check',
      sql`${table.reason} in ('world-missing', 'world-purged')`,
    ),
    check(
      'assets_quarantine_timestamp_check',
      sql`${table.quarantinedAt} >= 0`,
    ),
  ],
);

/**
 * Auditoría de los vínculos visibles retirados al mover un asset a cuarentena.
 *
 * `row_id` identifica la fila de origen (`worlds.id`, `entities.id` o
 * `entity_gallery.entity_id`) y `position` conserva el orden de galería.
 */
export const assetsQuarantineReferences = sqliteTable(
  'assets_quarantine_references',
  {
    id: integer('id').primaryKey(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assetsQuarantine.id, {
        onUpdate: 'no action',
        onDelete: 'cascade',
      }),
    tableName: text('table_name').notNull(),
    rowId: text('row_id').notNull(),
    columnName: text('column_name').notNull(),
    position: integer('position'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('assets_quarantine_references_asset_idx').on(table.assetId),
    index('assets_quarantine_references_row_idx').on(
      table.tableName,
      table.rowId,
    ),
    check(
      'assets_quarantine_references_table_check',
      sql`${table.tableName} in ('worlds', 'entities', 'entity_gallery')`,
    ),
    check(
      'assets_quarantine_references_position_check',
      sql`${table.position} is null or ${table.position} >= 0`,
    ),
  ],
);
