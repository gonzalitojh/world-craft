/**
 * Repositorio Drizzle de los tipos de entidad.
 *
 * Es la única capa que habla con SQL. Las listas de un mundo incluyen los tipos
 * del sistema y los personalizados de ese mundo, nunca los de otro. El servicio
 * comprueba además que quien escribe es el mundo propietario y que el tipo no
 * es del sistema.
 *
 * Las fechas y los IDs llegan ya calculados por el servicio. La plantilla se
 * guarda como JSON y se valida al leer para que una fila manipulada no rompa la
 * interfaz.
 */
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';

import {
  isEntityTypeColor,
  isEntityTypeIcon,
  type EntityFieldDefinition,
  type EntityTypeColor,
  type EntityTypeIcon,
} from '../../shared/contracts/entity-types';
import { entityFieldTemplateSchema } from '../../shared/entity-types/fields';
import type { WorldCraftDatabase } from '../db/client';
import { entities } from '../db/schema/entities';
import { entityTypes } from '../db/schema/entity-types';
import { worlds } from '../db/schema/worlds';

/** Fila de `entity_types` tal como la consume el dominio. */
export interface EntityTypeRecord {
  readonly id: string;
  readonly worldId: string | null;
  readonly key: string;
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly fields: readonly EntityFieldDefinition[];
  readonly isSystem: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deletedAt: number | null;
}

interface EntityTypeRow {
  readonly id: string;
  readonly worldId: string | null;
  readonly key: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly fields: string;
  readonly isSystem: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deletedAt: number | null;
}

/** Operaciones que necesita el servicio de tipos de entidad. */
export interface EntityTypeRepository {
  list(worldId: string): readonly EntityTypeRecord[];
  findById(id: string): EntityTypeRecord | null;
  findByKey(worldId: string, key: string): EntityTypeRecord | null;
  listCustomByWorld(worldId: string): readonly EntityTypeRecord[];
  worldExists(worldId: string): boolean;
  countEntitiesByType(typeId: string): number;
  insert(record: EntityTypeRecord): void;
  update(record: EntityTypeRecord): boolean;
  remove(id: string, worldId: string, deletedAt: number): boolean;
}

/** Crea el repositorio sobre la conexión compartida del proceso principal. */
export function createEntityTypeRepository(
  database: WorldCraftDatabase,
): EntityTypeRepository {
  return {
    list(worldId) {
      return database
        .select()
        .from(entityTypes)
        .where(
          and(
            isNull(entityTypes.deletedAt),
            or(isNull(entityTypes.worldId), eq(entityTypes.worldId, worldId)),
          ),
        )
        .orderBy(asc(entityTypes.name), asc(entityTypes.key))
        .all()
        .map(toEntityTypeRecord);
    },

    findById(id) {
      const row = database
        .select()
        .from(entityTypes)
        .where(eq(entityTypes.id, id))
        .get();

      return row === undefined ? null : toEntityTypeRecord(row);
    },

    findByKey(worldId, key) {
      const row = database
        .select()
        .from(entityTypes)
        .where(and(eq(entityTypes.worldId, worldId), eq(entityTypes.key, key)))
        .get();

      return row === undefined ? null : toEntityTypeRecord(row);
    },

    listCustomByWorld(worldId) {
      return database
        .select()
        .from(entityTypes)
        .where(
          and(
            eq(entityTypes.worldId, worldId),
            eq(entityTypes.isSystem, 0),
            isNull(entityTypes.deletedAt),
          ),
        )
        .orderBy(asc(entityTypes.key))
        .all()
        .map(toEntityTypeRecord);
    },

    worldExists(worldId) {
      return (
        database
          .select({ id: worlds.id })
          .from(worlds)
          .where(and(eq(worlds.id, worldId), isNull(worlds.deletedAt)))
          .get() !== undefined
      );
    },

    countEntitiesByType(typeId) {
      // Incluye las fichas en papelera: si se restauran, deben encontrar su
      // plantilla. La purga definitiva llega con #77.
      const row = database
        .select({ total: sql<number>`count(*)` })
        .from(entities)
        .where(eq(entities.typeId, typeId))
        .get();

      return row?.total ?? 0;
    },

    insert(record) {
      database
        .insert(entityTypes)
        .values({
          id: record.id,
          worldId: record.worldId,
          key: record.key,
          name: record.name,
          icon: record.icon,
          color: record.color,
          fields: JSON.stringify(record.fields),
          isSystem: record.isSystem ? 1 : 0,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          deletedAt: record.deletedAt,
        })
        .run();
    },

    update(record) {
      if (record.worldId === null || record.isSystem) {
        return false;
      }

      const result = database
        .update(entityTypes)
        .set({
          name: record.name,
          icon: record.icon,
          color: record.color,
          fields: JSON.stringify(record.fields),
          updatedAt: record.updatedAt,
        })
        .where(
          and(
            eq(entityTypes.id, record.id),
            eq(entityTypes.worldId, record.worldId),
            eq(entityTypes.isSystem, 0),
            isNull(entityTypes.deletedAt),
          ),
        )
        .run();

      return result.changes > 0;
    },

    remove(id, worldId, deletedAt) {
      const result = database
        .update(entityTypes)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(
          and(
            eq(entityTypes.id, id),
            eq(entityTypes.worldId, worldId),
            eq(entityTypes.isSystem, 0),
            isNull(entityTypes.deletedAt),
          ),
        )
        .run();

      return result.changes > 0;
    },
  };
}

function toEntityTypeRecord(row: EntityTypeRow): EntityTypeRecord {
  return {
    id: row.id,
    worldId: row.worldId,
    key: row.key,
    name: row.name,
    icon: isEntityTypeIcon(row.icon) ? row.icon : 'book-open',
    color: isEntityTypeColor(row.color) ? row.color : 'moss',
    fields: parseFields(row.fields),
    isSystem: row.isSystem === 1 || row.worldId === null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function parseFields(raw: string): readonly EntityFieldDefinition[] {
  let value: unknown;

  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }

  const parsed = entityFieldTemplateSchema.safeParse(value);

  return parsed.success
    ? (parsed.data as readonly EntityFieldDefinition[])
    : [];
}
