import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Verificación estática del sistema de diseño.
 *
 * No hay DOM en el entorno de pruebas (`environment: 'node'`): estos tests leen
 * los CSS reales del renderer, resuelven los tokens por tema y calculan el
 * contraste WCAG 2.2 con la fórmula de luminancia relativa. La revisión visual
 * a 1024, 1280 y 1600 px y axe pertenecen al arnés de #70.
 */

type ThemeName = 'light' | 'dark';
type Rgb = readonly [number, number, number];

interface CssBlock {
  readonly selector: string;
  readonly body: string;
}

const STYLE_ROOT = '../../src/renderer/styles/';

const readStyle = (relativePath: string): string =>
  readFileSync(
    new URL(`${STYLE_ROOT}${relativePath}`, import.meta.url),
    'utf8',
  );

const stripComments = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, '');

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

/** Declaraciones de propiedades personalizadas de un bloque. */
function parseDeclarations(body: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const entry of body.split(';')) {
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

  return declarations;
}

/** Declaraciones de propiedades personalizadas de un documento CSS. */
function readDeclarations(css: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const block of parseBlocks(css)) {
    for (const [name, value] of parseDeclarations(block.body)) {
      declarations.set(name, value);
    }
  }

  return declarations;
}

/**
 * Declaraciones de los bloques de un tema concreto.
 *
 * Prettier escribe los selectores con comillas simples (`[data-theme='light']`),
 * así que se normalizan ambas formas antes de comparar.
 */
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

    for (const [name, value] of parseDeclarations(block.body)) {
      declarations.set(name, value);
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

const palette = readDeclarations(paletteSource);
const themes: Record<ThemeName, Map<string, string>> = {
  light: readTheme(semanticSource, 'light'),
  dark: readTheme(semanticSource, 'dark'),
};

/** Resuelve un rol hasta su hex de paleta, siguiendo cadenas de `var()`. */
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

function expectContrast(
  theme: ThemeName,
  foreground: string,
  background: string,
  minimum: number,
): void {
  const ratio = contrastRatio(
    color(foreground, theme),
    color(background, theme),
  );

  expect(
    ratio,
    `${theme}: ${foreground} sobre ${background} (${ratio.toFixed(2)}:1)`,
  ).toBeGreaterThanOrEqual(minimum);
}

const TEXT_BACKGROUNDS = ['--paper', '--surface', '--surface-raised'] as const;
const DARK_TEXT_BACKGROUNDS = [
  '--ink',
  '--surface',
  '--surface-raised',
] as const;

const SECONDARY_PAIRS = [
  ['--muted', '--paper'],
  ['--muted', '--surface'],
  ['--muted', '--surface-raised'],
  ['--accent-contrast', '--accent'],
  ['--accent-contrast', '--accent-strong'],
  ['--success', '--success-surface'],
  ['--warning', '--warning-surface'],
  ['--danger', '--danger-surface'],
] as const;

const DARK_SECONDARY_PAIRS = [
  ['--muted', '--ink'],
  ['--muted', '--surface'],
  ['--muted', '--surface-raised'],
  ['--accent-contrast', '--accent'],
  ['--accent-contrast', '--accent-strong'],
  ['--success', '--success-surface'],
  ['--warning', '--warning-surface'],
  ['--danger', '--danger-surface'],
] as const;

const GRAPHIC_PAIRS = [
  ['--focus', '--paper'],
  ['--focus', '--surface'],
  ['--focus', '--surface-raised'],
  ['--border', '--surface'],
  ['--border', '--surface-raised'],
  ['--danger', '--surface'],
] as const;

const DARK_GRAPHIC_PAIRS = [
  ['--focus', '--ink'],
  ['--focus', '--surface'],
  ['--focus', '--surface-raised'],
  ['--border', '--surface'],
  ['--border', '--surface-raised'],
  ['--danger', '--surface'],
] as const;

describe('tokens de color', () => {
  it('declara la paleta y los roles de ambos temas', () => {
    expect(palette.size).toBeGreaterThan(0);
    expect(themes.light.size).toBeGreaterThan(0);
    expect(themes.dark.size).toBeGreaterThan(0);
    expect(themes.light.get('--bg')).toBe('var(--paper)');
    expect(themes.light.get('--fg')).toBe('var(--ink)');
    expect(themes.dark.get('--bg')).toBe('var(--ink)');
    expect(themes.dark.get('--fg')).toBe('var(--paper)');
    expect(themes.light.get('--overlay')).toBe('var(--palette-overlay)');
    expect(themes.dark.get('--overlay')).toBe('var(--palette-overlay)');
    expect(themes.light.get('--disabled-surface')).toBe('var(--surface)');
    expect(themes.light.get('--disabled-text')).toBe('var(--muted)');
    expect(themes.dark.get('--disabled-surface')).toBe('var(--surface)');
    expect(themes.dark.get('--disabled-text')).toBe('var(--muted)');
  });

  it('supera 7:1 para el texto principal en tema claro', () => {
    for (const background of TEXT_BACKGROUNDS) {
      expectContrast('light', '--ink', background, 7);
    }
  });

  it('supera 7:1 para el texto principal en tema oscuro', () => {
    for (const background of DARK_TEXT_BACKGROUNDS) {
      expectContrast('dark', '--paper', background, 7);
    }
  });

  it('supera 4,5:1 en los roles secundarios y de estado de cada tema', () => {
    for (const [foreground, background] of SECONDARY_PAIRS) {
      expectContrast('light', foreground, background, 4.5);
    }

    for (const [foreground, background] of DARK_SECONDARY_PAIRS) {
      expectContrast('dark', foreground, background, 4.5);
    }
  });

  it('supera 3:1 en foco y bordes de ambos temas', () => {
    for (const [foreground, background] of GRAPHIC_PAIRS) {
      expectContrast('light', foreground, background, 3);
    }

    for (const [foreground, background] of DARK_GRAPHIC_PAIRS) {
      expectContrast('dark', foreground, background, 3);
    }
  });

  it('--bg y --fg superan 7:1 en ambos temas', () => {
    for (const theme of ['light', 'dark'] as const) {
      const ratio = contrastRatio(color('--bg', theme), color('--fg', theme));

      expect(
        ratio,
        `${theme}: --bg sobre --fg (${ratio.toFixed(2)}:1)`,
      ).toBeGreaterThanOrEqual(7);
    }
  });

  it('el estado deshabilitado conserva texto legible sin opacidad', () => {
    for (const theme of ['light', 'dark'] as const) {
      expectContrast(theme, '--disabled-text', '--disabled-surface', 4.5);
    }
  });
});

describe('disciplina de tokens', () => {
  const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;

  it('solo palette.css declara colores literales', () => {
    for (const [name, source] of [
      ['tokens/semantic.css', semanticSource],
      ['tokens/scales.css', scalesSource],
      ['base.css', baseSource],
      ['components.css', componentsSource],
    ] as const) {
      expect(stripComments(source), name).not.toMatch(LITERAL_COLOR);
    }
  });

  it('todas las referencias a la paleta están declaradas', () => {
    for (const source of [
      semanticSource,
      scalesSource,
      baseSource,
      componentsSource,
    ]) {
      for (const match of stripComments(source).matchAll(
        /var\(\s*(--palette-[a-z0-9-]+)\s*\)/gi,
      )) {
        const name = match[1] ?? '';

        expect(palette.has(name), `Paleta sin definir: ${name}`).toBe(true);
      }
    }
  });

  it('no usa --ink como color de texto: en tema oscuro es una superficie', () => {
    for (const [name, source] of [
      ['base.css', baseSource],
      ['components.css', componentsSource],
    ] as const) {
      expect(stripComments(source), name).not.toMatch(
        /(?:^|[;\s])color\s*:\s*var\(--ink\)/,
      );
    }
  });

  it('ningún componente usa --ink como fondo de superficie', () => {
    for (const [name, source] of [
      ['base.css', baseSource],
      ['components.css', componentsSource],
    ] as const) {
      expect(stripComments(source), name).not.toMatch(
        /(?:^|[;\s])background-color\s*:\s*var\(--ink\)/,
      );
    }
  });
});

describe('movimiento reducido y desbordamiento', () => {
  it('anula animaciones, transiciones y desplazamiento suave', () => {
    const mediaQuery = /@media\s*\(prefers-reduced-motion:\s*reduce\)/i.exec(
      baseSource,
    );

    expect(mediaQuery, 'Falta el bloque de movimiento reducido').not.toBeNull();

    const reset = baseSource.slice(mediaQuery?.index ?? 0);

    expect(reset).toContain('animation-duration');
    expect(reset).toContain('transition-duration');
    expect(reset).toContain('scroll-behavior');
  });

  it('no aplica overflow-x: hidden a html ni a body', () => {
    const pageSelectors = new Set(['html', 'body']);

    for (const [name, source] of [
      ['tokens/palette.css', paletteSource],
      ['tokens/semantic.css', semanticSource],
      ['tokens/scales.css', scalesSource],
      ['base.css', baseSource],
      ['components.css', componentsSource],
    ] as const) {
      for (const block of parseBlocks(source)) {
        const targetsPage = block.selector
          .split(',')
          .some((part) => pageSelectors.has(part.trim()));

        if (targetsPage) {
          expect(block.body, name).not.toMatch(/overflow-x\s*:\s*hidden/i);
        }
      }
    }
  });
});

describe('medidas del shell', () => {
  it('define el rail y la barra superior de escritorio', () => {
    const declarations = readDeclarations(scalesSource);

    expect(declarations.get('--sidebar-width')).toBe('240px');
    expect(declarations.get('--sidebar-width-collapsed')).toBe('64px');
    expect(declarations.get('--topbar-height')).toBe('56px');
  });
});
