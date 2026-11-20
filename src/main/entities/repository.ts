/**
 * Repositorio Drizzle de fichas, etiquetas y galería.
 *
 * Es la única capa que habla con SQL. Todas las consultas de un mundo filtran
 * por `world_id`; la actividad, los tipos y los assets se resuelven en sus
 * propios módulos. Las fechas y los IDs llegan ya calculados por el servicio.
 *
 * Las filas se leen con la plantilla del tipo como JSON; si una fila manipulada
 * no cumple la forma, se degrada a un valor vacío en lugar de romper la lista.
 */
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import {
  isEntityStatus,
  type EntityGalleryItem,
  type EntityStatus,
  type EntityTag,
} from '../../shared/contracts/entities';
import {
  entityFieldTemplateSchema,
  type EntityFieldValue,
} from '../../shared/entity-types/fields';
import {
  isEntityTypeColor,
  isEntityTypeIcon,
  type EntityFieldDefinition,
  type EntityTypeColor,
  type EntityTypeIcon,
} from '../../shared/contracts/entity-types';
import type { WorldCraftDatabase } from '../db/client';
import { assets } from '../db/schema/assets';
import {
  entities,
  entityGallery,
  entityTags,
  tags,
} from '../db/schema/entities';
import { entityTypes } from '../db/schema/entity-types';
import { worlds } from '../db/schema/worlds';

/** Filtro ya normalizado que recibe el repositorio. */
export interface EntityRepositoryFilter {
  readonly typeId?: string | undefined;
  readonly tagId?: string | undefined;
  readonly favorite?: boolean | undefined;
  readonly status?: EntityStatus | undefined;
  readonly search?: string | undefined;
  readonly limit: number;
}

