import 'server-only';

/**
 * Acceso a los mensajes de la interfaz en el servidor.
 *
 * El MVP es monolingüe (español), pero el registro ya es el del ADR 0012: un
 * catálogo por idioma, un `Locale` tipado y acceso por locale. Añadir `en.ts` o
 * `it.ts` solo exige registrarlo en `catalogs` cuando esté completo; no se
 * crean stubs ni se resuelven claves sueltas contra el español.
 *
 * Los componentes cliente **no deben importar valores de este módulo**: el
 * catálogo no viaja en su bundle. Reciben `locale` y `messages` del
 * `LocaleProvider` y crean su traductor con `createTranslator`.
 */
import { defaultLocale, LOCALES, type Locale } from '@/lib/i18n/locale';

import { es } from './es';
import {
  createTranslator,
  type MessageKey,
  type Messages,
  type Translator,
} from './translator';

export type { Locale, MessageKey, Messages, Translator };

/** Catálogos registrados, indexados por idioma. */
export const catalogs: Partial<Record<Locale, Messages>> = { es };

/**
 * Idiomas con catálogo propio y completo.
 *
 * `LOCALES` refleja el CHECK de `profiles.locale` (incluye idiomas todavía sin
 * catálogo); esta lista solo contiene los que ya se pueden servir.
 */
export const availableLocales: readonly Locale[] = LOCALES.filter(
  (locale) => catalogs[locale] !== undefined,
);

/** Traductores memoizados por idioma para no recorrer la ruta en cada texto. */
const translators = new Map<Locale, Translator>();

function translatorFor(locale: Locale): Translator {
  const cached = translators.get(locale);

  if (cached) {
    return cached;
  }

  const translator = createTranslator(getMessages(locale));
  translators.set(locale, translator);

  return translator;
}

/**
 * Devuelve el catálogo completo del idioma indicado.
 *
 * Si el idioma aún no tiene catálogo, usa el catálogo base. Así una cookie o
 * una cabecera manipuladas nunca dejan la interfaz sin texto; la validación de
 * disponibilidad se hace antes, en `resolveLocale` y en la Server Action.
 */
export function getMessages(locale: Locale = defaultLocale): Messages {
  return catalogs[locale] ?? es;
}

/** Devuelve el texto de una clave en el idioma indicado. */
export function t(key: MessageKey, locale: Locale = defaultLocale): string {
  return translatorFor(locale)(key);
}
