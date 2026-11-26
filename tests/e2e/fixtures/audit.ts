import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { ElectronApplication, Page } from '@playwright/test';

import { es as messages } from '../../../src/renderer/messages/es';

import { analyzeWithAxe } from './axe';
import { expect } from './electron-app';

/**
 * Arnés de la auditoría visual de #133.
 *
 * Agrupa la semilla determinista, las mediciones (overflow, tema, contraste,
 * foco, ruido, rendimiento y movimiento reducido), las capturas y el registro
 * que alimenta `scripts/audit-report.mjs`. No escribe en `%APPDATA%`: todo vive
 * en el `userData` temporal del fixture `electron-app.ts` y en
 * `test-results/e2e/audit/`.
 */

export type ThemeName = 'light' | 'dark';
export type AuditWidth = 1024 | 1280 | 1600;

export const AUDIT_DIR = path.join(
  process.cwd(),
  'test-results',
  'e2e',
  'audit',
);
export const AUDIT_RECORDS_FILE = path.join(AUDIT_DIR, 'records.json');

export const AUDIT_WIDTHS: readonly AuditWidth[] = [1024, 1280, 1600];
export const AUDIT_HEIGHTS: Record<AuditWidth, number> = {
  1024: 700,
  1280: 800,
  1600: 900,
};

/**
 * Valores esperados de `--bg` y `--fg` por tema.
 *
 * Fuente: `styles/tokens/semantic.css` → `styles/tokens/palette.css`.
 * Claro: neutral-100 `#f6f4ef` sobre neutral-800 `#222723`.
 * Oscuro: neutral-900 `#141715` con neutral-100 `#f6f4ef`.
 */
const EXPECTED_THEME_TOKENS: Record<
  ThemeName,
  {
    readonly bg: readonly [number, number, number];
    readonly fg: readonly [number, number, number];
  }
> = {
  light: { bg: [246, 244, 239], fg: [34, 39, 35] },
  dark: { bg: [20, 23, 21], fg: [246, 244, 239] },
};

export const AUDIT_DATA = {
  primaryWorld: 'Las Mareas Grises',
  firstEntity: 'Ficha 01 de las mareas del alba'.padEnd(120, ' y del norte'),
  longEntity: 'Crónica de las mareas del norte',
  extremeEntity: 'El atlas imposible',
  customType: 'Lugar ritual',
  impossibleQuery: 'zzzz-sin-resultados',
  searchQuery: 'Ficha',
  worldNames: [
    'Las Mareas Grises',
    'El Bosque de Ceniza',
    'La Ciudad Sumergida',
    'La Ruta de las Especias',
    'El Archipiélago de Vidrio',
    'El Imperio de Sal',
    'Las Estepas Silenciosas',
    'El Jardín de los Relojes',
    'La Frontera de Cobre',
    'El Mar de Tinta',
    'La Torre de los Vientos',
    'El Archivo Olvidado',
  ],
} as const;

export interface AuditSeed {
  readonly primaryWorldId: string;
  readonly primaryWorldName: string;
  readonly longEntityId: string;
  readonly longEntityName: string;
  readonly extremeEntityId: string;
  readonly extremeEntityName: string;
  readonly customTypeId: string;
  readonly customTypeName: string;
  readonly worldCount: number;
  readonly entityCount: number;
}

export interface AuditOverflow {
  readonly document: { readonly client: number; readonly scroll: number };
  readonly body: { readonly client: number; readonly scroll: number };
  readonly main: { readonly client: number; readonly scroll: number };
  readonly filters?: { readonly client: number; readonly scroll: number };
}

export interface AuditAxeSummary {
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly violations: readonly string[];
}

export interface AuditNoiseViolation {
  readonly selector: string;
  readonly reason: string;
}

export interface AuditContrastEntry {
  readonly id: string;
  readonly pair: string;
  readonly theme: ThemeName;
  readonly ratio: number;
  readonly minimum: number;
  readonly pass: boolean;
}

export interface AuditFocusResult {
  readonly tabindexPositive: readonly string[];
  readonly stops: number;
  readonly expectedStops: number;
  readonly order: readonly number[];
  readonly orderFailures: readonly string[];
  readonly failures: readonly string[];
  readonly minControl: number | null;
  readonly minControlLabel: string | null;
  readonly minPrimary: number | null;
  readonly minPrimaryLabel: string | null;
}

export interface AuditMotionResult {
  readonly transitions: readonly {
    readonly selector: string;
    readonly duration: number;
  }[];
  readonly railCollapsedWidth: number;
  readonly railCollapseDuration: number;
  readonly loops: readonly string[];
}

export interface AuditPerformanceEntry {
  readonly view: string;
  readonly width: number;
  readonly theme: ThemeName;
  readonly domNodes: number;
  readonly mountMs: number;
  readonly longTaskMaxMs: number;
  readonly longestBlockMs: number;
  readonly threshold: string;
  readonly result: 'ok' | 'over-budget';
}

export interface AuditFinding {
  readonly id: string;
  readonly severity: 'blocker' | 'major' | 'minor';
  readonly screen: string;
  readonly selector: string;
  readonly evidence: string;
  readonly decision: string;
  readonly childIssue?: string;
}

export interface AuditChildIssue {
  readonly issue: string;
  readonly title: string;
  readonly reason: string;
  readonly evidence: string;
}

export interface AuditRecord {
  readonly id: string;
  readonly view: string;
  readonly state: string;
  readonly theme: ThemeName;
  readonly width: AuditWidth;
  readonly height: number;
  readonly themeAttr: string;
  readonly tokens: { readonly bg: string; readonly fg: string };
  readonly overflow: AuditOverflow;
  readonly axe: AuditAxeSummary;
  readonly noise: readonly AuditNoiseViolation[];
  readonly screenshot: string;
  readonly notes: readonly string[];
}

