import { describe, expect, it } from 'vitest';

import {
  assembleSpikeReport,
  type SpikeEnvironment,
  type SpikeRunMetrics,
} from '@/renderer/maps-spike/metrics';
import {
  buildSpikeReportJson,
  buildSpikeReportMarkdown,
} from '@/renderer/maps-spike/report';

const environment: SpikeEnvironment = {
  appVersion: '0.1.0',
  userAgent: 'World Craft C:\\Users\\persona\\AppData\\Local\\world-craft',
  hardwareConcurrency: 8,
  devicePixelRatio: 1.25,
  canvas: { width: 1024, height: 700 },
  theme: 'dark',
  webGl2: true,
  webGlRenderer: 'ANGLE (C:\\controladores\\gpu.dll)',
};

function run(overrides: Partial<SpikeRunMetrics> = {}): SpikeRunMetrics {
  return {
    featureCounts: { regions: 250, paths: 170, places: 80 },
    loadMs: 200,
    panFrameDurations: [10, 20, 30],
    editMs: 5,
    svgMs: 100,
    svgBytes: 2048,
    pngMs: 120,
    pngBytes: 4096,
    longTaskDurations: [60],
    ...overrides,
  };
}

function report(overrides: Partial<SpikeRunMetrics> = {}) {
  return assembleSpikeReport({
    environment,
    runs: [run(overrides), run(overrides), run(overrides)],
  });
}

describe('informe del spike', () => {
  it('serializa JSON estable y sin rutas absolutas', () => {
    const markdownReport = report();
    const json = buildSpikeReportJson(markdownReport);
    const parsed = JSON.parse(json) as {
      readonly format: string;
      readonly environment: { readonly userAgent: string };
    };

    expect(json).toBe(buildSpikeReportJson(markdownReport));
    expect(json.endsWith('\n')).toBe(true);
    expect(parsed.format).toBe('world-craft-m2-01-spike-report');
    expect(parsed.environment.userAgent).toContain('<ruta>');
    expect(json).toContain('limitations');
    expect(json).toContain('feature temporal');
    expect(json).not.toContain('C:\\Users');
    expect(json).not.toContain('controladores');
  });

  it('genera Markdown con tablas, decisión y sin rutas', () => {
    const text = buildSpikeReportMarkdown(report());

    expect(text).toBe(buildSpikeReportMarkdown(report()));
    expect(text).toContain('# Informe del spike de mapas M2-01 (#80)');
    expect(text).toContain('**GO**');
    expect(text).toContain('| Carga inicial (ms) |');
    expect(text).toContain('| regions | 250 |');
    expect(text).toContain('| **Total** | **500** |');
    expect(text).toContain('## Limitaciones de la medición');
    expect(text).toContain('feature temporal');
    expect(text).not.toContain('C:\\Users');
    expect(text).not.toContain('C:\\controladores');
    expect(text).toContain('<ruta>');
  });

  it('refleja no-go y escapa barras verticales del entorno', () => {
    const noGo = assembleSpikeReport({
      environment: { ...environment, userAgent: 'a|b' },
      runs: [
        run({ loadMs: 9000 }),
        run({ loadMs: 9000 }),
        run({ loadMs: 9000 }),
      ],
    });
    const text = buildSpikeReportMarkdown(noGo);

    expect(text).toContain('**NO-GO**');
    expect(text).toContain('a\\|b');
    expect(text).toContain('algún umbral no se cumple');
  });
});
