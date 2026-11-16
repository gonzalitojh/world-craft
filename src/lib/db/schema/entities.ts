/**
 * Fichas, relaciones entre fichas y etiquetas asignadas.
 *
 * `entities.search_vector` es una columna generada y almacenada con
 * configuración `spanish`: pondera nombre (A), resumen y alias (B) y texto
 * plano de la descripción (C). `pg_trgm` cubre la búsqueda difusa por nombre y
 * alias. El texto plano duplicado (`description_text`) lo mantiene la
 * aplicación al guardar el contenido rico y sirve para buscar, exportar y
 * contar palabras sin abrir el JSONB.
 */
import { sql, type SQL } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { assets } from './assets';
import { contentStatusEnum } from './enums';
import { profiles } from './profiles';
import { entityTypes, relationTypes, tags } from './taxonomy';
import { worlds } from './worlds';

/** Tipo `tsvector` de PostgreSQL: Drizzle no lo trae de serie. */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

/** Expresión del `tsvector` generado. Se mantiene en una constante para citarla en la documentación. */
export const entitiesSearchVectorExpression: SQL = sql`setweight(to_tsvector('spanish'::pg_catalog.regconfig, coalesce("name", '')), 'A') || setweight(to_tsvector('spanish'::pg_catalog.regconfig, coalesce("summary", '')), 'B') || setweight(to_tsvector('spanish'::pg_catalog.regconfig, coalesce("description_text", '')), 'C') || setweight(to_tsvector('spanish'::pg_catalog.regconfig, app.immutable_array_to_string(coalesce("aliases", '{}'::text[]), ' ')), 'B')`;

export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    typeId: uuid('type_id')
      .notNull()
      .references(() => entityTypes.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    summary: text('summary').notNull().default(''),
    description: jsonb('description').notNull().default({}),
    descriptionText: text('description_text').notNull().default(''),
    imageAssetId: uuid('image_asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    attributes: jsonb('attributes').notNull().default({}),
    status: contentStatusEnum('status').notNull().default('draft'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      entitiesSearchVectorExpression,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('entities_world_id_slug_key')
      .on(table.worldId, table.slug)
      .where(sql`${table.deletedAt} is null`),
    index('entities_world_id_idx').on(table.worldId),
    index('entities_world_id_type_id_idx').on(table.worldId, table.typeId),
    index('entities_world_id_updated_at_idx').on(
      table.worldId,
      table.updatedAt.desc(),
    ),
    index('entities_search_vector_idx').using('gin', table.searchVector),
    index('entities_name_trgm_idx').using(
      'gin',
      sql`${table.name} extensions.gin_trgm_ops`,
    ),
    index('entities_aliases_trgm_idx').using(
      'gin',
      sql`app.immutable_array_to_string(${table.aliases}, ' ') extensions.gin_trgm_ops`,
    ),
    check(
      'entities_slug_format_check',
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      'entities_name_length_check',
      sql`char_length(${table.name}) between 1 and 200`,
    ),
  ],
);

export const relations = pgTable(
  'relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    typeId: uuid('type_id')
      .notNull()
      .references(() => relationTypes.id, { onDelete: 'restrict' }),
    label: text('label'),
    inverseLabel: text('inverse_label'),
    notes: text('notes'),
    strength: smallint('strength').notNull().default(3),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('relations_world_id_source_id_target_id_type_id_key').on(
      table.worldId,
      table.sourceId,
      table.targetId,
      table.typeId,
    ),
    index('relations_world_id_idx').on(table.worldId),
    index('relations_source_id_idx').on(table.sourceId),
    index('relations_target_id_idx').on(table.targetId),
    index('relations_type_id_idx').on(table.typeId),
    check(
      'relations_no_self_reference_check',
      sql`${table.sourceId} <> ${table.targetId}`,
    ),
    check(
      'relations_strength_range_check',
      sql`${table.strength} between 1 and 5`,
    ),
  ],
);

export const entityTags = pgTable(
  'entity_tags',
  {
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'entity_tags_pkey',
      columns: [table.entityId, table.tagId],
    }),
    index('entity_tags_tag_id_idx').on(table.tagId),
  ],
);

/** Tipo de fila de una ficha, útil para los módulos de M1. */
export type EntityRow = typeof entities.$inferSelect;
/** Fila de una relación entre fichas. */
export type RelationRow = typeof relations.$inferSelect;
/** Referencia a un perfil desde otro dominio. */
export type ProfileId = typeof profiles.$inferSelect.id;
