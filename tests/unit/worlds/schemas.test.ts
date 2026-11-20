import { describe, expect, it } from 'vitest';

import {
  worldCreatePayloadSchema,
  worldGetPayloadSchema,
  worldListActivityPayloadSchema,
  worldUpdatePayloadSchema,
} from '@/main/ipc/schemas/worlds';

const ID = '01900000-0000-7000-8000-000000000001';

describe('esquemas IPC de mundos', () => {
  it('acepta una entrada válida y rechaza propiedades extra', () => {
    expect(
      worldCreatePayloadSchema.safeParse({
        name: 'Las Mareas Grises',
        summary: 'Resumen',
        genres: ['Fantasía'],
        language: 'es',
      }).success,
    ).toBe(true);

    expect(
      worldCreatePayloadSchema.safeParse({
        name: 'Las Mareas Grises',
        extra: 'no debe pasar',
      }).success,
    ).toBe(false);

    expect(
      worldUpdatePayloadSchema.safeParse({
        id: ID,
        name: 'Nombre',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('rechaza IDs que no son UUIDv7', () => {
    expect(worldGetPayloadSchema.safeParse({ id: 'no-es-un-id' }).success).toBe(
      false,
    );
    expect(worldGetPayloadSchema.safeParse({ id: ID }).success).toBe(true);
  });

  it('limita el idioma, los géneros y la longitud de la actividad', () => {
    expect(
      worldCreatePayloadSchema.safeParse({ name: 'X', language: 'fr' }).success,
    ).toBe(false);
    expect(
      worldCreatePayloadSchema.safeParse({
        name: 'X',
        genres: Array.from({ length: 9 }, (_, index) => `g${index}`),
      }).success,
    ).toBe(false);
    expect(
      worldCreatePayloadSchema.safeParse({
        name: 'X',
        summary: 'a'.repeat(281),
      }).success,
    ).toBe(false);
    expect(
      worldListActivityPayloadSchema.safeParse({ limit: 51 }).success,
    ).toBe(false);
    expect(
      worldListActivityPayloadSchema.safeParse({ limit: 50 }).success,
    ).toBe(true);
  });
});
