import { describe, expect, it } from 'vitest';

import {
  entityTypeCreatePayloadSchema,
  entityTypeDuplicatePayloadSchema,
  entityTypeRemovePayloadSchema,
  entityTypeUpdatePayloadSchema,
  entityTypesListPayloadSchema,
} from '@/main/ipc/schemas/entity-types';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const TYPE_ID = '01900000-0000-7000-8000-000000000002';

const fields = [
  {
    key: 'leader',
    label: 'Líder',
    type: 'text',
    required: true,
    maxLength: 80,
  },
];

describe('esquemas IPC de tipos de entidad', () => {
  it('acepta un alta válida y rechaza propiedades extra', () => {
    expect(
      entityTypeCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields,
      }).success,
    ).toBe(true);

    expect(
      entityTypeCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields,
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('rechaza IDs que no son UUIDv7 y claves reservadas mal formadas', () => {
    expect(
      entityTypesListPayloadSchema.safeParse({ worldId: 'x' }).success,
    ).toBe(false);
    expect(
      entityTypesListPayloadSchema.safeParse({ worldId: WORLD_ID }).success,
    ).toBe(true);

    expect(
      entityTypeCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Orden',
        key: 'Con Espacios',
        icon: 'crown',
        color: 'ochre',
        fields,
      }).success,
    ).toBe(false);
  });

  it('limita iconos, colores y la plantilla', () => {
    expect(
      entityTypeCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Orden',
        icon: 'icono-inventado',
        color: 'ochre',
        fields,
      }).success,
    ).toBe(false);

    expect(
      entityTypeCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Orden',
        icon: 'crown',
        color: '#ff0000',
        fields,
      }).success,
    ).toBe(false);

    expect(
      entityTypeUpdatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        id: TYPE_ID,
        name: 'Orden',
        icon: 'crown',
        color: 'ochre',
        fields: [
          { key: 'leader', label: 'Líder', type: 'text', required: false },
          { key: 'leader', label: 'Otro', type: 'date', required: false },
        ],
      }).success,
    ).toBe(false);
  });

  it('valida duplicar y borrar', () => {
    expect(
      entityTypeDuplicatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        id: TYPE_ID,
        name: 'Copia',
      }).success,
    ).toBe(true);

    expect(
      entityTypeRemovePayloadSchema.safeParse({
        worldId: WORLD_ID,
        id: 'no-es-id',
      }).success,
    ).toBe(false);
  });
});
