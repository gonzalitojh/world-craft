import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { LocaleProvider } from '@/components/i18n/locale-provider';
import type { Locale } from '@/lib/i18n/locale';
import { es } from '@/messages/es';
import type { Messages } from '@/messages/translator';

/**
 * Utilidades de render para pruebas de componentes.
 *
 * Cualquier componente que pinte texto visible consume `useI18n`, así que la
 * prueba tiene que montarlo dentro de `LocaleProvider`. El locale por defecto es
 * `es` y el catálogo es el real: no hay mensajes de mentira que puedan divergir
 * de lo que ve el usuario.
 *
 * `LocaleProvider` usa `useRouter` para refrescar tras cambiar de idioma, así
 * que el test que lo monte debe mockear `next/navigation` (ver
 * `tests/unit/shell.test.tsx`).
 */

/** Idiomas con catálogo que la prueba declara disponibles. */
export const TEST_AVAILABLE_LOCALES: readonly Locale[] = ['es'];

export type I18nTestProviderProps = {
  children: ReactNode;
  locale?: Locale;
  messages?: Messages;
  availableLocales?: readonly Locale[];
};

/** Proveedor de idioma con valores de prueba. */
export function I18nTestProvider({
  children,
  locale = 'es',
  messages = es,
  availableLocales = TEST_AVAILABLE_LOCALES,
}: I18nTestProviderProps) {
  return (
    <LocaleProvider
      locale={locale}
      messages={messages}
      availableLocales={availableLocales}
    >
      {children}
    </LocaleProvider>
  );
}

export type RenderWithI18nOptions = RenderOptions & {
  locale?: Locale;
  messages?: Messages;
  availableLocales?: readonly Locale[];
};

/** `render` con el `LocaleProvider` ya montado. */
export function renderWithI18n(
  ui: ReactElement,
  {
    locale = 'es',
    messages = es,
    availableLocales = TEST_AVAILABLE_LOCALES,
    ...options
  }: RenderWithI18nOptions = {},
): RenderResult {
  return render(ui, {
    wrapper: ({ children }) => (
      <I18nTestProvider
        locale={locale}
        messages={messages}
        availableLocales={availableLocales}
      >
        {children}
      </I18nTestProvider>
    ),
    ...options,
  });
}
