import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type ErrorEvent as MapLibreErrorEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
  type HexColor,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';

import type { SpikeExportKind } from '../../shared/contracts/maps-spike';
import { useI18n } from '../i18n/provider';
import {
  countFeaturesByLayer,
  parseImportedFeatureCollectionAuto,
  sanitizeStoreSnapshot,
  serializeFeatureCollection,
  SPIKE_GEOJSON_MAX_BYTES,
  SPIKE_GEOJSON_MAX_FEATURES,
  type SpikeFeature,
} from './geojson';
import { measureFeature } from './geometry';
import {
  SPIKE_LAYERS,
  isSpikeMode,
  layerForMode,
  type SpikeLayerId,
  type SpikeMode,
} from './layers';
import {
  assembleSpikeReport,
  measureAnimationFrames,
  type SpikeEnvironment,
  type SpikeRunMetrics,
} from './metrics';
import { buildSpikeReportJson, buildSpikeReportMarkdown } from './report';
import {
  readSpikePalette,
  SPIKE_PALETTE_FALLBACK,
  type SpikeMapPalette,
} from './palette';
import { computeFeaturesBounds, fitBoundsToViewport } from './projection';
import { serializeSpikeSvg, type SpikeSvgStyle } from './svg';
import type {
  MapsSpikeActions,
  MapsSpikeState,
  SpikeBusy,
  SpikeFeatureRecord,
  SpikeMetricsView,
  SpikeSelectedItem,
  SpikeStatus,
} from './state';
import { MAP_CANVAS_HELP_ID } from './state';
import { generateSpikeFeatures } from './feature-generator';
import 'maplibre-gl/dist/maplibre-gl.css';

const BACKGROUND_LAYER_ID = 'wc-maps-spike-background';
const DRAW_PREFIX = 'wc-spike';
const LAYER_MAP_IDS: Readonly<Record<SpikeLayerId, readonly string[]>> = {
  regions: [`${DRAW_PREFIX}-polygon`, `${DRAW_PREFIX}-polygon-outline`],
  paths: [`${DRAW_PREFIX}-linestring`],
  places: [`${DRAW_PREFIX}-point`, `${DRAW_PREFIX}-point-marker`],
};
const ALL_MODES: readonly SpikeMode[] = [
  'select',
  'point',
  'linestring',
  'polygon',
  'rectangle',
  'circle',
];
const REGION_FILL_OPACITY = 0.12;
const SELECTION_FILL_OPACITY = 0.14;

function asHex(value: string, fallback: HexColor = '#2e5b45'): HexColor {
  // Reserva de región del tema Claro si un token llegara vacío o no hex.
  return /^#[0-9a-f]{6}$/i.test(value) ? (value as HexColor) : fallback;
}

function colorForFeature(
  palette: SpikeMapPalette,
  feature: GeoJSONStoreFeatures,
): string {
  const layer = feature.properties.layer;

  if (layer === 'paths') {
    return palette.path;
  }

  if (layer === 'places') {
    return palette.place;
  }

  return palette.region;
}

function pointStyles(getPalette: () => SpikeMapPalette) {
  return {
    pointColor: (feature: GeoJSONStoreFeatures): HexColor =>
      asHex(colorForFeature(getPalette(), feature)),
    pointWidth: 6,
    pointOutlineColor: (): HexColor => asHex(getPalette().vertexStroke),
    pointOutlineWidth: 2,
    editedPointColor: (): HexColor => asHex(getPalette().selection),
    editedPointWidth: 8,
    editedPointOutlineColor: (): HexColor => asHex(getPalette().vertexStroke),
    editedPointOutlineWidth: 2,
    snappingPointColor: (): HexColor => asHex(getPalette().guide),
    snappingPointOutlineColor: (): HexColor => asHex(getPalette().vertexStroke),
    snappingPointWidth: 7,
  };
}

function lineStyles(getPalette: () => SpikeMapPalette) {
  return {
    lineStringColor: (feature: GeoJSONStoreFeatures): HexColor =>
      asHex(colorForFeature(getPalette(), feature)),
    lineStringWidth: 2,
    lineStringDash: [7, 4] as [number, number],
    closingPointColor: (): HexColor => asHex(getPalette().vertex),
    closingPointOutlineColor: (): HexColor => asHex(getPalette().guide),
    closingPointWidth: 8,
    closingPointOutlineWidth: 2,
    snappingPointColor: (): HexColor => asHex(getPalette().guide),
    snappingPointOutlineColor: (): HexColor => asHex(getPalette().vertexStroke),
    coordinatePointColor: (): HexColor => asHex(getPalette().vertex),
    coordinatePointOutlineColor: (): HexColor => asHex(getPalette().guide),
    coordinatePointWidth: 8,
    coordinatePointOutlineWidth: 2,
  };
}

