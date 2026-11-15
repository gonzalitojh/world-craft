/**
 * Paleta del tema en hexadecimal.
 *
 * Es la única copia de la paleta fuera de `src/styles/tokens/palette.css` y
 * existe por tres motivos concretos:
 *
 * - `viewport.themeColor` de `layout.tsx` no resuelve `var(--surface)` y se
 *   serializa como valor literal.
 * - El manifest se sirve como JSON estático.
 * - La página viva del sistema de diseño calcula ratios de contraste en el
 *   servidor, donde no hay CSS que resolver.
 *
 * `tests/unit/tokens.test.ts` compara cada valor con la variable homónima de
 * `palette.css`: si uno cambia allí y no aquí, el test falla. Las claves son el
 * trozo central de la variable (`paper` → `--craft-paper-light`).
 */
export const PALETTE = {
  light: {
    paper: '#f7f2e8',
    'paper-raised': '#efe8db',
    'paper-sunken': '#f1eadf',
    ink: '#1f1b16',
    'ink-muted': '#5a5147',
    border: '#8c7a63',
    'border-strong': '#6b5c49',
    accent: '#7a4a2b',
    'accent-strong': '#633a1f',
    'accent-ink': '#f7f2e8',
    'accent-muted': '#f0e2d5',
    danger: '#8c4a3c',
    'danger-surface': '#f3e3df',
    success: '#2f6b3f',
    'success-surface': '#e6efe1',
    warning: '#7d5600',
    'warning-surface': '#f7ecd6',
    info: '#2f5d7a',
    'info-surface': '#e3edf3',
    focus: '#2f6f62',
  },
  dark: {
    paper: '#15120e',
    'paper-raised': '#211c17',
    'paper-sunken': '#100d0a',
    ink: '#ede6d8',
    'ink-muted': '#b9ae9c',
    border: '#7a6a56',
    'border-strong': '#9b876e',
    accent: '#d9a066',
    'accent-strong': '#e6b47e',
    'accent-ink': '#15120e',
    'accent-muted': '#2e2418',
    danger: '#e08a7a',
    'danger-surface': '#2a1c19',
    success: '#8fce9f',
    'success-surface': '#1b2a1f',
    warning: '#e6c07b',
    'warning-surface': '#2a2317',
    info: '#93c7e0',
    'info-surface': '#1a2630',
    focus: '#7fbfb0',
  },
} as const;

/** Nombre de un tema pintado, sin la opción «sistema». */
export type ResolvedThemeName = keyof typeof PALETTE;

/** Token de la paleta cruda, por ejemplo `paper-raised`. */
export type PaletteToken = keyof (typeof PALETTE)[ResolvedThemeName];

/** Colores de superficie por tema, para `<meta name="theme-color">`. */
export const THEME_COLORS = {
  light: {
    /** `--craft-paper-light`. */
    surface: PALETTE.light.paper,
    /** `--craft-ink-light`; color de marca del manifest. */
    ink: PALETTE.light.ink,
  },
  dark: {
    /** `--craft-paper-dark`. */
    surface: PALETTE.dark.paper,
    /** `--craft-ink-dark`. */
    ink: PALETTE.dark.ink,
  },
} as const;
