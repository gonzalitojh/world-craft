import { describe, expect, it } from 'vitest';

import { createFormatters } from '@/renderer/i18n/formats';
import { toIntlLocale } from '@/shared/contracts/locale';

/** Normaliza el espacio duro que `Intl` usa a veces delante del símbolo. */
function normalize(value: string): string {
  return value.replace(/\u00a0/g, ' ');
}

describe('formatos localizados con Intl', () => {
  const formats = createFormatters('es');

  it('mapea el locale interno a la etiqueta de Intl', () => {
    expect(toIntlLocale('es')).toBe('es-ES');
    expect(formats.intlLocale).toBe('es-ES');
  });

  it('formatea fechas, fecha y hora y números', () => {
    expect(
      formats.formatDate('2026-11-18T10:30:00.000Z', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }),
    ).toBe('18 nov 2026');

    expect(
      formats.formatDateTime('2026-11-18T10:30:00.000Z', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }),
    ).toContain('18 nov 2026');

    expect(formats.formatNumber(0.5)).toBe('0,5');
    expect(formats.formatNumber(1234.5)).toBe(
      new Intl.NumberFormat('es-ES').format(1234.5),
    );
  });

  it('formatea porcentajes con el estilo de Intl', () => {
    expect(normalize(formats.formatPercent(0))).toBe('0 %');
    expect(normalize(formats.formatPercent(0.427))).toBe('43 %');
    expect(normalize(formats.formatPercent(1))).toBe('100 %');
  });

  it('formatea listas y ordena con Collator', () => {
    expect(formats.formatList(['A', 'B', 'C'])).toBe('A, B y C');
    expect(formats.compare('á', 'b')).toBeLessThan(0);
  });

  it('resuelve plurales con Intl.PluralRules', () => {
    const forms = {
      one: '{count} ficha',
      other: '{count} fichas',
    };

    expect(formats.plural(1, forms)).toBe('1 ficha');
    expect(formats.plural(2, forms)).toBe('2 fichas');
    expect(formats.plural(0, forms)).toBe('0 fichas');
  });
});
