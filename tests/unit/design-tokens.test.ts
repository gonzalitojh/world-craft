import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Contrato estático del sistema de diseño v2.
 *
 * No hay DOM en el entorno de pruebas (`environment: 'node'`): estos tests leen
 * los CSS y TSX reales del renderer, resuelven los tokens por tema y calculan
 * el contraste WCAG 2.2 con la fórmula de luminancia relativa. La revisión
 * visual a 1024, 1280 y 1600 px, axe y el teclado pertenecen al arnés de e2e.
 */

type ThemeName = 'light' | 'dark';
type Rgb = readonly [number, number, number];

interface CssBlock {
  readonly selector: string;
  readonly body: string;
}

const STYLE_ROOT = '../../src/renderer/styles/';
const RENDERER_ROOT = fileURLToPath(
  new URL('../../src/renderer/', import.meta.url),
);

const readStyle = (relativePath: string): string =>
  readFileSync(
    new URL(`${STYLE_ROOT}${relativePath}`, import.meta.url),
    'utf8',
  );

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '');

/** Extrae los bloques `selector { ... }` sin anidamiento. */
function parseBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const match of stripComments(css).matchAll(pattern)) {
    blocks.push({
      selector: (match[1] ?? '').trim(),
      body: match[2] ?? '',
    });
  }

  return blocks;
}

/** Declaraciones de propiedades personalizadas de un documento CSS. */
function readDeclarations(css: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const block of parseBlocks(css)) {
    for (const entry of block.body.split(';')) {
      const separator = entry.indexOf(':');

      if (separator === -1) {
        continue;
      }

      const name = entry.slice(0, separator).trim();

      if (!name.startsWith('--')) {
        continue;
      }

      declarations.set(name, entry.slice(separator + 1).trim());
    }
  }

  return declarations;
}

/** Declaraciones de los bloques de un tema concreto. */
function readTheme(css: string, theme: ThemeName): Map<string, string> {
  const selector = `[data-theme="${theme}"]`;
  const declarations = new Map<string, string>();

  for (const block of parseBlocks(css)) {
    const matches = block.selector
      .split(',')
      .map((part) => part.trim().replaceAll("'", '"'))
      .includes(selector);

    if (!matches) {
      continue;
    }

    for (const entry of block.body.split(';')) {
      const separator = entry.indexOf(':');

      if (separator === -1) {
        continue;
      }

      const name = entry.slice(0, separator).trim();

      if (name.startsWith('--')) {
        declarations.set(name, entry.slice(separator + 1).trim());
      }
    }
  }

  return declarations;
}

function parseHex(value: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());

  if (match === null) {
    return null;
  }

  const hex = match[1] ?? '';

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([red, green, blue]: Rgb): number {
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

const paletteSource = readStyle('tokens/palette.css');
const semanticSource = readStyle('tokens/semantic.css');
const scalesSource = readStyle('tokens/scales.css');
const baseSource = readStyle('base.css');
const componentsSource = readStyle('components.css');
const relationsSource = readStyle('relations.css');
const fontsSource = readStyle('fonts.css');

const palette = readDeclarations(paletteSource);
const scales = readDeclarations(scalesSource);
const themes: Record<ThemeName, Map<string, string>> = {
  light: readTheme(semanticSource, 'light'),
  dark: readTheme(semanticSource, 'dark'),
};

/** Resuelve un rol hasta su valor de paleta, siguiendo cadenas de `var()`. */
function resolveRole(name: string, theme: ThemeName): string {
  const declarations = themes[theme];
  const visited = new Set<string>();

  const walk = (token: string): string => {
    if (visited.has(token)) {
      throw new Error(`Ciclo de tokens en ${token}`);
    }

    visited.add(token);

    const raw = declarations.get(token) ?? palette.get(token);

    if (raw === undefined) {
      throw new Error(`Token sin definir en el tema ${theme}: ${token}`);
    }

    const reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw.trim());

    return reference === null ? raw.trim() : walk(reference[1] ?? '');
  };

  return walk(name);
}

function color(name: string, theme: ThemeName): Rgb {
  const parsed = parseHex(resolveRole(name, theme));

  if (parsed === null) {
    throw new Error(
      `El token ${name} del tema ${theme} no resuelve a un hex de seis cifras.`,
    );
  }

  return parsed;
}

function ratio(first: string, second: string, theme: ThemeName): number {
  return contrastRatio(color(first, theme), color(second, theme));
}

function expectContrast(
  theme: ThemeName,
  foreground: string,
  background: string,
  minimum: number,
): void {
  const value = ratio(foreground, background, theme);

  expect(
    value,
    `${theme}: ${foreground} sobre ${background} (${value.toFixed(2)}:1)`,
  ).toBeGreaterThanOrEqual(minimum);
}

const THEMES = ['light', 'dark'] as const;

