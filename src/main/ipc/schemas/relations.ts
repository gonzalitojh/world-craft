/**
 * Esquemas Zod de los canales de relaciones y tipos de relación.
 *
 * La forma se valida aquí y las reglas de dominio (mundo, fichas vivas,
 * duplicados, autorreferencia y tipos del sistema) en el servicio. Se rechazan
 * propiedades extra para no arrastrar datos que la base no guarda. Los
 * metadatos solo admiten valores escalares y nunca se interpretan como HTML.
 */
import { z } from 'zod';

import {
  RELATION_LABEL_MAX_LENGTH,
  RELATION_LIST_LIMIT_MAX,
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
import { ENTITY_TYPE_COLORS } from '../../../shared/contracts/entity-types';
import { UUID_V7_PATTERN } from '../../db/ids';

const worldIdSchema = z.string().regex(UUID_V7_PATTERN);
const idSchema = z.string().regex(UUID_V7_PATTERN);
const colorSchema = z.enum(ENTITY_TYPE_COLORS);

const metadataSchema = z
  .record(
    z.string().min(1).max(RELATION_METADATA_KEY_MAX_LENGTH),
    z.union([
      z.string().max(RELATION_METADATA_VALUE_MAX_LENGTH),
      z.number().finite(),
      z.boolean(),
    ]),
  )
  .refine(
    (values) => Object.keys(values).length <= RELATION_METADATA_MAX_KEYS,
    {
      message: 'Demasiados metadatos.',
    },
  );

const labelSchema = z.string().max(RELATION_LABEL_MAX_LENGTH).nullable();
const notesSchema = z.string().max(RELATION_NOTES_MAX_LENGTH).nullable();
const strengthSchema = z
  .number()
  .int()
  .min(RELATION_STRENGTH_MIN)
  .max(RELATION_STRENGTH_MAX);

/** Payload de `relationTypes:list`. */
export const relationTypesListPayloadSchema = z.strictObject({
  worldId: worldIdSchema,
});

/** Payload de `relationTypes:create`. */
export const relationTypeCreatePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  name: z.string().trim().min(1).max(RELATION_TYPE_NAME_MAX_LENGTH),
  inverseName: z.string().trim().min(1).max(RELATION_TYPE_NAME_MAX_LENGTH),
  key: z
    .string()
    .trim()
    .min(1)
    .max(RELATION_TYPE_KEY_MAX_LENGTH)
    .regex(RELATION_TYPE_KEY_PATTERN)
    .optional(),
  color: colorSchema,
});

/** Payload de `relationTypes:update`; la clave no cambia. */
export const relationTypeUpdatePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  id: idSchema,
  name: z.string().trim().min(1).max(RELATION_TYPE_NAME_MAX_LENGTH),
  inverseName: z.string().trim().min(1).max(RELATION_TYPE_NAME_MAX_LENGTH),
  color: colorSchema,
});

/** Payload de `relationTypes:remove`. */
export const relationTypeRemovePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  id: idSchema,
});

/** Payload de `relations:list`. */
export const relationsListPayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  filter: z
    .strictObject({
      entityId: idSchema.optional(),
      typeId: idSchema.optional(),
      limit: z.number().int().min(1).max(RELATION_LIST_LIMIT_MAX).optional(),
    })
    .optional(),
});

/** Payload de `relations:create`. */
export const relationCreatePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  sourceId: idSchema,
  targetId: idSchema,
  typeId: idSchema,
  label: labelSchema.optional(),
  inverseLabel: labelSchema.optional(),
  notes: notesSchema.optional(),
  strength: strengthSchema.optional(),
  metadata: metadataSchema.optional(),
});

/**
 * Payload de `relations:update`.
 *
 * Es un reemplazo completo de los campos editables: las etiquetas y las notas
 * pueden ser `null`, pero deben estar presentes para que un payload incompleto
 * no borre datos por accidente.
 */
export const relationUpdatePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  id: idSchema,
  typeId: idSchema,
  label: labelSchema,
  inverseLabel: labelSchema,
  notes: notesSchema,
  strength: strengthSchema,
  metadata: metadataSchema,
});

/** Payload de `relations:remove`. */
export const relationRemovePayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  id: idSchema,
});

export type RelationTypesListPayload = z.infer<
  typeof relationTypesListPayloadSchema
>;
export type RelationTypeCreatePayload = z.infer<
  typeof relationTypeCreatePayloadSchema
>;
export type RelationTypeUpdatePayload = z.infer<
  typeof relationTypeUpdatePayloadSchema
>;
export type RelationTypeRemovePayload = z.infer<
  typeof relationTypeRemovePayloadSchema
>;
export type RelationsListPayload = z.infer<typeof relationsListPayloadSchema>;
export type RelationCreatePayload = z.infer<typeof relationCreatePayloadSchema>;
export type RelationUpdatePayload = z.infer<typeof relationUpdatePayloadSchema>;
export type RelationRemovePayload = z.infer<typeof relationRemovePayloadSchema>;