export interface AuditStoreFile {
  readonly generatedAt: string;
  readonly records: readonly AuditRecord[];
  readonly findings: readonly AuditFinding[];
  readonly childIssues: readonly AuditChildIssue[];
  readonly performance: readonly AuditPerformanceEntry[];
  readonly checks: Readonly<Record<string, string>>;
  readonly contrasts: readonly AuditContrastEntry[];
  readonly focus: Readonly<Record<string, AuditFocusResult>>;
  readonly motion: AuditMotionResult | null;
}

const emptyStore = (): AuditStoreFile => ({
  generatedAt: new Date().toISOString(),
  records: [],
  findings: [],
  childIssues: [],
  performance: [],
  checks: {},
  contrasts: [],
  focus: {},
  motion: null,
});

let store: AuditStoreFile | null = null;

async function persist(): Promise<void> {
  if (store === null) {
    return;
  }

  await fs.mkdir(AUDIT_DIR, { recursive: true });
  await fs.writeFile(
    AUDIT_RECORDS_FILE,
    `${JSON.stringify(store, null, 2)}\n`,
    'utf8',
  );
}

export async function resetAuditStore(): Promise<void> {
  store = emptyStore();
  await persist();
}

export async function recordAuditRecord(record: AuditRecord): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = {
    ...store,
    records: [
      ...store.records.filter((entry) => entry.id !== record.id),
      record,
    ],
  };
  await persist();
}

export async function recordAuditEntry(
  patch: Partial<Omit<AuditStoreFile, 'generatedAt'>>,
): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = { ...store, ...patch };
  await persist();
}

export async function recordFinding(finding: AuditFinding): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = {
    ...store,
    findings: [
      ...store.findings.filter((entry) => entry.id !== finding.id),
      finding,
    ],
  };
  await persist();
}

export async function recordCheck(key: string, value: string): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = { ...store, checks: { ...store.checks, [key]: value } };
  await persist();
}

export async function recordContrast(
  entries: readonly AuditContrastEntry[],
): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = {
    ...store,
    contrasts: [
      ...store.contrasts.filter(
        (entry) => !entries.some((next) => next.id === entry.id),
      ),
      ...entries,
    ],
  };
  await persist();
}

export async function recordFocus(
  key: string,
  result: AuditFocusResult,
): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = { ...store, focus: { ...store.focus, [key]: result } };
  await persist();
}

export async function recordPerformance(
  entry: AuditPerformanceEntry,
): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = {
    ...store,
    performance: [
      ...store.performance.filter((current) => current.view !== entry.view),
      entry,
    ],
  };
  await persist();
}

export async function recordMotion(result: AuditMotionResult): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = { ...store, motion: result };
  await persist();
}

export async function recordChildIssue(issue: AuditChildIssue): Promise<void> {
  if (store === null) {
    store = emptyStore();
  }

  store = {
    ...store,
    childIssues: [
      ...store.childIssues.filter((entry) => entry.title !== issue.title),
      issue,
    ],
  };
  await persist();
}

export async function flushAuditStore(): Promise<void> {
  await persist();
}

