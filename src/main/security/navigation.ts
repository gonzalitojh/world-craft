/**
 * Bloqueo de navegación y de ventanas nuevas en el renderer.
 *
 * La ventana de World Craft no navega fuera de su documento y no admite
 * `<webview>`. Los enlaces externos nunca abren una ventana de Electron: se
 * valida que sean https y se abren en el navegador del sistema con el
 * `openExternal` inyectado (ADR 0004).
 */
import type { WebContents } from 'electron';

import { resolveExternalUrl } from './external-links';

export interface NavigationGuardOptions {
  /**
   * Abre un enlace externo ya validado. En producción es
   * `shell.openExternal`; se inyecta para poder probar los guards sin Electron.
   */
  readonly openExternal: (url: string) => unknown;
}

function openExternallySafely(
  openExternal: (url: string) => unknown,
  url: string,
): void {
  try {
    // Ni un fallo síncrono ni un rechazo asíncrono deben escapar: el renderer
    // no puede provocar errores no controlados en el proceso principal.
    void Promise.resolve(openExternal(url)).catch(() => {});
  } catch {
    // Silencio deliberado: el enlace se descarta y la ventana sigue denegada.
  }
}

/**
 * Instala los bloqueos de navegación sobre un `WebContents`.
 *
 * `will-navigate` y `will-redirect` cubren la navegación iniciada por la página
 * o por redirecciones; `will-frame-navigate` hace lo mismo para cualquier
 * subframe; `setWindowOpenHandler` deniega `window.open` y los enlaces con
 * `target="_blank"`, y abre el destino en el navegador si es un https válido;
 * `will-attach-webview` impide adjuntar webviews aunque una regresión desactive
 * `webviewTag`.
 *
 * `will-download` no es un evento de `WebContents` sino de `Session`, así que
 * se bloquea en `registerSessionGuards` (security/session.ts).
 */
export function registerNavigationGuards(
  contents: WebContents,
  options: NavigationGuardOptions,
): void {
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  contents.on('will-redirect', (event) => {
    event.preventDefault();
  });

  contents.on('will-frame-navigate', (event) => {
    event.preventDefault();
  });

  contents.setWindowOpenHandler((details) => {
    const decision = resolveExternalUrl(details.url);

    if (decision.kind === 'allow') {
      openExternallySafely(options.openExternal, decision.url);
    }

    return { action: 'deny' };
  });

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}
