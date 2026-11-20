import { describe, expect, it } from 'vitest';

import { EntityTypeInputError } from '@/main/entity-types/errors';
import {
  normalizeEditableEntityType,
  normalizeEntityTypeColor,
  normalizeEntityTypeIcon,
  normalizeEntityTypeKey,
  normalizeEntityTypeName,
  slugifyEntityTypeName,
  uniqueEntityTypeKey,
} from '@/main/entity-types/validation';

describe('claves de tipos de entidad', () => {
  it('genera claves sin diacríticos y con guiones simples', () => {
    expect(slugifyEntityTypeName('  Crónica de las Mareas  ')).toBe(
      'cronica-de-las-mareas',
    );
    expect(slugifyEntityTypeName('Flora y fauna')).toBe('flora-y-fauna');
    expect(slugifyEntityTypeName('3 reinos')).toBe('3-reinos');
    expect(normalizeEntityTypeKey('3-reinos')).toBe('3-reinos');
    expect(() => slugifyEntityTypeName('¿?')).toThrow(EntityTypeInputError);
  });

  it('rechaza claves del sistema y claves mal formadas', () => {
    expect(() => normalizeEntityTypeKey('character')).toThrow(
      EntityTypeInputError,
    );
    expect(() => normalizeEntityTypeKey('Con Mayúsculas')).toThrow(
      EntityTypeInputError,
    );
    expect(normalizeEntityTypeKey('  faccion-local  ')).toBe('faccion-local');
  });

  it('evita claves ocupadas y las del sistema', () => {
    const taken = new Set(['faccion', 'faccion-2']);

    expect(uniqueEntityTypeKey('faccion', (key) => taken.has(key))).toBe(
      'faccion-3',
    );
    expect(uniqueEntityTypeKey('place', () => false)).toBe('place-2');
  });

  it('normaliza el nombre, el icono, el color y la plantilla', () => {
    expect(normalizeEntityTypeName('  Orden   del Alba ')).toBe(
      'Orden del Alba',
    );
    expect(normalizeEntityTypeIcon('crown')).toBe('crown');
    expect(normalizeEntityTypeColor('moss')).toBe('moss');

    expect(() => normalizeEntityTypeIcon('icono-inventado')).toThrow(
      EntityTypeInputError,
    );
    expect(() => normalizeEntityTypeColor('#ff0000')).toThrow(
      EntityTypeInputError,
    );

    expect(
      normalizeEditableEntityType({
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields: [
          {
            key: 'leader',
            label: 'Líder',
            type: 'text',
            required: true,
            maxLength: 80,
          },
        ],
      }),
    ).toMatchObject({
      name: 'Orden del Alba',
      icon: 'crown',
      color: 'ochre',
      fields: [{ key: 'leader', label: 'Líder', type: 'text' }],
    });

    expect(() =>
      normalizeEditableEntityType({
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields: [
          {
            key: 'leader',
            label: 'Líder',
            type: 'text',
            required: true,
          },
          {
            key: 'leader',
            label: 'Repetido',
            type: 'date',
            required: false,
          },
        ],
      }),
    ).toThrow(EntityTypeInputError);
  });
});
