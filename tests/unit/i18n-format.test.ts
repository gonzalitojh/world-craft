import { describe, expect, it } from 'vitest';

import { createFormatters } from '@/lib/i18n/format';

/**
 * Formatos regionales con `Intl` (M0-12).
 *
 * Los formateadores son la única vía para fechas y números visibles: se
 * comprueba que respetan el locale, que las fechas van en UTC por defecto y que
 * un valor inválido no rompe el render.
 */

const es = createFormatters('es');
const en = createFormatters('en');
const itFormatters = createFormatters('it');

describe('fechas', () => {
  it('formatea en UTC por defecto y no en la zona del servidor', () => {
    // 23:30 UTC sigue siendo día 15; en Europe/Madrid ya sería día 16.
    const late = '2026-01-15T23:30:00.000Z';

    expect(es.date(late)).toContain('15');
    expect(es.date(late)).not.toContain('16');
  });

  it('usa el idioma recibido', () => {
    const date = '2026-01-15T12:00:00.000Z';

    expect(es.date(date)).not.toBe(en.date(date));
    expect(es.date(date)).toContain('2026');
  });

  it('respeta una zona explícita', () => {
    const date = '2026-01-15T23:30:00.000Z';

    expect(es.date(date, { timeZone: 'Europe/Madrid' })).toContain('16');
  });

  it('incluye la hora y la zona en dateTime', () => {
    const formatted = es.dateTime('2026-01-15T12:34:56.000Z', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });

    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/UTC|GMT/);
  });

  it('acepta Date, número y cadena ISO', () => {
    const date = new Date('2026-03-01T00:00:00.000Z');

    expect(es.date(date)).toBe(es.date(date.getTime()));
    expect(es.date(date)).toBe(es.date(date.toISOString()));
  });

  it('devuelve cadena vacía con una fecha inválida', () => {
    expect(es.date('no es una fecha')).toBe('');
    expect(es.dateTime(Number.NaN)).toBe('');
  });
});

describe('números', () => {
  it('usa los separadores de cada idioma', () => {
    expect(es.number(1234567.5)).toBe('1.234.567,5');
    expect(en.number(1234567.5)).toBe('1,234,567.5');
    expect(itFormatters.number(1234567.5)).toBe('1.234.567,5');
  });

  it('fija un decimal para ratios y medidas', () => {
    expect(es.decimal(4.8)).toBe('4,8');
    expect(en.decimal(4.8)).toBe('4.8');
    expect(es.decimal(4.85)).toBe('4,9');
  });
});

describe('textos formativos', () => {
  it('resuelve el tiempo relativo con la unidad del idioma', () => {
    expect(es.relativeTime(-3, 'day')).toContain('3');
    expect(en.relativeTime(-3, 'day')).toContain('3');
    expect(es.relativeTime(-3, 'day')).not.toBe(en.relativeTime(-3, 'day'));
  });

  it('enumera con la conjunción del idioma', () => {
    expect(es.list(['mapas', 'fichas'])).toContain(' y ');
    expect(en.list(['maps', 'sheets'])).toContain(' and ');
  });

  it('elige la categoría plural de cada idioma', () => {
    expect(es.plural(1)).toBe('one');
    expect(es.plural(2)).toBe('other');
    expect(en.plural(1)).toBe('one');
    expect(itFormatters.plural(1)).toBe('one');
  });
});
