/**
 * Esquema Drizzle de los tipos de relación y de las relaciones entre fichas.
 *
 * Un tipo puede ser del sistema (`world_id` nulo e `is_system` verdadero) o
 * personalizado de un mundo. Define la etiqueta directa, la inversa y el color.
 *
 * Una relación es una arista dirigida entre dos fichas vivas del mismo mundo,
 * con un tipo del sistema o de ese mundo. `label` e `inverse_label` sobrescriben
 * las etiquetas del tipo; `notes`, `strength` y `metadata` completan la arista.
 * La regla de mundo se valida en el servicio, porque SQLite no puede mirar dos
 * filas; el origen igual al destino y la fuerza se comprueban en la tabla.
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

import { entities } from './entities';
import { worlds } from './worlds';

/** Tipos de relación del sistema y personalizados por mundo. */
export const relationTypes = sqliteTable(
  'relation_types',
  {
    id: text('id').primaryKey().notNull(),
    worldId: text('world_id').references(() => worlds.id, {
      onDelete: 'cascade',
    }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    inverseName: text('inverse_name').notNull(),
    color: text('color').notNull(),
    isSystem: integer('is_system').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('relation_types_world_key_uq').on(table.worldId, table.key),
    uniqueIndex('relation_types_system_key_uq')
      .on(table.key)
      .where(sql`${table.worldId} is null`),
    index('relation_types_world_idx').on(table.worldId, table.name),
    check('relation_types_is_system_check', sql`${table.isSystem} in (0, 1)`),
    check(
      'relation_types_world_check',
      sql`(${table.worldId} is null and ${table.isSystem} = 1) or (${table.worldId} is not null and ${table.isSystem} = 0)`,
    ),
    check(
      'relation_types_key_check',
      sql`length(${table.key}) between 1 and 60 AND ${table.key} NOT GLOB '*[^a-z0-9-]*' AND ${table.key} GLOB '[a-z0-9]*' AND ${table.key} GLOB '*[a-z0-9]' AND ${table.key} NOT GLOB '*--*'`,
    ),
    check(
      'relation_types_name_check',
      sql`length(${table.name}) between 1 and 80`,
    ),
    check(
      'relation_types_inverse_name_check',
      sql`length(${table.inverseName}) between 1 and 80`,
    ),
    check(
      'relation_types_color_check',
      sql`${table.color} in ('moss', 'ochre', 'danger', 'prussian')`,
    ),
  ],
);

/** Relaciones dirigidas entre dos fichas del mismo mundo. */
export const relations = sqliteTable(
  'relations',
  {
    id: text('id').primaryKey().notNull(),
    worldId: text('world_id')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetId: text('target_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    typeId: text('type_id')
      .notNull()
      .references(() => relationTypes.id, { onDelete: 'restrict' }),
    /** Sobrescritura de la etiqueta directa del tipo. */
    label: text('label'),
    /** Sobrescritura de la etiqueta inversa del tipo. */
    inverseLabel: text('inverse_label'),
    notes: text('notes'),
    strength: integer('strength').notNull().default(1),
    /** JSON de metadatos abiertos, validado por Zod. */
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('relations_unique').on(
      table.worldId,
      table.sourceId,
      table.targetId,
      table.typeId,
    ),
    index('relations_world_source_idx').on(table.worldId, table.sourceId),
    index('relations_world_target_idx').on(table.worldId, table.targetId),
    index('relations_type_idx').on(table.typeId),
    check('relations_self_check', sql`${table.sourceId} <> ${table.targetId}`),
    check('relations_strength_check', sql`${table.strength} between 1 and 5`),
    check(
      'relations_label_check',
      sql`${table.label} is null or length(${table.label}) between 1 and 80`,
    ),
    check(
      'relations_inverse_label_check',
      sql`${table.inverseLabel} is null or length(${table.inverseLabel}) between 1 and 80`,
    ),
    check(
      'relations_notes_check',
      sql`${table.notes} is null or length(${table.notes}) <= 2000`,
    ),
    check(
      'relations_metadata_check',
      sql`json_valid(${table.metadata}) AND json_type(${table.metadata}) = 'object'`,
    ),
  ],
);
