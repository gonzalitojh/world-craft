/**
 * Acceso al locale y a los mensajes desde Server Components y Server Actions.
 *
 * El locale se resuelve una vez por petición y se memoiza con `cache()` de
 * React: el layout, la página y las Metadata API comparten la misma lectura de
 * cookies y cabeceras. Eso hace que las rutas pasen a ser dinámicas; es
 * aceptado en el plan de M0-12 porque el idioma depende de la petición.
 */
import 'server-only';

import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import {
  availableLocales,
  getMessages,
  type Locale,
  type Messages,
} from '@/messages';
import { createTranslator, type Translator } from '@/messages/translator';

import { LOCALE_COOKIE_NAME } from './cookie';
import { createFormatters, type Formatters } from './format';
import { resolveLocale } from './locale';

/** Todo lo que necesita una pantalla de servidor para pintarse en su idioma. */
export type I18n = {
  locale: Locale;
  messages: Messages;
  t: Translator;
  format: Formatters;
  /** Idiomas que ya tienen catálogo completo y se pueden ofrecer. */
  availableLocales: readonly Locale[];
};

/**
 * Idioma de la petición actual.
 *
 * Precedencia completa: `profiles.locale` > cookie `wc-locale` >
 * `Accept-Language` > `es`. La primera fuente llega con la sesión en M1-06:
 * cuando exista, se leerá aquí y se pasará como `profileLocale` a
 * `resolveLocale`; no hay código de base de datos hasta entonces.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  return resolveLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    available: availableLocales,
  });
});

/**
 * Locale, catálogo y utilidades de formato de la petición actual.
 *
 * `t` está ligado al catálogo resuelto; un componente no necesita volver a
 * pasar el locale en cada clave.
 */
export const getI18n = cache(async (): Promise<I18n> => {
  const locale = await getLocale();
  const messages = getMessages(locale);

  return {
    locale,
    messages,
    t: createTranslator(messages),
    format: createFormatters(locale),
    availableLocales,
  };
});
