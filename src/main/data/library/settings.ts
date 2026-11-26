/**
 * `settings.json` de la biblioteca v1.
 *
 * Solo incluye apariencia, rail y memoria de la vista de ficha. `lastView` y
 * `recentLocation` se quedan fuera a propósito porque apuntan a contenido
 * concreto y no forman parte de una biblioteca portable.
 */
import { z } from 'zod';

import type { UiPreferences } from '../../../shared/contracts/preferences';
import {
  DENSITY_PREFERENCES,
  ENTITY_SECTION_IDS,
  FONT_SCALE_PREFERENCES,
  PROPERTIES_WIDTH_MAX,
  PROPERTIES_WIDTH_MIN,
  THEME_PREFERENCES,
} from '../../../shared/contracts/preferences';
import { DataError } from '../errors';
import {
  LIBRARY_SETTINGS_FORMAT,
  LIBRARY_SETTINGS_FORMAT_VERSION,
  LIBRARY_SETTINGS_MAX_BYTES,
} from './constants';

const entityViewSchema = z
  .strictObject({
    propertiesOpen: z.boolean(),
    propertiesWidth: z
      .number()
      .int()
      .min(PROPERTIES_WIDTH_MIN)
      .max(PROPERTIES_WIDTH_MAX),
    sections: z.strictObject({
      description: z.boolean(),
      attributes: z.boolean(),
      relations: z.boolean(),
      resources: z.boolean(),
    }),
  })
  .superRefine((sections, context) => {
    if (Object.keys(sections.sections).length !== ENTITY_SECTION_IDS.length) {
      context.addIssue({
        code: 'custom',
        message: 'Faltan secciones de la ficha.',
        path: ['sections'],
      });
    }
  });

/** Esquema estricto de `settings.json`. */
export const librarySettingsSchema = z
  .strictObject({
    format: z.literal(LIBRARY_SETTINGS_FORMAT),
    formatVersion: z.literal(LIBRARY_SETTINGS_FORMAT_VERSION),
    theme: z.enum(THEME_PREFERENCES),
    density: z.enum(DENSITY_PREFERENCES),
    fontScale: z.enum(FONT_SCALE_PREFERENCES),
    railCollapsed: z.boolean(),
    entityView: entityViewSchema,
  })
  .strict();

export type LibrarySettings = z.infer<typeof librarySettingsSchema>;

/** Construye y valida los ajustes desde el snapshot de preferencias. */
export function createLibrarySettings(
  preferences: UiPreferences,
): LibrarySettings {
  const parsed = librarySettingsSchema.safeParse({
    format: LIBRARY_SETTINGS_FORMAT,
    formatVersion: LIBRARY_SETTINGS_FORMAT_VERSION,
    theme: preferences.theme,
    density: preferences.density,
    fontScale: preferences.fontScale,
    railCollapsed: preferences.railCollapsed,
    entityView: preferences.entityView,
  });

  if (!parsed.success) {
    throw new DataError('DATA_LIBRARY_SETTINGS_INVALID', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

/** Valida unos ajustes ya deserializados. */
export function parseLibrarySettings(value: unknown): LibrarySettings {
  const parsed = librarySettingsSchema.safeParse(value);

  if (!parsed.success) {
    throw new DataError('DATA_LIBRARY_SETTINGS_INVALID', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

/** Valida `settings.json` desde texto. */
export function parseLibrarySettingsJson(text: string): LibrarySettings {
  if (Buffer.byteLength(text, 'utf8') > LIBRARY_SETTINGS_MAX_BYTES) {
    throw new DataError('DATA_LIBRARY_SETTINGS_INVALID');
  }

  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new DataError('DATA_LIBRARY_SETTINGS_INVALID');
  }

  return parseLibrarySettings(value);
}

/** Serializa los ajustes con formato legible e inspeccionable. */
export function serializeLibrarySettings(settings: LibrarySettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}
