import { describe, expect, it } from 'vitest';

import { isUuidV7 } from '@/main/db/ids';
import {
  isEntityTypeColor,
  isEntityTypeIcon,
} from '@/shared/contracts/entity-types';
import {
  isSystemEntityTypeKey,
  SYSTEM_ENTITY_TYPES,
  SYSTEM_ENTITY_TYPE_KEYS,
} from '@/shared/entity-types/catalog';
import { entityFieldTemplateSchema } from '@/shared/entity-types/fields';

const EXPECTED_KEYS = [
  'character',
  'place',
  'city',
  'nation',
  'culture',
  'race',
  'organization',
  'religion',
  'deity',
  'magic',
  'item',
  'creature',
  'language',
  'event',
  'conflict',
  'technology',
  'flora-fauna',
  'concept',
] as const;

describe('catálogo de tipos del sistema', () => {
  it('define los 18 tipos en el orden del catálogo', () => {
    expect(SYSTEM_ENTITY_TYPES).toHaveLength(18);
    expect(SYSTEM_ENTITY_TYPES.map((type) => type.key)).toEqual(EXPECTED_KEYS);
    expect(SYSTEM_ENTITY_TYPE_KEYS).toEqual(EXPECTED_KEYS);
  });

  it('usa identificadores únicos y claves reservadas', () => {
    expect(new Set(SYSTEM_ENTITY_TYPES.map((type) => type.id)).size).toBe(18);
    expect(new Set(SYSTEM_ENTITY_TYPES.map((type) => type.key)).size).toBe(18);

    for (const type of SYSTEM_ENTITY_TYPES) {
      expect(isUuidV7(type.id)).toBe(true);
      expect(type.name.trim().length).toBeGreaterThan(0);
      expect(isEntityTypeIcon(type.icon)).toBe(true);
      expect(isEntityTypeColor(type.color)).toBe(true);
      expect(isSystemEntityTypeKey(type.key)).toBe(true);
    }
  });

  it('valida todas las plantillas con el esquema compartido', () => {
    for (const type of SYSTEM_ENTITY_TYPES) {
      const parsed = entityFieldTemplateSchema.safeParse(type.fields);

      expect(
        parsed.success,
        `${type.key}: ${parsed.error?.message ?? ''}`,
      ).toBe(true);
      expect(type.fields.length).toBeGreaterThan(0);
    }
  });

  it('no reserva claves ajenas', () => {
    expect(isSystemEntityTypeKey('custom-type')).toBe(false);
    expect(isSystemEntityTypeKey(42)).toBe(false);
  });
});
