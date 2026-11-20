/**
 * Política de red del actualizador.
 *
 * electron-updater usa la partición `electron-updater` con caché desactivada
 * (su propio `getNetSession`). Aquí se instalan guards sobre esa sesión para
 * que solo salga HTTPS hacia GitHub, sin credenciales, sin puertos no
 * estándar y sin cabeceras de autenticación ni de staging. Cualquier otra
 * petición se cancela y los permisos se deniegan.
 */
import type { Session } from 'electron';

/** Partición que usa electron-updater por defecto. */
export const UPDATE_SESSION_PARTITION = 'electron-updater';

/** Cabeceras que nunca deben salir hacia GitHub. */
export const UPDATE_FORBIDDEN_HEADERS = Object.freeze([
  'x-user-staging-id',
  'authorization',
  'private-token',
  'cookie',
]);

const FORBIDDEN_HEADER_SET: ReadonlySet<string> = new Set(
  UPDATE_FORBIDDEN_HEADERS,
);

/** Hosts permitidos: GitHub y sus descargas. */
const ALLOWED_UPDATE_HOSTS: ReadonlySet<string> = new Set([
  'github.com',
  'api.github.com',
]);

const ALLOWED_UPDATE_HOST_SUFFIX = '.githubusercontent.com';

/**
 * Indica si una URL es un destino legítimo del actualizador.
 *
 * - Solo `https:`.
 * - Sin usuario ni contraseña embebidos.
 * - Puerto vacío o 443.
 * - `github.com`, `api.github.com` o cualquier subdominio de
 *   `githubusercontent.com`.
 */
export function isAllowedUpdateRequestUrl(rawUrl: string): boolean {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') {
    return false;
  }

  if (url.username.length > 0 || url.password.length > 0) {
    return false;
  }

  if (url.port.length > 0 && url.port !== '443') {
    return false;
  }

  const hostname = url.hostname.toLowerCase();

  return (
    ALLOWED_UPDATE_HOSTS.has(hostname) ||
    hostname === 'githubusercontent.com' ||
    hostname.endsWith(ALLOWED_UPDATE_HOST_SUFFIX)
  );
}

/**
 * Elimina las cabeceras prohibidas conservando el resto.
 *
 * La comparación es insensible a mayúsculas porque `webRequest` entrega los
 * nombres tal como los escribe el cliente.
 */
export function sanitizeUpdateRequestHeaders(
  headers: Record<string, string | string[]>,
): Record<string, string | string[]> {
  const sanitized: Record<string, string | string[]> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (!FORBIDDEN_HEADER_SET.has(name.toLowerCase())) {
      sanitized[name] = value;
    }
  }

  return sanitized;
}

/**
 * Instala los guards sobre la sesión del actualizador.
 *
 * Las peticiones a hosts ajenos se cancelan antes de salir; las cabeceras
 * sensibles se eliminan antes de enviarse. Los permisos (cámara, notificaciones
 * o geolocalización) se deniegan siempre, porque el updater no los necesita.
 */
export function installUpdateSessionGuards(targetSession: Session): void {
  const filter = { urls: ['*://*/*'] };

  targetSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    callback({ cancel: !isAllowedUpdateRequestUrl(details.url) });
  });

  // electron-updater usa `redirect: manual` en su executor: aborta cada
  // redirección y crea una petición nueva, que vuelve a pasar por este guard.
  // `onBeforeRedirect` no admite callback de cancelación en Electron, así que
  // la validación del destino queda cubierta por `onBeforeRequest`.
  targetSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    callback({
      requestHeaders: sanitizeUpdateRequestHeaders(details.requestHeaders),
    });
  });

  targetSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );

  targetSession.setPermissionCheckHandler(() => false);
}
