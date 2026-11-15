import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '@/lib/contrast';
import { PALETTE, THEME_COLORS } from '@/lib/theme-palette';

/**
 * Guardas del sistema de tokens (issue #8).
 *
 * Estas pruebas son el contrato del CSS: si alguien escribe un color fuera de
 * la paleta, deja un tema a medias o baja el contraste por debajo de AA, falla
 * aquí y no en una revisión visual.
 */

const srcDir = fileURLToPath(new URL('../../src', import.meta.url));

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
const RGB_COLOR = /\brgba?\(/;

/** Tokens crudos que deben existir en los dos temas. */
const PALETTE_TOKENS = [
  'paper',
  'paper-raised',
  'paper-sunken',
  'ink',
  'ink-muted',
  'border',
  'border-strong',
  'accent',
  'accent-strong',
  'accent-ink',
  'accent-muted',
  'danger',
  'danger-strong',
  'danger-ink',
  'danger-surface',
  'success',
  'success-ink',
  'success-surface',
  'warning',
  'warning-ink',
  'warning-surface',
  'info',
  'info-ink',
  'info-surface',
  'focus',
  'overlay',
  'shadow-tint',
] as const;

/** Tokens semánticos que deben existir en los dos temas. */
const SEMANTIC_TOKENS = [
  'surface',
  'surface-raised',
  'surface-sunken',
  'foreground',
  'muted-foreground',
  'border',
  'border-strong',
  'accent',
  'accent-strong',
  'accent-ink',
  'accent-muted',
  'danger',
  'danger-strong',
  'danger-ink',
  'danger-surface',
  'success',
  'success-ink',
  'success-surface',
  'warning',
  'warning-ink',
  'warning-surface',
  'info',
  'info-ink',
  'info-surface',
  'focus',
  'overlay',
  'elevation-card',
  'elevation-dialog',
  'elevation-rail',
] as const;

/** Parejas texto/fondo: AA exige 4.5:1 para texto normal. */
const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['ink', 'paper'],
  ['ink', 'paper-raised'],
  ['ink', 'paper-sunken'],
  ['ink-muted', 'paper'],
  ['ink-muted', 'paper-raised'],
  ['ink-muted', 'paper-sunken'],
  ['accent', 'paper'],
  ['accent', 'accent-muted'],
  ['accent-ink', 'accent'],
  ['danger', 'paper'],
  ['danger', 'danger-surface'],
  ['danger-ink', 'danger'],
  ['success', 'paper'],
  ['success', 'success-surface'],
  ['success-ink', 'success'],
  ['warning', 'paper'],
  ['warning', 'warning-surface'],
  ['warning-ink', 'warning'],
  ['info', 'paper'],
  ['info', 'info-surface'],
  ['info-ink', 'info'],
];

/** Parejas de componentes gráficos: AA exige 3:1. */
const GRAPHIC_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['border', 'paper'],
  ['border', 'paper-raised'],
  ['border', 'paper-sunken'],
  ['border-strong', 'paper'],
  ['border-strong', 'paper-raised'],
  ['focus', 'paper'],
  ['focus', 'paper-raised'],
  ['accent', 'paper'],
];

function readCss(relativePath: string): string {
  return readFileSync(join(srcDir, relativePath), 'utf8');
}

/** Ruta relativa de todos los CSS del código de la aplicación. */
function collectCssFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectCssFiles(fullPath));
    } else if (entry.name.endsWith('.css')) {
      files.push(fullPath);
    }
  }

  return files;
}

/** Convierte un bloque de declaraciones CSS en un mapa nombre → valor. */
function parseDeclarations(css: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const name = match[1];
    const value = match[2];

    if (name && value) {
      declarations.set(name, value.trim());
    }
  }

  return declarations;
}

/** Devuelve el contenido del primer bloque `{ … }` que sigue al selector. */
function themeBlock(css: string, selector: string): string {
  const selectorIndex = css.indexOf(selector);
  const openIndex = css.indexOf('{', selectorIndex);
  const closeIndex = css.indexOf('}', openIndex);

  if (selectorIndex === -1 || openIndex === -1 || closeIndex === -1) {
    throw new Error(`No se encontró el bloque CSS de ${selector}`);
  }

  return css.slice(openIndex + 1, closeIndex);
}

const paletteCss = readCss('styles/tokens/palette.css');
const semanticCss = readCss('styles/tokens/semantic.css');
const palette = parseDeclarations(paletteCss);
const semantic = parseDeclarations(semanticCss);
const lightBlock = themeBlock(semanticCss, ':root,');
const darkBlock = themeBlock(semanticCss, "[data-theme='dark']");

/** Valor hexadecimal de un token crudo en un tema. */
function paletteColor(token: string, theme: 'light' | 'dark'): string {
  const value = palette.get(`--craft-${token}-${theme}`);

  if (!value) {
    throw new Error(`Falta --craft-${token}-${theme} en palette.css`);
  }

  return value;
}

