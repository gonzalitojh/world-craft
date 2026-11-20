/**
 * Creación de la ventana principal de World Craft.
 *
 * La ventana nace oculta, aplica las opciones seguras y solo se muestra cuando
 * el renderer está listo. El destino de carga se valida: en producción siempre
 * es el HTML empaquetado y en desarrollo solo se acepta el servidor de Vite si
 * escucha en loopback.
 */
import { app, BrowserWindow, nativeTheme } from 'electron';
import { join } from 'node:path';

import { resolveRendererTarget } from './security/guards';
import { createWindowOptions } from './window-options';

/**
 * Colores de fondo de la ventana antes de que pinte el renderer. Deben
 * coincidir con `--wc-paper` de `src/renderer/styles/base.css` en cada tema;
 * no se pueden leer del CSS desde el proceso principal.
 */
const LIGHT_WINDOW_BACKGROUND = '#f7f3ea';
const DARK_WINDOW_BACKGROUND = '#1b1917';

let mainWindow: BrowserWindow | null = null;

/** Devuelve la ventana principal si sigue viva; si no, `null`. */
export function getMainWindow(): BrowserWindow | null {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    return null;
  }

  return mainWindow;
}

/**
 * Restaura, muestra y enfoca la ventana principal.
 *
 * La usa el evento `second-instance`: al abrir la aplicación una segunda vez,
 * la instancia existente trae su ventana al frente en lugar de crear otra.
 */
export function focusMainWindow(): void {
  const window = getMainWindow();

  if (window === null) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

/** Crea (o recrea) la ventana principal y carga el renderer. */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow(
    createWindowOptions({
      preloadPath: join(__dirname, '../preload/index.cjs'),
      isPackaged: app.isPackaged,
      backgroundColor: nativeTheme.shouldUseDarkColors
        ? DARK_WINDOW_BACKGROUND
        : LIGHT_WINDOW_BACKGROUND,
    }),
  );

  mainWindow = window;

  window.once('ready-to-show', () => {
    window.show();
  });

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
