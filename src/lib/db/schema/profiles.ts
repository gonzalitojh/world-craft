/**
 * Perfiles de usuario y allowlist de la aplicación.
 *
 * `profiles.id` es la misma clave que `auth.users.id` de Supabase. La clave
 * foránea hacia el esquema `auth` se añade en
 * `drizzle/0002_functions_and_triggers.sql`: Drizzle Kit no puede declarar una
 * referencia a una tabla que no gestiona, y crear `auth.users` desde una
 * migración rompería el esquema interno de Supabase. La decisión está
 * documentada en `docs/base-de-datos/esquema.md`.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { themePreferenceEnum } from './enums';

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    displayName: text('display_name').notNull().default(''),
    avatarUrl: text('avatar_url'),
    theme: themePreferenceEnum('theme').notNull().default('system'),
    locale: text('locale').notNull().default('es'),
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('profiles_locale_check', sql`${table.locale} in ('es', 'en', 'it')`),
    index('profiles_updated_at_idx').on(table.updatedAt.desc()),
  ],
);

/**
 * Allowlist de correos con acceso a la **aplicación**.
 *
 * No concede acceso a los mundos de otras personas (ADR 0011). No tiene
 * políticas RLS ni privilegios para `authenticated`: solo la lee el servidor
 * con la conexión privilegiada o el `service_role`.
 */
export const allowedEmails = pgTable(
  'allowed_emails',
  {
    email: text('email').primaryKey(),
    invitedBy: uuid('invited_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'allowed_emails_email_lower_check',
      sql`${table.email} = lower(${table.email})`,
    ),
    check(
      'allowed_emails_email_shape_check',
      sql`length(${table.email}) > 3 and position('@' in ${table.email}) > 1`,
    ),
  ],
);
