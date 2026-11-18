/**
 * Esquema Drizzle de la base local.
 *
 * En M0 solo existen las tablas del sistema: el registro de migraciones y los
 * ajustes de la aplicación. Las tablas de contenido llegan en M1 con sus
 * propias migraciones; este archivo es la fuente de verdad que Drizzle Kit usa
 * para generarlas.
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Migraciones aplicadas sobre esta base. */
export const schemaMigrations = sqliteTable('schema_migrations', {
  id: text('id').primaryKey().notNull(),
  appliedAt: integer('applied_at').notNull(),
  checksum: text('checksum').notNull(),
});

/** Ajustes locales de la aplicación. `value` es JSON validado por la app. */
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Esquema completo que conoce Drizzle ORM. */
export const schema = {
  schemaMigrations,
  appSettings,
} as const;
