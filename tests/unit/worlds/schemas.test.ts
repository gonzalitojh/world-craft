import { describe, expect, it } from 'vitest';

import {
  worldCreatePayloadSchema,
  worldGetPayloadSchema,
  worldListActivityPayloadSchema,
  worldSetCoverPayloadSchema,
  worldUpdatePayloadSchema,
} from '@/main/ipc/schemas/worlds';

const ID = '01900000-0000-7000-8000-000000000001';
const ASSET_ID = '01900000-0000-7000-8000-000000000002';

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

  it('acepta la portada en la actualización pero no en la creación', () => {
    expect(
      worldUpdatePayloadSchema.safeParse({
        id: ID,
        name: 'Nombre',
        coverAssetId: ASSET_ID,
      }).success,
    ).toBe(true);
    expect(
      worldUpdatePayloadSchema.safeParse({
        id: ID,
        name: 'Nombre',
        coverAssetId: null,
      }).success,
    ).toBe(true);
    expect(
      worldUpdatePayloadSchema.safeParse({
        id: ID,
        name: 'Nombre',
        coverAssetId: 'no-es-uuid',
      }).success,
    ).toBe(false);
    expect(
      worldCreatePayloadSchema.safeParse({
        name: 'Nombre',
        coverAssetId: ASSET_ID,
      }).success,
    ).toBe(false);
  });

  it('valida el canal de portada con UUID o null y rechaza extras', () => {
    expect(
      worldSetCoverPayloadSchema.safeParse({
        worldId: ID,
        assetId: ASSET_ID,
      }).success,
    ).toBe(true);
    expect(
      worldSetCoverPayloadSchema.safeParse({ worldId: ID, assetId: null })
        .success,
    ).toBe(true);
    expect(
      worldSetCoverPayloadSchema.safeParse({
        worldId: ID,
        assetId: 'no-es-uuid',
      }).success,
    ).toBe(false);
    expect(
      worldSetCoverPayloadSchema.safeParse({
        worldId: ID,
        assetId: null,
        extra: true,
      }).success,
    ).toBe(false);
    expect(
      worldSetCoverPayloadSchema.safeParse({ assetId: null }).success,
    ).toBe(false);
  });
});
