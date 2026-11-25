/**
 * Plan de importación: contenido validado, IDs nuevos y remapeo.
 *
 * A partir del staging (ZIP ya validado y assets procesados) resuelve los tipos
 * del sistema por clave, crea los tipos personalizados, genera un UUIDv7 para
 * cada fila y remapea todas las referencias. El resultado se serializa a
 * `plan.json` dentro de la carpeta temporal: el proceso principal lo valida otra
 * vez y lo inserta en una única transacción.
 *
 * Las referencias rotas (tipo ausente, enlace interno a una ficha descartada,
 * asset no incluido, relación sin extremo o tipo) se sanean con avisos. Los
 * atributos que ya no encajan en la plantilla se descartan; un campo
 * obligatorio ausente no se inventa y deja la ficha para que el usuario la
 * complete.
 */
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import {
  ENTITY_STATUSES,
  ENTITY_GALLERY_MAX,
  ENTITY_NAME_MAX_LENGTH,
  ENTITY_SLUG_MAX_LENGTH,
  ENTITY_SLUG_PATTERN,
  ENTITY_ALIAS_MAX_LENGTH,
  ENTITY_ALIASES_MAX,
  ENTITY_SUMMARY_MAX_LENGTH,
  ENTITY_TAGS_MAX,
  ENTITY_TAG_NAME_MAX_LENGTH,
  ENTITY_DESCRIPTION_TEXT_MAX_LENGTH,
  type EntityRichTextDocument,
} from '../../../shared/contracts/entities';
import {
  ENTITY_TYPE_COLORS,
  ENTITY_TYPE_ICONS,
  ENTITY_TYPE_KEY_MAX_LENGTH,
  ENTITY_TYPE_KEY_PATTERN,
  ENTITY_TYPE_FIELDS_MAX,
  ENTITY_FIELD_KEY_MAX_LENGTH,
  type EntityFieldDefinition,
} from '../../../shared/contracts/entity-types';
import {
  RELATION_LABEL_MAX_LENGTH,
  RELATION_METADATA_KEY_MAX_LENGTH,
  RELATION_METADATA_MAX_KEYS,
  RELATION_METADATA_VALUE_MAX_LENGTH,
  RELATION_NOTES_MAX_LENGTH,
  RELATION_STRENGTH_MAX,
  RELATION_STRENGTH_MIN,
  RELATION_TYPE_KEY_MAX_LENGTH,
  RELATION_TYPE_KEY_PATTERN,
  RELATION_TYPE_NAME_MAX_LENGTH,
} from '../../../shared/contracts/relations';
import {
  TRANSFER_MAX_ASSETS,
  TRANSFER_MAX_ENTITIES,
  TRANSFER_MAX_ENTITY_TYPES,
  TRANSFER_MAX_RELATIONS,
  TRANSFER_MAX_RELATION_TYPES,
  TRANSFER_MAX_TAGS,
  TRANSFER_MAX_VERSIONS,
  TRANSFER_WARNING_CODES,
  type TransferCounts,
} from '../../../shared/contracts/transfer';
import {
  WORLD_DESCRIPTION_MAX_LENGTH,
  WORLD_GENRES_MAX,
  WORLD_GENRE_MAX_LENGTH,
  WORLD_LANGUAGES,
  WORLD_NAME_MAX_LENGTH,
  WORLD_SLUG_MAX_LENGTH,
  WORLD_SLUG_PATTERN,
  WORLD_SUMMARY_MAX_LENGTH,
} from '../../../shared/contracts/worlds';
import { UUID_V7_PATTERN, generateUuidv7 } from '../../db/ids';
import {
  entityDescriptionDocumentSchema,
  validateEntityDescription,
} from '../../../shared/entities/description';
import { entityFieldTemplateSchema } from '../../../shared/entity-types/fields';
import { SYSTEM_ENTITY_TYPES } from '../../../shared/entity-types/catalog';
import { isSystemRelationTypeKey } from '../../../shared/relations/catalog';
import { validateEntityFieldValues } from '../../../shared/entity-types/fields';
import { buildRelativePath } from '../../assets/paths';
import { uniqueWorldSlug } from '../../worlds/slug';
import { WorldInputError } from '../../worlds/errors';
import { TRANSFER_PLAN_FILE, TRANSFER_PLAN_MAX_BYTES } from '../constants';
import { TransferError } from '../errors';
import {
  remapDescriptionLinks,
  remapGallery,
  remapOptionalAssetId,
  remapReferenceAttributes,
} from '../format/remap';
import { TransferWarningCollector } from '../format/warnings';
import type { StagedImport } from './staging';

