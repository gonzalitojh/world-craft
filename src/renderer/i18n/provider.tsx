/**
 * Proveedor de idioma del renderer.
 *
 * Los componentes leen textos y formatos con `useI18n` o `useMessages`; no
 * importan `es.ts` directamente. Añadir un idioma es registrar su catálogo y
 * pasar el locale del perfil a este proveedor, sin tocar componentes.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_LOCALE, type Locale } from '../../shared/contracts/locale';
import type { MessageCatalog } from '../messages';

import { createI18n, type I18n } from './create';

const I18nContext = createContext<I18n | null>(null);

export interface I18nProviderProps {
  /** Locale del perfil; si falta o no es válido se usa el de reserva. */
  readonly locale?: Locale;
  readonly children: ReactNode;
}

export function I18nProvider({
  locale = DEFAULT_LOCALE,
  children,
}: I18nProviderProps) {
  const value = useMemo(() => createI18n(locale), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Acceso completo a textos, traductor y formatos del idioma activo. */
export function useI18n(): I18n {
  const value = useContext(I18nContext);

  if (value === null) {
    throw new Error('useI18n debe usarse dentro de I18nProvider.');
  }

  return value;
}

/** Atajo para componentes que solo necesitan el catálogo. */
export function useMessages(): MessageCatalog {
  return useI18n().messages;
}
