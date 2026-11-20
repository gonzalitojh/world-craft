/**
 * Composición del idioma activo para el renderer.
 *
 * Separa la creación del contexto (pura y probada sin DOM) del proveedor de
 * React. El locale viene del perfil y se resuelve con un valor de reserva, de
 * modo que un valor corrupto nunca deja la interfaz sin textos (ADR 0009).
 */
import {
  DEFAULT_LOCALE,
  resolveLocale,
  type Locale,
} from '../../shared/contracts/locale';
import { getCatalog, type MessageCatalog } from '../messages';
import { createTranslator, type Translator } from '../messages/translator';

import { createFormatters, type Formatters } from './formats';

/** Todo lo que necesita un componente para mostrar textos y formatos. */
export interface I18n {
  readonly locale: Locale;
  readonly messages: MessageCatalog;
  readonly t: Translator<MessageCatalog>;
  readonly formats: Formatters;
}

/** Construye el idioma activo; un locale no soportado cae al de reserva. */
export function createI18n(locale: unknown = DEFAULT_LOCALE): I18n {
  const resolved = resolveLocale(locale);
  const messages = getCatalog(resolved);

  return {
    locale: resolved,
    messages,
    t: createTranslator(messages),
    formats: createFormatters(resolved),
  };
}
