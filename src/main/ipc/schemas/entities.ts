/**
 * Esquemas Zod de los canales de fichas y etiquetas.
 *
 * La forma se valida aquí y las reglas de dominio (tipos, referencias,
 * aislamiento, assets) en el servicio. Se rechazan propiedades extra para no
 * arrastrar datos que la base no guarda. La descripción usa el esquema cerrado
 * de ProseMirror: nunca se acepta HTML ni JSON arbitrario.
 */
import { z } from 'zod';

import {
  ENTITY_ALIASES_MAX,
  ENTITY_ALIAS_MAX_LENGTH,
  ENTITY_DESCRIPTION_TEXT_MAX_LENGTH,
  ENTITY_GALLERY_MAX,
  ENTITY_LIST_LIMIT_MAX,
  ENTITY_NAME_MAX_LENGTH,
  ENTITY_SEARCH_MAX_LENGTH,
  ENTITY_STATUSES,
  ENTITY_SUMMARY_MAX_LENGTH,
  ENTITY_TAGS_MAX,
  ENTITY_TAG_NAME_MAX_LENGTH,
} from '../../../shared/contracts/entities';
import { entityDescriptionDocumentSchema } from '../../../shared/entities/description';
import { UUID_V7_PATTERN } from '../../db/ids';
import { ENTITY_TYPE_COLORS } from '../../../shared/contracts/entity-types';

const entityIdSchema = z.string().regex(UUID_V7_PATTERN);
const worldIdSchema = z.string().regex(UUID_V7_PATTERN);

const entityNameSchema = z.string().trim().min(1).max(ENTITY_NAME_MAX_LENGTH);
const entityAliasesSchema = z
  .array(z.string().max(ENTITY_ALIAS_MAX_LENGTH))
  .max(ENTITY_ALIASES_MAX)
  .optional();
const entitySummarySchema = z
  .string()
  .max(ENTITY_SUMMARY_MAX_LENGTH)
  .nullable()
  .optional();
const entityDescriptionSchema = z
  .union([entityDescriptionDocumentSchema, z.null()])
  .optional();
const entityAttributesSchema = z
  .record(
    z.string().min(1).max(40),
    z.union([
      z.string().max(ENTITY_DESCRIPTION_TEXT_MAX_LENGTH),
      z.number().finite(),
    ]),
  )
  .refine((values) => Object.keys(values).length <= 60, {
    message: 'Demasiados atributos.',
  })
  .optional();
const entityAssetIdSchema = z
  .string()
  .regex(UUID_V7_PATTERN)
  .nullable()
  .optional();
const entityGallerySchema = z
  .array(z.string().regex(UUID_V7_PATTERN))
  .max(ENTITY_GALLERY_MAX)
  .optional();
const entityTagIdsSchema = z
  .array(z.string().regex(UUID_V7_PATTERN))
  .max(ENTITY_TAGS_MAX)
  .optional();
const entityStatusSchema = z.enum(ENTITY_STATUSES).optional();
const entityTagColorSchema = z.enum(ENTITY_TYPE_COLORS);
const entitySearchSchema = z
  .string()
  .trim()
  .max(ENTITY_SEARCH_MAX_LENGTH)
  .optional();

/** Payload de `entities:list`. */
export const entitiesListPayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  filter: z
    .strictObject({
      typeId: entityIdSchema.optional(),
      tagId: entityIdSchema.optional(),
      favorite: z.boolean().optional(),
      status: z.enum(ENTITY_STATUSES).optional(),
      search: entitySearchSchema,
      limit: z.number().int().min(1).max(ENTITY_LIST_LIMIT_MAX).optional(),
    })
    .optional(),
});

/** Payload de `entities:get`. */
export const entityGetPayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  id: entityIdSchema,
});

const entityEditableShape = {
  name: entityNameSchema,
  aliases: entityAliasesSchema,
  summary: entitySummarySchema,
  description: entityDescriptionSchema,
  attributes: entityAttributesSchema,
  imageAssetId: entityAssetIdSchema,
  galleryAssetIds: entityGallerySchema,
  tagIds: entityTagIdsSchema,
  status: entityStatusSchema,
} as const;

/** Payload de `entities:create`. */
export const entityCreatePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  typeId: entityIdSchema,
  ...entityEditableShape,
  isFavorite: z.boolean().optional(),
});

/**
 * Payload de `entities:update`.
 *
 * Es un reemplazo completo: todos los campos editables son obligatorios para
 * que un cliente incompleto no borre imagen, galería, etiquetas o descripción.
 */
export const entityUpdatePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  id: entityIdSchema,
  name: entityNameSchema,
  aliases: z
    .array(z.string().max(ENTITY_ALIAS_MAX_LENGTH))
    .max(ENTITY_ALIASES_MAX),
  summary: z.string().max(ENTITY_SUMMARY_MAX_LENGTH).nullable(),
  description: z.union([entityDescriptionDocumentSchema, z.null()]),
  attributes: z.record(
    z.string().min(1).max(40),
    z.union([
      z.string().max(ENTITY_DESCRIPTION_TEXT_MAX_LENGTH),
      z.number().finite(),
    ]),
  ),
  imageAssetId: z.string().regex(UUID_V7_PATTERN).nullable(),
  galleryAssetIds: z
    .array(z.string().regex(UUID_V7_PATTERN))
    .max(ENTITY_GALLERY_MAX),
  tagIds: z.array(z.string().regex(UUID_V7_PATTERN)).max(ENTITY_TAGS_MAX),
  status: z.enum(ENTITY_STATUSES),
});

/** Payload de `entities:setFavorite`. */
export const entitySetFavoritePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  id: entityIdSchema,
  favorite: z.boolean(),
});

/** Payload de `entities:remove`. */
export const entityRemovePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  id: entityIdSchema,
});

/** Payload de `tags:list`. */
export const tagsListPayloadSchema = z.strictObject({
  worldId: worldIdSchema,
});

/** Payload de `tags:create`. */
export const tagCreatePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  name: z.string().trim().min(1).max(ENTITY_TAG_NAME_MAX_LENGTH),
  color: entityTagColorSchema,
});

export type EntitiesListPayload = z.infer<typeof entitiesListPayloadSchema>;
export type EntityGetPayload = z.infer<typeof entityGetPayloadSchema>;
export type EntityCreatePayload = z.infer<typeof entityCreatePayloadSchema>;
export type EntityUpdatePayload = z.infer<typeof entityUpdatePayloadSchema>;
export type EntitySetFavoritePayload = z.infer<
  typeof entitySetFavoritePayloadSchema
>;
export type EntityRemovePayload = z.infer<typeof entityRemovePayloadSchema>;
export type TagsListPayload = z.infer<typeof tagsListPayloadSchema>;
export type TagCreatePayload = z.infer<typeof tagCreatePayloadSchema>;
