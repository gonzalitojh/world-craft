/**
 * Servicio de dominio de las fichas y sus etiquetas.
 *
 * Orquesta validación, slugs, timestamps, referencias y assets sobre el
 * repositorio. No conoce Electron ni IPC: recibe la base compartida y devuelve
 * los tipos del contrato. El ID y el reloj se inyectan en las pruebas.
 *
 * Reglas:
 * - Toda ficha pertenece a un mundo y su tipo debe ser del sistema o de ese
 *   mundo; el tipo no cambia después de crear la ficha.
 * - Los valores de los campos se validan con la plantilla del tipo y las
 *   referencias deben existir, estar vivas y pertenecer al mismo mundo.
 * - Las etiquetas y los assets también se aíslan por mundo.
 * - Borrar es lógico y no toca etiquetas ni assets, que siguen siendo
 *   recuperables hasta la papelera y la purga.
 */
import {
  ENTITY_GALLERY_MAX,
  ENTITY_TAGS_MAX,
  type EntityCreateInput,
  type EntityDeleteResult,
  type EntityDetail,
  type EntityGalleryItem,
  type EntityGetInput,
  type EntityListInput,
  type EntityRemoveInput,
  type EntitySetFavoriteInput,
  type EntityStatus,
  type EntitySummary,
  type EntityTag,
  type EntityTagCreateInput,
  type EntityUpdateInput,
} from '../../shared/contracts/entities';
import type { EntityFieldValue } from '../../shared/entity-types/fields';
import { validateEntityFieldValues } from '../../shared/entity-types/fields';
import {
  collectEntityLinkIds,
  validateEntityDescription,
  type EntityDescriptionResult,
} from '../../shared/entities/description';
import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import { generateUuidv7 } from '../db/ids';
import { EntityInputError } from './errors';
import {
  createEntityRepository,
  type EntityAssetRecord,
  type EntityRecord,
  type EntitySummaryRecord,
  type EntityTypeRecord,
} from './repository';
import {
  normalizeEntityAliases,
  normalizeEntityFilter,
  normalizeEntityName,
  normalizeEntityStatus,
  normalizeEntitySummary,
  normalizeTagColor,
  normalizeTagName,
  slugifyEntityName,
  uniqueEntitySlug,
} from './validation';
import type { VersionRecorder } from '../versions/service';

/** Servicio de fichas. */
export interface EntitiesService {
  list(input: EntityListInput): readonly EntitySummary[];
  get(input: EntityGetInput): EntityDetail | null;
  create(input: EntityCreateInput): EntityDetail;
  update(input: EntityUpdateInput): EntityDetail | null;
  setFavorite(input: EntitySetFavoriteInput): EntityDetail | null;
  remove(input: EntityRemoveInput): EntityDeleteResult;
  listTags(worldId: string): readonly EntityTag[];
  createTag(input: EntityTagCreateInput): EntityTag;
}

/** Opciones del servicio; todas las dependencias externas se inyectan. */
export interface EntitiesServiceOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly now?: () => number;
  readonly generateId?: () => string;
  /**
   * Registrador opcional del historial de versiones. Se ejecuta dentro de la
   * misma transacción que la actualización de la ficha.
   */
  readonly versions?: VersionRecorder;
}

interface NormalizedEditable {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly summary: string | null;
  readonly description: EntityDescriptionResult & { readonly ok: true };
  readonly attributes: Readonly<Record<string, EntityFieldValue>>;
  readonly status: EntityStatus;
  readonly imageAssetId: string | null;
  readonly galleryAssetIds: readonly string[];
  readonly tagIds: readonly string[];
}

