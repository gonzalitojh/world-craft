/**
 * Esquemas Zod de los canales de mundos.
 *
 * La forma se valida aquí y las reglas de dominio (recorte, slugs, géneros,
 * duplicados) en el servicio. Se rechazan propiedades extra para no arrastrar
 * datos que la base no guarda.
 */
import { z } from 'zod';

import {
  WORLD_ACTIVITY_LIMIT_MAX,
  WORLD_DESCRIPTION_MAX_LENGTH,
  WORLD_GENRES_MAX,
  WORLD_GENRE_MAX_LENGTH,
  WORLD_LANGUAGES,
  WORLD_NAME_MAX_LENGTH,
  WORLD_SLUG_MAX_LENGTH,
  WORLD_SUMMARY_MAX_LENGTH,
} from '../../../shared/contracts/worlds';
import { UUID_V7_PATTERN } from '../../db/ids';

const worldIdSchema = z.string().regex(UUID_V7_PATTERN);

const worldNameSchema = z.string().trim().min(1).max(WORLD_NAME_MAX_LENGTH);

const worldSlugSchema = z.string().trim().min(1).max(WORLD_SLUG_MAX_LENGTH);

const worldSummarySchema = z
  .string()
  .max(WORLD_SUMMARY_MAX_LENGTH)
  .nullable()
  .optional();

const worldDescriptionSchema = z
  .string()
  .max(WORLD_DESCRIPTION_MAX_LENGTH)
  .nullable()
  .optional();

const worldGenresSchema = z
  .array(z.string().max(WORLD_GENRE_MAX_LENGTH))
  .max(WORLD_GENRES_MAX)
  .optional();

const worldLanguageSchema = z.enum(WORLD_LANGUAGES).optional();

/** Payload vacío de `worlds:list`. */
export const worldsListPayloadSchema = z.strictObject({});

/** Payload de `worlds:get`. */
export const worldGetPayloadSchema = z.strictObject({ id: worldIdSchema });

/** Payload de `worlds:create`. */
export const worldCreatePayloadSchema = z.strictObject({
  name: worldNameSchema,
  slug: worldSlugSchema.optional(),
  summary: worldSummarySchema,
  description: worldDescriptionSchema,
  genres: worldGenresSchema,
  language: worldLanguageSchema,
});

/** Payload de `worlds:update`. */
export const worldUpdatePayloadSchema = worldCreatePayloadSchema.extend({
  id: worldIdSchema,
});

/** Payload de `worlds:duplicate`. */
export const worldDuplicatePayloadSchema = z.strictObject({
  id: worldIdSchema,
  name: worldNameSchema,
});

/** Payload de `worlds:setArchived`. */
export const worldSetArchivedPayloadSchema = z.strictObject({
  id: worldIdSchema,
  archived: z.boolean(),
});

/** Payload de `worlds:remove`. */
export const worldRemovePayloadSchema = z.strictObject({ id: worldIdSchema });

/** Payload de `worlds:listActivity`. */
export const worldListActivityPayloadSchema = z.strictObject({
  worldId: worldIdSchema.optional(),
  limit: z.number().int().min(1).max(WORLD_ACTIVITY_LIMIT_MAX).optional(),
});

export type WorldsListPayload = z.infer<typeof worldsListPayloadSchema>;
export type WorldGetPayload = z.infer<typeof worldGetPayloadSchema>;
export type WorldCreatePayload = z.infer<typeof worldCreatePayloadSchema>;
export type WorldUpdatePayload = z.infer<typeof worldUpdatePayloadSchema>;
export type WorldDuplicatePayload = z.infer<typeof worldDuplicatePayloadSchema>;
export type WorldSetArchivedPayload = z.infer<
  typeof worldSetArchivedPayloadSchema
>;
export type WorldRemovePayload = z.infer<typeof worldRemovePayloadSchema>;
export type WorldListActivityPayload = z.infer<
  typeof worldListActivityPayloadSchema
>;
