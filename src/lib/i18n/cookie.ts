/**
 * Cookie de idioma.
 *
 * La escribe solo la Server Action `setLocale`; nunca el cliente. No contiene
 * datos personales: únicamente la etiqueta del idioma (`es`, `en`, `it`), que
 * se valida contra `LOCALES` antes de guardarla.
 */

/** Nombre de la cookie de idioma. */
export const LOCALE_COOKIE_NAME = 'wc-locale';

/** Duración de la preferencia: un año. */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type LocaleCookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge: number;
};

/**
 * Opciones de la cookie según el entorno.
 *
 * `Secure` solo en producción: en desarrollo local se sirve por HTTP y el
 * navegador descartaría la cookie.
 */
export function localeCookieOptions(secure: boolean): LocaleCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
  };
}
