/**
 * Tema visual del renderer.
 *
 * El tipo y el valor por defecto viven en el contrato compartido de
 * preferencias (#132): el tema se persiste en `app_settings` y se aplica antes
 * del primer render. Este módulo conserva el acceso al documento.
 */
import {
  DEFAULT_UI_PREFERENCES,
  type ThemePreference,
} from '../shared/contracts/preferences';

/** Modos de tema admitidos (ADR 0006). */
export type ThemeMode = ThemePreference;

/** Tema de respaldo cuando no hay preferencia válida. */
export const DEFAULT_THEME: ThemeMode = DEFAULT_UI_PREFERENCES.theme;

/**
 * Aplica el tema al documento con `data-theme`.
 *
 * Los overrides de `tokens/semantic.css` cuelgan de ese atributo, así que un
 * solo cambio repinta toda la aplicación.
 */
export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
}
