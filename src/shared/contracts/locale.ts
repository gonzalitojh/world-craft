/**
 * Contrato de idioma compartido por main, preload y renderer.
 *
 * El MVP solo distribuye español. Esta lista es la única fuente de verdad: al
 * añadir un idioma se amplía `SUPPORTED_LOCALES`, se añade su catálogo en
 * `src/renderer/messages/` y su traducción de `Intl`. Ningún componente cambia
 * (ADR 0009).
 *
 * Módulo puro: no importa Electron, Node ni React.
 */

/** Idiomas con catálogo completo y revisado. */
export const SUPPORTED_LOCALES = ['es'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Idioma de reserva cuando el perfil no tiene una preferencia válida. */
export const DEFAULT_LOCALE: Locale = 'es';

/** Equivalencia entre el identificador interno y la etiqueta BCP 47 de `Intl`. */
const INTL_LOCALES: Record<Locale, string> = {
  es: 'es-ES',
};

/** Comprueba si un valor desconocido es un idioma soportado. */
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Resuelve el locale guardado en el perfil.
 *
 * Un valor ausente, corrupto o de un idioma sin traducir cae al idioma de
 * reserva; la interfaz nunca se queda sin catálogo.
 */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Etiqueta BCP 47 que se pasa a `Intl`. */
export function toIntlLocale(locale: Locale): string {
  return INTL_LOCALES[locale];
}
