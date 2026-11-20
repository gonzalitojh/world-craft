import { describe, expect, it } from 'vitest';

import { createAssetRepository } from '@/main/assets/store';
import { closeDatabase } from '@/main/db/connection';
import type { WorldCraftDatabase } from '@/main/db/client';
import { initializeDatabase } from '@/main/db/startup';
import {
  createEntitiesService,
  type EntitiesService,
} from '@/main/entities/service';
import { EntityInputError } from '@/main/entities/errors';
import {
  createEntityTypesService,
  type EntityTypesService,
} from '@/main/entity-types/service';
import { createWorldsService, type WorldsService } from '@/main/worlds/service';
import type { EntityRichTextDocument } from '@/shared/contracts/entities';
import type { EntityFieldDefinition } from '@/shared/contracts/entity-types';

import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;

interface Fixture {
  readonly test: TempDatabase;
  readonly database: WorldCraftDatabase;
  readonly worlds: WorldsService;
  readonly entityTypes: EntityTypesService;
  readonly entities: EntitiesService;
  readonly insertAsset: (worldId: string, alt?: string) => string;
  close(): Promise<void>;
}

async function createFixture(): Promise<Fixture> {
  const test = await createTestDatabase();
  const startup = await initializeDatabase({
    userDataDir: test.userDataDir,
    migrationsDir: test.migrationsDir,
  });

  if (startup.status !== 'ready') {
    await test.cleanup();
    throw new Error(`La base de prueba no arrancó: ${startup.code}.`);
  }

  let tick = 0;
  let idCounter = 0;
  const now = (): number => BASE_TIME + (tick += 1) * 1_000;
  const generateId = (): string => {
    idCounter += 1;
    return `01900000-0000-7000-8000-${String(idCounter).padStart(12, '0')}`;
  };

  const entityTypes = createEntityTypesService({
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    now,
    generateId,
  });
  const entities = createEntitiesService({
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    now,
    generateId,
  });
  const worlds = createWorldsService({
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    now,
    generateId,
    onDuplicate: (sourceId, targetId, at) =>
      entityTypes.copyFromWorld(sourceId, targetId, at),
  });
  const assetRepository = createAssetRepository(startup.client.orm);

  return {
    test,
    database: startup.client.orm,
    worlds,
    entityTypes,
    entities,
    insertAsset(worldId, alt = 'Imagen de prueba') {
      const id = generateId();
      assetRepository.insert({
        id,
        worldId,
        kind: 'image',
        relativePath: `worlds/${worldId}/${id}.webp`,
        mime: 'image/webp',
        size: 10,
        width: 640,
        height: 480,
        alt,
        hash: 'a'.repeat(64),
        createdAt: now(),
      });
      return id;
    },
    async close() {
      closeDatabase(startup.client.sqlite);
      await test.cleanup();
    },
  };
}

function description(text: string): EntityRichTextDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

function descriptionWithLink(
  entityId: string,
  text = 'Enlace',
): EntityRichTextDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text,
            marks: [
              {
                type: 'link',
                attrs: { href: `wc-entity://${entityId}` },
              },
            ],
          },
        ],
      },
    ],
  };
}

const requiredFields: readonly EntityFieldDefinition[] = [
  {
    key: 'title',
    label: 'Título',
    type: 'text',
    required: true,
    maxLength: 80,
  },
  {
    key: 'rank',
    label: 'Rango',
    type: 'select',
    required: false,
    options: [
      { value: 'capitan', label: 'Capitán' },
      { value: 'explorador', label: 'Explorador' },
    ],
  },
  {
    key: 'mentor',
    label: 'Mentor',
    type: 'reference',
    required: false,
    targetTypeKey: 'character',
  },
];

