/**
 * Apariencia del renderer.
 *
 * El tipo y los valores por defecto viven en el contrato compartido de
 * preferencias (#132): el tema, la densidad y el tamaño de texto se persisten
 * en `app_settings` y se aplican antes del primer render. Este módulo conserva
 * el acceso al documento.
 */
import {
  DEFAULT_UI_PREFERENCES,
  isDensityPreference,
  isFontScalePreference,
  isThemePreference,
  type DensityPreference,
  type FontScalePreference,
  type ThemePreference,
  type UiPreferences,
} from '../shared/contracts/preferences';

/** Modos de tema admitidos (ADR 0006). */
export type ThemeMode = ThemePreference;

/** Tema de respaldo cuando no hay preferencia válida. */
export const DEFAULT_THEME: ThemeMode = DEFAULT_UI_PREFERENCES.theme;

/** Parte del snapshot que afecta a la apariencia del documento. */
export type AppearancePreferences = Pick<
  UiPreferences,
  'theme' | 'density' | 'fontScale'
>;

/**
 * Aplica el tema al documento con `data-theme`.
 *
 * Los overrides de `tokens/semantic.css` cuelgan de ese atributo, así que un
 * solo cambio repinta toda la aplicación. Se conserva para el cromo nativo y
 * los consumidores que solo necesitan el tema.
 */
export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = isThemePreference(theme)
    ? theme
    : DEFAULT_UI_PREFERENCES.theme;
}

/**
 * Aplica tema, densidad y tamaño de texto con atributos de datos.
 *
 * `tokens/scales.css` define los presets de densidad y texto colgando de
 * `data-density` y `data-font-scale`; nunca se cambia el tamaño raíz, el zoom
 * ni la transformación. Un valor inesperado cae al preset seguro.
 */
export function applyAppearance(preferences: AppearancePreferences): void {
  const density: DensityPreference = isDensityPreference(preferences.density)
    ? preferences.density
    : DEFAULT_UI_PREFERENCES.density;
  const fontScale: FontScalePreference = isFontScalePreference(
    preferences.fontScale,
  )
    ? preferences.fontScale
    : DEFAULT_UI_PREFERENCES.fontScale;

  applyTheme(preferences.theme);
  document.documentElement.dataset.density = density;
  document.documentElement.dataset.fontScale = fontScale;
}
