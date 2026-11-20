import { describe, expect, it } from 'vitest';

import { RelationInputError } from '@/main/relations/errors';
import {
  normalizeRelationFilter,
  normalizeRelationLabel,
  normalizeRelationMetadata,
  normalizeRelationNotes,
  normalizeRelationStrength,
  normalizeRelationTypeInverseName,
  normalizeRelationTypeKey,
  normalizeRelationTypeName,
  slugifyRelationTypeName,
  uniqueRelationTypeKey,
} from '@/main/relations/validation';
import {
  RELATION_LIST_LIMIT_DEFAULT,
  RELATION_LIST_LIMIT_MAX,
  RELATION_METADATA_JSON_MAX_LENGTH,
  RELATION_NOTES_MAX_LENGTH,
  RELATION_TYPE_NAME_MAX_LENGTH,
} from '@/shared/contracts/relations';

describe('validación de relaciones', () => {
  it('normaliza nombres y etiquetas vacías', () => {
    expect(normalizeRelationTypeName('  Aliado   de  ')).toBe('Aliado de');
    expect(normalizeRelationTypeInverseName(' Tiene  como aliado a ')).toBe(
      'Tiene como aliado a',
    );
    expect(normalizeRelationLabel('  ')).toBeNull();
    expect(normalizeRelationLabel(' Mentor de ')).toBe('Mentor de');
    expect(normalizeRelationNotes('   ')).toBeNull();
    expect(normalizeRelationNotes('  Nota  ')).toBe('Nota');
  });

  it('rechaza nombres y etiquetas fuera de límite', () => {
    expect(() =>
      normalizeRelationTypeName('x'.repeat(RELATION_TYPE_NAME_MAX_LENGTH + 1)),
    ).toThrow(RelationInputError);
    expect(() => normalizeRelationTypeName('   ')).toThrow(RelationInputError);
    expect(() =>
      normalizeRelationNotes('x'.repeat(RELATION_NOTES_MAX_LENGTH + 1)),
    ).toThrow(RelationInputError);
  });

  it('genera claves y evita las del sistema', () => {
    expect(slugifyRelationTypeName('Protege a')).toBe('protege-a');
    expect(slugifyRelationTypeName('Cónyuge de')).toBe('conyuge-de');
    expect(normalizeRelationTypeKey('aliado-de')).toBe('aliado-de');
    expect(() => normalizeRelationTypeKey('Aliado De')).toThrow(
      RelationInputError,
    );
    expect(() => normalizeRelationTypeKey('related-to')).toThrow(
      RelationInputError,
    );
    expect(
      uniqueRelationTypeKey(
        'aliado-de',
        (candidate) => candidate === 'aliado-de',
      ),
    ).toBe('aliado-de-2');
    expect(uniqueRelationTypeKey('related-to', () => false)).toBe(
      'related-to-2',
    );
  });

  it('valida la fuerza entre 1 y 5 y aplica el valor por defecto', () => {
    expect(normalizeRelationStrength(undefined)).toBe(1);
    expect(normalizeRelationStrength(5)).toBe(5);
    expect(() => normalizeRelationStrength(0)).toThrow(RelationInputError);
    expect(() => normalizeRelationStrength(6)).toThrow(RelationInputError);
    expect(() => normalizeRelationStrength(2.5)).toThrow(RelationInputError);
  });

  it('valida metadatos escalares y su tamaño', () => {
    expect(normalizeRelationMetadata(undefined)).toEqual({});
    expect(
      normalizeRelationMetadata({ rol: 'mentor', peso: 3, activo: true }),
    ).toEqual({ rol: 'mentor', peso: 3, activo: true });
    expect(() =>
      normalizeRelationMetadata({ nested: {} as unknown as string }),
    ).toThrow(RelationInputError);
    expect(() => normalizeRelationMetadata({ ' ': 'x' })).toThrow(
      RelationInputError,
    );
    expect(() =>
      normalizeRelationMetadata({
        datos: 'x'.repeat(RELATION_METADATA_JSON_MAX_LENGTH),
      }),
    ).toThrow(RelationInputError);
  });

  it('normaliza el filtro y acota el límite', () => {
    expect(normalizeRelationFilter(undefined)).toEqual({
      entityId: undefined,
      typeId: undefined,
      limit: RELATION_LIST_LIMIT_DEFAULT,
    });
    expect(normalizeRelationFilter({ limit: 10_000 }).limit).toBe(
      RELATION_LIST_LIMIT_MAX,
    );
    expect(() => normalizeRelationFilter({ limit: 0 })).toThrow(
      RelationInputError,
    );
  });
});
