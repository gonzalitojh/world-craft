/**
 * Contenido del mundo (`world.json`) del formato v1.
 *
 * Solo viaja contenido vivo e implementado: mundo, tipos personalizados,
 * etiquetas, fichas vivas con sus versiones y galería, relaciones entre fichas
 * vivas y assets referenciados. La papelera, `activity_log`, la búsqueda FTS y
 * las preferencias no se exportan.
 *
 * Zod valida la forma y los límites globales. Las referencias que pueden estar
 * rotas en un paquete manipulado (enlaces internos, campos `reference`,
 * galería, portada, relaciones o tipos ausentes) se sanean en `plan.ts` con
 * avisos; los IDs repetidos, slugs repetidos y recuentos incoherentes invalidan
 * el paquete.
 */
import { z } from 'zod';

import {
  ENTITY_ALIASES_MAX,
  ENTITY_ALIAS_MAX_LENGTH,
  ENTITY_GALLERY_MAX,
  ENTITY_NAME_MAX_LENGTH,
  ENTITY_SLUG_MAX_LENGTH,
  ENTITY_SLUG_PATTERN,
  ENTITY_STATUSES,
  ENTITY_SUMMARY_MAX_LENGTH,
  ENTITY_TAGS_MAX,
  ENTITY_TAG_NAME_MAX_LENGTH,
} from '../../../shared/contracts/entities';
import {
  ENTITY_FIELD_KEY_MAX_LENGTH,
  ENTITY_TEXT_MAX_LENGTH,
  ENTITY_TYPE_COLORS,
  ENTITY_TYPE_FIELDS_MAX,
  ENTITY_TYPE_KEY_MAX_LENGTH,
  ENTITY_TYPE_KEY_PATTERN,
  ENTITY_TYPE_TRANSFER_VERSION,
} from '../../../shared/contracts/entity-types';
import {
  RELATION_LABEL_MAX_LENGTH,
  RELATION_METADATA_JSON_MAX_LENGTH,
  RELATION_METADATA_KEY_MAX_LENGTH,
  RELATION_METADATA_MAX_KEYS,
  RELATION_METADATA_VALUE_MAX_LENGTH,
  RELATION_NOTES_MAX_LENGTH,
  RELATION_STRENGTH_MAX,
  RELATION_STRENGTH_MIN,
  RELATION_TYPE_KEY_MAX_LENGTH,
  RELATION_TYPE_KEY_PATTERN,
  RELATION_TYPE_NAME_MAX_LENGTH,
  RELATION_TYPE_TRANSFER_VERSION,
} from '../../../shared/contracts/relations';
import {
  TRANSFER_FORMAT,
  TRANSFER_MAX_ASSETS,
  TRANSFER_MAX_ENTITIES,
  TRANSFER_MAX_ENTITY_TYPES,
  TRANSFER_MAX_RELATIONS,
  TRANSFER_MAX_RELATION_TYPES,
  TRANSFER_MAX_TAGS,
  TRANSFER_MAX_VERSIONS,
  TRANSFER_WORLD_JSON_MAX_BYTES,
  type TransferCounts,
} from '../../../shared/contracts/transfer';
import {
  WORLD_DESCRIPTION_TEXT_MAX_LENGTH,
  WORLD_GENRES_MAX,
  WORLD_GENRE_MAX_LENGTH,
  WORLD_LANGUAGES,
  WORLD_NAME_MAX_LENGTH,
  WORLD_SLUG_MAX_LENGTH,
  WORLD_SLUG_PATTERN,
  WORLD_SUMMARY_MAX_LENGTH,
} from '../../../shared/contracts/worlds';
import {
  entityDescriptionDocumentSchema,
  plainTextToRichTextDocument,
} from '../../../shared/entities/description';
import { validateWorldDescription } from '../../../shared/worlds/description';
import { isSystemEntityTypeKey } from '../../../shared/entity-types/catalog';
import { entityTypeTransferEntrySchema } from '../../entity-types/transfer';
import { isSystemRelationTypeKey } from '../../../shared/relations/catalog';
import { UUID_V7_PATTERN } from '../../db/ids';
import { TransferError } from '../errors';
import type { TransferManifest } from './manifest';
import { buildTransferAssetPath } from './paths';
import { assertSupportedTransferFormat } from './version';

const uuidSchema = z.string().regex(UUID_V7_PATTERN);

