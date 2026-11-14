/**
 * Acceso a los mensajes de la interfaz.
 *
 * El MVP es monolingüe (español), pero la estructura ya es la del ADR 0012:
 * un catálogo por idioma, un `Locale` tipado y dos accesos, `getMessages()` y
 * `t()`. Añadir `en.ts` o `it.ts` solo exige registrarlo en `catalogs`.
 */
import { es } from './es';

/** Catálogos disponibles, indexados por idioma. */
const catalogs = { es } as const;

/** Idioma por defecto del MVP. */
export const defaultLocale = 'es' as const;

/** Idiomas con catálogo propio. */
export type Locale = keyof typeof catalogs;

/** Forma del catálogo de mensajes. */
export type Messages = (typeof catalogs)[Locale];

/**
 * Rutas con punto a cada texto: `'home.title'`, `'error.retry'`, etc.
 *
 * Se derivan del catálogo, así que una clave inexistente es un error de
 * compilación y no un texto en blanco en producción.
 */
type LeafPath<Catalog> = {
  [Key in keyof Catalog & string]: Catalog[Key] extends string
    ? Key
    : `${Key}.${LeafPath<Catalog[Key]>}`;
}[keyof Catalog & string];

/** Clave válida de un mensaje visible. */
export type MessageKey = LeafPath<Messages>;

/** Devuelve el catálogo completo del idioma indicado. */
export function getMessages(locale: Locale = defaultLocale): Messages {
  return catalogs[locale];
}

/**
 * Devuelve el texto de una clave.
 *
 * Si en tiempo de ejecución faltara el texto (por ejemplo, un catálogo futuro
 * incompleto), devuelve la propia clave en lugar de una cadena vacía: es más
 * fácil de detectar en una revisión.
 */
export function t(key: MessageKey, locale: Locale = defaultLocale): string {
  const value = key.split('.').reduce<unknown>((node, segment) => {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }

    return (node as Record<string, unknown>)[segment];
  }, getMessages(locale));

  return typeof value === 'string' ? value : key;
}
