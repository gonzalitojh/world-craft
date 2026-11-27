/**
 * GeoJSON pure del spike de mapas (#80).
 *
 * Valida lo que entra (texto o snapshot del adaptador), descarta las features
 * de guía de Terra Draw, sanea las propiedades y fuerza la capa elegida. Nunca
 * lanza por datos del usuario: devuelve un error tipado.
 *
 * Límites: 5 MiB de texto y 2.000 features. Las geometrías `MultiPoint`,
 * `MultiLineString`, `MultiPolygon` y `GeometryCollection` se rechazan en v1;
 * el editor dibuja una geometría simple por feature. Los polígonos con agujeros
 * también se rechazan al importar (Terra Draw no los admite), aunque el
 * serializador SVG puro sepa pintarlos.
 */
import { z } from 'zod';

import {
  defaultModeForLayer,
  geometryMatchesLayer,
  isSpikeLayerId,
  isSpikeMode,
  modesForLayer,
  SPIKE_LAYER_IDS,
  type SpikeLayerId,
  type SpikeMode,
} from './layers';

/** Texto máximo admitido antes de parsear JSON (5 MiB). */
export const SPIKE_GEOJSON_MAX_BYTES = 5 * 1024 * 1024;

/** Features máximas por colección importada. */
export const SPIKE_GEOJSON_MAX_FEATURES = 2000;

/** Modos que Terra Draw usa para features de guía, nunca para datos. */
export const SPIKE_GUIDANCE_MODES = Object.freeze([
  'midPoint',
  'selectionPoint',
  'coordinatePoint',
  'snappingPoint',
  'closingPoint',
] as const);

/** Propiedades derivadas del adaptador que no se exportan. */
export const SPIKE_DERIVED_PROPERTY_KEYS = Object.freeze([
  'selected',
  'selectionPoint',
  'midPoint',
  'coordinatePoint',
  'snappingPoint',
  'closingPoint',
  'currentlyDrawing',
  'edited',
] as const);

/** Posición GeoJSON `[longitud, latitud]`. */
export type SpikePosition = readonly [number, number];

/** Punto GeoJSON. */
export interface SpikePointGeometry {
  readonly type: 'Point';
  readonly coordinates: SpikePosition;
}

/** Línea GeoJSON. */
export interface SpikeLineStringGeometry {
  readonly type: 'LineString';
  readonly coordinates: readonly SpikePosition[];
}

/** Anillo de polígono cerrado. */
export type SpikeLinearRing = readonly SpikePosition[];

/** Polígono GeoJSON con un anillo exterior y cero o más agujeros. */
export interface SpikePolygonGeometry {
  readonly type: 'Polygon';
  readonly coordinates: readonly SpikeLinearRing[];
}

/** Geometrías admitidas. */
export type SpikeGeometry =
  SpikePointGeometry | SpikeLineStringGeometry | SpikePolygonGeometry;

/** Propiedades saneadas de una feature del spike. */
export interface SpikeFeatureProperties {
  readonly mode: SpikeMode;
  readonly layer: SpikeLayerId;
}

/** Feature del spike, sin propiedades del usuario. */
export interface SpikeFeature {
  readonly type: 'Feature';
  /** Identificador interno del store; no se exporta a GeoJSON. */
  readonly id?: string;
  readonly geometry: SpikeGeometry;
  readonly properties: SpikeFeatureProperties;
}

/** Colección GeoJSON del spike. */
export interface SpikeFeatureCollection {
  readonly type: 'FeatureCollection';
  readonly features: readonly SpikeFeature[];
}

/** Códigos estables de error de importación. */
export type SpikeGeoJsonErrorCode =
  | 'SPIKE_GEOJSON_INVALID_INPUT'
  | 'SPIKE_GEOJSON_TOO_LARGE'
  | 'SPIKE_GEOJSON_INVALID_JSON'
  | 'SPIKE_GEOJSON_TOO_MANY_FEATURES'
  | 'SPIKE_GEOJSON_INVALID_COLLECTION'
  | 'SPIKE_GEOJSON_UNSUPPORTED_GEOMETRY'
  | 'SPIKE_GEOJSON_INVALID_GEOMETRY'
  | 'SPIKE_GEOJSON_POLYGON_HOLES'
  | 'SPIKE_GEOJSON_INVALID_LAYER'
  | 'SPIKE_GEOJSON_LAYER_MISMATCH';

/** Resultado tipado de una operación GeoJSON. */
export type SpikeGeoJsonResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: { readonly code: SpikeGeoJsonErrorCode };
    };

