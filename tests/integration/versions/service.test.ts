import { describe, expect, it, vi } from 'vitest';

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
import { createTrashService } from '@/main/trash/service';
import {
  createVersionRecorder,
  createVersionsService,
  type VersionsService,
} from '@/main/versions/service';
import { createWorldsService, type WorldsService } from '@/main/worlds/service';
import type {
  EntityDetail,
  EntityRichTextDocument,
  EntityUpdateInput,
} from '@/shared/contracts/entities';

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
  readonly advance: (milliseconds: number) => void;
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
  let offset = 0;
  let idCounter = 0;
  const now = (): number => BASE_TIME + offset + (tick += 1) * 1_000;
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
  const recorder = createVersionRecorder({ database, sqlite, now, generateId });
  const entities = createEntitiesService({
    database,
    sqlite,
    now,
    generateId,
    versions: recorder,
  });
  const worlds = createWorldsService({
    database,
    sqlite,
    now,
    generateId,
    onDuplicate: (sourceId, targetId, at) =>
      entityTypes.copyFromWorld(sourceId, targetId, at),
  });

  return {
    test,
    database,
    sqlite,
    worlds,
    entityTypes,
    entities,
    versions,
    advance(milliseconds) {
      offset += milliseconds;
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

function createEntity(
  fixture: Fixture,
  text: string,
): {
  readonly worldId: string;
  readonly entity: EntityDetail;
} {
  const world = fixture.worlds.create({ name: `Mundo ${text}` });
  const type = fixture.entityTypes
    .list(world.id)
    .find((item) => item.key === 'character');

  if (type === undefined) {
    throw new Error('Falta el tipo de personaje.');
  }

  return {
    worldId: world.id,
    entity: fixture.entities.create({
      worldId: world.id,
      typeId: type.id,
      name: 'Mara',
      description: description(text),
    }),
  };
}

function updateDescription(
  fixture: Fixture,
  worldId: string,
  entity: EntityDetail,
  text: string | null,
): EntityDetail {
  const input: EntityUpdateInput = {
    worldId,
    id: entity.id,
    name: entity.name,
    aliases: entity.aliases,
    summary: entity.summary,
    description: text === null ? null : description(text),
    attributes: entity.attributes,
    imageAssetId: entity.imageAssetId,
    galleryAssetIds: entity.gallery.map((item) => item.assetId),
    tagIds: entity.tags.map((tag) => tag.id),
    status: entity.status,
  };
  const updated = fixture.entities.update(input);

  if (updated === null) {
    throw new Error('La ficha no se actualizó.');
  }

  return updated;
}

describe('servicio de versiones', () => {
  it('agrupa ráfagas de cinco minutos y solo versiona cambios reales', async () => {
    const fixture = await createFixture();

    try {
      const { worldId, entity } = createEntity(fixture, 'A');
      let current = updateDescription(fixture, worldId, entity, 'B');

      // Dentro de la ventana no se añade otra automática.
      current = updateDescription(fixture, worldId, current, 'C');
      expect(fixture.versions.list({ worldId, entityId: entity.id })).toEqual([
        expect.objectContaining({
          origin: 'auto',
          label: null,
          descriptionTextPreview: 'A',
        }),
      ]);

      // Un cambio de nombre sin tocar la descripción no versiona.
      fixture.entities.update({
        worldId,
        id: current.id,
        name: 'Mara la Cartógrafa',
        aliases: current.aliases,
        summary: current.summary,
        description: description('C'),
        attributes: current.attributes,
        imageAssetId: current.imageAssetId,
        galleryAssetIds: current.gallery.map((item) => item.assetId),
        tagIds: current.tags.map((tag) => tag.id),
        status: current.status,
      });
      expect(
        fixture.versions.list({ worldId, entityId: entity.id }),
      ).toHaveLength(1);

      // Pasada la ventana, la siguiente edición abre otra ráfaga.
      fixture.advance(301_000);
      current = updateDescription(fixture, worldId, current, 'D');
      expect(
        fixture.versions.list({ worldId, entityId: entity.id }),
      ).toHaveLength(2);

      // Vaciar la descripción versiona el estado saliente no vacío.
      fixture.advance(301_000);
      current = updateDescription(fixture, worldId, current, null);
      expect(
        fixture.versions.list({ worldId, entityId: entity.id }),
      ).toHaveLength(3);

      // Partir de una descripción vacía no crea una versión sin contenido.
      fixture.advance(301_000);
      updateDescription(fixture, worldId, current, 'E');
      expect(
        fixture.versions.list({ worldId, entityId: entity.id }),
      ).toHaveLength(3);
    } finally {
      await fixture.close();
    }
  });

  it('guarda manuales con etiqueta, aplica el tope y conserva el estado al restaurar', async () => {
    const fixture = await createFixture();

    try {
      const { worldId, entity } = createEntity(fixture, 'A');
      const created = fixture.versions.create({
        worldId,
        entityId: entity.id,
        label: '  Hito del faro  ',
      });

      expect(created.created).toBe(true);
      expect(created.created ? created.version.label : null).toBe(
        'Hito del faro',
      );

      const updated = updateDescription(fixture, worldId, entity, 'B');

      expect(
        fixture.versions.restore({
          worldId,
          entityId: entity.id,
          versionId: created.created ? created.version.id : '',
        }),
      ).toEqual({ restored: true });
      expect(
        fixture.entities.get({ worldId, id: entity.id })?.description,
      ).toEqual(description('A'));

      const afterRestore = fixture.versions.list({
        worldId,
        entityId: entity.id,
      });

      expect(afterRestore.some((version) => version.origin === 'restore')).toBe(
        true,
      );

      // Restaurar la misma versión ya aplicada es idempotente.
      expect(
        fixture.versions.restore({
          worldId,
          entityId: entity.id,
          versionId: created.created ? created.version.id : '',
        }),
      ).toEqual({ restored: false, reason: 'unchanged' });
      expect(updated.name).toBe(entity.name);

      // Tope de 50 manuales: no se poda ninguna existente.
      for (let index = 0; index < 49; index += 1) {
        expect(
          fixture.versions.create({
            worldId,
            entityId: entity.id,
            label: `Manual ${index}`,
          }).created,
        ).toBe(true);
      }

      expect(
        fixture.versions.create({
          worldId,
          entityId: entity.id,
          label: 'Una más',
        }),
      ).toEqual({ created: false, reason: 'manual-limit' });
      expect(
        fixture.versions
          .list({ worldId, entityId: entity.id, limit: 200 })
          .filter((version) => version.origin === 'manual'),
      ).toHaveLength(50);
    } finally {
      await fixture.close();
    }
  });

  it('poda automáticas por número y conserva manuales, restauraciones y la más reciente', async () => {
    const fixture = await createFixture();

    try {
      const { worldId, entity } = createEntity(fixture, 'v0');
      let current = entity;

      for (let index = 1; index <= 25; index += 1) {
        fixture.advance(301_000);
        current = updateDescription(fixture, worldId, current, `v${index}`);
      }

      const versions = fixture.versions.list({
        worldId,
        entityId: entity.id,
        limit: 200,
      });

      expect(versions).toHaveLength(20);
      expect(versions.every((version) => version.origin === 'auto')).toBe(true);

      const manual = fixture.versions.create({
        worldId,
        entityId: entity.id,
        label: 'Conservar',
      });

      expect(manual.created).toBe(true);

      const withManual = fixture.versions.list({
        worldId,
        entityId: entity.id,
        limit: 200,
      });

      expect(
        withManual.filter((version) => version.origin === 'manual'),
      ).toHaveLength(1);
      expect(
        withManual.filter((version) => version.origin === 'auto'),
      ).toHaveLength(20);
    } finally {
      await fixture.close();
    }
  });

  it('no versiona fichas en papelera y borra las versiones al purgar', async () => {
    const fixture = await createFixture();

    try {
      const { worldId, entity } = createEntity(fixture, 'A');
      updateDescription(fixture, worldId, entity, 'B');
      fixture.entities.remove({ worldId, id: entity.id });

      expect(fixture.versions.list({ worldId, entityId: entity.id })).toEqual(
        [],
      );
      expect(
        fixture.entities.update({
          worldId,
          id: entity.id,
          name: 'Mara',
          aliases: [],
          summary: null,
          description: description('C'),
          attributes: {},
          imageAssetId: null,
          galleryAssetIds: [],
          tagIds: [],
          status: 'active',
        }),
      ).toBeNull();

      const trash = createTrashService({
        database: fixture.database,
        sqlite: fixture.sqlite,
        createSafetyCopy: vi.fn(async () => true),
      });

      expect(
        await trash.purge({
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
    } finally {
      await fixture.close();
    }
  });
});
