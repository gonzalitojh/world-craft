import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Guardarraíl estático de ruido visual (#133, contrato §9).
 *
 * El arnés de e2e mide la ventana real; este test impide que vuelvan a entrar
 * cajas heredadas, radios fuera de papel, selectores muertos y residuos de la
 * dirección v1. Trabaja sobre los CSS y TSX reales, sin DOM.
 *
 * Criterio de caja (contrato §2.2): un contenedor de contenido no dibuja borde
 * perimetral ni sombra, y su radio no supera `--radius-md`. Los divisores de una
 * sola cara están permitidos porque no cierran el perímetro.
 */

interface CssBlock {
  readonly file: string;
  readonly selector: string;
  readonly body: string;
}

const RENDERER_ROOT = fileURLToPath(
  new URL('../../src/renderer/', import.meta.url),
);
const STYLE_ROOT = path.join(RENDERER_ROOT, 'styles');

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '');

/** Extrae los bloques `selector { ... }` sin anidamiento. */
function parseBlocks(source: string, file: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const match of stripComments(source).matchAll(pattern)) {
    blocks.push({
      file,
      selector: (match[1] ?? '').trim(),
      body: match[2] ?? '',
    });
  }

  return blocks;
}

function listFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }

  return files;
}

const CSS_FILES = listFiles(STYLE_ROOT).filter((file) => file.endsWith('.css'));

const cssSources = new Map(
  CSS_FILES.map((file) => [
    path.relative(STYLE_ROOT, file).replaceAll('\\', '/'),
    readFileSync(file, 'utf8'),
  ]),
);

const blocks = [...cssSources].flatMap(([file, source]) =>
  parseBlocks(source, file),
);

const rendererSources = listFiles(RENDERER_ROOT)
  .filter((file) => /\.(?:ts|tsx)$/.test(file))
  .map((file) => ({
    file: path.relative(RENDERER_ROOT, file).replaceAll('\\', '/'),
    source: readFileSync(file, 'utf8'),
  }));

const rendererText = rendererSources.map(({ source }) => source).join('\n');

/** Declaraciones `propiedad: valor` de un bloque. */
function declarations(body: string): { property: string; value: string }[] {
  const result: { property: string; value: string }[] = [];

  for (const raw of body.split(';')) {
    const separator = raw.indexOf(':');

    if (separator === -1) {
      continue;
    }

    result.push({
      property: raw.slice(0, separator).trim().toLowerCase(),
      value: raw
        .slice(separator + 1)
        .replace(/!important/gi, '')
        .trim(),
    });
  }

  return result;
}

function isZero(value: string): boolean {
  return /^(?:0|none|transparent|initial|unset)$/i.test(value.trim());
}

function isPerimeterBorder(property: string, value: string): boolean {
  if (isZero(value)) {
    return false;
  }

  return (
    property === 'border' ||
    property === 'border-width' ||
    property === 'border-block' ||
    property === 'border-inline' ||
    property === 'border-block-width' ||
    property === 'border-inline-width'
  );
}

function radiusExceedsMedium(value: string): boolean {
  if (/--radius-(?:lg|xl|pill)\b/.test(value)) {
    return true;
  }

  if (/\b(?:50|999)\s*%/.test(value)) {
    return false;
  }

  return literalRadiusPixels(value) > 6;
}

/** Radio literal en píxeles; 0 si no hay ninguno (tokens o porcentajes). */
function literalRadiusPixels(value: string): number {
  let largest = 0;

  for (const match of value.matchAll(/(\d+(?:\.\d+)?)(px|rem)/g)) {
    const amount = Number.parseFloat(match[1] ?? '0');
    const pixels = match[2] === 'rem' ? amount * 16 : amount;

    largest = Math.max(largest, pixels);
  }

  return largest;
}

const CONTENT_SELECTORS = [
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
] as const;

/**
 * Excepciones declaradas en el contrato §9.2. No se comprueban como contenido:
 * overlays, controles, campos, chips, alertas, estados, marcos, barras y banco.
 */