const PALETTE_TOKENS = [
  '--palette-neutral-0',
  '--palette-neutral-50',
  '--palette-neutral-100',
  '--palette-neutral-200',
  '--palette-neutral-300',
  '--palette-neutral-400',
  '--palette-neutral-450',
  '--palette-neutral-500',
  '--palette-neutral-600',
  '--palette-neutral-700',
  '--palette-neutral-750',
  '--palette-neutral-800',
  '--palette-neutral-850',
  '--palette-neutral-900',
  '--palette-neutral-950',
  '--palette-forest-100',
  '--palette-forest-300',
  '--palette-forest-400',
  '--palette-forest-600',
  '--palette-forest-700',
  '--palette-forest-900',
  '--palette-sand-200',
  '--palette-sand-500',
  '--palette-sand-800',
  '--palette-success-100',
  '--palette-success-300',
  '--palette-success-600',
  '--palette-success-900',
  '--palette-warning-100',
  '--palette-warning-300',
  '--palette-warning-600',
  '--palette-warning-900',
  '--palette-danger-100',
  '--palette-danger-300',
  '--palette-danger-600',
  '--palette-danger-900',
  '--palette-slate-300',
  '--palette-slate-600',
  '--palette-shadow-1',
  '--palette-shadow-2',
  '--palette-shadow-dark-1',
  '--palette-shadow-dark-2',
  '--palette-overlay-light',
  '--palette-overlay-dark',
] as const;

const RETIRED_PALETTE_TOKENS = [
  '--palette-paper-50',
  '--palette-paper-100',
  '--palette-paper-200',
  '--palette-ink-950',
  '--palette-ink-900',
  '--palette-ink-800',
  '--palette-ink-600',
  '--palette-ink-500',
  '--palette-ink-400',
  '--palette-ink-200',
  '--palette-moss-100',
  '--palette-moss-300',
  '--palette-moss-400',
  '--palette-moss-600',
  '--palette-moss-700',
  '--palette-moss-900',
  '--palette-ochre-100',
  '--palette-ochre-300',
  '--palette-ochre-700',
  '--palette-ochre-900',
  '--palette-prussian-300',
  '--palette-prussian-700',
  '--palette-shadow-warm-1',
  '--palette-shadow-warm-2',
  '--palette-shadow-deep-1',
  '--palette-shadow-deep-2',
  '--palette-overlay',
] as const;

const ROLE_TOKENS = [
  '--bg',
  '--surface',
  '--surface-raised',
  '--surface-sunken',
  '--fg',
  '--muted',
  '--border',
  '--border-strong',
  '--accent',
  '--accent-strong',
  '--accent-contrast',
  '--accent-surface',
  '--success',
  '--success-surface',
  '--warning',
  '--warning-surface',
  '--danger',
  '--danger-surface',
  '--danger-contrast',
  '--focus',
  '--selection',
  '--disabled-surface',
  '--disabled-text',
  '--disabled-border',
  '--skeleton',
  '--skeleton-pulse',
  '--overlay',
  '--entity-moss',
  '--entity-moss-surface',
  '--entity-ochre',
  '--entity-ochre-surface',
  '--entity-danger',
  '--entity-danger-surface',
  '--entity-prussian',
  '--entity-prussian-surface',
] as const;

/**
 * Tabla §4.5 del sistema de diseño. Cada pareja se comprueba en los dos temas
 * con su mínimo: 4,5 para texto, 3 para componentes y foco.
 */
const CONTRAST_PAIRS = [
  { fg: '--fg', bg: '--bg', min: 4.5, label: 'texto normal' },
  { fg: '--fg', bg: '--bg', min: 3, label: 'texto grande' },
  { fg: '--fg', bg: '--surface', min: 4.5, label: 'texto normal' },
  { fg: '--fg', bg: '--surface-raised', min: 4.5, label: 'texto normal' },
  { fg: '--muted', bg: '--bg', min: 4.5, label: 'texto normal' },
  { fg: '--muted', bg: '--surface', min: 4.5, label: 'texto normal' },
  { fg: '--muted', bg: '--surface-sunken', min: 4.5, label: 'texto normal' },
  { fg: '--fg', bg: '--surface-sunken', min: 4.5, label: 'texto normal' },
  { fg: '--accent', bg: '--bg', min: 4.5, label: 'texto normal' },
  {
    fg: '--accent-strong',
    bg: '--accent-surface',
    min: 4.5,
    label: 'texto normal',
  },
  { fg: '--accent-strong', bg: '--bg', min: 4.5, label: 'texto normal' },
  {
    fg: '--accent-contrast',
    bg: '--accent-strong',
    min: 4.5,
    label: 'texto normal',
  },
  {
    fg: '--fg',
    bg: '--entity-moss-surface',
    min: 4.5,
    label: 'texto normal',
  },
  {
    fg: '--fg',
    bg: '--entity-ochre-surface',
    min: 4.5,
    label: 'texto normal',
  },
  {
    fg: '--fg',
    bg: '--entity-danger-surface',
    min: 4.5,
    label: 'texto normal',
  },
  {
    fg: '--fg',
    bg: '--entity-prussian-surface',
    min: 4.5,
    label: 'texto normal',
  },
  {
    fg: '--warning',
    bg: '--surface-raised',
    min: 3,
    label: 'componente gráfico',
  },
  {
    fg: '--muted',
    bg: '--surface-raised',
    min: 3,
    label: 'componente gráfico',
  },
  { fg: '--accent', bg: '--surface', min: 3, label: 'componente' },
  { fg: '--accent-contrast', bg: '--accent', min: 4.5, label: 'texto normal' },
  {
    fg: '--accent',
    bg: '--accent-surface',
    min: 4.5,
    label: 'texto normal',
  },
  { fg: '--success', bg: '--bg', min: 4.5, label: 'texto normal' },
  {
    fg: '--success',
    bg: '--success-surface',
    min: 4.5,
    label: 'texto normal',
  },
  { fg: '--warning', bg: '--bg', min: 4.5, label: 'texto normal' },
  {
    fg: '--warning',
    bg: '--warning-surface',
    min: 4.5,
    label: 'texto normal',
  },
  { fg: '--danger', bg: '--bg', min: 4.5, label: 'texto normal' },
  {
    fg: '--danger',
    bg: '--danger-surface',
    min: 4.5,
    label: 'texto normal',
  },
  {
    fg: '--danger-contrast',
    bg: '--danger',
    min: 4.5,
    label: 'texto sobre peligro',
  },
  { fg: '--border-strong', bg: '--bg', min: 3, label: 'componente' },
  { fg: '--border-strong', bg: '--surface', min: 3, label: 'componente' },
  { fg: '--focus', bg: '--bg', min: 3, label: 'foco' },
  { fg: '--focus', bg: '--surface', min: 3, label: 'foco' },
  { fg: '--focus', bg: '--accent-surface', min: 3, label: 'foco' },
  { fg: '--focus', bg: '--surface-sunken', min: 3, label: 'foco' },
  { fg: '--fg', bg: '--selection', min: 4.5, label: 'texto normal' },
  {
    fg: '--disabled-text',
    bg: '--disabled-surface',
    min: 4.5,
    label: 'texto deshabilitado',
  },
  {
    fg: '--disabled-border',
    bg: '--disabled-surface',
    min: 3,
    label: 'componente deshabilitado',
  },
] as const;

