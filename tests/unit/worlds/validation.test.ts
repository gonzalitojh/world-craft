import { describe, expect, it } from 'vitest';

import { WorldInputError } from '@/main/worlds/errors';
import {
  normalizeWorldDescription,
  normalizeWorldGenres,
  normalizeWorldLanguage,
  normalizeWorldName,
  normalizeWorldSummary,
} from '@/main/worlds/validation';
import type { WorldLanguage } from '@/shared/contracts/worlds';
import { plainTextToRichTextDocument } from '@/shared/entities/description';

describe('validación de campos del mundo', () => {
  it('recorta y colapsa los espacios del nombre', () => {
    expect(normalizeWorldName('  Las   Mareas   Grises ')).toBe(
      'Las Mareas Grises',
    );
  });

  it('rechaza un nombre vacío o demasiado largo', () => {
    expect(() => normalizeWorldName('   ')).toThrow(WorldInputError);
    expect(() => normalizeWorldName('a'.repeat(121))).toThrow(WorldInputError);
  });

  it('convierte un resumen vacío en null y limita su longitud', () => {
    expect(normalizeWorldSummary('   ')).toBeNull();
    expect(normalizeWorldSummary(undefined)).toBeNull();
    expect(normalizeWorldSummary('  Una   historia  ')).toBe('Una historia');
    expect(() => normalizeWorldSummary('a'.repeat(281))).toThrow(
      WorldInputError,
    );
  });

  it('normaliza la descripción a documento y calcula su texto plano', () => {
    const normalized = normalizeWorldDescription(
      plainTextToRichTextDocument('  Primera línea.\n\nSegunda.  '),
    );

    expect(normalized.text).toBe('Primera línea.\nSegunda.');
    expect(normalized.document).toEqual(
      plainTextToRichTextDocument('Primera línea.\nSegunda.'),
    );
    expect(normalized.json).toContain('"type":"doc"');
    expect(normalizeWorldDescription(null).json).toBeNull();
    expect(
      normalizeWorldDescription(plainTextToRichTextDocument('   ')).text,
    ).toBeNull();
    expect(() =>
      normalizeWorldDescription(
        plainTextToRichTextDocument('a'.repeat(4_001)),
      ),
    ).toThrow(WorldInputError);
  });

  it('deduplica géneros sin distinguir mayúsculas y descarta los vacíos', () => {
    expect(
      normalizeWorldGenres([' Fantasía ', 'fantasía', '', '  ', 'Aventura']),
    ).toEqual(['Fantasía', 'Aventura']);
    expect(normalizeWorldGenres(undefined)).toEqual([]);
  });

  it('rechaza más de ocho géneros o uno demasiado largo', () => {
    expect(() =>
      normalizeWorldGenres(
        Array.from({ length: 9 }, (_, index) => `g${index}`),
      ),
    ).toThrow(WorldInputError);
    expect(() => normalizeWorldGenres(['a'.repeat(41)])).toThrow(
      WorldInputError,
    );
  });

  it('usa el español por defecto y rechaza idiomas no admitidos', () => {
    expect(normalizeWorldLanguage(undefined)).toBe('es');
    expect(normalizeWorldLanguage('en')).toBe('en');
    expect(() => normalizeWorldLanguage('fr')).toThrow(WorldInputError);
  });

  it('acepta el tipo de idioma compartido', () => {
    const language: WorldLanguage = 'it';

    expect(normalizeWorldLanguage(language)).toBe('it');
  });
});
