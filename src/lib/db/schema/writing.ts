/**
 * Manuscritos: obra → libros → capítulos → escenas, con versiones de escena.
 *
 * La jerarquía deriva el mundo del manuscrito, así que las tablas hijas no
 * duplican `world_id`; las funciones `app.*_world_id` resuelven la cadena para
 * la RLS. `position` es `numeric(12,3)` con huecos (1000, 2000, 1500…) para
 * reordenar sin reescribir filas.
 *
 * `story_date` es texto libre a propósito: es una fecha ficticia del mundo, no
 * un instante real y no debe convertirse a `timestamptz`.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { contentStatusEnum, manuscriptKindEnum } from './enums';
import { entities } from './entities';
import { profiles } from './profiles';
import { worlds } from './worlds';

export const manuscripts = pgTable(
  'manuscripts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: manuscriptKindEnum('kind').notNull(),
    synopsis: text('synopsis').notNull().default(''),
    status: contentStatusEnum('status').notNull().default('draft'),
    targetWords: integer('target_words'),
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('manuscripts_world_id_idx').on(table.worldId),
    index('manuscripts_world_id_updated_at_idx').on(
      table.worldId,
      table.updatedAt.desc(),
    ),
    check(
      'manuscripts_target_words_check',
      sql`${table.targetWords} is null or ${table.targetWords} > 0`,
    ),
  ],
);

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscripts.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: numeric('position', { precision: 12, scale: 3 })
      .notNull()
      .default('1000'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('books_manuscript_id_idx').on(table.manuscriptId),
    index('books_manuscript_id_position_idx').on(
      table.manuscriptId,
      table.position,
    ),
  ],
);

export const chapters = pgTable(
  'chapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: numeric('position', { precision: 12, scale: 3 })
      .notNull()
      .default('1000'),
    summary: text('summary').notNull().default(''),
    status: contentStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('chapters_book_id_idx').on(table.bookId),
    index('chapters_book_id_position_idx').on(table.bookId, table.position),
  ],
);

export const scenes = pgTable(
  'scenes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chapterId: uuid('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: numeric('position', { precision: 12, scale: 3 })
      .notNull()
      .default('1000'),
    content: jsonb('content').notNull().default({}),
    contentText: text('content_text').notNull().default(''),
    wordCount: integer('word_count').notNull().default(0),
    status: contentStatusEnum('status').notNull().default('draft'),
    povEntityId: uuid('pov_entity_id').references(() => entities.id, {
      onDelete: 'set null',
    }),
    locationEntityId: uuid('location_entity_id').references(() => entities.id, {
      onDelete: 'set null',
    }),
    storyDate: text('story_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('scenes_chapter_id_idx').on(table.chapterId),
    index('scenes_chapter_id_position_idx').on(table.chapterId, table.position),
    index('scenes_chapter_id_live_idx')
      .on(table.chapterId)
      .where(sql`${table.deletedAt} is null`),
    check('scenes_word_count_check', sql`${table.wordCount} >= 0`),
  ],
);

export const sceneVersions = pgTable(
  'scene_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sceneId: uuid('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    content: jsonb('content').notNull().default({}),
    contentText: text('content_text').notNull().default(''),
    wordCount: integer('word_count').notNull().default(0),
    label: text('label'),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('scene_versions_scene_id_created_at_idx').on(
      table.sceneId,
      table.createdAt.desc(),
    ),
    check('scene_versions_word_count_check', sql`${table.wordCount} >= 0`),
  ],
);
