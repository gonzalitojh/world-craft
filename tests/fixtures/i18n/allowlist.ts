/**
 * Allowlist de literales visibles de la auditoría estática.
 *
 * Cada entrada permite un texto literal en un archivo concreto y **exige un
 * motivo**. La prueba `i18n-hardcoded` comprueba además que ninguna entrada
 * sobra: si el literal desaparece del archivo, la entrada también debe irse.
 *
 * Regla: aquí solo entran nombres técnicos (utilidades de Tailwind, unidades,
 * marcadores de muestra), nunca frases de interfaz. Una frase nueva va al
 * catálogo `src/messages/es.ts`.
 */
export type HardcodedAllowlistEntry = {
  /** Ruta relativa con separadores `/`, desde la raíz del repositorio. */
  file: string;
  /** Texto literal exacto que se permite. */
  value: string;
  /** Por qué no es una cadena de interfaz traducible. */
  reason: string;
};

export const HARDCODED_ALLOWLIST: readonly HardcodedAllowlistEntry[] = [
  {
    file: 'src/app/(workspace)/design-system/page.tsx',
    value: 'Aa',
    reason:
      'Muestra tipográfica del ratio de contraste: no es una frase, es el espécimen que se mide.',
  },
  {
    file: 'src/app/(workspace)/design-system/page.tsx',
    value: 'rem',
    reason:
      'Unidad CSS que acompaña al valor numérico de la escala de espaciado.',
  },
  {
    file: 'src/app/(workspace)/design-system/page.tsx',
    value: 'text-base · font-sans',
    reason:
      'Nombre técnico de la utilidad de Tailwind que ilustra el espécimen; no se traduce.',
  },
  {
    file: 'src/app/(workspace)/design-system/page.tsx',
    value: 'font-mono',
    reason:
      'Nombre técnico de la utilidad de Tailwind que ilustra el espécimen; no se traduce.',
  },
  {
    file: 'src/app/(workspace)/design-system/page.tsx',
    value: 'text-eyebrow · tracking-eyebrow',
    reason:
      'Nombre técnico de la utilidad de Tailwind que ilustra el espécimen; no se traduce.',
  },
];
