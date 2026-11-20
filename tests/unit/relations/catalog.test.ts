import { describe, expect, it } from 'vitest';

import {
  isSystemRelationTypeKey,
  SYSTEM_RELATION_TYPES,
  systemRelationTypeOrder,
} from '@/shared/relations/catalog';

describe('catálogo de tipos de relación del sistema', () => {
  it('tiene 18 tipos con identificadores, claves y etiquetas únicos', () => {
    expect(SYSTEM_RELATION_TYPES).toHaveLength(18);
    expect(new Set(SYSTEM_RELATION_TYPES.map((type) => type.id)).size).toBe(18);
    expect(new Set(SYSTEM_RELATION_TYPES.map((type) => type.key)).size).toBe(
      18,
    );
    expect(
      SYSTEM_RELATION_TYPES.every(
        (type) =>
          type.name.trim().length > 0 && type.inverseName.trim().length > 0,
      ),
    ).toBe(true);
    expect(
      SYSTEM_RELATION_TYPES.every((type) =>
        /^018f0000-0000-7000-8000-0000000001\d{2}$/.test(type.id),
      ),
    ).toBe(true);
  });

  it('ordena por catálogo y detecta las claves del sistema', () => {
    expect(systemRelationTypeOrder('related-to')).toBe(0);
    expect(systemRelationTypeOrder('ally-of')).toBe(1);
    expect(systemRelationTypeOrder('no-existe')).toBe(-1);
    expect(isSystemRelationTypeKey('parent-of')).toBe(true);
    expect(isSystemRelationTypeKey('mentor-of')).toBe(false);
  });

  it('marca como simétricos los tipos con etiqueta directa e inversa iguales', () => {
    const symmetric = SYSTEM_RELATION_TYPES.filter(
      (type) => type.name === type.inverseName,
    ).map((type) => type.key);

    expect(symmetric).toEqual(['related-to', 'sibling-of', 'spouse-of']);
  });
});
