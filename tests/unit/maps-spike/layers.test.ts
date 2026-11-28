import { describe, expect, it } from 'vitest';

import {
  SPIKE_LAYERS,
  SPIKE_LAYER_IDS,
  SPIKE_MODES,
  defaultModeForLayer,
  geometryMatchesLayer,
  isSpikeLayerId,
  isSpikeMode,
  layerForMode,
  modesForLayer,
  spikeLayer,
} from '@/renderer/maps-spike/layers';

describe('capas del spike', () => {
  it('define tres capas 1:1 con geometría y orden de pintado', () => {
    expect(SPIKE_LAYERS.map((layer) => layer.id)).toEqual([
      'regions',
      'paths',
      'places',
    ]);
    expect(SPIKE_LAYERS.map((layer) => layer.geometry)).toEqual([
      'Polygon',
      'LineString',
      'Point',
    ]);
    expect(SPIKE_LAYERS.map((layer) => layer.order)).toEqual([0, 1, 2]);
    expect(SPIKE_LAYER_IDS).toEqual(['regions', 'paths', 'places']);
    expect(SPIKE_MODES).toEqual([
      'polygon',
      'rectangle',
      'circle',
      'linestring',
      'point',
      'select',
    ]);
  });

  it('asigna cada modo de dibujo a una capa y deja select sin geometría', () => {
    expect(layerForMode('polygon')).toBe('regions');
    expect(layerForMode('rectangle')).toBe('regions');
    expect(layerForMode('circle')).toBe('regions');
    expect(layerForMode('linestring')).toBe('paths');
    expect(layerForMode('point')).toBe('places');
    expect(layerForMode('select')).toBeNull();
  });

  it('expone los modos y el modo por defecto de cada capa', () => {
    expect(modesForLayer('regions')).toEqual([
      'polygon',
      'rectangle',
      'circle',
    ]);
    expect(modesForLayer('paths')).toEqual(['linestring']);
    expect(modesForLayer('places')).toEqual(['point']);
    expect(defaultModeForLayer('regions')).toBe('polygon');
    expect(defaultModeForLayer('paths')).toBe('linestring');
    expect(defaultModeForLayer('places')).toBe('point');
  });

  it('valida capas, modos y compatibilidad de geometría', () => {
    expect(isSpikeLayerId('regions')).toBe(true);
    expect(isSpikeLayerId('Regions')).toBe(false);
    expect(isSpikeLayerId(null)).toBe(false);
    expect(isSpikeMode('rectangle')).toBe(true);
    expect(isSpikeMode('freehand')).toBe(false);

    expect(geometryMatchesLayer('Polygon', 'regions')).toBe(true);
    expect(geometryMatchesLayer('LineString', 'regions')).toBe(false);
    expect(geometryMatchesLayer('LineString', 'paths')).toBe(true);
    expect(geometryMatchesLayer('Point', 'places')).toBe(true);
    expect(spikeLayer('places').order).toBe(2);
  });
});
