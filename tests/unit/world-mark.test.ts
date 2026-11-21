import { describe, expect, it } from 'vitest';

import { worldMarkVariant } from '@/renderer/lib/world-mark';

describe('marca procedural de mundo', () => {
  it('es determinista para el mismo id', () => {
    const first = worldMarkVariant('01900000-0000-7000-8000-000000000001');

    for (let index = 0; index < 10; index += 1) {
      expect(worldMarkVariant('01900000-0000-7000-8000-000000000001')).toEqual(
        first,
      );
    }
  });

  it('reproduce los vectores de control de la especificación', () => {
    expect(worldMarkVariant('world-1')).toEqual({ motif: 1, tone: 2 });
    expect(worldMarkVariant('Las Mareas Grises')).toEqual({
      motif: 3,
      tone: 3,
    });
    expect(worldMarkVariant('abc')).toEqual({ motif: 3, tone: 1 });
    expect(worldMarkVariant('00000000-0000-4000-8000-000000000000')).toEqual({
      motif: 1,
      tone: 2,
    });
  });

  it('cubre los cuatro motivos y los cuatro tonos con ids sintéticos', () => {
    const motifs = new Set<number>();
    const tones = new Set<number>();

    for (let index = 0; index < 500; index += 1) {
      const variant = worldMarkVariant(`mundo-${index}`);

      expect(variant.motif).toBeGreaterThanOrEqual(0);
      expect(variant.motif).toBeLessThanOrEqual(3);
      expect(variant.tone).toBeGreaterThanOrEqual(0);
      expect(variant.tone).toBeLessThanOrEqual(3);

      motifs.add(variant.motif);
      tones.add(variant.tone);
    }

    expect(motifs.size).toBe(4);
    expect(tones.size).toBe(4);
  });

  it('no rompe con la cadena vacía', () => {
    // El tono documentado en la especificación (2) no coincide con su propio
    // algoritmo: la semilla inicial 2166136261 da tono 0. Se fija el valor real
    // para que el comportamiento quede blindado.
    expect(worldMarkVariant('')).toEqual({ motif: 1, tone: 0 });
  });
});