const uuidSchema = z.string().regex(UUID_V7_PATTERN);

const attributeValueSchema = z.union([
  z.string().max(4_000),
  z.number().finite(),
]);

const attributesSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(ENTITY_FIELD_KEY_MAX_LENGTH)
      .regex(ENTITY_TYPE_KEY_PATTERN),
    attributeValueSchema,
  )
  .refine((value) => Object.keys(value).length <= ENTITY_TYPE_FIELDS_MAX);

const describedDocumentSchema = entityDescriptionDocumentSchema.nullable();

const planEntityTypeSchema = z
  .strictObject({
    id: uuidSchema,
    key: z
      .string()
      .min(1)
      .max(ENTITY_TYPE_KEY_MAX_LENGTH)
      .regex(ENTITY_TYPE_KEY_PATTERN),
    name: z.string().min(1).max(80),
    icon: z.enum(ENTITY_TYPE_ICONS),
    color: z.enum(ENTITY_TYPE_COLORS),
    fields: entityFieldTemplateSchema,
    createdAt: z.number().int().min(0),
    updatedAt: z.number().int().min(0),
  })
  .strict();

const planRelationTypeSchema = z
  .strictObject({
    id: uuidSchema,
    key: z
      .string()
      .min(1)
      .max(RELATION_TYPE_KEY_MAX_LENGTH)
      .regex(RELATION_TYPE_KEY_PATTERN),
    name: z.string().min(1).max(RELATION_TYPE_NAME_MAX_LENGTH),
    inverseName: z.string().min(1).max(RELATION_TYPE_NAME_MAX_LENGTH),
    color: z.enum(ENTITY_TYPE_COLORS),
    createdAt: z.number().int().min(0),
    updatedAt: z.number().int().min(0),
  })
  .strict();

const planTagSchema = z
  .strictObject({
    id: uuidSchema,
    name: z.string().min(1).max(ENTITY_TAG_NAME_MAX_LENGTH),
    color: z.enum(ENTITY_TYPE_COLORS),
    createdAt: z.number().int().min(0),
  })
  .strict();

const planAssetSchema = z
  .strictObject({
    id: uuidSchema,
    sourceId: uuidSchema,
    relativePath: z.string().min(1).max(128),
    thumbnailRelativePath: z.string().min(1).max(128),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    size: z.number().int().min(0),
    thumbnailSize: z.number().int().min(0),
    hash: z.string().regex(/^[0-9a-f]{64}$/),
    alt: z.string().max(500).nullable(),
    createdAt: z.number().int().min(0),
  })
  .strict();

const planEntitySchema = z
  .strictObject({
    id: uuidSchema,
    typeKey: z
      .string()
      .min(1)
      .max(ENTITY_TYPE_KEY_MAX_LENGTH)
      .regex(ENTITY_TYPE_KEY_PATTERN),
    name: z.string().min(1).max(ENTITY_NAME_MAX_LENGTH),
    slug: z
      .string()
      .min(1)
      .max(ENTITY_SLUG_MAX_LENGTH)
      .regex(ENTITY_SLUG_PATTERN),
    aliases: z
      .array(z.string().min(1).max(ENTITY_ALIAS_MAX_LENGTH))
      .max(ENTITY_ALIASES_MAX),
    summary: z.string().max(ENTITY_SUMMARY_MAX_LENGTH).nullable(),
    description: describedDocumentSchema,
    descriptionText: z
      .string()
      .max(ENTITY_DESCRIPTION_TEXT_MAX_LENGTH)
      .nullable(),
    attributes: attributesSchema,
    status: z.enum(ENTITY_STATUSES),
    isFavorite: z.boolean(),
    imageAssetId: uuidSchema.nullable(),
    galleryAssetIds: z.array(uuidSchema).max(ENTITY_GALLERY_MAX),
    tagIds: z.array(uuidSchema).max(ENTITY_TAGS_MAX),
    createdAt: z.number().int().min(0),
    updatedAt: z.number().int().min(0),
  })
  .strict();

