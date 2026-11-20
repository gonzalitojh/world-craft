/**
 * Esquema Drizzle de los tipos de entidad.
 *
 * Un tipo del sistema tiene `world_id` nulo e `is_system = 1`; los tipos
 * personalizados pertenecen a un mundo y se aíslan con su `world_id`. La clave
 * es estable dentro de su ámbito: única por mundo y única entre los tipos del
 * sistema.
 *
 * `fields` guarda la plantilla de campos en JSON validada con Zod. Los valores
 * de cada ficha se guardarán en `entities.attributes` con la misma plantilla,
 * de modo que añadir campos no obliga a migrar el esquema.
 *
 * Los tipos del sistema se siembran en la migración `0003_entity_types` y no se
 * editan ni se borran desde la aplicación. Los personalizados usan borrado
 * lógico (`deleted_at`): la fila se conserva para que una ficha o una
 * exportación antigua no queden huérfanas y para que el borrado sea recuperable
 * hasta la purga. El `ON DELETE CASCADE` solo actúa cuando un mundo se purga de
 * forma definitiva.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { worlds } from './worlds';

/** Tipos de entidad del sistema y personalizados. */
export const entityTypes = sqliteTable(
  'entity_types',
  {
    id: text('id').primaryKey().notNull(),
    worldId: text('world_id').references(() => worlds.id, {
      onDelete: 'cascade',
    }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    /** JSON con la plantilla de campos, validado por la aplicación. */
    fields: text('fields').notNull().default('[]'),
    isSystem: integer('is_system').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [
    uniqueIndex('entity_types_world_key_uq').on(table.worldId, table.key),
    uniqueIndex('entity_types_system_key_uq')
      .on(table.key)
      .where(sql`${table.worldId} is null`),
    index('entity_types_world_idx').on(
      table.worldId,
      table.deletedAt,
      table.name,
    ),
    check('entity_types_is_system_check', sql`${table.isSystem} in (0, 1)`),
    check(
      'entity_types_world_check',
      sql`(${table.worldId} is null and ${table.isSystem} = 1) or (${table.worldId} is not null and ${table.isSystem} = 0)`,
    ),
    check(
      'entity_types_key_check',
      sql`length(${table.key}) between 1 and 60 AND ${table.key} NOT GLOB '*[^a-z0-9-]*' AND ${table.key} GLOB '[a-z0-9]*' AND ${table.key} GLOB '*[a-z0-9]' AND ${table.key} NOT GLOB '*--*'`,
    ),
    check(
      'entity_types_name_check',
      sql`length(${table.name}) between 1 and 80`,
    ),
    check(
      'entity_types_fields_check',
      sql`json_valid(${table.fields}) AND json_type(${table.fields}) = 'array'`,
    ),
  ],
);
