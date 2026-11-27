/**
 * Métricas puras del spike de mapas (#80).
 *
 * No mide directamente el DOM: recibe duraciones y timestamps de rAF ya
 * capturados por la capa de integración. Calcula percentiles, frames lentos,
 * long tasks y un informe reproducible de tres ejecuciones con medianas.
 * Nunca incluye fechas, rutas de archivo ni datos personales.
 */
import { SPIKE_FEATURE_SEED } from './feature-generator';
import type { SpikeLayerId } from './layers';

/** Estadísticos básicos de una muestra. */
export interface SpikePercentiles {
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
  readonly count: number;
}

/** Umbral de frame lento usado por el plan (33 ms ≈ 30 fps). */
export const SPIKE_FRAME_THRESHOLD_MS = 33;

/** Umbral estándar de long task. */
export const SPIKE_LONG_TASK_THRESHOLD_MS = 50;

/** Percentil con interpolación de rango más cercano; `p` en `[0, 1]`. */
export function percentile(
  values: readonly number[],
  p: number,
): number | null {
  const valid = values.filter((value) => Number.isFinite(value));

  if (valid.length === 0) {
    return null;
  }

  const sorted = [...valid].sort((left, right) => left - right);
  const clamped = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(clamped * sorted.length) - 1),
  );

  return sorted[index] as number;
}

/** Calcula p50, p95 y máximo de una muestra. */
export function computePercentiles(
  values: readonly number[],
): SpikePercentiles | null {
  const p50 = percentile(values, 0.5);
  const p95 = percentile(values, 0.95);
  const max = percentile(values, 1);
  const valid = values.filter((value) => Number.isFinite(value));

  if (p50 === null || p95 === null || max === null || valid.length === 0) {
    return null;
  }

  return { p50, p95, max, count: valid.length };
}

/** Convierte timestamps de `requestAnimationFrame` en duraciones. */
export function frameDurationsFromTimestamps(
  timestamps: readonly number[],
): readonly number[] {
  const durations: number[] = [];

  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = timestamps[index - 1];
    const current = timestamps[index];

    if (
      previous === undefined ||
      current === undefined ||
      !Number.isFinite(previous) ||
      !Number.isFinite(current)
    ) {
      continue;
    }

    const delta = current - previous;

    if (delta >= 0) {
      durations.push(delta);
    }
  }

  return durations;
}

/** Scheduler inyectable para medir frames sin depender del DOM. */
export type SpikeRequestFrame = (callback: (timestamp: number) => void) => void;

/**
 * Mide una ventana de `requestAnimationFrame` con un scheduler inyectable.
 *
 * La promesa resuelve con las duraciones entre frames consecutivos. El
 * consumidor pasa `window.requestAnimationFrame` en producción y un doble
 * determinista en las pruebas; este módulo no toca el DOM.
 */
export function measureAnimationFrames(options: {
  readonly requestFrame: SpikeRequestFrame;
  readonly durationMs: number;
  readonly maxFrames?: number;
}): Promise<readonly number[]> {
  const durationMs =
    Number.isFinite(options.durationMs) && options.durationMs > 0
      ? options.durationMs
      : 1000;
  const maxFramesOption = options.maxFrames ?? 600;
  const maxFrames =
    Number.isFinite(maxFramesOption) && maxFramesOption >= 2
      ? Math.floor(maxFramesOption)
      : 600;
  const timestamps: number[] = [];

  return new Promise((resolve) => {
    const step = (timestamp: number): void => {
      if (!Number.isFinite(timestamp)) {
        resolve([]);
        return;
      }

      timestamps.push(timestamp);
      const first = timestamps[0] as number;

      if (timestamp - first >= durationMs || timestamps.length >= maxFrames) {
        resolve(frameDurationsFromTimestamps(timestamps));
        return;
      }

      try {
        options.requestFrame(step);
      } catch {
        resolve(frameDurationsFromTimestamps(timestamps));
      }
    };

    try {
      options.requestFrame(step);
    } catch {
      resolve([]);
    }
  });
}

/** Resumen de frames de una interacción (por ejemplo, paneo). */
export interface SpikeFrameSummary {
  readonly frames: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
  readonly over33Ms: number;
}

