/**
 * Catálogo del sistema: tipos de entidad y de relación que existen en todos los
 * mundos.
 *
 * El JSON (`system-catalog.json`) es la fuente de verdad y lo aplica
 * `scripts/db/seed.mjs` con un `upsert` idempotente. Este módulo lo valida con
 * Zod para que un error de edición se detecte en las pruebas y no a mitad del
 * seed.
 *
 * Reglas que se comprueban aquí y en la base de datos:
 * - Los tipos del sistema tienen `worldId: null` e `isSystem: true`; el `check`
 *   `entity_types_is_system_check` lo impone en SQL.
 * - `color` es nulo a propósito: M1-03 lo convertirá en un token de tema que
 *   funcione en Claro y Oscuro, no en un hexadecimal fijo.
 * - `fields` está vacío: los campos personalizados llegan con el editor de
 *   fichas (M1).
 * - Ni los nombres ni las claves pueden contener `@` para que el catálogo no
 *   pueda confundirse con datos personales (regla 12).
 */
import { z } from 'zod';

import systemCatalogJson from './system-catalog.json';

/** Número de tipos de entidad del sistema que debe contener el catálogo. */
export const SYSTEM_ENTITY_TYPE_COUNT = 12;

/** Número de tipos de relación del sistema que debe contener el catálogo. */
export const SYSTEM_RELATION_TYPE_COUNT = 15;

/**
 * Iconos Lucide permitidos.
 *
 * Se limita la lista para que el catálogo no dependa de nombres que la
 * interfaz no sepa resolver y para detectar erratas en la revisión.
 */
export const SYSTEM_ENTITY_ICONS = [
  'user-round',
  'map-pin',
  'flag',
  'building-2',
  'swords',
  'paw-print',
  'calendar-days',
  'sparkles',
  'users-round',
  'languages',
  'sun',
  'hourglass',
] as const;

/** Clave estable: minúsculas, números y guiones bajos. */
const catalogKey = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/,
    'debe empezar por letra y usar minúsculas, números o guiones bajos',
  );

/** Texto visible no vacío y sin `@` (no puede parecer un correo). */
const catalogText = z
  .string()
  .min(1, 'no puede estar vacío')
  .refine((value) => !value.includes('@'), {
    message: 'no puede contener «@» ni correos',
  });

/** Tipo de entidad del sistema. */
export const systemEntityTypeSchema = z
  .object({
    id: z.uuid(),
    key: catalogKey,
    name: catalogText,
    icon: z.enum(SYSTEM_ENTITY_ICONS),
    color: z.null(),
    fields: z.tuple([]),
    isSystem: z.literal(true),
    worldId: z.null(),
  })
  .strict();

/** Tipo de relación del sistema, con su nombre inverso. */
export const systemRelationTypeSchema = z
  .object({
    id: z.uuid(),
    key: catalogKey,
    name: catalogText,
    inverseName: catalogText,
    color: z.null(),
    isSystem: z.literal(true),
    worldId: z.null(),
  })
  .strict();

/** Comprueba que una lista de valores no tenga repetidos. */
function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/** Catálogo completo, validado. */
export const systemCatalogSchema = z
  .object({
    version: z.literal(1),
    entityTypes: z
      .array(systemEntityTypeSchema)
      .length(SYSTEM_ENTITY_TYPE_COUNT)
      .refine((items) => hasUniqueValues(items.map((item) => item.id)), {
        message: 'Los ids de los tipos de entidad deben ser únicos',
      })
      .refine((items) => hasUniqueValues(items.map((item) => item.key)), {
        message: 'Las claves de los tipos de entidad deben ser únicas',
      }),
    relationTypes: z
      .array(systemRelationTypeSchema)
      .length(SYSTEM_RELATION_TYPE_COUNT)
      .refine((items) => hasUniqueValues(items.map((item) => item.id)), {
        message: 'Los ids de los tipos de relación deben ser únicos',
      })
      .refine((items) => hasUniqueValues(items.map((item) => item.key)), {
        message: 'Las claves de los tipos de relación deben ser únicas',
      }),
  })
  .strict();

/** Tipo de entidad del sistema ya validado. */
export type SystemEntityType = z.infer<typeof systemEntityTypeSchema>;

/** Tipo de relación del sistema ya validado. */
export type SystemRelationType = z.infer<typeof systemRelationTypeSchema>;

/** Catálogo del sistema ya validado. */
export type SystemCatalog = z.infer<typeof systemCatalogSchema>;

/**
 * Valida un catálogo recibido como dato.
 *
 * Es una función pura para poder probar catálogos inválidos sin tocar el JSON
 * real.
 */
export function parseSystemCatalog(source: unknown): SystemCatalog {
  return systemCatalogSchema.parse(source);
}

/** Catálogo del sistema que aplica el seed. */
export const systemCatalog: SystemCatalog =
  parseSystemCatalog(systemCatalogJson);
