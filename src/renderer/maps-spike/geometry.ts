/**
 * Geometría y medidas del laboratorio de mapas (#80).
 *
 * Módulo puro sin DOM ni mapas: calcula longitud, perímetro y área esférica a
 * partir de las coordenadas GeoJSON y formatea con el `Intl.NumberFormat` que
 * le pasa la interfaz. Las unidades y los decimales viven aquí para que el
 * panel de medidas no concatene cifras a mano.
 */
import type { SpikeFeature, SpikePosition } from './geojson';

/** Radio medio terrestre en metros (IUGG). */
export const EARTH_RADIUS_METERS = 6_371_008.8;

/** Resumen geométrico de una feature. */
export interface SpikeFeatureMeasure {
  readonly vertices: number;
  readonly coordinates: SpikePosition | null;
  readonly lengthMeters: number | null;
  readonly perimeterMeters: number | null;
  readonly areaSquareMeters: number | null;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Distancia haversine entre dos posiciones, en metros. */
export function haversineMeters(
  start: SpikePosition,
  end: SpikePosition,
): number {
  const [lng1, lat1] = start;
  const [lng2, lat2] = end;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);
  const sinPhi = Math.sin(deltaPhi / 2);
  const sinLambda = Math.sin(deltaLambda / 2);
  const a =
    sinPhi * sinPhi + Math.cos(phi1) * Math.cos(phi2) * sinLambda * sinLambda;
  const clamped = Math.min(1, Math.max(0, a));

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(clamped));
}

/** Longitud de una línea, en metros. */
export function lineStringLengthMeters(
  coordinates: readonly SpikePosition[],
): number {
  let total = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];

    if (previous !== undefined && current !== undefined) {
      total += haversineMeters(previous, current);
    }
  }

  return total;
}

function ringPerimeterMeters(ring: readonly SpikePosition[]): number {
  let total = 0;

  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1];
    const current = ring[index];

    if (previous !== undefined && current !== undefined) {
      total += haversineMeters(previous, current);
    }
  }

  return total;
}

/**
 * Área esférica de un anillo, en metros cuadrados.
 *
 * Fórmula geodésica clásica; el delta de longitud se normaliza a [-π, π] para
 * no invertir el signo al cruzar el antimeridiano.
 */
export function ringAreaSquareMeters(ring: readonly SpikePosition[]): number {
  if (ring.length < 3) {
    return 0;
  }

  let sum = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];

    if (current === undefined || next === undefined) {
      continue;
    }

    let deltaLambda = toRadians(next[0] - current[0]);

    while (deltaLambda > Math.PI) {
      deltaLambda -= Math.PI * 2;
    }

    while (deltaLambda < -Math.PI) {
      deltaLambda += Math.PI * 2;
    }

    sum +=
      deltaLambda *
      (2 + Math.sin(toRadians(current[1])) + Math.sin(toRadians(next[1])));
  }

  return Math.abs((sum * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
}

/** Área de un polígono con agujeros, en metros cuadrados. */
export function polygonAreaSquareMeters(
  rings: readonly (readonly SpikePosition[])[],
): number {
  const outer = rings[0];

  if (outer === undefined) {
    return 0;
  }

  let area = ringAreaSquareMeters(outer);

  for (const hole of rings.slice(1)) {
    area -= ringAreaSquareMeters(hole);
  }

  return Math.max(0, area);
}

/** Perímetro de un polígono con agujeros, en metros. */
export function polygonPerimeterMeters(
  rings: readonly (readonly SpikePosition[])[],
): number {
  return rings.reduce((total, ring) => total + ringPerimeterMeters(ring), 0);
}

/** Cuenta vértices sin repetir el cierre de cada anillo. */
export function countVertices(feature: SpikeFeature): number {
  const { geometry } = feature;

  if (geometry.type === 'Point') {
    return 1;
  }

  if (geometry.type === 'LineString') {
    return geometry.coordinates.length;
  }

  return geometry.coordinates.reduce(
    (total, ring) => total + Math.max(0, ring.length - 1),
    0,
  );
}

/** Calcula todas las medidas de una feature. */
export function measureFeature(feature: SpikeFeature): SpikeFeatureMeasure {
  const { geometry } = feature;

  if (geometry.type === 'Point') {
    return {
      vertices: 1,
      coordinates: geometry.coordinates,
      lengthMeters: null,
      perimeterMeters: null,
      areaSquareMeters: null,
    };
  }

  if (geometry.type === 'LineString') {
    return {
      vertices: geometry.coordinates.length,
      coordinates: null,
      lengthMeters: lineStringLengthMeters(geometry.coordinates),
      perimeterMeters: null,
      areaSquareMeters: null,
    };
  }

  return {
    vertices: countVertices(feature),
    coordinates: null,
    lengthMeters: null,
    perimeterMeters: polygonPerimeterMeters(geometry.coordinates),
    areaSquareMeters: polygonAreaSquareMeters(geometry.coordinates),
  };
}

/** Formateador inyectable; en la UI es `formats.formatNumber`. */
export type NumberFormatter = (
  value: number,
  options?: Intl.NumberFormatOptions,
) => string;

/** Formatea una distancia en m o km con dos decimales como máximo. */
export function formatDistance(
  meters: number,
  formatNumber: NumberFormatter,
): string {
  const safe = Number.isFinite(meters) && meters >= 0 ? meters : 0;

  if (safe >= 1000) {
    return formatNumber(safe / 1000, {
      style: 'unit',
      unit: 'kilometer',
      unitDisplay: 'short',
      maximumFractionDigits: 2,
    });
  }

  return formatNumber(safe, {
    style: 'unit',
    unit: 'meter',
    unitDisplay: 'short',
    maximumFractionDigits: 2,
  });
}

/** Formatea un área en m² o km² con dos decimales como máximo. */
export function formatArea(
  squareMeters: number,
  formatNumber: NumberFormatter,
): string {
  const safe =
    Number.isFinite(squareMeters) && squareMeters >= 0 ? squareMeters : 0;

  if (safe >= 1_000_000) {
    return `${formatNumber(safe / 1_000_000, {
      style: 'unit',
      unit: 'kilometer',
      unitDisplay: 'short',
      maximumFractionDigits: 2,
    })}²`;
  }

  return `${formatNumber(safe, {
    style: 'unit',
    unit: 'meter',
    unitDisplay: 'short',
    maximumFractionDigits: 2,
  })}²`;
}

/** Formatea una coordenada con cinco decimales, como pide el contrato. */
export function formatCoordinate(
  value: number,
  formatNumber: NumberFormatter,
): string {
  return formatNumber(Number.isFinite(value) ? value : 0, {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  });
}
