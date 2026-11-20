import { describe, expect, it } from 'vitest';

import { WorldInputError } from '@/main/worlds/errors';
import {
  normalizeWorldSlug,
  slugifyWorldName,
  uniqueWorldSlug,
} from '@/main/worlds/slug';

describe('slugs de mundo', () => {
  it('convierte nombres con acentos, mayúsculas y espacios', () => {
    expect(slugifyWorldName('  Crónica   de las Mareas Grises  ')).toBe(
      'cronica-de-las-mareas-grises',
    );
    expect(slugifyWorldName('Archipiélago de Punta Sal')).toBe(
      'archipielago-de-punta-sal',
    );
    expect(slugifyWorldName('Año 1926: cartas y mapas')).toBe(
      'ano-1926-cartas-y-mapas',
    );
  });

  it('recorta el slug al límite sin dejar guiones finales', () => {
    const slug = slugifyWorldName(`${'a'.repeat(90)} final`);

    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('rechaza nombres que no permiten generar un identificador', () => {
    expect(() => slugifyWorldName('¿? ¡!')).toThrow(WorldInputError);
  });

  it('normaliza un slug escrito con mayúsculas', () => {
    expect(normalizeWorldSlug('  Mareas-Grises  ')).toBe('mareas-grises');
  });

  it('rechaza slugs vacíos, con espacios o caracteres no admitidos', () => {
    expect(() => normalizeWorldSlug('')).toThrow(WorldInputError);
    expect(() => normalizeWorldSlug('con espacios')).toThrow(WorldInputError);
    expect(() => normalizeWorldSlug('mayúsculas-ñ')).toThrow(WorldInputError);
    expect(() => normalizeWorldSlug('doble--guion')).toThrow(WorldInputError);
  });

  it('añade sufijos sin repetir un slug existente', () => {
    const existing = new Set(['mareas-grises', 'mareas-grises-2']);

    expect(uniqueWorldSlug('mareas-grises', (slug) => existing.has(slug))).toBe(
      'mareas-grises-3',
    );
    expect(uniqueWorldSlug('mundo-nuevo', (slug) => existing.has(slug))).toBe(
      'mundo-nuevo',
    );
  });

  it('mantiene el límite al añadir un sufijo', () => {
    const base = 'a'.repeat(80);
    const unique = uniqueWorldSlug(base, (slug) => slug === base);

    expect(unique.length).toBeLessThanOrEqual(80);
    expect(unique.endsWith('-2')).toBe(true);
  });
});