/** Crea el servicio sobre la base compartida del proceso principal. */
export function createEntitiesService(
  options: EntitiesServiceOptions,
): EntitiesService {
  const repository = createEntityRepository(options.database);
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? generateUuidv7;
  const write = <T>(operation: () => T): T =>
    options.sqlite.transaction(operation)();

  const requireWorld = (worldId: string): void => {
    if (!repository.worldExists(worldId)) {
      throw new EntityInputError('El mundo no existe o está en la papelera.');
    }
  };

  const requireType = (worldId: string, typeId: string): EntityTypeRecord => {
    const type = repository.findType(worldId, typeId);

    if (type === null) {
      throw new EntityInputError(
        'El tipo de la ficha no existe en este mundo.',
      );
    }

    return type;
  };

  const validateAttributes = (
    worldId: string,
    type: EntityTypeRecord,
    raw: Readonly<Record<string, unknown>> | undefined,
  ): Readonly<Record<string, EntityFieldValue>> => {
    const result = validateEntityFieldValues(type.fields, raw ?? {});

    if (!result.ok) {
      throw new EntityInputError(
        'Los valores de los campos de la ficha no son válidos.',
      );
    }

    // Una referencia solo es válida si apunta a una ficha viva del mismo
    // mundo y, cuando el campo declara un tipo de destino, coincide con él.
    for (const field of type.fields) {
      if (field.type !== 'reference') {
        continue;
      }

      const value = result.values[field.key];

      if (value === undefined) {
        continue;
      }

      const target = repository.findReference(worldId, String(value));

      if (target === null || target.deletedAt !== null) {
        throw new EntityInputError(
          'Una referencia apunta a una ficha que no existe en este mundo.',
        );
      }

      if (
        field.targetTypeKey !== undefined &&
        target.typeKey !== field.targetTypeKey
      ) {
        throw new EntityInputError(
          'Una referencia apunta a una ficha de otro tipo.',
        );
      }
    }

    return result.values;
  };

  const validateDescription = (
    raw: unknown,
  ): EntityDescriptionResult & { readonly ok: true } => {
    const result = validateEntityDescription(raw);

    if (!result.ok) {
      throw new EntityInputError('La descripción de la ficha no es válida.');
    }

    return result;
  };

  const validateAsset = (
    worldId: string,
    assetId: string,
  ): EntityAssetRecord => {
    const asset = repository.findAsset(worldId, assetId);

    if (asset === null || asset.kind !== 'image') {
      throw new EntityInputError(
        'Una imagen de la ficha no existe en este mundo.',
      );
    }

    return asset;
  };

  const resolveGallery = (
    worldId: string,
    raw: readonly string[] | undefined,
  ): readonly EntityAssetRecord[] => {
    const unique = [...new Set(raw ?? [])];
    const assets = unique.map((assetId) => validateAsset(worldId, assetId));

    if (assets.length > ENTITY_GALLERY_MAX) {
      throw new EntityInputError('La galería tiene demasiadas imágenes.');
    }

    return assets;
  };

  const resolveTags = (
    worldId: string,
    raw: readonly string[] | undefined,
  ): readonly EntityTag[] => {
    const unique = [...new Set(raw ?? [])];

    if (unique.length > ENTITY_TAGS_MAX) {
      throw new EntityInputError('La ficha tiene demasiadas etiquetas.');
    }

    return unique.map((tagId) => {
      const tag = repository.findTagById(worldId, tagId);

      if (tag === null) {
        throw new EntityInputError(
          'Una etiqueta de la ficha no existe en este mundo.',
        );
      }

      return tag;
    });
  };

  const normalizeEditable = (
    worldId: string,
    type: EntityTypeRecord,
    input: {
      readonly name: string;
      readonly aliases?: readonly string[] | undefined;
      readonly summary?: string | null | undefined;
      readonly description?: unknown;
      readonly attributes?: Readonly<Record<string, unknown>> | undefined;
      readonly imageAssetId?: string | null | undefined;
      readonly galleryAssetIds?: readonly string[] | undefined;
      readonly tagIds?: readonly string[] | undefined;
      readonly status?: EntityStatus | undefined;
    },
  ): {
    readonly editable: NormalizedEditable;
    readonly gallery: readonly EntityAssetRecord[];
  } => {
    const imageAssetId =
      input.imageAssetId === undefined || input.imageAssetId === null
        ? null
        : validateAsset(worldId, input.imageAssetId).id;
    const gallery = resolveGallery(worldId, input.galleryAssetIds);
    const description = validateDescription(input.description);

    if (description.document !== null) {
      for (const targetId of collectEntityLinkIds(description.document)) {
        const target = repository.findReference(worldId, targetId);

        if (target === null || target.deletedAt !== null) {
          throw new EntityInputError(
            'La descripción enlaza a una ficha que no existe en este mundo.',
          );
        }
      }
    }

    return {
      editable: {
        name: normalizeEntityName(input.name),
        aliases: normalizeEntityAliases(input.aliases),
        summary: normalizeEntitySummary(input.summary),
        description,
        attributes: validateAttributes(worldId, type, input.attributes),
        status: normalizeEntityStatus(input.status),
        imageAssetId,
        galleryAssetIds: gallery.map((asset) => asset.id),
        tagIds: resolveTags(worldId, input.tagIds).map((tag) => tag.id),
      },
      gallery,
    };
  };

  const toDetail = (
    record: EntityRecord,
    tagsList: readonly EntityTag[],
    gallery: readonly EntityGalleryItem[],
  ): EntityDetail => ({
    ...toSummary(record, tagsList),
    description: parseDescription(record.description),
    attributes: record.attributes,
    gallery,
  });

  const loadDetail = (worldId: string, id: string): EntityDetail | null => {
    const record = repository.findById(worldId, id);

    return record === null
      ? null
      : toDetail(record, record.tags, record.gallery);
  };

  return {
    list(input) {
      if (!repository.worldExists(input.worldId)) {
        return [];
      }

      return repository
        .list(input.worldId, normalizeEntityFilter(input.filter))
        .map((record) => toSummary(record, record.tags));
    },

    get(input) {
      return loadDetail(input.worldId, input.id);
    },

    create(input) {
      requireWorld(input.worldId);
      const type = requireType(input.worldId, input.typeId);
      const { editable, gallery } = normalizeEditable(
        input.worldId,
        type,
        input,
      );
      const at = now();
      const slug = uniqueEntitySlug(
        slugifyEntityName(editable.name),
        (candidate) => repository.findBySlug(input.worldId, candidate) !== null,
      );
      const tagsList = resolveTags(input.worldId, editable.tagIds);
      const record: EntityRecord = {
        id: generateId(),
        worldId: input.worldId,
        typeId: type.id,
        typeKey: type.key,
        typeName: type.name,
        typeIcon: type.icon,
        typeColor: type.color,
        name: editable.name,
        slug,
        aliases: editable.aliases,
        summary: editable.summary,
        description: editable.description.json,
        descriptionText: editable.description.text,
        imageAssetId: editable.imageAssetId,
        attributes: editable.attributes,
        status: editable.status,
        isFavorite: input.isFavorite === true,
        tags: tagsList,
        gallery: gallery.map(toGalleryItem),
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      };

      write(() => {
        repository.insert(record);
        repository.replaceTags(record.id, editable.tagIds);
        repository.replaceGallery(record.id, editable.galleryAssetIds);
      });

      return toDetail(record, tagsList, record.gallery);
    },

    update(input) {
      const existing = repository.findById(input.worldId, input.id);

      if (existing === null || existing.deletedAt !== null) {
        return null;
      }

      const type = requireType(input.worldId, existing.typeId);
      const { editable, gallery } = normalizeEditable(
        input.worldId,
        type,
        input,
      );
      const tagsList = resolveTags(input.worldId, editable.tagIds);

      if (!hasChanges(existing, editable, gallery)) {
        return toDetail(existing, tagsList, existing.gallery);
      }

      const updated: EntityRecord = {
        ...existing,
        name: editable.name,
        slug:
          existing.name === editable.name
            ? existing.slug
            : uniqueEntitySlug(
                slugifyEntityName(editable.name),
                (candidate) => {
                  const found = repository.findBySlug(input.worldId, candidate);

                  return found !== null && found.id !== existing.id;
                },
              ),
        aliases: editable.aliases,
        summary: editable.summary,
        description: editable.description.json,
        descriptionText: editable.description.text,
        imageAssetId: editable.imageAssetId,
        attributes: editable.attributes,
        status: editable.status,
        gallery: gallery.map(toGalleryItem),
        updatedAt: now(),
      };

      const applied = write(() => {
        if (!repository.update(updated)) {
          return false;
        }

        // La versión automática guarda el estado saliente dentro de la misma
        // transacción: no puede quedar una descripción nueva sin la anterior.
        if (
          existing.description !== updated.description ||
          existing.descriptionText !== updated.descriptionText
        ) {
          options.versions?.recordBeforeChange({
            entityId: updated.id,
            description: existing.description,
            descriptionText: existing.descriptionText,
            at: updated.updatedAt,
          });
        }

        repository.replaceTags(updated.id, editable.tagIds);
        repository.replaceGallery(updated.id, editable.galleryAssetIds);
        return true;
      });

      return applied ? toDetail(updated, tagsList, updated.gallery) : null;
    },

    setFavorite(input) {
      const existing = repository.findById(input.worldId, input.id);

      if (existing === null || existing.deletedAt !== null) {
        return null;
      }

      if (existing.isFavorite !== input.favorite) {
        repository.setFavorite(
          input.worldId,
          input.id,
          input.favorite,
          existing.updatedAt,
        );
      }

      return loadDetail(input.worldId, input.id);
    },

    remove(input) {
      const existing = repository.findById(input.worldId, input.id);

      if (existing === null || existing.deletedAt !== null) {
        return { deleted: false };
      }

      return {
        deleted: repository.softDelete(input.worldId, input.id, now()),
      };
    },

    listTags(worldId) {
      return repository.worldExists(worldId)
        ? repository.listTags(worldId)
        : [];
    },

    createTag(input) {
      requireWorld(input.worldId);
      const name = normalizeTagName(input.name);
      const color = normalizeTagColor(input.color);
      const existing = repository.findTagByName(input.worldId, name);

      // Crear una etiqueta existente es idempotente: la interfaz puede
      // reutilizarla tras un doble envío sin generar un error.
      if (existing !== null) {
        return existing;
      }

      const tag: EntityTag = {
        id: generateId(),
        worldId: input.worldId,
        name,
        color,
        createdAt: now(),
      };

      repository.insertTag(tag);

      return tag;
    },
  };
}

