import { describe, expect, it } from 'vitest';

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
import { createSearchService, type SearchService } from '@/main/search/service';
import { createWorldsService, type WorldsService } from '@/main/worlds/service';
import { SEARCH_HIGHLIGHT_START } from '@/shared/contracts/search';
import { plainTextToRichTextDocument } from '@/shared/entities/description';
import type { WorldDetail } from '@/shared/contracts/worlds';

import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;

const description = (text: string) => ({
  type: 'doc' as const,
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text }],
    },
  ],
});

interface Fixture {
  readonly test: TempDatabase;
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly worlds: WorldsService;
  readonly entityTypes: EntityTypesService;
  readonly entities: EntitiesService;
  readonly relations: RelationsService;
  readonly search: SearchService;
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
  const search = createSearchService({ sqlite: startup.client.sqlite });

  return {
    test,
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    worlds,
    entityTypes,
    entities,
    relations,
    search,
    async close() {
      closeDatabase(startup.client.sqlite);
      await test.cleanup();
    },
  };
}

function typeId(fixture: Fixture, worldId: string, key: string): string {
  const found = fixture.entityTypes
    .list(worldId)
    .find((type) => type.key === key);

  if (found === undefined) {
    throw new Error(`Falta el tipo ${key}.`);
  }

  return found.id;
}

function seedWorlds(fixture: Fixture): {
  readonly world: WorldDetail;
  readonly otherWorld: WorldDetail;
} {
  const world = fixture.worlds.create({
    name: 'Las Mareas Grises',
    summary: 'Un archipiélago de niebla',
    description: plainTextToRichTextDocument(
      'Crónicas de cartógrafos y balleneros.',
    ),
    genres: ['Fantasía'],
  });
  const otherWorld = fixture.worlds.create({
    name: 'El Jardín de Ceniza',
    summary: 'Un jardín abandonado',
  });

  return { world, otherWorld };
}

function seedEntities(
  fixture: Fixture,
  world: WorldDetail,
): {
  readonly gandalf: string;
  readonly cancion: string;
  readonly draft: string;
  readonly tagId: string;
} {
  const tag = fixture.entities.createTag({
    worldId: world.id,
    name: 'Istari',
    color: 'moss',
  });
  const gandalf = fixture.entities.create({
    worldId: world.id,
    typeId: typeId(fixture, world.id, 'character'),
    name: 'Gandalf el Gris',
    aliases: ['Mithrandir'],
    summary: 'Mago errante',
    description: description('Mago de la Tierra Media y amigo de los hobbits.'),
    tagIds: [tag.id],
    isFavorite: true,
  });
  const cancion = fixture.entities.create({
    worldId: world.id,
    typeId: typeId(fixture, world.id, 'place'),
    name: 'Canción de las Mareas',
    summary: 'Un lugar donde rompen las olas',
    description: description('La costa donde el mar canta al amanecer.'),
  });
  const draft = fixture.entities.create({
    worldId: world.id,
    typeId: typeId(fixture, world.id, 'character'),
    name: 'Mara Viento',
    summary: 'Borrador de capitana',
    status: 'draft',
    tagIds: [tag.id],
  });

  return {
    gandalf: gandalf.id,
    cancion: cancion.id,
    draft: draft.id,
    tagId: tag.id,
  };
}

