import { describe, expect, it } from 'vitest';

import {
  SPIKE_GEOJSON_MAX_BYTES,
  SPIKE_GEOJSON_MAX_FEATURES,
  buildFeatureCollection,
  countFeaturesByLayer,
  createEmptyLayerFeatures,
  groupFeaturesByLayer,
  parseImportedFeatureCollection,
  parseImportedFeatureCollectionAuto,
  sanitizeStoreFeatures,
  sanitizeStoreSnapshot,
  serializeFeatureCollection,
  type SpikeFeature,
} from '@/renderer/maps-spike/geojson';

type RawFeature = Readonly<Record<string, unknown>>;

function collection(features: readonly RawFeature[]): string {
  return JSON.stringify({ type: 'FeatureCollection', features });
}

function point(
  coordinates: readonly [number, number],
  properties: Readonly<Record<string, unknown>> | null = { mode: 'point' },
): RawFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties,
  };
}

function line(coordinates: readonly (readonly [number, number])[]): RawFeature {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: { mode: 'linestring' },
  };
}

function polygon(
  ring: readonly (readonly [number, number])[],
  mode = 'polygon',
): RawFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: { mode, layer: 'paths' },
  };
}

const squareRing = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [0, 0],
] as const;

describe('GeoJSON del spike', () => {
  it('importa puntos, líneas y polígonos en su capa forzada', () => {
    const points = parseImportedFeatureCollection(
      collection([point([10.5, 20.25])]),
      'places',
    );
    const lines = parseImportedFeatureCollection(
      collection([
        line([
          [0, 0],
          [1, 1],
        ]),
      ]),
      'paths',
    );
    const regions = parseImportedFeatureCollection(
      collection([polygon(squareRing, 'rectangle')]),
      'regions',
    );

    expect(points).toMatchObject({
      ok: true,
      data: {
        skippedGuidance: 0,
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [10.5, 20.25],
            },
            properties: { mode: 'point', layer: 'places' },
          },
        ],
      },
    });
    expect(lines.ok && lines.data.features[0]?.properties).toEqual({
      mode: 'linestring',
      layer: 'paths',
    });
    expect(regions.ok && regions.data.features[0]?.properties).toEqual({
      mode: 'rectangle',
      layer: 'regions',
    });
  });

  it('impone la capa elegida y normaliza un modo ausente o de otra capa', () => {
    const missingMode = parseImportedFeatureCollection(
      collection([point([0, 0], null)]),
      'places',
    );
    const wrongMode = parseImportedFeatureCollection(
      collection([
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { mode: 'polygon', layer: 'regions' },
        },
      ]),
      'places',
    );
    const selectMode = parseImportedFeatureCollection(
      collection([
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { mode: 'select', layer: 'regions' },
        },
      ]),
      'places',
    );

    for (const result of [missingMode, wrongMode, selectMode]) {
      expect(result.ok && result.data.features[0]?.properties).toEqual({
        mode: 'point',
        layer: 'places',
      });
    }
  });

  it('descarta las propiedades del usuario y los ids', () => {
    const result = parseImportedFeatureCollection(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'usuario-123',
            geometry: { type: 'Point', coordinates: [1, 2] },
            properties: {
              mode: 'point',
              layer: 'regions',
              name: '<script>alert(1)</script>',
              color: '#ff0000',
            },
          },
        ],
      }),
      'places',
    );

    expect(result.ok && result.data.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1, 2] },
      properties: { mode: 'point', layer: 'places' },
    });
  });

  it('descarta las features de guía de Terra Draw', () => {
    const result = parseImportedFeatureCollection(
      collection([
        point([0, 0], { mode: 'midPoint' }),
        point([1, 1], { mode: 'point', currentlyDrawing: true }),
        point([2, 2], { mode: 'point', selectionPoint: true }),
        point([3, 3], { mode: 'point' }),
      ]),
      'places',
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.skippedGuidance).toBe(3);
    expect(result.ok && result.data.features).toHaveLength(1);
    expect(result.ok && result.data.features[0]?.geometry.coordinates).toEqual([
      3, 3,
    ]);
  });

  it('rechaza geometrías que no encajan con la capa', () => {
    expect(
      parseImportedFeatureCollection(collection([point([0, 0])]), 'regions'),
    ).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_LAYER_MISMATCH' },
    });
    expect(
      parseImportedFeatureCollection(
        collection([
          line([
            [0, 0],
            [1, 1],
          ]),
        ]),
        'places',
      ),
    ).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_LAYER_MISMATCH' },
    });
  });

  it('rechaza las geometrías Multi* y devuelve un código tipado', () => {
    for (const geometry of [
      { type: 'MultiPoint', coordinates: [[0, 0]] },
      {
        type: 'MultiLineString',
        coordinates: [
          [
            [0, 0],
            [1, 1],
          ],
        ],
      },
      {
        type: 'MultiPolygon',
        coordinates: [[squareRing]],
      },
    ]) {
      expect(
        parseImportedFeatureCollection(
          collection([
            {
              type: 'Feature',
              geometry,
              properties: { mode: 'point' },
            },
          ]),
          'places',
        ),
      ).toEqual({
        ok: false,
        error: { code: 'SPIKE_GEOJSON_UNSUPPORTED_GEOMETRY' },
      });
    }
  });

  it('rechaza JSON roto, colecciones ajenas y coordenadas inválidas', () => {
    const cases: readonly [string, string][] = [
      ['{', 'SPIKE_GEOJSON_INVALID_JSON'],
      ['null', 'SPIKE_GEOJSON_INVALID_COLLECTION'],
      [
        JSON.stringify({ type: 'Feature', features: [] }),
        'SPIKE_GEOJSON_INVALID_COLLECTION',
      ],
      [
        collection([
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [200, 0] },
            properties: {},
          },
        ]),
        'SPIKE_GEOJSON_INVALID_GEOMETRY',
      ],
      [
        collection([
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                ],
              ],
            },
            properties: {},
          },
        ]),
        'SPIKE_GEOJSON_INVALID_GEOMETRY',
      ],
      [
        collection([
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[0, 0]],
            },
            properties: {},
          },
        ]),
        'SPIKE_GEOJSON_INVALID_GEOMETRY',
      ],
      [
        collection([
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [null, 0] },
            properties: {},
          },
        ]),
        'SPIKE_GEOJSON_INVALID_GEOMETRY',
      ],
    ];

    for (const [text, code] of cases) {
      expect(parseImportedFeatureCollection(text, 'places')).toEqual({
        ok: false,
        error: { code },
      });
    }
  });

  it('aplica los topes de tamaño y de número de features', () => {
    expect(
      parseImportedFeatureCollection(
        'x'.repeat(SPIKE_GEOJSON_MAX_BYTES + 1),
        'places',
      ),
    ).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_TOO_LARGE' },
    });

    const tooMany = Array.from(
      { length: SPIKE_GEOJSON_MAX_FEATURES + 1 },
      (_, index) => point([index % 170, 0]),
    );

    expect(
      parseImportedFeatureCollection(collection(tooMany), 'places'),
    ).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_TOO_MANY_FEATURES' },
    });
  });

  it('acepta una colección vacía y sanea snapshots del store', () => {
    expect(
      parseImportedFeatureCollection(
        JSON.stringify({ type: 'FeatureCollection', features: [] }),
        'places',
      ),
    ).toEqual({ ok: true, data: { features: [], skippedGuidance: 0 } });

    const sanitized = sanitizeStoreFeatures(
      [
        point([1, 1], { mode: 'point', selected: true }),
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [2, 2] },
          properties: { mode: 'coordinatePoint' },
        },
      ],
      'places',
    );

    expect(sanitized.ok).toBe(true);
    expect(sanitized.ok && sanitized.data.skippedGuidance).toBe(1);
    expect(sanitized.ok && sanitized.data.features).toHaveLength(1);
  });

  it('sanea snapshots mixtos conservando capa, modo e id', () => {
    const snapshot = [
      {
        id: 'punto-1',
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: { mode: 'point', selected: true },
      },
      {
        id: 'linea-1',
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        properties: { mode: 'linestring', layer: 'paths' },
      },
      {
        id: 'poligono-1',
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [squareRing] },
        properties: { mode: 'circle', layer: 'regions' },
      },
      {
        id: 'guia-1',
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [9, 9] },
        properties: { mode: 'point', midPoint: true },
      },
    ];

    const result = sanitizeStoreSnapshot(snapshot);

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.skippedGuidance).toBe(1);
    expect(result.ok && result.data.features).toHaveLength(3);
    expect(
      result.ok &&
        result.data.features.map((item) => ({
          id: item.id,
          layer: item.properties.layer,
          mode: item.properties.mode,
        })),
    ).toEqual([
      { id: 'punto-1', layer: 'places', mode: 'point' },
      { id: 'linea-1', layer: 'paths', mode: 'linestring' },
      { id: 'poligono-1', layer: 'regions', mode: 'circle' },
    ]);
  });

  it('rechaza polígonos con agujeros porque Terra Draw no los admite', () => {
    const withHole = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              squareRing,
              [
                [0.25, 0.25],
                [0.75, 0.25],
                [0.75, 0.75],
                [0.25, 0.75],
                [0.25, 0.25],
              ],
            ],
          },
          properties: { layer: 'regions', mode: 'polygon' },
        },
      ],
    });

    expect(parseImportedFeatureCollectionAuto(withHole)).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_POLYGON_HOLES' },
    });
    expect(parseImportedFeatureCollection(withHole, 'regions')).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_POLYGON_HOLES' },
    });
  });

  it('rechaza capas desconocidas o incompatibles en una colección sin destino', () => {
    expect(
      parseImportedFeatureCollectionAuto(
        collection([
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: { layer: 'oceanos', mode: 'point' },
          },
        ]),
      ),
    ).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_INVALID_LAYER' },
    });
    expect(
      parseImportedFeatureCollectionAuto(
        collection([
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: { layer: 'regions', mode: 'point' },
          },
        ]),
      ),
    ).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_LAYER_MISMATCH' },
    });
  });

  it('importa sin capa destino usando la capa de la feature o infiriéndola', () => {
    const result = parseImportedFeatureCollectionAuto(
      collection([
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { mode: 'point' },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
          properties: { mode: 'linestring', layer: 'paths' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [squareRing] },
          properties: { layer: 'regions' },
        },
      ]),
    );

    expect(result.ok).toBe(true);
    expect(
      result.ok &&
        result.data.features.map((item) => [
          item.properties.layer,
          item.properties.mode,
        ]),
    ).toEqual([
      ['places', 'point'],
      ['paths', 'linestring'],
      ['regions', 'polygon'],
    ]);
  });

  it('es atómico: una feature inválida no devuelve ninguna', () => {
    const result = parseImportedFeatureCollectionAuto(
      collection([
        point([0, 0]),
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [200, 0] },
          properties: { mode: 'point' },
        },
      ]),
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'SPIKE_GEOJSON_INVALID_GEOMETRY' },
    });
  });

  it('construye colecciones por capa y agrupa sin perder orden', () => {
    const features: readonly SpikeFeature[] = [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [squareRing] },
        properties: { mode: 'polygon', layer: 'regions' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 1] },
        properties: { mode: 'point', layer: 'places' },
      },
    ];
    const collectionOfPlaces = buildFeatureCollection('places', features);
    const grouped = groupFeaturesByLayer(features);

    expect(collectionOfPlaces.features).toHaveLength(1);
    expect(collectionOfPlaces.features[0]?.properties.layer).toBe('places');
    expect(grouped.places).toHaveLength(1);
    expect(grouped.regions).toHaveLength(1);
    expect(grouped.paths).toHaveLength(0);
    expect(countFeaturesByLayer(features)).toEqual({
      regions: 1,
      paths: 0,
      places: 1,
    });
    expect(createEmptyLayerFeatures()).toEqual({
      regions: [],
      paths: [],
      places: [],
    });
  });

  it('hace round-trip de una colección serializada', () => {
    const original = parseImportedFeatureCollection(
      collection([point([5, 6])]),
      'places',
    );
    expect(original.ok).toBe(true);

    if (!original.ok) {
      return;
    }

    const exported = buildFeatureCollection('places', original.data.features);
    const serialized = serializeFeatureCollection(exported);
    const reimported = parseImportedFeatureCollection(serialized, 'places');

    expect(reimported).toEqual(original);
    expect(serialized.endsWith('\n')).toBe(true);
  });
});
