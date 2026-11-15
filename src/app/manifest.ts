import type { MetadataRoute } from 'next';

import { THEME_COLORS } from '@/lib/theme-palette';
import { t } from '@/messages';

/**
 * Manifest inicial de la aplicación.
 *
 * Es deliberadamente mínimo: icons, colores de tema y nombre. La PWA completa
 * (service worker, install prompt, offline) llega en una fase posterior
 * (ADR 0009).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t('meta.applicationName'),
    short_name: t('meta.applicationName'),
    description: t('meta.manifestDescription'),
    lang: 'es',
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