function regionStyles(getPalette: () => SpikeMapPalette) {
  return {
    fillColor: (feature: GeoJSONStoreFeatures): HexColor =>
      asHex(colorForFeature(getPalette(), feature)),
    fillOpacity: REGION_FILL_OPACITY,
    outlineColor: (feature: GeoJSONStoreFeatures): HexColor =>
      asHex(colorForFeature(getPalette(), feature)),
    outlineOpacity: 1,
    outlineWidth: 2,
    closingPointColor: (): HexColor => asHex(getPalette().vertex),
    closingPointOutlineColor: (): HexColor => asHex(getPalette().guide),
    closingPointWidth: 8,
    closingPointOutlineWidth: 2,
    snappingPointColor: (): HexColor => asHex(getPalette().guide),
    snappingPointOutlineColor: (): HexColor => asHex(getPalette().vertexStroke),
    coordinatePointColor: (): HexColor => asHex(getPalette().vertex),
    coordinatePointOutlineColor: (): HexColor => asHex(getPalette().guide),
    coordinatePointWidth: 8,
    coordinatePointOutlineWidth: 2,
    editedPointColor: (): HexColor => asHex(getPalette().selection),
    editedPointWidth: 8,
    editedPointOutlineColor: (): HexColor => asHex(getPalette().vertex),
    editedPointOutlineWidth: 2,
  };
}

function rectangleStyles(getPalette: () => SpikeMapPalette) {
  return {
    fillColor: (feature: GeoJSONStoreFeatures): HexColor =>
      asHex(colorForFeature(getPalette(), feature)),
    fillOpacity: REGION_FILL_OPACITY,
    outlineColor: (feature: GeoJSONStoreFeatures): HexColor =>
      asHex(colorForFeature(getPalette(), feature)),
    outlineOpacity: 1,
    outlineWidth: 2,
    coordinatePointColor: (): HexColor => asHex(getPalette().vertex),
    coordinatePointOutlineColor: (): HexColor => asHex(getPalette().guide),
    coordinatePointWidth: 8,
    coordinatePointOutlineWidth: 2,
  };
}

function selectStyles(getPalette: () => SpikeMapPalette) {
  return {
    selectedPointColor: (): HexColor => asHex(getPalette().selection),
    selectedPointWidth: 7,
    selectedPointOutlineColor: (): HexColor => asHex(getPalette().vertex),
    selectedPointOutlineWidth: 2,
    selectedLineStringColor: (): HexColor => asHex(getPalette().selection),
    selectedLineStringWidth: 3,
    selectedPolygonColor: (): HexColor => asHex(getPalette().selection),
    selectedPolygonFillOpacity: SELECTION_FILL_OPACITY,
    selectedPolygonOutlineColor: (): HexColor => asHex(getPalette().selection),
    selectedPolygonOutlineWidth: 3,
    selectionPointColor: (): HexColor => asHex(getPalette().selection),
    selectionPointOutlineColor: (): HexColor => asHex(getPalette().vertex),
    selectionPointWidth: 8,
    selectionPointOutlineWidth: 2,
    midPointColor: (): HexColor => asHex(getPalette().guide),
    midPointOutlineColor: (): HexColor => asHex(getPalette().vertex),
    midPointWidth: 7,
    midPointOutlineWidth: 2,
  };
}

function stylesForMode(
  mode: SpikeMode,
  getPalette: () => SpikeMapPalette,
): Record<string, unknown> {
  switch (mode) {
    case 'point':
      return pointStyles(getPalette);
    case 'linestring':
      return lineStyles(getPalette);
    case 'polygon':
      return regionStyles(getPalette);
    case 'rectangle':
    case 'circle':
      return rectangleStyles(getPalette);
    case 'select':
      return selectStyles(getPalette);
  }
}

function createDrawModes(getPalette: () => SpikeMapPalette) {
  return [
    new TerraDrawPointMode({ styles: pointStyles(getPalette) }),
    new TerraDrawLineStringMode({ styles: lineStyles(getPalette) }),
    new TerraDrawPolygonMode({ styles: regionStyles(getPalette) }),
    new TerraDrawRectangleMode({ styles: rectangleStyles(getPalette) }),
    new TerraDrawCircleMode({ styles: rectangleStyles(getPalette) }),
    new TerraDrawSelectMode({
      styles: selectStyles(getPalette),
      flags: {
        point: {
          feature: { draggable: true },
        },
        linestring: {
          feature: {
            draggable: true,
            coordinates: { midpoints: true, draggable: true, deletable: true },
          },
        },
        polygon: {
          feature: {
            draggable: true,
            coordinates: { midpoints: true, draggable: true, deletable: true },
          },
        },
        rectangle: {
          feature: {
            draggable: true,
            coordinates: { midpoints: true, draggable: true, deletable: true },
          },
        },
        circle: {
          feature: {
            draggable: true,
            coordinates: { midpoints: true, draggable: true, deletable: true },
          },
        },
      },
    }),
  ];
}

