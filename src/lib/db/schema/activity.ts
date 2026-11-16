/**
 * Registro de actividad de un mundo (append-only).
 *
 * `entity_id` no lleva clave foránea a propósito: referencia de forma genérica
 * cualquier fila del mundo (ficha, mapa, escena…). Sin `UPDATE` ni `DELETE`
 * para clientes: la RLS y los privilegios lo impiden.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { profiles } from './profiles';
import { worlds } from './worlds';

export const activityLog = pgTable(
  'activity_log',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    diff: jsonb('diff'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('activity_log_world_id_created_at_idx').on(
      table.worldId,
      table.createdAt.desc(),
    ),
    index('activity_log_entity_type_entity_id_idx').on(
      table.entityType,
      table.entityId,
    ),
    index('activity_log_world_id_idx').on(table.worldId),
    check(
      'activity_log_action_check',
      sql`length(${table.action}) between 1 and 120`,
    ),
  ],
);
