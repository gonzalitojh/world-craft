/**
 * Reglas puras de red y de resolución del renderer.
 *
 * Se mantienen separadas del wiring de Electron para poder probarlas sin abrir
 * una ventana: aquí no se importa nada de Electron ni de Node en tiempo de
 * ejecución.
 */

/** Hosts que se consideran el propio equipo. */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Esquemas que pueden generar tráfico de red y, por tanto, se filtran. */
const NETWORK_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isLoopbackHost(url: URL): boolean {
  return LOOPBACK_HOSTNAMES.has(url.hostname);
}

/** Indica si una URL HTTP(S) apunta al propio equipo. */
export function isLoopbackUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);

  if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    return false;
  }

  return isLoopbackHost(url);
}

/**
 * Indica si una petición de red debe cancelarse.
 *
 * Cubre HTTP(S) y WebSocket: en producción no se permite ninguna petición
 * remota ni local; en desarrollo solo se permite loopback, que es lo que usan
 * Vite para servir el renderer y su HMR. Otros esquemas (`file:`, `wc-asset:`,
 * `devtools:`) no se tocan.
 */
export function isRemoteRequest(
  rawUrl: string,
  options: { readonly development: boolean },
): boolean {
  const url = parseUrl(rawUrl);

  if (url === null || !NETWORK_PROTOCOLS.has(url.protocol)) {
    return false;
  }

  return !(options.development && isLoopbackHost(url));
}

/** Destino de carga del renderer, ya validado. */
export type RendererTarget =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'file'; readonly filePath: string };

/**
 * Decide cómo cargar el renderer.
 *
 * `ELECTRON_RENDERER_URL` solo se acepta fuera de la versión empaquetada y si
 * apunta a loopback. En producción se ignora siempre, aunque la variable
 * apunte al propio equipo: la ventana instalada carga su HTML empaquetado con
 * `loadFile`. Cualquier otro valor también cae en `loadFile`.
 */
export function resolveRendererTarget(options: {
  readonly rendererUrl: string | undefined;
  readonly indexFile: string;
  readonly isPackaged: boolean;
}): RendererTarget {
  if (
    !options.isPackaged &&
    options.rendererUrl !== undefined &&
    isLoopbackUrl(options.rendererUrl)
  ) {
    return { kind: 'url', url: options.rendererUrl };
  }

  return { kind: 'file', filePath: options.indexFile };
}
