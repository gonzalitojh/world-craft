/**
 * Mundos, membresías e invitaciones.
 *
 * Un mundo es la unidad de aislamiento: la RLS de todo el contenido se resuelve
 * contra `world_members` (ADR 0011). `worlds.owner_id` es la fuente de verdad
 * de la propiedad y `world_members` guarda el rol materializado; un índice
 * parcial y un trigger garantizan que solo exista un `owner` y que sea el
 * canónico.
 *
 * `worlds.cover_asset_id` declara la columna aquí pero su clave foránea se
 * añade en `drizzle/0002_functions_and_triggers.sql`: `assets` referencia
 * `worlds` y declarar ambas referencias en el esquema crearía un ciclo de
 * módulos. La decisión está en `docs/base-de-datos/esquema.md`.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { invitationRoleEnum, worldRoleEnum, worldStatusEnum } from './enums';
import { profiles } from './profiles';

export const worlds = pgTable(
  'worlds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary').notNull().default(''),
    description: jsonb('description').notNull().default({}),
    coverAssetId: uuid('cover_asset_id'),
    genres: text('genres')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: worldStatusEnum('status').notNull().default('draft'),
    settings: jsonb('settings').notNull().default({}),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('worlds_owner_id_slug_key').on(table.ownerId, table.slug),
    index('worlds_owner_id_idx').on(table.ownerId),
    index('worlds_owner_id_updated_at_idx').on(
      table.ownerId,
      table.updatedAt.desc(),
    ),
    check(
      'worlds_name_length_check',
      sql`char_length(${table.name}) between 1 and 160`,
    ),
    check(
      'worlds_slug_format_check',
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
);

export const worldMembers = pgTable(
  'world_members',
  {
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: worldRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'world_members_pkey',
      columns: [table.worldId, table.userId],
    }),
    // Un solo `owner` por mundo: el resto de roles queda fuera del índice.
    uniqueIndex('world_members_one_owner_key')
      .on(table.worldId)
      .where(sql`${table.role} = 'owner'`),
    // La PK empieza por `world_id`; las políticas filtran por `user_id`.
    index('world_members_user_id_idx').on(table.userId),
  ],
);

export const worldInvitations = pgTable(
  'world_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    worldId: uuid('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: invitationRoleEnum('role').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('world_invitations_token_hash_key').on(table.tokenHash),
    // Una sola invitación pendiente por correo y mundo.
    uniqueIndex('world_invitations_world_id_email_pending_key')
      .on(table.worldId, table.email)
      .where(sql`${table.acceptedAt} is null`),
    index('world_invitations_world_id_idx').on(table.worldId),
    index('world_invitations_email_idx').on(table.email),
    index('world_invitations_world_id_expires_at_idx').on(
      table.worldId,
      table.expiresAt,
    ),
    check(
      'world_invitations_email_lower_check',
      sql`${table.email} = lower(${table.email})`,
    ),
    check(
      'world_invitations_token_hash_format_check',
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'world_invitations_expires_at_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);