/** Espera a las fuentes y a dos frames para medir el layout ya asentado. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        void document.fonts.ready.then(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });
      }),
  );
}

export async function setAuditViewport(
  electronApp: ElectronApplication,
  page: Page,
  width: AuditWidth,
): Promise<void> {
  const height = AUDIT_HEIGHTS[width];

  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      const main = BrowserWindow.getAllWindows()[0];

      if (main === undefined) {
        throw new Error('No hay ventana principal.');
      }

      main.setContentSize(size.width, size.height);
    },
    { width, height },
  );

  await settle(page);

  const innerWidth = await page.evaluate(() => window.innerWidth);

  expect(
    Math.abs(innerWidth - width),
    `La ventana mide ${innerWidth} px y se pidió ${width} px`,
  ).toBeLessThanOrEqual(1);
}

export async function applyAuditTheme(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  const html = page.locator('html');
  const current = await html.getAttribute('data-theme');

  if (current !== theme) {
    const currentLabel =
      current === 'dark'
        ? messages.shell.theme.currentDark
        : messages.shell.theme.currentLight;

    await page
      .getByRole('button', {
        name: messages.shell.theme.switchLabel(currentLabel),
      })
      .click();
  }

  await expect(html).toHaveAttribute('data-theme', theme);
  await settle(page);
}

export async function measureView(
  page: Page,
  selectors: readonly string[] = [],
): Promise<{
  themeAttr: string;
  tokens: { bg: string; fg: string };
  overflow: AuditOverflow;
  noise: readonly AuditNoiseViolation[];
  tabindexPositive: readonly string[];
}> {
  return page.evaluate((extraSelectors) => {
    const documentElement = document.documentElement;
    const body = document.body;
    const main = document.getElementById('wc-main');

    const read = (
      element: Element | null,
    ): { client: number; scroll: number } => ({
      client: element?.clientWidth ?? 0,
      scroll: element?.scrollWidth ?? 0,
    });

    const filters = document.querySelector<HTMLElement>('.wc-filters');
    const filtersMetrics =
      filters === null
        ? undefined
        : {
            client: filters.clientWidth,
            scroll: filters.scrollWidth,
          };

    const probes = document.createElement('span');
    probes.style.display = 'none';
    probes.style.color = 'var(--fg)';
    probes.style.backgroundColor = 'var(--bg)';
    document.body.append(probes);

    const probeStyle = getComputedStyle(probes);
    const tokens = {
      fg: probeStyle.color,
      bg: probeStyle.backgroundColor,
    };

    probes.remove();

    const isExempt = (element: HTMLElement): boolean =>
      element.closest(
        '.wc-alert, .wc-page__status, .wc-gallery__item, .wc-entity-cover, .wc-search-hit, .wc-editor__toolbar, .wc-editor__content, .wc-image-picker__item, .wc-toast, .wc-menu__list, .wc-tooltip__bubble, .wc-swatch, .wc-inline-confirm',
      ) !== null;

    const contentSelectors = [
      '.wc-page__section',
      '.wc-card',
      '.wc-world-card',
      '.wc-world-grid__item',
      '.wc-entity-card',
      '.wc-entity-grid',
      '.wc-panel',
      '.wc-continue__panel',
      '.wc-entity-properties',
      '.wc-activity__item',
      '.wc-type-list__item',
      '.wc-field-group',
      '.wc-toolbar',
      '.wc-filters',
      '.wc-disclosure',
      '.wc-empty',
      '.wc-world-header',
      '.wc-world-data',
      '.wc-home-activity',
      '.wc-world-activity',
      '.wc-relation-item',
    ];

    const describe = (element: Element): string => {
      const htmlElement = element as HTMLElement;
      const className =
        typeof htmlElement.className === 'string'
          ? htmlElement.className.split(/\s+/).filter(Boolean).join('.')
          : '';

      return `${element.tagName.toLowerCase()}${className.length > 0 ? `.${className}` : ''}`;
    };

    const violations: { selector: string; reason: string }[] = [];

    const inspect = (element: Element): void => {
      const htmlElement = element as HTMLElement;
      const style = getComputedStyle(htmlElement);
      const sides = [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ].map((value) => Number.parseFloat(value) || 0);
      const styles = [
        style.borderTopStyle,
        style.borderRightStyle,
        style.borderBottomStyle,
        style.borderLeftStyle,
      ];
      const perimeter = sides.every(
        (side, index) => side > 0 && styles[index] !== 'none',
      );
      const shadow =
        style.boxShadow !== 'none' && style.boxShadow.trim().length > 0;
      const radius = Number.parseFloat(style.borderTopLeftRadius) || 0;

      if (perimeter) {
        violations.push({
          selector: describe(htmlElement),
          reason: 'borde perimetral',
        });
      }

      if (shadow) {
        violations.push({
          selector: describe(htmlElement),
          reason: `sombra ${style.boxShadow}`,
        });
      }

      if (radius > 6) {
        violations.push({
          selector: describe(htmlElement),
          reason: `radio ${style.borderTopLeftRadius}`,
        });
      }
    };

    for (const selector of [...contentSelectors, ...extraSelectors]) {
      for (const element of document.querySelectorAll(selector)) {
        if (isExempt(element as HTMLElement)) {
          continue;
        }

        inspect(element);
      }
    }

    for (const element of document.querySelectorAll(
      'main article, main section',
    )) {
      if (isExempt(element as HTMLElement)) {
        continue;
      }

      inspect(element);
    }

    const tabindexPositive = [
      ...document.querySelectorAll<HTMLElement>('[tabindex]'),
    ]
      .filter((element) => Number(element.getAttribute('tabindex')) > 0)
      .map((element) => describe(element));

    return {
      themeAttr: documentElement.getAttribute('data-theme') ?? '',
      tokens,
      overflow: {
        document: read(documentElement),
        body: read(body),
        main: read(main),
        ...(filtersMetrics === undefined ? {} : { filters: filtersMetrics }),
      },
      noise: violations,
      tabindexPositive,
    };
  }, selectors);
}

export function expectNoOverflow(overflow: AuditOverflow, label: string): void {
  expect(
    overflow.document.scroll,
    `${label}: scroll horizontal del documento ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(overflow.document.client);
  expect(
    overflow.body.scroll,
    `${label}: scroll horizontal del body ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(overflow.body.client);
  expect(
    overflow.main.scroll,
    `${label}: scroll horizontal de main ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(overflow.main.client + 1);

  if (overflow.filters !== undefined) {
    expect(
      overflow.filters.scroll,
      `${label}: scroll horizontal de .wc-filters ${JSON.stringify(overflow.filters)}`,
    ).toBeLessThanOrEqual(overflow.filters.client);
  }
}

export async function runAxe(page: Page): Promise<AuditAxeSummary> {
  const results = await analyzeWithAxe(page, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  });

  // Guarda de motor: un fallo de inyección no puede pasar en silencio.
  expect(results.testEngine.name).toBe('axe-core');
  expect(
    results.passes.length +
      results.violations.length +
      results.incomplete.length,
  ).toBeGreaterThan(0);

  const of = (impact: string) =>
    results.violations.filter((violation) => violation.impact === impact);

  return {
    critical: of('critical').length,
    serious: of('serious').length,
    moderate: of('moderate').length,
    violations: results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'sin impacto'}): ${violation.help}`,
    ),
  };
}

export function expectAxeClean(summary: AuditAxeSummary, label: string): void {
  expect(
    summary.violations.filter(
      (violation) =>
        violation.includes('(critical)') || violation.includes('(serious)'),
    ),
    `${label}: axe con violaciones graves`,
  ).toEqual([]);
}

export async function takeAuditScreenshot(
  page: Page,
  view: string,
  state: string,
  theme: ThemeName,
  width: AuditWidth,
  scrollSelector?: string,
): Promise<string> {
  await settle(page);
  await page.evaluate((selector) => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    for (const container of document.querySelectorAll<HTMLElement>(
      '#wc-main, .wc-dialog__body, .wc-entity-properties, .wc-menu__list',
    )) {
      container.scrollTop = 0;
    }

    if (selector !== undefined) {
      document
        .querySelector<HTMLElement>(selector)
        ?.scrollIntoView({ block: 'start' });
    }
  }, scrollSelector);
  await settle(page);
  await fs.mkdir(AUDIT_DIR, { recursive: true });

  const file = path.join(AUDIT_DIR, `${view}-${state}-${theme}-${width}.png`);

  await page.screenshot({ path: file, animations: 'disabled' });

  return path.relative(process.cwd(), file).replaceAll('\\', '/');
}

const CONTRAST_PAIRS = [
  { id: '1', pair: '--fg / --bg', fg: '--fg', bg: '--bg', min: 4.5 },
  {
    id: '2',
    pair: '--fg / --surface',
    fg: '--fg',
    bg: '--surface',
    min: 4.5,
  },
  {
    id: '3',
    pair: '--fg / --surface-raised',
    fg: '--fg',
    bg: '--surface-raised',
    min: 4.5,
  },
  {
    id: '4',
    pair: '--fg / --surface-sunken',
    fg: '--fg',
    bg: '--surface-sunken',
    min: 4.5,
  },
  { id: '5', pair: '--muted / --bg', fg: '--muted', bg: '--bg', min: 4.5 },
  {
    id: '6',
    pair: '--muted / --surface',
    fg: '--muted',
    bg: '--surface',
    min: 4.5,
  },
  {
    id: '7',
    pair: '--muted / --surface-raised',
    fg: '--muted',
    bg: '--surface-raised',
    min: 4.5,
  },
  {
    id: '8',
    pair: '--muted / --surface-sunken',
    fg: '--muted',
    bg: '--surface-sunken',
    min: 4.5,
  },
  {
    id: '9',
    pair: '--accent / --bg',
    fg: '--accent',
    bg: '--bg',
    min: 4.5,
  },
  {
    id: '10',
    pair: '--accent / --accent-surface',
    fg: '--accent',
    bg: '--accent-surface',
    min: 4.5,
  },
  {
    id: '11',
    pair: '--accent-strong / --bg',
    fg: '--accent-strong',
    bg: '--bg',
    min: 4.5,
  },
  {
    id: '12',
    pair: '--accent-contrast / --accent',
    fg: '--accent-contrast',
    bg: '--accent',
    min: 4.5,
  },
  {
    id: '13',
    pair: '--fg / --danger-surface',
    fg: '--fg',
    bg: '--danger-surface',
    min: 4.5,
  },
  {
    id: '14',
    pair: '--danger / --danger-surface',
    fg: '--danger',
    bg: '--danger-surface',
    min: 3,
  },
  {
    id: '15',
    pair: '--danger-contrast / --danger',
    fg: '--danger-contrast',
    bg: '--danger',
    min: 4.5,
  },
  {
    id: '16',
    pair: '--success / --success-surface',
    fg: '--success',
    bg: '--success-surface',
    min: 4.5,
  },
  {
    id: '17',
    pair: '--warning / --warning-surface',
    fg: '--warning',
    bg: '--warning-surface',
    min: 4.5,
  },
  {
    id: '18',
    pair: '--warning / --surface-raised',
    fg: '--warning',
    bg: '--surface-raised',
    min: 3,
  },
  {
    id: '19',
    pair: '--disabled-text / --disabled-surface',
    fg: '--disabled-text',
    bg: '--disabled-surface',
    min: 4.5,
  },
  {
    id: '20',
    pair: '--disabled-border / --disabled-surface',
    fg: '--disabled-border',
    bg: '--disabled-surface',
    min: 3,
  },
  {
    id: '21a',
    pair: '--border-strong / --bg',
    fg: '--border-strong',
    bg: '--bg',
    min: 3,
  },
  {
    id: '21b',
    pair: '--border-strong / --surface',
    fg: '--border-strong',
    bg: '--surface',
    min: 3,
  },
  {
    id: '22',
    pair: '--fg / --selection',
    fg: '--fg',
    bg: '--selection',
    min: 4.5,
  },
] as const;

const FOCUS_BACKGROUNDS = [
  '--bg',
  '--surface',
  '--surface-raised',
  '--surface-sunken',
  '--accent-surface',
] as const;

const ENTITY_COLORS = ['moss', 'ochre', 'danger', 'prussian'] as const;

interface ContrastTarget {
  readonly id: string;
  readonly pair: string;
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
}

function contrastTargets(): ContrastTarget[] {
  const targets: ContrastTarget[] = CONTRAST_PAIRS.map((pair) => ({
    id: pair.id,
    pair: pair.pair,
    fg: pair.fg,
    bg: pair.bg,
    min: pair.min,
  }));

  for (const background of FOCUS_BACKGROUNDS) {
    targets.push({
      id: `22-${background.replace(/^--/, '')}`,
      pair: `--focus / ${background}`,
      fg: '--focus',
      bg: background,
      min: 3,
    });
  }

  for (const color of ENTITY_COLORS) {
    targets.push({
      id: `24-${color}`,
      pair: `--entity-${color} / --entity-${color}-surface`,
      fg: `--entity-${color}`,
      bg: `--entity-${color}-surface`,
      min: 3,
    });
  }

  return targets;
}

type Rgba = readonly [number, number, number, number];

function parseColor(value: string): Rgba | null {
  const match = /rgba?\(([^)]+)\)/.exec(value);

  if (match === null) {
    return null;
  }

  const parts = (match[1] ?? '')
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);

  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

/**
 * Comprueba que `--bg` y `--fg` computados son los del tema activo.
 *
 * Los valores salen de la cadena `semantic.css` → `palette.css`; si el tema no
 * se aplicara, Claro y Oscuro devolverían el mismo par o uno inesperado.
 */
