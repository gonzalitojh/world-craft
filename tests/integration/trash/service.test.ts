import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createAssetRepository } from '@/main/assets/store';
import type { WorldCraftDatabase } from '@/main/db/client';
import { closeDatabase, type SqliteDatabase } from '@/main/db/connection';
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
  createRelationsService,
  type RelationsService,
} from '@/main/relations/service';
import { createTrashService, type TrashService } from '@/main/trash/service';
import {
  createVersionsService,
  type VersionsService,
} from '@/main/versions/service';
import { createWorldsService, type WorldsService } from '@/main/worlds/service';
import type { EntityRichTextDocument } from '@/shared/contracts/entities';

import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;

interface Fixture {
  readonly test: TempDatabase;
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly worlds: WorldsService;
  readonly entityTypes: EntityTypesService;
  readonly entities: EntitiesService;
  readonly versions: VersionsService;
  readonly relations: RelationsService;
  readonly trash: TrashService;
  readonly insertAsset: (worldId: string) => Promise<string>;
  close(): Promise<void>;
}

async function createFixture(options?: {
  readonly copyWorks?: boolean;
}): Promise<Fixture> {
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
  const sqlite = startup.client.sqlite;
  const database = startup.client.orm;

  const entityTypes = createEntityTypesService({
    database,
    sqlite,
    now,
    generateId,
  });
  const versions = createVersionsService({ database, sqlite, now, generateId });
  const entities = createEntitiesService({
    database,
    sqlite,
    now,
    generateId,
  });
  const worlds = createWorldsService({
    database,
    sqlite,
    now,
    generateId,
    onDuplicate: (sourceId, targetId, at) =>
      entityTypes.copyFromWorld(sourceId, targetId, at),
  });
  const relations = createRelationsService({
    database,
    sqlite,
    now,
    generateId,
  });
  const assetRepository = createAssetRepository(database);

  const copyWorks = options?.copyWorks ?? true;

  return {
    test,
    database,
    sqlite,
    worlds,
    entityTypes,
    entities,
    versions,
    relations,
    trash: createTrashService({
      database,
      sqlite,
      now,
      createSafetyCopy: vi.fn(async () => copyWorks),
    }),
    async insertAsset(worldId) {
      const id = generateId();
      const relativePath = `worlds/${worldId}/${id}.webp`;
      const absolute = join(test.paths.assetsDir, relativePath);

      await mkdir(join(test.paths.assetsDir, 'worlds', worldId), {
        recursive: true,
      });
      await writeFile(absolute, 'imagen-de-prueba', 'utf8');
      assetRepository.insert({
        id,
        worldId,
        kind: 'image',
        relativePath,
        mime: 'image/webp',
        size: 16,
        width: 640,
        height: 480,
        alt: 'Imagen de prueba',
        hash: 'a'.repeat(64),
        createdAt: now(),
      });

      return id;
    },
    async close() {
      closeDatabase(sqlite);
      await test.cleanup();
    },
  };
}

