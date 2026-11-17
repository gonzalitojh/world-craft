import { describe, expect, it } from 'vitest';

import {
  isLocale,
  LOCALES,
  negotiateLocale,
  resolveLocale,
} from '@/lib/i18n/locale';

/**
 * Resolución del idioma de una petición (M0-12).
 *
 * Estas funciones son puras: se prueban sin React ni Next. Lo que se cubre es
 * la precedencia entre fuentes, la validación de valores manipulados y la
 * negociación de `Accept-Language`.
 */

describe('LOCALES', () => {
  it('coincide con el CHECK de profiles.locale', () => {
    expect(LOCALES).toEqual(['es', 'en', 'it']);
  });

  it('reconoce solo etiquetas del producto', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('it')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('ES')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('negotiateLocale', () => {
  const available = ['es', 'en', 'it'] as const;

  it('elige la primera preferencia disponible', () => {
    expect(negotiateLocale('en-US,en;q=0.9,es;q=0.8', available)).toBe('en');
  });

  it('respeta las q-values por encima del orden', () => {
    expect(negotiateLocale('es;q=0.4,it;q=0.9,en;q=0.5', available)).toBe('it');
  });

  it('mantiene el orden original cuando las q-values empatan', () => {
    expect(negotiateLocale('it,en;q=0.9', available)).toBe('it');
  });

  it('reduce una etiqueta completa a su idioma base', () => {
    expect(negotiateLocale('en-GB,en;q=0.9', available)).toBe('en');
    expect(negotiateLocale('it-IT', available)).toBe('it');
  });

  it('admite el comodín como primer idioma disponible', () => {
    expect(negotiateLocale('*', available)).toBe('es');
    expect(negotiateLocale('fr;q=0.9,*;q=0.1', available)).toBe('es');
  });

  it('descarta las entradas rechazadas con q=0', () => {
    expect(negotiateLocale('en;q=0,it;q=0.5', available)).toBe('it');
  });

  it('ignora entradas con q inválida', () => {
    expect(negotiateLocale('en;q=abc,it;q=0.5', available)).toBe('it');
    expect(negotiateLocale('en;q=2,it;q=0.5', available)).toBe('it');
    expect(negotiateLocale('en;q=-1,it;q=0.5', available)).toBe('it');
  });

  it('normaliza mayúsculas y espacios', () => {
    expect(negotiateLocale('  EN-gb , es;q=0.5 ', available)).toBe('en');
  });

  it('devuelve null si ninguna preferencia está disponible', () => {
    expect(negotiateLocale('fr,de;q=0.8', available)).toBeNull();
    expect(negotiateLocale('', available)).toBeNull();
    expect(negotiateLocale(null, available)).toBeNull();
    expect(negotiateLocale('en', [])).toBeNull();
  });

  it('tolera una cabecera enorme sin salirse de los límites', () => {
    const longPrefix = 'fr;q=0.9,'.repeat(100);
    const longTag = `en,${'x'.repeat(1000)}`;

    expect(negotiateLocale(`${longPrefix}it;q=0.1`, available)).toBeNull();
    expect(negotiateLocale(longTag, available)).toBe('en');
  });
});

describe('resolveLocale', () => {
  const available = ['es', 'en', 'it'] as const;

  it('prefiere profiles.locale sobre todas las demás fuentes', () => {
    expect(
      resolveLocale({
        profileLocale: 'it',
        cookieLocale: 'en',
        acceptLanguage: 'en-US,en;q=0.9',
        available,
      }),
    ).toBe('it');
  });

  it('usa la cookie cuando no hay locale de perfil', () => {
    expect(
      resolveLocale({
        cookieLocale: 'en',
        acceptLanguage: 'it',
        available,
      }),
    ).toBe('en');
  });

  it('usa Accept-Language cuando no hay perfil ni cookie', () => {
    expect(
      resolveLocale({
        acceptLanguage: 'it-IT,it;q=0.9',
        available,
      }),
    ).toBe('it');
  });

  it('cae al idioma por defecto sin fuentes válidas', () => {
    expect(resolveLocale({ available })).toBe('es');
    expect(
      resolveLocale({ cookieLocale: 'fr', acceptLanguage: 'de', available }),
    ).toBe('es');
  });

  it('ignora fuentes con idioma sin catálogo disponible', () => {
    expect(
      resolveLocale({
        profileLocale: 'en',
        cookieLocale: 'es',
        available: ['es'],
      }),
    ).toBe('es');
  });

  it('ignora valores manipulados sin romper', () => {
    expect(
      resolveLocale({
        profileLocale: 'es<script>',
        cookieLocale: '../../etc/passwd',
        acceptLanguage: 'not a language',
        available,
      }),
    ).toBe('es');
  });

  it('usa el primer idioma disponible si el de defecto no lo está', () => {
    expect(resolveLocale({ available: ['en', 'it'] })).toBe('en');
  });
});
