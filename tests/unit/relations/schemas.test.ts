import { describe, expect, it } from 'vitest';

import {
  relationCreatePayloadSchema,
  relationRemovePayloadSchema,
  relationTypeCreatePayloadSchema,
  relationTypeUpdatePayloadSchema,
  relationUpdatePayloadSchema,
  relationsListPayloadSchema,
} from '@/main/ipc/schemas/relations';
import {
  isRelationDeleteResult,
  isRelationEdge,
  isRelationEdgeList,
  isRelationMetadata,
  isRelationType,
  isRelationTypeDeleteResult,
  isRelationTypeList,
  isRelationEntityRef,
} from '@/shared/contracts/relations';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ID = '01900000-0000-7000-8000-000000000002';
const OTHER_ID = '01900000-0000-7000-8000-000000000003';
const TYPE_ID = '01900000-0000-7000-8000-000000000004';

describe('esquemas IPC de relaciones', () => {
  it('acepta una creación mínima y rechaza campos extra', () => {
    expect(
      relationCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        sourceId: ID,
        targetId: OTHER_ID,
        typeId: TYPE_ID,
      }).success,
    ).toBe(true);
    expect(
      relationCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        sourceId: ID,
        targetId: OTHER_ID,
        typeId: TYPE_ID,
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('valida fuerza, etiquetas y metadatos', () => {
    const base = {
      worldId: WORLD_ID,
      sourceId: ID,
      targetId: OTHER_ID,
      typeId: TYPE_ID,
    };

    expect(
      relationCreatePayloadSchema.safeParse({ ...base, strength: 6 }).success,
    ).toBe(false);
    expect(
      relationCreatePayloadSchema.safeParse({
        ...base,
        label: 'x'.repeat(81),
      }).success,
    ).toBe(false);
    expect(
      relationCreatePayloadSchema.safeParse({
        ...base,
        metadata: { rol: 'aliado', peso: 2, activo: true },
      }).success,
    ).toBe(true);
    expect(
      relationCreatePayloadSchema.safeParse({
        ...base,
        metadata: { nested: { value: 1 } },
      }).success,
    ).toBe(false);
  });

  it('exige el reemplazo completo al actualizar', () => {
    const complete = {
      worldId: WORLD_ID,
      id: ID,
      typeId: TYPE_ID,
      label: null,
      inverseLabel: null,
      notes: null,
      strength: 3,
      metadata: {},
    };

    expect(relationUpdatePayloadSchema.safeParse(complete).success).toBe(true);
    expect(
      relationUpdatePayloadSchema.safeParse({
        ...complete,
        metadata: undefined,
      }).success,
    ).toBe(false);
  });

  it('valida el filtro y los identificadores UUIDv7', () => {
    expect(
      relationsListPayloadSchema.safeParse({
        worldId: WORLD_ID,
        filter: { entityId: ID, typeId: TYPE_ID, limit: 50 },
      }).success,
    ).toBe(true);
    expect(
      relationsListPayloadSchema.safeParse({
        worldId: WORLD_ID,
        filter: { limit: 0 },
      }).success,
    ).toBe(false);
    expect(
      relationsListPayloadSchema.safeParse({
        worldId: 'no-es-uuid',
      }).success,
    ).toBe(false);
    expect(
      relationRemovePayloadSchema.safeParse({ worldId: WORLD_ID, id: ID })
        .success,
    ).toBe(true);
  });
});

describe('esquemas IPC de tipos de relación', () => {
  it('acepta la creación y exige clave válida cuando se escribe', () => {
    expect(
      relationTypeCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Aliado de',
        inverseName: 'Tiene como aliado a',
        color: 'moss',
      }).success,
    ).toBe(true);
    expect(
      relationTypeCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Aliado de',
        inverseName: 'Tiene como aliado a',
        key: 'Aliado De',
        color: 'moss',
      }).success,
    ).toBe(false);
    expect(
      relationTypeCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Aliado de',
        inverseName: 'Tiene como aliado a',
        color: 'azul',
      }).success,
    ).toBe(false);
  });

  it('la actualización no admite clave ni mundo nulo', () => {
    expect(
      relationTypeUpdatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        id: ID,
        name: 'Aliado de',
        inverseName: 'Tiene como aliado a',
        color: 'danger',
        key: 'aliado-de',
      }).success,
    ).toBe(false);
  });
});

describe('guardas del contrato de relaciones', () => {
  const ref = {
    id: ID,
    name: 'Mara',
    typeKey: 'character',
    typeName: 'Personaje',
    typeIcon: 'user-round',
    typeColor: 'moss',
  } as const;
  const type = {
    id: TYPE_ID,
    worldId: null,
    key: 'ally-of',
    name: 'Aliado de',
    inverseName: 'Tiene como aliado a',
    color: 'moss',
    isSystem: true,
    createdAt: 1,
    updatedAt: 1,
  } as const;
  const edge = {
    id: ID,
    worldId: WORLD_ID,
    typeId: TYPE_ID,
    typeKey: 'ally-of',
    typeName: 'Aliado de',
    typeInverseName: 'Tiene como aliado a',
    typeColor: 'moss',
    isSystemType: true,
    label: null,
    inverseLabel: null,
    notes: null,
    strength: 3,
    metadata: { rol: 'aliado' },
    source: ref,
    target: { ...ref, id: OTHER_ID, name: 'Puerto Sal' },
    createdAt: 1,
    updatedAt: 1,
  } as const;

  it('reconoce tipos, aristas, referencias y resultados', () => {
    expect(isRelationType(type)).toBe(true);
    expect(isRelationTypeList([type])).toBe(true);
    expect(isRelationEntityRef(ref)).toBe(true);
    expect(isRelationEdge(edge)).toBe(true);
    expect(isRelationEdgeList([edge])).toBe(true);
    expect(isRelationTypeDeleteResult({ deleted: true })).toBe(true);
    expect(isRelationDeleteResult({ deleted: false })).toBe(true);
  });

  it('rechaza aristas manipuladas', () => {
    expect(isRelationEdge({ ...edge, strength: 9 })).toBe(false);
    expect(isRelationEdge({ ...edge, strength: 2.5 })).toBe(false);
    expect(isRelationEdge({ ...edge, metadata: { nested: {} } })).toBe(false);
    expect(isRelationEdge({ ...edge, source: null })).toBe(false);
    expect(isRelationMetadata({ ok: true })).toBe(true);
    expect(isRelationMetadata([1, 2])).toBe(false);
  });
});
