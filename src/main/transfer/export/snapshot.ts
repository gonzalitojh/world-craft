/**
 * Instantánea de solo lectura de un mundo vivo.
 *
 * Se ejecuta dentro de una transacción diferida sobre la conexión WAL. Solo
 * viajan filas vivas: fichas cuya `deleted_at` es nula, sus tipos, etiquetas,
 * galería, versiones y relaciones con ambos extremos vivos. La papelera,
 * `activity_log`, FTS y las preferencias quedan fuera.
 *
 * Los assets se consultan por los IDs referenciados (portada, imagen principal
 * y galería). Si una referencia apunta a una fila inexistente, la exportación
 * falla con `TRANSFER_ASSET_INVALID` en lugar de producir un ZIP incoherente.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import type { WorldCraftDatabase } from '../../db/client';
import type { SqliteDatabase } from '../../db/connection';
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
import { worlds } from '../../db/schema/worlds';
import { ASSET_KINDS, type AssetKind } from '../../assets/constants';
import {
  TRANSFER_MAX_ASSETS,
  TRANSFER_MAX_ENTITIES,
  TRANSFER_MAX_ENTITY_TYPES,
  TRANSFER_MAX_RELATIONS,
  TRANSFER_MAX_RELATION_TYPES,
  TRANSFER_MAX_TAGS,
  TRANSFER_MAX_VERSIONS,
} from '../../../shared/contracts/transfer';
import type {
  EntityFieldDefinition,
  EntityTypeColor,
  EntityTypeIcon,
} from '../../../shared/contracts/entity-types';
import type { RelationColor } from '../../../shared/contracts/relations';
import type { EntityStatus } from '../../../shared/contracts/entities';
import type { VersionOrigin } from '../../../shared/contracts/versions';
import type {
  WorldLanguage,
  WorldStatus,
} from '../../../shared/contracts/worlds';
import { TransferError } from '../errors';

/** Mundo tal como lo necesita la exportación. */
export interface SnapshotWorld {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly genres: readonly string[];
  readonly language: WorldLanguage;
  readonly status: WorldStatus;
  readonly coverAssetId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Tipo personalizado del mundo. */
export interface SnapshotEntityType {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly fields: readonly EntityFieldDefinition[];
}

/** Tipo de relación personalizado del mundo. */
export interface SnapshotRelationType {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly inverseName: string;
  readonly color: RelationColor;
}

/** Etiqueta del mundo. */
export interface SnapshotTag {
  readonly id: string;
  readonly name: string;
  readonly color: EntityTypeColor;
  readonly createdAt: number;
}

/** Ficha viva con su tipo resuelto por clave. */
export interface SnapshotEntity {
  readonly id: string;
  readonly typeKey: string;
  readonly name: string;
  readonly slug: string;
  readonly aliases: readonly string[];
  readonly summary: string | null;
  readonly description: string | null;
  readonly attributes: string;
  readonly status: EntityStatus;
  readonly isFavorite: boolean;
  readonly imageAssetId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Fila de versión. */
export interface SnapshotVersion {
  readonly id: string;
  readonly entityId: string;
  readonly description: string | null;
  readonly label: string | null;
  readonly origin: VersionOrigin;
  readonly createdAt: number;
}

/** Relación viva entre dos fichas vivas. */
export interface SnapshotRelation {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly typeKey: string;
  readonly label: string | null;
  readonly inverseLabel: string | null;
  readonly notes: string | null;
  readonly strength: number;
  readonly metadata: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Asset referenciado por el mundo. */
export interface SnapshotAsset {
  readonly id: string;
  readonly kind: AssetKind;
  readonly relativePath: string;
  readonly mime: string;
  readonly size: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
  readonly hash: string;
  readonly createdAt: number;
}

/** Galería ordenada por ficha. */
export interface SnapshotGalleryItem {
  readonly entityId: string;
  readonly assetId: string;
  readonly position: number;
}

/** Instantánea completa. */
export interface WorldSnapshot {
  readonly world: SnapshotWorld;
  readonly entityTypes: readonly SnapshotEntityType[];
  readonly relationTypes: readonly SnapshotRelationType[];
  readonly tags: readonly SnapshotTag[];
  readonly entities: readonly SnapshotEntity[];
  readonly gallery: readonly SnapshotGalleryItem[];
  readonly entityTagNames: ReadonlyMap<string, readonly string[]>;
  readonly versions: readonly SnapshotVersion[];
  readonly relations: readonly SnapshotRelation[];
  readonly assets: readonly SnapshotAsset[];
}

/** Opciones de la instantánea. */
export interface SnapshotOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly worldId: string;
}

/** Lee la instantánea dentro de una transacción de solo lectura. */
export function readWorldSnapshot(options: SnapshotOptions): WorldSnapshot {
  const read = options.sqlite.transaction(() => buildSnapshot(options));

  return read.deferred();
}

function buildSnapshot(options: SnapshotOptions): WorldSnapshot {
  const world = readWorld(options);

  if (world === null) {
    throw new TransferError('TRANSFER_SOURCE_NOT_FOUND');
  }

  const customEntityTypes = options.database
    .select()
    .from(entityTypes)
    .where(
      and(
        eq(entityTypes.worldId, world.id),
        eq(entityTypes.isSystem, 0),
        isNull(entityTypes.deletedAt),
      ),
    )
    .orderBy(asc(entityTypes.key))
    .all()
    .map(toEntityType);

  if (customEntityTypes.length > TRANSFER_MAX_ENTITY_TYPES) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  const customRelationTypes = options.database
    .select()
    .from(relationTypes)
    .where(eq(relationTypes.worldId, world.id))
    .orderBy(asc(relationTypes.key))
    .all()
    .map(toRelationType);

  if (customRelationTypes.length > TRANSFER_MAX_RELATION_TYPES) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  const worldTags = options.database
    .select()
    .from(tags)
    .where(eq(tags.worldId, world.id))
    .orderBy(asc(tags.name))
    .all()
    .map(toTag);

  if (worldTags.length > TRANSFER_MAX_TAGS) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  const liveEntities = options.database
    .select({
      id: entities.id,
      typeKey: entityTypes.key,
      name: entities.name,
      slug: entities.slug,
      aliases: entities.aliases,
      summary: entities.summary,
      description: entities.description,
      attributes: entities.attributes,
      status: entities.status,
      isFavorite: entities.isFavorite,
      imageAssetId: entities.imageAssetId,
      createdAt: entities.createdAt,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .innerJoin(entityTypes, eq(entities.typeId, entityTypes.id))
    .where(and(eq(entities.worldId, world.id), isNull(entities.deletedAt)))
    .orderBy(
      asc(entities.createdAt),
      asc(entities.id),
      asc(entities.name),
      asc(entities.slug),
    )
    .all()
    .map((row) => ({
      ...row,
      aliases: parseAliases(row.aliases),
      isFavorite: row.isFavorite === 1,
      status:
        row.status === 'draft' || row.status === 'archived'
          ? row.status
          : ('active' as const),
    })) satisfies readonly SnapshotEntity[];

  if (liveEntities.length > TRANSFER_MAX_ENTITIES) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  const liveEntityIds = new Set(liveEntities.map((entity) => entity.id));
  const entityTagNames = readEntityTagNames(options, world.id);
  const gallery = options.database
    .select({
      entityId: entityGallery.entityId,
      assetId: entityGallery.assetId,
      position: entityGallery.position,
    })
    .from(entityGallery)
    .innerJoin(entities, eq(entityGallery.entityId, entities.id))
    .where(and(eq(entities.worldId, world.id), isNull(entities.deletedAt)))
    .orderBy(asc(entityGallery.entityId), asc(entityGallery.position))
    .all();

  const versions = options.database
    .select({
      id: entityVersions.id,
      entityId: entityVersions.entityId,
      description: entityVersions.description,
      label: entityVersions.label,
      origin: entityVersions.origin,
      createdAt: entityVersions.createdAt,
    })
    .from(entityVersions)
    .innerJoin(entities, eq(entityVersions.entityId, entities.id))
    .where(and(eq(entities.worldId, world.id), isNull(entities.deletedAt)))
    .orderBy(
      asc(entityVersions.entityId),
      asc(entityVersions.createdAt),
      asc(entityVersions.id),
    )
    .all()
    .map(toVersion);

  if (versions.length > TRANSFER_MAX_VERSIONS) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  const allRelations = options.database
    .select()
    .from(relations)
    .where(eq(relations.worldId, world.id))
    .orderBy(asc(relations.createdAt), asc(relations.id))
    .all();

  const liveRelations = allRelations.filter(
    (relation) =>
      liveEntityIds.has(relation.sourceId) &&
      liveEntityIds.has(relation.targetId),
  );

  if (liveRelations.length > TRANSFER_MAX_RELATIONS) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  const relationTypeKeys = new Map(
    customRelationTypes.map((type) => [type.id, type.key]),
  );
  const systemRelationKeys = readSystemRelationTypeKeys(options);

  const relationRows: SnapshotRelation[] = liveRelations.flatMap((row) => {
    const typeKey =
      relationTypeKeys.get(row.typeId) ?? systemRelationKeys.get(row.typeId);

    if (typeKey === undefined) {
      throw new TransferError('TRANSFER_INTERNAL');
    }

    return [
      {
        id: row.id,
        sourceId: row.sourceId,
        targetId: row.targetId,
        typeKey,
        label: row.label,
        inverseLabel: row.inverseLabel,
        notes: row.notes,
        strength: row.strength,
        metadata: row.metadata,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    ];
  });

  const referencedAssetIds = new Set<string>();

  if (world.coverAssetId !== null) {
    referencedAssetIds.add(world.coverAssetId);
  }

  for (const entity of liveEntities) {
    if (entity.imageAssetId !== null) {
      referencedAssetIds.add(entity.imageAssetId);
    }
  }

  for (const item of gallery) {
    referencedAssetIds.add(item.assetId);
  }

  if (referencedAssetIds.size > TRANSFER_MAX_ASSETS) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  const assetRows = readAssets(options, world.id, referencedAssetIds);

  if (assetRows.length !== referencedAssetIds.size) {
    throw new TransferError('TRANSFER_ASSET_INVALID');
  }

  return {
    world,
    entityTypes: customEntityTypes,
    relationTypes: customRelationTypes,
    tags: worldTags,
    entities: liveEntities,
    gallery,
    entityTagNames,
    versions,
    relations: relationRows,
    assets: assetRows,
  };
}

function readWorld(options: SnapshotOptions): SnapshotWorld | null {
  const row = options.database
    .select()
    .from(worlds)
    .where(and(eq(worlds.id, options.worldId), isNull(worlds.deletedAt)))
    .get();

  if (row === undefined) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    genres: parseGenres(row.genres),
    language:
      row.language === 'en' || row.language === 'it' ? row.language : 'es',
    status: row.status === 'archived' ? 'archived' : 'active',
    coverAssetId: row.coverAssetId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function readEntityTagNames(
  options: SnapshotOptions,
  worldId: string,
): ReadonlyMap<string, readonly string[]> {
  const rows = options.database
    .select({ entityId: entityTags.entityId, name: tags.name })
    .from(entityTags)
    .innerJoin(entities, eq(entityTags.entityId, entities.id))
    .innerJoin(tags, eq(entityTags.tagId, tags.id))
    .where(and(eq(entities.worldId, worldId), isNull(entities.deletedAt)))
    .orderBy(asc(entityTags.entityId), asc(tags.name))
    .all();

  const result = new Map<string, string[]>();

  for (const row of rows) {
    const current = result.get(row.entityId) ?? [];
    current.push(row.name);
    result.set(row.entityId, current);
  }

  return result;
}

function readSystemRelationTypeKeys(
  options: SnapshotOptions,
): ReadonlyMap<string, string> {
  const rows = options.database
    .select({ id: relationTypes.id, key: relationTypes.key })
    .from(relationTypes)
    .where(isNull(relationTypes.worldId))
    .all();

  return new Map(rows.map((row) => [row.id, row.key]));
}

function readAssets(
  options: SnapshotOptions,
  worldId: string,
  assetIds: ReadonlySet<string>,
): readonly SnapshotAsset[] {
  if (assetIds.size === 0) {
    return [];
  }

  const ids = [...assetIds].sort();
  const rows: SnapshotAsset[] = [];

  for (let index = 0; index < ids.length; index += 400) {
    const chunk = ids.slice(index, index + 400);
    const found = options.database
      .select()
      .from(assets)
      .where(and(eq(assets.worldId, worldId), inArray(assets.id, chunk)))
      .all();

    for (const row of found) {
      rows.push({
        id: row.id,
        kind: ASSET_KINDS.includes(row.kind as AssetKind)
          ? (row.kind as AssetKind)
          : 'other',
        relativePath: row.relativePath,
        mime: row.mime,
        size: row.size,
        width: row.width,
        height: row.height,
        alt: row.alt,
        hash: row.hash,
        createdAt: row.createdAt,
      });
    }
  }

  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

function toEntityType(row: {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly fields: string;
}): SnapshotEntityType {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    icon: row.icon as EntityTypeIcon,
    color: row.color as EntityTypeColor,
    fields: parseFields(row.fields),
  };
}

function toRelationType(row: {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly inverseName: string;
  readonly color: string;
}): SnapshotRelationType {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    inverseName: row.inverseName,
    color: row.color as RelationColor,
  };
}

function toTag(row: {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly createdAt: number;
}): SnapshotTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color as EntityTypeColor,
    createdAt: row.createdAt,
  };
}

function toVersion(row: {
  readonly id: string;
  readonly entityId: string;
  readonly description: string | null;
  readonly label: string | null;
  readonly origin: string;
  readonly createdAt: number;
}): SnapshotVersion {
  return {
    id: row.id,
    entityId: row.entityId,
    description: row.description,
    label: row.label,
    origin:
      row.origin === 'manual' || row.origin === 'restore' ? row.origin : 'auto',
    createdAt: row.createdAt,
  };
}

function parseAliases(raw: string): readonly string[] {
  const value = parseJson(raw);

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function parseGenres(raw: string): readonly string[] {
  const value = parseJson(raw);

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function parseFields(raw: string): readonly EntityFieldDefinition[] {
  const value = parseJson(raw);

  return Array.isArray(value) ? (value as EntityFieldDefinition[]) : [];
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
