import { describe, expect, it } from 'vitest';

import {
  assetsImportPayloadSchema,
  assetsListPayloadSchema,
} from '@/main/ipc/schemas/assets';
import {
  entitiesListPayloadSchema,
  entityCreatePayloadSchema,
  entityUpdatePayloadSchema,
  tagCreatePayloadSchema,
} from '@/main/ipc/schemas/entities';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const TYPE_ID = '01900000-0000-7000-8000-000000000002';
const ENTITY_ID = '01900000-0000-7000-8000-000000000003';
const TAG_ID = '01900000-0000-7000-8000-000000000004';

describe('esquemas IPC de fichas, etiquetas y assets', () => {
  it('acepta una lista con filtros válidos y rechaza propiedades extra', () => {
    expect(
      entitiesListPayloadSchema.safeParse({
        worldId: WORLD_ID,
        filter: {
          typeId: TYPE_ID,
          tagId: TAG_ID,
          favorite: true,
          status: 'draft',
          search: 'mara',
          limit: 20,
        },
      }).success,
    ).toBe(true);

    expect(
      entitiesListPayloadSchema.safeParse({
        worldId: WORLD_ID,
        filter: { status: 'inventado' },
      }).success,
    ).toBe(false);
    expect(
      entitiesListPayloadSchema.safeParse({
        worldId: WORLD_ID,
        extra: true,
      }).success,
    ).toBe(false);
    expect(
      entitiesListPayloadSchema.safeParse({ worldId: 'no-es-uuid' }).success,
    ).toBe(false);
  });

  it('valida la creación de una ficha y su descripción', () => {
    const description = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Texto' }],
        },
      ],
    };

    expect(
      entityCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        typeId: TYPE_ID,
        name: 'Mara',
        aliases: ['La Cartógrafa'],
        summary: 'Resumen',
        description,
        attributes: { age: 32, title: 'Capitana' },
        imageAssetId: null,
        galleryAssetIds: [],
        tagIds: [TAG_ID],
        status: 'active',
        isFavorite: true,
      }).success,
    ).toBe(true);

    expect(
      entityCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        typeId: TYPE_ID,
        name: 'Mara',
        description: '<p>HTML</p>',
      }).success,
    ).toBe(false);

    expect(
      entityCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        typeId: TYPE_ID,
        name: 'Mara',
        attributes: { age: Number.NaN },
      }).success,
    ).toBe(false);

    expect(
      entityCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        typeId: TYPE_ID,
        name: 'Mara',
        isFavorite: 'sí',
      }).success,
    ).toBe(false);

    expect(
      entityUpdatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        id: ENTITY_ID,
        name: 'Mara',
        typeId: TYPE_ID,
      }).success,
    ).toBe(false);
  });

  it('valida etiquetas y assets', () => {
    expect(
      tagCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Norte',
        color: 'ochre',
      }).success,
    ).toBe(true);
    expect(
      tagCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        name: 'Norte',
        color: 'verde',
      }).success,
    ).toBe(false);
    expect(
      assetsListPayloadSchema.safeParse({ worldId: WORLD_ID }).success,
    ).toBe(true);
    expect(
      assetsImportPayloadSchema.safeParse({
        worldId: WORLD_ID,
        alt: 'Retrato',
      }).success,
    ).toBe(true);
    expect(
      assetsImportPayloadSchema.safeParse({
        worldId: WORLD_ID,
        path: 'C:\\secreto.png',
      }).success,
    ).toBe(false);
  });
});
