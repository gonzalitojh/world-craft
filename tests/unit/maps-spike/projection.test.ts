import { describe, expect, it } from 'vitest';

import type { SpikeFeature } from '@/renderer/maps-spike/geojson';
import {
  MAX_MERCATOR_LATITUDE,
  SPIKE_MAX_ZOOM,
  SPIKE_TILE_SIZE,
  clampMercatorLatitude,
  computeFeaturesBounds,
  fitBoundsToViewport,
  lngLatToWorld,
  normalizeProjectedNumber,
  projectToViewport,
  unprojectFromViewport,
  worldSize,
  worldToLngLat,
} from '@/renderer/maps-spike/projection';

const viewport = {
  center: { lng: 8, lat: 26 },
  zoom: 4,
  width: 1024,
  height: 700,
} as const;

describe('proyección Web Mercator', () => {
  it('usa teselas de 512 px y crece con el zoom', () => {
    expect(SPIKE_TILE_SIZE).toBe(512);
    expect(worldSize(0)).toBe(512);
    expect(worldSize(1)).toBe(1024);
    expect(worldSize(4)).toBe(8192);
  });

  it('proyecta el origen y los extremos de longitud', () => {
    expect(lngLatToWorld({ lng: 0, lat: 0 })).toEqual({ x: 256, y: 256 });
    expect(lngLatToWorld({ lng: -180, lat: 0 })).toEqual({ x: 0, y: 256 });
    expect(lngLatToWorld({ lng: 180, lat: 0 })).toEqual({ x: 512, y: 256 });
  });

  it('limita la latitud y evita -0', () => {
    expect(clampMercatorLatitude(90)).toBe(MAX_MERCATOR_LATITUDE);
    expect(clampMercatorLatitude(-90)).toBe(-MAX_MERCATOR_LATITUDE);
    expect(clampMercatorLatitude(Number.NaN)).toBe(0);
    expect(lngLatToWorld({ lng: 0, lat: 90 }).y).toBe(0);
    expect(normalizeProjectedNumber(-0)).toBe(0);
    expect(Object.is(normalizeProjectedNumber(-0), -0)).toBe(false);
  });

  it('hace ida y vuelta entre lng/lat y mundo', () => {
    for (const position of [
      { lng: 0, lat: 0 },
      { lng: 8, lat: 26 },
      { lng: -179.5, lat: -84 },
      { lng: 179.5, lat: 84 },
    ]) {
      const world = lngLatToWorld(position, 6);
      const back = worldToLngLat(world, 6);

      expect(back.lng).toBeCloseTo(position.lng, 8);
      expect(back.lat).toBeCloseTo(position.lat, 8);
    }
  });

  it('proyecta al viewport actual y desproyecta', () => {
    const center = projectToViewport(viewport.center, viewport);
    const east = projectToViewport({ lng: 9, lat: 26 }, viewport);
    const north = projectToViewport({ lng: 8, lat: 27 }, viewport);

    expect(center.x).toBeCloseTo(512, 8);
    expect(center.y).toBeCloseTo(350, 8);
    expect(east.x).toBeGreaterThan(center.x);
    expect(north.y).toBeLessThan(center.y);

    const roundTrip = unprojectFromViewport(
      projectToViewport({ lng: 8.5, lat: 25.5 }, viewport),
      viewport,
    );

    expect(roundTrip.lng).toBeCloseTo(8.5, 8);
    expect(roundTrip.lat).toBeCloseTo(25.5, 8);
  });

  it('calcula bounds de todas las geometrías y las ignora inválidas', () => {
    const features: readonly SpikeFeature[] = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2, 3] },
        properties: { mode: 'point', layer: 'places' },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-1, -2],
            [4, 5],
          ],
        },
        properties: { mode: 'linestring', layer: 'paths' },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-3, 0],
              [6, 0],
              [6, 7],
              [-3, 7],
              [-3, 0],
            ],
          ],
        },
        properties: { mode: 'polygon', layer: 'regions' },
      },
    ];

    expect(computeFeaturesBounds(features)).toEqual({
      minLng: -3,
      minLat: -2,
      maxLng: 6,
      maxLat: 7,
    });
    expect(computeFeaturesBounds([])).toBeNull();
  });

  it('encaja los bounds con padding y respeta los límites de zoom', () => {
    const bounds = {
      minLng: -10,
      minLat: 10,
      maxLng: 20,
      maxLat: 40,
    };
    const fitted = fitBoundsToViewport(bounds, 1024, 700, 32);

    expect(fitted).not.toBeNull();

    if (fitted === null) {
      return;
    }

    expect(fitted.zoom).toBeGreaterThan(0);
    expect(fitted.zoom).toBeLessThanOrEqual(SPIKE_MAX_ZOOM);
    expect(fitted.center.lng).toBeCloseTo(5, 1);
    expect(fitted.center.lat).toBeCloseTo(26.4, 0);

    const fittedViewport = {
      center: fitted.center,
      zoom: fitted.zoom,
      width: 1024,
      height: 700,
    };
    const corners = [
      { lng: bounds.minLng, lat: bounds.minLat },
      { lng: bounds.maxLng, lat: bounds.minLat },
      { lng: bounds.minLng, lat: bounds.maxLat },
      { lng: bounds.maxLng, lat: bounds.maxLat },
    ];

    for (const corner of corners) {
      const point = projectToViewport(corner, fittedViewport);

      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1024);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(700);
    }

    expect(fitBoundsToViewport(null, 1024, 700)).toBeNull();
    expect(
      fitBoundsToViewport(
        { minLng: Number.NaN, minLat: 0, maxLng: 1, maxLat: 1 },
        1024,
        700,
      ),
    ).toBeNull();
  });
});