/** Resume duraciones de frame y cuenta las que superan 33 ms. */
export function summarizeFrameDurations(
  durations: readonly number[],
): SpikeFrameSummary {
  const valid = durations.filter(
    (duration) => Number.isFinite(duration) && duration >= 0,
  );
  const stats = computePercentiles(valid);

  return {
    frames: valid.length,
    p50: stats?.p50 ?? 0,
    p95: stats?.p95 ?? 0,
    max: stats?.max ?? 0,
    over33Ms: valid.filter((duration) => duration > SPIKE_FRAME_THRESHOLD_MS)
      .length,
  };
}

/** Cuenta long tasks por encima del umbral (50 ms por defecto). */
export function countLongTasks(
  durations: readonly number[],
  threshold = SPIKE_LONG_TASK_THRESHOLD_MS,
): number {
  const limit = Number.isFinite(threshold)
    ? threshold
    : SPIKE_LONG_TASK_THRESHOLD_MS;

  return durations.filter(
    (duration) => Number.isFinite(duration) && duration > limit,
  ).length;
}

/** Entorno de ejecución sin rutas ni identificadores personales. */
export interface SpikeEnvironment {
  readonly appVersion: string;
  readonly userAgent: string;
  readonly hardwareConcurrency: number | null;
  readonly devicePixelRatio: number;
  readonly canvas: { readonly width: number; readonly height: number } | null;
  readonly theme: 'light' | 'dark';
  readonly webGl2: boolean;
  readonly webGlRenderer: string | null;
}

/** Datos capturados en una ejecución del escenario de carga. */
export interface SpikeRunMetrics {
  readonly featureCounts: Readonly<Record<SpikeLayerId, number>>;
  /** `null` si la carga de 500 no se ha medido en esta sesión. */
  readonly loadMs: number | null;
  readonly panFrameDurations: readonly number[];
  readonly editMs: number;
  readonly svgMs: number;
  readonly svgBytes: number;
  readonly pngMs: number;
  readonly pngBytes: number;
  readonly longTaskDurations: readonly number[];
}

/** Resumen numérico de una ejecución. */
export interface SpikeRunSummary {
  readonly loadMs: number | null;
  readonly panP50Ms: number;
  readonly panP95Ms: number;
  readonly panMaxMs: number;
  readonly framesOver33Ms: number;
  readonly editMs: number;
  readonly svgMs: number;
  readonly svgBytes: number;
  readonly pngMs: number;
  readonly pngBytes: number;
  readonly longTasks: number;
}

/** Umbrales go/no-go del plan de la issue. */
export interface SpikeThresholds {
  readonly loadMs: number;
  readonly panP95Ms: number;
  readonly svgMs: number;
  readonly svgBytes: number;
  readonly pngMs: number;
}

/** Umbrales aprobados para M2-01. */
export const DEFAULT_SPIKE_THRESHOLDS: SpikeThresholds = Object.freeze({
  loadMs: 1500,
  panP95Ms: 33,
  svgMs: 2000,
  svgBytes: 5 * 1024 * 1024,
  pngMs: 1000,
});

/** Comprobaciones de umbral. */
export interface SpikeChecks {
  readonly load: boolean;
  readonly pan: boolean;
  readonly svgTime: boolean;
  readonly svgSize: boolean;
  readonly png: boolean;
  readonly all: boolean;
}

/** Informe completo, reproducible y sin fecha. */
export interface SpikeReport {
  readonly format: 'world-craft-m2-01-spike-report';
  readonly formatVersion: 1;
  readonly seed: string;
  readonly environment: SpikeEnvironment;
  readonly featureCounts: Readonly<Record<SpikeLayerId, number>>;
  readonly runs: readonly [SpikeRunSummary, SpikeRunSummary, SpikeRunSummary];
  readonly medians: SpikeRunSummary;
  readonly thresholds: SpikeThresholds;
  readonly checks: SpikeChecks;
  readonly decision: 'go' | 'no-go';
  readonly limitations: readonly string[];
}

/** Límites metodológicos que viajan con el informe. */
export const SPIKE_REPORT_LIMITATIONS: readonly string[] = Object.freeze([
  'La edición se mide como una actualización de geometría sobre una feature temporal; no mide una edición manual de vértices.',
  'La carga de 500 mide la inserción en Terra Draw y no incluye el tiempo de generación determinista.',
  'Las tres pasadas de paneo comparten las mediciones de SVG, PNG y edición.',
]);

