/**
 * Esquema Drizzle de la tabla `assets`.
 *
 * La base guarda solo metadatos: la ruta es **relativa** a `assets/` y el
 * archivo vive en el sistema de archivos. `world_id` no tiene clave foránea en
 * M0 porque `worlds` llega en M1; esa migración reconstruirá la tabla con
 * `worlds(id) ON DELETE RESTRICT`. El hash es SHA-256 del archivo servido
 * (WebP re-codificado), con 64 caracteres hexadecimales.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

/** Assets locales: imágenes, mapas, documentos y otros archivos. */
export const assets = sqliteTable(
  'assets',
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
