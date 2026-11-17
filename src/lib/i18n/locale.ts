/**
 * Idiomas soportados y resolución del locale de una petición.
 *
 * `LOCALES` es la lista canónica del producto y coincide con el CHECK de
 * `profiles.locale` (`'es'`, `'en'`, `'it'`). Que un idioma esté aquí no
 * significa que ya tenga catálogo: eso lo decide `availableLocales` en
 * `src/messages/index.ts`. Mientras no haya catálogo completo, el idioma no se
 * sirve ni se ofrece.
 *
 * Funciones puras y sin React: se prueban en `node` y las usan el servidor y
 * las pruebas.
 */

/** Idiomas admitidos por el modelo de datos. */
export const LOCALES = ['es', 'en', 'it'] as const;

/** Idioma tipado del producto. */
export type Locale = (typeof LOCALES)[number];

/** Idioma por defecto cuando ninguna fuente aporta uno válido. */
export const defaultLocale: Locale = 'es';

/** Límite defensivo para la cabecera `Accept-Language`. */
export const MAX_ACCEPT_LANGUAGE_LENGTH = 512;

/** Límite de entradas que se interpretan de `Accept-Language`. */
export const MAX_ACCEPT_LANGUAGE_ENTRIES = 20;

/** Límite de longitud de una etiqueta BCP 47 (35 según la RFC 5646). */
export const MAX_LANGUAGE_TAG_LENGTH = 35;

/** Indica si un valor es un idioma del producto. */
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
  );
}

type LanguagePreference = {
  tag: string;
  quality: number;
  index: number;
};

/**
 * Interpreta `Accept-Language` y devuelve las preferencias ordenadas.
 *
 * - Respeta q-values y el orden original en caso de empate.
 * - Descarta entradas con `q=0` (el usuario las rechaza) y con q inválida.
 * - Limita el tamaño de la cabecera, el número de entradas y la longitud de
 *   cada etiqueta para que una cabecera enorme no cueste más de la cuenta.
 */
function parseAcceptLanguage(header: string): LanguagePreference[] {
  const normalizedHeader = header.slice(0, MAX_ACCEPT_LANGUAGE_LENGTH);
  const preferences: LanguagePreference[] = [];

  normalizedHeader
    .split(',')
    .slice(0, MAX_ACCEPT_LANGUAGE_ENTRIES)
    .forEach((rawEntry, index) => {
      const [rawTag, ...parameters] = rawEntry.split(';');
      const tag = rawTag?.trim().toLowerCase() ?? '';

      if (
        tag === '' ||
        tag.length > MAX_LANGUAGE_TAG_LENGTH ||
        !/^[a-z0-9*]+(?:-[a-z0-9]+)*$/i.test(tag)
      ) {
        return;
      }

      let quality = 1;

      for (const parameter of parameters) {
        const [rawName, rawValue] = parameter.split('=');
        const name = rawName?.trim().toLowerCase();
        const value = rawValue?.trim();

        if (name !== 'q') {
          continue;
        }

        const parsedQuality = value === undefined ? Number.NaN : Number(value);

        if (
          value === undefined ||
          value === '' ||
          Number.isNaN(parsedQuality) ||
          parsedQuality < 0 ||
          parsedQuality > 1
        ) {
          return;
        }

        quality = parsedQuality;
      }

      if (quality === 0) {
        return;
      }

      preferences.push({ tag, quality, index });
    });

  return preferences.sort(
    (first, second) =>
      second.quality - first.quality || first.index - second.index,
  );
}

/**
 * Negocia el idioma de una cabecera `Accept-Language` contra los disponibles.
 *
 * Admite `*` (primer idioma disponible), etiquetas completas (`en-GB`) y
 * subtag primario (`en`). Devuelve `null` si nada coincide; quien llama decide
 * el fallback.
 */
export function negotiateLocale(
  header: string | null | undefined,
  available: readonly Locale[] = LOCALES,
): Locale | null {
  if (!header || available.length === 0) {
    return null;
  }

  const availableByLowercase = new Map(
    available.map((locale) => [locale.toLowerCase(), locale]),
  );

  for (const { tag } of parseAcceptLanguage(header)) {
    if (tag === '*') {
      return available[0] ?? null;
    }

    const exact = availableByLowercase.get(tag);

    if (exact) {
      return exact;
    }

    const primary = tag.split('-')[0];
    const match = primary ? availableByLowercase.get(primary) : undefined;

    if (match) {
      return match;
    }
  }

  return null;
}

/** Fuentes de locale de una petición, de mayor a menor precedencia. */
export type LocaleSources = {
  /** `profiles.locale`; llega con la sesión en M1-06. */
  profileLocale?: string | null | undefined;
  /** Cookie `wc-locale` escrita por la Server Action. */
  cookieLocale?: string | null | undefined;
  /** Cabecera `Accept-Language`. */
  acceptLanguage?: string | null | undefined;
  /** Idiomas que tienen catálogo completo. */
  available: readonly Locale[];
};

function usableLocale(
  value: string | null | undefined,
  available: readonly Locale[],
): Locale | null {
  if (!isLocale(value) || !available.includes(value)) {
    return null;
  }

  return value;
}

/**
 * Resuelve el idioma de una petición.
 *
 * Precedencia: `profiles.locale` (cuando exista sesión) > cookie `wc-locale` >
 * `Accept-Language` > idioma por defecto. Cada fuente se valida contra los
 * catálogos disponibles: un valor desconocido se ignora en lugar de romper.
 */
export function resolveLocale({
  profileLocale,
  cookieLocale,
  acceptLanguage,
  available,
}: LocaleSources): Locale {
  const fromProfile = usableLocale(profileLocale, available);

  if (fromProfile) {
    return fromProfile;
  }

  const fromCookie = usableLocale(cookieLocale, available);

  if (fromCookie) {
    return fromCookie;
  }

  const fromHeader = negotiateLocale(acceptLanguage, available);

  if (fromHeader) {
    return fromHeader;
  }

  return available.includes(defaultLocale)
    ? defaultLocale
    : (available[0] ?? defaultLocale);
}
