import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { LocaleProvider } from '@/components/i18n/locale-provider';
import { CommandPaletteProvider } from '@/components/shell/command-palette';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ToastProvider } from '@/components/ui/toast';
import { serverEnv } from '@/lib/env/server';
import { getI18n } from '@/lib/i18n/server';
import { resolveSiteUrl } from '@/lib/site-url';
import { createThemeScript } from '@/lib/theme';
import { THEME_COLORS } from '@/lib/theme-palette';

import './globals.css';

// Fuentes del scaffold: Fraunces para títulos, Inter para interfaz y
// JetBrains Mono para datos técnicos. `next/font` las sirve desde el propio
// dominio, sin peticiones a Google en el navegador.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  adjustFontFallback: false,
});

// El entorno se valida una vez, en el servidor, al renderizar el layout raíz.
// Un valor inválido detiene el build en lugar de romper una pantalla.
const siteUrl = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: serverEnv.NEXT_PUBLIC_SITE_URL,
  VERCEL_URL: serverEnv.VERCEL_URL,
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t('meta.title'),
      template: t('meta.titleTemplate'),
    },
    description: t('meta.description'),
    applicationName: t('meta.applicationName'),
    icons: {
      icon: '/icon.svg',
      shortcut: '/icon.svg',
    },
    manifest: '/manifest.webmanifest',
    // Aplicación privada: no debe aparecer en buscadores.
    robots: {
      index: false,
      follow: false,
    },
  };
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  // `themeColor` se serializa como valor literal en el HTML y no admite
  // `var(--surface)`. Los valores salen de `src/lib/theme-palette.ts`, que
  // replica `--craft-paper-light` y `--craft-paper-dark` de la paleta y está
  // verificado por `tests/unit/tokens.test.ts`.
  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: THEME_COLORS.light.surface,
    },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark.surface },
  ],
};

type RootLayoutProps = {
  children: ReactNode;
};

/**
 * Layout raíz.
 *
 * Solo el documento y los proveedores globales: fuentes, metadatos, script de
 * tema, tema, paleta de comandos, avisos y enlace de salto. El chrome (topbar,
 * rail, pie, barra inferior) vive en los shells de cada route group, porque la
 * web pública y el espacio de trabajo no comparten estructura.
 */
export default async function RootLayout({ children }: RootLayoutProps) {
  const { locale, messages, availableLocales, t } = await getI18n();

  return (
    <html
      lang={locale}
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        {/*
          Script de arranque: fija `data-theme` y `data-theme-preference` antes
          del primer pintado para que no haya destello del tema claro. Es
          estático (`createThemeScript`) y sin datos de usuario.

          Va como `<script>` en línea y no con `next/script`
          (`strategy="beforeInteractive"`): en esta versión de Next esa
          estrategia encola el script (`self.__next_s`) y lo ejecuta el bundle
          del framework, así que `data-theme` todavía no existe al terminar el
          parseo y el tema claro llega a pintarse. Lo cubre la prueba de
          `tests/e2e/themes.spec.ts` («el tema ya está resuelto al terminar de
          parsear el documento»).
        */}
        <script
          id="wc-theme"
          dangerouslySetInnerHTML={{ __html: createThemeScript() }}
        />
        <LocaleProvider
          locale={locale}
          messages={messages}
          availableLocales={availableLocales}
        >
          <ThemeProvider>
            <CommandPaletteProvider>
              <ToastProvider>
                <a
                  href="#contenido"
                  className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-foreground"
                >
                  {t('a11y.skipToContent')}
                </a>
                {children}
              </ToastProvider>
            </CommandPaletteProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