function description(text: string): EntityRichTextDocument {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

describe('servicio de papelera', () => {
  it('lista, restaura y conserva assets y búsqueda', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Las Mareas Grises' });
      const type = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Reliquia',
        icon: 'gem',
        color: 'ochre',
        fields: [],
      });
      const entity = fixture.entities.create({
        worldId: world.id,
        typeId: type.id,
        name: 'Faro de Sal',
        description: description('Brilla sobre el muelle.'),
      });
      const assetId = await fixture.insertAsset(world.id);

      fixture.entities.remove({ worldId: world.id, id: entity.id });

      const page = fixture.trash.list({ group: 'entities' });

      expect(page.items).toEqual([
        expect.objectContaining({
          kind: 'entity',
          id: entity.id,
          name: 'Faro de Sal',
          worldName: 'Las Mareas Grises',
          typeName: 'Reliquia',
          worldDeletedAt: null,
        }),
      ]);
      expect(fixture.test.paths.databaseFile.includes('world-craft-db-')).toBe(
        true,
      );
      expect(
        fixture.sqlite
          .prepare(
            'SELECT count(*) AS total FROM search_entity_documents WHERE source_id = ?',
          )
          .get(entity.id),
      ).toEqual({ total: 0 });

      expect(fixture.trash.restore({ kind: 'entity', id: entity.id })).toEqual({
        restored: true,
      });
      expect(
        fixture.sqlite
          .prepare(
            'SELECT count(*) AS total FROM search_entity_documents WHERE source_id = ?',
          )
          .get(entity.id),
      ).toEqual({ total: 1 });
      expect(
        fixture.entities.get({ worldId: world.id, id: entity.id }),
      ).not.toBeNull();
      expect(
        await stat(
          join(
            fixture.test.paths.assetsDir,
            'worlds',
            world.id,
            `${assetId}.webp`,
          ),
        ),
      ).toBeTruthy();
    } finally {
      await fixture.close();
    }
  });

  it('devuelve world-in-trash y type-unavailable sin restaurar', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Mundo en papelera' });
      const type = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Reliquia',
        icon: 'gem',
        color: 'ochre',
        fields: [],
      });
      const entity = fixture.entities.create({
        worldId: world.id,
        typeId: type.id,
        name: 'Faro',
      });

      fixture.entities.remove({ worldId: world.id, id: entity.id });
      fixture.worlds.remove(world.id);

      expect(fixture.trash.restore({ kind: 'entity', id: entity.id })).toEqual({
        restored: false,
        reason: 'world-in-trash',
      });

      fixture.worlds.remove(world.id);

      expect(
        fixture.sqlite
          .prepare('UPDATE entity_types SET deleted_at = ? WHERE id = ?')
          .run(BASE_TIME, type.id),
      ).toBeTruthy();

      fixture.sqlite
        .prepare('UPDATE worlds SET deleted_at = NULL WHERE id = ?')
        .run(world.id);

      expect(fixture.trash.restore({ kind: 'entity', id: entity.id })).toEqual({
        restored: false,
        reason: 'type-unavailable',
      });

      // Idempotencia: restaurar algo vivo devuelve already-restored.
      fixture.sqlite
        .prepare('UPDATE worlds SET deleted_at = NULL WHERE id = ?')
        .run(world.id);
      expect(fixture.trash.restore({ kind: 'world', id: world.id })).toEqual({
        restored: false,
        reason: 'already-restored',
      });
    } finally {
      await fixture.close();
    }
  });

  it('no purga lo vivo ni borra nada si falla la copia previa', async () => {
    const fixture = await createFixture({ copyWorks: false });

    try {
      const world = fixture.worlds.create({ name: 'Mundo' });
      const type = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Reliquia',
        icon: 'gem',
        color: 'ochre',
        fields: [],
      });
      const entity = fixture.entities.create({
        worldId: world.id,
        typeId: type.id,
        name: 'Faro',
      });

      expect(
        await fixture.trash.purge({
          kind: 'entity',
          id: entity.id,
          confirm: 'delete-forever',
        }),
      ).toEqual({ purged: false, reason: 'already-purged' });

      fixture.entities.remove({ worldId: world.id, id: entity.id });

      expect(
        await fixture.trash.purge({
          kind: 'entity',
          id: entity.id,
          confirm: 'delete-forever',
        }),
      ).toEqual({ purged: false, reason: 'backup-failed' });
      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM entities WHERE id = ?')
          .get(entity.id),
      ).toEqual({ total: 1 });
    } finally {
      await fixture.close();
    }
  });

  it('purga ficha, tipo y mundo en orden y vacía con contadores', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Mundo a purgar' });
      const type = fixture.entityTypes.create({
        worldId: world.id,
        name: 'Reliquia',
        icon: 'gem',
        color: 'ochre',
        fields: [],
      });
      const entity = fixture.entities.create({
        worldId: world.id,
        typeId: type.id,
        name: 'Faro',
        description: description('Texto'),
      });
      fixture.versions.create({
        worldId: world.id,
        entityId: entity.id,
        label: 'Antes',
      });

      const cityType = fixture.entityTypes
        .list(world.id)
        .find((item) => item.key === 'city');

      if (cityType === undefined) {
        throw new Error('Falta el tipo de ciudad.');
      }

      const secondEntity = fixture.entities.create({
        worldId: world.id,
        typeId: cityType.id,
        name: 'Puerto',
      });
      const relationType = fixture.relations
        .listTypes(world.id)
        .find((item) => item.key === 'located-in');

      if (relationType === undefined) {
        throw new Error('Falta el tipo de relación.');
      }

      fixture.relations.create({
        worldId: world.id,
        sourceId: entity.id,
        targetId: secondEntity.id,
        typeId: relationType.id,
      });

      const assetId = await fixture.insertAsset(world.id);

      fixture.entities.remove({ worldId: world.id, id: entity.id });

      expect(
        await fixture.trash.purge({
          kind: 'entity',
          id: entity.id,
          confirm: 'delete-forever',
        }),
      ).toEqual({ purged: true });
      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM entity_versions')
          .get(),
      ).toEqual({ total: 0 });

      // Un tipo sin fichas puede purgarse.
      fixture.entityTypes.remove({ worldId: world.id, id: type.id });
      expect(
        await fixture.trash.purge({
          kind: 'entityType',
          id: type.id,
          confirm: 'delete-forever',
        }),
      ).toEqual({ purged: true });

      fixture.worlds.remove(world.id);
      expect(
        await fixture.trash.purge({
          kind: 'world',
          id: world.id,
          confirm: 'delete-forever',
        }),
      ).toEqual({ purged: true });

      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM worlds WHERE id = ?')
          .get(world.id),
      ).toEqual({ total: 0 });
      expect(
        fixture.sqlite
          .prepare(
            'SELECT count(*) AS total FROM activity_log WHERE world_id = ?',
          )
          .get(world.id),
      ).toEqual({ total: 0 });
      expect(
        fixture.sqlite.prepare('SELECT count(*) AS total FROM relations').get(),
      ).toEqual({ total: 0 });
      // D8: la fila y el archivo del asset siguen existiendo.
      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM assets WHERE id = ?')
          .get(assetId),
      ).toEqual({ total: 1 });

      // Vaciado: mundos, fichas y tipos restantes con una sola copia.
      const secondWorld = fixture.worlds.create({ name: 'Otro mundo' });
      const secondType = fixture.entityTypes.create({
        worldId: secondWorld.id,
        name: 'Otro tipo',
        icon: 'gem',
        color: 'moss',
        fields: [],
      });
      const emptyEntity = fixture.entities.create({
        worldId: secondWorld.id,
        typeId: secondType.id,
        name: 'Otra ficha',
      });
      fixture.entities.remove({ worldId: secondWorld.id, id: emptyEntity.id });
      fixture.worlds.remove(secondWorld.id);

      const emptied = await fixture.trash.empty({ confirm: 'empty-trash' });

      expect(emptied.backup).toBe('created');
      expect(emptied.purged).toEqual({
        worlds: 1,
        entities: 1,
        entityTypes: 0,
      });
      expect(emptied.skipped).toBe(0);
      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM worlds WHERE id = ?')
          .get(secondWorld.id),
      ).toEqual({ total: 0 });
    } finally {
      await fixture.close();
    }
  });

  it('pagina por cursor sin repetir ni perder elementos', async () => {
    const fixture = await createFixture();

    try {
      const world = fixture.worlds.create({ name: 'Mundo' });
      const type = fixture.entityTypes
        .list(world.id)
        .find((item) => item.key === 'character');

      if (type === undefined) {
        throw new Error('Falta el tipo de personaje.');
      }

      const ids: string[] = [];

      for (let index = 0; index < 3; index += 1) {
        const entity = fixture.entities.create({
          worldId: world.id,
          typeId: type.id,
          name: `Ficha ${index}`,
        });

        ids.push(entity.id);
        fixture.entities.remove({ worldId: world.id, id: entity.id });
      }

      const first = fixture.trash.list({ group: 'entities', limit: 2 });

      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();

      const second = fixture.trash.list({
        group: 'entities',
        limit: 2,
        ...(first.nextCursor === null ? {} : { cursor: first.nextCursor }),
      });

      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect(
        new Set([...first.items, ...second.items].map((item) => item.id)),
      ).toEqual(new Set(ids));
    } finally {
      await fixture.close();
    }
  });
});