/** Resumen de una importación o saneado. */
export interface SpikeFeatureParseResult {
  readonly features: readonly SpikeFeature[];
  readonly skippedGuidance: number;
}

const positionSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);

const pointGeometrySchema = z.strictObject({
  type: z.literal('Point'),
  coordinates: positionSchema,
});

const lineStringGeometrySchema = z.strictObject({
  type: z.literal('LineString'),
  coordinates: z.array(positionSchema).min(2),
});

const linearRingSchema = z
  .array(positionSchema)
  .min(4)
  .refine(isClosedRing, { message: 'El anillo no está cerrado.' })
  .refine(hasThreeDistinctPositions, {
    message: 'El anillo no tiene tres vértices distintos.',
  });

const polygonGeometrySchema = z.strictObject({
  type: z.literal('Polygon'),
  coordinates: z.array(linearRingSchema).min(1),
});

const collectionEnvelopeSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.unknown()),
});

const featureEnvelopeSchema = z.object({
  type: z.literal('Feature'),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: z
    .object({
      type: z.string(),
      coordinates: z.unknown(),
    })
    .nullable(),
  properties: z.record(z.string(), z.unknown()).nullish(),
});

const GUIDANCE_MODE_SET: ReadonlySet<string> = new Set(SPIKE_GUIDANCE_MODES);

function isClosedRing(ring: readonly SpikePosition[]): boolean {
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first === undefined || last === undefined) {
    return false;
  }

  return (
    Math.abs(first[0] - last[0]) <= 1e-9 && Math.abs(first[1] - last[1]) <= 1e-9
  );
}

function hasThreeDistinctPositions(ring: readonly SpikePosition[]): boolean {
  const seen = new Set<string>();

  for (const position of ring) {
    seen.add(`${position[0]},${position[1]}`);

    if (seen.size >= 3) {
      return true;
    }
  }

  return false;
}

function ok<T>(data: T): SpikeGeoJsonResult<T> {
  return { ok: true, data };
}

function fail(code: SpikeGeoJsonErrorCode): SpikeGeoJsonResult<never> {
  return { ok: false, error: { code } };
}

function isGuidanceFeature(
  properties: Readonly<Record<string, unknown>>,
): boolean {
  const mode = properties.mode;

  if (typeof mode === 'string' && GUIDANCE_MODE_SET.has(mode)) {
    return true;
  }

  if (properties.currentlyDrawing === true) {
    return true;
  }

  return SPIKE_DERIVED_PROPERTY_KEYS.some(
    (key) =>
      key !== 'selected' &&
      key !== 'edited' &&
      properties[key] !== undefined &&
      properties[key] !== false &&
      properties[key] !== null,
  );
}

function normalizeMode(layer: SpikeLayerId, rawMode: unknown): SpikeMode {
  if (isSpikeMode(rawMode) && modesForLayer(layer).includes(rawMode)) {
    return rawMode;
  }

  return defaultModeForLayer(layer);
}

function inferLayerForGeometry(geometry: SpikeGeometry['type']): SpikeLayerId {
  if (geometry === 'Polygon') {
    return 'regions';
  }

  if (geometry === 'LineString') {
    return 'paths';
  }

  return 'places';
}

function resolveLayer(
  rawLayer: unknown,
  geometry: SpikeGeometry['type'],
  targetLayer: SpikeLayerId | null,
): SpikeGeoJsonResult<SpikeLayerId> {
  if (targetLayer !== null) {
    return geometryMatchesLayer(geometry, targetLayer)
      ? ok(targetLayer)
      : fail('SPIKE_GEOJSON_LAYER_MISMATCH');
  }

  if (rawLayer !== undefined) {
    if (!isSpikeLayerId(rawLayer)) {
      return fail('SPIKE_GEOJSON_INVALID_LAYER');
    }

    if (!geometryMatchesLayer(geometry, rawLayer)) {
      return fail('SPIKE_GEOJSON_LAYER_MISMATCH');
    }

    return ok(rawLayer);
  }

  return ok(inferLayerForGeometry(geometry));
}

