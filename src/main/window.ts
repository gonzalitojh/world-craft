/**
 * Creación de la ventana principal de World Craft.
 *
 * La ventana nace oculta, aplica las opciones seguras y solo se muestra cuando
 * el renderer ha cargado y hay un primer frame, de modo que el tema persistido
 * ya está aplicado. Un temporizador acotado evita dejar la aplicación invisible
 * si alguna de esas señales no llega. El destino de carga se valida: en
 * producción siempre es el HTML empaquetado y en desarrollo solo se acepta el
 * servidor de Vite si escucha en loopback.
 */
import { app, BrowserWindow, nativeTheme } from 'electron';
import { join } from 'node:path';

import {
  DEFAULT_UI_PREFERENCES,
  type ThemePreference,
} from '../shared/contracts/preferences';
import { resolveRendererTarget } from './security/guards';
import { resolveWindowBackground } from './window-background';
import { createWindowOptions } from './window-options';

/** Margen máximo para mostrar la ventana si falla alguna señal de carga. */
export const WINDOW_SHOW_FALLBACK_MS = 2500;

let mainWindow: BrowserWindow | null = null;
let currentTheme: ThemePreference = DEFAULT_UI_PREFERENCES.theme;

/** Devuelve la ventana principal si sigue viva; si no, `null`. */
export function getMainWindow(): BrowserWindow | null {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    return null;
  }

  return mainWindow;
}

/**
 * Aplica el tema validado al cromo nativo y a la ventana viva.
 *
 * Se usa en el arranque, antes de crear la ventana, y en cada cambio de tema o
 * reset. Un fallo al repintar la ventana no revierte la preferencia.
 */
export function applyAppTheme(theme: ThemePreference): void {
  currentTheme = theme;
  nativeTheme.themeSource = theme;

  const window = getMainWindow();

  if (window !== null) {
    window.setBackgroundColor(resolveWindowBackground(theme));
  }
}

/** Tema que debe usar una ventana recreada (por ejemplo, tras `activate`). */
export function getCurrentTheme(): ThemePreference {
  return currentTheme;
}

/**
 * Restaura y enfoca la ventana principal si ya está visible.
 *
 * Durante el arranque la ventana sigue oculta a propósito: la compuerta de
 * visualización decide cuándo mostrarla. `focusMainWindow` nunca adelanta ese
 * `show()`.
 */
export function focusMainWindow(): void {
  const window = getMainWindow();

  if (window === null) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  if (!window.isVisible()) {
    return;
  }

  window.focus();
}

/** Crea (o recrea) la ventana principal y carga el renderer. */
export function createMainWindow(
  theme: ThemePreference = DEFAULT_UI_PREFERENCES.theme,
): BrowserWindow {
  // El tema se fija antes de crear la ventana: `show: false` evita cualquier
  // destello y el fondo coincide exactamente con `--bg`.
  applyAppTheme(theme);

  const window = new BrowserWindow(
    createWindowOptions({
      preloadPath: join(__dirname, '../preload/index.cjs'),
      isPackaged: app.isPackaged,
      backgroundColor: resolveWindowBackground(theme),
    }),
  );

  mainWindow = window;

  let readyToShow = false;
  let finishedLoad = false;
  let shown = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const clearFallback = (): void => {
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  };

  const showWindow = (): void => {
    if (shown || window.isDestroyed()) {
      return;
    }

    shown = true;
    clearFallback();
    window.show();
  };

  const showWhenReady = (): void => {
    if (readyToShow && finishedLoad) {
      showWindow();
    }
  };

  // La compuerta exige primer frame y carga terminada (el bootstrap de
  // preferencias se resuelve antes del render). El fallback cubre un renderer
  // atascado sin dejar la app invisible.
  window.once('ready-to-show', () => {
    readyToShow = true;
    showWhenReady();
  });

  window.webContents.once('did-finish-load', () => {
    finishedLoad = true;
    showWhenReady();
  });

  fallbackTimer = setTimeout(showWindow, WINDOW_SHOW_FALLBACK_MS);

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      // Solo código y descripción: la URL fallida puede incluir rutas del
      // perfil del usuario en la versión instalada. No se carga contenido
      // alternativo remoto.
      console.error(
        `No se pudo cargar el renderer (${errorCode}): ${errorDescription}.`,
      );
    },
  );

  window.on('closed', () => {
    clearFallback();

    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  const target = resolveRendererTarget({
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
    indexFile: join(__dirname, '../renderer/index.html'),
    isPackaged: app.isPackaged,
  });

  if (target.kind === 'url') {
    void window.loadURL(target.url);
  } else {
    void window.loadFile(target.filePath);
  }

  return window;
}
