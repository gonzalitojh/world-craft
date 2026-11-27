import { describe, expect, it } from 'vitest';

import { closeDatabase, type SqliteDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';
import type { WorldCraftDatabase } from '@/main/db/client';
import { WorldInputError } from '@/main/worlds/errors';
import { createWorldsService, type WorldsService } from '@/main/worlds/service';
import {
  collectEntityLinkIds,
  extractEntityDescriptionText,
  plainTextToRichTextDocument,
} from '@/shared/entities/description';
import type { EntityRichTextDocument } from '@/shared/contracts/entities';

import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;

interface WorldsFixture {
  readonly test: TempDatabase;
  readonly sqlite: SqliteDatabase;
  readonly database: WorldCraftDatabase;
  readonly service: WorldsService;
  close(): Promise<void>;
}

/**
 * Prepara una base real con las migraciones del repositorio y un servicio con
 * reloj e IDs deterministas. Cada operación avanza un segundo para que el orden
 * de actividad sea estable.
 */
async function createWorldsFixture(): Promise<WorldsFixture> {
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

  return {
    test,
    sqlite: startup.client.sqlite,
    database: startup.client.orm,
    service: createWorldsService({
      database: startup.client.orm,
      sqlite: startup.client.sqlite,
      now,
      generateId,
    }),
    async close() {
      closeDatabase(startup.client.sqlite);
      await test.cleanup();
    },
  };
}

function seedEntity(
  fixture: WorldsFixture,
  worldId: string,
  id: string,
  name: string,
  deletedAt: number | null = null,
): void {
  const type = fixture.sqlite
    .prepare("SELECT id FROM entity_types WHERE key = 'character'")
    .get() as { id: string };

  fixture.sqlite
    .prepare(
      `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, summary, description, description_text, attributes, status, is_favorite, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, '[]', NULL, NULL, NULL, '{}', 'active', 0, ?, ?, ?)`,
    )
    .run(
      id,
      worldId,
      type.id,
      name,
      name.toLowerCase().replaceAll(' ', '-'),
      BASE_TIME,
      BASE_TIME,
      deletedAt,
    );
}

function linkedDescription(entityId: string): EntityRichTextDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Visita a ' },
          {
            type: 'text',
            text: 'Aria',
            marks: [
              {
                type: 'link',
                attrs: { href: `wc-entity://${entityId}` },
              },
            ],
          },
          { type: 'text', text: '.' },
        ],
      },
    ],
  };
}