/** Ficha con su tipo resuelto, sin descripción ni galería. */
export interface EntitySummaryRecord {
  readonly id: string;
  readonly worldId: string;
  readonly typeId: string;
  readonly typeKey: string;
  readonly typeName: string;
  readonly typeIcon: EntityTypeIcon;
  readonly typeColor: EntityTypeColor;
  readonly name: string;
  readonly slug: string;
  readonly aliases: readonly string[];
  readonly summary: string | null;
  readonly imageAssetId: string | null;
  readonly isFavorite: boolean;
  readonly status: EntityStatus;
  readonly tags: readonly EntityTag[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Ficha completa, con descripción, atributos y galería. */
export interface EntityRecord {
  readonly id: string;
  readonly worldId: string;
  readonly typeId: string;
  readonly typeKey: string;
  readonly typeName: string;
  readonly typeIcon: EntityTypeIcon;
  readonly typeColor: EntityTypeColor;
  readonly name: string;
  readonly slug: string;
  readonly aliases: readonly string[];
  readonly summary: string | null;
  readonly description: string | null;
  readonly descriptionText: string | null;
  readonly imageAssetId: string | null;
  readonly attributes: Readonly<Record<string, EntityFieldValue>>;
  readonly status: EntityStatus;
  readonly isFavorite: boolean;
  readonly tags: readonly EntityTag[];
  readonly gallery: readonly EntityGalleryItem[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deletedAt: number | null;
}

/** Tipo resuelto para crear o validar una ficha. */
export interface EntityTypeRecord {
  readonly id: string;
  readonly worldId: string | null;
  readonly key: string;
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly fields: readonly EntityFieldDefinition[];
  readonly isSystem: boolean;
  readonly deletedAt: number | null;
}

/** Asset mínimo para validar una imagen y montar la galería. */
export interface EntityAssetRecord {
  readonly id: string;
  readonly worldId: string;
  readonly kind: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
  readonly createdAt: number;
}

/** Referencia mínima de una ficha para validar un campo `reference`. */
export interface EntityReferenceRecord {
  readonly id: string;
  readonly typeKey: string;
  readonly deletedAt: number | null;
}

/** Operaciones que necesita el servicio de fichas. */
export interface EntityRepository {
  worldExists(worldId: string): boolean;
  list(
    worldId: string,
    filter: EntityRepositoryFilter,
  ): readonly EntitySummaryRecord[];
  findById(worldId: string, id: string): EntityRecord | null;
  findBySlug(worldId: string, slug: string): { readonly id: string } | null;
  insert(record: EntityRecord): void;
  update(record: EntityRecord): boolean;
  setFavorite(
    worldId: string,
    id: string,
    favorite: boolean,
    updatedAt: number,
  ): boolean;
  softDelete(worldId: string, id: string, deletedAt: number): boolean;
  listTagsByEntityIds(
    entityIds: readonly string[],
  ): ReadonlyMap<string, readonly EntityTag[]>;
  listGallery(entityId: string): readonly EntityGalleryItem[];
  replaceGallery(entityId: string, assetIds: readonly string[]): void;
  listTags(worldId: string): readonly EntityTag[];
  findTagById(worldId: string, id: string): EntityTag | null;
  findTagByName(worldId: string, name: string): EntityTag | null;
  insertTag(tag: EntityTag): void;
  replaceTags(entityId: string, tagIds: readonly string[]): void;
  findType(worldId: string, typeId: string): EntityTypeRecord | null;
  findTypeByKey(worldId: string, key: string): EntityTypeRecord | null;
  findAsset(worldId: string, assetId: string): EntityAssetRecord | null;
  listImageAssets(worldId: string): readonly EntityAssetRecord[];
  findReference(
    worldId: string,
    entityId: string,
  ): EntityReferenceRecord | null;
}

/** Crea el repositorio sobre la conexión compartida del proceso principal. */
export function createEntityRepository(
  database: WorldCraftDatabase,
): EntityRepository {
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

    list(worldId, filter) {
      const conditions = [
        eq(entities.worldId, worldId),
        isNull(entities.deletedAt),
      ];

      if (filter.typeId !== undefined) {
        conditions.push(eq(entities.typeId, filter.typeId));
      }

      if (filter.favorite !== undefined) {
        conditions.push(eq(entities.isFavorite, filter.favorite ? 1 : 0));
      }

      if (filter.status !== undefined) {
        conditions.push(eq(entities.status, filter.status));
      }

      if (filter.search !== undefined && filter.search.length > 0) {
        const term = filter.search.toLocaleLowerCase('es');
        conditions.push(
          or(
            sql`instr(lower(${entities.name}), ${term}) > 0`,
            sql`instr(lower(coalesce(${entities.aliases}, '')), ${term}) > 0`,
            sql`instr(lower(coalesce(${entities.summary}, '')), ${term}) > 0`,
            sql`instr(lower(coalesce(${entities.descriptionText}, '')), ${term}) > 0`,
          )!,
        );
      }

      if (filter.tagId !== undefined) {
        conditions.push(
          sql`exists (select 1 from ${entityTags} where ${entityTags.entityId} = ${entities.id} and ${entityTags.tagId} = ${filter.tagId})`,
        );
      }

      const rows = database
        .select(summaryColumns())
        .from(entities)
        .innerJoin(entityTypes, eq(entities.typeId, entityTypes.id))
        .where(and(...conditions))
        .orderBy(
          desc(entities.isFavorite),
          desc(entities.updatedAt),
          entities.name,
        )
        .limit(filter.limit)
        .all();

      const tagMap = this.listTagsByEntityIds(rows.map((row) => row.id));

      return rows.map((row) => toSummaryRecord(row, tagMap.get(row.id) ?? []));
    },

    findById(worldId, id) {
      const row = database
        .select({ ...summaryColumns(), full: fullColumns() })
        .from(entities)
        .innerJoin(entityTypes, eq(entities.typeId, entityTypes.id))
        .where(
          and(
            eq(entities.worldId, worldId),
            eq(entities.id, id),
            isNull(entities.deletedAt),
          ),
        )
        .get();

      if (row === undefined) {
        return null;
      }

      const tagMap = this.listTagsByEntityIds([id]);

      return toEntityRecord(row, tagMap.get(id) ?? [], this.listGallery(id));
    },

    findBySlug(worldId, slug) {
      const row = database
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.worldId, worldId), eq(entities.slug, slug)))
        .get();

      return row ?? null;
    },

    insert(record) {
      database
        .insert(entities)
        .values({
          id: record.id,
          worldId: record.worldId,
          typeId: record.typeId,
          name: record.name,
          slug: record.slug,
          aliases: JSON.stringify(record.aliases),
          summary: record.summary,
          description: record.description,
          descriptionText: record.descriptionText,
          imageAssetId: record.imageAssetId,
          attributes: JSON.stringify(record.attributes),
          status: record.status,
          isFavorite: record.isFavorite ? 1 : 0,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          deletedAt: record.deletedAt,
        })
        .run();
    },

    update(record) {
      const result = database
        .update(entities)
        .set({
          name: record.name,
          slug: record.slug,
          aliases: JSON.stringify(record.aliases),
          summary: record.summary,
          description: record.description,
          descriptionText: record.descriptionText,
          imageAssetId: record.imageAssetId,
          attributes: JSON.stringify(record.attributes),
          status: record.status,
          updatedAt: record.updatedAt,
        })
        .where(
          and(
            eq(entities.id, record.id),
            eq(entities.worldId, record.worldId),
            isNull(entities.deletedAt),
          ),
        )
        .run();

      return result.changes > 0;
    },