const ENTITY_MARKS = ['moss', 'ochre', 'danger', 'prussian'] as const;

function listTsxFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listTsxFiles(fullPath);
    }

    return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

function readTsxSource(file: string): string {
  return stripComments(readFileSync(file, 'utf8'));
}

describe('paleta v2', () => {
  it('declara las familias y pasos de §4.2 y retira las familias v1', () => {
    for (const token of PALETTE_TOKENS) {
      expect(palette.has(token), `Falta ${token}`).toBe(true);
    }

    for (const token of RETIRED_PALETTE_TOKENS) {
      expect(palette.has(token), `Sigue existiendo ${token}`).toBe(false);
    }
  });

  it('solo contiene valores cromáticos', () => {
    for (const [name, value] of palette) {
      expect(
        /^(#[0-9a-f]{6}|rgb\([^)]*\))$/i.test(value),
        `${name} no es un color de paleta: ${value}`,
      ).toBe(true);
    }
  });
});

describe('roles semánticos', () => {
  it('resuelve todos los roles en Claro y Oscuro', () => {
    for (const theme of THEMES) {
      for (const token of ROLE_TOKENS) {
        const value = resolveRole(token, theme);

        expect(
          /^(#[0-9a-f]{6}|rgb\()/i.test(value),
          `${theme}: ${token} = ${value}`,
        ).toBe(true);
      }
    }
  });

  it('usa un velo distinto por tema y conserva el deshabilitado sin opacidad', () => {
    expect(themes.light.get('--overlay')).toBe('var(--palette-overlay-light)');
    expect(themes.dark.get('--overlay')).toBe('var(--palette-overlay-dark)');
    expect(resolveRole('--overlay', 'light')).not.toBe(
      resolveRole('--overlay', 'dark'),
    );

    for (const theme of THEMES) {
      expect(themes[theme].has('--disabled-surface')).toBe(true);
      expect(themes[theme].has('--disabled-text')).toBe(true);
    }
  });

  it('resuelve los tokens persistidos de tipo con marcas propias', () => {
    for (const theme of THEMES) {
      for (const mark of ENTITY_MARKS) {
        expectContrast(
          theme,
          `--entity-${mark}`,
          `--entity-${mark}-surface`,
          3,
        );
      }
    }
  });
});

describe('contraste AA de la tabla §4.5', () => {
  it('cumple cada pareja en Claro y Oscuro con su mínimo', () => {
    for (const theme of THEMES) {
      for (const pair of CONTRAST_PAIRS) {
        expectContrast(theme, pair.fg, pair.bg, pair.min);
      }
    }
  });

  it('mantiene el texto principal por encima de 7:1', () => {
    for (const theme of THEMES) {
      const value = ratio('--fg', '--bg', theme);

      expect(value, `${theme}: ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        7,
      );
    }
  });

  it('fija los ratios documentados de la ficha #129', () => {
    const pairs = [
      {
        fg: '--accent-strong',
        bg: '--bg',
        light: 9.05,
        dark: 9.92,
      },
      {
        fg: '--accent-contrast',
        bg: '--accent-strong',
        light: 9.94,
        dark: 10.35,
      },
      {
        fg: '--fg',
        bg: '--surface-sunken',
        light: 12.87,
        dark: 17.15,
      },
      {
        fg: '--fg',
        bg: '--entity-moss-surface',
        light: 12.77,
        dark: 11.17,
      },
      {
        fg: '--fg',
        bg: '--entity-ochre-surface',
        light: 11.44,
        dark: 11.22,
      },
      {
        fg: '--fg',
        bg: '--entity-danger-surface',
        light: 12.2,
        dark: 13.01,
      },
      {
        fg: '--fg',
        bg: '--entity-prussian-surface',
        light: 12.87,
        dark: 17.15,
      },
      {
        fg: '--warning',
        bg: '--surface-raised',
        light: 5.9,
        dark: 8.24,
      },
      {
        fg: '--muted',
        bg: '--surface-raised',
        light: 5.58,
        dark: 6.51,
      },
    ] as const;

    for (const pair of pairs) {
      expect(
        ratio(pair.fg, pair.bg, 'light'),
        `Claro: ${pair.fg} sobre ${pair.bg}`,
      ).toBeCloseTo(pair.light, 2);
      expect(
        ratio(pair.fg, pair.bg, 'dark'),
        `Oscuro: ${pair.fg} sobre ${pair.bg}`,
      ).toBeCloseTo(pair.dark, 2);
    }
  });

  it('fija los ratios documentados del deshabilitado y de muted/sunken', () => {
    expect(ratio('--disabled-text', '--disabled-surface', 'light')).toBeCloseTo(
      4.72,
      2,
    );
    expect(ratio('--disabled-text', '--disabled-surface', 'dark')).toBeCloseTo(
      7.74,
      2,
    );
    expect(ratio('--muted', '--surface-sunken', 'dark')).toBeCloseTo(8.08, 2);
  });
});

function blockBody(selector: string): string {
  const block = parseBlocks(componentsSource).find((entry) =>
    entry.selector
      .split(',')
      .map((part) => part.trim())
      .includes(selector),
  );

  return block?.body ?? '';
}

describe('correcciones de la revisión UI', () => {
  it('distingue el control deshabilitado de la superficie elevada', () => {
    for (const theme of THEMES) {
      const distinction = ratio(
        '--disabled-surface',
        '--surface-raised',
        theme,
      );

      expect(
        distinction,
        `${theme}: disabled-surface sobre surface-raised (${distinction.toFixed(2)}:1)`,
      ).toBeGreaterThanOrEqual(1.1);
      expectContrast(theme, '--disabled-border', '--disabled-surface', 3);
    }
  });

  it('reserva --fg para el texto sobre --selection', () => {
    for (const theme of THEMES) {
      expectContrast(theme, '--fg', '--selection', 4.5);
    }

    for (const block of parseBlocks(componentsSource)) {
      if (!/background-color:\s*var\(--selection\)/.test(block.body)) {
        continue;
      }

      expect(block.selector, 'texto secundario sobre selección').not.toMatch(
        /color:\s*var\(--muted\)/,
      );
    }
  });

  it('da al tooltip ancho de contenido y un máximo acotado', () => {
    const body = blockBody('.wc-tooltip__bubble');

    expect(body).toMatch(/inline-size:\s*max-content/);
    expect(body).toMatch(
      /max-inline-size:\s*min\(18rem,\s*calc\(100vw - 2 \* var\(--space-6\)\)\)/,
    );
    expect(body).toMatch(/overflow-wrap:\s*break-word/);
  });

  it('posiciona el menú respecto al viewport y con separación de 4 px', () => {
    const body = blockBody('.wc-menu__list');

    expect(body).toMatch(/position:\s*fixed/);
    expect(body).toMatch(/gap:\s*var\(--space-1\)/);
    expect(body).not.toMatch(/gap:\s*2px/);
    expect(body).toMatch(
      /max-block-size:\s*calc\(100vh - 2 \* var\(--space-6\)\)/,
    );
    expect(body).toMatch(/overflow-y:\s*auto/);
    expect(body).toMatch(/overscroll-behavior:\s*contain/);
  });

  it('usa un paso de superficie perceptible en hover', () => {
    for (const selector of [
      '.wc-button--secondary:hover:not(:disabled)',
      '.wc-button--ghost:hover:not(:disabled)',
      '.wc-icon-button--secondary:hover:not(:disabled)',
      '.wc-menu__item:hover:not(:disabled)',
    ]) {
      expect(blockBody(selector), selector).toMatch(
        /background-color:\s*var\(--surface-sunken\)/,
      );
    }
  });

  it('conserva el anillo de foco de la casilla inválida', () => {
    const body = blockBody('.wc-checkbox--invalid .wc-checkbox__input');

    expect(body).toMatch(/box-shadow:/);
    expect(body).not.toMatch(/outline:/);
  });

  it('da a la etiqueta de casilla y radio un objetivo de 28 px', () => {
    for (const selector of ['.wc-checkbox__label', '.wc-radio__label']) {
      expect(blockBody(selector), selector).toMatch(
        /min-block-size:\s*1\.75rem/,
      );
    }
  });

  it('pinta el esqueleto con roles propios visibles en ambos temas', () => {
    expect(blockBody('.wc-skeleton')).toMatch(
      /background-color:\s*var\(--skeleton\)/,
    );
    expect(componentsSource).toMatch(
      /background-color:\s*var\(--skeleton-pulse\)/,
    );
  });

  it('marca el grupo de radio inválido con un borde de 1 px', () => {
    const body = blockBody('.wc-radio-group--invalid .wc-radio-group__options');

    expect(body).toMatch(/border-inline-start:\s*1px/);
    expect(body).not.toMatch(/border-inline-start:\s*2px/);
  });

  it('separa la marca gráfica del texto de la etiqueta', () => {
    expect(blockBody('.wc-type-mark')).toMatch(/::?before|border-radius/);
    expect(blockBody('.wc-type-mark-label')).toMatch(/color:\s*var\(--fg\)/);
  });
});

describe('shell v2', () => {
  it('hunde el rail sobre la superficie y lo separa con un divisor', () => {
    const body = blockBody('.wc-shell__rail');

    expect(body).toMatch(/background-color:\s*var\(--surface-sunken\)/);
    expect(body).toMatch(/border-inline-end:\s*1px\s+solid\s+var\(--border\)/);
  });

  it('marca la entrada activa con selección, texto principal y peso 600', () => {
    const body = blockBody(".wc-nav-item[aria-current='page']");

    expect(body).toMatch(/background-color:\s*var\(--selection\)/);
    expect(body).toMatch(/color:\s*var\(--fg\)/);
    expect(body).toMatch(/font-weight:\s*var\(--weight-semibold\)/);
    expect(body).not.toMatch(/border/);
    expect(body).not.toMatch(/--accent-surface/);
  });

  it('sube el hover de los iconos del rail a superficie elevada', () => {
    const body = blockBody(
      '.wc-shell__rail .wc-icon-button--ghost:hover:not(:disabled)',
    );

    expect(body).toMatch(/background-color:\s*var\(--surface-raised\)/);
    expect(body).not.toMatch(/--surface-sunken/);
  });

  it('deja la barra superior en superficie con sombra y sin borde inferior', () => {
    const body = blockBody('.wc-topbar');

    expect(body).toMatch(/block-size:\s*var\(--topbar-height\)/);
    expect(body).toMatch(/background-color:\s*var\(--surface\)/);
    expect(body).toMatch(/box-shadow:\s*var\(--shadow-1\)/);
    expect(body).not.toMatch(/border-block-end/);
  });

  it('trunca el título a una línea', () => {
    const body = blockBody('.wc-topbar__title');

    expect(body).toMatch(/white-space:\s*nowrap/);
    expect(body).toMatch(/text-overflow:\s*ellipsis/);
    expect(body).toMatch(/overflow:\s*hidden/);
  });

  it('pinta el disparador de búsqueda como un pozo de 32 px', () => {
    const body = blockBody('.wc-topbar__search');

    expect(body).toMatch(/block-size:\s*2rem/);
    expect(body).toMatch(/background-color:\s*var\(--surface-sunken\)/);
  });

  it('da a la paleta un campo de 40 px con borde fuerte', () => {
    const body = blockBody('.wc-palette__input');

    expect(body).toMatch(/block-size:\s*2\.5rem/);
    expect(body).toMatch(/border:\s*1px\s+solid\s+var\(--border-strong\)/);
    expect(body).toMatch(/background-color:\s*var\(--surface\)/);
  });

  it('señala actualizaciones con un punto de 6 px sobre la superficie', () => {
    const body = blockBody('.wc-updates__dot');

    expect(body).toMatch(/inline-size:\s*6px/);
    expect(body).toMatch(/block-size:\s*6px/);
    expect(body).toMatch(/background-color:\s*var\(--accent\)/);
    expect(body).toMatch(/border:\s*1px\s+solid\s+var\(--surface\)/);
  });
});

describe('foco 2+2', () => {
  it('declara el anillo y lo aplica en base sin anularlo', () => {
    expect(scales.get('--focus-width')).toBe('2px');
    expect(scales.get('--focus-offset')).toBe('2px');
    expect(baseSource).toMatch(
      /:focus-visible\s*\{[^}]*outline:\s*var\(--focus-width\)\s+solid\s+var\(--focus\)/,
    );
    expect(baseSource).toMatch(/outline-offset:\s*var\(--focus-offset\)/);

    for (const source of [
      paletteSource,
      semanticSource,
      scalesSource,
      baseSource,
      componentsSource,
      relationsSource,
      fontsSource,
    ]) {
      expect(stripComments(source)).not.toMatch(/outline:\s*(?:none|0)\b/i);
    }
  });
});

describe('disciplina de capas', () => {
  const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;

  it('solo palette.css declara colores literales', () => {
    for (const [name, source] of [
      ['tokens/semantic.css', semanticSource],
      ['tokens/scales.css', scalesSource],
      ['base.css', baseSource],
      ['components.css', componentsSource],
      ['relations.css', relationsSource],
      ['fonts.css', fontsSource],
    ] as const) {
      expect(stripComments(source), name).not.toMatch(LITERAL_COLOR);
    }
  });

  it('solo semantic.css referencia la paleta cruda', () => {
    for (const [name, source] of [
      ['tokens/palette.css', paletteSource],
      ['tokens/scales.css', scalesSource],
      ['base.css', baseSource],
      ['components.css', componentsSource],
      ['relations.css', relationsSource],
      ['fonts.css', fontsSource],
    ] as const) {
      expect(stripComments(source), name).not.toMatch(/var\(--palette-/);
    }
  });

  it('resuelve todas las referencias var(--x) a un token declarado', () => {
    const declared = new Set<string>();

    for (const source of [paletteSource, semanticSource, scalesSource]) {
      for (const match of stripComments(source).matchAll(
        /(--[a-z0-9-]+)\s*:/g,
      )) {
        const name = match[1] ?? '';

        declared.add(name);
      }
    }

    for (const [name, source] of [
      ['tokens/palette.css', paletteSource],
      ['tokens/semantic.css', semanticSource],
      ['tokens/scales.css', scalesSource],
      ['base.css', baseSource],
      ['components.css', componentsSource],
      ['relations.css', relationsSource],
      ['fonts.css', fontsSource],
    ] as const) {
      for (const match of stripComments(source).matchAll(
        /var\(\s*(--[a-z0-9-]+)/g,
      )) {
        const token = match[1] ?? '';

        expect(
          declared.has(token),
          `${name} usa ${token}, que no está declarado`,
        ).toBe(true);
      }
    }
  });

  it('retira --paper y --ink de CSS y TSX', () => {
    for (const source of [
      paletteSource,
      semanticSource,
      scalesSource,
      baseSource,
      componentsSource,
      relationsSource,
      fontsSource,
    ]) {
      expect(stripComments(source)).not.toMatch(/--(?:paper|ink)\b/);
    }

    for (const file of listTsxFiles(path.join(RENDERER_ROOT, 'components'))) {
      const source = readTsxSource(file);

      expect(source, file).not.toMatch(/--(?:paper|ink)\b/);
      expect(source, file).not.toMatch(/var\(--/);
    }

    for (const file of listTsxFiles(path.join(RENDERER_ROOT, 'pages'))) {
      const source = readTsxSource(file);

      expect(source, file).not.toMatch(/--(?:paper|ink)\b/);
      expect(source, file).not.toMatch(/var\(--/);
    }
  });

  it('declara @font-face solo en styles/fonts.css', () => {
    expect(stripComments(fontsSource).match(/@font-face/g) ?? []).toHaveLength(
      2,
    );

    for (const [name, source] of [
      ['tokens/palette.css', paletteSource],
      ['tokens/semantic.css', semanticSource],
      ['tokens/scales.css', scalesSource],
      ['base.css', baseSource],
      ['components.css', componentsSource],
      ['relations.css', relationsSource],
    ] as const) {
      expect(stripComments(source), name).not.toMatch(/@font-face/);
    }
  });
});

describe('tipografía y fuente local', () => {
  const fontUi = (scales.get('--font-ui') ?? '').replace(/\s+/g, ' ');
  const fontMono = (scales.get('--font-mono') ?? '').replace(/\s+/g, ' ');
  const fontContent = (scales.get('--font-content') ?? '').replace(/\s+/g, ' ');

  it('usa las pilas del sistema y la serif empaquetada como contenido', () => {
    expect(fontUi.startsWith("'Segoe UI Variable Text'")).toBe(true);
    expect(fontUi).not.toMatch(/Inter|Fraunces|JetBrains/);
    expect(fontMono.startsWith("'Cascadia Mono'")).toBe(true);
    expect(fontMono).not.toMatch(/JetBrains/);
    expect(fontContent.startsWith("'Source Serif 4'")).toBe(true);
    expect(fontContent).toMatch(/Georgia/);
  });

  it('retira --font-display y no deja referencias en CSS ni TSX', () => {
    expect(scales.has('--font-display')).toBe(false);

    for (const [name, source] of [
      ['tokens/palette.css', paletteSource],
      ['tokens/semantic.css', semanticSource],
      ['tokens/scales.css', scalesSource],
      ['base.css', baseSource],
      ['components.css', componentsSource],
      ['relations.css', relationsSource],
      ['fonts.css', fontsSource],
    ] as const) {
      expect(stripComments(source), name).not.toMatch(/--font-display/);
    }

    for (const directory of ['components', 'pages', 'shell']) {
      for (const file of listTsxFiles(path.join(RENDERER_ROOT, directory))) {
        expect(readTsxSource(file), file).not.toMatch(/--font-display/);
      }
    }
  });

  it('no usa el alias --font-display en primitivas v2 ni adaptadas', () => {
    const prefixes = [
      '.wc-button',
      '.wc-field',
      '.wc-badge',
      '.wc-card',
      '.wc-empty',
      '.wc-dialog',
      '.wc-tabs',
      '.wc-toast',
      '.wc-tooltip',
      '.wc-icon-button',
      '.wc-menu',
      '.wc-checkbox',
      '.wc-radio',
      '.wc-panel',
      '.wc-skeleton',
    ] as const;

    for (const block of parseBlocks(componentsSource)) {
      const usesPrimitive = block.selector.split(',').some((part) => {
        const selector = part.trim();

        return prefixes.some((prefix) => selector.startsWith(prefix));
      });

      if (usesPrimitive) {
        expect(
          block.body,
          `Primitiva con --font-display: ${block.selector}`,
        ).not.toMatch(/--font-display/);
      }
    }
  });

  it('declara dos cortes locales con formato, swap y rango latin', () => {
    const faces =
      stripComments(fontsSource)
        .match(/@font-face\s*\{[^}]*\}/g)
        ?.map((face) => face.replace(/\s+/g, ' ')) ?? [];

    expect(faces).toHaveLength(2);

    for (const face of faces) {
      expect(face).toContain("format('woff2')");
      expect(face).toContain("url('../assets/fonts/source-serif-4/");
      expect(face).toContain('font-display: swap');
      expect(face).toContain('unicode-range:');
      expect(face).toContain('U+0000-00FF');
      expect(face).not.toMatch(/https?:/);
    }

    expect(faces.some((face) => /font-weight:\s*400/.test(face))).toBe(true);
    expect(faces.some((face) => /font-weight:\s*600/.test(face))).toBe(true);
  });

  it('no incluye URLs remotas en ningún CSS', () => {
    for (const source of [
      paletteSource,
      semanticSource,
      scalesSource,
      baseSource,
      componentsSource,
      relationsSource,
      fontsSource,
    ]) {
      expect(stripComments(source)).not.toMatch(
        /url\(\s*['"]?(?:https?:)?\/\//i,
      );
      expect(stripComments(source)).not.toMatch(
        /fonts\.googleapis|fonts\.gstatic/,
      );
    }
  });

  it('versiona los dos woff2 con un tamaño total contenido', () => {
    const directory = path.join(
      RENDERER_ROOT,
      'assets',
      'fonts',
      'source-serif-4',
    );
    const files = [
      'source-serif-4-regular-latin.woff2',
      'source-serif-4-semibold-latin.woff2',
    ] as const;
    let total = 0;

    for (const file of files) {
      const fullPath = path.join(directory, file);

      expect(existsSync(fullPath), `Falta ${file}`).toBe(true);

      const size = statSync(fullPath).size;

      expect(size, `${file} está vacío`).toBeGreaterThan(0);
      total += size;
    }

    expect(total).toBeLessThanOrEqual(150 * 1024);
  });
});

describe('escalas y medidas', () => {
  const toPx = (value: string): number => {
    const parsed = Number.parseFloat(value);

    return value.includes('rem') ? parsed * 16 : parsed;
  };

  it('usa radios de 4, 6 y 8 px más la píldora de insignias', () => {
    expect(toPx(scales.get('--radius-sm') ?? '')).toBe(4);
    expect(toPx(scales.get('--radius-md') ?? '')).toBe(6);
    expect(toPx(scales.get('--radius-lg') ?? '')).toBe(8);
    expect(scales.get('--radius-pill')).toBe('999px');
  });

  it('mantiene la escala de texto 12/13/14/16/18/22/32', () => {
    const expected = new Map<string, number>([
      ['--text-xs', 12],
      ['--text-sm', 13],
      ['--text-base', 14],
      ['--text-md', 16],
      ['--text-lg', 18],
      ['--text-xl', 22],
      ['--text-display', 32],
    ]);

    for (const [token, px] of expected) {
      expect(toPx(scales.get(token) ?? ''), token).toBe(px);
    }
  });

  it('mantiene el espaciado en rejilla de 4 px', () => {
    for (let index = 1; index <= 12; index += 1) {
      const value = toPx(scales.get(`--space-${index}`) ?? '');

      expect(value % 4, `--space-${index}`).toBe(0);
    }
  });

  it('define iconos de 16/20/24 px con trazo 1,6', () => {
    expect(scales.get('--icon-sm')).toBe('16px');
    expect(scales.get('--icon-md')).toBe('20px');
    expect(scales.get('--icon-lg')).toBe('24px');
    expect(scales.get('--icon-stroke')).toBe('1.6');
  });

  it('limita el movimiento a 120–180 ms', () => {
    for (const token of ['--motion-fast', '--motion-base']) {
      const value = Number.parseFloat(scales.get(token) ?? '');

      expect(value, token).toBeGreaterThanOrEqual(120);
      expect(value, token).toBeLessThanOrEqual(180);
    }
  });

  it('conserva las medidas del shell de escritorio', () => {
    expect(scales.get('--sidebar-width')).toBe('240px');
    expect(scales.get('--sidebar-width-collapsed')).toBe('64px');
    expect(scales.get('--topbar-height')).toBe('56px');
  });
});

describe('elevación y tarjetas sin contorno', () => {
  const primitives = ['wc-card', 'wc-card--accent', 'wc-empty', 'wc-panel'];

  it('no dibuja borde ni sombra en tarjetas, estados vacíos y paneles', () => {
    for (const className of primitives) {
      const block = parseBlocks(componentsSource).find(
        (entry) => entry.selector === `.${className}`,
      );

      expect(block, `Falta .${className}`).not.toBeUndefined();
      expect(block?.body ?? '', `.${className}`).not.toMatch(
        /box-shadow|(?:^|;)\s*border\s*:/,
      );
    }
  });

  it('no usa sombra en botones ni en el contenedor de muestras', () => {
    for (const className of ['wc-button--primary', 'wc-samples__long']) {
      const block = parseBlocks(componentsSource).find(
        (entry) => entry.selector === `.${className}`,
      );

      expect(block?.body ?? '', `.${className}`).not.toMatch(/box-shadow/);
    }
  });
});

describe('estados y movimiento', () => {
  it('no deshabilita con opacity', () => {
    for (const block of parseBlocks(componentsSource)) {
      if (!/:(?:disabled|disabled\b)|\[disabled\]/.test(block.selector)) {
        continue;
      }

      expect(block.body, block.selector).not.toMatch(/opacity\s*:/);
    }
  });

  it('usa los roles de deshabilitado en botones y campos', () => {
    const block = (selector: string): string =>
      parseBlocks(componentsSource).find((entry) => entry.selector === selector)
        ?.body ?? '';

    expect(block('.wc-button:disabled')).toMatch(/--disabled-surface/);
    expect(block('.wc-button:disabled')).toMatch(/--disabled-text/);
    expect(block('.wc-field__control:disabled')).toMatch(/--disabled-surface/);
    expect(block('.wc-field__control:disabled')).toMatch(/--disabled-text/);
    expect(block('.wc-check input')).toMatch(/accent-color:\s*var\(--accent\)/);
    expect(block('.wc-checkbox__input')).toMatch(
      /accent-color:\s*var\(--accent\)/,
    );
  });

  it('limita las animaciones en bucle a indicadores de carga', () => {
    const allowed = new Set([
      '.wc-button__spinner',
      '.wc-icon-button__spinner',
      '.wc-skeleton',
    ]);

    for (const block of parseBlocks(componentsSource)) {
      if (/animation:[^;]*infinite/.test(block.body)) {
        expect(
          allowed.has(block.selector),
          `Bucle de animación no permitido en ${block.selector}`,
        ).toBe(true);
      }
    }
  });

  it('conserva el reset de movimiento reducido con una sola iteración', () => {
    const mediaIndex = baseSource.indexOf('@media (prefers-reduced-motion');
    const reset = baseSource.slice(mediaIndex);

    expect(mediaIndex).toBeGreaterThan(-1);
    expect(reset).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(reset).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(reset).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  it('no añade !important fuera del reset de movimiento reducido', () => {
    for (const [name, source] of [
      ['tokens/palette.css', paletteSource],
      ['tokens/semantic.css', semanticSource],
      ['tokens/scales.css', scalesSource],
      ['components.css', componentsSource],
      ['relations.css', relationsSource],
      ['fonts.css', fontsSource],
    ] as const) {
      expect(stripComments(source), name).not.toMatch(/!important/);
    }

    const mediaIndex = stripComments(baseSource).indexOf(
      '@media (prefers-reduced-motion',
    );

    for (const match of stripComments(baseSource).matchAll(/!important/g)) {
      expect(
        match.index ?? 0,
        '!important fuera del reset de movimiento reducido',
      ).toBeGreaterThan(mediaIndex);
    }
  });
});

describe('licencia de Source Serif 4', () => {
  const assetDirectory = path.join(
    RENDERER_ROOT,
    'assets',
    'fonts',
    'source-serif-4',
  );
  const assetLicense = path.join(assetDirectory, 'OFL.txt');
  const packagedLicense = path.join(
    process.cwd(),
    'resources',
    'licenses',
    'source-serif-4-OFL.txt',
  );

  it('versiona el texto OFL completo junto al activo', () => {
    expect(existsSync(assetLicense)).toBe(true);

    const contents = readFileSync(assetLicense, 'utf8');

    expect(contents).toContain('SIL OPEN FONT LICENSE');
    expect(contents).toContain(
      'Copyright 2014 The Source Serif 4 Project Authors',
    );
    expect(contents).toContain('Version 1.1');
  });

  it('replica el texto byte a byte en el instalador', () => {
    expect(existsSync(packagedLicense)).toBe(true);
    expect(
      readFileSync(packagedLicense).equals(readFileSync(assetLicense)),
    ).toBe(true);
  });

  it('documenta la fuente y actualiza el recuento de textos', () => {
    const notices = readFileSync(
      path.join(process.cwd(), 'THIRD-PARTY-NOTICES.md'),
      'utf8',
    );

    expect(notices).toContain('Source Serif 4');
    expect(notices).toContain('SIL Open Font License');
    expect(notices).toMatch(/7 textos completos/);
  });

  it('no añade la fuente como dependencia npm', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    });

    expect(names.filter((name) => /font|serif/i.test(name))).toEqual([]);

    const lockfile = readFileSync(
      path.join(process.cwd(), 'pnpm-lock.yaml'),
      'utf8',
    );

    expect(lockfile).not.toMatch(/source-serif|fontsource/i);
  });
});
