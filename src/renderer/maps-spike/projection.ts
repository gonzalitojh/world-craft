/**
 * Proyección Web Mercator pura del spike de mapas (#80).
 *
 * Usa la misma fórmula que MapLibre (teselas de 512 px) pero no importa la
 * librería: el serializador SVG y los tests pueden proyectar sin WebGL. No hay
 * envolvimiento de mundo (`renderWorldCopies: false`), así que una longitud
 * fuera del encuadre se pinta fuera del viewBox o se recorta en el consumidor.
 */
import type { SpikeFeature, SpikePosition } from './geojson';

/** Latitud máxima representable por Web Mercator. */
export const MAX_MERCATOR_LATITUDE = 85.0511287798066;

/** Tamaño de tesela de MapLibre GL. */
export const SPIKE_TILE_SIZE = 512;

/** Zoom máximo razonable para el prototipo. */
export const SPIKE_MAX_ZOOM = 22;

/** Coordenada geográfica. */
export interface SpikeLngLat {
  readonly lng: number;
  readonly lat: number;
}

/** Punto en píxeles de mundo o de viewport. */
export interface SpikePoint {
  readonly x: number;
  readonly y: number;
}

/** Encuadre actual del mapa. */
export interface SpikeViewport {
  readonly center: SpikeLngLat;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}

/** Caja geográfica de un conjunto de features. */
export interface SpikeBounds {
  readonly minLng: number;
  readonly minLat: number;
  readonly maxLng: number;
  readonly maxLat: number;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

/** Colapsa residuos de coma flotante cerca de cero. */
function normalizeCoordinate(value: number): number {
  return Math.abs(value) < 1e-9 ? 0 : normalizeZero(value);
}

/** Convierte `-0` en `0` para que la serialización sea estable. */
export function normalizeProjectedNumber(value: number): number {
  return normalizeZero(value);
}

/** Limita una latitud al rango representable por Web Mercator. */
export function clampMercatorLatitude(latitude: number): number {
  if (!Number.isFinite(latitude)) {
    return 0;
  }

  return Math.min(
    MAX_MERCATOR_LATITUDE,
    Math.max(-MAX_MERCATOR_LATITUDE, latitude),
  );
}

/** Longitud de una tesela a un zoom dado (512 · 2^zoom). */
export function worldSize(zoom: number): number {
  const safeZoom = Number.isFinite(zoom) ? Math.max(0, zoom) : 0;

  return SPIKE_TILE_SIZE * 2 ** safeZoom;
}

/** Proyecta longitud y latitud a píxeles de mundo al zoom indicado. */
export function lngLatToWorld(position: SpikeLngLat, zoom = 0): SpikePoint {
  const size = worldSize(zoom);
  const lng = Number.isFinite(position.lng) ? position.lng : 0;
  const lat = clampMercatorLatitude(position.lat);
  const x = ((lng + 180) / 360) * size;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size;

  return { x: normalizeCoordinate(x), y: normalizeCoordinate(y) };
}

/** Inversa de `lngLatToWorld`. */
export function worldToLngLat(point: SpikePoint, zoom = 0): SpikeLngLat {
  const size = worldSize(zoom);
  const x = Number.isFinite(point.x) ? point.x : 0;
  const y = Number.isFinite(point.y) ? point.y : 0;
  const lng = (x / size) * 360 - 180;
  const mercatorY = Math.PI * (1 - (2 * y) / size);
  const lat = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;

  return {
    lng: normalizeCoordinate(lng),
    lat: normalizeCoordinate(clampMercatorLatitude(lat)),
  };
}

/** Proyecta una coordenada al viewport actual. */
export function projectToViewport(
  position: SpikeLngLat,
  viewport: SpikeViewport,
): SpikePoint {
  const world = lngLatToWorld(position, viewport.zoom);
  const center = lngLatToWorld(viewport.center, viewport.zoom);

  return {
    x: normalizeCoordinate(world.x - center.x + viewport.width / 2),
    y: normalizeCoordinate(world.y - center.y + viewport.height / 2),
  };
}

/** Inversa de `projectToViewport`. */
export function unprojectFromViewport(
  point: SpikePoint,
  viewport: SpikeViewport,
): SpikeLngLat {
  const center = lngLatToWorld(viewport.center, viewport.zoom);

  return worldToLngLat(
    {
      x: point.x + center.x - viewport.width / 2,
      y: point.y + center.y - viewport.height / 2,
    },
    viewport.zoom,
  );
}

function includePosition(
  bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null,
  position: SpikePosition,
): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} | null {
  const [lng, lat] = position;

  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return bounds;
  }

  if (bounds === null) {
    return { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
  }

  return {
    minLng: Math.min(bounds.minLng, lng),
    minLat: Math.min(bounds.minLat, lat),
    maxLng: Math.max(bounds.maxLng, lng),
    maxLat: Math.max(bounds.maxLat, lat),
  };
}

/** Calcula la caja geográfica de todas las features válidas. */
export function computeFeaturesBounds(
  features: readonly SpikeFeature[],
): SpikeBounds | null {
  let bounds = null as {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null;

  for (const feature of features) {
    const { geometry } = feature;

    if (geometry.type === 'Point') {
      bounds = includePosition(bounds, geometry.coordinates);
      continue;
    }

    if (geometry.type === 'LineString') {
      for (const position of geometry.coordinates) {
        bounds = includePosition(bounds, position);
      }
      continue;
    }

    for (const ring of geometry.coordinates) {
      for (const position of ring) {
        bounds = includePosition(bounds, position);
      }
    }
  }

  return bounds;
}

/**
 * Calcula centro y zoom para encajar una caja con padding en un viewport.
 *
 * Devuelve `null` si la caja está vacía o no es finita. El zoom se limita a
 * `[0, SPIKE_MAX_ZOOM]` y nunca devuelve `-0` en el centro.
 */
export function fitBoundsToViewport(
  bounds: SpikeBounds | null,
  width: number,
  height: number,
  padding = 24,
): { readonly center: SpikeLngLat; readonly zoom: number } | null {
  if (bounds === null) {
    return null;
  }

  const values = [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat];

  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : 0;
  const availableWidth = Math.max(1, safeWidth - safePadding * 2);
  const availableHeight = Math.max(1, safeHeight - safePadding * 2);

  const northWest = lngLatToWorld({
    lng: bounds.minLng,
    lat: bounds.maxLat,
  });
  const southEast = lngLatToWorld({
    lng: bounds.maxLng,
    lat: bounds.minLat,
  });
  const spanX = Math.max(Number.EPSILON, southEast.x - northWest.x);
  const spanY = Math.max(Number.EPSILON, southEast.y - northWest.y);
  const zoomX = Math.log2(availableWidth / spanX);
  const zoomY = Math.log2(availableHeight / spanY);
  const zoom = Math.min(SPIKE_MAX_ZOOM, Math.max(0, Math.min(zoomX, zoomY)));

  return {
    center: worldToLngLat(
      {
        x: (northWest.x + southEast.x) / 2,
        y: (northWest.y + southEast.y) / 2,
      },
      0,
    ),
    zoom: normalizeZero(zoom),
  };
}
