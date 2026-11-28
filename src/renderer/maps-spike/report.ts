/**
 * Informe JSON y Markdown del spike de mapas (#80).
 *
 * Módulo puro y determinista: recibe el informe ya ensamblado y no consulta
 * fecha, entorno ni sistema de archivos. No incluye rutas absolutas, secretos
 * ni propiedades del usuario; el renderer y el usuarioAgent se escapan en
 * Markdown para no romper tablas.
 */
import {
  SPIKE_FRAME_THRESHOLD_MS,
  type SpikeReport,
  type SpikeRunSummary,
} from './metrics';
import { SPIKE_LAYERS } from './layers';

function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const rounded = Math.round(value * 10) / 10;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  const kib = bytes / 1024;

  if (kib < 1024) {
    return `${formatDecimal(kib)} KiB`;
  }

  return `${formatDecimal(kib / 1024)} MiB`;
}

function formatOptionalMs(value: number | null): string {
  return value === null ? 'Sin medir' : `${formatDecimal(value)} ms`;
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/**
 * Elimina rutas absolutas de los textos de entorno.
 *
 * El informe lo genera la aplicación, pero un user agent o un renderer WebGL
 * de una herramienta externa podría incluir una ruta. Se sustituye por
 * `<ruta>` para que ni el JSON ni el Markdown la publiquen.
 */
function redactPaths(value: string): string {
  return value
    .replace(/[A-Za-z]:\\[^\s|)]+/g, '<ruta>')
    .replace(/\/(?:Users|home|tmp|var|opt|private)\/[^\s|]+/g, '<ruta>')
    .replace(/file:\/\/[^\s|]+/g, '<ruta>');
}

function sanitizedReport(report: SpikeReport): SpikeReport {
  return {
    ...report,
    environment: {
      ...report.environment,
      userAgent: redactPaths(report.environment.userAgent),
      webGlRenderer:
        report.environment.webGlRenderer === null
          ? null
          : redactPaths(report.environment.webGlRenderer),
    },
  };
}

function yesNo(value: boolean): string {
  return value ? 'sí' : 'no';
}

function row(label: string, value: string): string {
  return `| ${label} | ${escapeMarkdown(value)} |`;
}

function runRow(
  label: string,
  selector: (summary: SpikeRunSummary) => string,
  report: SpikeReport,
): string {
  const first = selector(report.runs[0]);
  const second = selector(report.runs[1]);
  const third = selector(report.runs[2]);
  const median = selector(report.medians);

  return `| ${label} | ${first} | ${second} | ${third} | ${median} |`;
}

/** Serializa el informe como JSON estable con salto de línea final. */
export function buildSpikeReportJson(report: SpikeReport): string {
  return `${JSON.stringify(sanitizedReport(report), null, 2)}\n`;
}

/** Genera el informe legible en Markdown, sin rutas ni datos personales. */
export function buildSpikeReportMarkdown(report: SpikeReport): string {
  const safe = sanitizedReport(report);
  const environment = safe.environment;
  const counts = [
    ...SPIKE_LAYERS.map(
      (layer) => `| ${layer.id} | ${report.featureCounts[layer.id]} |`,
    ),
    `| **Total** | **${
      report.featureCounts.regions +
      report.featureCounts.paths +
      report.featureCounts.places
    }** |`,
  ];
  const checks = [
    `| Carga inicial | ${formatOptionalMs(report.medians.loadMs)} ≤ ${formatDecimal(report.thresholds.loadMs)} ms | ${yesNo(report.checks.load)} |`,
    `| Paneo p95 | ${formatDecimal(report.medians.panP95Ms)} ms ≤ ${formatDecimal(report.thresholds.panP95Ms)} ms | ${yesNo(report.checks.pan)} |`,
    `| SVG, tiempo | ${formatDecimal(report.medians.svgMs)} ms ≤ ${formatDecimal(report.thresholds.svgMs)} ms | ${yesNo(report.checks.svgTime)} |`,
    `| SVG, tamaño | ${formatBytes(report.medians.svgBytes)} ≤ ${formatBytes(report.thresholds.svgBytes)} | ${yesNo(report.checks.svgSize)} |`,
    `| PNG, tiempo | ${formatDecimal(report.medians.pngMs)} ms ≤ ${formatDecimal(report.thresholds.pngMs)} ms | ${yesNo(report.checks.png)} |`,
  ];

  return [
    '# Informe del spike de mapas M2-01 (#80)',
    '',
    `Formato: ${report.format} v${report.formatVersion}`,
    `Semilla: \`${report.seed}\``,
    `Decisión: **${report.decision === 'go' ? 'GO' : 'NO-GO'}**`,
    '',
    '## Entorno',
    '',
    '| Campo | Valor |',
    '|---|---|',
    row('Versión de la aplicación', environment.appVersion),
    row('Tema', environment.theme),
    row('WebGL2', environment.webGl2 ? 'disponible' : 'no disponible'),
    row('Renderer WebGL', environment.webGlRenderer ?? 'no disponible'),
    row('User agent', environment.userAgent),
    row(
      'Núcleos lógicos',
      environment.hardwareConcurrency === null
        ? 'no disponible'
        : String(environment.hardwareConcurrency),
    ),
    row('devicePixelRatio', formatDecimal(environment.devicePixelRatio)),
    row(
      'Canvas',
      environment.canvas === null
        ? 'no disponible'
        : `${environment.canvas.width} × ${environment.canvas.height}`,
    ),
    '',
    '## Features por capa',
    '',
    '| Capa | Features |',
    '|---|---:|',
    ...counts,
    '',
    '## Ejecuciones',
    '',
    `Tres ejecuciones; la mediana es el valor central. Frame lento: > ${SPIKE_FRAME_THRESHOLD_MS} ms.`,
    '',
    '| Métrica | Ejecución 1 | Ejecución 2 | Ejecución 3 | Mediana |',
    '|---|---:|---:|---:|---:|',
    runRow('Carga inicial (ms)', (run) => formatOptionalMs(run.loadMs), report),
    runRow('Paneo p50 (ms)', (run) => formatDecimal(run.panP50Ms), report),
    runRow('Paneo p95 (ms)', (run) => formatDecimal(run.panP95Ms), report),
    runRow('Paneo máximo (ms)', (run) => formatDecimal(run.panMaxMs), report),
    runRow('Frames > 33 ms', (run) => String(run.framesOver33Ms), report),
    runRow('Edición (ms)', (run) => formatDecimal(run.editMs), report),
    runRow('SVG (ms)', (run) => formatDecimal(run.svgMs), report),
    runRow('SVG (bytes)', (run) => formatBytes(run.svgBytes), report),
    runRow('PNG (ms)', (run) => formatDecimal(run.pngMs), report),
    runRow('PNG (bytes)', (run) => formatBytes(run.pngBytes), report),
    runRow('Long tasks', (run) => String(run.longTasks), report),
    '',
    '## Umbrales y decisión',
    '',
    '| Criterio | Mediana | Cumple |',
    '|---|---|---|',
    ...checks,
    '',
    `Resultado: **${report.checks.all ? 'todos los umbrales se cumplen' : 'algún umbral no se cumple'}**.`,
    '',
    '## Limitaciones de la medición',
    '',
    ...report.limitations.map((limitation) => `- ${limitation}`),
    '',
    'Los datos de este informe son locales y no incluyen rutas del equipo ni contenido del usuario.',
    '',
  ].join('\n');
}
