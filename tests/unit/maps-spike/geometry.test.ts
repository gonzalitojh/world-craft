import { describe, expect, it } from 'vitest';

import {
  countVertices,
  formatArea,
  formatCoordinate,
  formatDistance,
  haversineMeters,
  lineStringLengthMeters,
  measureFeature,
  polygonAreaSquareMeters,
  polygonPerimeterMeters,
  ringAreaSquareMeters,
} from '@/renderer/maps-spike/geometry';
import type { SpikeFeature } from '@/renderer/maps-spike/geojson';
import { createFormatters } from '@/renderer/i18n/formats';

const equatorSquare = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
] as const;

const formats = createFormatters('es');
const formatNumber = formats.formatNumber;

function feature(geometry: SpikeFeature['geometry']): SpikeFeature {
  return {
    type: 'Feature',
    geometry,
    properties: {
      mode:
        geometry.type === 'Point'
          ? 'point'
          : geometry.type === 'LineString'
            ? 'linestring'
            : 'polygon',
      layer:
        geometry.type === 'Point'
          ? 'places'
          : geometry.type === 'LineString'
            ? 'paths'
            : 'regions',
    },
  };
}

describe('geometría y medidas del spike', () => {
  it('calcula distancias haversine y longitudes de línea', () => {
    const degree = haversineMeters([0, 0], [1, 0]);

    expect(degree).toBeGreaterThan(111_000);
    expect(degree).toBeLessThan(111_400);
    expect(
      lineStringLengthMeters([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toBeCloseTo(degree * 2, 5);
    expect(lineStringLengthMeters([[0, 0]])).toBe(0);
  });

  it('calcula área esférica, agujeros y perímetro de polígonos', () => {
    const area = ringAreaSquareMeters(equatorSquare);
    const hole = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.75, 0.75],
      [0.25, 0.75],
      [0.25, 0.25],
    ] as const;
    const withHole = polygonAreaSquareMeters([equatorSquare, hole]);

    expect(area / 1_000_000).toBeCloseTo(12_364, 0);
    expect(withHole).toBeLessThan(area);
    expect(withHole).toBeGreaterThan(area * 0.7);
    expect(polygonPerimeterMeters([equatorSquare])).toBeCloseTo(444_780, -2);
  });

  it('mide features y cuenta vértices sin el cierre del anillo', () => {
    const polygon = feature({
      type: 'Polygon',
      coordinates: [
        equatorSquare,
        [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.25, 0.25],
        ],
      ],
    });
    const line = feature({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    });
    const point = feature({ type: 'Point', coordinates: [1, 2] });
    const polygonMeasure = measureFeature(polygon);

    expect(countVertices(polygon)).toBe(6);
    expect(polygonMeasure.vertices).toBe(6);
    expect(polygonMeasure.areaSquareMeters).toBeGreaterThan(0);
    expect(polygonMeasure.perimeterMeters).toBeGreaterThan(0);
    expect(measureFeature(line)).toMatchObject({
      vertices: 3,
      coordinates: null,
      lengthMeters: expect.any(Number),
      areaSquareMeters: null,
    });
    expect(measureFeature(point)).toEqual({
      vertices: 1,
      coordinates: [1, 2],
      lengthMeters: null,
      perimeterMeters: null,
      areaSquareMeters: null,
    });
  });

  it('formatea distancias, áreas y coordenadas con Intl', () => {
    expect(formatDistance(500, formatNumber)).toContain('500');
    expect(formatDistance(1500, formatNumber)).toMatch(/1,5\s?km/);
    expect(formatArea(20_000, formatNumber)).toMatch(/m/);
    expect(formatArea(2_000_000, formatNumber)).toMatch(/km/);
    expect(formatCoordinate(12.3456789, formatNumber)).toBe('12,34568');
    expect(formatCoordinate(Number.NaN, formatNumber)).toBe('0,00000');
  });
});