const attributeValueSchema = z.union([
  z.string().max(ENTITY_TEXT_MAX_LENGTH),
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
  .refine(
    (value) => Object.keys(value).length <= ENTITY_TYPE_FIELDS_MAX,
    'La ficha tiene demasiados atributos.',
  );

const galleryItemSchema = z
  .strictObject({
    assetId: uuidSchema,
  })
  .strict();

const versionSchema = z
  .strictObject({
    description: entityDescriptionDocumentSchema.nullable(),
    label: z.string().trim().min(1).max(120).nullable(),
    /** Se sanea a `auto` si no es un origen conocido. */
    origin: z.string().min(1).max(20),
    createdAt: z.number().int().min(0),
  })
  .strict();

const entitySchema = z
  .strictObject({
    id: uuidSchema,
    typeKey: z
      .string()
      .min(1)
      .max(ENTITY_TYPE_KEY_MAX_LENGTH)
      .regex(ENTITY_TYPE_KEY_PATTERN),
    name: z.string().trim().min(1).max(ENTITY_NAME_MAX_LENGTH),
    slug: z
      .string()
      .min(1)
      .max(ENTITY_SLUG_MAX_LENGTH)
      .regex(ENTITY_SLUG_PATTERN),
    aliases: z
      .array(z.string().trim().min(1).max(ENTITY_ALIAS_MAX_LENGTH))
      .max(ENTITY_ALIASES_MAX),
    summary: z.string().max(ENTITY_SUMMARY_MAX_LENGTH).nullable(),
    description: entityDescriptionDocumentSchema.nullable(),
    attributes: attributesSchema,
    status: z.enum(ENTITY_STATUSES),
    isFavorite: z.boolean(),
    imageAssetId: uuidSchema.nullable(),
    gallery: z
      .array(galleryItemSchema)
      .max(ENTITY_GALLERY_MAX)
      .refine(
        (items) =>
          new Set(items.map((item) => item.assetId)).size === items.length,
        'La galería no puede repetir un asset.',
      ),
    tagNames: z
      .array(z.string().trim().min(1).max(ENTITY_TAG_NAME_MAX_LENGTH))
      .max(ENTITY_TAGS_MAX)
      .refine(
        (names) => new Set(names).size === names.length,
        'La ficha no puede repetir una etiqueta.',
      ),
    createdAt: z.number().int().min(0),
    updatedAt: z.number().int().min(0),
    versions: z.array(versionSchema).max(TRANSFER_MAX_VERSIONS),
  })
  .strict();

const relationSchema = z
  .strictObject({
    sourceId: uuidSchema,
    targetId: uuidSchema,
    typeKey: z
      .string()
      .min(1)
      .max(RELATION_TYPE_KEY_MAX_LENGTH)
      .regex(RELATION_TYPE_KEY_PATTERN),
    label: z.string().trim().min(1).max(RELATION_LABEL_MAX_LENGTH).nullable(),
    inverseLabel: z
      .string()
      .trim()
      .min(1)
      .max(RELATION_LABEL_MAX_LENGTH)
      .nullable(),
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
        'La relación tiene demasiados metadatos.',
      )
      .refine(
        (value) =>
          JSON.stringify(value).length <= RELATION_METADATA_JSON_MAX_LENGTH,
        'Los metadatos de la relación son demasiado grandes.',
      ),
    createdAt: z.number().int().min(0),
    updatedAt: z.number().int().min(0),
  })
  .strict();

const tagSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(ENTITY_TAG_NAME_MAX_LENGTH),
    color: z.enum(ENTITY_TYPE_COLORS),
    createdAt: z.number().int().min(0),
  })
  .strict();

const assetSchema = z
  .strictObject({
    id: uuidSchema,
    alt: z.string().max(500).nullable(),
    width: z.number().int().min(1).nullable(),
    height: z.number().int().min(1).nullable(),
    createdAt: z.number().int().min(0),
  })
  .strict();

const relationTypeEntrySchema = z
  .strictObject({
    key: z
      .string()
      .min(1)
      .max(RELATION_TYPE_KEY_MAX_LENGTH)
      .regex(RELATION_TYPE_KEY_PATTERN)
      .refine((key) => !isSystemRelationTypeKey(key), {
        message: 'La clave pertenece a un tipo del sistema.',
      }),
    name: z.string().trim().min(1).max(RELATION_TYPE_NAME_MAX_LENGTH),
    inverseName: z.string().trim().min(1).max(RELATION_TYPE_NAME_MAX_LENGTH),
    color: z.enum(ENTITY_TYPE_COLORS),
  })
  .strict();

