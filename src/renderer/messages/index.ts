/**
 * Carga del catálogo de mensajes del renderer.
 *
 * `es.ts` es la fuente de verdad del tipo: cualquier componente que use una
 * clave inexistente falla en typecheck. El registro `CATALOGS` obliga a que
 * cada idioma soportado tenga un catálogo completo; añadir `en.ts` o `it.ts`
 * solo toca este archivo y `src/shared/contracts/locale.ts`, nunca los
 * componentes (ADR 0009).
 */
import type { Locale } from '../../shared/contracts/locale';

import { es } from './es';

export {
  DEFAULT_LOCALE,
  isLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
  toIntlLocale,
} from '../../shared/contracts/locale';
export type { Locale } from '../../shared/contracts/locale';

/**
 * Forma de un catálogo: conserva claves, firmas de función y listas, pero
 * ensancha los textos a `string` para que otro idioma pueda traducirlos sin
 * dejar de fallar si le falta una clave o un parámetro.
 */
type MessageShape<T> = T extends string
  ? string
  : T extends (...args: infer Args) => string
    ? (...args: Args) => string
    : T extends readonly (infer Item)[]
      ? readonly MessageShape<Item>[]
      : T extends object
        ? { readonly [K in keyof T]: MessageShape<T[K]> }
        : T;

/** Forma canónica de un catálogo, derivada del español. */
export type MessageCatalog = MessageShape<typeof es>;

/** Catálogos completos por idioma soportado. */
export const CATALOGS = {
  es,
} as const satisfies Record<Locale, MessageCatalog>;

/** Catálogo del idioma indicado; `Locale` garantiza que existe. */
export function getCatalog(locale: Locale): MessageCatalog {
  return CATALOGS[locale];
}
