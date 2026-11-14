/**
 * Resolución del origen canónico del sitio.
 *
 * Orden de preferencia:
 *
 * 1. `NEXT_PUBLIC_SITE_URL`, el dominio propio.
 * 2. `VERCEL_URL`, que Vercel inyecta en cada preview y despliegue.
 * 3. `http://localhost:3000` para el desarrollo local.
 *
 * Es una función pura: recibe la fuente y no lee `process.env` por su cuenta.
 */
export const FALLBACK_SITE_URL = 'http://localhost:3000';

/**
 * Convierte un valor en un origen `http`/`https`.
 *
 * Devuelve `null` si el valor falta, no es una URL o usa otro protocolo. La
 * comprobación es defensiva: `metadataBase` recibe el resultado y un valor
 * como `javascript:…` o el origen opaco `"null"` rompería la página.
 */
function toHttpOrigin(value: string | undefined): string | null {
  const candidate = value?.trim();

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.origin === 'null' ? null : url.origin;
  } catch {
    return null;
  }
}

export function resolveSiteUrl(
  source: Record<string, string | undefined>,
): string {
  const explicitOrigin = toHttpOrigin(source.NEXT_PUBLIC_SITE_URL);

  if (explicitOrigin) {
    return explicitOrigin;
  }

  const vercelUrl = source.VERCEL_URL?.trim();
  const vercelOrigin = vercelUrl ? toHttpOrigin(`https://${vercelUrl}`) : null;

  return vercelOrigin ?? FALLBACK_SITE_URL;
}
