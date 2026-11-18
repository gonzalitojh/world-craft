/**
 * Guards de sesión: permisos denegados, descargas bloqueadas y cancelación de
 * peticiones remotas.
 *
 * Todo permiso del navegador (cámara, micrófono, notificaciones, ubicación...)
 * se deniega por defecto. Las descargas se cancelan en origen y las peticiones
 * HTTP(S) y WebSocket se cancelan salvo el loopback que Vite necesita en
 * desarrollo (ADR 0004).
 */
import type { Session } from 'electron';

import { isRemoteRequest } from './guards';

/** Instala los guards sobre una sesión de Electron. */
export function registerSessionGuards(
  ses: Session,
  options: { readonly development: boolean },
): void {
  ses.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });

  ses.setPermissionCheckHandler(() => false);

  // `will-download` vive en la sesión, no en `webContents`. Sin descargas no
  // hay escritura de archivos iniciada desde el renderer.
  ses.on('will-download', (event) => {
    event.preventDefault();
  });

  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      callback({ cancel: isRemoteRequest(details.url, options) });
    },
  );
}
