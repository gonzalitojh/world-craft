/**
 * Claves de `app_settings` reservadas a las preferencias de interfaz.
 *
 * El prefijo `ui.` es exclusivo de #132: `reset` borra solo ese espacio y nunca
 * claves de dominio u otras preferencias de la aplicación.
 */
export const UI_PREFERENCE_PREFIX = 'ui.';

/** Claves conocidas por esta versión. */
export const UI_PREFERENCE_KEYS = {
  theme: 'ui.theme',
  railCollapsed: 'ui.rail-collapsed',
  entityView: 'ui.entity-view',
  lastView: 'ui.last-view',
  recentLocation: 'ui.recent-location',
} as const;

export type UiPreferenceKey =
  (typeof UI_PREFERENCE_KEYS)[keyof typeof UI_PREFERENCE_KEYS];

/**
 * Patrón SQL del espacio de nombres para `GLOB`.
 *
 * `GLOB` es sensible a mayúsculas, al contrario que `LIKE`: `ui.*` solo acepta
 * el prefijo exacto y nunca una clave hipotética `UI.*`. El punto es literal.
 */
export const UI_PREFERENCE_GLOB_PATTERN = `${UI_PREFERENCE_PREFIX}*`;
