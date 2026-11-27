import { describe, expect, it } from 'vitest';

import {
  INTERNAL_MAPS_SPIKE_HASH,
  INTERNAL_SAMPLES_HASH,
  resolveInternalView,
} from '@/renderer/shell/internal-views';

describe('vistas internas por hash', () => {
  it('exporta los hashes documentados de Muestras y del laboratorio de mapas', () => {
    expect(INTERNAL_SAMPLES_HASH).toBe('#/internal/samples');
    expect(INTERNAL_MAPS_SPIKE_HASH).toBe('#/internal/maps-spike');
  });

  it('resuelve los hashes exactos de las vistas internas', () => {
    expect(resolveInternalView(INTERNAL_SAMPLES_HASH)).toBe('samples');
    expect(resolveInternalView(INTERNAL_MAPS_SPIKE_HASH)).toBe('maps-spike');
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
      '#/internal/maps-spike/otra',
      '#/samples',
      '#/maps-spike',
      '#/internal/samples?x=1',
      '#/internal/maps-spike?x=1',
      '/internal/samples',
      'internal/maps-spike',
    ]) {
      expect(resolveInternalView(hash), hash).toBeNull();
    }
  });

  it('tolera mayúsculas y espacios sobrantes', () => {
    expect(resolveInternalView(' #/Internal/Samples ')).toBe('samples');
    expect(resolveInternalView('#/INTERNAL/SAMPLES\n')).toBe('samples');
    expect(resolveInternalView(' #/Internal/Maps-Spike ')).toBe('maps-spike');
    expect(resolveInternalView('#/INTERNAL/MAPS-SPIKE\n')).toBe('maps-spike');
  });
});
