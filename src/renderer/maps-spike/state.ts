/**
 * Estado y acciones del laboratorio de mapas (#80).
 *
 * Módulo puro: la vista presentacional puede probarse en jsdom sin importar
 * MapLibre ni Terra Draw. El hook y la página implementan esta interfaz, y los
 * tests de componentes construyen mocks con la misma forma.
 */
import type { SpikeExportKind } from '../../shared/contracts/maps-spike';
import type { SpikeFeature, SpikePosition } from './geojson';
import type { SpikeLayerId, SpikeMode } from './layers';
import type { SpikeReport } from './metrics';

/** Fase de arranque del motor del mapa. */
export type SpikeStatus = 'loading' | 'ready' | 'error' | 'unsupported';

/** Id de la ayuda visible asociada al canvas real de MapLibre. */
export const MAP_CANVAS_HELP_ID = 'wc-maps-spike-canvas-help';

/** Operación larga en curso; `idle` no bloquea la interfaz. */
export type SpikeBusy =
  'idle' | 'generating' | 'importing' | 'measuring' | 'exporting' | 'clearing';

/** Feature del laboratorio con el id interno del store. */
export interface SpikeFeatureRecord {
  readonly id: string;
  readonly feature: SpikeFeature;
}

/** Medidas de un elemento seleccionado. */
export interface SpikeSelectedItem {
  readonly id: string;
  readonly feature: SpikeFeature;
  readonly layer: SpikeLayerId;
  readonly mode: SpikeMode;
  readonly vertices: number;
  readonly coordinates: SpikePosition | null;
  readonly lengthMeters: number | null;
  readonly perimeterMeters: number | null;
  readonly areaSquareMeters: number | null;
}

/** Archivo exportado y visible en la pestaña Exportar. */
export interface SpikeExportFile {
  readonly fileName: string;
  readonly bytes: number;
}

/** Estado de la medición manual de rendimiento. */
export interface SpikeMetricsView {
  readonly report: SpikeReport | null;
  readonly loadMs: number | null;
  readonly phase: 'idle' | 'measuring' | 'ready';
  readonly environment: string;
}

/** Estado completo que consume `MapsSpikeView`. */
export interface MapsSpikeState {
  readonly status: SpikeStatus;
  readonly error: string | null;
  readonly mode: SpikeMode;
  readonly features: readonly SpikeFeatureRecord[];
  readonly counts: Readonly<Record<SpikeLayerId, number>>;
  readonly visibleLayers: Readonly<Record<SpikeLayerId, boolean>>;
  readonly selected: readonly SpikeSelectedItem[];
  readonly busy: SpikeBusy;
  readonly importError: string | null;
  readonly exportErrors: Partial<Record<SpikeExportKind, string>>;
  readonly exports: Partial<Record<SpikeExportKind, SpikeExportFile>>;
  readonly metrics: SpikeMetricsView;
  readonly announcement: string;
  readonly theme: 'light' | 'dark';
}

/** Acciones que la vista puede invocar; ninguna recibe rutas ni opciones ocultas. */
export interface MapsSpikeActions {
  readonly setMode: (mode: SpikeMode) => void;
  readonly deleteSelected: () => void;
  readonly deselect: () => void;
  readonly clearAll: () => Promise<void>;
  readonly loadDemo500: () => Promise<void>;
  readonly importFeatures: (file: File) => Promise<void>;
  readonly exportSvg: () => Promise<void>;
  readonly exportPng: () => Promise<void>;
  readonly exportGeoJson: () => Promise<void>;
  readonly exportReportJson: () => Promise<void>;
  readonly exportReportMarkdown: () => Promise<void>;
  readonly fitView: () => void;
  readonly measurePerformance: () => Promise<void>;
  readonly toggleLayer: (layer: SpikeLayerId) => void;
  readonly retryEngine: () => void;
  readonly recheckWebgl: () => void;
  readonly goHome: () => void;
}

/** Props de la vista presentacional. */
export interface MapsSpikeViewProps {
  readonly state: MapsSpikeState;
  readonly actions: MapsSpikeActions;
  readonly containerRef: { readonly current: HTMLDivElement | null };
}
