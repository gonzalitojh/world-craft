/**
 * Generador determinista de las 500 features del spike (#80).
 *
 * PRNG propio con semilla `wc-80`: dos ejecuciones producen exactamente el
 * mismo GeoJSON, sin `Math.random`, reloj ni estado global. El reparto es fijo:
 * 250 regiones (polígono, rectángulo y círculo), 170 caminos y 80 lugares,
 * dentro de un área ficticia del hemisferio norte.
 */
import type {
  SpikeFeature,
  SpikePosition,
  SpikePolygonGeometry,
} from './geojson';
import type { SpikeLayerId, SpikeMode } from './layers';

/** Semilla documentada del generador. */
export const SPIKE_FEATURE_SEED = 'wc-80';

/** Reparto exacto por capa. */
export const SPIKE_FEATURE_COUNTS = Object.freeze({
  regions: 250,
  paths: 170,
  places: 80,
});

/** Total de features de la prueba de carga. */
export const SPIKE_FEATURE_TOTAL =
  SPIKE_FEATURE_COUNTS.regions +
  SPIKE_FEATURE_COUNTS.paths +
  SPIKE_FEATURE_COUNTS.places;

/** Centro del área ficticia; no representa ningún lugar real. */
const AREA_CENTER = Object.freeze({ lng: 8, lat: 26 });
const AREA_HALF_WIDTH = 14;
const AREA_HALF_HEIGHT = 9;
const REGION_MODES: readonly SpikeMode[] = ['polygon', 'rectangle', 'circle'];
const COORDINATE_PRECISION = 1_000_000;

type Random = () => number;

/** Hash estable de una semilla textual (xmur3). */
function hashSeed(seed: string): number {
  let hash = 1_779_033_703 ^ seed.length;

  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3_432_918_353);
    hash = (hash << 13) | (hash >>> 19);
  }

  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_507);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_909);

  return (hash ^ (hash >>> 16)) >>> 0;
}

/** Generador mulberry32 determinista a partir de una semilla textual. */
export function createSpikeRandom(seed: string): Random {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomBetween(random: Random, min: number, max: number): number {
  return min + random() * (max - min);
}

function randomInteger(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function roundCoordinate(value: number): number {
  const rounded =
    Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;

  return rounded === 0 ? 0 : rounded;
}

function position(lng: number, lat: number): SpikePosition {
  return [roundCoordinate(lng), roundCoordinate(lat)];
}

function randomCenter(random: Random): {
  readonly lng: number;
  readonly lat: number;
} {
  return {
    lng:
      AREA_CENTER.lng +
      randomBetween(random, -AREA_HALF_WIDTH, AREA_HALF_WIDTH),
    lat:
      AREA_CENTER.lat +
      randomBetween(random, -AREA_HALF_HEIGHT, AREA_HALF_HEIGHT),
  };
}

function polygonRing(
  random: Random,
  center: { readonly lng: number; readonly lat: number },
): SpikePosition[] {
  const vertexCount = randomInteger(random, 6, 9);
  const radius = randomBetween(random, 0.5, 2.4);
  const ring: SpikePosition[] = [];

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const angle = (vertex / vertexCount) * Math.PI * 2;
    const stretch = 0.7 + random() * 0.6;
    ring.push(
      position(
        center.lng + Math.cos(angle) * radius * stretch,
        center.lat + Math.sin(angle) * radius * stretch,
      ),
    );
  }

  ring.push(ring[0] as SpikePosition);

  return ring;
}

function rectangleRing(
  random: Random,
  center: { readonly lng: number; readonly lat: number },
): SpikePosition[] {
  const halfWidth = randomBetween(random, 0.4, 1.9);
  const halfHeight = randomBetween(random, 0.3, 1.5);

  return [
    position(center.lng - halfWidth, center.lat - halfHeight),
    position(center.lng + halfWidth, center.lat - halfHeight),
    position(center.lng + halfWidth, center.lat + halfHeight),
    position(center.lng - halfWidth, center.lat + halfHeight),
    position(center.lng - halfWidth, center.lat - halfHeight),
  ];
}

function circleRing(
  random: Random,
  center: { readonly lng: number; readonly lat: number },
): SpikePosition[] {
  const radius = randomBetween(random, 0.5, 1.8);
  const segments = randomInteger(random, 24, 32);
  const ring: SpikePosition[] = [];

  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    ring.push(
      position(
        center.lng + Math.cos(angle) * radius,
        center.lat + Math.sin(angle) * radius,
      ),
    );
  }

  ring.push(ring[0] as SpikePosition);

  return ring;
}

function regionFeature(random: Random, index: number): SpikeFeature {
  const mode = REGION_MODES[index % REGION_MODES.length] as SpikeMode;
  const center = randomCenter(random);
  const ring =
    mode === 'rectangle'
      ? rectangleRing(random, center)
      : mode === 'circle'
        ? circleRing(random, center)
        : polygonRing(random, center);
  const geometry: SpikePolygonGeometry = {
    type: 'Polygon',
    coordinates: [ring],
  };

  return {
    type: 'Feature',
    geometry,
    properties: { mode, layer: 'regions' satisfies SpikeLayerId },
  };
}

function pathFeature(random: Random): SpikeFeature {
  const vertexCount = randomInteger(random, 4, 8);
  const start = randomCenter(random);
  const coordinates: SpikePosition[] = [];
  let lng = start.lng;
  let lat = start.lat;

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    coordinates.push(position(lng, lat));
    lng += randomBetween(random, -1.6, 1.6);
    lat += randomBetween(random, -1.1, 1.1);
    lng = Math.min(179, Math.max(-179, lng));
    lat = Math.min(89, Math.max(-89, lat));
  }

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: { mode: 'linestring', layer: 'paths' satisfies SpikeLayerId },
  };
}

function placeFeature(random: Random): SpikeFeature {
  const center = randomCenter(random);

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: position(center.lng, center.lat),
    },
    properties: { mode: 'point', layer: 'places' satisfies SpikeLayerId },
  };
}

/**
 * Genera las 500 features en orden estable: regiones, caminos y lugares.
 *
 * No usa estado global ni fuentes externas; la misma semilla devuelve siempre
 * exactamente la misma colección.
 */
export function generateSpikeFeatures(): readonly SpikeFeature[] {
  const random = createSpikeRandom(SPIKE_FEATURE_SEED);
  const features: SpikeFeature[] = [];

  for (let index = 0; index < SPIKE_FEATURE_COUNTS.regions; index += 1) {
    features.push(regionFeature(random, index));
  }

  for (let index = 0; index < SPIKE_FEATURE_COUNTS.paths; index += 1) {
    features.push(pathFeature(random));
  }

  for (let index = 0; index < SPIKE_FEATURE_COUNTS.places; index += 1) {
    features.push(placeFeature(random));
  }

  return features;
}
