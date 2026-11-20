import { describe, expect, it } from 'vitest';

import { formatLastChecked, formatPercent } from '@/renderer/updates/format';

describe('formatos de actualizaciones', () => {
  it('formatea la última comprobación con Intl y devuelve null si falta', () => {
    const formatted = formatLastChecked('2026-11-19T16:05:00.000Z');

    expect(formatted).not.toBeNull();
    expect(formatted).toContain('2026');
    expect(formatted?.length).toBeGreaterThan(8);
    expect(formatLastChecked(null)).toBeNull();
    expect(formatLastChecked('no-es-una-fecha')).toBeNull();
  });

  it('formatea el porcentaje sin decimales', () => {
    expect(formatPercent(0)).toBe('0');
    expect(formatPercent(42.7)).toBe('43');
    expect(formatPercent(100)).toBe('100');
  });
});
