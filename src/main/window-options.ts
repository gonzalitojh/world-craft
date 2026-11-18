/**
 * Opciones de la ventana principal.
 *
 * Es una función pura para poder comprobar en un test que la configuración de
 * seguridad del ADR 0004 no se relaja por accidente.
 */
import type { BrowserWindowConstructorOptions } from 'electron';

import {
  APP_NAME,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from '../shared/app-info';

/** Tamaño inicial de la ventana de escritorio. */
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;

export interface WindowOptionsInput {
  /** Ruta absoluta del preload compilado. */
  readonly preloadPath: string;
  /** Indica si la aplicación se está ejecutando empaquetada. */
  readonly isPackaged: boolean;
  /** Color de fondo acorde al tema del sistema, para evitar destellos. */
  readonly backgroundColor: string;
}

/** Construye las opciones de `BrowserWindow` con la configuración segura. */
export function createWindowOptions(
  input: WindowOptionsInput,
): BrowserWindowConstructorOptions {
  return {
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: APP_NAME,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: input.backgroundColor,
    webPreferences: {
      preload: input.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      devTools: !input.isPackaged,
      // Evita que Chromium descargue diccionarios y genere tráfico de red.
      spellcheck: false,
    },
  };
}
