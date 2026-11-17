'use client';

/**
 * Proveedor de idioma para los componentes cliente.
 *
 * El servidor resuelve el locale una vez por petición y le pasa **solo datos
 * serializables**: idioma, catálogo y lista de idiomas disponibles. El
 * proveedor crea el traductor y los formateadores con esos datos, así que el
 * render del servidor y el del cliente parten exactamente del mismo estado.
 *
 * `setLocale` llama a la Server Action y refresca el árbol; la cookie solo la
 * escribe el servidor. No hay estado local del idioma que pueda divergir entre
 * SSR y cliente.
 */
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from 'react';

import { setLocale as setLocaleAction } from '@/lib/i18n/actions';
import { createFormatters, type Formatters } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import {
  createTranslator,
  type Messages,
  type Translator,
} from '@/messages/translator';

export type LocaleProviderProps = {
  locale: Locale;
  messages: Messages;
  availableLocales: readonly Locale[];
  children: ReactNode;
};

export type I18nContextValue = {
  locale: Locale;
  messages: Messages;
  t: Translator;
  format: Formatters;
  availableLocales: readonly Locale[];
  /** Cambia el idioma en el servidor y refresca la vista. */
  setLocale: (locale: Locale) => void;
  /** Verdadero mientras la Server Action y el refresco están en curso. */
  isPending: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({
  locale,
  messages,
  availableLocales,
  children,
}: LocaleProviderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const t = useMemo(() => createTranslator(messages), [messages]);
  const format = useMemo(() => createFormatters(locale), [locale]);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (nextLocale === locale) {
        return;
      }

      startTransition(async () => {
        const result = await setLocaleAction(nextLocale);

        if (result.ok) {
          router.refresh();
        }
      });
    },
    [locale, router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      messages,
      t,
      format,
      availableLocales,
      setLocale,
      isPending,
    }),
    [locale, messages, t, format, availableLocales, setLocale, isPending],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Acceso completo al contexto. Falla si se usa fuera del proveedor. */
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error('useI18n debe usarse dentro de <LocaleProvider>.');
  }

  return value;
}

/** Catálogo del locale actual. */
export function useMessages(): Messages {
  return useI18n().messages;
}

/** Locale actual. */
export function useLocale(): Locale {
  return useI18n().locale;
}
