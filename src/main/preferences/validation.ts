/**
 * Esquemas y lectura tolerante de preferencias.
 *
 * Hay dos familias de esquemas, a propósito:
 *
 * - **Estrictos de entrada**: validan el parche IPC con claves exactas, tipos,
 *   rangos y enums. Un valor fuera de rango se rechaza con `INVALID_INPUT`.
 * - **Lenientes de lectura**: cada clave cae a su defecto si el JSON está roto
 *   o el valor no encaja, sin contagiar al resto. Leer nunca escribe ni repara.
 */
import { z } from 'zod';

import { UUID_V7_PATTERN } from '../db/ids';
import { ENTITY_NAME_MAX_LENGTH } from '../../shared/contracts/entities';
import {
  PERSISTED_APP_VIEWS,
  PROPERTIES_WIDTH_DEFAULT,
  PROPERTIES_WIDTH_MAX,
  PROPERTIES_WIDTH_MIN,
  THEME_PREFERENCES,
  createDefaultUiPreferences,
  type EntityViewPreferences,
  type UiPreferences,
} from '../../shared/contracts/preferences';
import { UI_PREFERENCE_KEYS } from './keys';

const entityIdSchema = z.string().regex(UUID_V7_PATTERN);

const recentLocationInputSchema = z.union([
  z.strictObject({
    kind: z.literal('world'),
    worldId: entityIdSchema,
  }),
  z.strictObject({
    kind: z.literal('entity'),
    worldId: entityIdSchema,
    entityId: entityIdSchema,
    entityName: z
      .string()
      .min(1)
      .max(ENTITY_NAME_MAX_LENGTH)
      .nullable(),
  }),
]);

const entityViewInputSchema = z.strictObject({
  propertiesOpen: z.boolean().optional(),
  propertiesWidth: z
    .number()
    .int()
    .min(PROPERTIES_WIDTH_MIN)
    .max(PROPERTIES_WIDTH_MAX)
    .optional(),
  sections: z
    .strictObject({
      description: z.boolean().optional(),
      attributes: z.boolean().optional(),
      relations: z.boolean().optional(),
      resources: z.boolean().optional(),
    })
    .optional(),
});

/** Parche estricto de `preferences:update`; al menos una clave. */
export const uiPreferencesPatchSchema = z
  .strictObject({
    theme: z.enum(THEME_PREFERENCES).optional(),
    railCollapsed: z.boolean().optional(),
    entityView: entityViewInputSchema.optional(),
    lastView: z.enum(PERSISTED_APP_VIEWS).optional(),
    recentLocation: recentLocationInputSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'El parche de preferencias no puede estar vacío.',
  });

export type UiPreferencesPatchInput = z.infer<
  typeof uiPreferencesPatchSchema
>;

const DEFAULT_ENTITY_VIEW: EntityViewPreferences = Object.freeze({
  propertiesOpen: true,
  propertiesWidth: PROPERTIES_WIDTH_DEFAULT,
  sections: Object.freeze({
    description: true,
    attributes: false,
    relations: false,
    resources: false,
  }),
});

const themeReadSchema = z.enum(THEME_PREFERENCES).catch('light');
const railReadSchema = z.boolean().catch(false);
const lastViewReadSchema = z.enum(PERSISTED_APP_VIEWS).catch('home');

const entityViewReadSchema = z
  .object({
    propertiesOpen: z.boolean().catch(true),
    propertiesWidth: z
      .number()
      .int()
      .min(PROPERTIES_WIDTH_MIN)
      .max(PROPERTIES_WIDTH_MAX)
      .catch(PROPERTIES_WIDTH_DEFAULT),
    sections: z
      .object({
        description: z.boolean().catch(true),
        attributes: z.boolean().catch(false),
        relations: z.boolean().catch(false),
        resources: z.boolean().catch(false),
      })
      .catch(DEFAULT_ENTITY_VIEW.sections),
  })
  .catch(DEFAULT_ENTITY_VIEW);

const recentLocationReadSchema = z
  .union([
    z.object({ kind: z.literal('world'), worldId: entityIdSchema }),
    z.object({
      kind: z.literal('entity'),
      worldId: entityIdSchema,
      entityId: entityIdSchema,
      entityName: z
        .string()
        .min(1)
        .max(ENTITY_NAME_MAX_LENGTH)
        .nullable()
        .catch(null),
    }),
  ])
  .nullable()
  .catch(null);

function readKey<T>(
  entries: ReadonlyMap<string, string>,
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  const raw = entries.get(key);

  if (raw === undefined) {
    return fallback;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }

  const result = schema.safeParse(parsed);

  return result.success ? result.data : fallback;
}

/**
 * Convierte las filas crudas en un snapshot canónico.
 *
 * Las claves `ui.*` desconocidas se ignoran para permitir evolución futura; no
 * se lanzan errores por una fila inválida ni se reescribe nada.
 */
export function readStoredPreferences(
  entries: ReadonlyMap<string, string>,
): UiPreferences {
  const defaults = createDefaultUiPreferences();

  return {
    theme: readKey(
      entries,
      UI_PREFERENCE_KEYS.theme,
      themeReadSchema,
      defaults.theme,
    ),
    railCollapsed: readKey(
      entries,
      UI_PREFERENCE_KEYS.railCollapsed,
      railReadSchema,
      defaults.railCollapsed,
    ),
    entityView: readKey(
      entries,
      UI_PREFERENCE_KEYS.entityView,
      entityViewReadSchema,
      defaults.entityView,
    ),
    lastView: readKey(
      entries,
      UI_PREFERENCE_KEYS.lastView,
      lastViewReadSchema,
      defaults.lastView,
    ),
    recentLocation: readKey(
      entries,
      UI_PREFERENCE_KEYS.recentLocation,
      recentLocationReadSchema,
      defaults.recentLocation,
    ),
  };
}
