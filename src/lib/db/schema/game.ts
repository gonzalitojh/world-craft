/**
 * Juego creativo: packs de contenido, tablas, entradas y sesiones.
 *
 * Un pack o una tabla con `world_id` nulo son contenido del sistema (global,
 * compartido y de solo lectura). Las tablas y packs de un mundo se pueden
 * editar desde M4-04. Las sesiones son privadas: ni siquiera el `owner` del
 * mundo ve las de otra persona.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { gameTableCategoryEnum } from './enums';
import { profiles } from './profiles';
import { worlds } from './worlds';

export const gameContentPacks = pgTable(
  'game_content_packs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id').references(() => worlds.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    version: text('version').notNull().default('1'),
    description: text('description').notNull().default(''),
    author: text('author'),
    license: text('license'),
    metadata: jsonb('metadata').notNull().default({}),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('game_content_packs_system_name_key')
      .on(table.name)
      .where(sql`${table.worldId} is null`),
    uniqueIndex('game_content_packs_world_id_name_key')
      .on(table.worldId, table.name)
      .where(sql`${table.worldId} is not null`),
    index('game_content_packs_world_id_idx').on(table.worldId),
  ],
);

export const gameTables = pgTable(
  'game_tables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id').references(() => worlds.id, {
      onDelete: 'cascade',
    }),
    packId: uuid('pack_id').references(() => gameContentPacks.id, {
      onDelete: 'cascade',
    }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    category: gameTableCategoryEnum('category').notNull(),
    description: text('description').notNull().default(''),
    isSystem: boolean('is_system').notNull().default(false),
    isEditable: boolean('is_editable').notNull().default(true),
    version: text('version').notNull().default('1'),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('game_tables_system_key_key')
      .on(table.key)
      .where(sql`${table.worldId} is null`),
    uniqueIndex('game_tables_world_id_key_key')
      .on(table.worldId, table.key)
      .where(sql`${table.worldId} is not null`),
    index('game_tables_world_id_idx').on(table.worldId),
    index('game_tables_pack_id_idx').on(table.packId),
    check(
      'game_tables_is_system_check',
      sql`${table.isSystem} = (${table.worldId} is null)`,
    ),
  ],
);

export const gameTableEntries = pgTable(
  'game_table_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tableId: uuid('table_id')
      .notNull()
      .references(() => gameTables.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    weight: integer('weight').notNull().default(1),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('game_table_entries_table_id_idx').on(table.tableId),
    check('game_table_entries_weight_check', sql`${table.weight} >= 0`),
  ],
);

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    seed: text('seed').notNull(),
    results: jsonb('results').notNull().default({}),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('game_sessions_world_id_user_id_idx').on(table.worldId, table.userId),
    index('game_sessions_user_id_idx').on(table.userId),
  ],
);
