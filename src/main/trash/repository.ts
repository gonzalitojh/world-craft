/**
 * Repositorio Drizzle de la papelera y del borrado físico ordenado.
 *
 * Es la única capa que habla con SQL de la papelera. Las consultas de listado
 * incluyen el mundo de origen aunque esté en papelera para que la interfaz
 * pueda avisar del orden de restauración. El borrado definitivo respeta las
 * claves foráneas existentes: `activity_log` primero al purgar un mundo y los
 * metadatos de los assets no usados se mueven a `assets_quarantine` antes de
 * borrar el mundo. Los archivos de assets nunca se borran desde la papelera.
 */
import { and, desc, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';

import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import { quarantineWorldAssets } from '../assets/quarantine';
import {
  entities,
  entityGallery,
  entityTags,
  tags,
} from '../db/schema/entities';
import { entityTypes } from '../db/schema/entity-types';
import { relations } from '../db/schema/relations';
import { entityVersions } from '../db/schema/versions';
import { activityLog, worlds } from '../db/schema/worlds';

import { countExternalAssetReferences } from './asset-references';
import type { TrashCursor } from './validation';

/** Mundo en papelera para el listado. */
export interface TrashWorldRow {
  readonly id: string;
  readonly name: string;
  readonly deletedAt: number;
}

/** Ficha en papelera con su mundo y tipo de origen. */
export interface TrashEntityRow {
  readonly id: string;
  readonly name: string;
  readonly worldId: string;
  readonly worldName: string;
  readonly typeName: string;
  readonly worldDeletedAt: number | null;
  readonly deletedAt: number;
}

/** Tipo personalizado en papelera con su mundo de origen. */
export interface TrashEntityTypeRow {
  readonly id: string;
  readonly name: string;
  readonly worldId: string;
  readonly worldName: string;
  readonly key: string;
  readonly worldDeletedAt: number | null;
  readonly deletedAt: number;
}

/** Objetivo mínimo para restaurar o purgar un mundo. */
export interface TrashWorldTarget {
  readonly id: string;
  readonly deletedAt: number | null;
}

/** Objetivo mínimo para restaurar o purgar una ficha. */
export interface TrashEntityTarget {
  readonly id: string;
  readonly worldId: string;
  readonly typeId: string;
  readonly deletedAt: number | null;
}

/** Objetivo mínimo para restaurar o purgar un tipo. */
export interface TrashEntityTypeTarget {
  readonly id: string;
  readonly worldId: string | null;
  readonly isSystem: boolean;
  readonly deletedAt: number | null;
}

/** Operaciones que necesita el servicio de papelera. */
export interface TrashRepository {
  listWorlds(
    cursor: TrashCursor | null,
    limit: number,
  ): readonly TrashWorldRow[];
  listEntities(
    cursor: TrashCursor | null,
    limit: number,
  ): readonly TrashEntityRow[];
  listEntityTypes(
    cursor: TrashCursor | null,
    limit: number,
  ): readonly TrashEntityTypeRow[];
  listDeletedWorldIds(): readonly string[];
  listDeletedEntityIds(): readonly string[];
  listDeletedEntityTypeIds(): readonly string[];
  findWorld(id: string): TrashWorldTarget | null;
  findEntity(id: string): TrashEntityTarget | null;
  findEntityType(id: string): TrashEntityTypeTarget | null;
  countEntitiesByType(typeId: string): number;
  restoreWorld(id: string, updatedAt: number): boolean;
  restoreEntity(id: string, updatedAt: number): boolean;
  restoreEntityType(id: string, updatedAt: number): boolean;
  purgeEntity(id: string): void;
  purgeEntityType(id: string): void;
  clearWorldCover(id: string): void;
  purgeWorld(
    id: string,
    at: number,
    allowedWorldIds?: ReadonlySet<string>,
  ): boolean;
}

/** Crea el repositorio sobre la conexión compartida del proceso principal. */
export function createTrashRepository(
  database: WorldCraftDatabase,
  sqlite: SqliteDatabase,
): TrashRepository {
  return {
    listWorlds(cursor, limit) {
      const conditions = [isNotNull(worlds.deletedAt)];

      if (cursor !== null) {
        conditions.push(
          or(
            lt(worlds.deletedAt, cursor.deletedAt),
            and(
              eq(worlds.deletedAt, cursor.deletedAt),
              lt(worlds.id, cursor.id),
            ),
          )!,
        );
      }

      return database
        .select({
          id: worlds.id,
          name: worlds.name,
          deletedAt: worlds.deletedAt,
        })
        .from(worlds)
        .where(and(...conditions))
        .orderBy(desc(worlds.deletedAt), desc(worlds.id))
        .limit(limit)
        .all()
        .flatMap((row) =>
          row.deletedAt === null
            ? []
            : [{ id: row.id, name: row.name, deletedAt: row.deletedAt }],
        );
    },

    listEntities(cursor, limit) {
      const conditions = [isNotNull(entities.deletedAt)];

      if (cursor !== null) {
        conditions.push(
          or(
            lt(entities.deletedAt, cursor.deletedAt),
            and(
              eq(entities.deletedAt, cursor.deletedAt),
              lt(entities.id, cursor.id),
            ),
          )!,
        );
      }

      return database
        .select({
          id: entities.id,
          name: entities.name,
          worldId: entities.worldId,
          worldName: worlds.name,
          typeName: entityTypes.name,
          worldDeletedAt: worlds.deletedAt,
          deletedAt: entities.deletedAt,
        })
        .from(entities)
        .innerJoin(worlds, eq(entities.worldId, worlds.id))
        .innerJoin(entityTypes, eq(entities.typeId, entityTypes.id))
        .where(and(...conditions))
        .orderBy(desc(entities.deletedAt), desc(entities.id))
        .limit(limit)
        .all()
        .flatMap((row) =>
          row.deletedAt === null
            ? []
            : [
                {
                  id: row.id,
                  name: row.name,
                  worldId: row.worldId,
                  worldName: row.worldName,
                  typeName: row.typeName,
                  worldDeletedAt: row.worldDeletedAt,
                  deletedAt: row.deletedAt,
                },
              ],
        );
    },

    listEntityTypes(cursor, limit) {
      const conditions = [
        isNotNull(entityTypes.deletedAt),
        eq(entityTypes.isSystem, 0),
      ];

      if (cursor !== null) {
        conditions.push(
          or(
            lt(entityTypes.deletedAt, cursor.deletedAt),
            and(
              eq(entityTypes.deletedAt, cursor.deletedAt),
              lt(entityTypes.id, cursor.id),
            ),
          )!,
        );
      }

      return database
        .select({
          id: entityTypes.id,
          name: entityTypes.name,
          worldId: worlds.id,
          worldName: worlds.name,
          key: entityTypes.key,
          worldDeletedAt: worlds.deletedAt,
          deletedAt: entityTypes.deletedAt,
        })
        .from(entityTypes)
        .innerJoin(worlds, eq(entityTypes.worldId, worlds.id))
        .where(and(...conditions))
        .orderBy(desc(entityTypes.deletedAt), desc(entityTypes.id))
        .limit(limit)
        .all()
        .flatMap((row) =>
          row.deletedAt === null
            ? []
            : [
                {
                  id: row.id,
                  name: row.name,
                  worldId: row.worldId,
                  worldName: row.worldName,
                  key: row.key,
                  worldDeletedAt: row.worldDeletedAt,
                  deletedAt: row.deletedAt,
                },
              ],
        );
    },

    listDeletedWorldIds() {
      return database
        .select({ id: worlds.id })
        .from(worlds)
        .where(isNotNull(worlds.deletedAt))
        .all()
        .map((row) => row.id);
    },

    listDeletedEntityIds() {
      return database
        .select({ id: entities.id })
        .from(entities)
        .where(isNotNull(entities.deletedAt))
        .all()
        .map((row) => row.id);
    },

    listDeletedEntityTypeIds() {
      return database
        .select({ id: entityTypes.id })
        .from(entityTypes)
        .where(
          and(isNotNull(entityTypes.deletedAt), eq(entityTypes.isSystem, 0)),
        )
        .all()
        .map((row) => row.id);
    },

    findWorld(id) {
      const row = database
        .select({ id: worlds.id, deletedAt: worlds.deletedAt })
        .from(worlds)
        .where(eq(worlds.id, id))
        .get();

      return row ?? null;
    },

    findEntity(id) {
      const row = database
        .select({
          id: entities.id,
          worldId: entities.worldId,
          typeId: entities.typeId,
          deletedAt: entities.deletedAt,
        })
        .from(entities)
        .where(eq(entities.id, id))
        .get();

      return row ?? null;
    },

    findEntityType(id) {
      const row = database
        .select({
          id: entityTypes.id,
          worldId: entityTypes.worldId,
          isSystem: entityTypes.isSystem,
          deletedAt: entityTypes.deletedAt,
        })
        .from(entityTypes)
        .where(eq(entityTypes.id, id))
        .get();

      if (row === undefined) {
        return null;
      }

      return {
        id: row.id,
        worldId: row.worldId,
        isSystem: row.isSystem === 1,
        deletedAt: row.deletedAt,
      };
    },

    countEntitiesByType(typeId) {
      return database
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.typeId, typeId))
        .all().length;
    },

    restoreWorld(id, updatedAt) {
      const result = database
        .update(worlds)
        .set({ deletedAt: null, updatedAt })
        .where(and(eq(worlds.id, id), isNotNull(worlds.deletedAt)))
        .run();

      return result.changes > 0;
    },

    restoreEntity(id, updatedAt) {
      const result = database
        .update(entities)
        .set({ deletedAt: null, updatedAt })
        .where(and(eq(entities.id, id), isNotNull(entities.deletedAt)))
        .run();

      return result.changes > 0;
    },

    restoreEntityType(id, updatedAt) {
      const result = database
        .update(entityTypes)
        .set({ deletedAt: null, updatedAt })
        .where(
          and(
            eq(entityTypes.id, id),
            eq(entityTypes.isSystem, 0),
            isNotNull(entityTypes.deletedAt),
          ),
        )
        .run();

      return result.changes > 0;
    },

    purgeEntity(id) {
      database
        .delete(relations)
        .where(or(eq(relations.sourceId, id), eq(relations.targetId, id)))
        .run();
      database
        .delete(entityVersions)
        .where(eq(entityVersions.entityId, id))
        .run();
      database.delete(entityTags).where(eq(entityTags.entityId, id)).run();
      database
        .delete(entityGallery)
        .where(eq(entityGallery.entityId, id))
        .run();
      database.delete(entities).where(eq(entities.id, id)).run();
    },

    purgeEntityType(id) {
      database
        .delete(entityTypes)
        .where(and(eq(entityTypes.id, id), eq(entityTypes.isSystem, 0)))
        .run();
    },

    clearWorldCover(id) {
      database
        .update(worlds)
        .set({ coverAssetId: null })
        .where(eq(worlds.id, id))
        .run();
    },

    purgeWorld(id, at, allowedWorldIds) {
      // Un asset está en uso si una fila que sobrevive a la purga lo
      // referencia. El propio mundo y los demás mundos que se purgan en el
      // mismo vaciado no bloquean.
      if (countExternalAssetReferences(sqlite, id, allowedWorldIds) > 0) {
        return false;
      }

      // La portada del mundo se retira antes de borrar sus assets: la FK
      // `RESTRICT` impediría la purga y la referencia no debe sobrevivir.
      database
        .update(worlds)
        .set({ coverAssetId: null })
        .where(eq(worlds.id, id))
        .run();

      // `activity_log` no tiene cascada y bloquearía el resto del borrado.
      database.delete(activityLog).where(eq(activityLog.worldId, id)).run();
      database.delete(relations).where(eq(relations.worldId, id)).run();

      const entityIds = database
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.worldId, id))
        .all()
        .map((row) => row.id);

      if (entityIds.length > 0) {
        database
          .delete(entityGallery)
          .where(inArray(entityGallery.entityId, entityIds))
          .run();
        database
          .delete(entityTags)
          .where(inArray(entityTags.entityId, entityIds))
          .run();
        database
          .delete(entityVersions)
          .where(inArray(entityVersions.entityId, entityIds))
          .run();
      }

      database.delete(entities).where(eq(entities.worldId, id)).run();
      database
        .delete(entityTypes)
        .where(and(eq(entityTypes.worldId, id), eq(entityTypes.isSystem, 0)))
        .run();
      database.delete(tags).where(eq(tags.worldId, id)).run();

      // Los metadatos del asset se conservan en cuarentena; los archivos del
      // equipo nunca se borran desde la papelera.
      quarantineWorldAssets(sqlite, id, at);

      database.delete(worlds).where(eq(worlds.id, id)).run();

      return true;
    },
  };
}
