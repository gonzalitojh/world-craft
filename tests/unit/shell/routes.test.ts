import { describe, expect, it } from 'vitest';

import { SETTINGS_HASH, resolveAppView } from '@/renderer/shell/routes';

describe('rutas por hash del shell', () => {
  it('exporta el hash documentado de Ajustes', () => {
    expect(SETTINGS_HASH).toBe('#/settings');
  });

  it('resuelve Ajustes y Muestras', () => {
    expect(resolveAppView(SETTINGS_HASH)).toBe('settings');
    expect(resolveAppView('#/internal/samples')).toBe('samples');
  });

  it('tolera mayúsculas y espacios sobrantes', () => {
    expect(resolveAppView(' #/Settings ')).toBe('settings');
    expect(resolveAppView('#/INTERNAL/SAMPLES\n')).toBe('samples');
  });

  it('devuelve null para hashes vacíos o desconocidos', () => {
    for (const hash of [
      '',
      '   ',
      '#',
      '#/',
      '#/settings/extra',
      '#/ajustes',
      '#/internal',
      '#/samples',
      '/settings',
      'settings',
    ]) {
      expect(resolveAppView(hash), hash).toBeNull();
    }
  });
});
