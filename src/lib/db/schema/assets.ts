/**
 * Metadatos de los assets de un mundo.
 *
 * El objeto binario vive en Cloudflare R2 desde M0-10 (issue #40); aquí solo se
 * guarda lo necesario para firmar una URL, pintar una miniatura y exportar el
 * mundo. La clave debe empezar por `world/{worldId}/`, que es la convención que
 * comparte `src/lib/storage/asset-key.ts` y la RLS de inserción.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { profiles } from './profiles';
import { worlds } from './worlds';

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    uploaderId: uuid('uploader_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    bucket: text('bucket').notNull(),
    path: text('path').notNull(),
    mime: text('mime').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assets_world_id_path_key').on(table.worldId, table.path),
    index('assets_world_id_idx').on(table.worldId),
    index('assets_world_id_created_at_idx').on(
      table.worldId,
      table.createdAt.desc(),
    ),
    check('assets_size_check', sql`${table.size} >= 0`),
    check(
      'assets_path_world_prefix_check',
      sql`${table.path} like 'world/' || ${table.worldId}::text || '/%'`,
    ),
  ],
);
