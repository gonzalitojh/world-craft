/**
 * Esquema Drizzle de las fichas, sus etiquetas y su galería.
 *
 * Una ficha pertenece a un mundo y a un tipo del sistema o a un tipo
 * personalizado de ese mismo mundo. La descripción se guarda como JSON de
 * ProseMirror y su texto plano aparte, para buscar sin interpretar HTML.
 *
 * `tags` y `entity_tags` implementan etiquetas de color por mundo. La galería
 * es una tabla puente con posición: el orden es explícito y una imagen solo
 * puede pertenecer a la galería de una ficha de su mismo mundo (la regla de
 * mundo se valida en el servicio, porque SQLite no puede mirar dos filas).
 *
 * Las imágenes viven en `assets` y nunca se copian; `image_asset_id` es la
 * imagen principal y las miniaturas se sirven con `wc-asset://thumb/<id>`.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { assets } from './assets';
import { entityTypes } from './entity-types';
import { worlds } from './worlds';

/** Fichas de la enciclopedia de un mundo. */
export const entities = sqliteTable(
  'entities',
  {
    id: text('id').primaryKey().notNull(),
    worldId: text('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    typeId: text('type_id')
      .notNull()
      .references(() => entityTypes.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    aliases: text('aliases').notNull().default('[]'),
    summary: text('summary'),
    /** JSON de ProseMirror validado con Zod; nunca HTML. */
    description: text('description'),
    /** Texto plano derivado de la descripción para búsqueda. */
    descriptionText: text('description_text'),
    imageAssetId: text('image_asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    /** JSON de valores de la plantilla del tipo, validado con Zod. */
    attributes: text('attributes').notNull().default('{}'),
    status: text('status').notNull().default('active'),
    isFavorite: integer('is_favorite').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [
    uniqueIndex('entities_world_slug_uq').on(table.worldId, table.slug),
    index('entities_deleted_idx').on(table.deletedAt, table.worldId),
    index('entities_world_type_idx').on(
      table.worldId,
      table.typeId,
      table.deletedAt,
    ),
    index('entities_name_idx').on(table.worldId, table.name),
    index('entities_image_asset_idx').on(table.imageAssetId),
    index('entities_favorite_idx').on(table.worldId, table.isFavorite),
    check(
      'entities_status_check',
      sql`${table.status} in ('active', 'draft', 'archived')`,
    ),
    check('entities_favorite_check', sql`${table.isFavorite} in (0, 1)`),
    check('entities_name_check', sql`length(${table.name}) between 1 and 120`),
    check(
      'entities_slug_check',
      sql`length(${table.slug}) between 1 and 80 AND ${table.slug} NOT GLOB '*[^a-z0-9-]*' AND ${table.slug} GLOB '[a-z0-9]*' AND ${table.slug} GLOB '*[a-z0-9]' AND ${table.slug} NOT GLOB '*--*'`,
    ),
    check(
      'entities_aliases_check',
      sql`json_valid(${table.aliases}) AND json_type(${table.aliases}) = 'array'`,
    ),
    check(
      'entities_attributes_check',
      sql`json_valid(${table.attributes}) AND json_type(${table.attributes}) = 'object'`,
    ),
    check(
      'entities_description_check',
      sql`${table.description} is null OR (json_valid(${table.description}) AND json_type(${table.description}) = 'object')`,
    ),
  ],
);

/** Etiquetas de color de un mundo. */
export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey().notNull(),
    worldId: text('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('tags_world_name_uq').on(table.worldId, table.name),
    index('tags_world_idx').on(table.worldId, table.name),
    check('tags_name_check', sql`length(${table.name}) between 1 and 40`),
    check(
      'tags_color_check',
      sql`${table.color} in ('moss', 'ochre', 'danger', 'prussian')`,
    ),
  ],
);

/** Relación muchos-a-muchos entre fichas y etiquetas. */
export const entityTags = sqliteTable(
  'entity_tags',
  {
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.entityId, table.tagId] }),
    index('entity_tags_tag_idx').on(table.tagId),
  ],
);

/** Galería ordenada de imágenes de una ficha. */
export const entityGallery = sqliteTable(
  'entity_gallery',
  {
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.entityId, table.assetId] }),
    uniqueIndex('entity_gallery_position_uq').on(
      table.entityId,
      table.position,
    ),
    index('entity_gallery_asset_idx').on(table.assetId),
    check('entity_gallery_position_check', sql`${table.position} >= 0`),
  ],
);