const entityTypesSchema = z
  .strictObject({
    version: z.literal(ENTITY_TYPE_TRANSFER_VERSION),
    types: z
      .array(entityTypeTransferEntrySchema)
      .max(TRANSFER_MAX_ENTITY_TYPES)
      .refine(
        (types) => new Set(types.map((type) => type.key)).size === types.length,
        'Los tipos no pueden repetir su clave.',
      ),
  })
  .strict();

const relationTypesSchema = z
  .strictObject({
    version: z.literal(RELATION_TYPE_TRANSFER_VERSION),
    types: z
      .array(relationTypeEntrySchema)
      .max(TRANSFER_MAX_RELATION_TYPES)
      .refine(
        (types) => new Set(types.map((type) => type.key)).size === types.length,
        'Los tipos no pueden repetir su clave.',
      ),
  })
  .strict();

const worldFieldsShape = {
  name: z.string().trim().min(1).max(WORLD_NAME_MAX_LENGTH),
  slug: z.string().min(1).max(WORLD_SLUG_MAX_LENGTH).regex(WORLD_SLUG_PATTERN),
  summary: z.string().max(WORLD_SUMMARY_MAX_LENGTH).nullable(),
  genres: z
    .array(z.string().trim().min(1).max(WORLD_GENRE_MAX_LENGTH))
    .max(WORLD_GENRES_MAX),
  language: z.enum(WORLD_LANGUAGES),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
};

const worldTransferShape = {
  format: z.literal(TRANSFER_FORMAT),
  entityTypes: entityTypesSchema,
  relationTypes: relationTypesSchema,
  tags: z.array(tagSchema).max(TRANSFER_MAX_TAGS),
  assets: z.array(assetSchema).max(TRANSFER_MAX_ASSETS),
  entities: z.array(entitySchema).max(TRANSFER_MAX_ENTITIES),
  relations: z.array(relationSchema).max(TRANSFER_MAX_RELATIONS),
  coverAssetId: uuidSchema.nullable(),
};