describe('servicio de mundos', () => {
  it('crea un mundo normalizado y registra la actividad', async () => {
    const fixture = await createWorldsFixture();

    try {
      const world = fixture.service.create({
        name: '  Las   Mareas Grises  ',
        summary: '  Una historia   de mareas  ',
        description: plainTextToRichTextDocument(
          'Primera línea.\n\nSegunda línea.',
        ),
        genres: ['Fantasía', ' fantasía ', 'Aventura'],
      });

      expect(world).toMatchObject({
        name: 'Las Mareas Grises',
        slug: 'las-mareas-grises',
        summary: 'Una historia de mareas',
        description: plainTextToRichTextDocument(
          'Primera línea.\n\nSegunda línea.',
        ),
        genres: ['Fantasía', 'Aventura'],
        status: 'active',
        language: 'es',
        archivedAt: null,
        coverAssetId: null,
      });
      expect(fixture.service.list()).toHaveLength(1);

      const activity = fixture.service.listActivity({ worldId: world.id });

      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({
        worldId: world.id,
        worldName: 'Las Mareas Grises',
        action: 'world.created',
        entityType: 'world',
        entityId: world.id,
      });
    } finally {
      await fixture.close();
    }
  });

  it('genera slugs únicos y conserva el slug al renombrar', async () => {
    const fixture = await createWorldsFixture();

    try {
      const first = fixture.service.create({ name: 'Las Mareas Grises' });
      const second = fixture.service.create({ name: 'Otro mundo' });

      expect(first.slug).toBe('las-mareas-grises');
      expect(second.slug).toBe('otro-mundo');

      const renamed = fixture.service.update({
        id: first.id,
        name: 'Las Mareas Grises del Sur',
      });

      expect(renamed?.name).toBe('Las Mareas Grises del Sur');
      expect(renamed?.slug).toBe('las-mareas-grises');

      const withExplicitSlug = fixture.service.update({
        id: second.id,
        name: 'Otro mundo',
        slug: 'las-mareas-grises',
      });

      expect(withExplicitSlug?.slug).toBe('las-mareas-grises-2');
    } finally {
      await fixture.close();
    }
  });

  it('solo escribe y registra actividad cuando algún campo cambia', async () => {
    const fixture = await createWorldsFixture();

    try {
      const created = fixture.service.create({
        name: 'Mundo quieto',
        summary: 'Sin cambios',
      });
      const before = fixture.service.listActivity({ worldId: created.id });

      const unchanged = fixture.service.update({
        id: created.id,
        name: created.name,
        slug: created.slug,
        summary: created.summary,
        description: created.description,
        genres: created.genres,
        language: created.language,
      });

      expect(unchanged?.updatedAt).toBe(created.updatedAt);
      expect(
        fixture.service.listActivity({ worldId: created.id }),
      ).toHaveLength(before.length);

      const changed = fixture.service.update({
        id: created.id,
        name: created.name,
        summary: 'Resumen nuevo',
      });

      expect(changed?.summary).toBe('Resumen nuevo');

      const activity = fixture.service.listActivity({
        worldId: created.id,
        limit: 1,
      });

      expect(activity[0]?.action).toBe('world.updated');

      const diff = fixture.sqlite
        .prepare(
          'SELECT diff FROM activity_log ORDER BY created_at DESC LIMIT 1',
        )
        .get() as { diff: string };

      expect(JSON.parse(diff.diff)).toEqual({ fields: ['summary'] });
    } finally {
      await fixture.close();
    }
  });

  it('duplica el contenido editable sin compartir identidad ni portada', async () => {
    const fixture = await createWorldsFixture();

    try {
      const source = fixture.service.create({
        name: 'Mareas',
        summary: 'Resumen de origen',
        description: plainTextToRichTextDocument('Descripción de origen'),
        genres: ['Aventura'],
        language: 'en',
      });

      const copy = fixture.service.duplicate({
        id: source.id,
        name: 'Mareas — copia',
      });

      if (copy === null) {
        throw new Error('Se esperaba una copia del mundo.');
      }

      expect(copy.id).not.toBe(source.id);
      expect(copy.slug).toBe('mareas-copia');
      expect(copy.summary).toBe('Resumen de origen');
      expect(copy.description).toEqual(
        plainTextToRichTextDocument('Descripción de origen'),
      );
      expect(copy.genres).toEqual(['Aventura']);
      expect(copy.language).toBe('en');
      expect(copy.status).toBe('active');
      expect(copy.coverAssetId).toBeNull();

      expect(fixture.service.get(source.id)?.name).toBe('Mareas');
      expect(
        fixture.service.listActivity({ worldId: copy.id })[0]?.action,
      ).toBe('world.duplicated');
    } finally {
      await fixture.close();
    }
  });

  it('archiva y restaura sin borrar y registra cada cambio', async () => {
    const fixture = await createWorldsFixture();

    try {
      const world = fixture.service.create({ name: 'Archivable' });
      const archived = fixture.service.setArchived({
        id: world.id,
        archived: true,
      });

      expect(archived?.status).toBe('archived');
      expect(archived?.archivedAt).not.toBeNull();
      expect(fixture.service.list()).toHaveLength(1);

      const repeated = fixture.service.setArchived({
        id: world.id,
        archived: true,
      });

      expect(repeated?.status).toBe('archived');
      expect(
        fixture.service.listActivity({ worldId: world.id, limit: 1 })[0]
          ?.action,
      ).toBe('world.archived');

      const restored = fixture.service.setArchived({
        id: world.id,
        archived: false,
      });

      expect(restored?.status).toBe('active');
      expect(restored?.archivedAt).toBeNull();
      expect(
        fixture.service.listActivity({ worldId: world.id, limit: 1 })[0]
          ?.action,
      ).toBe('world.restored');
    } finally {
      await fixture.close();
    }
  });

  it('mueve a la papelera con borrado lógico y deja de aparecer', async () => {
    const fixture = await createWorldsFixture();

    try {
      const world = fixture.service.create({ name: 'Borrable' });

      expect(fixture.service.remove(world.id)).toBe(true);
      expect(fixture.service.get(world.id)).toBeNull();
      expect(fixture.service.list()).toEqual([]);
      expect(fixture.service.listActivity()).toEqual([]);
      expect(fixture.service.remove(world.id)).toBe(false);

      const row = fixture.sqlite
        .prepare('SELECT deleted_at FROM worlds WHERE id = ?')
        .get(world.id) as { deleted_at: number | null };

      expect(row.deleted_at).not.toBeNull();
    } finally {
      await fixture.close();
    }
  });

  it('aísla los datos y la actividad entre mundos', async () => {
    const fixture = await createWorldsFixture();

    try {
      const first = fixture.service.create({ name: 'Primer mundo' });
      const second = fixture.service.create({ name: 'Segundo mundo' });

      fixture.service.update({
        id: first.id,
        name: 'Primer mundo',
        summary: 'Solo del primero',
      });

      const firstActivity = fixture.service.listActivity({
        worldId: first.id,
      });
      const secondActivity = fixture.service.listActivity({
        worldId: second.id,
      });

      expect(firstActivity.every((entry) => entry.worldId === first.id)).toBe(
        true,
      );
      expect(firstActivity.map((entry) => entry.action)).toContain(
        'world.updated',
      );
      expect(secondActivity.every((entry) => entry.worldId === second.id)).toBe(
        true,
      );
      expect(secondActivity.map((entry) => entry.action)).not.toContain(
        'world.updated',
      );

      const global = fixture.service.listActivity();

      expect(global.map((entry) => entry.worldName)).toEqual([
        'Primer mundo',
        'Segundo mundo',
        'Primer mundo',
      ]);
      expect(fixture.service.get(second.id)?.summary).toBeNull();
    } finally {
      await fixture.close();
    }
  });

  it('ordena la lista por actualización y recorta la actividad', async () => {
    const fixture = await createWorldsFixture();

    try {
      const first = fixture.service.create({ name: 'Primero' });
      const second = fixture.service.create({ name: 'Segundo' });

      expect(fixture.service.list().map((world) => world.id)).toEqual([
        second.id,
        first.id,
      ]);

      fixture.service.update({ id: first.id, name: 'Primero actualizado' });

      expect(fixture.service.list().map((world) => world.id)).toEqual([
        first.id,
        second.id,
      ]);
      expect(fixture.service.listActivity({ limit: 1 })).toHaveLength(1);
      expect(fixture.service.listActivity({ limit: 0 })).toHaveLength(1);
      expect(fixture.service.listActivity({ limit: 999 })).toHaveLength(3);
    } finally {
      await fixture.close();
    }
  });

  it('rechaza nombres, géneros, idiomas y textos fuera de rango', async () => {
    const fixture = await createWorldsFixture();

    try {
      expect(() => fixture.service.create({ name: '   ' })).toThrow(
        WorldInputError,
      );
      expect(() =>
        fixture.service.create({
          name: 'Géneros',
          genres: Array.from({ length: 9 }, (_, index) => `g${index}`),
        }),
      ).toThrow(WorldInputError);
      expect(() =>
        fixture.service.create({
          name: 'Idioma',
          language: 'fr' as unknown as 'es',
        }),
      ).toThrow(WorldInputError);
      expect(() =>
        fixture.service.create({
          name: 'Resumen',
          summary: 'a'.repeat(281),
        }),
      ).toThrow(WorldInputError);
      expect(() =>
        fixture.service.create({
          name: 'Descripción',
          description: plainTextToRichTextDocument('a'.repeat(4_001)),
        }),
      ).toThrow(WorldInputError);
    } finally {
      await fixture.close();
    }
  });

  it('revierte la escritura si falla el registro de actividad', async () => {
    const fixture = await createWorldsFixture();

    try {
      // Un trigger temporal hace fallar la actividad después de la escritura
      // del mundo; la transacción debe dejar la base como estaba.
      fixture.sqlite.exec(`
        CREATE TRIGGER fail_activity
        BEFORE INSERT ON activity_log
        BEGIN
          SELECT RAISE(ABORT, 'fallo de actividad');
        END;
      `);

      expect(() =>
        fixture.service.create({ name: 'No debe quedar' }),
      ).toThrow();
      expect(
        fixture.sqlite.prepare('SELECT count(*) AS total FROM worlds').get(),
      ).toEqual({ total: 0 });

      fixture.sqlite.exec('DROP TRIGGER fail_activity');

      const created = fixture.service.create({ name: 'Mundo consistente' });

      expect(created.name).toBe('Mundo consistente');

      fixture.sqlite.exec(`
        CREATE TRIGGER fail_activity
        BEFORE INSERT ON activity_log
        BEGIN
          SELECT RAISE(ABORT, 'fallo de actividad');
        END;
      `);

      expect(() =>
        fixture.service.update({
          id: created.id,
          name: created.name,
          summary: 'No debe quedar',
        }),
      ).toThrow();

      expect(fixture.service.get(created.id)?.summary).toBeNull();

      fixture.sqlite.exec('DROP TRIGGER fail_activity');
    } finally {
      await fixture.close();
    }
  });

  it('conserva los mundos y su actividad al cerrar y reabrir la base', async () => {
    const fixture = await createWorldsFixture();
    let reopened: SqliteDatabase | null = null;

    try {
      const created = fixture.service.create({
        name: 'Mundo persistente',
        summary: 'Sobrevive al cierre',
      });

      closeDatabase(fixture.sqlite);
      const startup = await initializeDatabase({
        userDataDir: fixture.test.userDataDir,
        migrationsDir: fixture.test.migrationsDir,
      });

      if (startup.status !== 'ready') {
        throw new Error('La base no se reabrió.');
      }

      reopened = startup.client.sqlite;

      const service = createWorldsService({
        database: startup.client.orm,
        sqlite: startup.client.sqlite,
      });
      const restored = service.get(created.id);

      expect(restored?.name).toBe('Mundo persistente');
      expect(restored?.summary).toBe('Sobrevive al cierre');
      expect(service.listActivity({ worldId: created.id })).toHaveLength(1);
    } finally {
      if (reopened !== null) {
        closeDatabase(reopened);
      } else {
        closeDatabase(fixture.sqlite);
      }

      await fixture.test.cleanup();
    }
  });

  it('valida los enlaces internos contra fichas vivas del mismo mundo', async () => {
    const fixture = await createWorldsFixture();

    try {
      const entityId = '01900000-0000-7000-8000-000000000901';
      const world = fixture.service.create({ name: 'Con enlaces' });

      expect(() =>
        fixture.service.create({
          name: 'Sin fichas',
          description: linkedDescription(entityId),
        }),
      ).toThrow(WorldInputError);

      seedEntity(fixture, world.id, entityId, 'Aria');

      const updated = fixture.service.update({
        id: world.id,
        name: world.name,
        description: linkedDescription(entityId),
      });

      expect(updated?.description).toEqual(linkedDescription(entityId));
      expect(
        collectEntityLinkIds(updated?.description as EntityRichTextDocument),
      ).toEqual([entityId]);

      const other = fixture.service.create({ name: 'Otro mundo' });
      const foreignId = '01900000-0000-7000-8000-000000000902';

      seedEntity(fixture, other.id, foreignId, 'Ajeno');

      expect(() =>
        fixture.service.update({
          id: world.id,
          name: world.name,
          description: linkedDescription(foreignId),
        }),
      ).toThrow(WorldInputError);

      fixture.sqlite
        .prepare('UPDATE entities SET deleted_at = ? WHERE id = ?')
        .run(BASE_TIME, entityId);

      expect(() =>
        fixture.service.update({
          id: world.id,
          name: world.name,
          description: linkedDescription(entityId),
        }),
      ).toThrow(WorldInputError);
    } finally {
      await fixture.close();
    }
  });

  it('degrada los enlaces al duplicar y conserva el texto y description_text', async () => {
    const fixture = await createWorldsFixture();

    try {
      const entityId = '01900000-0000-7000-8000-000000000903';
      const source = fixture.service.create({ name: 'Origen enlazado' });

      seedEntity(fixture, source.id, entityId, 'Aria');

      fixture.service.update({
        id: source.id,
        name: source.name,
        description: linkedDescription(entityId),
      });

      const copy = fixture.service.duplicate({
        id: source.id,
        name: 'Copia enlazada',
      });

      expect(
        extractEntityDescriptionText(
          copy?.description as EntityRichTextDocument,
        ),
      ).toBe('Visita a Aria.');
      expect(
        collectEntityLinkIds(copy?.description as EntityRichTextDocument),
      ).toEqual([]);

      const row = fixture.sqlite
        .prepare('SELECT description_text FROM worlds WHERE id = ?')
        .get(copy?.id) as { description_text: string };

      expect(row.description_text).toBe('Visita a Aria.');
    } finally {
      await fixture.close();
    }
  });

  it('conserva el texto al duplicar un documento heredado fuera de límite', async () => {
    const fixture = await createWorldsFixture();

    try {
      const source = fixture.service.create({ name: 'Heredado largo' });
      const text = 'a'.repeat(4_001);

      fixture.sqlite
        .prepare(
          'UPDATE worlds SET description = NULL, description_text = ? WHERE id = ?',
        )
        .run(text, source.id);

      const copy = fixture.service.duplicate({
        id: source.id,
        name: 'Copia heredada',
      });

      expect(copy?.description).not.toBeNull();
      expect(
        extractEntityDescriptionText(
          copy?.description as EntityRichTextDocument,
        ),
      ).toBe(text);
    } finally {
      await fixture.close();
    }
  });

  it('reconstruye el documento desde description_text si el JSON está corrupto', async () => {
    const fixture = await createWorldsFixture();

    try {
      const world = fixture.service.create({
        name: 'Recuperable',
        description: plainTextToRichTextDocument('Texto visible'),
      });

      fixture.sqlite
        .prepare('UPDATE worlds SET description = ? WHERE id = ?')
        .run('{ esto no es json', world.id);

      expect(fixture.service.get(world.id)?.description).toEqual(
        plainTextToRichTextDocument('Texto visible'),
      );
    } finally {
      await fixture.close();
    }
  });
});