/**
 * Servicio de sustitución cuando la base no está disponible (modo seguro).
 *
 * Cualquier llamada lanza y el router la convierte en `INTERNAL_ERROR`; la
 * interfaz muestra un estado de error en lugar de datos inventados.
 */
export function createUnavailableEntitiesService(): EntitiesService {
  const unavailable = (): never => {
    throw new Error('Las fichas no están disponibles en modo seguro.');
  };

  return {
    list: unavailable,
    get: unavailable,
    create: unavailable,
    update: unavailable,
    setFavorite: unavailable,
    remove: unavailable,
    listTags: unavailable,
    createTag: unavailable,
  };
}

function toSummary(
  record: EntitySummaryRecord,
  tagsList: readonly EntityTag[],
): EntitySummary {
  return {
    id: record.id,
    worldId: record.worldId,
    typeId: record.typeId,
    typeKey: record.typeKey,
    typeName: record.typeName,
    typeIcon: record.typeIcon,
    typeColor: record.typeColor,
    name: record.name,
    slug: record.slug,
    aliases: record.aliases,
    summary: record.summary,
    imageAssetId: record.imageAssetId,
    isFavorite: record.isFavorite,
    status: record.status,
    tags: tagsList,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toGalleryItem(asset: EntityAssetRecord): EntityGalleryItem {
  return {
    assetId: asset.id,
    width: asset.width,
    height: asset.height,
    alt: asset.alt,
  };
}

function parseDescription(raw: string | null): EntityDetail['description'] {
  if (raw === null) {
    return null;
  }

  try {
    const parsed = validateEntityDescription(JSON.parse(raw) as unknown);

    return parsed.ok ? parsed.document : null;
  } catch {
    return null;
  }
}

function hasChanges(
  existing: EntityRecord,
  editable: NormalizedEditable,
  gallery: readonly EntityAssetRecord[],
): boolean {
  return (
    existing.name !== editable.name ||
    JSON.stringify(existing.aliases) !== JSON.stringify(editable.aliases) ||
    existing.summary !== editable.summary ||
    existing.description !== editable.description.json ||
    existing.descriptionText !== editable.description.text ||
    existing.imageAssetId !== editable.imageAssetId ||
    JSON.stringify(existing.attributes) !==
      JSON.stringify(editable.attributes) ||
    existing.status !== editable.status ||
    JSON.stringify(existing.gallery.map((item) => item.assetId)) !==
      JSON.stringify(gallery.map((item) => item.id)) ||
    JSON.stringify(existing.tags.map((tag) => tag.id)) !==
      JSON.stringify(editable.tagIds)
  );
}
