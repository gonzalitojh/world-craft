/**
 * Serializador SVG puro del spike de mapas (#80).
 *
 * Recorre las capas en orden regions → paths → places y pinta solo geometrías
 * saneadas. No incluye etiquetas, propiedades del usuario ni handles de
 * selección. Los polígonos con agujeros usan un único `path` con
 * `fill-rule="evenodd"`.
 *
 * Las geometrías `Multi*` se rechazan en la importación v1, así que aquí no se
 * generan. Un vértice inválido descarta la feature o el agujero afectado sin
 * lanzar: el SVG siempre sale con estructura XML completa.
 */
import type { SpikeFeature, SpikePosition } from './geojson';
import { SPIKE_LAYERS, type SpikeLayerId } from './layers';
import { projectToViewport, type SpikeViewport } from './projection';

/** Estilos ya resueltos por la capa de paleta (sin leer CSS aquí). */
export interface SpikeSvgStyle {
  readonly background: string | null;
  readonly regionFill: string;
  readonly regionFillOpacity: number;
  readonly regionStroke: string;
  readonly regionStrokeWidth: number;
  readonly pathStroke: string;
  readonly pathStrokeWidth: number;
  readonly pathDashArray: string | null;
  readonly placeFill: string;
  readonly placeStroke: string;
  readonly placeStrokeWidth: number;
  readonly placeRadius: number;
  readonly selectionFill: string;
  readonly selectionFillOpacity: number;
  readonly selectionStroke: string;
  readonly selectionStrokeWidth: number;
}

/** Entrada del serializador. */
export interface SpikeSvgOptions {
  /** Dimensiones del viewport; si faltan se usan las del propio viewport. */
  readonly width?: number;
  readonly height?: number;
  readonly viewport: SpikeViewport;
  readonly layers: Readonly<Record<SpikeLayerId, readonly SpikeFeature[]>>;
  readonly style: SpikeSvgStyle;
  /** Ids del store que se pintan con el estilo de selección. */
  readonly selectedIds?: readonly string[];
}

/** Metadatos deterministas del SVG generado. */
export interface SpikeSvgMetadata {
  readonly bytes: number;
  readonly totalFeatures: number;
  readonly counts: Readonly<Record<SpikeLayerId, number>>;
  readonly viewBox: string;
}

/** Resultado del serializador. */
export interface SpikeSvgResult {
  readonly svg: string;
  readonly metadata: SpikeSvgMetadata;
}

const NUMBER_PRECISION = 100;

function safeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 1;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const rounded = Math.round(value * NUMBER_PRECISION) / NUMBER_PRECISION;

  if (rounded === 0) {
    return '0';
  }

  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function validPosition(position: SpikePosition): boolean {
  const [lng, lat] = position;

  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function project(position: SpikePosition, viewport: SpikeViewport) {
  const point = projectToViewport(
    { lng: position[0], lat: position[1] },
    viewport,
  );

  return {
    ...point,
    valid: Number.isFinite(point.x) && Number.isFinite(point.y),
  };
}

function color(value: string): string {
  return typeof value === 'string' && value.trim().length > 0
    ? escapeXml(value.trim())
    : 'none';
}

function positiveWidth(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function pointMarkup(
  feature: SpikeFeature,
  viewport: SpikeViewport,
  style: SpikeSvgStyle,
  selected: boolean,
): string | null {
  if (feature.geometry.type !== 'Point') {
    return null;
  }

  const position = feature.geometry.coordinates;

  if (!validPosition(position)) {
    return null;
  }

  const point = project(position, viewport);

  if (!point.valid) {
    return null;
  }

  const radius = positiveWidth(style.placeRadius, 6);
  const strokeWidth = positiveWidth(style.placeStrokeWidth, 2);
  const ringColor = selected ? style.selectionStroke : style.placeStroke;
  const centerColor = selected ? style.selectionStroke : style.placeFill;
  const innerRadius = Math.max(1.5, radius * 0.45);
  const dotRadius = Math.max(1, radius * 0.22);

  return [
    `<circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="${formatNumber(radius)}" fill="none" stroke="${color(ringColor)}" stroke-width="${formatNumber(strokeWidth)}" />`,
    `<circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="${formatNumber(innerRadius)}" fill="none" stroke="${color(ringColor)}" stroke-width="${formatNumber(positiveWidth(strokeWidth * 0.7, 1.4))}" />`,
    `<circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="${formatNumber(dotRadius)}" fill="${color(centerColor)}" />`,
  ].join('\n');
}

function lineMarkup(
  feature: SpikeFeature,
  viewport: SpikeViewport,
  style: SpikeSvgStyle,
  selected: boolean,
): string | null {
  if (feature.geometry.type !== 'LineString') {
    return null;
  }

  const positions = feature.geometry.coordinates;

  if (
    positions.length < 2 ||
    positions.some((position) => !validPosition(position))
  ) {
    return null;
  }

  const points = positions.map((position) => project(position, viewport));

  if (points.some((point) => !point.valid)) {
    return null;
  }

  const commands = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    )
    .join(' ');
  const strokeWidth = positiveWidth(
    selected ? style.selectionStrokeWidth : style.pathStrokeWidth,
    2,
  );
  const dash =
    selected || style.pathDashArray === null
      ? ''
      : ` stroke-dasharray="${escapeXml(style.pathDashArray)}"`;

  return `<path d="${commands}" fill="none" stroke="${color(
    selected ? style.selectionStroke : style.pathStroke,
  )}" stroke-width="${formatNumber(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${dash} />`;
}

function polygonMarkup(
  feature: SpikeFeature,
  viewport: SpikeViewport,
  style: SpikeSvgStyle,
  selected: boolean,
): string | null {
  if (feature.geometry.type !== 'Polygon') {
    return null;
  }

  const rings = feature.geometry.coordinates;
  const outer = rings[0];

  if (
    outer === undefined ||
    outer.length < 3 ||
    outer.some((position) => !validPosition(position))
  ) {
    return null;
  }

  const commands: string[] = [];
  const validRings = [outer];

  for (const hole of rings.slice(1)) {
    if (hole.length >= 3 && hole.every(validPosition)) {
      validRings.push(hole);
    }
  }

  for (const ring of validRings) {
    const points = ring.map((position) => project(position, viewport));

    if (points.some((point) => !point.valid)) {
      if (ring === outer) {
        return null;
      }

      continue;
    }

    const ringCommands = points.map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    );

    commands.push(`${ringCommands.join(' ')} Z`);
  }

  if (commands.length === 0) {
    return null;
  }

  const strokeWidth = positiveWidth(
    selected ? style.selectionStrokeWidth : style.regionStrokeWidth,
    2,
  );
  const fill = selected ? style.selectionFill : style.regionFill;
  const fillOpacity = selected
    ? style.selectionFillOpacity
    : style.regionFillOpacity;
  const stroke = selected ? style.selectionStroke : style.regionStroke;

  return `<path d="${commands.join(' ')}" fill="${color(
    fill,
  )}" fill-opacity="${formatNumber(fillOpacity)}" fill-rule="evenodd" stroke="${color(
    stroke,
  )}" stroke-width="${formatNumber(strokeWidth)}" stroke-linejoin="round" />`;
}

/**
 * Serializa las capas visibles a un SVG XML determinista.
 *
 * El orden de los grupos es fijo y cada capa conserva el orden de sus
 * features. Un color vacío se sustituye por `none`; nunca se interpola texto
 * del usuario sin escapar.
 */
export function serializeSpikeSvg(options: SpikeSvgOptions): SpikeSvgResult {
  const width = safeDimension(options.width ?? options.viewport.width);
  const height = safeDimension(options.height ?? options.viewport.height);
  const counts: Record<SpikeLayerId, number> = {
    regions: 0,
    paths: 0,
    places: 0,
  };
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];
  const selectedIds = new Set(options.selectedIds ?? []);

  if (
    typeof options.style.background === 'string' &&
    options.style.background.trim().length > 0
  ) {
    parts.push(
      `<rect x="0" y="0" width="${width}" height="${height}" fill="${color(options.style.background)}" />`,
    );
  }

  for (const layer of SPIKE_LAYERS) {
    const features = options.layers[layer.id] ?? [];
    const markup: string[] = [];

    for (const feature of features) {
      const selected = feature.id !== undefined && selectedIds.has(feature.id);
      const rendered =
        layer.id === 'regions'
          ? polygonMarkup(feature, options.viewport, options.style, selected)
          : layer.id === 'paths'
            ? lineMarkup(feature, options.viewport, options.style, selected)
            : pointMarkup(feature, options.viewport, options.style, selected);

      if (rendered !== null) {
        counts[layer.id] += 1;
        markup.push(rendered);
      }
    }

    parts.push(`<g id="layer-${layer.id}" data-layer="${layer.id}">`);
    parts.push(...markup);
    parts.push('</g>');
  }

  parts.push('</svg>');

  const svg = `${parts.join('\n')}\n`;
  const totalFeatures = counts.regions + counts.paths + counts.places;

  return {
    svg,
    metadata: {
      bytes: new TextEncoder().encode(svg).byteLength,
      totalFeatures,
      counts,
      viewBox: `0 0 ${width} ${height}`,
    },
  };
}
