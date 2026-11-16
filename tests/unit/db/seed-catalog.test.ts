import { describe, expect, it } from 'vitest';

import {
  parseSystemCatalog,
  SYSTEM_ENTITY_ICONS,
  SYSTEM_ENTITY_TYPE_COUNT,
  SYSTEM_RELATION_TYPE_COUNT,
  systemCatalog,
} from '@/lib/db/seed/catalog';

const ENTITY_KEYS = [
  'character',
  'location',
  'faction',
  'organization',
  'item',
  'creature',
  'event',
  'concept',
  'culture',
  'language',
  'deity',
  'era',
];

const RELATION_KEYS = [
  'family',
  'friendship',
  'rivalry',
  'enmity',
  'alliance',
  'mentorship',
  'membership',
  'leadership',
  'location',
  'ownership',
  'creation',
  'participation',
  'subordination',
  'worship',
  'language',
];

/** Copia profunda para probar catálogos inválidos sin mutar el real. */
function cloneCatalog(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(systemCatalog)) as Record<string, unknown>;
}

function entityTypesOf(
  catalog: Record<string, unknown>,
): Record<string, unknown>[] {
  return catalog.entityTypes as Record<string, unknown>[];
}

describe('catálogo del sistema', () => {
  it('valida el catálogo versionado', () => {
    expect(() => parseSystemCatalog(systemCatalog)).not.toThrow();
  });

  it('tiene 12 tipos de entidad y 15 de relación', () => {
    expect(systemCatalog.entityTypes).toHaveLength(SYSTEM_ENTITY_TYPE_COUNT);
    expect(systemCatalog.relationTypes).toHaveLength(
      SYSTEM_RELATION_TYPE_COUNT,
    );
  });

  it('usa las claves aprobadas en el plan', () => {
    expect(systemCatalog.entityTypes.map((type) => type.key)).toEqual(
      ENTITY_KEYS,
    );
    expect(systemCatalog.relationTypes.map((type) => type.key)).toEqual(
      RELATION_KEYS,
    );
  });

  it('todos los tipos son del sistema y no pertenecen a un mundo', () => {
    for (const type of [
      ...systemCatalog.entityTypes,
      ...systemCatalog.relationTypes,
    ]) {
      expect(type.worldId).toBeNull();
      expect(type.isSystem).toBe(true);
      expect(type.color).toBeNull();
    }
  });

  it('los ids son únicos y deterministas por familia', () => {
    const entityIds = systemCatalog.entityTypes.map((type) => type.id);
    const relationIds = systemCatalog.relationTypes.map((type) => type.id);

    expect(new Set(entityIds).size).toBe(entityIds.length);
    expect(new Set(relationIds).size).toBe(relationIds.length);

    for (const id of entityIds) {
      expect(id.startsWith('a0000000-')).toBe(true);
    }

    for (const id of relationIds) {
      expect(id.startsWith('b0000000-')).toBe(true);
    }
  });

  it('usa iconos Lucide de la lista permitida', () => {
    for (const type of systemCatalog.entityTypes) {
      expect(SYSTEM_ENTITY_ICONS).toContain(type.icon);
    }
  });

  it('no contiene correos ni datos de usuario', () => {
    const serialized = JSON.stringify(systemCatalog);

    expect(serialized).not.toContain('@');
  });

  it('los tipos de relación tienen nombre inverso', () => {
    for (const type of systemCatalog.relationTypes) {
      expect(type.inverseName.trim().length).toBeGreaterThan(0);
    }
  });

  it('rechaza un catálogo con un tipo de menos', () => {
    const catalog = cloneCatalog();
    entityTypesOf(catalog).pop();

    expect(() => parseSystemCatalog(catalog)).toThrow();
  });

  it('rechaza claves de entidad repetidas', () => {
    const catalog = cloneCatalog();
    const types = entityTypesOf(catalog);
    types[1]!.key = types[0]!.key;

    expect(() => parseSystemCatalog(catalog)).toThrow(/únicas/);
  });

  it('rechaza claves de relación repetidas', () => {
    const catalog = cloneCatalog();
    const types = catalog.relationTypes as Record<string, unknown>[];
    types[2]!.key = types[1]!.key;

    expect(() => parseSystemCatalog(catalog)).toThrow(/únicas/);
  });

  it('rechaza ids repetidos', () => {
    const catalog = cloneCatalog();
    const types = entityTypesOf(catalog);
    types[3]!.id = types[0]!.id;

    expect(() => parseSystemCatalog(catalog)).toThrow(/únicos/);
  });

  it('rechaza un tipo con mundo asignado', () => {
    const catalog = cloneCatalog();
    entityTypesOf(catalog)[0]!.worldId = '11111111-1111-4111-8111-111111111111';

    expect(() => parseSystemCatalog(catalog)).toThrow();
  });

  it('rechaza un tipo que no sea del sistema', () => {
    const catalog = cloneCatalog();
    entityTypesOf(catalog)[0]!.isSystem = false;

    expect(() => parseSystemCatalog(catalog)).toThrow();
  });

  it('rechaza un color hexadecimal', () => {
    const catalog = cloneCatalog();
    entityTypesOf(catalog)[0]!.color = '#ff0000';

    expect(() => parseSystemCatalog(catalog)).toThrow();
  });

  it('rechaza un icono desconocido', () => {
    const catalog = cloneCatalog();
    entityTypesOf(catalog)[0]!.icon = 'not-a-lucide-icon';

    expect(() => parseSystemCatalog(catalog)).toThrow();
  });

  it('rechaza campos personalizados en un tipo del sistema', () => {
    const catalog = cloneCatalog();
    entityTypesOf(catalog)[0]!.fields = [{ key: 'age', type: 'number' }];

    expect(() => parseSystemCatalog(catalog)).toThrow();
  });

  it('rechaza un nombre con correo', () => {
    const catalog = cloneCatalog();
    entityTypesOf(catalog)[0]!.name = 'Personaje <alguien@example.invalid>';

    expect(() => parseSystemCatalog(catalog)).toThrow(/@/);
  });

  it('rechaza propiedades desconocidas', () => {
    const catalog = cloneCatalog();
    entityTypesOf(catalog)[0]!.unexpected = true;

    expect(() => parseSystemCatalog(catalog)).toThrow();
  });

  it('rechaza una versión distinta', () => {
    const catalog = cloneCatalog();
    catalog.version = 2;

    expect(() => parseSystemCatalog(catalog)).toThrow();
  });
});
