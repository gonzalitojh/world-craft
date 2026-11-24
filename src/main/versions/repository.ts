/**
 * Repositorio Drizzle del historial de versiones de la descripción.
 *
 * Es la única capa que habla con SQL de `entity_versions` y la que aplica la
 * descripción de una versión sobre la ficha. Las fechas, los IDs y las
 * decisiones de política llegan calculados desde el servicio.
 */
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import type { VersionOrigin } from '../../shared/contracts/versions';
import type { WorldCraftDatabase } from '../db/client';
import { entities } from '../db/schema/entities';
import { entityVersions } from '../db/schema/versions';

/** Fila de `entity_versions` tal como la consume el dominio. */
export interface VersionRecord {
  readonly id: string;
  readonly entityId: string;
  readonly description: string | null;
  readonly descriptionText: string | null;
  readonly label: string | null;
  readonly origin: VersionOrigin;
  readonly createdAt: number;
}

/** Estado mínimo de la ficha sobre la que se guarda o restaura una versión. */
export interface VersionTargetRecord {
  readonly id: string;
  readonly description: string | null;
  readonly descriptionText: string | null;
  readonly deletedAt: number | null;
}

/** Operaciones que necesita el servicio de versiones. */
export interface VersionRepository {
  listByEntity(entityId: string, limit: number): readonly VersionRecord[];
  listAllByEntity(entityId: string): readonly VersionRecord[];
  findVersion(entityId: string, versionId: string): VersionRecord | null;
  findLatest(entityId: string): VersionRecord | null;
  findEntity(worldId: string, entityId: string): VersionTargetRecord | null;
  insert(record: VersionRecord): void;
  deleteByIds(ids: readonly string[]): void;
  updateEntityDescription(
    worldId: string,
    entityId: string,
    description: string | null,
    descriptionText: string | null,
    updatedAt: number,
  ): boolean;
}

interface VersionRow {
  readonly id: string;
  readonly entityId: string;
  readonly description: string | null;
  readonly descriptionText: string | null;
  readonly label: string | null;
  readonly origin: string;
  readonly createdAt: number;
}

/** Crea el repositorio sobre la conexión compartida del proceso principal. */
export function createVersionRepository(
  database: WorldCraftDatabase,
): VersionRepository {
  const selectVersion = () => ({
    id: entityVersions.id,
    entityId: entityVersions.entityId,
    description: entityVersions.description,
    descriptionText: entityVersions.descriptionText,
    label: entityVersions.label,
    origin: entityVersions.origin,
    createdAt: entityVersions.createdAt,
  });

  return {
    listByEntity(entityId, limit) {
      return database
        .select(selectVersion())
        .from(entityVersions)
        .where(eq(entityVersions.entityId, entityId))
        .orderBy(desc(entityVersions.createdAt), desc(entityVersions.id))
        .limit(limit)
        .all()
        .map(toVersionRecord);
    },

    listAllByEntity(entityId) {
      return database
        .select(selectVersion())
        .from(entityVersions)
        .where(eq(entityVersions.entityId, entityId))
        .orderBy(desc(entityVersions.createdAt), desc(entityVersions.id))
        .all()
        .map(toVersionRecord);
    },

    findVersion(entityId, versionId) {
      const row = database
        .select(selectVersion())
        .from(entityVersions)
        .where(
          and(
            eq(entityVersions.entityId, entityId),
            eq(entityVersions.id, versionId),
          ),
        )
        .get();

      return row === undefined ? null : toVersionRecord(row);
    },

    findLatest(entityId) {
      const row = database
        .select(selectVersion())
        .from(entityVersions)
        .where(eq(entityVersions.entityId, entityId))
        .orderBy(desc(entityVersions.createdAt), desc(entityVersions.id))
        .limit(1)
        .get();

      return row === undefined ? null : toVersionRecord(row);
    },

    findEntity(worldId, entityId) {
      const row = database
        .select({
          id: entities.id,
          description: entities.description,
          descriptionText: entities.descriptionText,
          deletedAt: entities.deletedAt,
        })
        .from(entities)
        .where(and(eq(entities.worldId, worldId), eq(entities.id, entityId)))
        .get();

      return row ?? null;
    },

    insert(record) {
      database
        .insert(entityVersions)
        .values({
          id: record.id,
          entityId: record.entityId,
          description: record.description,
          descriptionText: record.descriptionText,
          label: record.label,
          origin: record.origin,
          createdAt: record.createdAt,
        })
        .run();
    },

    deleteByIds(ids) {
      if (ids.length === 0) {
        return;
      }

      database
        .delete(entityVersions)
        .where(inArray(entityVersions.id, [...ids]))
        .run();
    },

    updateEntityDescription(
      worldId,
      entityId,
      description,
      descriptionText,
      updatedAt,
    ) {
      const result = database
        .update(entities)
        .set({ description, descriptionText, updatedAt })
        .where(
          and(
            eq(entities.id, entityId),
            eq(entities.worldId, worldId),
            // Solo una ficha viva recibe una restauración.
            isNull(entities.deletedAt),
          ),
        )
        .run();

      return result.changes > 0;
    },
  };
}

function toVersionRecord(row: VersionRow): VersionRecord {
  return {
    id: row.id,
    entityId: row.entityId,
    description: row.description,
    descriptionText: row.descriptionText,
    label: row.label,
    origin:
      row.origin === 'manual' || row.origin === 'restore' ? row.origin : 'auto',
    createdAt: row.createdAt,
  };
}
