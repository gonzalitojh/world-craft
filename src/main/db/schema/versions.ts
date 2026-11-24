/**
 * Esquema Drizzle del historial de versiones de las fichas.
 *
 * Una versión guarda el estado **saliente** de la descripción de una ficha
 * antes de reemplazarla. `description` conserva el documento ProseMirror
 * íntegro y `description_text` su texto plano para la vista previa, la
 * exportación y las diferencias. `NULL` en ambos significa «descripción
 * vacía»: no se inventa un documento vacío.
 *
 * `origin` distingue las versiones automáticas (agrupadas por ráfaga), las
 * manuales (con etiqueta obligatoria) y las de seguridad creadas antes de
 * restaurar. El texto visible se traduce en la interfaz; la base nunca guarda
 * texto localizado.
 *
 * Las versiones pertenecen siempre a una ficha y desaparecen con ella por la
 * cascada de la purga. El borrado lógico de la ficha no las toca.
 */
import { desc, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

import { entities } from './entities';

/** Versiones de la descripción de una ficha. */
export const entityVersions = sqliteTable(
  'entity_versions',
  {
    id: text('id').primaryKey().notNull(),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    /** Documento ProseMirror íntegro; `NULL` = descripción vacía. */
    description: text('description'),
    /** Texto plano derivado para vista previa y búsqueda. */
    descriptionText: text('description_text'),
    /** Etiqueta manual; solo las versiones manuales la llevan. */
    label: text('label'),
    /** `auto`, `manual` o `restore`; nunca texto localizado. */
    origin: text('origin').notNull().default('auto'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('entity_versions_entity_created_idx').on(
      table.entityId,
      desc(table.createdAt),
      desc(table.id),
    ),
    check(
      'entity_versions_origin_check',
      sql`${table.origin} in ('auto', 'manual', 'restore')`,
    ),
    check(
      'entity_versions_label_check',
      sql`${table.label} is null or length(${table.label}) between 1 and 120`,
    ),
    check(
      'entity_versions_description_check',
      sql`${table.description} is null or (json_valid(${table.description}) AND json_type(${table.description}) = 'object')`,
    ),
    check(
      'entity_versions_text_check',
      sql`${table.descriptionText} is null or length(${table.descriptionText}) <= 50000`,
    ),
  ],
);
