/**
 * Esquema Drizzle de la base local.
 *
 * En M0 existen las tablas del sistema y los assets: el registro de
 * migraciones, los ajustes de la aplicación y los metadatos de los archivos
 * locales. En M1 se añaden los mundos, su actividad y los tipos de entidad; el
 * resto de tablas de contenido llega con sus propias migraciones. Este archivo
 * es la fuente de verdad que Drizzle Kit usa para generarlas.
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { assets } from './assets';
import { entities, entityGallery, entityTags, tags } from './entities';
import { entityTypes } from './entity-types';
import { relationTypes, relations } from './relations';
import { searchDocuments } from './search';
import { entityVersions } from './versions';
import { activityLog, worlds } from './worlds';

export {
  activityLog,
  assets,
  entities,
  entityGallery,
  entityTags,
  entityTypes,
  entityVersions,
  relationTypes,
  relations,
  searchDocuments,
  tags,
  worlds,
};

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
  worlds,
  activityLog,
  entityTypes,
  entities,
  tags,
  entityTags,
  entityGallery,
  relationTypes,
  relations,
  searchDocuments,
  entityVersions,
} as const;