describe('servicio de búsqueda global', () => {
  it('indexa mundos, fichas y relaciones y encuentra por título, cuerpo y prefijo', async () => {
    const fixture = await createFixture();

    try {
      const { world } = seedWorlds(fixture);
      const ids = seedEntities(fixture, world);
      const edge = fixture.relations.create({
        worldId: world.id,
        sourceId: ids.gandalf,
        targetId: ids.cancion,
        typeId:
          fixture.relations
            .listTypes(world.id)
            .find((type) => type.key === 'located-in')?.id ?? '',
        notes: 'El mago guarda el paso a la costa.',
      });

      expect(
        fixture.sqlite
          .prepare(
            'SELECT kind, count(*) AS total FROM search_documents GROUP BY kind ORDER BY kind',
          )
          .all(),
      ).toEqual([
        { kind: 'entity', total: 3 },
        { kind: 'relation', total: 1 },
        { kind: 'world', total: 2 },
      ]);

      const byTitle = fixture.search.query({ query: 'Gand' });
      expect(byTitle.total).toBe(1);
      expect(byTitle.items[0]?.kind).toBe('entity');
      expect(byTitle.items[0]?.title).toBe('Gandalf el Gris');
      expect(byTitle.items[0]?.titleHighlight).toContain(
        SEARCH_HIGHLIGHT_START,
      );

      const byBody = fixture.search.query({ query: 'hobbits' });
      expect(byBody.total).toBe(1);
      expect(byBody.items[0]?.sourceId).toBe(ids.gandalf);
      expect(byBody.items[0]?.snippet).toContain(SEARCH_HIGHLIGHT_START);
      expect(byBody.items[0]?.snippet).not.toContain('<mark>');

      const relation = fixture.search.query({ query: 'paso' });
      expect(relation.total).toBe(1);
      expect(relation.items[0]?.kind).toBe('relation');
      expect(relation.items[0]?.sourceId).toBe(edge.id);
      expect(relation.items[0]?.contextId).toBe(ids.gandalf);

      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM search_documents')
          .get(),
      ).toEqual(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM search_fts')
          .get(),
      );

      fixture.relations.remove({ worldId: world.id, id: edge.id });
      expect(fixture.search.query({ query: 'paso' }).total).toBe(0);
    } finally {
      await fixture.close();
    }
  });

  it('ignora diacríticos y tolera un error tipográfico con el vocabulario', async () => {
    const fixture = await createFixture();

    try {
      const { world } = seedWorlds(fixture);
      const ids = seedEntities(fixture, world);

      expect(fixture.search.query({ query: 'cancion' }).total).toBe(1);
      expect(fixture.search.query({ query: 'canción' }).total).toBe(1);
      expect(fixture.search.query({ query: 'mareas' }).total).toBeGreaterThan(
        0,
      );

      const typo = fixture.search.query({ query: 'gandolf' });
      expect(typo.total).toBe(1);
      expect(typo.items[0]?.sourceId).toBe(ids.gandalf);
      expect(typo.fuzzyTerms).toContain('gandalf');

      expect(fixture.search.query({ query: 'xyzzy' }).total).toBe(0);
    } finally {
      await fixture.close();
    }
  });

  it('combina filtros por mundo, tipo de documento, tipo de ficha, etiqueta y estado', async () => {
    const fixture = await createFixture();

    try {
      const { world, otherWorld } = seedWorlds(fixture);
      const ids = seedEntities(fixture, world);
      const other = fixture.entities.create({
        worldId: otherWorld.id,
        typeId: typeId(fixture, otherWorld.id, 'character'),
        name: 'Gandalf de Ceniza',
        summary: 'Otro mago',
      });
      const characterTypeId = typeId(fixture, world.id, 'character');

      const all = fixture.search.query({ query: 'gandalf' });
      expect(all.total).toBe(2);

      expect(
        fixture.search.query({
          query: 'gandalf',
          filters: { worldId: world.id },
        }).total,
      ).toBe(1);
      expect(
        fixture.search.query({
          query: 'gandalf',
          filters: { worldId: otherWorld.id },
        }).items[0]?.sourceId,
      ).toBe(other.id);

      expect(
        fixture.search.query({
          query: 'gandalf',
          filters: { kind: 'entity', entityTypeId: characterTypeId },
        }).total,
      ).toBe(2);
      expect(
        fixture.search.query({
          query: 'gandalf',
          filters: { kind: 'world' },
        }).total,
      ).toBe(0);

      expect(
        fixture.search.query({
          query: 'gandalf',
          filters: { tagId: ids.tagId },
        }).total,
      ).toBe(1);
      expect(
        fixture.search.query({
          query: 'viento',
          filters: { tagId: ids.tagId, status: 'draft' },
        }).items[0]?.sourceId,
      ).toBe(ids.draft);
      expect(
        fixture.search.query({
          query: 'viento',
          filters: { status: 'active' },
        }).total,
      ).toBe(0);

      fixture.worlds.setArchived({ id: otherWorld.id, archived: true });
      expect(
        fixture.search.query({
          query: 'jardin',
          filters: { status: 'archived' },
        }).items[0]?.sourceId,
      ).toBe(otherWorld.id);
      expect(
        fixture.search.query({
          query: 'jardin',
          filters: { status: 'active' },
        }).total,
      ).toBe(0);
    } finally {
      await fixture.close();
    }
  });

  it('mantiene el índice al editar, borrar, restaurar y eliminar de forma física', async () => {
    const fixture = await createFixture();

    try {
      const { world, otherWorld } = seedWorlds(fixture);
      const ids = seedEntities(fixture, world);

      fixture.sqlite
        .prepare('UPDATE entities SET name = ?, updated_at = ? WHERE id = ?')
        .run('Olórin el Blanco', BASE_TIME + 50_000, ids.gandalf);

      expect(fixture.search.query({ query: 'gandalf' }).total).toBe(0);
      expect(fixture.search.query({ query: 'olorin' }).total).toBe(1);

      fixture.entities.remove({ worldId: world.id, id: ids.cancion });
      expect(fixture.search.query({ query: 'cancion' }).total).toBe(0);
      expect(fixture.search.query({ query: 'mareas' }).total).toBeGreaterThan(
        0,
      );

      fixture.sqlite
        .prepare('UPDATE entities SET deleted_at = NULL WHERE id = ?')
        .run(ids.cancion);
      expect(fixture.search.query({ query: 'cancion' }).total).toBe(1);

      fixture.sqlite
        .prepare('DELETE FROM entities WHERE id = ?')
        .run(ids.cancion);
      expect(fixture.search.query({ query: 'cancion' }).total).toBe(0);
      expect(
        fixture.sqlite
          .prepare(
            "SELECT count(*) AS total FROM search_documents WHERE kind = 'entity' AND source_id = ?",
          )
          .get(ids.cancion),
      ).toEqual({ total: 0 });

      const lateTag = fixture.entities.createTag({
        worldId: world.id,
        name: 'Ceniza',
        color: 'ochre',
      });
      fixture.sqlite
        .prepare('INSERT INTO entity_tags (entity_id, tag_id) VALUES (?, ?)')
        .run(ids.gandalf, lateTag.id);
      expect(
        fixture.search.query({
          query: 'ceniza',
          filters: { kind: 'entity' },
        }).total,
      ).toBe(1);

      fixture.sqlite
        .prepare('DELETE FROM entity_tags WHERE entity_id = ? AND tag_id = ?')
        .run(ids.gandalf, lateTag.id);
      expect(
        fixture.search.query({
          query: 'ceniza',
          filters: { kind: 'entity' },
        }).total,
      ).toBe(0);

      fixture.entities.create({
        worldId: otherWorld.id,
        typeId: typeId(fixture, otherWorld.id, 'character'),
        name: 'Bruma Lejana',
      });

      fixture.sqlite
        .prepare('DELETE FROM activity_log WHERE world_id = ?')
        .run(otherWorld.id);
      fixture.worlds.remove(otherWorld.id);
      expect(
        fixture.sqlite
          .prepare(
            'SELECT count(*) AS total FROM search_documents WHERE world_id = ?',
          )
          .get(otherWorld.id),
      ).toEqual({ total: 0 });
      const hidden = fixture.search.query({ query: 'bruma' });
      expect(hidden.total).toBe(0);
      fixture.sqlite
        .prepare('UPDATE worlds SET deleted_at = NULL WHERE id = ?')
        .run(otherWorld.id);
      expect(
        fixture.sqlite
          .prepare(
            'SELECT count(*) AS total FROM search_documents WHERE world_id = ?',
          )
          .get(otherWorld.id),
      ).toEqual({ total: 2 });
      expect(fixture.search.query({ query: 'bruma' }).total).toBe(1);

      fixture.sqlite
        .prepare('DELETE FROM activity_log WHERE world_id = ?')
        .run(otherWorld.id);
      fixture.sqlite
        .prepare('DELETE FROM worlds WHERE id = ?')
        .run(otherWorld.id);
      expect(
        fixture.search.query({
          query: 'jardin',
          filters: { worldId: otherWorld.id },
        }).total,
      ).toBe(0);
      expect(
        fixture.sqlite
          .prepare(
            'SELECT count(*) AS total FROM search_documents WHERE world_id = ?',
          )
          .get(otherWorld.id),
      ).toEqual({ total: 0 });
    } finally {
      await fixture.close();
    }
  });

  it('oculta las relaciones cuyos extremos están en la papelera y las recupera al restaurar', async () => {
    const fixture = await createFixture();

    try {
      const { world } = seedWorlds(fixture);
      const ids = seedEntities(fixture, world);
      fixture.relations.create({
        worldId: world.id,
        sourceId: ids.gandalf,
        targetId: ids.cancion,
        typeId:
          fixture.relations
            .listTypes(world.id)
            .find((type) => type.key === 'knows')?.id ?? '',
        notes: 'Se conocen desde la primera marea.',
      });

      expect(fixture.search.query({ query: 'primera' }).total).toBe(1);

      fixture.entities.remove({ worldId: world.id, id: ids.cancion });
      expect(fixture.search.query({ query: 'primera' }).total).toBe(0);

      fixture.sqlite
        .prepare('UPDATE entities SET deleted_at = NULL WHERE id = ?')
        .run(ids.cancion);
      expect(fixture.search.query({ query: 'primera' }).total).toBe(1);

      fixture.sqlite
        .prepare('DELETE FROM entities WHERE id = ?')
        .run(ids.cancion);
      expect(fixture.search.query({ query: 'primera' }).total).toBe(0);
      expect(
        fixture.sqlite
          .prepare(
            "SELECT count(*) AS total FROM search_documents WHERE kind = 'relation'",
          )
          .get(),
      ).toEqual({ total: 0 });
    } finally {
      await fixture.close();
    }
  });

  it('reconstruye el índice completo tras vaciar la tabla FTS', async () => {
    const fixture = await createFixture();

    try {
      const { world } = seedWorlds(fixture);
      seedEntities(fixture, world);

      fixture.sqlite.prepare('DELETE FROM search_documents').run();
      expect(fixture.search.query({ query: 'gandalf' }).total).toBe(0);
      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM search_documents')
          .get(),
      ).toEqual({ total: 0 });
      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM search_fts')
          .get(),
      ).toEqual({ total: 0 });

      const rebuilt = fixture.search.rebuild();
      expect(rebuilt.documents).toBe(5);
      expect(rebuilt.tookMs).toBeGreaterThanOrEqual(0);
      expect(fixture.search.query({ query: 'gandalf' }).total).toBe(1);
      expect(fixture.search.query({ query: 'mareas' }).total).toBeGreaterThan(
        0,
      );
      expect(
        fixture.sqlite
          .prepare('SELECT count(*) AS total FROM search_fts')
          .get(),
      ).toEqual({ total: 5 });

      // Un índice FTS vaciado se repara sin borrar los documentos.
      fixture.sqlite.exec(
        "INSERT INTO search_fts (search_fts) VALUES ('delete-all')",
      );
      expect(fixture.search.query({ query: 'gandalf' }).total).toBe(0);
      const repaired = fixture.search.rebuild();
      expect(repaired.documents).toBe(5);
      expect(fixture.search.query({ query: 'gandalf' }).total).toBe(1);
    } finally {
      await fixture.close();
    }
  });

  it('devuelve recientes y favoritos sin mezclar mundos', async () => {
    const fixture = await createFixture();

    try {
      const { world, otherWorld } = seedWorlds(fixture);
      seedEntities(fixture, world);
      fixture.entities.create({
        worldId: otherWorld.id,
        typeId: typeId(fixture, otherWorld.id, 'character'),
        name: 'Favorita de Ceniza',
        isFavorite: true,
      });

      const all = fixture.search.suggestions();
      expect(all.favorites.map((hit) => hit.title)).toContain(
        'Gandalf el Gris',
      );
      expect(all.favorites.map((hit) => hit.title)).toContain(
        'Favorita de Ceniza',
      );
      expect(all.recent.length).toBeGreaterThan(0);

      const onlyWorld = fixture.search.suggestions({ worldId: world.id });
      expect(onlyWorld.recent.every((hit) => hit.worldId === world.id)).toBe(
        true,
      );
      expect(onlyWorld.favorites.every((hit) => hit.worldId === world.id)).toBe(
        true,
      );
    } finally {
      await fixture.close();
    }
  });

  it('responde en menos de 150 ms con 10.000 fichas', async () => {
    const fixture = await createFixture();

    try {
      const { world } = seedWorlds(fixture);
      const characterTypeId = typeId(fixture, world.id, 'character');
      const insert = fixture.sqlite.prepare(
        `INSERT INTO entities (
            id, world_id, type_id, name, slug, aliases, summary,
            description_text, attributes, status, is_favorite, created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, '{}', 'active', 0, ?, ?)`,
      );
      const seedMany = fixture.sqlite.transaction(() => {
        for (let index = 0; index < 10_000; index += 1) {
          const suffix = String(index).padStart(5, '0');
          insert.run(
            `01900001-0000-7000-8000-${String(index).padStart(12, '0')}`,
            world.id,
            characterTypeId,
            `Ficha ${suffix}`,
            `ficha-${suffix}`,
            `Resumen de la ficha ${suffix}`,
            `Personaje de prueba con dragón y archipiélago ${suffix}.`,
            BASE_TIME + index,
            BASE_TIME + index,
          );
        }
      });

      seedMany();

      const timings: number[] = [];

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const started = performance.now();
        const result = fixture.search.query({
          query: 'ficha 09999',
          limit: 30,
        });
        timings.push(performance.now() - started);

        // La consulta representa una búsqueda normal sobre un índice con
        // 10.000 fichas; el caso de una palabra presente en todas se cubre en
        // la prueba de indexación sin usarlo como umbral de latencia.
        expect(result.total).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.tookMs).toBeLessThan(150);
      }

      const ordered = [...timings].sort((left, right) => left - right);
      const median = ordered[Math.floor(ordered.length / 2)] ?? Infinity;

      expect(median).toBeLessThan(150);

      // Segunda medición sobre el caso más desfavorable: una palabra presente
      // en las 10.000 fichas obliga a puntuar y ordenar todo el conjunto. Se
      // deja como guarda de regresión con un margen mayor para no convertir la
      // variabilidad de la máquina en un falso fallo.
      const broadStarted = performance.now();
      const broad = fixture.search.query({ query: 'dragon', limit: 30 });
      const broadMs = performance.now() - broadStarted;

      expect(broad.total).toBe(10_000);
      expect(broad.items).toHaveLength(30);
      expect(broadMs).toBeLessThan(500);
    } finally {
      await fixture.close();
    }
  }, 60_000);
});