const planVersionSchema = z
  .strictObject({
    id: uuidSchema,
    entityId: uuidSchema,
    description: describedDocumentSchema,
    descriptionText: z
      .string()
      .max(ENTITY_DESCRIPTION_TEXT_MAX_LENGTH)
      .nullable(),
    label: z.string().min(1).max(120).nullable(),
    origin: z.enum(['auto', 'manual', 'restore']),
    createdAt: z.number().int().min(0),
  })
  .strict();

const planRelationSchema = z
  .strictObject({
    id: uuidSchema,
    sourceId: uuidSchema,
    targetId: uuidSchema,
    typeKey: z
      .string()
      .min(1)
      .max(RELATION_TYPE_KEY_MAX_LENGTH)
      .regex(RELATION_TYPE_KEY_PATTERN),
    label: z.string().min(1).max(RELATION_LABEL_MAX_LENGTH).nullable(),
    inverseLabel: z.string().min(1).max(RELATION_LABEL_MAX_LENGTH).nullable(),
    notes: z.string().max(RELATION_NOTES_MAX_LENGTH).nullable(),
    strength: z
      .number()
      .int()
      .min(RELATION_STRENGTH_MIN)
      .max(RELATION_STRENGTH_MAX),
    metadata: z
      .record(
        z.string().min(1).max(RELATION_METADATA_KEY_MAX_LENGTH),
        z.union([
          z.string().max(RELATION_METADATA_VALUE_MAX_LENGTH),
          z.number().finite(),
          z.boolean(),
        ]),
      )
      .refine(
        (value) => Object.keys(value).length <= RELATION_METADATA_MAX_KEYS,
      ),
    createdAt: z.number().int().min(0),
    updatedAt: z.number().int().min(0),
  })
  .strict();