const DECLARED_EXCEPTIONS = new Map<string, string>([
  ['wc-dialog', 'Overlay modal: borde y sombra permitidos.'],
  ['wc-menu__list', 'Overlay de menú: borde y sombra permitidos.'],
  ['wc-tooltip__bubble', 'Overlay de ayuda: borde y sombra permitidos.'],
  ['wc-toast', 'Superficie flotante de aviso: borde y sombra permitidos.'],
  ['wc-palette', 'Overlay de paleta: borde y sombra permitidos.'],
  ['wc-button', 'Control: borde de límite permitido.'],
  ['wc-icon-button', 'Control: borde de límite permitido.'],
  ['wc-field__control', 'Campo de datos: borde fuerte permitido.'],
  ['wc-checkbox', 'Control de selección: borde de límite permitido.'],
  ['wc-radio', 'Control de selección: borde de límite permitido.'],
  ['wc-image-picker__item', 'Control de selección: borde de estado permitido.'],
  ['wc-search-hit', 'Control con texto y foco: borde de límite permitido.'],
  ['wc-editor__toolbar', 'Campo del editor: borde de pieza permitido.'],
  ['wc-editor__content', 'Campo del editor: borde de pieza permitido.'],
  ['wc-badge', 'Chip o marca: borde decorativo permitido.'],
  ['wc-tag', 'Chip o marca: borde decorativo permitido.'],
  ['wc-type-mark-group', 'Marca de tipo: borde decorativo permitido.'],
  ['wc-swatch__chip', 'Banco de muestras: su función es enseñar el color.'],
  ['wc-alert', 'Alerta semántica: borde de estado permitido.'],
  ['wc-page__status', 'Estado transitorio con role=status.'],
  ['wc-updates__status', 'Estado dentro del diálogo de actualizaciones.'],
  ['wc-form__error', 'Alerta de error de formulario.'],
  ['wc-activity__error', 'Alerta de error de actividad.'],
  ['wc-inline-confirm', 'Alerta de confirmación destructiva.'],
  ['wc-gallery__item', 'Marco de miniatura de la galería.'],
  ['wc-entity-cover', 'Marco de portada de la ficha.'],
  ['wc-entity-card__media', 'Banda de portada con divisor de una cara.'],
  ['wc-topbar', 'Barra adhesiva con divisor y sombra.'],
  ['wc-skip-link', 'Enlace de salto flotante.'],
  ['wc-swatch', 'Banco de muestras: su función es enseñar el borde.'],
]);

function blocksFor(selector: string): CssBlock[] {
  return blocks.filter((block) =>
    block.selector.split(',').some((part) => part.trim() === selector),
  );
}

describe('contenedores de contenido sin caja', () => {
  it('declara cada corrección C1-C7 con su bloque de CSS', () => {
    for (const selector of [
      ...CONTENT_SELECTORS,
      '.wc-entity-card__media',
      '.wc-alert',
    ]) {
      expect(
        blocksFor(selector).length,
        `${selector} sin bloque`,
      ).toBeGreaterThan(0);
    }
  });

  it('no dibuja borde perimetral ni sombra', () => {
    for (const selector of CONTENT_SELECTORS) {
      for (const block of blocksFor(selector)) {
        for (const { property, value } of declarations(block.body)) {
          expect(
            property === 'box-shadow',
            `${block.file} · ${selector} usa box-shadow`,
          ).toBe(false);
          expect(
            isPerimeterBorder(property, value),
            `${block.file} · ${selector} usa borde perimetral: ${property}: ${value}`,
          ).toBe(false);
        }
      }
    }
  });

  it('no supera el radio medio', () => {
    for (const selector of CONTENT_SELECTORS) {
      for (const block of blocksFor(selector)) {
        for (const { property, value } of declarations(block.body)) {
          if (property !== 'border-radius') {
            continue;
          }

          expect(
            radiusExceedsMedium(value),
            `${block.file} · ${selector} usa un radio fuera de papel: ${value}`,
          ).toBe(false);
        }
      }
    }
  });

  it('no aplica caja a article ni section desnudos', () => {
    for (const block of blocks) {
      const bare = block.selector
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part === 'article' || part === 'section');

      if (bare.length === 0) {
        continue;
      }

      for (const { property, value } of declarations(block.body)) {
        expect(
          property === 'box-shadow',
          `${block.file} · ${block.selector}`,
        ).toBe(false);
        expect(
          isPerimeterBorder(property, value),
          `${block.file} · ${block.selector}: ${property}: ${value}`,
        ).toBe(false);
        expect(
          property === 'border-radius' && radiusExceedsMedium(value),
          `${block.file} · ${block.selector}: radio ${value}`,
        ).toBe(false);
      }
    }
  });

  it('mantiene las excepciones declaradas fuera de la lista de contenido', () => {
    const content = new Set<string>(CONTENT_SELECTORS);

    for (const [selector, reason] of DECLARED_EXCEPTIONS) {
      expect(reason.length, selector).toBeGreaterThan(0);
      expect(content.has(`.${selector}`), selector).toBe(false);
    }
  });
});

