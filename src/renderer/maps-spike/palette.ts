/**
 * Paleta DOM del spike de mapas (#80).
 *
 * Los alias `--spike-*` se declaran en `styles/maps-spike.css` y apuntan a los
 * roles semánticos del tema activo. Este módulo solo lee valores ya resueltos:
 * no decide colores ni conoce MapLibre. `resolveSpikePalette` es puro para
 * poder probarlo con un lector falso.
 */

/** Variables CSS que consume el laboratorio. */
export const SPIKE_PALETTE_TOKENS = Object.freeze({
  mapBg: '--spike-map-bg',
  mapFrame: '--spike-map-frame',
  region: '--spike-region',
  regionFill: '--spike-region-fill',
  regionStroke: '--spike-region-stroke',
  path: '--spike-path',
  place: '--spike-place',
  placeStroke: '--spike-place-stroke',
  selection: '--spike-selection',
  guide: '--spike-guide',
  vertex: '--spike-vertex',
  vertexStroke: '--spike-vertex-stroke',
});

/** Colores resueltos para el mapa y el SVG. */
export interface SpikeMapPalette {
  readonly mapBg: string;
  readonly mapFrame: string;
  readonly region: string;
  readonly regionFill: string;
  readonly regionStroke: string;
  readonly path: string;
  readonly place: string;
  readonly placeStroke: string;
  readonly selection: string;
  readonly guide: string;
  readonly vertex: string;
  readonly vertexStroke: string;
}

/**
 * Reservas del tema Claro si un alias no estuviera disponible.
 *
 * Son los mismos valores de la capa semántica; se usan únicamente para que el
 * SVG no quede sin color en un documento sin CSS cargado.
 */
export const SPIKE_PALETTE_FALLBACK: SpikeMapPalette = Object.freeze({
  mapBg: '#efece4',
  mapFrame: '#7d847c',
  region: '#2e5b45',
  regionFill: '#2e5b45',
  regionStroke: '#2e5b45',
  path: '#8c6d2f',
  place: '#4c6672',
  placeStroke: '#4c6672',
  selection: '#2e5b45',
  guide: '#7d847c',
  vertex: '#fbfaf7',
  vertexStroke: '#7d847c',
});

/** Lector inyectable de variables CSS. */
export type SpikeTokenReader = (token: string) => string;

function readOrFallback(
  read: SpikeTokenReader,
  token: string,
  fallback: string,
): string {
  const value = read(token).trim();

  return value.length > 0 ? value : fallback;
}

/** Resuelve los colores del mapa con un lector inyectable. */
export function resolveSpikePalette(
  read: SpikeTokenReader,
  fallback: SpikeMapPalette = SPIKE_PALETTE_FALLBACK,
): SpikeMapPalette {
  return {
    mapBg: readOrFallback(read, SPIKE_PALETTE_TOKENS.mapBg, fallback.mapBg),
    mapFrame: readOrFallback(
      read,
      SPIKE_PALETTE_TOKENS.mapFrame,
      fallback.mapFrame,
    ),
    region: readOrFallback(read, SPIKE_PALETTE_TOKENS.region, fallback.region),
    regionFill: readOrFallback(
      read,
      SPIKE_PALETTE_TOKENS.regionFill,
      fallback.regionFill,
    ),
    regionStroke: readOrFallback(
      read,
      SPIKE_PALETTE_TOKENS.regionStroke,
      fallback.regionStroke,
    ),
    path: readOrFallback(read, SPIKE_PALETTE_TOKENS.path, fallback.path),
    place: readOrFallback(read, SPIKE_PALETTE_TOKENS.place, fallback.place),
    placeStroke: readOrFallback(
      read,
      SPIKE_PALETTE_TOKENS.placeStroke,
      fallback.placeStroke,
    ),
    selection: readOrFallback(
      read,
      SPIKE_PALETTE_TOKENS.selection,
      fallback.selection,
    ),
    guide: readOrFallback(read, SPIKE_PALETTE_TOKENS.guide, fallback.guide),
    vertex: readOrFallback(read, SPIKE_PALETTE_TOKENS.vertex, fallback.vertex),
    vertexStroke: readOrFallback(
      read,
      SPIKE_PALETTE_TOKENS.vertexStroke,
      fallback.vertexStroke,
    ),
  };
}

/**
 * Lee la paleta del documento en el tema activo.
 *
 * Se llama después del montaje y de cada cambio de `data-theme`; los alias
 * heredan el tema, así que una sola lectura devuelve los colores correctos.
 */
export function readSpikePalette(
  element: Element = document.documentElement,
): SpikeMapPalette {
  const computed = getComputedStyle(element);

  return resolveSpikePalette((token) => computed.getPropertyValue(token));
}