describe('servicio de fichas', () => {
  it('crea, consulta y actualiza una ficha con todos sus campos', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const types = fixture.entityTypes.list(world.id);
      const character = types.find((type) => type.key === 'character');
      const city = types.find((type) => type.key === 'city');

      expect(character).toBeDefined();
      expect(city).toBeDefined();

      const tag = fixture.entities.createTag({
        worldId: world.id,
        name: 'Protagonistas',
        color: 'moss',
      });
      const mainImage = fixture.insertAsset(world.id, 'Retrato');
      const galleryImage = fixture.insertAsset(world.id, 'Mapa');

      const created = fixture.entities.create({
        worldId: world.id,
        typeId: character?.id ?? '',
        name: '  Mara   Viento  ',
        aliases: ['La Cartógrafa', 'la cartógrafa'],
        summary: 'Exploradora de las mareas.',
        description: description('Mara dibuja mapas con tinta de sal.'),
        attributes: { age: 32, status: 'alive' },
        imageAssetId: mainImage,
        galleryAssetIds: [galleryImage],
        tagIds: [tag.id],
        status: 'draft',
      });

      expect(created.name).toBe('Mara Viento');
      expect(created.slug).toBe('mara-viento');
      expect(created.aliases).toEqual(['La Cartógrafa']);
      expect(created.description).toEqual(
        description('Mara dibuja mapas con tinta de sal.'),
      );
      expect(created.attributes).toEqual({ age: 32, status: 'alive' });
      expect(created.gallery).toEqual([
        {
          assetId: galleryImage,
          width: 640,
          height: 480,
          alt: 'Mapa',
        },
      ]);
      expect(created.imageAssetId).toBe(mainImage);
      expect(created.tags.map((entry) => entry.name)).toEqual([
        'Protagonistas',
      ]);
      expect(created.status).toBe('draft');

      const listed = fixture.entities.list({ worldId: world.id });

      expect(listed).toHaveLength(1);
      expect(listed[0]?.typeKey).toBe('character');
      expect(listed[0]?.typeName).toBe('Personaje');
      expect(listed[0]?.tags).toHaveLength(1);

      const updated = fixture.entities.update({
        worldId: world.id,
        id: created.id,
        name: 'Mara Viento',
        aliases: [],
        summary: null,
        description: null,
        attributes: { age: 33 },
        imageAssetId: null,
        galleryAssetIds: [],
        tagIds: [],
        status: 'active',
      });

      expect(updated?.summary).toBeNull();
      expect(updated?.description).toBeNull();
      expect(updated?.attributes).toEqual({ age: 33 });
      expect(updated?.gallery).toEqual([]);
      expect(updated?.tags).toEqual([]);

      expect(
        fixture.entities.get({ worldId: world.id, id: created.id }),
      ).toEqual(updated);
    } finally {
      await fixture.close();
    }
  });

  it('valida campos obligatorios, opciones, referencias y descripción', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Crónica de sal' });
      const otherWorld = fixture.worlds.create({ name: 'Otro mundo' });
      const custom = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Héroe',
        icon: 'crown',
        color: 'ochre',
        fields: requiredFields,
      });
      const character = fixture.entityTypes
        .list(world.id)
        .find((type) => type.key === 'character');
      const city = fixture.entityTypes
        .list(world.id)
        .find((type) => type.key === 'city');
      expect(character).toBeDefined();
      expect(city).toBeDefined();
      const cityEntity = fixture.entities.create({
        worldId: world.id,
        typeId: city?.id ?? '',
        name: 'Puerto Sal',
      });
      const otherEntity = fixture.entities.create({
        worldId: otherWorld.id,
        typeId:
          fixture.entityTypes
            .list(otherWorld.id)
            .find((type) => type.key === 'city')?.id ?? '',
        name: 'Ciudad ajena',
      });

      expect(() =>
        fixture.entities.create({
          worldId: world.id,
          typeId: custom.id,
          name: 'Sin título',
        }),
      ).toThrow(EntityInputError);

      expect(() =>
        fixture.entities.create({
          worldId: world.id,
          typeId: custom.id,
          name: 'Rango inválido',
          attributes: { title: 'Alguien', rank: 'rey' },
        }),
      ).toThrow(EntityInputError);

      expect(() =>
        fixture.entities.create({
          worldId: world.id,
          typeId: custom.id,
          name: 'Referencia a otro mundo',
          attributes: { title: 'Alguien', mentor: otherEntity.id },
        }),
      ).toThrow(EntityInputError);

      expect(() =>
        fixture.entities.create({
          worldId: world.id,
          typeId: custom.id,
          name: 'Referencia de otro tipo',
          attributes: { title: 'Alguien', mentor: cityEntity.id },
        }),
      ).toThrow(EntityInputError);

      expect(() =>
        fixture.entities.create({
          worldId: world.id,
          typeId: custom.id,
          name: 'Descripción inválida',
          attributes: { title: 'Alguien' },
          description: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 6 },
                content: [{ type: 'text', text: 'No permitido' }],
              },
            ],
          } as unknown as EntityRichTextDocument,
        }),
      ).toThrow(EntityInputError);

      expect(() =>
        fixture.entities.create({
          worldId: world.id,
          typeId: custom.id,
          name: 'Enlace roto',
          attributes: { title: 'Alguien' },
          description: descriptionWithLink(
            '01900000-0000-7000-8000-000000009999',
          ),
        }),
      ).toThrow(EntityInputError);

      expect(() =>
        fixture.entities.create({
          worldId: world.id,
          typeId: custom.id,
          name: 'Enlace a otro mundo',
          attributes: { title: 'Alguien' },
          description: descriptionWithLink(otherEntity.id),
        }),
      ).toThrow(EntityInputError);

      const linked = fixture.entities.create({
        worldId: world.id,
        typeId: custom.id,
        name: 'Enlace válido',
        attributes: { title: 'Alguien' },
        description: descriptionWithLink(cityEntity.id),
      });

      expect(linked.description).toEqual(descriptionWithLink(cityEntity.id));

      const mentor = fixture.entities.create({
        worldId: world.id,
        typeId: character?.id ?? '',
        name: 'Mentora',
      });

      const valid = fixture.entities.create({
        worldId: world.id,
        typeId: custom.id,
        name: 'Alguien válido',
        attributes: { title: 'Alguien', rank: 'capitan', mentor: mentor.id },
      });

      expect(valid.attributes).toEqual({
        title: 'Alguien',
        rank: 'capitan',
        mentor: mentor.id,
      });

      // Un tipo con fichas no puede perder un campo ni cambiar su tipo, pero
      // sí puede ajustar etiquetas y añadir campos.
      expect(() =>
        fixture.entityTypes.update({
          worldId: world.id,
          id: custom.id,
          name: custom.name,
          icon: custom.icon,
          color: custom.color,
          fields: requiredFields.filter((field) => field.key !== 'rank'),
        }),
      ).toThrow();

      const adjusted = fixture.entityTypes.update({
        worldId: world.id,
        id: custom.id,
        name: custom.name,
        icon: custom.icon,
        color: custom.color,
        fields: requiredFields.map((field) =>
          field.key === 'title' ? { ...field, label: 'Título heroico' } : field,
        ),
      });

      expect(
        adjusted?.fields.find((field) => field.key === 'title')?.label,
      ).toBe('Título heroico');
    } finally {
      await fixture.close();
    }
  });

  it('aísla fichas, tipos, etiquetas y assets por mundo', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Mundo A' });
      const other = fixture.worlds.create({ name: 'Mundo B' });
      const character = fixture.entityTypes
        .list(world.id)
        .find((type) => type.key === 'character');
      const otherType = fixture.entityTypes
        .list(other.id)
        .find((type) => type.key === 'character');
      const customType = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Secreto de A',
        icon: 'shield',
        color: 'danger',
        fields: [],
      });
      const tag = fixture.entities.createTag({
        worldId: world.id,
        name: 'Local',
        color: 'prussian',
      });
      const asset = fixture.insertAsset(world.id);
      const entity = fixture.entities.create({
        worldId: world.id,
        typeId: character?.id ?? '',
        name: 'Mara',
        tagIds: [tag.id],
        imageAssetId: asset,
      });

      expect(fixture.entities.list({ worldId: other.id })).toEqual([]);
      expect(
        fixture.entities.get({ worldId: other.id, id: entity.id }),
      ).toBeNull();

      expect(() =>
        fixture.entities.create({
          worldId: other.id,
          typeId: otherType?.id ?? '',
          name: 'Copia',
          tagIds: [tag.id],
        }),
      ).toThrow(EntityInputError);

      expect(() =>
        fixture.entities.create({
          worldId: other.id,
          typeId: otherType?.id ?? '',
          name: 'Copia',
          imageAssetId: asset,
        }),
      ).toThrow(EntityInputError);

      expect(() =>
        fixture.entities.create({
          worldId: other.id,
          typeId: customType.id,
          name: 'Tipo ajeno',
        }),
      ).toThrow(EntityInputError);

      expect(fixture.entities.listTags(other.id)).toEqual([]);
    } finally {
      await fixture.close();
    }
  });

  it('busca y filtra por tipo, etiqueta, favorito y estado', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Filtros' });
      const types = fixture.entityTypes.list(world.id);
      const character = types.find((type) => type.key === 'character');
      const city = types.find((type) => type.key === 'city');
      const tag = fixture.entities.createTag({
        worldId: world.id,
        name: 'Norte',
        color: 'moss',
      });
      const mara = fixture.entities.create({
        worldId: world.id,
        typeId: character?.id ?? '',
        name: 'Mara Viento',
        aliases: ['Cartógrafa'],
        summary: 'Sal y tinta',
        description: description('Conoce todos los puertos del norte.'),
        tagIds: [tag.id],
        isFavorite: true,
      });
      fixture.entities.create({
        worldId: world.id,
        typeId: city?.id ?? '',
        name: 'Puerto Sal',
        status: 'archived',
      });

      expect(
        fixture.entities
          .list({ worldId: world.id, filter: { search: 'cartógrafa' } })
          .map((entry) => entry.id),
      ).toEqual([mara.id]);
      expect(
        fixture.entities
          .list({ worldId: world.id, filter: { search: 'puertos' } })
          .map((entry) => entry.id),
      ).toEqual([mara.id]);
      expect(
        fixture.entities.list({
          worldId: world.id,
          filter: { typeId: city?.id ?? '' },
        }),
      ).toHaveLength(1);
      expect(
        fixture.entities.list({
          worldId: world.id,
          filter: { tagId: tag.id },
        }),
      ).toHaveLength(1);
      expect(
        fixture.entities.list({
          worldId: world.id,
          filter: { favorite: true },
        }),
      ).toHaveLength(1);
      expect(
        fixture.entities.list({
          worldId: world.id,
          filter: { status: 'archived' },
        }),
      ).toHaveLength(1);

      const unfavorited = fixture.entities.setFavorite({
        worldId: world.id,
        id: mara.id,
        favorite: false,
      });
      expect(unfavorited?.isFavorite).toBe(false);
      expect(
        fixture.entities.list({
          worldId: world.id,
          filter: { favorite: true },
        }),
      ).toEqual([]);
    } finally {
      await fixture.close();
    }
  });

  it('borra de forma lógica, conserva la clave y bloquea tipos con fichas', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Papelera' });
      const custom = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Reliquia',
        icon: 'gem',
        color: 'danger',
        fields: [],
      });
      const entity = fixture.entities.create({
        worldId: world.id,
        typeId: custom.id,
        name: 'Corona',
      });

      expect(() =>
        fixture.entityTypes.remove({ worldId: world.id, id: custom.id }),
      ).toThrow();

      const removed = fixture.entities.remove({
        worldId: world.id,
        id: entity.id,
      });
      expect(removed).toEqual({ deleted: true });
      expect(
        fixture.entities.get({ worldId: world.id, id: entity.id }),
      ).toBeNull();
      expect(fixture.entities.list({ worldId: world.id })).toEqual([]);

      const duplicate = fixture.entities.create({
        worldId: world.id,
        typeId: custom.id,
        name: 'Corona',
      });
      expect(duplicate.slug).toBe('corona-2');

      fixture.entities.remove({ worldId: world.id, id: duplicate.id });

      // Las fichas en papelera siguen contando: una restauración futura debe
      // encontrar su tipo. La purga definitiva llega con #77.
      expect(() =>
        fixture.entityTypes.remove({ worldId: world.id, id: custom.id }),
      ).toThrow();
    } finally {
      await fixture.close();
    }
  });

  it('crea etiquetas de forma idempotente por nombre', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Etiquetas' });
      const first = fixture.entities.createTag({
        worldId: world.id,
        name: '  Mar   Norte ',
        color: 'moss',
      });
      const second = fixture.entities.createTag({
        worldId: world.id,
        name: 'Mar Norte',
        color: 'danger',
      });

      expect(second.id).toBe(first.id);
      expect(second.color).toBe('moss');
      expect(fixture.entities.listTags(world.id)).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });
});
