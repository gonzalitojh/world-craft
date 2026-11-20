/**
 * Repositorio Drizzle de relaciones y de sus tipos.
 *
 * Es la única capa que habla con SQL en este dominio. Todas las consultas
 * filtran por `world_id`; las aristas se resuelven con las fichas de origen y
 * destino y con el tipo, y se ocultan si alguna ficha está en la papelera. Las
 * fechas y los IDs llegan ya calculados por el servicio.
 */
import { and, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import {
  isRelationMetadata,
  type RelationColor,
  type RelationEntityRef,
  type RelationMetadataValue,
} from '../../shared/contracts/relations';
import {
  isEntityTypeColor,
  isEntityTypeIcon,
  type EntityTypeIcon,
} from '../../shared/contracts/entity-types';
import type { WorldCraftDatabase } from '../db/client';
import { entities } from '../db/schema/entities';
import { entityTypes } from '../db/schema/entity-types';
import { relationTypes, relations } from '../db/schema/relations';
import { worlds } from '../db/schema/worlds';
import type { NormalizedRelationFilter } from './validation';

/** Tipo de relación resuelto desde la base. */
export interface RelationTypeRecord {
  readonly id: string;
  readonly worldId: string | null;
  readonly key: string;
  readonly name: string;
  readonly inverseName: string;
  readonly color: RelationColor;
  readonly isSystem: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Ficha mínima con su tipo, para validar y resolver una arista. */
export interface RelationEntityRecord extends RelationEntityRef {
  readonly deletedAt: number | null;
}

/** Arista completa lista para el servicio. */
export interface RelationEdgeRecord {
  readonly id: string;
  readonly worldId: string;
  readonly typeId: string;
  readonly typeKey: string;
  readonly typeName: string;
  readonly typeInverseName: string;
  readonly typeColor: RelationColor;
  readonly isSystemType: boolean;
  readonly label: string | null;
  readonly inverseLabel: string | null;
  readonly notes: string | null;
  readonly strength: number;
  readonly metadata: Readonly<Record<string, RelationMetadataValue>>;
  readonly source: RelationEntityRef;
  readonly target: RelationEntityRef;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Operaciones que necesita el servicio de relaciones. */
export interface RelationRepository {
  worldExists(worldId: string): boolean;
  listTypes(worldId: string): readonly RelationTypeRecord[];
  findTypeById(worldId: string, id: string): RelationTypeRecord | null;
  findTypeByKey(worldId: string, key: string): RelationTypeRecord | null;
  insertType(record: RelationTypeRecord): void;
  updateType(record: RelationTypeRecord): boolean;
  deleteType(id: string): boolean;
  countRelationsByType(typeId: string): number;
  findEntity(worldId: string, id: string): RelationEntityRecord | null;
  list(
    worldId: string,
    filter: NormalizedRelationFilter,
  ): readonly RelationEdgeRecord[];
  findById(worldId: string, id: string): RelationEdgeRecord | null;
  findDuplicate(
    worldId: string,
    sourceId: string,
    targetId: string,
    typeId: string,
    excludeId?: string,
  ): { readonly id: string } | null;
  insert(record: RelationEdgeRecord): void;
  update(record: RelationEdgeRecord): boolean;
  remove(worldId: string, id: string): boolean;
}

/** Crea el repositorio sobre la conexión compartida del proceso principal. */
export function createRelationRepository(
  database: WorldCraftDatabase,
): RelationRepository {
  const sourceEntity = alias(entities, 'source_entity');
  const sourceType = alias(entityTypes, 'source_type');
  const targetEntity = alias(entities, 'target_entity');
  const targetType = alias(entityTypes, 'target_type');

  const edgeColumns = {
    id: relations.id,
    worldId: relations.worldId,
    typeId: relations.typeId,
    typeKey: relationTypes.key,
    typeName: relationTypes.name,
    typeInverseName: relationTypes.inverseName,
    typeColor: relationTypes.color,
    isSystemType: relationTypes.isSystem,
    label: relations.label,
    inverseLabel: relations.inverseLabel,
    notes: relations.notes,
    strength: relations.strength,
    metadata: relations.metadata,
    sourceId: sourceEntity.id,
    sourceName: sourceEntity.name,
    sourceTypeKey: sourceType.key,
    sourceTypeName: sourceType.name,
    sourceTypeIcon: sourceType.icon,
    sourceTypeColor: sourceType.color,
    targetId: targetEntity.id,
    targetName: targetEntity.name,
    targetTypeKey: targetType.key,
    targetTypeName: targetType.name,
    targetTypeIcon: targetType.icon,
    targetTypeColor: targetType.color,
    createdAt: relations.createdAt,
    updatedAt: relations.updatedAt,
  };

  const edgeQuery = () =>
    database
      .select(edgeColumns)
      .from(relations)
      .innerJoin(relationTypes, eq(relations.typeId, relationTypes.id))
      .innerJoin(
        sourceEntity,
        and(
          eq(relations.sourceId, sourceEntity.id),
          eq(sourceEntity.worldId, relations.worldId),
          isNull(sourceEntity.deletedAt),
        ),
      )
      .innerJoin(sourceType, eq(sourceEntity.typeId, sourceType.id))
      .innerJoin(
        targetEntity,
        and(
          eq(relations.targetId, targetEntity.id),
          eq(targetEntity.worldId, relations.worldId),
          isNull(targetEntity.deletedAt),
        ),
      )
      .innerJoin(targetType, eq(targetEntity.typeId, targetType.id));

  return {
    worldExists(worldId) {
      return (
        database
          .select({ id: worlds.id })
          .from(worlds)
          .where(and(eq(worlds.id, worldId), isNull(worlds.deletedAt)))
          .get() !== undefined
      );
    },

    listTypes(worldId) {
      return database
        .select()
        .from(relationTypes)
        .where(
          or(isNull(relationTypes.worldId), eq(relationTypes.worldId, worldId)),
        )
        .orderBy(desc(relationTypes.isSystem), relationTypes.name)
        .all()
        .map(toTypeRecord);
    },

    findTypeById(worldId, id) {
      const row = database
        .select()
        .from(relationTypes)
        .where(
          and(
            eq(relationTypes.id, id),
            or(
              isNull(relationTypes.worldId),
              eq(relationTypes.worldId, worldId),
            ),
          ),
        )
        .get();

      return row === undefined ? null : toTypeRecord(row);
    },

    findTypeByKey(worldId, key) {
      const row = database
        .select()
        .from(relationTypes)
        .where(
          and(
            eq(relationTypes.key, key),
            or(
              isNull(relationTypes.worldId),
              eq(relationTypes.worldId, worldId),
            ),
          ),
        )
        .orderBy(desc(relationTypes.isSystem))
        .get();

      return row === undefined ? null : toTypeRecord(row);
    },

    insertType(record) {
      database
        .insert(relationTypes)
        .values({
          id: record.id,
          worldId: record.worldId,
          key: record.key,
          name: record.name,
          inverseName: record.inverseName,
          color: record.color,
          isSystem: record.isSystem ? 1 : 0,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .run();
    },

    updateType(record) {
      const result = database
        .update(relationTypes)
        .set({
          name: record.name,
          inverseName: record.inverseName,
          color: record.color,
          updatedAt: record.updatedAt,
        })
        .where(
          and(
            eq(relationTypes.id, record.id),
            eq(relationTypes.worldId, record.worldId ?? ''),
            eq(relationTypes.isSystem, 0),
          ),
        )
        .run();

      return result.changes > 0;
    },

    deleteType(id) {
      const result = database
        .delete(relationTypes)
        .where(and(eq(relationTypes.id, id), eq(relationTypes.isSystem, 0)))
        .run();

      return result.changes > 0;
    },

    countRelationsByType(typeId) {
      const row = database
        .select({ count: sql<number>`count(*)` })
        .from(relations)
        .where(eq(relations.typeId, typeId))
        .get();

      return row?.count ?? 0;
    },

    findEntity(worldId, id) {
      const row = database
        .select({
          id: entities.id,
          name: entities.name,
          typeKey: entityTypes.key,
          typeName: entityTypes.name,
          typeIcon: entityTypes.icon,
          typeColor: entityTypes.color,
          deletedAt: entities.deletedAt,
        })
        .from(entities)
        .innerJoin(entityTypes, eq(entities.typeId, entityTypes.id))
        .where(and(eq(entities.worldId, worldId), eq(entities.id, id)))
        .get();

      if (row === undefined) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        typeKey: row.typeKey,
        typeName: row.typeName,
        typeIcon: isEntityTypeIcon(row.typeIcon) ? row.typeIcon : 'book-open',
        typeColor: isEntityTypeColor(row.typeColor) ? row.typeColor : 'moss',
        deletedAt: row.deletedAt,
      };
    },

    list(worldId, filter) {
      const conditions = [eq(relations.worldId, worldId)];

      if (filter.entityId !== undefined) {
        conditions.push(
          or(
            eq(relations.sourceId, filter.entityId),
            eq(relations.targetId, filter.entityId),
          )!,
        );
      }

      if (filter.typeId !== undefined) {
        conditions.push(eq(relations.typeId, filter.typeId));
      }

      return edgeQuery()
        .where(and(...conditions))
        .orderBy(desc(relations.updatedAt), desc(relations.createdAt))
        .limit(filter.limit)
        .all()
        .map(toEdgeRecord);
    },

    findById(worldId, id) {
      const row = edgeQuery()
        .where(and(eq(relations.worldId, worldId), eq(relations.id, id)))
        .get();

      return row === undefined ? null : toEdgeRecord(row);
    },

    findDuplicate(worldId, sourceId, targetId, typeId, excludeId) {
      const conditions = [
        eq(relations.worldId, worldId),
        eq(relations.sourceId, sourceId),
        eq(relations.targetId, targetId),
        eq(relations.typeId, typeId),
      ];

      if (excludeId !== undefined) {
        conditions.push(ne(relations.id, excludeId));
      }

      const row = database
        .select({ id: relations.id })
        .from(relations)
        .where(and(...conditions))
        .get();

      return row ?? null;
    },

    insert(record) {
      database
        .insert(relations)
        .values({
          id: record.id,
          worldId: record.worldId,
          sourceId: record.source.id,
          targetId: record.target.id,
          typeId: record.typeId,
          label: record.label,
          inverseLabel: record.inverseLabel,
          notes: record.notes,
          strength: record.strength,
          metadata: JSON.stringify(record.metadata),
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .run();
    },

    update(record) {
      const result = database
        .update(relations)
        .set({
          typeId: record.typeId,
          label: record.label,
          inverseLabel: record.inverseLabel,
          notes: record.notes,
          strength: record.strength,
          metadata: JSON.stringify(record.metadata),
          updatedAt: record.updatedAt,
        })
        .where(
          and(
            eq(relations.id, record.id),
            eq(relations.worldId, record.worldId),
          ),
        )
        .run();

      return result.changes > 0;
    },

    remove(worldId, id) {
      const result = database
        .delete(relations)
        .where(and(eq(relations.id, id), eq(relations.worldId, worldId)))
        .run();

      return result.changes > 0;
    },
  };
}

/** Tipo de color normalizado a partir de una fila. */
function normalizeColor(value: string) {
  return isEntityTypeColor(value) ? value : ('moss' as const);
}

function toTypeRecord(row: {
  readonly id: string;
  readonly worldId: string | null;
  readonly key: string;
  readonly name: string;
  readonly inverseName: string;
  readonly color: string;
  readonly isSystem: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}): RelationTypeRecord {
  return {
    id: row.id,
    worldId: row.worldId,
    key: row.key,
    name: row.name,
    inverseName: row.inverseName,
    color: normalizeColor(row.color),
    isSystem: row.isSystem === 1 || row.worldId === null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

interface EdgeRow {
  readonly id: string;
  readonly worldId: string;
  readonly typeId: string;
  readonly typeKey: string;
  readonly typeName: string;
  readonly typeInverseName: string;
  readonly typeColor: string;
  readonly isSystemType: number;
  readonly label: string | null;
  readonly inverseLabel: string | null;
  readonly notes: string | null;
  readonly strength: number;
  readonly metadata: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceTypeKey: string;
  readonly sourceTypeName: string;
  readonly sourceTypeIcon: string;
  readonly sourceTypeColor: string;
  readonly targetId: string;
  readonly targetName: string;
  readonly targetTypeKey: string;
  readonly targetTypeName: string;
  readonly targetTypeIcon: string;
  readonly targetTypeColor: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

function toEdgeRecord(row: EdgeRow): RelationEdgeRecord {
  return {
    id: row.id,
    worldId: row.worldId,
    typeId: row.typeId,
    typeKey: row.typeKey,
    typeName: row.typeName,
    typeInverseName: row.typeInverseName,
    typeColor: normalizeColor(row.typeColor),
    isSystemType: row.isSystemType === 1,
    label: row.label,
    inverseLabel: row.inverseLabel,
    notes: row.notes,
    strength: row.strength,
    metadata: parseMetadata(row.metadata),
    source: toEntityRef(row, 'source'),
    target: toEntityRef(row, 'target'),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEntityRef(
  row: EdgeRow,
  side: 'source' | 'target',
): RelationEntityRef {
  const prefix = side === 'source' ? 'source' : 'target';

  return {
    id: row[`${prefix}Id`],
    name: row[`${prefix}Name`],
    typeKey: row[`${prefix}TypeKey`],
    typeName: row[`${prefix}TypeName`],
    typeIcon: normalizeIcon(row[`${prefix}TypeIcon`]),
    typeColor: normalizeColor(row[`${prefix}TypeColor`]),
  };
}

function normalizeIcon(value: string): EntityTypeIcon {
  return isEntityTypeIcon(value) ? value : 'book-open';
}

function parseMetadata(
  raw: string,
): Readonly<Record<string, RelationMetadataValue>> {
  try {
    const value = JSON.parse(raw) as unknown;

    return isRelationMetadata(value) ? value : {};
  } catch {
    return {};
  }
}
