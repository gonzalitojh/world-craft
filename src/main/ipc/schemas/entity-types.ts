/**
 * Esquemas Zod de los canales de tipos de entidad.
 *
 * La forma se valida aquí y las reglas de dominio (claves reservadas, mundo
 * existente, protección del sistema) en el servicio. Se rechazan propiedades
 * extra para no arrastrar datos que la base no guarda.
 */
import { z } from 'zod';

import {
  ENTITY_TYPE_COLORS,
  ENTITY_TYPE_ICONS,
  ENTITY_TYPE_KEY_MAX_LENGTH,
  ENTITY_TYPE_KEY_PATTERN,
  ENTITY_TYPE_NAME_MAX_LENGTH,
} from '../../../shared/contracts/entity-types';
import { entityFieldTemplateSchema } from '../../../shared/entity-types/fields';
import { UUID_V7_PATTERN } from '../../db/ids';

const uuidSchema = z.string().regex(UUID_V7_PATTERN);

const nameSchema = z.string().trim().min(1).max(ENTITY_TYPE_NAME_MAX_LENGTH);

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(ENTITY_TYPE_KEY_MAX_LENGTH)
  .regex(ENTITY_TYPE_KEY_PATTERN);

const iconSchema = z.enum(ENTITY_TYPE_ICONS);

const colorSchema = z.enum(ENTITY_TYPE_COLORS);

/** Payload de `entityTypes:list`. */
export const entityTypesListPayloadSchema = z.strictObject({
  worldId: uuidSchema,
});

/** Payload de `entityTypes:create`. */
export const entityTypeCreatePayloadSchema = z.strictObject({
  worldId: uuidSchema,
  name: nameSchema,
  key: keySchema.optional(),
  icon: iconSchema,
  color: colorSchema,
  fields: entityFieldTemplateSchema,
});

/** Payload de `entityTypes:update`. */
export const entityTypeUpdatePayloadSchema = z.strictObject({
  worldId: uuidSchema,
  id: uuidSchema,
  name: nameSchema,
  icon: iconSchema,
  color: colorSchema,
  fields: entityFieldTemplateSchema,
});

/** Payload de `entityTypes:duplicate`. */
export const entityTypeDuplicatePayloadSchema = z.strictObject({
  worldId: uuidSchema,
  id: uuidSchema,
  name: nameSchema,
});

/** Payload de `entityTypes:remove`. */
export const entityTypeRemovePayloadSchema = z.strictObject({
  worldId: uuidSchema,
  id: uuidSchema,
});

export type EntityTypesListPayload = z.infer<
  typeof entityTypesListPayloadSchema
>;
export type EntityTypeCreatePayload = z.infer<
  typeof entityTypeCreatePayloadSchema
>;
export type EntityTypeUpdatePayload = z.infer<
  typeof entityTypeUpdatePayloadSchema
>;
export type EntityTypeDuplicatePayload = z.infer<
  typeof entityTypeDuplicatePayloadSchema
>;
export type EntityTypeRemovePayload = z.infer<
  typeof entityTypeRemovePayloadSchema
>;
