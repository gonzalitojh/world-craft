/**
 * Formato JSON versionado para exportar e importar tipos de un mundo.
 *
 * Solo viajan los tipos personalizados: los del sistema son universales y se
 * siembran con la migración, así que no se duplican en cada exportación. El
 * formato no incluye identificadores internos ni el mundo de origen, de modo
 * que una importación puede asignar IDs nuevos sin colisiones.
 *
 * La exportación completa del mundo (M1-07, #78) compondrá este bloque con las
 * fichas, las relaciones y los assets.
 */
import { z } from 'zod';

import {
  ENTITY_TYPE_COLORS,
  ENTITY_TYPE_ICONS,
  ENTITY_TYPE_KEY_MAX_LENGTH,
  ENTITY_TYPE_KEY_PATTERN,
  ENTITY_TYPE_NAME_MAX_LENGTH,
  ENTITY_TYPE_TRANSFER_VERSION,
} from '../../shared/contracts/entity-types';
import { isSystemEntityTypeKey } from '../../shared/entity-types/catalog';
import { entityFieldTemplateSchema } from '../../shared/entity-types/fields';

/** Límite de tipos en una transferencia para no aceptar archivos abusivos. */
export const ENTITY_TYPE_TRANSFER_MAX = 500;

/** Entrada de un tipo personalizado; se reutiliza en el formato del mundo. */
export const entityTypeTransferEntrySchema = z
  .strictObject({
    key: z
      .string()
      .min(1)
      .max(ENTITY_TYPE_KEY_MAX_LENGTH)
      .regex(ENTITY_TYPE_KEY_PATTERN)
      .refine((key) => !isSystemEntityTypeKey(key), {
        message: 'La clave pertenece a un tipo del sistema.',
      }),
    name: z.string().trim().min(1).max(ENTITY_TYPE_NAME_MAX_LENGTH),
    icon: z.enum(ENTITY_TYPE_ICONS),
    color: z.enum(ENTITY_TYPE_COLORS),
    fields: entityFieldTemplateSchema,
  })
  .strict();

/** Esquema de un bloque de transferencia de tipos. */
export const entityTypeTransferSchema = z
  .strictObject({
    version: z.literal(ENTITY_TYPE_TRANSFER_VERSION),
    types: z
      .array(entityTypeTransferEntrySchema)
      .max(ENTITY_TYPE_TRANSFER_MAX)
      .refine(
        (types) => new Set(types.map((type) => type.key)).size === types.length,
        { message: 'Los tipos no pueden repetir su clave.' },
      ),
  })
  .strict();

export type EntityTypeTransferPayload = z.infer<
  typeof entityTypeTransferSchema
>;
