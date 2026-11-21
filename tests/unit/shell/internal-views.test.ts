import { describe, expect, it } from 'vitest';

import {
  INTERNAL_SAMPLES_HASH,
  resolveInternalView,
} from '@/renderer/shell/internal-views';

describe('vistas internas por hash', () => {
  it('exporta el hash documentado de Muestras', () => {
    expect(INTERNAL_SAMPLES_HASH).toBe('#/internal/samples');
  });

  it('resuelve el hash exacto de Muestras', () => {
    expect(resolveInternalView(INTERNAL_SAMPLES_HASH)).toBe('samples');
  });

  it('devuelve null con el hash vacío', () => {
    expect(resolveInternalView('')).toBeNull();
    expect(resolveInternalView('   ')).toBeNull();
  });

  it('devuelve null con otros hashes o rutas', () => {
    for (const hash of [
      '#',
      '#/',
      '#/internal',
      '#/internal/samples/otra',
      '#/samples',
      '#/internal/samples?x=1',
      '/internal/samples',
      'internal/samples',
    ]) {
      expect(resolveInternalView(hash), hash).toBeNull();
    }
  });

  it('tolera mayúsculas y espacios sobrantes', () => {
    expect(resolveInternalView(' #/Internal/Samples ')).toBe('samples');
    expect(resolveInternalView('#/INTERNAL/SAMPLES\n')).toBe('samples');
  });
});
