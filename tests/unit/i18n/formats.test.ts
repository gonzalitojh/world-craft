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

describe('fechas relativas con Intl.RelativeTimeFormat', () => {
  const formats = createFormatters('es');
  const NOW = Date.parse('2026-11-21T12:00:00.000Z');
  const SECOND = 1_000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  function before(milliseconds: number): number {
    return NOW - milliseconds;
  }

  it('empieza en «ahora» y recorta las fechas futuras', () => {
    expect(formats.formatRelativeTime(NOW, NOW)).toBe('ahora');
    expect(formats.formatRelativeTime(NOW - 10 * SECOND, NOW)).toBe('ahora');
    expect(formats.formatRelativeTime(NOW + 3 * HOUR, NOW)).toBe('ahora');
  });

  it('usa minutos, horas y días con plural automático', () => {
    expect(formats.formatRelativeTime(before(MINUTE), NOW)).toBe(
      'hace 1 minuto',
    );
    expect(formats.formatRelativeTime(before(5 * MINUTE), NOW)).toBe(
      'hace 5 minutos',
    );
    expect(formats.formatRelativeTime(before(44 * MINUTE), NOW)).toBe(
      'hace 44 minutos',
    );
    expect(formats.formatRelativeTime(before(3 * HOUR), NOW)).toBe(
      'hace 3 horas',
    );
    expect(formats.formatRelativeTime(before(2 * DAY), NOW)).toBe('anteayer');
    expect(formats.formatRelativeTime(before(5 * DAY), NOW)).toBe(
      'hace 5 días',
    );
  });

  it('usa semanas, meses y años con las formas idiomáticas de Intl', () => {
    expect(formats.formatRelativeTime(before(7 * DAY), NOW)).toBe(
      'la semana pasada',
    );
    expect(formats.formatRelativeTime(before(14 * DAY), NOW)).toBe(
      'hace 2 semanas',
    );
    expect(formats.formatRelativeTime(before(30 * DAY), NOW)).toBe(
      'el mes pasado',
    );
    expect(formats.formatRelativeTime(before(90 * DAY), NOW)).toBe(
      'hace 3 meses',
    );
    expect(formats.formatRelativeTime(before(365 * DAY), NOW)).toBe(
      'el año pasado',
    );
    expect(formats.formatRelativeTime(before(2 * 365 * DAY), NOW)).toBe(
      'hace 2 años',
    );
  });

  it('acepta Date, número y cadena ISO sin depender del reloj real', () => {
    const value = before(3 * HOUR);

    expect(formats.formatRelativeTime(new Date(value), NOW)).toBe(
      'hace 3 horas',
    );
    expect(formats.formatRelativeTime(value, NOW)).toBe('hace 3 horas');
    expect(formats.formatRelativeTime(new Date(value).toISOString(), NOW)).toBe(
      'hace 3 horas',
    );
  });
});