function normalizeRawFeatures(
  rawFeatures: readonly unknown[],
  targetLayer: SpikeLayerId | null,
  preserveIds: boolean,
): SpikeGeoJsonResult<SpikeFeatureParseResult> {
  const features: SpikeFeature[] = [];
  let skippedGuidance = 0;

  for (const rawFeature of rawFeatures) {
    const envelope = featureEnvelopeSchema.safeParse(rawFeature);

    if (!envelope.success) {
      return fail('SPIKE_GEOJSON_INVALID_COLLECTION');
    }

    const properties = envelope.data.properties ?? {};

    if (isGuidanceFeature(properties)) {
      skippedGuidance += 1;
      continue;
    }

    const rawGeometry = envelope.data.geometry;

    if (rawGeometry === null) {
      return fail('SPIKE_GEOJSON_INVALID_GEOMETRY');
    }

    if (
      rawGeometry.type === 'MultiPoint' ||
      rawGeometry.type === 'MultiLineString' ||
      rawGeometry.type === 'MultiPolygon' ||
      rawGeometry.type === 'GeometryCollection'
    ) {
      return fail('SPIKE_GEOJSON_UNSUPPORTED_GEOMETRY');
    }

    let geometry: SpikeGeometry;

    if (rawGeometry.type === 'Point') {
      const parsed = pointGeometrySchema.safeParse(rawGeometry);

      if (!parsed.success) {
        return fail('SPIKE_GEOJSON_INVALID_GEOMETRY');
      }

      geometry = parsed.data;
    } else if (rawGeometry.type === 'LineString') {
      const parsed = lineStringGeometrySchema.safeParse(rawGeometry);

      if (!parsed.success) {
        return fail('SPIKE_GEOJSON_INVALID_GEOMETRY');
      }

      geometry = parsed.data;
    } else if (rawGeometry.type === 'Polygon') {
      const parsed = polygonGeometrySchema.safeParse(rawGeometry);

      if (!parsed.success) {
        return fail('SPIKE_GEOJSON_INVALID_GEOMETRY');
      }

      if (parsed.data.coordinates.length > 1) {
        // Terra Draw 1 no admite agujeros en polígonos; se rechazan antes de
        // tocar el store para que la importación siga siendo atómica.
        return fail('SPIKE_GEOJSON_POLYGON_HOLES');
      }

      geometry = parsed.data;
    } else {
      return fail('SPIKE_GEOJSON_UNSUPPORTED_GEOMETRY');
    }

    const layer = resolveLayer(properties.layer, geometry.type, targetLayer);

    if (!layer.ok) {
      return layer;
    }

    const resolvedLayer = layer.data;
    const rawId = envelope.data.id;
    const id =
      preserveIds &&
      (typeof rawId === 'string' ||
        (typeof rawId === 'number' && Number.isFinite(rawId)))
        ? String(rawId)
        : undefined;

    features.push({
      type: 'Feature',
      ...(id === undefined ? {} : { id }),
      geometry,
      properties: {
        mode: normalizeMode(resolvedLayer, properties.mode),
        layer: resolvedLayer,
      },
    });
  }

  return ok({ features, skippedGuidance });
}

/**
 * Parsea una `FeatureCollection` importada y la asigna a una capa.
 *
 * El `layer` del archivo se ignora: manda la capa elegida. El `mode` se
 * conserva si pertenece a esa capa y, si falta o no encaja, se normaliza al
 * modo por defecto. Las propiedades del usuario se descartan.
 */
export function parseImportedFeatureCollection(
  text: string,
  targetLayer: SpikeLayerId,
): SpikeGeoJsonResult<SpikeFeatureParseResult> {
  if (typeof text !== 'string' || !isSpikeLayerId(targetLayer)) {
    return fail('SPIKE_GEOJSON_INVALID_INPUT');
  }

  if (new TextEncoder().encode(text).byteLength > SPIKE_GEOJSON_MAX_BYTES) {
    return fail('SPIKE_GEOJSON_TOO_LARGE');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('SPIKE_GEOJSON_INVALID_JSON');
  }

  const collection = collectionEnvelopeSchema.safeParse(parsed);

  if (!collection.success) {
    return fail('SPIKE_GEOJSON_INVALID_COLLECTION');
  }

  if (collection.data.features.length > SPIKE_GEOJSON_MAX_FEATURES) {
    return fail('SPIKE_GEOJSON_TOO_MANY_FEATURES');
  }

  return normalizeRawFeatures(collection.data.features, targetLayer, false);
}

/**
 * Parsea una `FeatureCollection` sin capa objetivo.
 *
 * Usa `properties.layer` si existe y es compatible; si falta, la infiere por
 * geometría. Una capa desconocida o incompatible invalida la colección entera
 * (importación atómica).
 */
