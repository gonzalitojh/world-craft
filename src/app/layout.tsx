import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { serverEnv } from '@/lib/env/server';
import { resolveSiteUrl } from '@/lib/site-url';
import { t } from '@/messages';

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

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  colorScheme: 'light dark',
  // `themeColor` se serializa como valor literal en el HTML y no admite
  // `var(--surface)`. Estos dos valores replican `--craft-paper` (#f7f2e8) y
  // `--craft-night` (#15120e) de `src/app/globals.css`: si cambian allí, hay
  // que cambiarlos aquí.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f2e8' },
    { media: '(prefers-color-scheme: dark)', color: '#15120e' },
  ],
};

/**
 * Fija el tema antes del primer pintado y lo mantiene sincronizado con la
 * preferencia del sistema. Sin JavaScript, `:root` sirve el tema claro
 * completo, así que nunca se ve una pantalla sin estilos.
 */
const themeScript = [
  '(function () {',
  '  try {',
  "    var query = window.matchMedia('(prefers-color-scheme: dark)');",
  '    var apply = function (event) {',
  "      document.documentElement.setAttribute('data-theme', event.matches ? 'dark' : 'light');",
  '    };',
  '    apply(query);',
  "    if (typeof query.addEventListener === 'function') {",
  "      query.addEventListener('change', apply);",
  '    }',
  '  } catch (error) {',
  '    // Sin matchMedia se queda el tema claro definido en :root.',
  '  }',
  '})();',
].join('\n');

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-foreground"
        >
          {t('a11y.skipToContent')}
        </a>
        <SiteHeader />
        <main id="contenido" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