/** Esquema estricto del plan que comparten worker y proceso principal. */
export const importPlanSchema = z
  .strictObject({
    formatVersion: z.literal(1),
    worldId: uuidSchema,
    importedAt: z.number().int().min(0),
    slugAdjusted: z.boolean(),
    world: z
      .strictObject({
        name: z.string().min(1).max(WORLD_NAME_MAX_LENGTH),
        slug: z
          .string()
          .min(1)
          .max(WORLD_SLUG_MAX_LENGTH)
          .regex(WORLD_SLUG_PATTERN),
        summary: z.string().max(WORLD_SUMMARY_MAX_LENGTH).nullable(),
        description: z.string().max(WORLD_DESCRIPTION_MAX_LENGTH).nullable(),
        genres: z
          .array(z.string().min(1).max(WORLD_GENRE_MAX_LENGTH))
          .max(WORLD_GENRES_MAX),
        language: z.enum(WORLD_LANGUAGES),
      })
      .strict(),
    entityTypes: z.array(planEntityTypeSchema).max(TRANSFER_MAX_ENTITY_TYPES),
    relationTypes: z
      .array(planRelationTypeSchema)
      .max(TRANSFER_MAX_RELATION_TYPES),
    tags: z.array(planTagSchema).max(TRANSFER_MAX_TAGS),
    assets: z.array(planAssetSchema).max(TRANSFER_MAX_ASSETS),
    entities: z.array(planEntitySchema).max(TRANSFER_MAX_ENTITIES),
    versions: z.array(planVersionSchema).max(TRANSFER_MAX_VERSIONS),
    entityTags: z
      .array(
        z.strictObject({ entityId: uuidSchema, tagId: uuidSchema }).strict(),
      )
      .max(TRANSFER_MAX_ENTITIES * ENTITY_TAGS_MAX),
    gallery: z
      .array(
        z
          .strictObject({
            entityId: uuidSchema,
            assetId: uuidSchema,
            position: z.number().int().min(0),
          })
          .strict(),
      )
      .max(TRANSFER_MAX_ENTITIES * ENTITY_GALLERY_MAX),
    relations: z.array(planRelationSchema).max(TRANSFER_MAX_RELATIONS),
    coverAssetId: uuidSchema.nullable(),
    counts: z
      .strictObject({
        entities: z.number().int().min(0),
        entityTypes: z.number().int().min(0),
        relationTypes: z.number().int().min(0),
        tags: z.number().int().min(0),
        relations: z.number().int().min(0),
        versions: z.number().int().min(0),
        assets: z.number().int().min(0),
      })
      .strict(),
    warnings: z
      .array(
        z
          .strictObject({
            code: z.enum(TRANSFER_WARNING_CODES),
            count: z.number().int().min(1),
          })
          .strict(),
      )
      .max(TRANSFER_WARNING_CODES.length),
    totalAssetBytes: z.number().int().min(0),
  })
  .strict()
  .superRefine((plan, context) => {
    const entityIds = new Set<string>();
    const entityTypeIds = new Set<string>();
    const relationTypeIds = new Set<string>();
    const tagIds = new Set<string>();
    const assetIds = new Set<string>();

    for (const type of plan.entityTypes) {
      if (entityTypeIds.has(type.id)) {
        context.addIssue({
          code: 'custom',
          message: 'El plan repite un tipo de entidad.',
          path: ['entityTypes'],
        });
      }

      entityTypeIds.add(type.id);
    }

    for (const type of plan.relationTypes) {
      if (relationTypeIds.has(type.id)) {
        context.addIssue({
          code: 'custom',
          message: 'El plan repite un tipo de relación.',
          path: ['relationTypes'],
        });
      }

      relationTypeIds.add(type.id);
    }

    for (const tag of plan.tags) {
      if (tagIds.has(tag.id)) {
        context.addIssue({
          code: 'custom',
          message: 'El plan repite una etiqueta.',
          path: ['tags'],
        });
      }

      tagIds.add(tag.id);
    }

    for (const asset of plan.assets) {
      if (assetIds.has(asset.id)) {
        context.addIssue({
          code: 'custom',
          message: 'El plan repite un asset.',
          path: ['assets'],
        });
      }

      assetIds.add(asset.id);
    }

    for (const entity of plan.entities) {
      if (entityIds.has(entity.id)) {
        context.addIssue({
          code: 'custom',
          message: 'El plan repite una ficha.',
          path: ['entities'],
        });
      }

      entityIds.add(entity.id);

      if (entity.imageAssetId !== null && !assetIds.has(entity.imageAssetId)) {
        context.addIssue({
          code: 'custom',
          message: 'La imagen de una ficha no existe en el plan.',
          path: ['entities'],
        });
      }

      for (const assetId of entity.galleryAssetIds) {
        if (!assetIds.has(assetId)) {
          context.addIssue({
            code: 'custom',
            message: 'La galería referencia un asset ausente.',
            path: ['entities'],
          });
        }
      }

      for (const tagId of entity.tagIds) {
        if (!tagIds.has(tagId)) {
          context.addIssue({
            code: 'custom',
            message: 'Una ficha referencia una etiqueta ausente.',
            path: ['entities'],
          });
        }
      }
    }

    for (const version of plan.versions) {
      if (!entityIds.has(version.entityId)) {
        context.addIssue({
          code: 'custom',
          message: 'Una versión referencia una ficha ausente.',
          path: ['versions'],
        });
      }
    }

    for (const item of plan.entityTags) {
      if (!entityIds.has(item.entityId) || !tagIds.has(item.tagId)) {
        context.addIssue({
          code: 'custom',
          message: 'Una etiqueta de ficha referencia una fila ausente.',
          path: ['entityTags'],
        });
      }
    }

    for (const item of plan.gallery) {
      if (!entityIds.has(item.entityId) || !assetIds.has(item.assetId)) {
        context.addIssue({
          code: 'custom',
          message: 'La galería referencia una fila ausente.',
          path: ['gallery'],
        });
      }
    }

    const customRelationKeys = new Set(
      plan.relationTypes.map((type) => type.key),
    );

    for (const relation of plan.relations) {
      if (
        !entityIds.has(relation.sourceId) ||
        !entityIds.has(relation.targetId)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Una relación referencia una ficha ausente.',
          path: ['relations'],
        });
      }

      if (
        !isSystemRelationTypeKey(relation.typeKey) &&
        !customRelationKeys.has(relation.typeKey)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Una relación referencia un tipo ausente.',
          path: ['relations'],
        });
      }
    }

    if (plan.coverAssetId !== null && !assetIds.has(plan.coverAssetId)) {
      context.addIssue({
        code: 'custom',
        message: 'La portada referencia un asset ausente.',
        path: ['coverAssetId'],
      });
    }

    const expectedCounts = {
      entities: plan.entities.length,
      entityTypes: plan.entityTypes.length,
      relationTypes: plan.relationTypes.length,
      tags: plan.tags.length,
      relations: plan.relations.length,
      versions: plan.versions.length,
      assets: plan.assets.length,
    };

    for (const key of Object.keys(expectedCounts) as Array<
      keyof typeof expectedCounts
    >) {
      if (plan.counts[key] !== expectedCounts[key]) {
        context.addIssue({
          code: 'custom',
          message: 'Los recuentos del plan no coinciden.',
          path: ['counts', key],
        });
      }
    }
  });

