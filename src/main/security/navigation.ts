/**
 * Bloqueo de navegación y de ventanas nuevas en el renderer.
 *
 * La ventana de World Craft no navega fuera de su documento, no abre ventanas
 * emergentes y no admite `<webview>`. Los enlaces externos se abrirán con
 * `shell.openExternal` en una issue posterior, nunca desde aquí (ADR 0004).
 */
import type { WebContents } from 'electron';

/**
 * Instala los bloqueos de navegación sobre un `WebContents`.
 *
 * `will-navigate` y `will-redirect` cubren la navegación iniciada por la página
 * o por redirecciones; `will-frame-navigate` hace lo mismo para cualquier
 * subframe; `setWindowOpenHandler` deniega `window.open` y los enlaces con
 * `target="_blank"`; `will-attach-webview` impide adjuntar webviews aunque una
 * regresión desactive `webviewTag`.
 *
 * `will-download` no es un evento de `WebContents` sino de `Session`, así que
 * se bloquea en `registerSessionGuards` (security/session.ts).
 */
export function registerNavigationGuards(contents: WebContents): void {
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  contents.on('will-redirect', (event) => {
    event.preventDefault();
  });

  contents.on('will-frame-navigate', (event) => {
    event.preventDefault();
  });

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}
