import { describe, expect, it } from 'vitest';

import { contrastRatio, formatContrastRatio } from '@/lib/contrast';

/**
 * Contraste WCAG (issue #8, fase 3).
 *
 * La fórmula es la única del proyecto: la usan la prueba de tokens y la página
 * del sistema de diseño. Estos casos fijan los valores conocidos para que un
 * cambio accidental no pase desapercibido.
 */

describe('contrastRatio', () => {
  it('da el máximo entre blanco y negro', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('da 1 entre un color y sí mismo', () => {
    expect(contrastRatio('#7a4a2b', '#7a4a2b')).toBeCloseTo(1, 5);
  });

  it('es simétrico', () => {
    expect(contrastRatio('#1f1b16', '#f7f2e8')).toBeCloseTo(
      contrastRatio('#f7f2e8', '#1f1b16'),
      5,
    );
  });

  it('acepta la forma corta de tres dígitos', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 1);
  });

  it('falla con un valor que no es un color hexadecimal', () => {
    expect(() => contrastRatio('papel', '#000000')).toThrow(/hexadecimal/i);
  });
});

describe('formatContrastRatio', () => {
  it('usa un decimal con coma española', () => {
    expect(formatContrastRatio(12.34)).toBe('12,3:1');
    expect(formatContrastRatio(4.5)).toBe('4,5:1');
  });
});