function createInlineStyle(backgroundColor: string): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: BACKGROUND_LAYER_ID,
        type: 'background',
        paint: { 'background-color': backgroundColor },
      },
    ],
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function createFeatureId(): string {
  const random = globalThis.crypto?.randomUUID?.();

  return (
    random ?? `wc-spike-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function toStoreFeatures(
  features: readonly SpikeFeature[],
): GeoJSONStoreFeatures[] {
  return features.map((feature) => ({
    type: 'Feature',
    id: createFeatureId(),
    geometry: feature.geometry as unknown as GeoJSONStoreFeatures['geometry'],
    properties: {
      mode: feature.properties.mode,
      layer: feature.properties.layer,
    },
  }));
}

/** Retira por completo un lote de importación fallido, si quedó algo. */
function cleanupImportedFeatures(
  draw: TerraDraw,
  features: readonly GeoJSONStoreFeatures[],
): void {
  for (const feature of features) {
    if (feature.id === undefined || !draw.hasFeature(feature.id)) {
      continue;
    }

    try {
      draw.removeFeatures([feature.id]);
    } catch {
      // La validación puede haber impedido crear esta feature.
    }
  }
}

function visibleFeatureGroups(
  records: readonly SpikeFeatureRecord[],
  visibleLayers: Readonly<Record<SpikeLayerId, boolean>>,
): Readonly<Record<SpikeLayerId, readonly SpikeFeature[]>> {
  const groups = {
    regions: [] as SpikeFeature[],
    paths: [] as SpikeFeature[],
    places: [] as SpikeFeature[],
  };

  for (const record of records) {
    const layer = record.feature.properties.layer;

    if (visibleLayers[layer]) {
      groups[layer].push(record.feature);
    }
  }

  return groups;
}

function buildSvgStyle(palette: SpikeMapPalette): SpikeSvgStyle {
  return {
    background: palette.mapBg,
    regionFill: palette.regionFill,
    regionFillOpacity: REGION_FILL_OPACITY,
    regionStroke: palette.regionStroke,
    regionStrokeWidth: 2,
    pathStroke: palette.path,
    pathStrokeWidth: 2,
    pathDashArray: '7 4',
    placeFill: palette.place,
    placeStroke: palette.placeStroke,
    placeStrokeWidth: 2,
    placeRadius: 6,
    selectionFill: palette.selection,
    selectionFillOpacity: SELECTION_FILL_OPACITY,
    selectionStroke: palette.selection,
    selectionStrokeWidth: 3,
  };
}

function toFeatureRecords(
  features: readonly SpikeFeature[],
): SpikeFeatureRecord[] {
  return features
    .filter(
      (feature): feature is SpikeFeature & { readonly id: string } =>
        typeof feature.id === 'string' && feature.id.length > 0,
    )
    .map((feature) => ({ id: feature.id, feature }));
}

function selectedItemsFrom(
  records: readonly SpikeFeatureRecord[],
  ids: readonly string[],
): SpikeSelectedItem[] {
  const byId = new Map(records.map((record) => [record.id, record.feature]));
  const items: SpikeSelectedItem[] = [];

  for (const id of ids) {
    const feature = byId.get(id);

    if (feature === undefined) {
      continue;
    }

    const measure = measureFeature(feature);
    items.push({
      id,
      feature,
      layer: feature.properties.layer,
      mode: feature.properties.mode,
      vertices: measure.vertices,
      coordinates: measure.coordinates,
      lengthMeters: measure.lengthMeters,
      perimeterMeters: measure.perimeterMeters,
      areaSquareMeters: measure.areaSquareMeters,
    });
  }

  return items;
}

function environmentLabel(map: MapLibreMap): string {
  const platform = /Windows/i.test(navigator.userAgent)
    ? 'Windows'
    : /Mac/i.test(navigator.userAgent)
      ? 'macOS'
      : 'Linux';
  const canvas = map.getCanvas();

  return `${platform} · WebGL2 · ${canvas.clientWidth}×${canvas.clientHeight}`;
}

function readWebGlRenderer(map: MapLibreMap): string | null {
  try {
    const gl = map.getCanvas().getContext('webgl2');

    if (gl === null) {
      return null;
    }

    const extension = gl.getExtension('WEBGL_debug_renderer_info');

    if (extension === null) {
      return null;
    }

    const renderer = gl.getParameter(
      extension.UNMASKED_RENDERER_WEBGL as number,
    );

    return typeof renderer === 'string' ? renderer : null;
  } catch {
    return null;
  }
}

/** Hook del laboratorio; carga MapLibre y Terra Draw solo en el chunk diferido. */
export function useSpikeMap(options: { readonly retryToken: number }) {
  const { messages, formats } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const paletteRef = useRef<SpikeMapPalette>(SPIKE_PALETTE_FALLBACK);
  const syncRef = useRef<(() => void) | null>(null);
  const visibleRef = useRef<Record<SpikeLayerId, boolean>>({
    regions: true,
    paths: true,
    places: true,
  });
  const selectedIdsRef = useRef<readonly string[]>([]);
  const featuresRef = useRef<readonly SpikeFeatureRecord[]>([]);
  const busyRef = useRef<SpikeBusy>('idle');
  const loadMsRef = useRef<number | null>(null);
  const suppressSyncRef = useRef(false);

  const [status, setStatus] = useState<SpikeStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [mode, setModeState] = useState<SpikeMode>('select');
  const [features, setFeatures] = useState<readonly SpikeFeatureRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<
    Record<SpikeLayerId, boolean>
  >({ regions: true, paths: true, places: true });
  const [busy, setBusy] = useState<SpikeBusy>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportErrors, setExportErrors] = useState<
    Partial<Record<SpikeExportKind, string>>
  >({});
  const [exports, setExports] = useState<
    Partial<Record<SpikeExportKind, { fileName: string; bytes: number }>>
  >({});
  const [announcement, setAnnouncement] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  const [metricsReport, setMetricsReport] =
    useState<SpikeMetricsView['report']>(null);
  const [metricsPhase, setMetricsPhase] =
    useState<SpikeMetricsView['phase']>('idle');
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [environment, setEnvironment] = useState('');

  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const counts = useMemo(
    () => countFeaturesByLayer(features.map((f) => f.feature)),
    [features],
  );
  const selected = useMemo(
    () => selectedItemsFrom(features, selectedIds),
    [features, selectedIds],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (container === null) {
      return;
    }

    let disposed = false;
    let map: MapLibreMap | null = null;
    let draw: TerraDraw | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;
    let handleLoad: (() => void) | null = null;
    let handleError: ((event: MapLibreErrorEvent) => void) | null = null;
    let handleChange: (() => void) | null = null;
    let handleFinish:
      | ((
          id: string | number,
          context: { mode: string; action: string },
        ) => void)
      | null = null;
    let handleSelect: ((id: string | number) => void) | null = null;
    let handleDeselect: ((id: string | number) => void) | null = null;
    let handleKeyDown: ((event: KeyboardEvent) => void) | null = null;

    paletteRef.current = readSpikePalette(container);

    const syncFeatures = (): void => {
      if (draw === null || suppressSyncRef.current) {
        return;
      }

      const snapshot = draw.getSnapshot();
      const result = sanitizeStoreSnapshot(snapshot);

      if (!result.ok) {
        return;
      }

      const records = toFeatureRecords(result.data.features);
      featuresRef.current = records;
      setFeatures(records);

      const selectedNow: string[] = [];

      for (const raw of snapshot) {
        if (raw.properties.selected !== true || raw.id === undefined) {
          continue;
        }

        const record = records.find((item) => item.id === String(raw.id));

        if (record === undefined) {
          continue;
        }

        if (!visibleRef.current[record.feature.properties.layer]) {
          try {
            draw.deselectFeature(raw.id);
          } catch {
            // La feature pudo desaparecer entre el snapshot y la selección.
          }
          continue;
        }

        selectedNow.push(record.id);
      }

      selectedIdsRef.current = selectedNow;
      setSelectedIds(selectedNow);
    };

    syncRef.current = syncFeatures;

    const reportEngineError = (detail: string): void => {
      queueMicrotask(() => {
        if (!disposed) {
          setStatus('error');
          setError(detail);
        }
      });
    };

    try {
      setWorkerUrl(workerUrl);
      map = new MapLibreMap({
        container,
        style: createInlineStyle(paletteRef.current.mapBg),
        center: [8, 26],
        zoom: 3,
        bearing: 0,
        pitch: 0,
        attributionControl: false,
        renderWorldCopies: false,
        dragRotate: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
        locale: { 'Map.Title': messages.mapsSpike.mapLabel },
      });
      mapRef.current = map;
      const currentMap = map;
      currentMap
        .getCanvas()
        .setAttribute('aria-describedby', MAP_CANVAS_HELP_ID);

      resizeObserver = new ResizeObserver(() => {
        if (!disposed) {
          currentMap.resize();
          setEnvironment(environmentLabel(currentMap));
        }
      });
      resizeObserver.observe(container);

      handleError = (event: MapLibreErrorEvent): void => {
        if (!disposed) {
          setStatus('error');
          setError(event.error.message);
        }
      };
      currentMap.on('error', handleError);

      themeObserver = new MutationObserver(() => {
        if (disposed) {
          return;
        }

        const nextTheme =
          document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        setTheme(nextTheme);
        paletteRef.current = readSpikePalette(container);
        currentMap.setPaintProperty(
          BACKGROUND_LAYER_ID,
          'background-color',
          paletteRef.current.mapBg,
        );

        if (draw === null) {
          return;
        }

        const update = draw.updateModeOptions as (
          modeName: string,
          modeOptions: { styles: Record<string, unknown> },
        ) => void;

        for (const modeName of ALL_MODES) {
          update.call(draw, modeName, {
            styles: stylesForMode(modeName, () => paletteRef.current),
          });
        }

        // Fuerza al adaptador a recalcular estilos en las tres fuentes sin
        // perder cámara, datos ni selección.
        const seen = new Set<string>();

        for (const feature of draw.getSnapshot()) {
          if (feature.properties.currentlyDrawing === true) {
            continue;
          }

          if (!seen.has(feature.geometry.type)) {
            seen.add(feature.geometry.type);

            if (feature.id === undefined) {
              continue;
            }

            try {
              draw.updateFeatureProperties(feature.id, {
                wcThemeTick: Date.now(),
              });
            } catch {
              // Una feature de guía o en edición puede rechazar la mutación.
            }
          }
        }
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });

      handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' || draw === null || disposed) {
          return;
        }

        if (draw.getModeState() === 'drawing') {
          const currentMode = draw.getMode();

          try {
            draw.setMode(currentMode);
          } catch {
            draw.setMode('select');
          }
          return;
        }

        for (const id of selectedIdsRef.current) {
          try {
            draw.deselectFeature(id);
          } catch {
            // La selección ya no existe.
          }
        }

        syncFeatures();
      };
      container.addEventListener('keydown', handleKeyDown);

      handleLoad = (): void => {
        if (disposed) {
          return;
        }

        try {
          const adapter = new TerraDrawMapLibreGLAdapter<MapLibreMap>({
            map: currentMap,
            prefixId: DRAW_PREFIX,
            coordinatePrecision: 7,
          });

          draw = new TerraDraw({
            adapter,
            modes: createDrawModes(() => paletteRef.current),
          });

          handleChange = (): void => {
            if (draw === null || draw.getModeState() === 'drawing') {
              return;
            }

            syncFeatures();
          };
          handleFinish = (
            id: string | number,
            context: { mode: string; action: string },
          ): void => {
            if (draw === null || context.action !== 'draw') {
              return;
            }

            if (!isSpikeMode(context.mode)) {
              return;
            }

            const layer = layerForMode(context.mode);

            if (layer === null) {
              return;
            }

            try {
              draw.updateFeatureProperties(id, { layer });
            } catch {
              return;
            }

            syncFeatures();
            setAnnouncement(
              messages.mapsSpike.announcements.featureDrawn(
                messages.mapsSpike.layers[layer],
              ),
            );
          };
          handleSelect = (id: string | number): void => {
            if (draw === null) {
              return;
            }

            const feature = draw.getSnapshotFeature(id);

            if (feature === undefined) {
              return;
            }

            const layer = feature.properties.layer;

            if (
              typeof layer === 'string' &&
              layer in visibleRef.current &&
              !visibleRef.current[layer as SpikeLayerId]
            ) {
              try {
                draw.deselectFeature(id);
              } catch {
                // Nada que deseleccionar.
              }
              setAnnouncement(messages.mapsSpike.announcements.hiddenSelect);
              return;
            }

            syncFeatures();
          };
          handleDeselect = (): void => {
            syncFeatures();
          };

          draw.on('change', handleChange);
          draw.on('finish', handleFinish);
          draw.on('select', handleSelect);
          draw.on('deselect', handleDeselect);
          draw.start();
          draw.setMode('select');
          drawRef.current = draw;
          syncFeatures();
          setStatus('ready');
          setError(null);
          setEnvironment(environmentLabel(currentMap));
        } catch (caught) {
          reportEngineError(
            caught instanceof Error
              ? caught.message
              : messages.mapsSpike.errors.engineFallback,
          );
        }
      };

      currentMap.on('load', handleLoad);
    } catch (caught) {
      reportEngineError(
        caught instanceof Error
          ? caught.message
          : messages.mapsSpike.errors.engineFallback,
      );
    }

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      container.removeEventListener('keydown', handleKeyDown ?? (() => {}));

      if (map !== null) {
        if (handleLoad !== null) {
          map.off('load', handleLoad);
        }
        if (handleError !== null) {
          map.off('error', handleError);
        }
      }

      if (draw !== null) {
        if (handleChange !== null) {
          draw.off('change', handleChange);
        }
        if (handleFinish !== null) {
          draw.off('finish', handleFinish);
        }
        if (handleSelect !== null) {
          draw.off('select', handleSelect);
        }
        if (handleDeselect !== null) {
          draw.off('deselect', handleDeselect);
        }

        try {
          draw.stop();
        } catch {
          // El mapa ya puede estar destruido.
        }
      }

      try {
        map?.remove();
      } catch {
        // La limpieza no debe romper StrictMode.
      }

      mapRef.current = null;
      drawRef.current = null;
      syncRef.current = null;
    };
  }, [messages, options.retryToken, retryTick]);

  useEffect(() => {
    visibleRef.current = visibleLayers;
  }, [visibleLayers]);

  const syncNow = useCallback((): void => {
    syncRef.current?.();
  }, []);

  const deselectAll = useCallback((): void => {
    const draw = drawRef.current;

    if (draw === null) {
      return;
    }

    for (const id of selectedIdsRef.current) {
      try {
        draw.deselectFeature(id);
      } catch {
        // Ya no existe.
      }
    }

    syncNow();
  }, [syncNow]);

  const setMode = useCallback(
    (next: SpikeMode): void => {
      const draw = drawRef.current;

      if (draw === null || busyRef.current !== 'idle') {
        return;
      }

      try {
        draw.setMode(next);
        setModeState(next);
      } catch {
        setAnnouncement(messages.mapsSpike.errors.modeFailed);
      }
    },
    [messages],
  );

  const deleteSelected = useCallback((): void => {
    const draw = drawRef.current;
    const ids = selectedIdsRef.current;

    if (draw === null || ids.length === 0) {
      return;
    }

    try {
      draw.removeFeatures([...ids]);
      syncNow();
      setAnnouncement(messages.mapsSpike.announcements.deleted(ids.length));
    } catch {
      setAnnouncement(messages.mapsSpike.errors.deleteFailed);
    }
  }, [messages, syncNow]);

  const deselect = useCallback((): void => {
    deselectAll();
    setAnnouncement(messages.mapsSpike.announcements.deselected);
  }, [deselectAll, messages]);

  const clearAll = useCallback(async (): Promise<void> => {
    const draw = drawRef.current;

    if (draw === null || busyRef.current !== 'idle') {
      return;
    }

    setBusy('clearing');
    busyRef.current = 'clearing';

    try {
      await nextFrame();
      draw.clear();
      draw.setMode('select');
      setModeState('select');
      syncNow();
      loadMsRef.current = null;
      setLoadMs(null);
      setMetricsReport(null);
      setMetricsPhase('idle');
      setImportError(null);
      setExports({});
      setExportErrors({});
      setAnnouncement(messages.mapsSpike.announcements.cleared);
    } catch {
      setAnnouncement(messages.mapsSpike.errors.clearFailed);
    } finally {
      setBusy('idle');
      busyRef.current = 'idle';
    }
  }, [messages, syncNow]);

  const loadDemo500 = useCallback(async (): Promise<void> => {
    const draw = drawRef.current;

    if (draw === null || busyRef.current !== 'idle') {
      return;
    }

    setBusy('generating');
    busyRef.current = 'generating';

    try {
      await nextFrame();
      const generated = generateSpikeFeatures();
      const storeFeatures = toStoreFeatures(generated);
      const started = performance.now();

      draw.clear();
      draw.setMode('select');
      setModeState('select');
      draw.addFeatures(storeFeatures);
      const elapsed = performance.now() - started;
      syncNow();
      loadMsRef.current = elapsed;
      setLoadMs(elapsed);
      setMetricsReport(null);
      setMetricsPhase('idle');
      setImportError(null);
      setExportErrors({});
      setAnnouncement(
        messages.mapsSpike.announcements.generated(generated.length),
      );
    } catch {
      setAnnouncement(messages.mapsSpike.errors.generateFailed);
    } finally {
      setBusy('idle');
      busyRef.current = 'idle';
    }
  }, [messages, syncNow]);

  const importFeatures = useCallback(
    async (file: File): Promise<void> => {
      const draw = drawRef.current;

      if (draw === null || busyRef.current !== 'idle') {
        return;
      }

      setBusy('importing');
      busyRef.current = 'importing';
      setImportError(null);

      try {
        if (file.size > SPIKE_GEOJSON_MAX_BYTES) {
          setImportError(
            messages.mapsSpike.errors.importCode.SPIKE_GEOJSON_TOO_LARGE,
          );
          return;
        }

        const text = await file.text();
        const parsed = parseImportedFeatureCollectionAuto(text);

        if (!parsed.ok) {
          setImportError(
            messages.mapsSpike.errors.importCode[parsed.error.code],
          );
          return;
        }

        if (
          featuresRef.current.length + parsed.data.features.length >
          SPIKE_GEOJSON_MAX_FEATURES
        ) {
          setImportError(messages.mapsSpike.errors.importCode.limit);
          return;
        }

        if (parsed.data.features.length === 0) {
          setImportError(messages.mapsSpike.errors.importCode.empty);
          return;
        }

        const storeFeatures = toStoreFeatures(parsed.data.features);
        suppressSyncRef.current = true;

        try {
          let added;

          try {
            added = draw.addFeatures(storeFeatures);
          } catch {
            cleanupImportedFeatures(draw, storeFeatures);
            throw new Error('La importación no se pudo completar.');
          }

          if (
            added.length !== storeFeatures.length ||
            added.some((validation) => validation.valid !== true)
          ) {
            cleanupImportedFeatures(draw, storeFeatures);
            setImportError(messages.mapsSpike.errors.importCode.partial);
            return;
          }
        } finally {
          suppressSyncRef.current = false;
        }

        syncNow();
        const importedCounts = countFeaturesByLayer(parsed.data.features);
        const layers = SPIKE_LAYERS.filter(
          (layer) => importedCounts[layer.id] > 0,
        ).map((layer) => messages.mapsSpike.layers[layer.id]);
        setAnnouncement(
          messages.mapsSpike.announcements.imported(
            parsed.data.features.length,
            formats.formatList(layers),
          ),
        );
      } catch {
        setImportError(messages.mapsSpike.errors.importCode.failed);
      } finally {
        setBusy('idle');
        busyRef.current = 'idle';
      }
    },
    [formats, messages, syncNow],
  );

  const saveExport = useCallback(
    async (kind: SpikeExportKind, bytes: Uint8Array): Promise<void> => {
      try {
        const result = await window.worldCraft.mapsSpike.saveExport({
          kind,
          content: bytes,
        });

        if (!result.ok) {
          setExportErrors((current) => ({
            ...current,
            [kind]: messages.mapsSpike.errors.exportFailed,
          }));
          return;
        }

        setExports((current) => ({
          ...current,
          [kind]: result.data,
        }));
        setExportErrors((current) => ({ ...current, [kind]: undefined }));
        setAnnouncement(
          messages.mapsSpike.export.saved(
            messages.mapsSpike.export.labels[kind],
            result.data.fileName,
            formats.formatBytes(result.data.bytes),
          ),
        );
      } catch {
        setExportErrors((current) => ({
          ...current,
          [kind]: messages.mapsSpike.errors.exportFailed,
        }));
      }
    },
    [formats, messages],
  );

  const currentViewport = useCallback(() => {
    const map = mapRef.current;
    const container = containerRef.current;

    if (map === null) {
      return null;
    }

    const center = map.getCenter();

    return {
      center: { lng: center.lng, lat: center.lat },
      zoom: map.getZoom(),
      width: Math.max(1, container?.clientWidth ?? map.getCanvas().clientWidth),
      height: Math.max(
        1,
        container?.clientHeight ?? map.getCanvas().clientHeight,
      ),
    };
  }, []);

  const exportSvg = useCallback(async (): Promise<void> => {
    const viewport = currentViewport();

    if (viewport === null || busyRef.current !== 'idle') {
      return;
    }

    setBusy('exporting');
    busyRef.current = 'exporting';

    try {
      const layers = visibleFeatureGroups(
        featuresRef.current,
        visibleRef.current,
      );

      if (Object.values(layers).every((group) => group.length === 0)) {
        return;
      }

      const result = serializeSpikeSvg({
        viewport,
        layers,
        style: buildSvgStyle(paletteRef.current),
        selectedIds: selectedIdsRef.current,
      });

      await saveExport('svg', new TextEncoder().encode(result.svg));
    } catch {
      setExportErrors((current) => ({
        ...current,
        svg: messages.mapsSpike.errors.exportFailed,
      }));
    } finally {
      setBusy('idle');
      busyRef.current = 'idle';
    }
  }, [currentViewport, messages, saveExport]);

  const capturePng = useCallback(async (): Promise<Uint8Array> => {
    const map = mapRef.current;
    const draw = drawRef.current;

    if (map === null) {
      throw new Error('Mapa no disponible');
    }

    const selected = [...selectedIdsRef.current];
    deselectAll();
    map.triggerRepaint();
    await nextFrame();

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        map.getCanvas().toBlob(resolve, 'image/png');
      });

      if (blob === null) {
        throw new Error('Sin imagen');
      }

      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      if (draw !== null) {
        for (const id of selected) {
          try {
            draw.selectFeature(id);
          } catch {
            // La feature ya no existe.
          }
        }
      }

      syncNow();
    }
  }, [deselectAll, syncNow]);

  const exportPng = useCallback(async (): Promise<void> => {
    if (busyRef.current !== 'idle') {
      return;
    }

    setBusy('exporting');
    busyRef.current = 'exporting';

    try {
      if (featuresRef.current.length === 0) {
        return;
      }

      await saveExport('png', await capturePng());
    } catch {
      setExportErrors((current) => ({
        ...current,
        png: messages.mapsSpike.errors.exportFailed,
      }));
    } finally {
      setBusy('idle');
      busyRef.current = 'idle';
    }
  }, [capturePng, messages, saveExport]);

  const exportGeoJson = useCallback(async (): Promise<void> => {
    if (busyRef.current !== 'idle') {
      return;
    }

    setBusy('exporting');
    busyRef.current = 'exporting';

    try {
      const layers = visibleFeatureGroups(
        featuresRef.current,
        visibleRef.current,
      );
      const collection = {
        type: 'FeatureCollection' as const,
        features: SPIKE_LAYERS.flatMap((layer) =>
          layers[layer.id].map((feature) => ({
            type: 'Feature' as const,
            geometry: feature.geometry,
            properties: {
              mode: feature.properties.mode,
              layer: feature.properties.layer,
            },
          })),
        ),
      };

      if (collection.features.length === 0) {
        return;
      }

      await saveExport(
        'geojson',
        new TextEncoder().encode(serializeFeatureCollection(collection)),
      );
    } catch {
      setExportErrors((current) => ({
        ...current,
        geojson: messages.mapsSpike.errors.exportFailed,
      }));
    } finally {
      setBusy('idle');
      busyRef.current = 'idle';
    }
  }, [messages, saveExport]);

  const exportReport = useCallback(
    async (kind: 'json' | 'markdown'): Promise<void> => {
      if (busyRef.current !== 'idle' || metricsReport === null) {
        return;
      }

      setBusy('exporting');
      busyRef.current = 'exporting';

      try {
        const text =
          kind === 'json'
            ? buildSpikeReportJson(metricsReport)
            : buildSpikeReportMarkdown(metricsReport);
        await saveExport(kind, new TextEncoder().encode(text));
      } catch {
        setExportErrors((current) => ({
          ...current,
          [kind]: messages.mapsSpike.errors.exportFailed,
        }));
      } finally {
        setBusy('idle');
        busyRef.current = 'idle';
      }
    },
    [messages, metricsReport, saveExport],
  );

  const exportReportJson = useCallback(
    () => exportReport('json'),
    [exportReport],
  );
  const exportReportMarkdown = useCallback(
    () => exportReport('markdown'),
    [exportReport],
  );

  const fitView = useCallback((): void => {
    const map = mapRef.current;
    const container = containerRef.current;
    const visible = featuresRef.current.filter(
      (record) => visibleRef.current[record.feature.properties.layer],
    );

    if (map === null || container === null || visible.length === 0) {
      return;
    }

    const bounds = computeFeaturesBounds(
      visible.map((record) => record.feature),
    );
    const fitted = fitBoundsToViewport(
      bounds,
      container.clientWidth,
      container.clientHeight,
      32,
    );

    if (fitted === null) {
      return;
    }

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    map.easeTo({
      center: [fitted.center.lng, fitted.center.lat],
      zoom: fitted.zoom,
      duration: reduced ? 0 : 160,
      essential: true,
    });
  }, []);

  const toggleLayer = useCallback(
    (layer: SpikeLayerId): void => {
      const map = mapRef.current;
      const draw = drawRef.current;
      const next = {
        ...visibleRef.current,
        [layer]: !visibleRef.current[layer],
      };

      visibleRef.current = next;
      setVisibleLayers(next);

      if (map !== null) {
        for (const id of LAYER_MAP_IDS[layer]) {
          try {
            map.setLayoutProperty(
              id,
              'visibility',
              next[layer] ? 'visible' : 'none',
            );
          } catch {
            // La capa puede no existir todavía.
          }
        }
      }

      if (!next[layer] && draw !== null) {
        const hiddenSelected = selectedIdsRef.current.filter((id) => {
          const record = featuresRef.current.find((item) => item.id === id);

          return record?.feature.properties.layer === layer;
        });

        for (const id of hiddenSelected) {
          try {
            draw.deselectFeature(id);
          } catch {
            // Ya no existe.
          }
        }

        if (hiddenSelected.length > 0) {
          setAnnouncement(messages.mapsSpike.announcements.hiddenSelection);
        }
      }

      syncNow();
    },
    [messages, syncNow],
  );

  const measurePerformance = useCallback(async (): Promise<void> => {
    const map = mapRef.current;
    const draw = drawRef.current;

    if (
      map === null ||
      draw === null ||
      busyRef.current !== 'idle' ||
      featuresRef.current.length < 500
    ) {
      return;
    }

    const loadMs = loadMsRef.current;

    if (loadMs === null) {
      return;
    }

    setEnvironment(environmentLabel(map));
    setBusy('measuring');
    busyRef.current = 'measuring';
    setMetricsPhase('measuring');
    const longTasks: number[] = [];
    const observer = (() => {
      try {
        const created = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTasks.push(entry.duration);
          }
        });
        created.observe({ entryTypes: ['longtask'] });

        return created;
      } catch {
        return null;
      }
    })();

    const originalCenter = map.getCenter();
    const originalZoom = map.getZoom();
    const panRuns: number[][] = [];
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    try {
      if (reduced) {
        panRuns.push([], [], []);
      } else {
        for (let run = 0; run < 3; run += 1) {
          const framesPromise = measureAnimationFrames({
            requestFrame: (callback) => requestAnimationFrame(callback),
            durationMs: 480,
          });
          map.panBy([run % 2 === 0 ? 80 : -80, 0], {
            duration: 480,
            easing: (value) => value,
          });
          panRuns.push([...(await framesPromise)]);
        }
      }

      map.jumpTo({ center: originalCenter, zoom: originalZoom });

      const viewport = currentViewport();
      const layers = visibleFeatureGroups(
        featuresRef.current,
        visibleRef.current,
      );
      const svgStarted = performance.now();
      const svg = serializeSpikeSvg({
        viewport: viewport ?? {
          center: { lng: 8, lat: 26 },
          zoom: 3,
          width: 1024,
          height: 700,
        },
        layers,
        style: buildSvgStyle(paletteRef.current),
        selectedIds: selectedIdsRef.current,
      });
      const svgMs = performance.now() - svgStarted;

      const pngStarted = performance.now();
      const pngBytes = await capturePng();
      const pngMs = performance.now() - pngStarted;

      const center = map.getCenter();
      const temporaryId = createFeatureId();
      let editMs = 0;
      suppressSyncRef.current = true;

      try {
        const validations = draw.addFeatures([
          {
            type: 'Feature',
            id: temporaryId,
            geometry: {
              type: 'Point',
              coordinates: [center.lng, center.lat],
            },
            properties: { mode: 'point', layer: 'places' },
          },
        ]);

        if (validations.length === 1 && validations[0]?.valid === true) {
          const editStarted = performance.now();

          draw.updateFeatureGeometry(temporaryId, {
            type: 'Point',
            coordinates: [center.lng + 0.0001, center.lat],
          });
          editMs = performance.now() - editStarted;
        }
      } catch {
        editMs = 0;
      } finally {
        if (draw.hasFeature(temporaryId)) {
          try {
            draw.removeFeatures([temporaryId]);
          } catch {
            // La feature temporal ya no existe.
          }
        }

        suppressSyncRef.current = false;
      }

      const base: Omit<SpikeRunMetrics, 'panFrameDurations'> = {
        featureCounts: countFeaturesByLayer(
          featuresRef.current.map((record) => record.feature),
        ),
        loadMs,
        editMs,
        svgMs,
        svgBytes: svg.metadata.bytes,
        pngMs,
        pngBytes: pngBytes.byteLength,
        longTaskDurations: longTasks,
      };
      const runs = panRuns.map((panFrameDurations) => ({
        ...base,
        panFrameDurations,
      })) as unknown as readonly [
        SpikeRunMetrics,
        SpikeRunMetrics,
        SpikeRunMetrics,
      ];
      const canvas = map.getCanvas();
      const environment: SpikeEnvironment = {
        appVersion: window.worldCraft.appInfo.version,
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        devicePixelRatio: window.devicePixelRatio,
        canvas: {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
        },
        theme,
        webGl2: true,
        webGlRenderer: readWebGlRenderer(map),
      };

      setMetricsReport(assembleSpikeReport({ environment, runs }));
      setMetricsPhase('ready');
      setAnnouncement(messages.mapsSpike.announcements.measured);
    } catch {
      setMetricsPhase('idle');
      setAnnouncement(messages.mapsSpike.errors.measureFailed);
    } finally {
      observer?.disconnect();
      setBusy('idle');
      busyRef.current = 'idle';
    }
  }, [capturePng, currentViewport, messages, theme]);

  const retryEngine = useCallback((): void => {
    setStatus('loading');
    setError(null);
    setFeatures([]);
    featuresRef.current = [];
    setSelectedIds([]);
    selectedIdsRef.current = [];
    setBusy('idle');
    busyRef.current = 'idle';
    setMetricsReport(null);
    setMetricsPhase('idle');
    setLoadMs(null);
    loadMsRef.current = null;
    setEnvironment('');
    setRetryTick((current) => current + 1);
  }, []);

  const actions: MapsSpikeActions = {
    setMode,
    deleteSelected,
    deselect,
    clearAll,
    loadDemo500,
    importFeatures,
    exportSvg,
    exportPng,
    exportGeoJson,
    exportReportJson,
    exportReportMarkdown,
    fitView,
    measurePerformance,
    toggleLayer,
    retryEngine,
    recheckWebgl: () => {},
    goHome: () => {
      window.location.hash = '';
    },
  };

  const state: MapsSpikeState = {
    status,
    error,
    mode,
    features,
    counts,
    visibleLayers,
    selected,
    busy,
    importError,
    exportErrors,
    exports,
    metrics: {
      report: metricsReport,
      loadMs,
      phase: metricsPhase,
      environment,
    },
    announcement,
    theme,
  };

  return { containerRef, state, actions };
}
