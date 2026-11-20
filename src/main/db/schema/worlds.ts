/**
 * Esquema Drizzle de los mundos y su registro de actividad.
 *
 * `worlds` es la raíz del contenido: cada ficha, mapa, manuscrito o partida
 * pertenece a un mundo. La portada es una referencia opcional a `assets`; la
 * galería y su selector llegan con la issue de imagen del mundo.
 *
 * Los borrados son lógicos (`deleted_at`) y el archivo (`archived_at`) no borra
 * nada: la papelera y la purga definitiva viven en una issue posterior. El
 * `slug` es único en toda la base, también para mundos archivados o en
 * papelera, de modo que nunca se reutiliza el identificador de una URL o una
 * exportación anterior.
 *
 * `activity_log` guarda acciones del mundo y, más adelante, de fichas, mapas,
 * escenas y partidas. `entity_id` es opcional porque una acción puede referirse
 * al mundo completo. `diff` es JSON validado por la aplicación.
 */
import { desc, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { assets } from './assets';

/** Mundos de la aplicación. */
export const worlds = sqliteTable(
  'worlds',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary'),
    /** Texto plano hasta que llegue el editor enriquecido compartido. */
    description: text('description'),
    coverAssetId: text('cover_asset_id').references(() => assets.id, {
      onDelete: 'restrict',
    }),
    /** JSON con la lista de géneros, validado por la aplicación. */
    genres: text('genres').notNull().default('[]'),
    status: text('status').notNull().default('active'),
    /** Idioma del contenido del mundo (`es`, `en`, `it`). */
    language: text('language').notNull().default('es'),
    /** Preferencias del mundo; JSON validado por la aplicación. */
    settings: text('settings').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archivedAt: integer('archived_at'),
    deletedAt: integer('deleted_at'),
  },
  (table) => [
    uniqueIndex('worlds_slug_uq').on(table.slug),
    index('worlds_status_idx').on(table.status, table.deletedAt),
    index('worlds_deleted_updated_idx').on(
      table.deletedAt,
      desc(table.updatedAt),
    ),
    check(
      'worlds_status_check',
      sql`${table.status} in ('active', 'archived')`,
    ),
    check(
      'worlds_language_check',
      sql`${table.language} in ('es', 'en', 'it')`,
    ),
    check(
      'worlds_slug_check',
      sql`length(${table.slug}) between 1 and 80 AND ${table.slug} NOT GLOB '*[^a-z0-9-]*'`,
    ),
    check('worlds_name_check', sql`length(${table.name}) between 1 and 120`),
    check(
      'worlds_genres_check',
      sql`json_valid(${table.genres}) AND json_type(${table.genres}) = 'array'`,
    ),
  ],
);

/** Registro de actividad por mundo. */
export const activityLog = sqliteTable(
  'activity_log',
  {
    id: text('id').primaryKey().notNull(),
    worldId: text('world_id')
      .notNull()
      .references(() => worlds.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    diff: text('diff').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('activity_log_world_created_idx').on(
      table.worldId,
      desc(table.createdAt),
    ),
    index('activity_log_created_idx').on(desc(table.createdAt)),
  ],
);
