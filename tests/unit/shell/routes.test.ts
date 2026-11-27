import { describe, expect, it } from 'vitest';

import {
  SETTINGS_HASH,
  isPersistedView,
  resolveAppView,
} from '@/renderer/shell/routes';

describe('rutas por hash del shell', () => {
  it('exporta el hash documentado de Ajustes', () => {
    expect(SETTINGS_HASH).toBe('#/settings');
  });

  it('resuelve Ajustes, Muestras y el laboratorio de mapas', () => {
    expect(resolveAppView(SETTINGS_HASH)).toBe('settings');
    expect(resolveAppView('#/internal/samples')).toBe('samples');
    expect(resolveAppView('#/internal/maps-spike')).toBe('maps-spike');
  });

  it('tolera mayúsculas y espacios sobrantes', () => {
    expect(resolveAppView(' #/Settings ')).toBe('settings');
    expect(resolveAppView('#/INTERNAL/SAMPLES\n')).toBe('samples');
    expect(resolveAppView('#/INTERNAL/MAPS-SPIKE\n')).toBe('maps-spike');
  });

  it('nunca persiste las vistas internas en lastView', () => {
    expect(isPersistedView('samples')).toBe(false);
    expect(isPersistedView('maps-spike')).toBe(false);
    expect(isPersistedView('home')).toBe(true);
    expect(isPersistedView('settings')).toBe(true);
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
      '#/maps-spike',
      '/settings',
      'settings',
    ]) {
      expect(resolveAppView(hash), hash).toBeNull();
    }
  });
});