/** Formato 1: la descripción del mundo era texto plano. */
const worldV1TransferSchema = z
  .strictObject({
    ...worldTransferShape,
    formatVersion: z.literal(1),
    world: z
      .strictObject({
        ...worldFieldsShape,
        description: z
          .string()
          .max(WORLD_DESCRIPTION_TEXT_MAX_LENGTH)
          .nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine(refineWorldPayload);

/** Formato 2: la descripción del mundo es un documento de ProseMirror. */
const worldV2TransferSchema = z
  .strictObject({
    ...worldTransferShape,
    formatVersion: z.literal(2),
    world: z
      .strictObject({
        ...worldFieldsShape,
        description: entityDescriptionDocumentSchema.nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine(refineWorldPayload);

export type WorldTransfer = z.infer<typeof worldV2TransferSchema>;
export type WorldTransferV1 = z.infer<typeof worldV1TransferSchema>;

interface WorldPayloadShape {
  readonly entities: readonly {
    readonly id: string;
    readonly slug: string;
    readonly versions: readonly unknown[];
  }[];
  readonly tags: readonly { readonly name: string }[];
  readonly assets: readonly { readonly id: string }[];
  readonly entityTypes: {
    readonly types: readonly { readonly key: string }[];
  };
}

interface RefinementContext {
  addIssue(issue: {
    code: 'custom';
    message: string;
    path?: (string | number)[];
  }): void;
}

function refineWorldPayload(
  payload: WorldPayloadShape,
  context: RefinementContext,
): void {
  const entityIds = new Set<string>();
  const entitySlugs = new Set<string>();
  const tagNames = new Set<string>();
  const assetIds = new Set<string>();
  let versionCount = 0;

  for (const entity of payload.entities) {
    if (entityIds.has(entity.id)) {
      context.addIssue({
        code: 'custom',
        message: 'El mundo repite el identificador de una ficha.',
        path: ['entities'],
      });
    }

    entityIds.add(entity.id);

    if (entitySlugs.has(entity.slug)) {
      context.addIssue({
        code: 'custom',
        message: 'El mundo repite el slug de una ficha.',
        path: ['entities'],
      });
    }

    entitySlugs.add(entity.slug);
    versionCount += entity.versions.length;
  }

  for (const tag of payload.tags) {
    if (tagNames.has(tag.name)) {
      context.addIssue({
        code: 'custom',
        message: 'El mundo repite una etiqueta.',
        path: ['tags'],
      });
    }

    tagNames.add(tag.name);
  }

  for (const asset of payload.assets) {
    if (assetIds.has(asset.id)) {
      context.addIssue({
        code: 'custom',
        message: 'El mundo repite un asset.',
        path: ['assets'],
      });
    }

    assetIds.add(asset.id);
  }

  // Los tipos del sistema se resuelven por clave en la importación. Una
  // entidad con un tipo desconocido se descarta con aviso en `plan.ts`, no
  // aquí, porque el paquete sigue siendo estructuralmente válido.
  for (const type of payload.entityTypes.types) {
    if (isSystemEntityTypeKey(type.key)) {
      context.addIssue({
        code: 'custom',
        message: 'Un tipo personalizado no puede usar una clave del sistema.',
        path: ['entityTypes'],
      });
    }
  }

  if (versionCount > TRANSFER_MAX_VERSIONS) {
    context.addIssue({
      code: 'custom',
      message: 'El mundo supera el número máximo de versiones.',
      path: ['entities'],
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Convierte el paquete v1 a la forma normalizada v2. */
function normalizeWorldV1(payload: WorldTransferV1): WorldTransfer {
  const document =
    payload.world.description === null
      ? null
      : plainTextToRichTextDocument(payload.world.description);
  const validated = validateWorldDescription(document);

  if (!validated.ok) {
    throw new TransferError('TRANSFER_WORLD_INVALID');
  }

  return {
    ...payload,
    formatVersion: 2,
    world: {
      ...payload.world,
      description: validated.document,
    },
  };
}

function parseWorldValue(value: unknown): WorldTransfer {
  assertSupportedTransferFormat(value);

  if (isRecord(value) && value.formatVersion === 1) {
    const parsedV1 = worldV1TransferSchema.safeParse(value);

    if (!parsedV1.success) {
      throw new TransferError('TRANSFER_WORLD_INVALID', {
        cause: parsedV1.error,
      });
    }

    return normalizeWorldV1(parsedV1.data);
  }

  const parsed = worldV2TransferSchema.safeParse(value);

  if (!parsed.success) {
    throw new TransferError('TRANSFER_WORLD_INVALID', { cause: parsed.error });
  }

  return parsed.data;
}

/** Lee y valida `world.json` desde texto. */
export function parseWorldTransferJson(text: string): WorldTransfer {
  if (Buffer.byteLength(text, 'utf8') > TRANSFER_WORLD_JSON_MAX_BYTES) {
    throw new TransferError('TRANSFER_LIMIT_EXCEEDED');
  }

  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new TransferError('TRANSFER_WORLD_INVALID');
  }

  assertSupportedTransferFormat(value);

  return parseWorldValue(value);
}

/** Valida un `world.json` ya deserializado. */
export function parseWorldTransfer(value: unknown): WorldTransfer {
  return parseWorldValue(value);
}

/** Serializa `world.json` con formato legible e inspeccionable. */
export function serializeWorldTransfer(world: WorldTransfer): string {
  return `${JSON.stringify(world, null, 2)}\n`;
}

/** Cuenta el contenido de un `world.json` ya validado. */
export function countWorldTransfer(world: WorldTransfer): TransferCounts {
  return {
    entities: world.entities.length,
    entityTypes: world.entityTypes.types.length,
    relationTypes: world.relationTypes.types.length,
    tags: world.tags.length,
    relations: world.relations.length,
    versions: world.entities.reduce(
      (total, entity) => total + entity.versions.length,
      0,
    ),
    assets: world.assets.length,
  };
}

/** Comprueba que el manifiesto y `world.json` describen el mismo mundo. */
export function verifyWorldAgainstManifest(
  world: WorldTransfer,
  manifest: TransferManifest,
): void {
  const counts = countWorldTransfer(world);

  if (
    world.world.name !== manifest.world.name ||
    world.world.slug !== manifest.world.slug ||
    counts.entities !== manifest.counts.entities ||
    counts.entityTypes !== manifest.counts.entityTypes ||
    counts.relationTypes !== manifest.counts.relationTypes ||
    counts.tags !== manifest.counts.tags ||
    counts.relations !== manifest.counts.relations ||
    counts.versions !== manifest.counts.versions ||
    counts.assets !== manifest.counts.assets
  ) {
    throw new TransferError('TRANSFER_MANIFEST_INVALID');
  }

  for (const asset of world.assets) {
    const path = buildTransferAssetPath(asset.id);

    if (!manifest.files.some((file) => file.path === path)) {
      throw new TransferError('TRANSFER_MANIFEST_INVALID');
    }
  }
}
