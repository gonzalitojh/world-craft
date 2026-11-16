/**
 * RLS del contenido: taxonomías, fichas, relaciones, etiquetas, assets, mapas y
 * manuscritos. Incluye el borrado lógico y la visibilidad de la papelera.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeClient, first, getClient } from './helpers/client';
import {
  addWorldMember,
  createTestAsset,
  createTestBook,
  createTestChapter,
  createTestEntity,
  createTestManuscript,
  createTestMap,
  createTestRelation,
  createTestScene,
  createTestTag,
  createTestUser,
  createTestWorld,
  deleteTestUser,
  deleteTestWorld,
  getSystemEntityTypeId,
  getSystemRelationTypeId,
  linkEntityTag,
  type TestUser,
  type TestWorld,
} from './helpers/fixtures';
import { asUser, expectPermissionDenied } from './helpers/session';

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let world: TestWorld;
let typeId: string;
let entityId: string;
let targetEntityId: string;
let tagId: string;
let manuscriptId: string;
let bookId: string;
let chapterId: string;
let sceneId: string;
let assetId: string;

beforeAll(async () => {
  owner = await createTestUser('content-owner');
  editor = await createTestUser('content-editor');
  viewer = await createTestUser('content-viewer');
  outsider = await createTestUser('content-outsider');
  world = await createTestWorld(owner.id);
  await addWorldMember(world.id, editor.id, 'editor');
  await addWorldMember(world.id, viewer.id, 'viewer');

  typeId = await getSystemEntityTypeId('character');
  entityId = (await createTestEntity(world.id, typeId, { name: 'Heroína' })).id;
  targetEntityId = (
    await createTestEntity(world.id, typeId, { name: 'Aliado' })
  ).id;
  tagId = (await createTestTag(world.id)).id;
  await linkEntityTag(entityId, tagId);

  const relationTypeId = await getSystemRelationTypeId('family');
  await createTestRelation(world.id, entityId, targetEntityId, relationTypeId);

  await createTestMap(world.id);
  assetId = (await createTestAsset(world.id, owner.id)).id;

  manuscriptId = await createTestManuscript(world.id);
  bookId = await createTestBook(manuscriptId);
  chapterId = await createTestChapter(bookId);
  sceneId = await createTestScene(chapterId);
});

afterAll(async () => {
  await deleteTestWorld(world.id);
  await deleteTestUser(owner);
  await deleteTestUser(editor);
  await deleteTestUser(viewer);
  await deleteTestUser(outsider);
  await closeClient();
});

describe('lectura de contenido', () => {
  it('owner, editor y viewer leen fichas, relaciones, mapas y manuscritos', async () => {
    for (const user of [owner, editor, viewer]) {
      await asUser(user.id, async (tx) => {
        const entities = await tx<{ count: number }[]>`
          select count(*)::int as count from public.entities
        `;
        const relations = await tx<{ count: number }[]>`
          select count(*)::int as count from public.relations
        `;
        const maps = await tx<{ count: number }[]>`
          select count(*)::int as count from public.maps
        `;
        const scenes = await tx<{ count: number }[]>`
          select count(*)::int as count from public.scenes
        `;

        expect(first(entities).count).toBe(2);
        expect(first(relations).count).toBe(1);
        expect(first(maps).count).toBe(1);
        expect(first(scenes).count).toBe(1);
      });
    }
  });

  it('la jerarquía de escritura resuelve el mundo del padre', async () => {
    await asUser(viewer.id, async (tx) => {
      const books = await tx<{ count: number }[]>`
        select count(*)::int as count from public.books
      `;
      const chapters = await tx<{ count: number }[]>`
        select count(*)::int as count from public.chapters
      `;
      const manuscripts = await tx<{ count: number }[]>`
        select count(*)::int as count from public.manuscripts
      `;

      expect(first(books).count).toBe(1);
      expect(first(chapters).count).toBe(1);
      expect(first(manuscripts).count).toBe(1);
    });
  });

  it('un usuario ajeno no ve contenido del mundo', async () => {
    await asUser(outsider.id, async (tx) => {
      for (const table of [
        'entities',
        'relations',
        'tags',
        'entity_tags',
        'assets',
        'maps',
        'manuscripts',
        'books',
        'chapters',
        'scenes',
      ]) {
        const rows = await tx.unsafe<{ count: number }[]>(
          `select count(*)::int as count from public.${table}`,
        );

        expect(first(rows).count, table).toBe(0);
      }
    });
  });
});

describe('escritura de contenido', () => {
  it('un viewer no puede crear fichas', async () => {
    await asUser(viewer.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.entities (world_id, type_id, name, slug)
          values (
            ${world.id}::uuid, ${typeId}::uuid, 'Intrusa', 'intrusa'
          )
        `,
      );
    });
  });

  it('un editor crea y actualiza fichas', async () => {
    await asUser(editor.id, async (tx) => {
      const inserted = await tx<{ id: string }[]>`
        insert into public.entities (world_id, type_id, name, slug)
        values (
          ${world.id}::uuid, ${typeId}::uuid, 'Ficha nueva', 'ficha-nueva'
        )
        returning id
      `;
      const updated = await tx`
        update public.entities set summary = 'Resumen'
        where id = ${first(inserted).id}::uuid
        returning id
      `;

      expect(updated).toHaveLength(1);
    });
  });

  it('un viewer no puede actualizar fichas', async () => {
    await asUser(viewer.id, async (tx) => {
      const rows = await tx`
        update public.entities set summary = 'Intento'
        where id = ${entityId}::uuid
        returning id
      `;

      expect(rows).toHaveLength(0);
    });
  });

  it('el borrado lógico oculta la ficha al viewer y la mantiene para el editor', async () => {
    const sql = getClient();
    const deleted = await createTestEntity(world.id, typeId, {
      name: 'Ficha en papelera',
    });

    await sql`
      update public.entities set deleted_at = now()
      where id = ${deleted.id}::uuid
    `;

    await asUser(viewer.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.entities
        where id = ${deleted.id}::uuid
      `;
      expect(first(rows).count).toBe(0);
    });

    await asUser(editor.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.entities
        where id = ${deleted.id}::uuid
      `;
      expect(first(rows).count).toBe(1);
    });

    await sql`delete from public.entities where id = ${deleted.id}::uuid`;
  });

  it('el borrado lógico de un mapa se comporta igual', async () => {
    const sql = getClient();
    const map = await createTestMap(world.id, 'Mapa en papelera');
    await sql`update public.maps set deleted_at = now() where id = ${map}::uuid`;

    await asUser(viewer.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.maps where id = ${map}::uuid
      `;
      expect(first(rows).count).toBe(0);
    });

    await asUser(editor.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.maps where id = ${map}::uuid
      `;
      expect(first(rows).count).toBe(1);
    });
  });
});

describe('etiquetas', () => {
  it('el viewer ve entity_tags y no puede crear', async () => {
    await asUser(viewer.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.entity_tags
      `;
      expect(first(rows).count).toBe(1);

      await expectPermissionDenied(
        () => tx`
          insert into public.entity_tags (entity_id, tag_id)
          values (${targetEntityId}::uuid, ${tagId}::uuid)
        `,
      );
    });
  });

  it('un editor etiqueta fichas', async () => {
    await asUser(editor.id, async (tx) => {
      const rows = await tx`
        insert into public.entity_tags (entity_id, tag_id)
        values (${targetEntityId}::uuid, ${tagId}::uuid)
        returning entity_id
      `;
      expect(rows).toHaveLength(1);
    });
  });

  it('entity_tags no se puede actualizar desde el cliente', async () => {
    await asUser(editor.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          update public.entity_tags set created_at = now()
          where entity_id = ${entityId}::uuid
        `,
      );
    });
  });
});

describe('assets', () => {
  it('el viewer ve los metadatos pero no los crea', async () => {
    await asUser(viewer.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.assets
        where id = ${assetId}::uuid
      `;
      expect(first(rows).count).toBe(1);

      await expectPermissionDenied(
        () => tx`
          insert into public.assets (
            world_id, uploader_id, bucket, path, mime, size
          )
          values (
            ${world.id}::uuid, ${viewer.id}::uuid, 'world-craft-assets',
            ${`world/${world.id}/00000000-0000-4000-8000-000000000000.png`},
            'image/png', 10
          )
        `,
      );
    });
  });

  it('un editor solo edita alt y no puede suplantar al cargador', async () => {
    await asUser(editor.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.assets (
            world_id, uploader_id, bucket, path, mime, size
          )
          values (
            ${world.id}::uuid, ${owner.id}::uuid, 'world-craft-assets',
            ${`world/${world.id}/11111111-1111-4111-8111-111111111111.png`},
            'image/png', 10
          )
        `,
      );

      const updated = await tx`
        update public.assets set alt = 'Descripción'
        where id = ${assetId}::uuid
        returning id
      `;
      expect(updated).toHaveLength(1);

      await expectPermissionDenied(
        () => tx`
          update public.assets
          set path = ${`world/${world.id}/22222222-2222-4222-8222-222222222222.png`}
          where id = ${assetId}::uuid
        `,
      );
    });
  });
});

describe('versiones de escena', () => {
  it('un editor crea una versión y el viewer no la ve', async () => {
    const sql = getClient();
    const versionId = first(
      await sql<{ id: string }[]>`
        insert into public.scene_versions (scene_id, content_text, created_by)
        values (${sceneId}::uuid, 'Borrador', ${owner.id}::uuid)
        returning id
      `,
    ).id;

    await asUser(editor.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.scene_versions
        where id = ${versionId}::uuid
      `;
      expect(first(rows).count).toBe(1);
    });

    await asUser(viewer.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.scene_versions
      `;
      expect(first(rows).count).toBe(0);

      await expectPermissionDenied(
        () => tx`
          insert into public.scene_versions (scene_id, content_text, created_by)
          values (${sceneId}::uuid, 'Intento', ${viewer.id}::uuid)
        `,
      );
    });
  });
});
