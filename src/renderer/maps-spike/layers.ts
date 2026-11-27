/**
 * Capas fijas del spike de mapas (#80).
 *
 * Módulo puro: no importa React, Electron ni MapLibre. Cada capa tiene una
 * geometría GeoJSON única y un orden estable de pintado (regiones, después
 * caminos y al final lugares). Los modos de Terra Draw se asignan a una capa;
 * `select` no crea geometría y no pertenece a ninguna.
 */

/** Identificadores de las tres capas del prototipo. */
export const SPIKE_LAYER_IDS = ['regions', 'paths', 'places'] as const;

/** Capa lógica del mapa. */
export type SpikeLayerId = (typeof SPIKE_LAYER_IDS)[number];

/** Modos de dibujo que comparten los controles y Terra Draw. */
export const SPIKE_MODES = [
  'polygon',
  'rectangle',
  'circle',
  'linestring',
  'point',
  'select',
] as const;

/** Modo de dibujo o selección del prototipo. */
export type SpikeMode = (typeof SPIKE_MODES)[number];

/** Geometría GeoJSON admitida por capa. */
export type SpikeGeometryType = 'Polygon' | 'LineString' | 'Point';

/** Definición inmutable de una capa. */
export interface SpikeLayerDefinition {
  readonly id: SpikeLayerId;
  readonly geometry: SpikeGeometryType;
  /** Modos que crean geometrías de esta capa. */
  readonly modes: readonly SpikeMode[];
  /** Orden de pintado ascendente. */
  readonly order: number;
}

/** Definiciones en el orden de pintado. */
export const SPIKE_LAYERS: readonly SpikeLayerDefinition[] = Object.freeze([
  Object.freeze({
    id: 'regions',
    geometry: 'Polygon',
    modes: Object.freeze(['polygon', 'rectangle', 'circle'] as const),
    order: 0,
  }),
  Object.freeze({
    id: 'paths',
    geometry: 'LineString',
    modes: Object.freeze(['linestring'] as const),
    order: 1,
  }),
  Object.freeze({
    id: 'places',
    geometry: 'Point',
    modes: Object.freeze(['point'] as const),
    order: 2,
  }),
]);

const LAYERS_BY_ID: Readonly<Record<SpikeLayerId, SpikeLayerDefinition>> =
  Object.freeze({
    regions: SPIKE_LAYERS[0] as SpikeLayerDefinition,
    paths: SPIKE_LAYERS[1] as SpikeLayerDefinition,
    places: SPIKE_LAYERS[2] as SpikeLayerDefinition,
  });

const MODE_TO_LAYER: Readonly<Record<SpikeMode, SpikeLayerId | null>> =
  Object.freeze({
    polygon: 'regions',
    rectangle: 'regions',
    circle: 'regions',
    linestring: 'paths',
    point: 'places',
    select: null,
  });

/** Indica si un valor es una capa conocida. */
export function isSpikeLayerId(value: unknown): value is SpikeLayerId {
  return (
    typeof value === 'string' &&
    (SPIKE_LAYER_IDS as readonly string[]).includes(value)
  );
}

/** Indica si un valor es un modo conocido. */
export function isSpikeMode(value: unknown): value is SpikeMode {
  return (
    typeof value === 'string' &&
    (SPIKE_MODES as readonly string[]).includes(value)
  );
}

/** Devuelve la definición de una capa. */
export function spikeLayer(layer: SpikeLayerId): SpikeLayerDefinition {
  return LAYERS_BY_ID[layer];
}

/** Capa que crea un modo; `select` devuelve `null`. */
export function layerForMode(mode: SpikeMode): SpikeLayerId | null {
  return MODE_TO_LAYER[mode];
}

/** Modos válidos de una capa. */
export function modesForLayer(layer: SpikeLayerId): readonly SpikeMode[] {
  return spikeLayer(layer).modes;
}

/** Modo por defecto de una capa (el primero declarado). */
export function defaultModeForLayer(layer: SpikeLayerId): SpikeMode {
  return modesForLayer(layer)[0] as SpikeMode;
}

/** Indica si una geometría encaja con la capa. */
export function geometryMatchesLayer(
  geometry: SpikeGeometryType,
  layer: SpikeLayerId,
): boolean {
  return spikeLayer(layer).geometry === geometry;
}
