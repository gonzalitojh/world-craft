/**
 * Políticas de seguridad de contenido (CSP) de la ventana.
 *
 * La política de producción se inyecta como `<meta>` en el HTML generado y la
 * comprueba `scripts/check-build.mjs`. La de desarrollo solo se relaja para el
 * servidor de Vite y su HMR, que usan scripts y estilos en línea y conexiones
 * por loopback. Nunca se permite contenido remoto (ADR 0004).
 */

/** Directivas obligatorias que debe conservar la política de producción. */
export const REQUIRED_PRODUCTION_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: wc-asset:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
] as const;

/**
 * Política de producción: sin `unsafe-eval` ni `unsafe-inline` y sin orígenes
 * remotos. Los únicos recursos externos son los assets locales servidos por el
 * protocolo propio `wc-asset:`. `worker-src 'self'` permite el worker de
 * MapLibre emitido por Vite y `img-src ... blob:` queda reservado a las
 * previsualizaciones locales que se generen en memoria (nunca a contenido
 * remoto).
 */
export const PRODUCTION_CONTENT_SECURITY_POLICY =
  REQUIRED_PRODUCTION_DIRECTIVES.join('; ');

/**
 * Política de desarrollo: añade inline para el preámbulo de React Refresh y
 * loopback para el servidor de Vite y el WebSocket de HMR. No habilita
 * `unsafe-eval` ni permite orígenes que no sean el propio equipo.
 */
export const DEVELOPMENT_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: wc-asset:",
  "font-src 'self'",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "media-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Devuelve la CSP que corresponde al modo de ejecución. */
export function buildContentSecurityPolicy(options: {
  readonly development: boolean;
}): string {
  return options.development
    ? DEVELOPMENT_CONTENT_SECURITY_POLICY
    : PRODUCTION_CONTENT_SECURITY_POLICY;
}
