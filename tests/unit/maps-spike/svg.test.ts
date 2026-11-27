import { describe, expect, it } from 'vitest';

import type { SpikeFeature } from '@/renderer/maps-spike/geojson';
import {
  serializeSpikeSvg,
  type SpikeSvgStyle,
} from '@/renderer/maps-spike/svg';

const style: SpikeSvgStyle = {
  background: '#f6f4ef',
  regionFill: '#2e5b45',
  regionFillOpacity: 0.12,
  regionStroke: '#2e5b45',
  regionStrokeWidth: 2,
  pathStroke: '#8c6d2f',
  pathStrokeWidth: 2,
  pathDashArray: '7 4',
  placeFill: '#4c6672',
  placeStroke: '#4c6672',
  placeStrokeWidth: 2,
  placeRadius: 6,
  selectionFill: '#2e5b45',
  selectionFillOpacity: 0.14,
  selectionStroke: '#2e5b45',
  selectionStrokeWidth: 3,
};

const viewport = {
  center: { lng: 0, lat: 0 },
  zoom: 0,
  width: 512,
  height: 512,
} as const;

const emptyLayers = {
  regions: [],
  paths: [],
  places: [],
} as const;

const square = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;

const hole = [
  [-0.5, -0.5],
  [-0.5, 0.5],
  [0.5, 0.5],
  [0.5, -0.5],
  [-0.5, -0.5],
] as const;

function feature(
  geometry: SpikeFeature['geometry'],
  mode: SpikeFeature['properties']['mode'],
  layer: SpikeFeature['properties']['layer'],
): SpikeFeature {
  return { type: 'Feature', geometry, properties: { mode, layer } };
}

describe('serializador SVG', () => {
  it('emite un SVG vacío válido y determinista', () => {
    const first = serializeSpikeSvg({
      width: 512,
      height: 512,
      viewport,
      layers: emptyLayers,
      style,
    });
    const second = serializeSpikeSvg({
      width: 512,
      height: 512,
      viewport,
      layers: emptyLayers,
      style,
    });

    expect(second).toEqual(first);
    expect(first.svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true,
    );
    expect(first.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(first.svg).toContain('viewBox="0 0 512 512"');
    expect(first.svg).toContain('id="layer-regions"');
    expect(first.svg).toContain('id="layer-paths"');
    expect(first.svg).toContain('id="layer-places"');
    expect(first.metadata).toEqual({
      bytes: new TextEncoder().encode(first.svg).byteLength,
      totalFeatures: 0,
      counts: { regions: 0, paths: 0, places: 0 },
      viewBox: '0 0 512 512',
    });
  });

  it('pinta puntos, líneas y polígonos en orden regions→paths→places', () => {
    const result = serializeSpikeSvg({
      width: 512,
      height: 512,
      viewport,
      layers: {
        regions: [
          feature(
            { type: 'Polygon', coordinates: [square] },
            'polygon',
            'regions',
          ),
        ],
        paths: [
          feature(
            {
              type: 'LineString',
              coordinates: [
                [-2, -2],
                [2, 2],
              ],
            },
            'linestring',
            'paths',
          ),
        ],
        places: [
          feature({ type: 'Point', coordinates: [0, 0] }, 'point', 'places'),
        ],
      },
      style,
    });

    expect(result.svg).toContain('<circle cx="256" cy="256" r="6"');
    expect(result.svg).toContain('stroke-linecap="round"');
    expect(result.svg).toContain('stroke-dasharray="7 4"');
    expect(result.svg).toContain('stroke-linejoin="round"');
    expect(result.svg).toContain('fill-rule="evenodd"');
    expect(result.svg.indexOf('id="layer-regions"')).toBeLessThan(
      result.svg.indexOf('id="layer-paths"'),
    );
    expect(result.svg.indexOf('id="layer-paths"')).toBeLessThan(
      result.svg.indexOf('id="layer-places"'),
    );
    expect(result.metadata.counts).toEqual({
      regions: 1,
      paths: 1,
      places: 1,
    });
    expect(result.metadata.totalFeatures).toBe(3);
  });

  it('dibuja agujeros en un único path con evenodd', () => {
    const result = serializeSpikeSvg({
      width: 512,
      height: 512,
      viewport,
      layers: {
        ...emptyLayers,
        regions: [
          feature(
            {
              type: 'Polygon',
              coordinates: [square, hole],
            },
            'polygon',
            'regions',
          ),
        ],
      },
      style,
    });
    const path = result.svg.match(/<path d="([^"]+)"/)?.[1] ?? '';

    expect(path.match(/M /g)).toHaveLength(2);
    expect(path.match(/Z/g)).toHaveLength(2);
    expect(result.metadata.counts.regions).toBe(1);
  });

  it('pinta la selección con relleno al 14 % y guías propias', () => {
    const result = serializeSpikeSvg({
      width: 512,
      height: 512,
      viewport,
      layers: {
        ...emptyLayers,
        regions: [
          {
            ...feature(
              { type: 'Polygon', coordinates: [square] },
              'polygon',
              'regions',
            ),
            id: 'region-1',
          },
        ],
        paths: [
          {
            ...feature(
              {
                type: 'LineString',
                coordinates: [
                  [-2, -2],
                  [2, 2],
                ],
              },
              'linestring',
              'paths',
            ),
            id: 'path-1',
          },
        ],
        places: [
          {
            ...feature(
              { type: 'Point', coordinates: [0, 0] },
              'point',
              'places',
            ),
            id: 'place-1',
          },
        ],
      },
      style,
      selectedIds: ['region-1', 'path-1', 'place-1'],
    });

    expect(result.svg).toContain('fill-opacity="0.14"');
    expect(result.svg).toContain('stroke-width="3"');
    expect(result.svg).not.toContain('stroke-dasharray');
    expect(result.svg.match(/<circle/g)).toHaveLength(3);
  });

  it('escapa colores y no incluye propiedades ni etiquetas', () => {
    const result = serializeSpikeSvg({
      width: 512,
      height: 512,
      viewport,
      layers: {
        ...emptyLayers,
        places: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {
              mode: 'point',
              layer: 'places',
              name: '<script>alert("x")</script>',
            },
          } as unknown as SpikeFeature,
        ],
      },
      style: { ...style, placeFill: 'red" onload="alert(1)' },
    });

    expect(result.svg).not.toContain('<script>');
    expect(result.svg).not.toContain(' onload="');
    expect(result.svg).toContain('&quot;');
    expect(result.svg).not.toContain('name=');
  });

  it('omite coordenadas inválidas y dimensiones absurdas sin lanzar', () => {
    const result = serializeSpikeSvg({
      width: Number.NaN,
      height: -10,
      viewport,
      layers: {
        ...emptyLayers,
        places: [
          feature(
            { type: 'Point', coordinates: [Number.NaN, 0] },
            'point',
            'places',
          ),
          feature({ type: 'Point', coordinates: [200, 0] }, 'point', 'places'),
        ],
      },
      style,
    });

    expect(result.svg).toContain('width="1" height="1"');
    expect(result.metadata.totalFeatures).toBe(0);
    expect(() =>
      serializeSpikeSvg({
        width: 512,
        height: 512,
        viewport,
        layers: {
          ...emptyLayers,
          regions: [
            feature(
              {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [Number.POSITIVE_INFINITY, 0],
                    [0, 1],
                    [0, 0],
                  ],
                ],
              },
              'polygon',
              'regions',
            ),
          ],
        },
        style,
      }),
    ).not.toThrow();
  });
});