    setFavorite(worldId, id, favorite, updatedAt) {
      const result = database
        .update(entities)
        .set({ isFavorite: favorite ? 1 : 0, updatedAt })
        .where(
          and(
            eq(entities.id, id),
            eq(entities.worldId, worldId),
            isNull(entities.deletedAt),
          ),
        )
        .run();

      return result.changes > 0;
    },

    softDelete(worldId, id, deletedAt) {
      const result = database
        .update(entities)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(
          and(
            eq(entities.id, id),
            eq(entities.worldId, worldId),
            isNull(entities.deletedAt),
          ),
        )
        .run();

      return result.changes > 0;
    },

    listTagsByEntityIds(entityIds) {
      const result = new Map<string, EntityTag[]>();

      if (entityIds.length === 0) {
        return result;
      }

      const rows = database
        .select({
          entityId: entityTags.entityId,
          id: tags.id,
          worldId: tags.worldId,
          name: tags.name,
          color: tags.color,
          createdAt: tags.createdAt,
        })
        .from(entityTags)
        .innerJoin(tags, eq(entityTags.tagId, tags.id))
        .where(inArray(entityTags.entityId, [...entityIds]))
        .orderBy(tags.name)
        .all();

      for (const row of rows) {
        const current = result.get(row.entityId) ?? [];
        current.push(toTag(row));
        result.set(row.entityId, current);
      }

      return result;
    },

    listGallery(entityId) {
      return database
        .select({
          assetId: entityGallery.assetId,
          width: assets.width,
          height: assets.height,
          alt: assets.alt,
        })
        .from(entityGallery)
        .innerJoin(assets, eq(entityGallery.assetId, assets.id))
        .where(eq(entityGallery.entityId, entityId))
        .orderBy(entityGallery.position)
        .all();
    },

    replaceGallery(entityId, assetIds) {
      database
        .delete(entityGallery)
        .where(eq(entityGallery.entityId, entityId))
        .run();

      assetIds.forEach((assetId, position) => {
        database
          .insert(entityGallery)
          .values({ entityId, assetId, position })
          .run();
      });
    },

    listTags(worldId) {
      return database
        .select()
        .from(tags)
        .where(eq(tags.worldId, worldId))
        .orderBy(tags.name)
        .all()
        .map(toTag);
    },

    findTagById(worldId, id) {
      const row = database
        .select()
        .from(tags)
        .where(and(eq(tags.worldId, worldId), eq(tags.id, id)))
        .get();

      return row === undefined ? null : toTag(row);
    },

    findTagByName(worldId, name) {
      const row = database
        .select()
        .from(tags)
        .where(and(eq(tags.worldId, worldId), eq(tags.name, name)))
        .get();

      return row === undefined ? null : toTag(row);
    },

    insertTag(tag) {
      database
        .insert(tags)
        .values({
          id: tag.id,
          worldId: tag.worldId,
          name: tag.name,
          color: tag.color,
          createdAt: tag.createdAt,
        })
        .run();
    },

    replaceTags(entityId, tagIds) {
      database
        .delete(entityTags)
        .where(eq(entityTags.entityId, entityId))
        .run();

      for (const tagId of tagIds) {
        database.insert(entityTags).values({ entityId, tagId }).run();
      }
    },

    findType(worldId, typeId) {
      const row = database
        .select()
        .from(entityTypes)
        .where(eq(entityTypes.id, typeId))
        .get();

      if (row === undefined || row.deletedAt !== null) {
        return null;
      }

      if (row.worldId !== null && row.worldId !== worldId) {
        return null;
      }

      return toTypeRecord(row);
    },

    findTypeByKey(worldId, key) {
      const row = database
        .select()
        .from(entityTypes)
        .where(
          and(
            eq(entityTypes.key, key),
            isNull(entityTypes.deletedAt),
            or(isNull(entityTypes.worldId), eq(entityTypes.worldId, worldId)),
          ),
        )
        .orderBy(desc(entityTypes.isSystem))
        .get();

      return row === undefined ? null : toTypeRecord(row);
    },

    findAsset(worldId, assetId) {
      const row = database
        .select({
          id: assets.id,
          worldId: assets.worldId,
          kind: assets.kind,
          width: assets.width,
          height: assets.height,
          alt: assets.alt,
          createdAt: assets.createdAt,
        })
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.worldId, worldId)))
        .get();

      return row === undefined ? null : row;
    },

    listImageAssets(worldId) {
      return database
        .select({
          id: assets.id,
          worldId: assets.worldId,
          kind: assets.kind,
          width: assets.width,
          height: assets.height,
          alt: assets.alt,
          createdAt: assets.createdAt,
        })
        .from(assets)
        .where(and(eq(assets.worldId, worldId), eq(assets.kind, 'image')))
        .orderBy(desc(assets.createdAt), desc(assets.id))
        .all();
    },

    findReference(worldId, entityId) {
      const row = database
        .select({
          id: entities.id,
          typeKey: entityTypes.key,
          deletedAt: entities.deletedAt,
        })
        .from(entities)
        .innerJoin(entityTypes, eq(entities.typeId, entityTypes.id))
        .where(and(eq(entities.worldId, worldId), eq(entities.id, entityId)))
        .get();

      return row === undefined ? null : row;
    },
  };
}