export type ImportPlan = z.infer<typeof importPlanSchema>;
export type ImportPlanEntityType = ImportPlan['entityTypes'][number];
export type ImportPlanRelationType = ImportPlan['relationTypes'][number];
export type ImportPlanTag = ImportPlan['tags'][number];
export type ImportPlanAsset = ImportPlan['assets'][number];
export type ImportPlanEntity = ImportPlan['entities'][number];
export type ImportPlanVersion = ImportPlan['versions'][number];
export type ImportPlanRelation = ImportPlan['relations'][number];

/** Opciones para construir el plan. */
export interface CreateImportPlanOptions {
  readonly staged: StagedImport;
  readonly existingSlugs: ReadonlySet<string>;
  readonly now?: () => number;
  readonly generateId?: () => string;
}

/** Construye, valida y devuelve el plan de importación. */
export function createImportPlan(options: CreateImportPlanOptions): ImportPlan {
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? generateUuidv7;
  const warnings = new TransferWarningCollector();
  const importedAt = now();
  const staged = options.staged;

  const entityTypes: ImportPlan['entityTypes'] =
    staged.world.entityTypes.types.map((type) => ({
      id: generateId(),
      key: type.key,
      name: type.name,
      icon: type.icon,
      color: type.color,
      fields: type.fields,
      createdAt: importedAt,
      updatedAt: importedAt,
    }));
  const relationTypes: ImportPlan['relationTypes'] =
    staged.world.relationTypes.types.map((type) => ({
      id: generateId(),
      key: type.key,
      name: type.name,
      inverseName: type.inverseName,
      color: type.color,
      createdAt: importedAt,
      updatedAt: importedAt,
    }));
  const tags: ImportPlan['tags'] = staged.world.tags.map((tag) => ({
    id: generateId(),
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt,
  }));

  const fieldsByKey = new Map<string, readonly EntityFieldDefinition[]>(
    SYSTEM_ENTITY_TYPES.map((type) => [type.key, type.fields]),
  );

  for (const type of entityTypes) {
    fieldsByKey.set(type.key, type.fields);
  }

  const tagIdByName = new Map(tags.map((tag) => [tag.name, tag.id]));
  const relationTypeKeys = new Set([
    ...relationTypes.map((type) => type.key),
    ...staged.world.relationTypes.types.map((type) => type.key),
  ]);

  const keptWorldEntities = staged.world.entities.filter((entity) => {
    if (!fieldsByKey.has(entity.typeKey)) {
      warnings.add('missing-entity-type');
      return false;
    }

    return true;
  });
  const entityIdMap = new Map(
    keptWorldEntities.map((entity) => [entity.id, generateId()]),
  );

  // El mundo se genera antes que los assets porque su ID forma parte de la
  // ruta relativa canónica de cada archivo.
  const worldId = generateId();
  const worldSlug = resolveWorldSlug(
    staged.world.world.slug,
    options.existingSlugs,
  );
  const stagedAssetsById = new Map(
    staged.assets.map((asset) => [asset.sourceId, asset]),
  );
  const referencedAssetIds = new Set<string>();

  for (const entity of keptWorldEntities) {
    if (entity.imageAssetId !== null) {
      referencedAssetIds.add(entity.imageAssetId);
    }

    for (const item of entity.gallery) {
      referencedAssetIds.add(item.assetId);
    }
  }

  if (staged.world.coverAssetId !== null) {
    referencedAssetIds.add(staged.world.coverAssetId);
  }

  const assets: ImportPlan['assets'] = [];
  const assetIdMap = new Map<string, string>();
  let totalAssetBytes = 0;

  for (const sourceId of [...referencedAssetIds].sort()) {
    const stagedAsset = stagedAssetsById.get(sourceId);

    if (stagedAsset === undefined) {
      continue;
    }

    const id = generateId();
    assetIdMap.set(sourceId, id);
    assets.push({
      id,
      sourceId,
      relativePath: buildRelativePath({
        worldId,
        assetId: id,
        variant: 'asset',
      }),
      thumbnailRelativePath: buildRelativePath({
        worldId,
        assetId: id,
        variant: 'thumb',
      }),
      width: stagedAsset.width,
      height: stagedAsset.height,
      size: stagedAsset.size,
      thumbnailSize: stagedAsset.thumbnailSize,
      hash: stagedAsset.hash,
      alt: stagedAsset.alt,
      createdAt: stagedAsset.createdAt,
    });
    totalAssetBytes += stagedAsset.size + stagedAsset.thumbnailSize;
  }

  const entityIdByWorldId = entityIdMap;
  const entities: ImportPlan['entities'] = [];
  const versions: ImportPlan['versions'] = [];
  const entityTags: ImportPlan['entityTags'] = [];
  const gallery: ImportPlan['gallery'] = [];

  for (const entity of keptWorldEntities) {
    const newId = entityIdByWorldId.get(entity.id);

    if (newId === undefined) {
      continue;
    }

    const fields = fieldsByKey.get(entity.typeKey);

    if (fields === undefined) {
      continue;
    }

    const normalizedDescription =
      entity.description === null
        ? { ok: true as const, document: null, text: null }
        : normalizeDescription(
            remapDescriptionLinks(
              entity.description as EntityRichTextDocument,
              entityIdByWorldId,
              warnings,
            ).document,
          );

    if (!normalizedDescription.ok) {
      throw new TransferError('TRANSFER_WORLD_INVALID');
    }

    const referenceAttributes = remapReferenceAttributes(
      entity.attributes,
      fields,
      entityIdByWorldId,
      warnings,
    );
    const attributes = sanitizeAttributes(
      fields,
      referenceAttributes.attributes,
      warnings,
    );
    const tagIds = entity.tagNames.flatMap((name) => {
      const tagId = tagIdByName.get(name);

      if (tagId === undefined) {
        warnings.add('missing-tag');
        return [];
      }

      return [tagId];
    });
    const galleryIds = remapGallery(entity.gallery, assetIdMap, warnings);

    entities.push({
      id: newId,
      typeKey: entity.typeKey,
      name: entity.name,
      slug: entity.slug,
      aliases: [...entity.aliases],
      summary: entity.summary,
      description:
        normalizedDescription.document as ImportPlanEntity['description'],
      descriptionText: normalizedDescription.text,
      attributes,
      status: entity.status,
      isFavorite: entity.isFavorite,
      imageAssetId: remapOptionalAssetId(
        entity.imageAssetId,
        assetIdMap,
        warnings,
        'missing-entity-image',
      ),
      galleryAssetIds: [...galleryIds],
      tagIds: tagIds.slice(0, ENTITY_TAGS_MAX),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });

    galleryIds.forEach((assetId, position) => {
      gallery.push({ entityId: newId, assetId, position });
    });

    // Las versiones y etiquetas se añaden fuera del bucle para conservar el
    // orden determinista por ficha y fecha.
    for (const version of entity.versions) {
      const normalizedVersion =
        version.description === null
          ? { ok: true as const, document: null, text: null }
          : normalizeDescription(
              remapDescriptionLinks(
                version.description as EntityRichTextDocument,
                entityIdByWorldId,
                warnings,
              ).document,
            );

      if (!normalizedVersion.ok) {
        warnings.add('invalid-version');
        continue;
      }

      versions.push({
        id: generateId(),
        entityId: newId,
        description:
          normalizedVersion.document as ImportPlanVersion['description'],
        descriptionText: normalizedVersion.text,
        label: version.label,
        origin: normalizeOrigin(version.origin, warnings),
        createdAt: version.createdAt,
      });
    }

    for (const tagId of tagIds.slice(0, ENTITY_TAGS_MAX)) {
      entityTags.push({ entityId: newId, tagId });
    }
  }

  const relationKeys = new Set<string>();
  const relations: ImportPlan['relations'] = [];

  for (const relation of staged.world.relations) {
    const sourceId = entityIdByWorldId.get(relation.sourceId);
    const targetId = entityIdByWorldId.get(relation.targetId);

    if (sourceId === undefined || targetId === undefined) {
      warnings.add('broken-relation-endpoint');
      continue;
    }

    if (sourceId === targetId) {
      warnings.add('duplicate-relation');
      continue;
    }

    if (
      !isSystemRelationTypeKey(relation.typeKey) &&
      !relationTypeKeys.has(relation.typeKey)
    ) {
      warnings.add('missing-relation-type');
      continue;
    }

    const key = `${sourceId}\u0000${targetId}\u0000${relation.typeKey}`;

    if (relationKeys.has(key)) {
      warnings.add('duplicate-relation');
      continue;
    }

    relationKeys.add(key);
    relations.push({
      id: generateId(),
      sourceId,
      targetId,
      typeKey: relation.typeKey,
      label: normalizeLabel(relation.label),
      inverseLabel: normalizeLabel(relation.inverseLabel),
      notes: normalizeNotes(relation.notes),
      strength: relation.strength,
      metadata: relation.metadata,
      createdAt: relation.createdAt,
      updatedAt: relation.updatedAt,
    });
  }

  const coverAssetId = remapOptionalAssetId(
    staged.world.coverAssetId,
    assetIdMap,
    warnings,
    'missing-world-cover',
  );

  const counts: TransferCounts = {
    entities: entities.length,
    entityTypes: entityTypes.length,
    relationTypes: relationTypes.length,
    tags: tags.length,
    relations: relations.length,
    versions: versions.length,
    assets: assets.length,
  };

  const plan: ImportPlan = {
    formatVersion: 1,
    worldId,
    importedAt,
    slugAdjusted: worldSlug !== staged.world.world.slug,
    world: {
      name: staged.world.world.name,
      slug: worldSlug,
      summary: staged.world.world.summary,
      description: staged.world.world.description,
      genres: staged.world.world.genres,
      language: staged.world.world.language,
    },
    entityTypes,
    relationTypes,
    tags,
    assets,
    entities,
    versions,
    entityTags,
    gallery,
    relations,
    coverAssetId,
    counts,
    warnings: [...warnings.toList()],
    totalAssetBytes,
  };
  const parsed = importPlanSchema.safeParse(plan);

  if (!parsed.success) {
    throw new TransferError('TRANSFER_WORLD_INVALID', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

/** Serializa el plan en `plan.json` dentro del staging. */
export async function writeImportPlan(
  stagingDir: string,
  plan: ImportPlan,
  maxBytes = TRANSFER_PLAN_MAX_BYTES,
): Promise<string> {
  const file = join(stagingDir, TRANSFER_PLAN_FILE);
  const text = `${JSON.stringify(plan, null, 2)}\n`;

  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  await writeFile(file, text, 'utf8');
  return file;
}

/** Lee y valida un plan escrito por el worker. */
export async function readImportPlan(
  file: string,
  maxBytes = TRANSFER_PLAN_MAX_BYTES,
): Promise<ImportPlan> {
  let size: number;

  try {
    const stats = await lstat(file);

    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new TransferError('TRANSFER_WORLD_INVALID');
    }

    size = stats.size;
  } catch (error) {
    if (error instanceof TransferError) {
      throw error;
    }

    throw new TransferError('TRANSFER_SOURCE_UNREADABLE', { cause: error });
  }

  if (!Number.isFinite(size) || size > maxBytes) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  let text: string;

  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    throw new TransferError('TRANSFER_SOURCE_UNREADABLE', { cause: error });
  }

  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new TransferError('TRANSFER_WORLD_INVALID');
  }

  const parsed = importPlanSchema.safeParse(value);

  if (!parsed.success) {
    throw new TransferError('TRANSFER_WORLD_INVALID', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

function resolveWorldSlug(
  base: string,
  existingSlugs: ReadonlySet<string>,
): string {
  try {
    return uniqueWorldSlug(base, (candidate) => existingSlugs.has(candidate));
  } catch (error) {
    if (error instanceof WorldInputError) {
      throw new TransferError('TRANSFER_WORLD_INVALID', { cause: error });
    }

    throw error;
  }
}

function sanitizeAttributes(
  fields: readonly EntityFieldDefinition[],
  attributes: Readonly<Record<string, string | number>>,
  warnings: TransferWarningCollector,
): Readonly<Record<string, string | number>> {
  const fieldKeys = new Set(fields.map((field) => field.key));
  const known: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (!fieldKeys.has(key)) {
      warnings.add('invalid-attribute');
      continue;
    }

    known[key] = value;
  }

  const validated = validateEntityFieldValues(fields, known);

  if (validated.ok) {
    return validated.values;
  }

  if (validated.errors.some((error) => error.code === 'required')) {
    warnings.add('invalid-attribute');
  }

  const invalidKeys = new Set(
    validated.errors
      .filter((error) => error.code !== 'required')
      .map((error) => error.fieldKey),
  );
  const cleaned: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(known)) {
    if (invalidKeys.has(key)) {
      warnings.add('invalid-attribute');
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

interface NormalizedDescription {
  readonly ok: true;
  readonly document: EntityRichTextDocument | null;
  readonly text: string | null;
}

function normalizeDescription(
  document: EntityRichTextDocument,
): NormalizedDescription | { readonly ok: false } {
  const validated = validateEntityDescription(document);

  if (!validated.ok) {
    return { ok: false };
  }

  return {
    ok: true,
    document: validated.document,
    text: validated.text,
  };
}

function normalizeOrigin(
  origin: string,
  warnings: TransferWarningCollector,
): 'auto' | 'manual' | 'restore' {
  if (origin === 'auto' || origin === 'manual' || origin === 'restore') {
    return origin;
  }

  warnings.add('unknown-version-origin');
  return 'auto';
}

function normalizeLabel(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }

  const value = raw.trim();
  return value.length === 0 ? null : value;
}

function normalizeNotes(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }

  const value = raw.trim();
  return value.length === 0 ? null : value;
}