export function expectThemeTokens(
  theme: ThemeName,
  tokens: { readonly bg: string; readonly fg: string },
): void {
  const expected = EXPECTED_THEME_TOKENS[theme];
  const bg = parseColor(tokens.bg);
  const fg = parseColor(tokens.fg);

  expect(bg, `--bg computado en ${theme}: ${tokens.bg}`).not.toBeNull();
  expect(fg, `--fg computado en ${theme}: ${tokens.fg}`).not.toBeNull();
  expect(
    bg?.slice(0, 3),
    `--bg de ${theme} no coincide con semantic.css`,
  ).toEqual(expected.bg);
  expect(
    fg?.slice(0, 3),
    `--fg de ${theme} no coincide con semantic.css`,
  ).toEqual(expected.fg);

  const other = theme === 'light' ? 'dark' : 'light';
  const otherExpected = EXPECTED_THEME_TOKENS[other];

  expect(expected.bg, 'bg debe diferir entre temas').not.toEqual(
    otherExpected.bg,
  );
  expect(expected.fg, 'fg debe diferir entre temas').not.toEqual(
    otherExpected.fg,
  );
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Rgba): number {
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

function contrastRatio(first: Rgba, second: Rgba): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export async function measureContrast(
  page: Page,
  theme: ThemeName,
): Promise<readonly AuditContrastEntry[]> {
  const targets = contrastTargets();

  const colors = await page.evaluate((entries) => {
    const probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.append(probe);
    const resolved = entries.map((entry) => {
      probe.style.color = `var(${entry.fg})`;
      const fg = getComputedStyle(probe).color;
      probe.style.backgroundColor = `var(${entry.bg})`;
      const bg = getComputedStyle(probe).backgroundColor;

      return { id: entry.id, fg, bg };
    });

    probe.remove();

    return resolved;
  }, targets);

  return targets.map((target) => {
    const resolved = colors.find((entry) => entry.id === target.id);
    const fg = parseColor(resolved?.fg ?? '');
    const bg = parseColor(resolved?.bg ?? '');

    if (fg === null || bg === null) {
      throw new Error(`No se pudo medir el contraste de ${target.pair}`);
    }

    const ratio = contrastRatio(fg, bg);

    return {
      id: `${theme}-${target.id}`,
      pair: target.pair,
      theme,
      ratio: Number(ratio.toFixed(2)),
      minimum: target.min,
      pass: ratio >= target.min,
    };
  });
}

export async function auditFocus(page: Page): Promise<AuditFocusResult> {
  const global = await page.evaluate(() => {
    const positive = [
      ...document.querySelectorAll<HTMLElement>('[tabindex]'),
    ].filter((element) => Number(element.getAttribute('tabindex')) > 0);

    const probe = document.createElement('span');
    probe.style.color = 'var(--focus)';
    document.body.append(probe);
    const focusColor = getComputedStyle(probe).color;
    probe.remove();

    return {
      tabindexPositive: positive.map(
        (element) =>
          `${element.tagName.toLowerCase()}#${element.id}.${element.className}`,
      ),
      focusColor,
    };
  });

  const candidates = await page.evaluate(() => {
    const hasHiddenAncestor = (element: HTMLElement): boolean => {
      let current: HTMLElement | null = element;

      while (current !== null) {
        if (
          current.hasAttribute('hidden') ||
          current.hasAttribute('inert') ||
          current.getAttribute('aria-hidden') === 'true'
        ) {
          return true;
        }

        if (
          current.tagName === 'DIALOG' &&
          !(current as HTMLDialogElement).open
        ) {
          return true;
        }

        const style = getComputedStyle(current);

        if (style.display === 'none' || style.visibility === 'hidden') {
          return true;
        }

        current = current.parentElement;
      }

      return false;
    };

    const raw = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], summary',
      ),
    ].filter((element) => {
      if (element.tabIndex < 0) {
        return false;
      }

      if (
        element instanceof HTMLInputElement &&
        (element.disabled || element.type === 'hidden')
      ) {
        return false;
      }

      if (
        'disabled' in element &&
        (element as HTMLButtonElement).disabled === true
      ) {
        return false;
      }

      if (hasHiddenAncestor(element)) {
        return false;
      }

      return element.getClientRects().length > 0;
    });

    // En un grupo de radios solo entra en el orden de tabulación el marcado
    // (o el primero si ninguno lo está).
    const radioGroups = new Map<string, HTMLInputElement[]>();

    for (const element of raw) {
      if (
        element instanceof HTMLInputElement &&
        element.type === 'radio' &&
        element.name.length > 0
      ) {
        const key = `${element.name}|${element.form?.id ?? ''}`;
        radioGroups.set(key, [...(radioGroups.get(key) ?? []), element]);
      }
    }

    const skipped = new Set<HTMLInputElement>();

    for (const group of radioGroups.values()) {
      const focusable = group.find((radio) => radio.checked) ?? group[0];

      for (const radio of group) {
        if (radio !== focusable) {
          skipped.add(radio);
        }
      }
    }

    const tabbable = raw.filter(
      (element) => !skipped.has(element as HTMLInputElement),
    );

    const describe = (element: HTMLElement): string => {
      const aria =
        element.getAttribute('aria-label') ??
        element.getAttribute('aria-labelledby') ??
        '';
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      const placeholder = element.getAttribute('placeholder') ?? '';
      const name =
        aria.length > 0
          ? aria
          : text.length > 0
            ? text
            : placeholder.length > 0
              ? placeholder
              : (element.getAttribute('name') ?? element.id);

      return `${element.tagName.toLowerCase()}${
        element.id.length > 0 ? `#${element.id}` : ''
      }${name.length > 0 ? ` «${name.slice(0, 48)}»` : ''}`;
    };

    return tabbable.map((element, index) => {
      element.setAttribute('data-wc-audit-index', String(index));

      return { index, label: describe(element) };
    });
  });

  // Origen secuencial fiable: `body` recibe foco y se retira el tabindex antes
  // de medir la primera parada. Así el recorrido empieza siempre por el primer
  // elemento tabulable, no por donde quedó el foco de la vista anterior.
  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
  });
  await page.keyboard.press('Tab');
  await page.evaluate(() => {
    document.body.removeAttribute('tabindex');
  });

  const stops: {
    index: number | null;
    label: string;
    outlineWidth: number;
    outlineColor: string;
    boxShadow: string;
    descendantShadow: string;
    visible: boolean;
  }[] = [];

  const maxStops = candidates.length + 1;

  for (let step = 0; step < maxStops; step += 1) {
    if (step > 0) {
      await page.keyboard.press('Tab');
    }

    const stop = await page.evaluate(() => {
      const active = document.activeElement;
      const element = active instanceof HTMLElement ? active : null;

      if (element === null) {
        return null;
      }

      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const indexAttribute = element.getAttribute('data-wc-audit-index');
      const index =
        indexAttribute === null ? null : Number.parseInt(indexAttribute, 10);
      const aria =
        element.getAttribute('aria-label') ??
        element.getAttribute('aria-labelledby') ??
        '';
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      const placeholder = element.getAttribute('placeholder') ?? '';
      const name =
        aria.length > 0
          ? aria
          : text.length > 0
            ? text
            : placeholder.length > 0
              ? placeholder
              : (element.getAttribute('name') ?? element.id);
      const skipLink = element.classList.contains('wc-skip-link');
      const descendantShadow = [...element.querySelectorAll<HTMLElement>('*')]
        .map((child) => getComputedStyle(child).boxShadow)
        .filter((shadow) => shadow !== 'none')
        .join(' ');

      return {
        index: Number.isNaN(index ?? NaN) ? null : index,
        label: `${indexAttribute ?? '?'}: ${element.tagName.toLowerCase()}${
          element.id.length > 0 ? `#${element.id}` : ''
        }${name.length > 0 ? ` «${name.slice(0, 48)}»` : ''}`,
        outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
        outlineColor: style.outlineColor,
        boxShadow: style.boxShadow,
        descendantShadow,
        visible:
          skipLink ||
          (rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth),
      };
    });

    if (stop === null) {
      break;
    }

    if (stop.index === 0 && stops.length > 0) {
      break;
    }

    stops.push(stop);

    if (stops.length >= candidates.length) {
      break;
    }
  }

  await page.evaluate(() => {
    for (const element of document.querySelectorAll('[data-wc-audit-index]')) {
      element.removeAttribute('data-wc-audit-index');
    }
  });

  const failures = stops
    .filter((stop) => {
      const ring =
        stop.outlineWidth >= 2 && stop.outlineColor === global.focusColor;
      const substitute =
        stop.boxShadow.includes(global.focusColor) ||
        stop.descendantShadow.includes(global.focusColor);

      return !stop.visible || (!ring && !substitute);
    })
    .map(
      (stop) =>
        `${stop.label}: anillo ${stop.outlineWidth}px ${stop.outlineColor} (esperado ${global.focusColor}); caja ${stop.boxShadow}; descendiente ${stop.descendantShadow}; visible=${stop.visible}`,
    );

  const order = stops
    .map((stop) => stop.index)
    .filter((index): index is number => index !== null);
  const orderFailures: string[] = [];

  if (order.length !== candidates.length) {
    orderFailures.push(
      `Se recorrieron ${order.length} paradas y se esperaban ${candidates.length}.`,
    );
  }

  const missingIndex = stops.find((stop) => stop.index === null);

  if (missingIndex !== undefined) {
    orderFailures.push(`${missingIndex.label}: foco fuera de los tabulables.`);
  }

  for (const [position, index] of order.entries()) {
    if (index !== position) {
      orderFailures.push(
        `La parada ${position} enfocó el índice ${index} en lugar de ${position}.`,
      );
      break;
    }
  }

  const targets = await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll<HTMLElement>(
        'button, select, textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])',
      ),
    ].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      // El título de la tarjeta es un botón de texto en línea, sin caja ni
      // relleno: WCAG 2.5.8 lo exceptúa del objetivo mínimo de 28 px. El resto
      // de controles con límite visible sí se miden.
      if (element.classList.contains('wc-entity-card__open')) {
        return false;
      }

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        !element.closest('[hidden]')
      );
    });

    const size = (element: HTMLElement): number => {
      const rect = element.getBoundingClientRect();

      return Math.min(rect.width, rect.height);
    };

    const describe = (element: HTMLElement): string =>
      `${element.tagName.toLowerCase()}${
        element.id.length > 0 ? `#${element.id}` : ''
      }.${typeof element.className === 'string' ? element.className.split(/\s+/).filter(Boolean).join('.') : ''}`;

    const smallest = [...elements].sort(
      (first, second) => size(first) - size(second),
    )[0];
    const primaries = elements.filter((element) =>
      element.classList.contains('wc-button--primary'),
    );
    const smallestPrimary = [...primaries].sort(
      (first, second) => size(first) - size(second),
    )[0];

    return {
      minControl:
        elements.length === 0
          ? null
          : Math.min(...elements.map((element) => size(element))),
      minControlLabel: smallest === undefined ? null : describe(smallest),
      minPrimary:
        primaries.length === 0
          ? null
          : Math.min(...primaries.map((element) => size(element))),
      minPrimaryLabel:
        smallestPrimary === undefined ? null : describe(smallestPrimary),
    };
  });

  expect(global.tabindexPositive, 'tabindex > 0').toEqual([]);
  expect(failures, 'anillo de foco visible').toEqual([]);
  expect(orderFailures, 'orden de tabulación').toEqual([]);

  return {
    tabindexPositive: global.tabindexPositive,
    stops: stops.length,
    expectedStops: candidates.length,
    order,
    orderFailures,
    failures,
    minControl: targets.minControl,
    minControlLabel: targets.minControlLabel,
    minPrimary: targets.minPrimary,
    minPrimaryLabel: targets.minPrimaryLabel,
  };
}

export async function auditReducedMotion(
  page: Page,
): Promise<AuditMotionResult> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settle(page);

  const transitions = await page.evaluate(() => {
    const toMs = (value: string): number => {
      const amount = Number.parseFloat(value) || 0;

      return value.trim().endsWith('ms') ? amount : amount * 1000;
    };

    const selectors = [
      '.wc-shell',
      '.wc-world-card',
      '.wc-nav-item',
      '.wc-skeleton',
      '.wc-button__spinner',
      '.wc-mention',
    ];

    return selectors.flatMap((selector) => {
      const element = document.querySelector<HTMLElement>(selector);

      if (element === null) {
        return [];
      }

      const style = getComputedStyle(element);

      return [
        {
          selector,
          duration: Math.max(
            toMs(style.animationDuration),
            toMs(style.transitionDuration),
          ),
        },
      ];
    });
  });

  const loops = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '.wc-skeleton, .wc-button__spinner, .wc-icon-button__spinner',
      ),
    ]
      .filter((element) => {
        const style = getComputedStyle(element);

        return (
          style.animationName !== 'none' &&
          Number.parseFloat(style.animationIterationCount) > 1
        );
      })
      .map((element) => element.className),
  );

  const collapse = page.getByRole('button', {
    name: messages.shell.collapse,
  });

  if ((await collapse.count()) > 0) {
    await collapse.click();
    await settle(page);
  }

  const collapsed = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.wc-shell__rail');
    const shell = document.querySelector<HTMLElement>('.wc-shell');
    const toMs = (value: string): number => {
      const amount = Number.parseFloat(value) || 0;

      return value.trim().endsWith('ms') ? amount : amount * 1000;
    };

    return {
      width: rail?.getBoundingClientRect().width ?? 0,
      duration:
        shell === null ? 0 : toMs(getComputedStyle(shell).transitionDuration),
    };
  });

  const expand = page.getByRole('button', { name: messages.shell.expand });

  if ((await expand.count()) > 0) {
    await expand.click();
    await settle(page);
  }

  await page.emulateMedia({ reducedMotion: null });

  for (const transition of transitions) {
    expect(
      transition.duration,
      `${transition.selector} conserva movimiento`,
    ).toBeLessThanOrEqual(0.02);
  }

  expect(loops, 'bucles infinitos con movimiento reducido').toEqual([]);
  expect(collapsed.width, 'ancho del rail plegado').toBeCloseTo(64, 0);
  expect(collapsed.duration, 'plegado instantáneo').toBeLessThanOrEqual(0.02);

  return {
    transitions,
    railCollapsedWidth: collapsed.width,
    railCollapseDuration: collapsed.duration,
    loops,
  };
}

export async function startLongTaskProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scope = window as unknown as {
      __wcAuditLongTasks?: number[];
      __wcAuditObserver?: PerformanceObserver | undefined;
    };

    scope.__wcAuditObserver?.disconnect();
    scope.__wcAuditLongTasks = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        scope.__wcAuditLongTasks?.push(entry.duration);
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
    scope.__wcAuditObserver = observer;
  });
}

export async function stopLongTaskProbe(
  page: Page,
): Promise<readonly number[]> {
  return page.evaluate(() => {
    const scope = window as unknown as {
      __wcAuditLongTasks?: number[];
      __wcAuditObserver?: PerformanceObserver | undefined;
    };

    scope.__wcAuditObserver?.disconnect();
    scope.__wcAuditObserver = undefined;

    return scope.__wcAuditLongTasks ?? [];
  });
}

export async function countDomNodes(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('*').length);
}

export async function measureNavigation(
  page: Page,
  action: () => Promise<void>,
  readySelector: string,
): Promise<number> {
  const started = Date.now();

  await action();
  await page.waitForSelector(readySelector, { state: 'visible' });
  await settle(page);

  return Date.now() - started;
}

/**
 * Semilla determinista: 12 mundos (uno archivado), 60 fichas, 10 etiquetas y un
 * tipo personalizado en uso. No usa `Math.random` ni fechas del reloj para el
 * contenido: solo los `createdAt`/`updatedAt` que asigna la base al crear.
 */
export async function seedAuditData(page: Page): Promise<AuditSeed> {
  return page.evaluate(async (data) => {
    const api = window.worldCraft;

    const unwrap = <T>(
      result: { ok: true; data: T } | { ok: false; error: { code: string } },
      label: string,
    ): T => {
      if (!result.ok) {
        throw new Error(`${label}: ${result.error.code}`);
      }

      return result.data;
    };

    const longDescription = 'Mareas y sal. '.repeat(300).slice(0, 4_000);
    const longName =
      `${'Crónicas inacabadas de los reinos del norte y sus mareas'.padEnd(120, ' de sal')}`.slice(
        0,
        120,
      );
    const longSummary = 'Mareas del norte. '.repeat(20).slice(0, 280);
    const genres = [
      'Fantasía',
      'Aventura',
      'Misterio',
      'Histórico',
      'Marítimo',
      'Político',
      'Romance',
      'Terror',
    ];

    const createdWorlds = [];

    for (const [index, name] of data.worldNames.entries()) {
      const result = await api.worlds.create({
        name: index === 1 ? longName : name,
        ...(index === 0
          ? {
              description: {
                type: 'doc' as const,
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: longDescription }],
                  },
                ],
              },
              genres,
              summary: longSummary,
            }
          : index === 1
            ? { summary: longSummary }
            : {}),
      });
      createdWorlds.push(unwrap(result, `mundo ${name}`));
    }

    const archived = createdWorlds[createdWorlds.length - 1];

    if (archived !== undefined) {
      unwrap(
        await api.worlds.setArchived({ id: archived.id, archived: true }),
        'archivar mundo',
      );
    }

    const primary = createdWorlds[0];

    if (primary === undefined) {
      throw new Error('No se creó el mundo principal.');
    }

    const types = unwrap(await api.entityTypes.list(primary.id), 'tipos');
    const character =
      types.find((type) => type.key === 'character') ?? types[0];
    const city = types.find((type) => type.key === 'city') ?? types[0];

    if (character === undefined || city === undefined) {
      throw new Error('El mundo no tiene tipos del sistema.');
    }

    const customType = unwrap(
      await api.entityTypes.create({
        worldId: primary.id,
        name: data.customType,
        icon: 'book-open',
        color: 'ochre',
        fields: [
          {
            key: 'deidad',
            label: 'Deidad',
            type: 'text',
            required: false,
          },
        ],
      }),
      'tipo personalizado',
    );

    const tags = [];

    for (let index = 0; index < 10; index += 1) {
      tags.push(
        unwrap(
          await api.tags.create({
            worldId: primary.id,
            name: `Norte ${String(index + 1).padStart(2, '0')}`,
            color:
              (['moss', 'ochre', 'danger', 'prussian'] as const)[index % 4] ??
              'moss',
          }),
          `etiqueta ${index}`,
        ),
      );
    }

    const tagIds = tags.map((tag) => tag.id);

    const description = (text: string) => ({
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph' as const,
          content: [{ type: 'text' as const, text }],
        },
      ],
    });

    let longEntityId = '';
    let extremeEntityId = '';

    for (let index = 0; index < 60; index += 1) {
      const type = index === 59 ? customType : index >= 56 ? city : character;
      const isLong = index === 1;
      const isExtreme = index === 2;
      const name = isLong
        ? data.longEntity
        : isExtreme
          ? data.extremeEntity
          : index === 0
            ? data.firstEntity
            : `Ficha ${String(index + 1).padStart(2, '0')} de las mareas`;
      const summary = isLong
        ? 'Mareas del norte. '.repeat(18).slice(0, 280)
        : index === 0
          ? 'Resumen de la ficha principal. '.repeat(10).slice(0, 280)
          : `Resumen de ${name}. `.repeat(12).slice(0, 200);
      const aliases = isLong
        ? Array.from(
            { length: 10 },
            (_, aliasIndex) =>
              `Alias ${String(aliasIndex + 1).padStart(2, '0')} de la crónica`,
          )
        : [];
      const entity = unwrap(
        await api.entities.create({
          worldId: primary.id,
          typeId: type.id,
          name,
          summary,
          aliases,
          ...(isLong || isExtreme
            ? {
                description: description(
                  isExtreme
                    ? 'Mareas y sal. '.repeat(4_000).slice(0, 50_000)
                    : 'Mareas y sal. '.repeat(1_000).slice(0, 12_000),
                ),
              }
            : {}),
          ...(index < 10 ? { tagIds } : {}),
          status: index === 55 ? ('archived' as const) : ('active' as const),
          isFavorite: index % 10 === 0,
        }),
        `ficha ${index}`,
      );

      if (isLong) {
        longEntityId = entity.id;
      }

      if (isExtreme) {
        extremeEntityId = entity.id;
      }
    }

    unwrap(await api.search.rebuild(), 'reconstruir búsqueda');

    return {
      primaryWorldId: primary.id,
      primaryWorldName: primary.name,
      longEntityId,
      longEntityName: data.longEntity,
      extremeEntityId,
      extremeEntityName: data.extremeEntity,
      customTypeId: customType.id,
      customTypeName: customType.name,
      worldCount: createdWorlds.length,
      entityCount: 60,
    };
  }, AUDIT_DATA);
}

export async function extendAuditEntities(
  page: Page,
  worldId: string,
  count: number,
): Promise<number> {
  return page.evaluate(
    async ({ worldId: targetWorldId, amount }) => {
      const api = window.worldCraft;
      const types = await api.entityTypes.list(targetWorldId);

      if (!types.ok || types.data.length === 0) {
        throw new Error('No hay tipos para crear fichas.');
      }

      const typeId = types.data[0]?.id ?? '';

      for (let index = 0; index < amount; index += 1) {
        const result = await api.entities.create({
          worldId: targetWorldId,
          typeId,
          name: `Ficha extra ${String(index + 1).padStart(3, '0')} de rendimiento`,
          summary: 'Mareas y sal. '.repeat(6).slice(0, 160),
        });

        if (!result.ok) {
          throw new Error(`Ficha extra ${index}: ${result.error.code}`);
        }
      }

      const rebuilt = await api.search.rebuild();

      if (!rebuilt.ok) {
        throw new Error(`Reconstruir búsqueda: ${rebuilt.error.code}`);
      }

      return amount;
    },
    { worldId, amount: count },
  );
}

export async function openAuditWorld(
  page: Page,
  worldName: string,
): Promise<void> {
  const openButton = page.getByRole('button', {
    name: messages.worlds.card.openNamed(worldName),
  });

  if (
    (await openButton.count()) === 0 ||
    !(await openButton.first().isVisible())
  ) {
    await openAuditWorlds(page);
  }

  await openButton.first().click();
  await expect(
    page.getByRole('heading', { level: 1, name: worldName, exact: true }),
  ).toBeVisible();
}

export async function openAuditWorlds(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.worlds }),
  ).toBeVisible();
}

export async function openAuditHome(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.home })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
}

export async function openAuditEntities(page: Page): Promise<void> {
  await page
    .getByRole('navigation', {
      name: messages.worlds.detail.modules.label,
    })
    .getByRole('button', { name: messages.worlds.detail.modules.entities })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.entities.list.title }),
  ).toBeVisible();
}

export async function openAuditEntity(
  page: Page,
  entityName: string,
): Promise<void> {
  await page
    .getByRole('button', {
      name: messages.entities.card.openNamed(entityName),
    })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: entityName, exact: true }),
  ).toBeVisible();
}

export async function openAuditSearch(
  page: Page,
  query: string,
): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement;

    if (active instanceof HTMLElement) {
      active.blur();
    }
  });
  await page.keyboard.press('Control+k');

  const palette = page.getByRole('dialog', { name: messages.palette.title });

  await palette
    .getByRole('option', {
      name: new RegExp(messages.palette.commands.search),
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.search.title }),
  ).toBeVisible();

  const input = page.getByRole('searchbox', {
    name: messages.search.inputLabel,
  });

  await input.fill(query);
}

export async function openAuditSamples(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.location.hash = '#/internal/samples';
  });
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.samples,
    }),
  ).toBeVisible();
}
