import { describe, expect, it } from 'vitest';

import {
  SPIKE_FEATURE_COUNTS,
  SPIKE_FEATURE_SEED,
  SPIKE_FEATURE_TOTAL,
  createSpikeRandom,
  generateSpikeFeatures,
} from '@/renderer/maps-spike/feature-generator';
import { countFeaturesByLayer } from '@/renderer/maps-spike/geojson';

describe('generador determinista de features', () => {
  it('genera exactamente 500 features con el reparto aprobado', () => {
    const features = generateSpikeFeatures();

    expect(SPIKE_FEATURE_TOTAL).toBe(500);
    expect(SPIKE_FEATURE_COUNTS).toEqual({
      regions: 250,
      paths: 170,
      places: 80,
    });
    expect(features).toHaveLength(500);
    expect(countFeaturesByLayer(features)).toEqual({
      regions: 250,
      paths: 170,
      places: 80,
    });
  });

  it('es determinista para la misma semilla', () => {
    const first = generateSpikeFeatures();
    const second = generateSpikeFeatures();

    expect(second).toEqual(first);
    expect(createSpikeRandom(SPIKE_FEATURE_SEED)()).toBe(
      createSpikeRandom(SPIKE_FEATURE_SEED)(),
    );
    expect(SPIKE_FEATURE_SEED).toBe('wc-80');
  });

  it('mantiene la mezcla de modos de región y el orden de capas', () => {
    const features = generateSpikeFeatures();
    const regionModes = features
      .filter((feature) => feature.properties.layer === 'regions')
      .map((feature) => feature.properties.mode);

    expect(new Set(regionModes)).toEqual(
      new Set(['polygon', 'rectangle', 'circle']),
    );
    expect(
      features.slice(0, 250).every((f) => f.properties.layer === 'regions'),
    ).toBe(true);
    expect(
      features.slice(250, 420).every((f) => f.properties.layer === 'paths'),
    ).toBe(true);
    expect(
      features.slice(420).every((f) => f.properties.layer === 'places'),
    ).toBe(true);
  });

  it('genera geometrías válidas, cerradas y en rango', () => {
    for (const feature of generateSpikeFeatures()) {
      const { geometry } = feature;

      if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates;
        expect(Number.isFinite(lng)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
        expect(lng).toBeGreaterThanOrEqual(-180);
        expect(lng).toBeLessThanOrEqual(180);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
      } else if (geometry.type === 'LineString') {
        expect(geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(geometry.coordinates.length).toBeGreaterThanOrEqual(1);

        for (const ring of geometry.coordinates) {
          const first = ring[0];
          const last = ring[ring.length - 1];

          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(first).toEqual(last);
        }
      }
    }
  });
});
