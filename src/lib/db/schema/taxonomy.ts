/**
 * Taxonomías de un mundo: tipos de entidad, tipos de relación y etiquetas.
 *
 * Los tipos con `world_id` nulo son del sistema, se crean con el seed y son de
 * solo lectura para los usuarios. `is_system` debe coincidir siempre con
 * `world_id is null`; la restricción `check` lo garantiza y el seed lo valida.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { worlds } from './worlds';

export const entityTypes = pgTable(
  'entity_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id').references(() => worlds.id, {
      onDelete: 'cascade',
    }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    icon: text('icon'),
    color: text('color'),
    fields: jsonb('fields')
      .notNull()
      .default(sql`'[]'::jsonb`),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('entity_types_system_key_key')
      .on(table.key)
      .where(sql`${table.worldId} is null`),
    uniqueIndex('entity_types_world_id_key_key')
      .on(table.worldId, table.key)
      .where(sql`${table.worldId} is not null`),
    index('entity_types_world_id_idx').on(table.worldId),
    check(
      'entity_types_is_system_check',
      sql`${table.isSystem} = (${table.worldId} is null)`,
    ),
  ],
);

export const relationTypes = pgTable(
  'relation_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id').references(() => worlds.id, {
      onDelete: 'cascade',
    }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    inverseName: text('inverse_name').notNull(),
    color: text('color'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('relation_types_system_key_key')
      .on(table.key)
      .where(sql`${table.worldId} is null`),
    uniqueIndex('relation_types_world_id_key_key')
      .on(table.worldId, table.key)
      .where(sql`${table.worldId} is not null`),
    index('relation_types_world_id_idx').on(table.worldId),
    check(
      'relation_types_is_system_check',
      sql`${table.isSystem} = (${table.worldId} is null)`,
    ),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('tags_world_id_slug_key').on(table.worldId, table.slug),
    index('tags_world_id_idx').on(table.worldId),
    check(
      'tags_slug_format_check',
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
);
