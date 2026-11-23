/**
 * Fondo nativo de la ventana por tema.
 *
 * Es un módulo puro para poder comprobar en un test que los colores siguen
 * exactamente a `--bg` de `src/renderer/styles/tokens/semantic.css`, que a su
 * vez resuelve `--palette-neutral-100` (Claro) y `--palette-neutral-900`
 * (Oscuro) de `palette.css`. El proceso principal no puede leer CSS en tiempo
 * de ejecución: la única garantía es esta prueba de coherencia.
 */
import type { ThemePreference } from '../shared/contracts/preferences';

/** Equivale a `--bg` en Claro (`--palette-neutral-100`). */
export const LIGHT_WINDOW_BACKGROUND = '#f6f4ef';

/** Equivale a `--bg` en Oscuro (`--palette-neutral-900`). */
export const DARK_WINDOW_BACKGROUND = '#141715';

/** Devuelve el fondo exacto del tema para evitar destellos al arrancar. */
export function resolveWindowBackground(theme: ThemePreference): string {
  return theme === 'dark' ? DARK_WINDOW_BACKGROUND : LIGHT_WINDOW_BACKGROUND;
}
