import type { MetadataRoute } from 'next';

import { defaultLocale } from '@/lib/i18n/locale';
import { THEME_COLORS } from '@/lib/theme-palette';
import { getMessages } from '@/messages';

/**
 * Manifest inicial de la aplicación.
 *
 * Es deliberadamente mínimo: icons, colores de tema y nombre. La PWA completa
 * (service worker, install prompt, offline) llega en una fase posterior
 * (ADR 0009). El manifest es un recurso estático: no negocia `Accept-Language`
 * y usa el catálogo base y el idioma por defecto.
 */
export default function manifest(): MetadataRoute.Manifest {
  const messages = getMessages();

  return {
    name: messages.meta.applicationName,
    short_name: messages.meta.applicationName,
    description: messages.meta.manifestDescription,
    lang: defaultLocale,
    start_url: '/',
    display: 'standalone',
    // El manifest se sirve como JSON estático y no resuelve variables CSS: los
    // valores salen de `src/lib/theme-palette.ts`, que replica la paleta y está
    // verificado por `tests/unit/tokens.test.ts`.
    background_color: THEME_COLORS.light.surface,
    theme_color: THEME_COLORS.light.ink,
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
