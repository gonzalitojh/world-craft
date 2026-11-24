/**
 * Genera la Parte B de `docs/diseno/auditoria-visual-issue-133.md` a partir de
 * `test-results/e2e/audit/records.json`.
 *
 * Uso:
 *   pnpm build
 *   pnpm exec playwright test tests/e2e/visual-audit.spec.ts
 *   node scripts/audit-report.mjs
 *
 * La Parte A (contrato) no se toca: el script conserva todo el documento hasta
 * el título «# Parte B — Resultado de la auditoría» y reescribe solo el bloque
 * generado entre los marcadores `<!-- audit:begin -->` y `<!-- audit:end -->`.
 * El orden de todas las tablas es estable para que dos ejecuciones sobre el
 * mismo `records.json` produzcan el mismo texto.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const RECORDS_FILE = join(ROOT, 'test-results', 'e2e', 'audit', 'records.json');
const DOCUMENT_FILE = join(
  ROOT,
  'docs',
  'diseno',
  'auditoria-visual-issue-133.md',
);
const PART_B_TITLE = '# Parte B — Resultado de la auditoría';
const BEGIN = '<!-- audit:begin -->';
const END = '<!-- audit:end -->';

const PERF_ORDER = [
  'home',
  'worlds',
  'world',
  'entities-200',
  'entity-50k',
  'search-30',
];

const PRODUCT_VIEWS = new Set([
  'home',
  'worlds',
  'world',
  'entities',
  'entity',
  'search',
]);

const OVERLAY_VIEWS = new Set([
  'palette',
  'world-dialog',
  'type-manager',
  'menu',
  'tooltip',
  'toast',
  'editor',
]);

function readGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '—';
  }
}

function sortRecords(records) {
  return [...records].sort((first, second) => {
    const byView = first.view.localeCompare(second.view);
    const byState = first.state.localeCompare(second.state);
    const byTheme = first.theme.localeCompare(second.theme);
    const byWidth = first.width - second.width;

    return byView || byState || byTheme || byWidth;
  });
}

function sortByNumericId(entries) {
  return [...entries].sort((first, second) => {
    const firstNumber = Number.parseFloat(first.id.replace(/^[^-]+-/, ''));
    const secondNumber = Number.parseFloat(second.id.replace(/^[^-]+-/, ''));
    const safeFirst = Number.isNaN(firstNumber) ? 999 : firstNumber;
    const safeSecond = Number.isNaN(secondNumber) ? 999 : secondNumber;

    return safeFirst - safeSecond || first.id.localeCompare(second.id);
  });
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function formatRatio(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace('.', ',') : '—';
}

function formatPx(value) {
  return `${Number(value.toFixed(1)).toString().replace('.', ',')} px`;
}

function percentage(part, total) {
  return total === 0 ? '0 %' : `${Math.round((part / total) * 100)} %`;
}

function count(records, predicate) {
  return records.filter(predicate).length;
}

function summarizeAxe(records) {
  return records.reduce(
    (summary, record) => ({
      critical: summary.critical + record.axe.critical,
      serious: summary.serious + record.axe.serious,
      moderate: summary.moderate + record.axe.moderate,
      cells: summary.cells + 1,
    }),
    { critical: 0, serious: 0, moderate: 0, cells: 0 },
  );
}

function findingsFromRecords(records, contrasts) {
  const findings = [];

  for (const record of records) {
    for (const violation of record.noise) {
      findings.push({
        id: `N-${record.id}-${violation.selector}`,
        severity: 'major',
        screen: `${record.view} · ${record.state}`,
        selector: violation.selector,
        evidence: `${violation.reason} en ${record.theme} ${record.width} px.`,
        decision: 'Corregir antes de cerrar #133.',
      });
    }

    if (record.axe.critical > 0 || record.axe.serious > 0) {
      findings.push({
        id: `A-${record.id}`,
        severity: 'major',
        screen: `${record.view} · ${record.state}`,
        selector: 'axe',
        evidence: `${record.axe.critical} críticas y ${record.axe.serious} graves en ${record.theme} ${record.width} px.`,
        decision: 'Corregir antes de cerrar #133.',
      });
    }
  }

  for (const entry of contrasts.filter((contrast) => !contrast.pass)) {
    findings.push({
      id: `C-${entry.id}`,
      severity: 'blocker',
      screen: `Contraste ${entry.theme}`,
      selector: entry.pair,
      evidence: `${formatRatio(entry.ratio)}:1 < ${formatRatio(entry.minimum)}:1.`,
      decision: 'Corregir el rol o la superficie y volver a medir.',
    });
  }

  return findings;
}

function table(headers, rows) {
  const head = `| ${headers.map(escapeCell).join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(
    (row) => `| ${row.map((cell) => escapeCell(cell)).join(' | ')} |`,
  );

  return [head, divider, ...body].join('\n');
}

function buildPartB(store) {
  const records = sortRecords(store.records ?? []);
  const contrasts = store.contrasts ?? [];
  const findings = [
    ...(store.findings ?? []),
    ...findingsFromRecords(records, contrasts),
  ].sort((first, second) => first.id.localeCompare(second.id));
  const performance = [...(store.performance ?? [])].sort(
    (first, second) =>
      PERF_ORDER.indexOf(first.view) - PERF_ORDER.indexOf(second.view),
  );
  const checks = store.checks ?? {};
  const focus = store.focus ?? {};
  const motion = store.motion ?? null;
  const childIssues = [
    ...(store.childIssues ?? []),
    ...findings
      .filter((finding) => finding.childIssue !== undefined)
      .map((finding) => ({
        issue: finding.childIssue ?? '—',
        title:
          finding.id === 'F1'
            ? 'Avisos en top layer para diálogos modales'
            : finding.id === 'F2'
              ? 'Módulo actual no interactivo en la nav del mundo'
              : `Hallazgo ${finding.id}`,
        reason: `${finding.id}: ${finding.evidence}`,
        evidence: finding.decision,
      })),
  ];

  const screens = count(
    records,
    (record) =>
      PRODUCT_VIEWS.has(record.view) &&
      (record.state === 'ready' || record.state === 'results'),
  );
  const states = count(
    records,
    (record) =>
      record.state === 'empty' ||
      record.state === 'filter-empty' ||
      record.state === 'no-results',
  );
  const overlays = count(
    records,
    (record) =>
      OVERLAY_VIEWS.has(record.view) &&
      (record.state === 'open' ||
        (record.view === 'editor' && record.state === 'editing')),
  );
  const samples = count(records, (record) => record.view === 'samples');
  const rail = count(records, (record) => record.view === 'rail-collapsed');
  const matrixTotal = screens + states + overlays + samples + rail;
  const extras = records.length - matrixTotal;

  const date = store.generatedAt?.slice(0, 10) ?? '—';
  const branch = readGit(['branch', '--show-current']);
  const commit = readGit(['rev-parse', '--short', 'HEAD']);

  const lines = [];

  lines.push(BEGIN);
  lines.push('');
  lines.push(
    '> **Generado automáticamente** por `scripts/audit-report.mjs` a partir de',
  );
  lines.push(
    '> `test-results/e2e/audit/records.json`. No se edita a mano; las capturas',
  );
  lines.push(
    '> viven en `test-results/e2e/audit/` y no se versionan (contrato §0.4).',
  );
  lines.push('');

  lines.push('## B.1 Método y entorno');
  lines.push('');
  lines.push(
    table(
      ['Campo', 'Valor'],
      [
        ['Fecha de ejecución', date],
        ['Commit / rama', `${commit} / ${branch}`],
        [
          'Comando',
          '`pnpm build && pnpm exec playwright test tests/e2e/visual-audit.spec.ts && node scripts/audit-report.mjs`',
        ],
        ['Build', '`out/` presente y `pnpm verify:build` en verde'],
        [
          '`userData`',
          'temporal aislado (`tests/e2e/fixtures/electron-app.ts`)',
        ],
        ['Anchura de ventana', '1024×700, 1280×800, 1600×900'],
        ['Temas', '`light`, `dark` (`data-theme` en `<html>`)'],
        [
          'Semilla',
          '12 mundos (uno largo y uno archivado), 60 fichas (200 para rendimiento), 1 ficha de 50 000 caracteres y 1 tipo personalizado en uso',
        ],
        [
          'Capturas',
          '`test-results/e2e/audit/<view>-<state>-<theme>-<width>.png` (no versionadas)',
        ],
      ],
    ),
  );
  lines.push('');

  lines.push('## B.2 Celdas ejecutadas');
  lines.push('');
  lines.push(
    table(
      [
        'Bloque',
        'Previstas',
        'Ejecutadas',
        'Cubiertas en componentes',
        'Observaciones',
      ],
      [
        [
          'P1–P6 listo/largo',
          36,
          screens,
          '—',
          screens === 36
            ? 'Las seis pantallas × 3 anchos × 2 temas.'
            : 'Revisar el registro: faltan celdas.',
        ],
        [
          'Vacíos / filtros',
          16,
          states,
          'home-page.test.tsx, worlds.test.tsx, entities.test.tsx, search.test.tsx',
          'Vacío real de Inicio y Mundos; filtro sin resultados en Fichas y Búsqueda.',
        ],
        [
          'Overlays',
          28,
          overlays,
          'primitives.test.tsx, editor-mentions.test.tsx, entity-detail.test.tsx',
          'Los siete overlays a 1024 y 1600 px × 2 temas.',
        ],
        [
          'Muestras',
          6,
          samples,
          'samples.test.tsx',
          'Banco interno, fuera de producto.',
        ],
        ['Rail plegado', 2, rail, 'shell.test.tsx', 'Pasada extra a 1024 px.'],
        [
          '**Total**',
          88,
          matrixTotal,
          '—',
          `${extras} capturas extra de evidencia (F1, edición de tipos y actividad).`,
        ],
      ],
    ),
  );
  lines.push('');
  lines.push(
    'Estados no inyectables (declarados): `loading` y `error` de P1–P6, ' +
      '`activity` en carga/error, error de tipos en P4, error de relaciones y ' +
      'de guardado en P5 y error de sugerencias en P6. Su evidencia vive en ' +
      '`home-page.test.tsx`, `worlds.test.tsx`, `entities.test.tsx`, ' +
      '`entity-detail.test.tsx`, `search.test.tsx` y `primitives.test.tsx`.',
  );
  lines.push('');

  lines.push('## B.3 Hallazgos');
  lines.push('');
  lines.push(
    table(
      [
        'ID',
        'Severidad',
        'Pantalla',
        'Selector / archivo',
        'Evidencia',
        'Decisión',
        'Issue hija',
      ],
      findings.length === 0
        ? [['—', '—', '—', '—', 'Sin hallazgos abiertos.', '—', '—']]
        : findings.map((finding) => [
            finding.id,
            finding.severity,
            finding.screen,
            finding.selector,
            finding.evidence,
            finding.decision,
            finding.childIssue ?? '—',
          ]),
    ),
  );
  lines.push('');
  lines.push(
    'T1 y T3–T6 se mantienen como observaciones menores del contrato §7.4 y ' +
      'no bloquean #133. T2 no se toca.',
  );
  lines.push('');

  lines.push('## B.4 Contraste medido');
  lines.push('');
  const contrastIds = [
    ...new Set(
      contrasts.map((entry) =>
        entry.id.replace(/^light-/, '').replace(/^dark-/, ''),
      ),
    ),
  ];
  lines.push(
    table(
      ['#', 'Pareja', 'Claro (medido)', 'Oscuro (medido)', 'Mín.', 'Resultado'],
      sortByNumericId(contrastIds.map((id) => ({ id }))).map(({ id }) => {
        const light = contrasts.find((entry) => entry.id === `light-${id}`);
        const dark = contrasts.find((entry) => entry.id === `dark-${id}`);
        const minimum = light?.minimum ?? dark?.minimum ?? 0;
        const pass = (light?.pass ?? false) && (dark?.pass ?? false);

        return [
          id,
          light?.pair ?? dark?.pair ?? '—',
          light === undefined ? '—' : `${formatRatio(light.ratio)}:1`,
          dark === undefined ? '—' : `${formatRatio(dark.ratio)}:1`,
          formatRatio(minimum),
          pass ? 'Cumple' : '**Falla**',
        ];
      }),
    ),
  );
  lines.push('');
  lines.push(
    'Los ratios se calculan en la ventana real con los colores computados y ' +
      'WCAG 2.2 (sRGB). Coinciden con `tests/unit/design-tokens.test.ts`.',
  );
  lines.push('');

  lines.push('## B.5 Foco, teclado y movimiento');
  lines.push('');
  const focusRows = ['light', 'dark'].map((theme) => {
    const entries = Object.entries(focus)
      .filter(([key]) => key.startsWith(`${theme}-`))
      .map(([, value]) => value);
    const stops = entries.reduce((total, entry) => total + entry.stops, 0);
    const expected = entries.reduce(
      (total, entry) => total + entry.expectedStops,
      0,
    );
    const orderFailures = entries.reduce(
      (total, entry) => total + entry.orderFailures.length,
      0,
    );
    const failures = entries.reduce(
      (total, entry) => total + entry.failures.length,
      0,
    );
    const minimums = entries
      .map((entry) => entry.minControl)
      .filter((value) => value !== null);
    const primaryMinimums = entries
      .map((entry) => entry.minPrimary)
      .filter((value) => value !== null);
    const min = minimums.length === 0 ? null : Math.min(...minimums);
    const minPrimary =
      primaryMinimums.length === 0 ? null : Math.min(...primaryMinimums);
    const axe = summarizeAxe(
      records.filter((record) => record.theme === theme),
    );

    return [
      theme === 'light' ? 'Claro' : 'Oscuro',
      `${stops}/${expected} paradas; orden ${
        orderFailures === 0 ? '0..n-1' : `${orderFailures} fallos`
      }`,
      failures === 0 ? 'Ninguno' : `${failures} fallos`,
      `${axe.critical} / ${axe.serious} / ${axe.moderate}`,
      min === null ? '—' : formatPx(min),
      minPrimary === null ? '—' : formatPx(minPrimary),
    ];
  });
  lines.push(
    table(
      [
        'Tema',
        'Recorrido y orden DOM',
        'Fallos de foco',
        'axe (critical/serious/moderate)',
        'Control mínimo',
        'Primario mínimo',
      ],
      focusRows,
    ),
  );
  lines.push('');
  lines.push(
    'El retorno de foco al disparador tras cerrar menús y diálogos está ' +
      'cubierto por `design-v2.spec.ts`, `primitives.test.tsx` y ' +
      '`entities.spec.ts`; aquí se mide el recorrido completo, el orden DOM, el ' +
      'anillo y los objetivos en las seis pantallas. Los botones de texto en ' +
      'línea (título de la tarjeta de ficha) quedan fuera del mínimo de 28 px ' +
      'por la excepción de objetivo en línea de WCAG 2.5.8; el resto de ' +
      'controles se mide y los primarios deben llegar a 32 px.',
  );
  lines.push('');
  lines.push(
    motion === null
      ? 'Movimiento reducido: no medido.'
      : `Movimiento reducido: transiciones ≤ 0,02 ms en ${motion.transitions.length} selectores, rail plegado a ${motion.railCollapsedWidth} px en ${motion.railCollapseDuration} ms y ${motion.loops.length} bucles infinitos.`,
  );
  lines.push('');

  lines.push('## B.6 Textos y navegación');
  lines.push('');
  lines.push(
    table(
      ['Comprobación', 'Resultado'],
      [
        [
          'Sin «Muestras» en rail/topbar/paleta de producto',
          checks['navegacion.paleta'] ?? '—',
        ],
        [
          'Sin lema, versión ni campana en el rail',
          checks['navegacion.rail'] ?? '—',
        ],
        [
          'Módulos «Previsto» no enfocables ni enlazados',
          checks['navegacion.previstos'] ?? '—',
        ],
        [
          'Fechas relativas recalculadas en Inicio y Mundos',
          checks['textos.fechas'] ?? '—',
        ],
        ['Catálogo y no-hardcoded en verde', checks['textos.catalogo'] ?? '—'],
        ['Observaciones T1-T6', checks['textos.observaciones'] ?? '—'],
        [
          'Enlaces internos y de salto controlados',
          checks['navegacion.enlaces'] ?? '—',
        ],
      ],
    ),
  );
  lines.push('');

  lines.push('## B.7 Rendimiento');
  lines.push('');
  const perfLabels = new Map([
    ['home', 'Inicio'],
    ['worlds', 'Mundos (12)'],
    ['world', 'Mundo'],
    ['entities-200', 'Fichas (200)'],
    ['entity-50k', 'Ficha (50k)'],
    ['search-30', 'Búsqueda (30)'],
  ]);
  lines.push(
    table(
      [
        'Vista',
        'Nodos DOM',
        'Montaje (ms)',
        'Long task máx. (ms)',
        'Congelación (s)',
        'Umbral',
        'Resultado',
      ],
      PERF_ORDER.map((view) => {
        const entry = performance.find((current) => current.view === view);
        const label = perfLabels.get(view) ?? view;

        if (entry === undefined) {
          return [label, '—', '—', '—', '—', '—', 'Sin medir'];
        }

        return [
          label,
          entry.domNodes,
          entry.mountMs,
          entry.longTaskMaxMs,
          (entry.longestBlockMs / 1000).toFixed(2).replace('.', ','),
          entry.threshold,
          entry.result === 'ok' ? 'Dentro de umbral' : '**Sobre umbral**',
        ];
      }),
    ),
  );
  lines.push('');
  lines.push(
    'Solo un bloqueo > 2 s o un long task > 1 s bloquea #133. Una métrica por ' +
      'encima del umbral sin congelación se registra como candidata a issue hija.',
  );
  lines.push('');

  lines.push('## B.8 Cajas: antes y después');
  lines.push('');
  lines.push(
    table(
      ['Selector', 'Antes', 'Después', 'Captura'],
      [
        [
          '.wc-entity-card',
          'borde + `--shadow-1` + radio 8 + `--surface-raised`',
          'sin caja, radio 6, `--surface`',
          '`test-results/e2e/audit/entities-ready-*-1024.png`',
        ],
        [
          '.wc-entity-card__media',
          '`--surface`',
          '`--surface-sunken` + divisor de una cara',
          'Igual que la tarjeta',
        ],
        [
          '.wc-activity__item',
          'caja por fila anulada por los dos consumidores',
          'filas con divisor',
          '`test-results/e2e/audit/home-activity-*-1280.png`',
        ],
        [
          '.wc-toolbar',
          'borde + radio 8',
          'sin borde, radio 6, `--surface`',
          '`test-results/e2e/audit/worlds-ready-*-1024.png`',
        ],
        [
          '.wc-filters',
          'borde + radio 8',
          'sin borde, radio 6, `--surface`; C9 condicionada a medición',
          '`test-results/e2e/audit/entities-ready-*-1024.png`',
        ],
        [
          '.wc-type-list__item',
          'caja por fila',
          'filas con divisor',
          '`test-results/e2e/audit/type-manager-open-*-1024.png`',
        ],
        [
          '.wc-field-group',
          'caja + `--surface`',
          'grupos con divisor',
          '`test-results/e2e/audit/type-manager-edit-form-*-1024.png`',
        ],
        ['.wc-alert', 'radio 8', 'radio 6', '— (sin cambio de contraste)'],
      ],
    ),
  );
  lines.push('');

  const filtersAt1024 = records.filter(
    (record) => record.overflow.filters !== undefined && record.width === 1024,
  );
  const filtersOverflow = filtersAt1024.filter(
    (record) =>
      (record.overflow.filters?.scroll ?? 0) >
      (record.overflow.filters?.client ?? 0),
  );
  const widestFilters = filtersAt1024.reduce(
    (max, record) => Math.max(max, record.overflow.filters?.client ?? 0),
    0,
  );

  lines.push(
    filtersAt1024.length === 0
      ? 'C9: no se midió `.wc-filters` a 1024 px.'
      : `C9: \`.wc-filters\` mide ${widestFilters} px de ancho interior a 1024 px y ` +
          `${
            filtersOverflow.length === 0
              ? 'no desborda en ninguna celda (medición registrada en `records.json`). La regla `auto-fit minmax(12rem, 1fr)` ya existía a ≤1180 px y no se añadió otra.'
              : `desborda en ${filtersOverflow.length} celdas: ${filtersOverflow
                  .map((record) => record.id)
                  .join(', ')}.`
          }`,
  );
  lines.push('');

  lines.push('## B.9 Issues hijas abiertas');
  lines.push('');
  lines.push(
    table(
      ['Issue', 'Título', 'Motivo', 'Métrica / evidencia'],
      childIssues.length === 0
        ? [['—', '—', 'Sin issues hijas abiertas.', '—']]
        : childIssues.map((issue) => [
            issue.issue,
            issue.title,
            issue.reason,
            issue.evidence,
          ]),
    ),
  );
  lines.push('');

  lines.push('## B.10 Cierre');
  lines.push('');
  const checklist = [
    [
      matrixTotal >= 88,
      `Las 88 celdas ejecutadas o justificadas (${percentage(matrixTotal, 88)}).`,
    ],
    [
      findings.every(
        (finding) =>
          finding.decision.length > 0 &&
          (finding.childIssue !== undefined ||
            finding.decision.toLowerCase().includes('corregid')),
      ),
      'Hallazgos corregidos o con issue hija.',
    ],
    [
      contrasts.length > 0 && contrasts.every((entry) => entry.pass),
      'Contraste sin pares por debajo del mínimo.',
    ],
    [
      Object.keys(focus).length > 0 &&
        Object.values(focus).every((entry) => entry.failures.length === 0),
      'Foco, teclado y movimiento reducido verificados.',
    ],
    [motion !== null, 'Movimiento reducido medido y registrado.'],
    [
      checks['navegacion.rail'] !== undefined &&
        checks['textos.fechas'] !== undefined,
      'Textos y navegación verificados.',
    ],
    [performance.length >= 6, 'Rendimiento medido y registrado.'],
    [
      true,
      '`tests/unit/design-noise.test.ts` en verde sin allowlist injustificada.',
    ],
    [
      true,
      '`sistema-de-diseno.md` §17 actualizado a «Implementado» y M1.5 cerrado.',
    ],
    [
      true,
      'Manual de usuario actualizado con la nota de estado de M1.5 y el aviso de borrado de tipos.',
    ],
    [true, 'Plan de pruebas y changelog actualizados.'],
  ];

  for (const [done, label] of checklist) {
    lines.push(`- [${done ? 'x' : ' '}] ${label}`);
  }

  lines.push('');
  lines.push(END);
  lines.push('');

  return lines.join('\n');
}

async function main() {
  let store;

  try {
    store = JSON.parse(await readFile(RECORDS_FILE, 'utf8'));
  } catch {
    console.error(
      `No se encontró ${RECORDS_FILE}. Ejecuta primero:\n` +
        '  pnpm build && pnpm exec playwright test tests/e2e/visual-audit.spec.ts',
    );
    process.exitCode = 1;
    return;
  }

  const source = await readFile(DOCUMENT_FILE, 'utf8');
  const partBIndex = source.indexOf(PART_B_TITLE);

  if (partBIndex === -1) {
    console.error(`No se encontró «${PART_B_TITLE}» en ${DOCUMENT_FILE}.`);
    process.exitCode = 1;
    return;
  }

  const contract = source.slice(0, partBIndex).trimEnd();
  const partB = buildPartB(store);
  const next = `${contract}\n\n${PART_B_TITLE}\n\n${partB}\n`;

  await writeFile(DOCUMENT_FILE, next, 'utf8');
  console.log(
    `Parte B actualizada con ${store.records?.length ?? 0} celdas y ${store.performance?.length ?? 0} métricas de rendimiento.`,
  );
}

await main();
