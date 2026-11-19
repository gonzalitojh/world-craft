/**
 * Esquema Drizzle de la base local.
 *
 * En M0 existen las tablas del sistema y los assets: el registro de
 * migraciones, los ajustes de la aplicación y los metadatos de los archivos
 * locales. Las tablas de contenido llegan en M1 con sus propias migraciones;
 * este archivo es la fuente de verdad que Drizzle Kit usa para generarlas.
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { assets } from './assets';

export { assets };

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
  assets,
} as const;