function medianNullable(values: readonly (number | null)[]): number | null {
  if (values.some((value) => value === null)) {
    return null;
  }

  return medianOf(values as readonly number[]);
}

function medianOf(values: readonly number[]): number {
  const stats = computePercentiles(values);

  return stats?.p50 ?? 0;
}

/** Resume una ejecución con percentiles y conteos. */
export function summarizeRun(run: SpikeRunMetrics): SpikeRunSummary {
  const frames = summarizeFrameDurations(run.panFrameDurations);

  return {
    loadMs: run.loadMs,
    panP50Ms: frames.p50,
    panP95Ms: frames.p95,
    panMaxMs: frames.max,
    framesOver33Ms: frames.over33Ms,
    editMs: run.editMs,
    svgMs: run.svgMs,
    svgBytes: run.svgBytes,
    pngMs: run.pngMs,
    pngBytes: run.pngBytes,
    longTasks: countLongTasks(run.longTaskDurations),
  };
}

function medianSummary(
  summaries: readonly [SpikeRunSummary, SpikeRunSummary, SpikeRunSummary],
): SpikeRunSummary {
  const loads = summaries.map((summary) => summary.loadMs);
  const panP50 = summaries.map((summary) => summary.panP50Ms);
  const panP95 = summaries.map((summary) => summary.panP95Ms);
  const panMax = summaries.map((summary) => summary.panMaxMs);
  const framesOver = summaries.map((summary) => summary.framesOver33Ms);
  const edit = summaries.map((summary) => summary.editMs);
  const svgMs = summaries.map((summary) => summary.svgMs);
  const svgBytes = summaries.map((summary) => summary.svgBytes);
  const pngMs = summaries.map((summary) => summary.pngMs);
  const pngBytes = summaries.map((summary) => summary.pngBytes);
  const longTasks = summaries.map((summary) => summary.longTasks);

  return {
    loadMs: medianNullable(loads),
    panP50Ms: medianOf(panP50),
    panP95Ms: medianOf(panP95),
    panMaxMs: medianOf(panMax),
    framesOver33Ms: medianOf(framesOver),
    editMs: medianOf(edit),
    svgMs: medianOf(svgMs),
    svgBytes: medianOf(svgBytes),
    pngMs: medianOf(pngMs),
    pngBytes: medianOf(pngBytes),
    longTasks: medianOf(longTasks),
  };
}

/**
 * Ensambla el informe de tres ejecuciones con medianas y go/no-go.
 *
 * El tipo de `runs` es una tupla de tres: no se puede generar el informe con
 * una sola medición ni con una lista arbitraria.
 */
export function assembleSpikeReport(options: {
  readonly environment: SpikeEnvironment;
  readonly runs: readonly [SpikeRunMetrics, SpikeRunMetrics, SpikeRunMetrics];
  readonly thresholds?: SpikeThresholds;
}): SpikeReport {
  const summaries = options.runs.map(summarizeRun) as [
    SpikeRunSummary,
    SpikeRunSummary,
    SpikeRunSummary,
  ];
  const medians = medianSummary(summaries);
  const thresholds = options.thresholds ?? DEFAULT_SPIKE_THRESHOLDS;
  const checks: SpikeChecks = {
    load: medians.loadMs !== null && medians.loadMs <= thresholds.loadMs,
    pan: medians.panP95Ms <= thresholds.panP95Ms,
    svgTime: medians.svgMs <= thresholds.svgMs,
    svgSize: medians.svgBytes <= thresholds.svgBytes,
    png: medians.pngMs <= thresholds.pngMs,
    all: false,
  };
  const all =
    checks.load && checks.pan && checks.svgTime && checks.svgSize && checks.png;

  return {
    format: 'world-craft-m2-01-spike-report',
    formatVersion: 1,
    seed: SPIKE_FEATURE_SEED,
    environment: options.environment,
    featureCounts: options.runs[0].featureCounts,
    runs: summaries,
    medians,
    thresholds: { ...thresholds },
    checks: { ...checks, all },
    decision: all ? 'go' : 'no-go',
    limitations: SPIKE_REPORT_LIMITATIONS,
  };
}
