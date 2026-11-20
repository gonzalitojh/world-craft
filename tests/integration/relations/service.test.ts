import { describe, expect, it } from 'vitest';

import { closeDatabase, type SqliteDatabase } from '@/main/db/connection';
import type { WorldCraftDatabase } from '@/main/db/client';
import { initializeDatabase } from '@/main/db/startup';
import {
  createEntitiesService,
  type EntitiesService,
} from '@/main/entities/service';
import {
  createEntityTypesService,
  type EntityTypesService,
} from '@/main/entity-types/service';
import {
  RelationInputError,
  RelationTypeProtectedError,
} from '@/main/relations/errors';
import {
  createRelationsService,
  type RelationsService,
} from '@/main/relations/service';
import { createWorldsService, type WorldsService } from '@/main/worlds/service';
import {
  relationBackwardLabel,
  relationForwardLabel,
} from '@/shared/contracts/relations';
import { SYSTEM_RELATION_TYPES } from '@/shared/relations/catalog';

import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;

interface Fixture {
  readonly test: TempDatabase;
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly worlds: WorldsService;
  readonly entityTypes: EntityTypesService;
  readonly entities: EntitiesService;
  readonly relations: RelationsService;
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
  const relations = createRelationsService({
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

  return {
    test,
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    worlds,
    entityTypes,
    entities,
    relations,
    async close() {
      closeDatabase(startup.client.sqlite);
      await test.cleanup();
    },
  };
}

function createEntities(
  fixture: Fixture,
  worldId: string,
): { readonly mara: string; readonly puerto: string } {
  const types = fixture.entityTypes.list(worldId);
  const character = types.find((type) => type.key === 'character');
  const city = types.find((type) => type.key === 'city');

  const mara = fixture.entities.create({
    worldId,
    typeId: character?.id ?? '',
    name: 'Mara Viento',
  });
  const puerto = fixture.entities.create({
    worldId,
    typeId: city?.id ?? '',
    name: 'Puerto Sal',
  });

  return { mara: mara.id, puerto: puerto.id };
}

describe('servicio de relaciones', () => {
  it('crea aristas, resuelve etiquetas y devuelve backlinks por ficha', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const { mara, puerto } = createEntities(fixture, world.id);
      const types = fixture.relations.listTypes(world.id);
      const locatedIn = types.find((type) => type.key === 'located-in');

      expect(types).toHaveLength(18);
      expect(locatedIn).toBeDefined();

      const edge = fixture.relations.create({
        worldId: world.id,
        sourceId: mara,
        targetId: puerto,
        typeId: locatedIn?.id ?? '',
        notes: '  Vive aquí desde niña.  ',
        strength: 4,
        metadata: { desde: 12 },
      });

      expect(edge.label).toBeNull();
      expect(edge.inverseLabel).toBeNull();
      expect(edge.notes).toBe('Vive aquí desde niña.');
      expect(edge.strength).toBe(4);
      expect(edge.metadata).toEqual({ desde: 12 });
      expect(relationForwardLabel(edge)).toBe('Ubicado en');
      expect(relationBackwardLabel(edge)).toBe('Contiene');
      expect(edge.source.name).toBe('Mara Viento');
      expect(edge.target.name).toBe('Puerto Sal');
      expect(edge.typeName).toBe('Ubicado en');

      const fromTarget = fixture.relations.list({
        worldId: world.id,
        filter: { entityId: puerto },
      });
      const fromSource = fixture.relations.list({
        worldId: world.id,
        filter: { entityId: mara },
      });

      expect(fromTarget).toHaveLength(1);
      expect(fromSource).toHaveLength(1);
      expect(relationBackwardLabel(fromTarget[0]!)).toBe('Contiene');
      expect(fromTarget[0]?.target.id).toBe(puerto);

      const updated = fixture.relations.update({
        worldId: world.id,
        id: edge.id,
        typeId: locatedIn?.id ?? '',
        label: 'Reside en',
        inverseLabel: 'Acoge a',
        notes: null,
        strength: 5,
        metadata: {},
      });

      expect(updated?.label).toBe('Reside en');
      expect(updated?.inverseLabel).toBe('Acoge a');
      expect(updated?.strength).toBe(5);
      expect(updated?.notes).toBeNull();

      expect(
        fixture.relations.remove({ worldId: world.id, id: edge.id }).deleted,
      ).toBe(true);
      expect(
        fixture.relations.list({
          worldId: world.id,
          filter: { entityId: mara },
        }),
      ).toEqual([]);
    } finally {
      await fixture.close();
    }
  });

  it('rechaza duplicados, simétricos invertidos y autorreferencias', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Crónica de sal' });
      const { mara, puerto } = createEntities(fixture, world.id);
      const types = fixture.relations.listTypes(world.id);
      const ally = types.find((type) => type.key === 'ally-of');
      const related = types.find((type) => type.key === 'related-to');

      fixture.relations.create({
        worldId: world.id,
        sourceId: mara,
        targetId: puerto,
        typeId: ally?.id ?? '',
      });

      expect(() =>
        fixture.relations.create({
          worldId: world.id,
          sourceId: mara,
          targetId: puerto,
          typeId: ally?.id ?? '',
        }),
      ).toThrow(RelationInputError);

      expect(() =>
        fixture.relations.create({
          worldId: world.id,
          sourceId: mara,
          targetId: mara,
          typeId: ally?.id ?? '',
        }),
      ).toThrow(RelationInputError);

      fixture.relations.create({
        worldId: world.id,
        sourceId: mara,
        targetId: puerto,
        typeId: related?.id ?? '',
      });

      expect(() =>
        fixture.relations.create({
          worldId: world.id,
          sourceId: puerto,
          targetId: mara,
          typeId: related?.id ?? '',
        }),
      ).toThrow(RelationInputError);
    } finally {
      await fixture.close();
    }
  });

  it('aísla el origen, el destino y el tipo por mundo', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Mundo A' });
      const other = fixture.worlds.create({ name: 'Mundo B' });
      const local = createEntities(fixture, world.id);
      const foreign = createEntities(fixture, other.id);
      const localType = fixture.relations
        .listTypes(world.id)
        .find((type) => type.key === 'ally-of');
      const custom = fixture.relations.createType({
        worldId: world.id,
        name: 'Mentor de',
        inverseName: 'Aprendiz de',
        color: 'ochre',
      });

      expect(() =>
        fixture.relations.create({
          worldId: world.id,
          sourceId: local.mara,
          targetId: foreign.puerto,
          typeId: localType?.id ?? '',
        }),
      ).toThrow(RelationInputError);

      expect(() =>
        fixture.relations.create({
          worldId: other.id,
          sourceId: foreign.mara,
          targetId: foreign.puerto,
          typeId: custom.id,
        }),
      ).toThrow(RelationInputError);

      expect(fixture.relations.list({ worldId: other.id })).toEqual([]);
      expect(fixture.relations.listTypes(other.id)).toHaveLength(18);
    } finally {
      await fixture.close();
    }
  });

  it('oculta las aristas con fichas en la papelera y no deja crearlas', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Papelera' });
      const { mara, puerto } = createEntities(fixture, world.id);
      const ally = fixture.relations
        .listTypes(world.id)
        .find((type) => type.key === 'ally-of');

      fixture.relations.create({
        worldId: world.id,
        sourceId: mara,
        targetId: puerto,
        typeId: ally?.id ?? '',
      });
      fixture.entities.remove({ worldId: world.id, id: puerto });

      expect(
        fixture.relations.list({
          worldId: world.id,
          filter: { entityId: mara },
        }),
      ).toEqual([]);

      expect(() =>
        fixture.relations.create({
          worldId: world.id,
          sourceId: mara,
          targetId: puerto,
          typeId: ally?.id ?? '',
        }),
      ).toThrow(RelationInputError);
    } finally {
      await fixture.close();
    }
  });

  it('gestiona tipos personalizados y protege los del sistema', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Tipos propios' });
      const { mara, puerto } = createEntities(fixture, world.id);
      const custom = fixture.relations.createType({
        worldId: world.id,
        name: '  Mentor   de ',
        inverseName: ' Aprendiz de ',
        color: 'ochre',
      });

      expect(custom.key).toBe('mentor-de');
      expect(custom.isSystem).toBe(false);
      expect(fixture.relations.listTypes(world.id)).toHaveLength(19);

      const updated = fixture.relations.updateType({
        worldId: world.id,
        id: custom.id,
        name: 'Guía de',
        inverseName: 'Guiado por',
        color: 'prussian',
      });

      expect(updated?.name).toBe('Guía de');
      expect(updated?.color).toBe('prussian');

      const edge = fixture.relations.create({
        worldId: world.id,
        sourceId: mara,
        targetId: puerto,
        typeId: custom.id,
      });

      expect(edge.typeName).toBe('Guía de');
      expect(edge.typeInverseName).toBe('Guiado por');

      expect(() =>
        fixture.relations.removeType({ worldId: world.id, id: custom.id }),
      ).toThrow(RelationInputError);

      fixture.relations.remove({ worldId: world.id, id: edge.id });

      expect(
        fixture.relations.removeType({ worldId: world.id, id: custom.id }),
      ).toEqual({ deleted: true });

      const system = fixture.relations
        .listTypes(world.id)
        .find((type) => type.isSystem);

      expect(system).toBeDefined();
      expect(() =>
        fixture.relations.updateType({
          worldId: world.id,
          id: system?.id ?? '',
          name: 'Otro',
          inverseName: 'Otra',
          color: 'moss',
        }),
      ).toThrow(RelationTypeProtectedError);
      expect(() =>
        fixture.relations.removeType({
          worldId: world.id,
          id: system?.id ?? '',
        }),
      ).toThrow(RelationTypeProtectedError);
    } finally {
      await fixture.close();
    }
  });

  it('conserva las relaciones al cerrar y reabrir la base', async () => {
    const fixture = await createFixture();
    let reopened: Awaited<ReturnType<typeof initializeDatabase>> | null = null;

    try {
      const world = fixture.worlds.create({ name: 'Persistencia' });
      const { mara, puerto } = createEntities(fixture, world.id);
      const ally = fixture.relations
        .listTypes(world.id)
        .find((type) => type.key === 'ally-of');
      const created = fixture.relations.create({
        worldId: world.id,
        sourceId: mara,
        targetId: puerto,
        typeId: ally?.id ?? '',
        notes: 'Sigue aquí tras reabrir.',
        strength: 5,
      });

      closeDatabase(fixture.sqlite);

      reopened = await initializeDatabase({
        userDataDir: fixture.test.userDataDir,
        migrationsDir: fixture.test.migrationsDir,
      });

      if (reopened.status !== 'ready') {
        throw new Error(`La base reabierta no arrancó: ${reopened.code}.`);
      }

      const relations = createRelationsService({
        database: reopened.client.orm,
        sqlite: reopened.client.sqlite,
      });
      const list = relations.list({
        worldId: world.id,
        filter: { entityId: puerto },
      });

      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: created.id,
        notes: 'Sigue aquí tras reabrir.',
        strength: 5,
      });
      expect(relationBackwardLabel(list[0]!)).toBe('Tiene como aliado a');
    } finally {
      if (reopened?.status === 'ready') {
        closeDatabase(reopened.client.sqlite);
      }

      await fixture.test.cleanup();
    }
  });

  it('el seed de tipos del sistema coincide con el catálogo', async () => {
    const fixture = await createFixture();

    try {
      const rows = fixture.sqlite
        .prepare(
          `SELECT id, key, name, inverse_name, color, is_system
             FROM relation_types
            WHERE world_id IS NULL
            ORDER BY key`,
        )
        .all() as {
        id: string;
        key: string;
        name: string;
        inverse_name: string;
        color: string;
        is_system: number;
      }[];

      expect(rows).toHaveLength(SYSTEM_RELATION_TYPES.length);

      for (const definition of SYSTEM_RELATION_TYPES) {
        expect(rows.find((row) => row.key === definition.key)).toEqual({
          id: definition.id,
          key: definition.key,
          name: definition.name,
          inverse_name: definition.inverseName,
          color: definition.color,
          is_system: 1,
        });
      }
    } finally {
      await fixture.close();
    }
  });
});