describe('selectores muertos', () => {
  /**
   * Prefijos que se resuelven con una plantilla en TSX, p. ej.
   * `wc-button--${variant}`. Cualquier modificador con ese prefijo se considera
   * vivo: su valor concreto no se puede comprobar de forma estática.
   */
  const DYNAMIC_PREFIXES = [
    ...new Set(
      [...rendererText.matchAll(/(wc-[a-z0-9_-]+--)\$\{/g)].map(
        (match) => match[1] ?? '',
      ),
    ),
  ];

  /** Clases generadas por Tiptap/ProseMirror, no por nuestro TSX. */
  const ALLOWLIST = new Map<string, string>([
    [
      'is-editor-empty',
      'La genera Tiptap para el placeholder del editor en lectura.',
    ],
  ]);

  const classes = new Set<string>();

  for (const block of blocks) {
    for (const match of block.selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      const name = match[1] ?? '';

      if (name.length > 0) {
        classes.add(name);
      }
    }
  }

  function isUsed(className: string): boolean {
    if (ALLOWLIST.has(className)) {
      return true;
    }

    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`);

    if (boundary.test(rendererText)) {
      return true;
    }

    return DYNAMIC_PREFIXES.some(
      (prefix) => className.startsWith(prefix) && rendererText.includes(prefix),
    );
  }

  it('no deja ninguna clase de CSS sin consumidor', () => {
    const dead = [...classes].filter((name) => !isUsed(name)).sort();

    expect(dead).toEqual([]);
  });

  it('resuelve los prefijos dinámicos desde el código real', () => {
    for (const prefix of [
      'wc-button--',
      'wc-icon-button--',
      'wc-tag--',
      'wc-toast--',
      'wc-type-color--',
    ]) {
      expect(DYNAMIC_PREFIXES, prefix).toContain(prefix);
    }
  });

  it('solo permite clases generadas fuera de nuestro código con motivo', () => {
    for (const [className, reason] of ALLOWLIST) {
      expect(classes.has(className), className).toBe(true);
      expect(reason.length, className).toBeGreaterThan(0);
    }
  });
});

describe('residuos de la dirección v1', () => {
  it('retira --paper, --ink, --font-display y las familias antiguas', () => {
    for (const [file, source] of cssSources) {
      const clean = stripComments(source);

      expect(clean, file).not.toMatch(/--(?:paper|ink)\b/);
      expect(clean, file).not.toMatch(/--font-display/);
      expect(clean, file).not.toMatch(/palette-(?:paper|moss|ochre|prussian)/);
    }

    for (const { file, source } of rendererSources) {
      expect(source, file).not.toMatch(/--(?:paper|ink)\b/);
      expect(source, file).not.toMatch(/--font-display/);
      expect(source, file).not.toMatch(/palette-(?:paper|moss|ochre|prussian)/);
    }
  });

  it('solo declara data-theme en semantic.css', () => {
    for (const [file, source] of cssSources) {
      if (file === 'tokens/semantic.css') {
        continue;
      }

      expect(stripComments(source), file).not.toMatch(/data-theme/);
    }
  });

  it('no esconde el desbordamiento global con overflow-x: hidden', () => {
    for (const block of blocks) {
      const targetsRoot = block.selector
        .split(',')
        .map((part) => part.trim())
        .some((part) => /^(?:html|body|html,\s*body|body,\s*html)$/.test(part));

      if (!targetsRoot) {
        continue;
      }

      for (const { property, value } of declarations(block.body)) {
        expect(
          property === 'overflow-x' && value === 'hidden',
          `${block.file} · ${block.selector}`,
        ).toBe(false);
      }
    }
  });

  it('no usa !important fuera del reset de movimiento reducido', () => {
    for (const [file, source] of cssSources) {
      if (file === 'base.css') {
        continue;
      }

      expect(stripComments(source), file).not.toMatch(/!important/);
    }

    const base = stripComments(cssSources.get('base.css') ?? '');
    const resetIndex = base.indexOf('@media (prefers-reduced-motion');

    expect(resetIndex).toBeGreaterThan(-1);

    for (const match of base.matchAll(/!important/g)) {
      expect(
        match.index ?? 0,
        '!important fuera del reset de movimiento reducido',
      ).toBeGreaterThan(resetIndex);
    }
  });

  it('no introduce radios literales mayores que el medio', () => {
    for (const block of blocks) {
      for (const { property, value } of declarations(block.body)) {
        if (property !== 'border-radius') {
          continue;
        }

        expect(
          literalRadiusPixels(value),
          `${block.file} · ${block.selector}: ${value}`,
        ).toBeLessThanOrEqual(6);
      }
    }
  });
});
