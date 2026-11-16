/**
 * Mapas vectoriales y vínculos entre elementos del mapa y fichas.
 *
 * `document` guarda el GeoJSON (capas y features) y `style` los estilos de
 * MapLibre (ADR 0006). No se indexa el documento: es grande y se lee entero.
 * `map_entity_links` relaciona un `feature_id` con una ficha sin duplicar la
 * geometría.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { assets } from './assets';
import { entities } from './entities';
import { worlds } from './worlds';

export const maps = pgTable(
  'maps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    document: jsonb('document')
      .notNull()
      .default(sql`'{"type": "FeatureCollection", "features": []}'::jsonb`),
    style: jsonb('style').notNull().default({}),
    bounds: jsonb('bounds'),
    thumbnailAssetId: uuid('thumbnail_asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('maps_world_id_idx').on(table.worldId),
    index('maps_world_id_updated_at_idx').on(
      table.worldId,
      table.updatedAt.desc(),
    ),
    index('maps_world_id_live_idx')
      .on(table.worldId)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const mapEntityLinks = pgTable(
  'map_entity_links',
  {
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    featureId: text('feature_id').notNull(),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'map_entity_links_pkey',
      columns: [table.mapId, table.entityId, table.featureId],
    }),
    index('map_entity_links_entity_id_idx').on(table.entityId),
    index('map_entity_links_map_id_feature_id_idx').on(
      table.mapId,
      table.featureId,
    ),
  ],
);