function summaryColumns() {
  return {
    id: entities.id,
    worldId: entities.worldId,
    typeId: entities.typeId,
    typeKey: entityTypes.key,
    typeName: entityTypes.name,
    typeIcon: entityTypes.icon,
    typeColor: entityTypes.color,
    name: entities.name,
    slug: entities.slug,
    aliases: entities.aliases,
    summary: entities.summary,
    imageAssetId: entities.imageAssetId,
    isFavorite: entities.isFavorite,
    status: entities.status,
    createdAt: entities.createdAt,
    updatedAt: entities.updatedAt,
  };
}

function fullColumns() {
  return {
    description: entities.description,
    descriptionText: entities.descriptionText,
    attributes: entities.attributes,
    deletedAt: entities.deletedAt,
  };
}

interface SummaryRow {
  readonly id: string;
  readonly worldId: string;
  readonly typeId: string;
  readonly typeKey: string;
  readonly typeName: string;
  readonly typeIcon: string;
  readonly typeColor: string;
  readonly name: string;
  readonly slug: string;
  readonly aliases: string;
  readonly summary: string | null;
  readonly imageAssetId: string | null;
  readonly isFavorite: number;
  readonly status: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface DetailRow extends SummaryRow {
  readonly full: {
    readonly description: string | null;
    readonly descriptionText: string | null;
    readonly attributes: string;
    readonly deletedAt: number | null;
  };
}

function toSummaryRecord(
  row: SummaryRow,
  entityTagsList: readonly EntityTag[],
): EntitySummaryRecord {
  return {
    id: row.id,
    worldId: row.worldId,
    typeId: row.typeId,
    typeKey: row.typeKey,
    typeName: row.typeName,
    typeIcon: isEntityTypeIcon(row.typeIcon) ? row.typeIcon : 'book-open',
    typeColor: isEntityTypeColor(row.typeColor) ? row.typeColor : 'moss',
    name: row.name,
    slug: row.slug,
    aliases: parseAliases(row.aliases),
    summary: row.summary,
    imageAssetId: row.imageAssetId,
    isFavorite: row.isFavorite === 1,
    status: isEntityStatus(row.status) ? row.status : 'active',
    tags: entityTagsList,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEntityRecord(
  row: DetailRow,
  entityTagsList: readonly EntityTag[],
  gallery: readonly EntityGalleryItem[],
): EntityRecord {
  const summary = toSummaryRecord(row, entityTagsList);

  return {
    ...summary,
    description: row.full.description,
    descriptionText: row.full.descriptionText,
    attributes: parseAttributes(row.full.attributes),
    gallery,
    deletedAt: row.full.deletedAt,
  };
}

function toTypeRecord(row: {
  readonly id: string;
  readonly worldId: string | null;
  readonly key: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly fields: string;
  readonly isSystem: number;
  readonly deletedAt: number | null;
}): EntityTypeRecord {
  return {
    id: row.id,
    worldId: row.worldId,
    key: row.key,
    name: row.name,
    icon: isEntityTypeIcon(row.icon) ? row.icon : 'book-open',
    color: isEntityTypeColor(row.color) ? row.color : 'moss',
    fields: parseFields(row.fields),
    isSystem: row.isSystem === 1 || row.worldId === null,
    deletedAt: row.deletedAt,
  };
}

function toTag(row: {
  readonly id: string;
  readonly worldId: string;
  readonly name: string;
  readonly color: string;
  readonly createdAt: number;
}): EntityTag {
  return {
    id: row.id,
    worldId: row.worldId,
    name: row.name,
    color: isEntityTypeColor(row.color) ? row.color : 'moss',
    createdAt: row.createdAt,
  };
}

function parseAliases(raw: string): readonly string[] {
  const value = parseJson(raw);

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function parseAttributes(
  raw: string,
): Readonly<Record<string, EntityFieldValue>> {
  const value = parseJson(raw);

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const attributes: Record<string, EntityFieldValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number') {
      attributes[key] = entry;
    }
  }

  return attributes;
}

function parseFields(raw: string): readonly EntityFieldDefinition[] {
  const value = parseJson(raw);
  const parsed = entityFieldTemplateSchema.safeParse(value);

  return parsed.success
    ? (parsed.data as readonly EntityFieldDefinition[])
    : [];
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
