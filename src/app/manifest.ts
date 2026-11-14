import type { MetadataRoute } from 'next';

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
    // El manifest se sirve como JSON estático y no resuelve variables CSS:
    // estos valores replican `--craft-paper` (#f7f2e8) y `--craft-ink`
    // (#1f1b16) de `src/app/globals.css`. Si cambian allí, cámbialos aquí.
    background_color: '#f7f2e8',
    theme_color: '#1f1b16',
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
