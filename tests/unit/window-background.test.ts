import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  DARK_WINDOW_BACKGROUND,
  LIGHT_WINDOW_BACKGROUND,
  resolveWindowBackground,
} from '@/main/window-background';

const paletteSource = readFileSync(
  new URL('../../src/renderer/styles/tokens/palette.css', import.meta.url),
  'utf8',
);
const semanticSource = readFileSync(
  new URL('../../src/renderer/styles/tokens/semantic.css', import.meta.url),
  'utf8',
);

describe('fondo nativo de la ventana', () => {
  it('mapea cada tema a su color exacto', () => {
    expect(resolveWindowBackground('light')).toBe('#f6f4ef');
    expect(resolveWindowBackground('dark')).toBe('#141715');
    expect(LIGHT_WINDOW_BACKGROUND).toBe('#f6f4ef');
    expect(DARK_WINDOW_BACKGROUND).toBe('#141715');
  });

  it('coincide con --bg de los tokens Claro y Oscuro', () => {
    // `--bg` es el fondo de la ventana (semantic.css) y resuelve a la paleta.
    expect(paletteSource).toMatch(/--palette-neutral-100:\s*#f6f4ef/i);
    expect(paletteSource).toMatch(/--palette-neutral-900:\s*#141715/i);

    expect(semanticSource).toMatch(
      /\[data-theme=['"]light['"]\][^{]*\{[^}]*--bg:\s*var\(--palette-neutral-100\)/s,
    );
    expect(semanticSource).toMatch(
      /\[data-theme=['"]dark['"]\][^{]*\{[^}]*--bg:\s*var\(--palette-neutral-900\)/s,
    );
  });
});