export function parseImportedFeatureCollectionAuto(
  text: string,
): SpikeGeoJsonResult<SpikeFeatureParseResult> {
  if (typeof text !== 'string') {
    return fail('SPIKE_GEOJSON_INVALID_INPUT');
  }

  if (new TextEncoder().encode(text).byteLength > SPIKE_GEOJSON_MAX_BYTES) {
    return fail('SPIKE_GEOJSON_TOO_LARGE');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('SPIKE_GEOJSON_INVALID_JSON');
  }

  const collection = collectionEnvelopeSchema.safeParse(parsed);

  if (!collection.success) {
    return fail('SPIKE_GEOJSON_INVALID_COLLECTION');
  }

  if (collection.data.features.length > SPIKE_GEOJSON_MAX_FEATURES) {
    return fail('SPIKE_GEOJSON_TOO_MANY_FEATURES');
  }

  return normalizeRawFeatures(collection.data.features, null, false);
}

/**
 * Sanea un snapshot del store de Terra Draw.
 *
 * Se usa al terminar una edición o antes de exportar: descarta guías, fuerza
 * la capa y deja solo `mode` y `layer`.
 */
export function sanitizeStoreFeatures(
  rawFeatures: readonly unknown[],
  targetLayer: SpikeLayerId,
): SpikeGeoJsonResult<SpikeFeatureParseResult> {
  if (!Array.isArray(rawFeatures) || !isSpikeLayerId(targetLayer)) {
    return fail('SPIKE_GEOJSON_INVALID_INPUT');
  }

  if (rawFeatures.length > SPIKE_GEOJSON_MAX_FEATURES) {
    return fail('SPIKE_GEOJSON_TOO_MANY_FEATURES');
  }

  return normalizeRawFeatures(rawFeatures, targetLayer, false);
}

/**
 * Sanea un snapshot mixto del store de Terra Draw.
 *
 * No fuerza una capa: conserva la de cada feature y la infiere por geometría
 * cuando falta. Mantiene el id interno para la selección y el SVG; las
 * propiedades derivadas se descartan.
 */
export function sanitizeStoreSnapshot(
  rawFeatures: readonly unknown[],
): SpikeGeoJsonResult<SpikeFeatureParseResult> {
  if (!Array.isArray(rawFeatures)) {
    return fail('SPIKE_GEOJSON_INVALID_INPUT');
  }

  if (rawFeatures.length > SPIKE_GEOJSON_MAX_FEATURES) {
    return fail('SPIKE_GEOJSON_TOO_MANY_FEATURES');
  }

  return normalizeRawFeatures(rawFeatures, null, true);
}

/** Construye la colección exportable de una capa, forzando capa y modo. */
export function buildFeatureCollection(
  layer: SpikeLayerId,
  features: readonly SpikeFeature[],
): SpikeFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features
      .filter((feature) => geometryMatchesLayer(feature.geometry.type, layer))
      .map((feature) => ({
        type: 'Feature' as const,
        geometry: feature.geometry,
        properties: {
          mode: normalizeMode(layer, feature.properties.mode),
          layer,
        },
      })),
  };
}

/** Agrupa features ya saneadas por su capa, conservando el orden. */
export function groupFeaturesByLayer(
  features: readonly SpikeFeature[],
): Readonly<Record<SpikeLayerId, readonly SpikeFeature[]>> {
  const groups: Record<SpikeLayerId, SpikeFeature[]> = {
    regions: [],
    paths: [],
    places: [],
  };

  for (const feature of features) {
    groups[feature.properties.layer].push(feature);
  }

  return groups;
}

/** Estructura vacía para las tres capas. */
export function createEmptyLayerFeatures(): Readonly<
  Record<SpikeLayerId, readonly SpikeFeature[]>
> {
  return { regions: [], paths: [], places: [] };
}

/** Cuenta features por capa. */
export function countFeaturesByLayer(
  features: readonly SpikeFeature[],
): Readonly<Record<SpikeLayerId, number>> {
  const counts: Record<SpikeLayerId, number> = {
    regions: 0,
    paths: 0,
    places: 0,
  };

  for (const feature of features) {
    counts[feature.properties.layer] += 1;
  }

  return counts;
}

/** Serializa una colección con un formato estable y legible. */
export function serializeFeatureCollection(
  collection: SpikeFeatureCollection,
): string {
  return `${JSON.stringify(collection, null, 2)}\n`;
}

/** Lista de capas en orden de pintado, útil para recorrer el registro. */
export const SPIKE_LAYER_ORDER = SPIKE_LAYER_IDS;
