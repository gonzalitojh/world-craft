/**
 * Contraste WCAG 2.x.
 *
 * Única implementación de la fórmula en el proyecto: la usan la prueba de
 * tokens y la página del sistema de diseño, que muestra los ratios reales.
 * Es una función pura y sin dependencias para poder probarla con facilidad.
 */

type Rgb = { r: number; g: number; b: number };

/** Convierte `#rgb`, `#rrggbb` o `#rrggbbaa` (sin alfa) a canales 0-255. */
function hexToRgb(hex: string): Rgb {
  const normalized = hex.trim().replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : normalized;

  if (expanded.length < 6 || !/^[0-9a-f]{6}$/i.test(expanded.slice(0, 6))) {
    throw new Error(`Color hexadecimal no válido: ${hex}`);
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

/** Luminancia relativa según WCAG 2.x. */
function relativeLuminance({ r, g, b }: Rgb): number {
  const toLinear = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Relación de contraste entre dos colores hexadecimales.
 *
 * Devuelve un valor entre 1 y 21. AA exige 4.5:1 para texto normal y 3:1 para
 * texto grande y componentes gráficos.
 */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(hexToRgb(first));
  const b = relativeLuminance(hexToRgb(second));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}

/** Formatea un ratio con un decimal y coma decimal española: `4,8:1`. */
export function formatContrastRatio(ratio: number): string {
  const formatted = new Intl.NumberFormat('es', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio);

  return `${formatted}:1`;
}
