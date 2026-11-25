/**
 * Inserción del plan de importación en una única transacción.
 *
 * El servicio abre la transacción; este repositorio solo ejecuta las
 * inserciones en orden de claves foráneas: mundo, tipos, etiquetas, assets,
 * fichas, versiones, etiquetas de ficha, galería, relaciones y, al final, la
 * portada del mundo y la actividad `world.imported`.
 *
 * Los inserts masivos se trocean para no superar el límite de variables de
 * SQLite. Ningún dato se inventa: si un tipo del sistema no existe, la
 * importación falla y la transacción se revierte.
 */
import { and, eq, isNull } from 'drizzle-orm';

import type { WorldCraftDatabase } from '../../db/client';
import { generateUuidv7 } from '../../db/ids';
import { assets } from '../../db/schema/assets';
import {
  entities,
  entityGallery,
  entityTags,
  tags,
} from '../../db/schema/entities';
import { entityTypes } from '../../db/schema/entity-types';
import { relationTypes, relations } from '../../db/schema/relations';
import { entityVersions } from '../../db/schema/versions';
import { activityLog, worlds } from '../../db/schema/worlds';
import { TransferError } from '../errors';
import type { ImportPlan } from './plan';

/** Operaciones que necesita el servicio de importación. */
export interface ImportRepository {
  listWorldSlugs(): readonly string[];
  insertPlan(plan: ImportPlan): void;
  finalizePlan(plan: ImportPlan): void;
}

interface TypeMaps {
  readonly entityTypeIds: ReadonlyMap<string, string>;
  readonly relationTypeIds: ReadonlyMap<string, string>;
}

/** Crea el repositorio sobre la conexión compartida. */
export function createImportRepository(
  database: WorldCraftDatabase,
): ImportRepository {
  return {
    listWorldSlugs() {
      try {
        return database
          .select({ slug: worlds.slug })
          .from(worlds)
          .all()
          .map((row) => row.slug);
      } catch (error) {
        throw new TransferError('TRANSFER_SAVE_FAILED', { cause: error });
      }
    },

    insertPlan(plan) {
      const maps = resolveTypeMaps(database, plan);

      try {
        insertWorld(database, plan);
        insertEntityTypes(database, plan);
        insertRelationTypes(database, plan);
        insertTags(database, plan);
        insertAssets(database, plan);
        insertEntities(database, plan, maps);
        insertVersions(database, plan);
        insertEntityTags(database, plan);
        insertGallery(database, plan);
        insertRelations(database, plan, maps);
      } catch (error) {
        throw new TransferError('TRANSFER_SAVE_FAILED', { cause: error });
      }
    },

    finalizePlan(plan) {
      try {
        database
          .update(worlds)
          .set({ coverAssetId: plan.coverAssetId })
          .where(eq(worlds.id, plan.worldId))
          .run();

        database
          .insert(activityLog)
          .values({
            id: generateUuidv7(),
            worldId: plan.worldId,
            action: 'world.imported',
            entityType: 'world',
            entityId: null,
            diff: JSON.stringify({
              counts: plan.counts,
              warnings: plan.warnings.reduce(
                (total, warning) => total + warning.count,
                0,
              ),
            }),
            createdAt: plan.importedAt,
          })
          .run();
      } catch (error) {
        throw new TransferError('TRANSFER_SAVE_FAILED', { cause: error });
      }
    },
  };
}

function resolveTypeMaps(
  database: WorldCraftDatabase,
  plan: ImportPlan,
): TypeMaps {
  const entityTypeIds = new Map(
    plan.entityTypes.map((type) => [type.key, type.id]),
  );
  const relationTypeIds = new Map(
    plan.relationTypes.map((type) => [type.key, type.id]),
  );

  for (const key of new Set(plan.entities.map((entity) => entity.typeKey))) {
    if (entityTypeIds.has(key)) {
      continue;
    }

    const row = database
      .select({ id: entityTypes.id })
      .from(entityTypes)
      .where(
        and(
          isNull(entityTypes.worldId),
          eq(entityTypes.isSystem, 1),
          eq(entityTypes.key, key),
          isNull(entityTypes.deletedAt),
        ),
      )
      .get();

    if (row === undefined) {
      throw new TransferError('TRANSFER_SAVE_FAILED');
    }

    entityTypeIds.set(key, row.id);
  }

  for (const key of new Set(
    plan.relations.map((relation) => relation.typeKey),
  )) {
    if (relationTypeIds.has(key)) {
      continue;
    }

    const row = database
      .select({ id: relationTypes.id })
      .from(relationTypes)
      .where(
        and(
          isNull(relationTypes.worldId),
          eq(relationTypes.isSystem, 1),
          eq(relationTypes.key, key),
        ),
      )
      .get();

    if (row === undefined) {
      throw new TransferError('TRANSFER_SAVE_FAILED');
    }

    relationTypeIds.set(key, row.id);
  }

  return { entityTypeIds, relationTypeIds };
}

