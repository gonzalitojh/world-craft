import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SPIKE_THRESHOLDS,
  assembleSpikeReport,
  computePercentiles,
  countLongTasks,
  frameDurationsFromTimestamps,
  measureAnimationFrames,
  percentile,
  summarizeFrameDurations,
  summarizeRun,
  type SpikeEnvironment,
  type SpikeRunMetrics,
} from '@/renderer/maps-spike/metrics';

const environment: SpikeEnvironment = {
  appVersion: '0.1.0',
  userAgent: 'World Craft E2E',
  hardwareConcurrency: 8,
  devicePixelRatio: 1,
  canvas: { width: 1024, height: 700 },
  theme: 'light',
  webGl2: true,
  webGlRenderer: 'Mesa',
};

function run(overrides: Partial<SpikeRunMetrics> = {}): SpikeRunMetrics {
  return {
    featureCounts: { regions: 250, paths: 170, places: 80 },
    loadMs: 100,
    panFrameDurations: [10, 20, 30],
    editMs: 5,
    svgMs: 50,
    svgBytes: 1000,
    pngMs: 80,
    pngBytes: 2000,
    longTaskDurations: [10, 60],
    ...overrides,
  };
}

describe('métricas del spike', () => {
  it('calcula percentiles y mediana sin mutar la muestra', () => {
    const values = [40, 10, 20, 30];

    expect(percentile(values, 0)).toBe(10);
    expect(percentile(values, 0.5)).toBe(20);
    expect(percentile(values, 0.95)).toBe(40);
    expect(percentile(values, 1)).toBe(40);
    expect(computePercentiles(values)).toEqual({
      p50: 20,
      p95: 40,
      max: 40,
      count: 4,
    });
    expect(values).toEqual([40, 10, 20, 30]);
    expect(computePercentiles([])).toBeNull();
    expect(percentile([Number.NaN], 0.5)).toBeNull();
  });

  it('convierte timestamps de rAF en duraciones válidas', () => {
    const durations = frameDurationsFromTimestamps([0, 16.7, 33.4, 60]);

    expect(durations).toHaveLength(3);
    expect(durations[0]).toBeCloseTo(16.7, 8);
    expect(durations[1]).toBeCloseTo(16.7, 8);
    expect(durations[2]).toBeCloseTo(26.6, 8);
    expect(frameDurationsFromTimestamps([0, Number.NaN, 20, 10])).toEqual([]);
  });

  it('mide frames con un scheduler inyectable', async () => {
    let callback: ((timestamp: number) => void) | null = null;
    const promise = measureAnimationFrames({
      requestFrame: (next) => {
        callback = next;
      },
      durationMs: 40,
      maxFrames: 10,
    });

    for (const timestamp of [0, 16, 32, 48]) {
      const step = callback as ((timestamp: number) => void) | null;

      expect(step).not.toBeNull();
      callback = null;
      step?.(timestamp);
    }

    await expect(promise).resolves.toEqual([16, 16, 16]);
  });

  it('resume frames lentos y long tasks', () => {
    expect(summarizeFrameDurations([10, 20, 33, 34, 50])).toEqual({
      frames: 5,
      p50: 33,
      p95: 50,
      max: 50,
      over33Ms: 2,
    });
    expect(countLongTasks([10, 50, 51, 100])).toBe(2);
    expect(countLongTasks([60], 100)).toBe(0);
  });

  it('resume una ejecución y ensambla tres con medianas', () => {
    const report = assembleSpikeReport({
      environment,
      runs: [run({ loadMs: 100 }), run({ loadMs: 110 }), run({ loadMs: 120 })],
    });

    expect(report.format).toBe('world-craft-m2-01-spike-report');
    expect(report.formatVersion).toBe(1);
    expect(report.seed).toBe('wc-80');
    expect(report.runs).toHaveLength(3);
    expect(report.medians.loadMs).toBe(110);
    expect(report.medians.panP95Ms).toBe(30);
    expect(report.medians.longTasks).toBe(1);
    expect(report.thresholds).toEqual(DEFAULT_SPIKE_THRESHOLDS);
    expect(report.checks.all).toBe(true);
    expect(report.decision).toBe('go');
    expect(report.limitations).toHaveLength(3);
    expect(report.featureCounts).toEqual({
      regions: 250,
      paths: 170,
      places: 80,
    });
  });

  it('marca no-go cuando un umbral no se cumple', () => {
    const report = assembleSpikeReport({
      environment,
      runs: [
        run({ loadMs: 5000 }),
        run({ loadMs: 5000 }),
        run({ loadMs: 5000 }),
      ],
      thresholds: { ...DEFAULT_SPIKE_THRESHOLDS, loadMs: 1500 },
    });

    expect(report.checks.load).toBe(false);
    expect(report.checks.pan).toBe(true);
    expect(report.checks.all).toBe(false);
    expect(report.decision).toBe('no-go');
  });

  it('deja la carga sin medir y no aprueba el check de carga', () => {
    const report = assembleSpikeReport({
      environment,
      runs: [
        run({ loadMs: null }),
        run({ loadMs: null }),
        run({ loadMs: null }),
      ],
    });

    expect(report.medians.loadMs).toBeNull();
    expect(report.checks.load).toBe(false);
    expect(report.checks.all).toBe(false);
    expect(report.decision).toBe('no-go');
  });

  it('resume una ejecución sin frames', () => {
    expect(summarizeRun(run({ panFrameDurations: [] }))).toMatchObject({
      panP50Ms: 0,
      panP95Ms: 0,
      panMaxMs: 0,
      framesOver33Ms: 0,
    });
  });
});
