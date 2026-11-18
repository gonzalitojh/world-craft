/**
 * Modos de tema admitidos (ADR 0006).
 *
 * No hay modo «sistema» en el MVP: el usuario elige Claro u Oscuro. Hasta que
 * Ajustes persista la preferencia en `config.json`, el tema vive en memoria y
 * el arranque usa `DEFAULT_THEME`.
 */
export type ThemeMode = 'light' | 'dark';

/** Tema inicial mientras la preferencia no se persiste. */
export const DEFAULT_THEME: ThemeMode = 'light';

/**
 * Aplica el tema al documento con `data-theme`.
 *
 * Los overrides de `tokens/semantic.css` cuelgan de ese atributo, así que un
 * solo cambio repinta toda la aplicación.
 */
export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
}