function insertWorld(database: WorldCraftDatabase, plan: ImportPlan): void {
  database
    .insert(worlds)
    .values({
      id: plan.worldId,
      name: plan.world.name,
      slug: plan.world.slug,
      summary: plan.world.summary,
      description: plan.world.description,
      coverAssetId: null,
      genres: JSON.stringify(plan.world.genres),
      status: 'active',
      language: plan.world.language,
      settings: '{}',
      createdAt: plan.importedAt,
      updatedAt: plan.importedAt,
      archivedAt: null,
      deletedAt: null,
    })
    .run();
}

function insertEntityTypes(
  database: WorldCraftDatabase,
  plan: ImportPlan,
): void {
  for (const type of plan.entityTypes) {
    database
      .insert(entityTypes)
      .values({
        id: type.id,
        worldId: plan.worldId,
        key: type.key,
        name: type.name,
        icon: type.icon,
        color: type.color,
        fields: JSON.stringify(type.fields),
        isSystem: 0,
        createdAt: type.createdAt,
        updatedAt: type.updatedAt,
        deletedAt: null,
      })
      .run();
  }
}

function insertRelationTypes(
  database: WorldCraftDatabase,
  plan: ImportPlan,
): void {
  for (const type of plan.relationTypes) {
    database
      .insert(relationTypes)
      .values({
        id: type.id,
        worldId: plan.worldId,
        key: type.key,
        name: type.name,
        inverseName: type.inverseName,
        color: type.color,
        isSystem: 0,
        createdAt: type.createdAt,
        updatedAt: type.updatedAt,
      })
      .run();
  }
}

function insertTags(database: WorldCraftDatabase, plan: ImportPlan): void {
  for (const tag of plan.tags) {
    database
      .insert(tags)
      .values({
        id: tag.id,
        worldId: plan.worldId,
        name: tag.name,
        color: tag.color,
        createdAt: tag.createdAt,
      })
      .run();
  }
}

function insertAssets(database: WorldCraftDatabase, plan: ImportPlan): void {
  for (const chunk of chunks(plan.assets, 400)) {
    database
      .insert(assets)
      .values(
        chunk.map((asset) => ({
          id: asset.id,
          worldId: plan.worldId,
          kind: 'image' as const,
          relativePath: asset.relativePath,
          mime: 'image/webp',
          size: asset.size,
          width: asset.width,
          height: asset.height,
          alt: asset.alt,
          hash: asset.hash,
          createdAt: asset.createdAt,
        })),
      )
      .run();
  }
}

function insertEntities(
  database: WorldCraftDatabase,
  plan: ImportPlan,
  maps: TypeMaps,
): void {
  for (const chunk of chunks(plan.entities, 400)) {
    database
      .insert(entities)
      .values(
        chunk.map((entity) => {
          const typeId = maps.entityTypeIds.get(entity.typeKey);

          if (typeId === undefined) {
            throw new TransferError('TRANSFER_SAVE_FAILED');
          }

          return {
            id: entity.id,
            worldId: plan.worldId,
            typeId,
            name: entity.name,
            slug: entity.slug,
            aliases: JSON.stringify(entity.aliases),
            summary: entity.summary,
            description:
              entity.description === null
                ? null
                : JSON.stringify(entity.description),
            descriptionText: entity.descriptionText,
            imageAssetId: entity.imageAssetId,
            attributes: JSON.stringify(entity.attributes),
            status: entity.status,
            isFavorite: entity.isFavorite ? 1 : 0,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            deletedAt: null,
          };
        }),
      )
      .run();
  }
}

function insertVersions(database: WorldCraftDatabase, plan: ImportPlan): void {
  for (const chunk of chunks(plan.versions, 500)) {
    database
      .insert(entityVersions)
      .values(
        chunk.map((version) => ({
          id: version.id,
          entityId: version.entityId,
          description:
            version.description === null
              ? null
              : JSON.stringify(version.description),
          descriptionText: version.descriptionText,
          label: version.label,
          origin: version.origin,
          createdAt: version.createdAt,
        })),
      )
      .run();
  }
}

function insertEntityTags(
  database: WorldCraftDatabase,
  plan: ImportPlan,
): void {
  for (const chunk of chunks(plan.entityTags, 1_000)) {
    database.insert(entityTags).values(chunk).run();
  }
}

function insertGallery(database: WorldCraftDatabase, plan: ImportPlan): void {
  for (const chunk of chunks(plan.gallery, 1_000)) {
    database.insert(entityGallery).values(chunk).run();
  }
}

function insertRelations(
  database: WorldCraftDatabase,
  plan: ImportPlan,
  maps: TypeMaps,
): void {
  for (const chunk of chunks(plan.relations, 500)) {
    database
      .insert(relations)
      .values(
        chunk.map((relation) => {
          const typeId = maps.relationTypeIds.get(relation.typeKey);

          if (typeId === undefined) {
            throw new TransferError('TRANSFER_SAVE_FAILED');
          }

          return {
            id: relation.id,
            worldId: plan.worldId,
            sourceId: relation.sourceId,
            targetId: relation.targetId,
            typeId,
            label: relation.label,
            inverseLabel: relation.inverseLabel,
            notes: relation.notes,
            strength: relation.strength,
            metadata: JSON.stringify(relation.metadata),
            createdAt: relation.createdAt,
            updatedAt: relation.updatedAt,
          };
        }),
      )
      .run();
  }
}

function chunks<T>(items: readonly T[], size: number): readonly T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}
