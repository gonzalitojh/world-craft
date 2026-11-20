import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { closeDatabase, type SqliteDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';
import type { WorldCraftDatabase } from '@/main/db/client';
import { entityTypes } from '@/main/db/schema/entity-types';
import {
  createEntityTypesService,
  type EntityTypesService,
} from '@/main/entity-types/service';
import { EntityTypeInputError } from '@/main/entity-types/errors';
import { createWorldsService, type WorldsService } from '@/main/worlds/service';
import {
  SYSTEM_ENTITY_TYPE_CREATED_AT,
  SYSTEM_ENTITY_TYPES,
} from '@/shared/entity-types/catalog';

import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;

interface Fixture {
  readonly test: TempDatabase;
  readonly sqlite: SqliteDatabase;
  readonly database: WorldCraftDatabase;
  readonly worlds: WorldsService;
  readonly entityTypes: EntityTypesService;
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

  const entityTypesService = createEntityTypesService({
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    now,
    generateId,
  });
  const worldsService = createWorldsService({
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    now,
    generateId,
    onDuplicate: (sourceId, targetId, at) =>
      entityTypesService.copyFromWorld(sourceId, targetId, at),
  });

  return {
    test,
    sqlite: startup.client.sqlite,
    database: startup.client.orm,
    worlds: worldsService,
    entityTypes: entityTypesService,
    async close() {
      closeDatabase(startup.client.sqlite);
      await test.cleanup();
    },
  };
}

const fields = [
  {
    key: 'leader',
    label: 'Líder',
    type: 'text' as const,
    required: true,
    maxLength: 80,
  },
  {
    key: 'founded',
    label: 'Fundación',
    type: 'date' as const,
    required: false,
  },
  {
    key: 'secrecy',
    label: 'Secreto',
    type: 'select' as const,
    required: false,
    options: [
      { value: 'public', label: 'Público' },
      { value: 'secret', label: 'Secreto' },
    ],
  },
  {
    key: 'home',
    label: 'Sede',
    type: 'reference' as const,
    required: false,
    targetTypeKey: 'place',
  },
];

describe('servicio de tipos de entidad', () => {
  it('lista los 18 tipos del sistema y los personalizados del mundo', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const custom = fixture.entityTypes.create({
        worldId: world.id,
        name: '  Orden   del Alba ',
        icon: 'crown',
        color: 'ochre',
        fields,
      });

      expect(custom).toMatchObject({
        worldId: world.id,
        key: 'orden-del-alba',
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        isSystem: false,
      });
      expect(custom.fields).toEqual(fields);

      const list = fixture.entityTypes.list(world.id);

      expect(list).toHaveLength(19);
      expect(list.slice(0, 18).map((type) => type.key)).toEqual(
        SYSTEM_ENTITY_TYPES.map((type) => type.key),
      );
      expect(list.slice(0, 18).every((type) => type.isSystem)).toBe(true);
      expect(list[18]).toMatchObject({ id: custom.id, key: 'orden-del-alba' });
    } finally {
      await fixture.close();
    }
  });

  it('protege los tipos del sistema y aísla los personalizados por mundo', async () => {
    const fixture = await createFixture();

    try {
      const first = fixture.worlds.create({ name: 'Primer mundo' });
      const second = fixture.worlds.create({ name: 'Segundo mundo' });
      const custom = fixture.entityTypes.create({
        worldId: first.id,
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields,
      });
      const system = fixture.entityTypes
        .list(first.id)
        .find((type) => type.key === 'character');

      expect(system).toBeDefined();

      if (system === undefined) {
        throw new Error('Falta el tipo del sistema.');
      }

      expect(() =>
        fixture.entityTypes.update({
          worldId: first.id,
          id: system.id,
          name: 'Personaje alterado',
          icon: 'crown',
          color: 'ochre',
          fields: [],
        }),
      ).toThrow(EntityTypeInputError);

      expect(() =>
        fixture.entityTypes.remove({ worldId: first.id, id: system.id }),
      ).toThrow(EntityTypeInputError);

      expect(
        fixture.entityTypes.update({
          worldId: second.id,
          id: custom.id,
          name: 'Cambio ajeno',
          icon: 'crown',
          color: 'ochre',
          fields,
        }),
      ).toBeNull();
      expect(
        fixture.entityTypes.remove({ worldId: second.id, id: custom.id }),
      ).toEqual({ deleted: false });
      expect(
        fixture.entityTypes
          .list(second.id)
          .some((type) => type.id === custom.id),
      ).toBe(false);
      expect(
        fixture.entityTypes
          .list(first.id)
          .some((type) => type.id === custom.id),
      ).toBe(true);
    } finally {
      await fixture.close();
    }
  });

  it('crea con clave explícita, evita claves reservadas y resuelve duplicados', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const explicit = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Orden del Alba',
        key: 'orden',
        icon: 'crown',
        color: 'ochre',
        fields: [],
      });

      expect(explicit.key).toBe('orden');

      expect(() =>
        fixture.entityTypes.create({
          worldId: world.id,
          name: 'Personaje falso',
          key: 'character',
          icon: 'crown',
          color: 'ochre',
          fields: [],
        }),
      ).toThrow(EntityTypeInputError);

      const first = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields: [],
      });
      const second = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields: [],
      });

      expect(first.key).toBe('orden-del-alba');
      expect(second.key).toBe('orden-del-alba-2');

      expect(() =>
        fixture.entityTypes.create({
          worldId: '01900000-0000-7000-8000-000000000099',
          name: 'Mundo inexistente',
          icon: 'crown',
          color: 'ochre',
          fields: [],
        }),
      ).toThrow(EntityTypeInputError);
    } finally {
      await fixture.close();
    }
  });

  it('la base rechaza claves que no cumplen el patrón', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const insert = (key: string, id: string): void => {
        fixture.database
          .insert(entityTypes)
          .values({
            id,
            worldId: world.id,
            key,
            name: 'Tipo inválido',
            icon: 'crown',
            color: 'ochre',
            fields: '[]',
            isSystem: 0,
            createdAt: BASE_TIME,
            updatedAt: BASE_TIME,
            deletedAt: null,
          })
          .run();
      };

      expect(() =>
        insert('-foo', '01900000-0000-7000-8000-0000000000a1'),
      ).toThrow();
      expect(() =>
        insert('foo-', '01900000-0000-7000-8000-0000000000a2'),
      ).toThrow();
      expect(() =>
        insert('foo--bar', '01900000-0000-7000-8000-0000000000a3'),
      ).toThrow();
    } finally {
      await fixture.close();
    }
  });

  it('actualiza y borra un tipo personalizado sin tocar los demás', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const first = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields,
      });
      const second = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Orden del Ocaso',
        icon: 'crown',
        color: 'prussian',
        fields: [],
      });

      const leaderField = fields[0];

      if (leaderField === undefined) {
        throw new Error('Falta el campo de prueba.');
      }

      const updated = fixture.entityTypes.update({
        worldId: world.id,
        id: first.id,
        name: 'Orden del Alba Renovada',
        icon: 'shield',
        color: 'moss',
        fields: [leaderField],
      });

      expect(updated).toMatchObject({
        id: first.id,
        name: 'Orden del Alba Renovada',
        icon: 'shield',
        color: 'moss',
        fields: [leaderField],
      });

      expect(
        fixture.entityTypes.remove({ worldId: world.id, id: second.id }),
      ).toEqual({ deleted: true });
      expect(
        fixture.entityTypes
          .list(world.id)
          .some((type) => type.id === second.id),
      ).toBe(false);
      expect(
        fixture.entityTypes.list(world.id).some((type) => type.id === first.id),
      ).toBe(true);

      const removedRow = fixture.database
        .select()
        .from(entityTypes)
        .where(eq(entityTypes.id, second.id))
        .get();

      expect(removedRow?.deletedAt).not.toBeNull();
    } finally {
      await fixture.close();
    }
  });

  it('duplica tipos del sistema y tipos propios en el mundo', async () => {
    const fixture = await createFixture();

    try {
      const first = fixture.worlds.create({ name: 'Primer mundo' });
      const second = fixture.worlds.create({ name: 'Segundo mundo' });
      const system = fixture.entityTypes
        .list(first.id)
        .find((type) => type.key === 'character');

      if (system === undefined) {
        throw new Error('Falta el tipo del sistema.');
      }

      const copied = fixture.entityTypes.duplicate({
        worldId: first.id,
        id: system.id,
        name: 'Personaje jugador',
      });

      expect(copied).toMatchObject({
        worldId: first.id,
        key: 'personaje-jugador',
        name: 'Personaje jugador',
        isSystem: false,
        fields: system.fields,
      });

      const own = fixture.entityTypes.create({
        worldId: first.id,
        name: 'Facción local',
        icon: 'flag',
        color: 'danger',
        fields: [],
      });

      expect(
        fixture.entityTypes.duplicate({
          worldId: second.id,
          id: own.id,
          name: 'Facción ajena',
        }),
      ).toBeNull();
    } finally {
      await fixture.close();
    }
  });

  it('exporta e importa solo los tipos personalizados con un formato versionado', async () => {
    const fixture = await createFixture();

    try {
      const first = fixture.worlds.create({ name: 'Primer mundo' });
      const second = fixture.worlds.create({ name: 'Segundo mundo' });

      fixture.entityTypes.create({
        worldId: first.id,
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields,
      });
      fixture.entityTypes.create({
        worldId: first.id,
        name: 'Orden del Ocaso',
        icon: 'shield',
        color: 'prussian',
        fields: [],
      });

      const exported = fixture.entityTypes.exportTypes(first.id);
      const firstType = exported.types[0];

      expect(exported).toMatchObject({ version: 1 });
      expect(exported.types.map((type) => type.key)).toEqual([
        'orden-del-alba',
        'orden-del-ocaso',
      ]);
      expect(firstType?.fields).toEqual(fields);
      expect(firstType).not.toHaveProperty('id');
      expect(firstType).not.toHaveProperty('worldId');

      if (firstType === undefined) {
        throw new Error('Falta el primer tipo exportado.');
      }

      const imported = fixture.entityTypes.importTypes(second.id, exported);

      expect(imported).toHaveLength(2);
      expect(imported[0]).toMatchObject({
        worldId: second.id,
        key: 'orden-del-alba',
        fields,
      });
      expect(
        imported.every((type) => !type.isSystem && type.worldId === second.id),
      ).toBe(true);
      expect(fixture.entityTypes.list(second.id)).toHaveLength(20);

      expect(() =>
        fixture.entityTypes.importTypes(second.id, exported),
      ).toThrow(EntityTypeInputError);
      expect(() =>
        fixture.entityTypes.importTypes(first.id, {
          version: 1,
          types: [{ ...firstType, key: 'character' }],
        }),
      ).toThrow(EntityTypeInputError);
      expect(() =>
        fixture.entityTypes.importTypes(first.id, {
          version: 2,
          types: [],
        }),
      ).toThrow(EntityTypeInputError);
      expect(() =>
        fixture.entityTypes.importTypes(first.id, {
          version: 1,
          types: [{ ...firstType, extra: true }],
        }),
      ).toThrow(EntityTypeInputError);
      expect(() =>
        fixture.entityTypes.importTypes(first.id, {
          version: 1,
          types: [firstType, firstType],
        }),
      ).toThrow(EntityTypeInputError);
      expect(fixture.entityTypes.list(first.id)).toHaveLength(20);
    } finally {
      await fixture.close();
    }
  });

  it('revierte la importación completa si falla una inserción', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const broken = createEntityTypesService({
        database: fixture.database,
        sqlite: fixture.sqlite,
        now: () => BASE_TIME,
        generateId: () => '01900000-0000-7000-8000-0000000000aa',
      });

      expect(() =>
        broken.importTypes(world.id, {
          version: 1,
          types: [
            {
              key: 'tipo-uno',
              name: 'Tipo uno',
              icon: 'crown',
              color: 'ochre',
              fields: [],
            },
            {
              key: 'tipo-dos',
              name: 'Tipo dos',
              icon: 'shield',
              color: 'moss',
              fields: [],
            },
          ],
        }),
      ).toThrow();

      expect(
        broken.list(world.id).filter((type) => !type.isSystem),
      ).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  it('copia los tipos al duplicar un mundo y los conserva al borrarlo', async () => {
    const fixture = await createFixture();

    try {
      const source = fixture.worlds.create({ name: 'Las Mareas Grises' });

      fixture.entityTypes.create({
        worldId: source.id,
        name: 'Orden del Alba',
        icon: 'crown',
        color: 'ochre',
        fields,
      });

      const sourceType = fixture.entityTypes
        .list(source.id)
        .find((type) => type.key === 'orden-del-alba');

      if (sourceType === undefined) {
        throw new Error('Falta el tipo de prueba.');
      }

      const copy = fixture.worlds.duplicate({
        id: source.id,
        name: 'Las Mareas Grises II',
      });

      if (copy === null) {
        throw new Error('No se duplicó el mundo.');
      }

      const copied = fixture.entityTypes
        .list(copy.id)
        .filter((type) => !type.isSystem);

      expect(copied).toHaveLength(1);
      expect(copied[0]).toMatchObject({
        key: 'orden-del-alba',
        name: 'Orden del Alba',
        fields,
        worldId: copy.id,
      });
      expect(copied[0]?.id).not.toBe(
        fixture.entityTypes
          .list(source.id)
          .find((type) => type.key === 'orden-del-alba')?.id,
      );

      fixture.worlds.remove(source.id);

      expect(fixture.entityTypes.list(source.id)).toEqual([]);
      const remaining = fixture.database
        .select()
        .from(entityTypes)
        .where(eq(entityTypes.worldId, source.id))
        .all();

      expect(remaining).toHaveLength(1);
      // El borrado lógico del mundo no marca los tipos; la purga los eliminará.
      expect(remaining[0]?.deletedAt).toBeNull();
      expect(() => fixture.entityTypes.exportTypes(source.id)).toThrow(
        EntityTypeInputError,
      );
      expect(
        fixture.entityTypes.update({
          worldId: source.id,
          id: sourceType.id,
          name: 'Cambio en papelera',
          icon: 'crown',
          color: 'ochre',
          fields,
        }),
      ).toBeNull();
      expect(
        fixture.entityTypes.remove({
          worldId: source.id,
          id: sourceType.id,
        }),
      ).toEqual({ deleted: false });
    } finally {
      await fixture.close();
    }
  });

  it('revierte el mundo duplicado si falla la copia de tipos', async () => {
    const fixture = await createFixture();

    try {
      const source = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const failingWorlds = createWorldsService({
        database: fixture.database,
        sqlite: fixture.sqlite,
        now: () => BASE_TIME,
        generateId: () => '01900000-0000-7000-8000-000000000099',
        onDuplicate: () => {
          throw new Error('Fallo al copiar los tipos.');
        },
      });

      expect(() =>
        failingWorlds.duplicate({
          id: source.id,
          name: 'Copia fallida',
        }),
      ).toThrow('Fallo al copiar los tipos.');

      expect(fixture.worlds.list().map((world) => world.name)).toEqual([
        'Las Mareas Grises',
      ]);
    } finally {
      await fixture.close();
    }
  });

  it('siembra exactamente el catálogo del sistema en la migración', async () => {
    const fixture = await createFixture();

    try {
      const rows = fixture.database
        .select()
        .from(entityTypes)
        .where(eq(entityTypes.isSystem, 1))
        .all()
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((row) => ({
          id: row.id,
          worldId: row.worldId,
          key: row.key,
          name: row.name,
          icon: row.icon,
          color: row.color,
          isSystem: row.isSystem,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          fields: JSON.parse(row.fields) as unknown,
        }));

      expect(rows).toHaveLength(SYSTEM_ENTITY_TYPES.length);
      expect(rows).toEqual(
        SYSTEM_ENTITY_TYPES.map((type) => ({
          id: type.id,
          worldId: null,
          key: type.key,
          name: type.name,
          icon: type.icon,
          color: type.color,
          isSystem: 1,
          createdAt: SYSTEM_ENTITY_TYPE_CREATED_AT,
          updatedAt: SYSTEM_ENTITY_TYPE_CREATED_AT,
          fields: JSON.parse(JSON.stringify(type.fields)) as unknown,
        })).sort((left, right) => left.id.localeCompare(right.id)),
      );
    } finally {
      await fixture.close();
    }
  });
});