describe('paleta cruda', () => {
  it('declara cada token en el tema claro y en el oscuro', () => {
    for (const token of PALETTE_TOKENS) {
      expect(palette.has(`--craft-${token}-light`), token).toBe(true);
      expect(palette.has(`--craft-${token}-dark`), token).toBe(true);
    }
  });

  it('es el único archivo CSS con colores literales', () => {
    const offenders = collectCssFiles(srcDir)
      .filter((file) => !file.endsWith(join('tokens', 'palette.css')))
      .filter((file) => {
        // Los comentarios documentan la regla, no pintan nada: se ignoran.
        const content = readFileSync(file, 'utf8').replace(
          /\/\*[\s\S]*?\*\//g,
          '',
        );
        return HEX_COLOR.test(content) || RGB_COLOR.test(content);
      });

    expect(offenders).toEqual([]);
  });

  it('guarda los velos y las sombras como rgb() con transparencia', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(palette.get(`--craft-overlay-${theme}`)).toMatch(RGB_COLOR);
      expect(palette.get(`--craft-shadow-tint-${theme}`)).toMatch(RGB_COLOR);
    }
  });
});

describe('capa semántica', () => {
  it('define cada token en los dos temas', () => {
    for (const token of SEMANTIC_TOKENS) {
      expect(lightBlock, token).toContain(`--${token}:`);
      expect(darkBlock, token).toContain(`--${token}:`);
    }
  });

  it('no contiene ningún color literal', () => {
    for (const [name, value] of semantic) {
      expect(value, name).not.toMatch(HEX_COLOR);
      expect(value, name).not.toMatch(RGB_COLOR);
    }
  });

  it('toma todos los valores de la paleta cruda', () => {
    for (const token of SEMANTIC_TOKENS) {
      const value = semantic.get(`--${token}`);

      expect(value, token).toBeDefined();
      expect(value, token).toMatch(/^[0-9a-z\s,.()%+-]*var\(--craft-[a-z-]+\)/);
    }
  });

  it('usa la mitad correcta de la paleta en cada tema', () => {
    expect(lightBlock).not.toMatch(/-dark\)/);
    expect(darkBlock).not.toMatch(/-light\)/);
  });

  it('referencia tokens que existen en la paleta', () => {
    const referenced = [...semanticCss.matchAll(/var\((--craft-[a-z-]+)\)/g)]
      .map((match) => match[1])
      .filter((name): name is string => Boolean(name));

    expect(referenced.length).toBeGreaterThan(0);

    for (const name of referenced) {
      expect(palette.has(name), name).toBe(true);
    }
  });

  it('mapea colores y elevaciones a utilidades de Tailwind', () => {
    expect(semanticCss).toContain('@theme inline');
    expect(semanticCss).toContain('--color-surface: var(--surface);');
    expect(semanticCss).toContain('--color-border: var(--border);');
    expect(semanticCss).toContain('--color-focus: var(--focus);');
    expect(semanticCss).toContain('--shadow-card: var(--elevation-card);');
    expect(semanticCss).toContain('--shadow-dialog: var(--elevation-dialog);');
    expect(semanticCss).toContain('--shadow-rail: var(--elevation-rail);');
  });

  it('no declara elevaciones fuera del alias de sombras', () => {
    const themeMapping = themeBlock(semanticCss, '@theme inline {');

    // Las elevaciones se referencian en `--shadow-*`, pero no se declaran aquí.
    expect(themeMapping).not.toMatch(/^\s*--elevation-[a-z-]+\s*:/m);
  });
});

describe('contraste AA', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`mantiene el texto por encima de 4.5:1 en el tema ${theme}`, () => {
      for (const [foreground, background] of TEXT_PAIRS) {
        const ratio = contrastRatio(
          paletteColor(foreground, theme),
          paletteColor(background, theme),
        );

        expect(
          ratio,
          `${foreground} sobre ${background} (${theme})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`mantiene bordes y foco por encima de 3:1 en el tema ${theme}`, () => {
      for (const [foreground, background] of GRAPHIC_PAIRS) {
        const ratio = contrastRatio(
          paletteColor(foreground, theme),
          paletteColor(background, theme),
        );

        expect(
          ratio,
          `${foreground} sobre ${background} (${theme})`,
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe('theme-palette', () => {
  it('replica cada token sólido de la paleta CSS', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const [token, value] of Object.entries(PALETTE[theme])) {
        expect(paletteColor(token, theme), `${token} (${theme})`).toBe(value);
      }
    }
  });

  it('replica los colores de superficie de la paleta CSS', () => {
    expect(THEME_COLORS.light.surface).toBe(palette.get('--craft-paper-light'));
    expect(THEME_COLORS.light.ink).toBe(palette.get('--craft-ink-light'));
    expect(THEME_COLORS.dark.surface).toBe(palette.get('--craft-paper-dark'));
    expect(THEME_COLORS.dark.ink).toBe(palette.get('--craft-ink-dark'));
  });
});
