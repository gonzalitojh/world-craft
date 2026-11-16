/**
 * Triggers de integridad: ninguna fila puede mezclar entidades, etiquetas,
 * mapas o escenas de dos mundos distintos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeClient, first, getClient } from './helpers/client';
import {
  addWorldMember,
  createTestBook,
  createTestChapter,
  createTestEntity,
  createTestGamePack,
  createTestManuscript,
  createTestMap,
  createTestScene,
  createTestTag,
  createTestUser,
  createTestWorld,
  deleteTestUser,
  deleteTestWorld,
  getSystemEntityTypeId,
  getSystemRelationTypeId,
  type TestUser,
  type TestWorld,
} from './helpers/fixtures';
import { asUser, expectCheckViolation } from './helpers/session';

let owner: TestUser;
let editor: TestUser;
let worldA: TestWorld;
let worldB: TestWorld;
let typeB: string;
let entityA: string;
let entityB: string;
let tagB: string;
let mapA: string;
let sceneA: string;
let lockedTableA: string;

beforeAll(async () => {
  owner = await createTestUser('cross-owner');
  editor = await createTestUser('cross-editor');
  worldA = await createTestWorld(owner.id, { name: 'Mundo A' });
  worldB = await createTestWorld(owner.id, { name: 'Mundo B' });
  await addWorldMember(worldA.id, editor.id, 'editor');

  const sql = getClient();

  typeB = first(
    await sql<{ id: string }[]>`
      insert into public.entity_types (world_id, key, name)
      values (${worldB.id}::uuid, 'custom_b', 'Tipo de B')
      returning id
    `,
  ).id;

  entityA = (await createTestEntity(worldA.id, await getSystemEntityTypeId()))
    .id;
  entityB = (await createTestEntity(worldB.id, typeB)).id;
  tagB = (await createTestTag(worldB.id)).id;
  mapA = await createTestMap(worldA.id);

  const manuscriptA = await createTestManuscript(worldA.id);
  const bookA = await createTestBook(manuscriptA);
  const chapterA = await createTestChapter(bookA);
  sceneA = await createTestScene(chapterA);

  const packA = await createTestGamePack(worldA.id, owner.id);
  lockedTableA = first(
    await sql<{ id: string }[]>`
      insert into public.game_tables (
        world_id, pack_id, key, name, category, is_editable, created_by
      )
      values (
        ${worldA.id}::uuid, ${packA}::uuid, 'locked_cross',
        'Tabla bloqueada', 'custom', false, ${owner.id}::uuid
      )
      returning id
    `,
  ).id;
});

afterAll(async () => {
  await deleteTestWorld(worldA.id);
  await deleteTestWorld(worldB.id);
  await deleteTestUser(owner);
  await deleteTestUser(editor);
  await closeClient();
});

describe('integridad entre mundos', () => {
  it('el tipo de una ficha debe ser del sistema o del mismo mundo', async () => {
    await expectCheckViolation(() =>
      createTestEntity(worldA.id, typeB, { name: 'Ficha cruzada' }),
    );
  });

  it('los extremos de una relación deben ser del mismo mundo', async () => {
    const relationTypeId = await getSystemRelationTypeId('family');

    await expectCheckViolation(
      () =>
        getClient()`
          insert into public.relations (
            world_id, source_id, target_id, type_id
          )
          values (
            ${worldA.id}::uuid, ${entityA}::uuid, ${entityB}::uuid,
            ${relationTypeId}::uuid
          )
        `,
    );
  });

  it('la etiqueta debe pertenecer al mundo de la ficha', async () => {
    await expectCheckViolation(
      () =>
        getClient()`
          insert into public.entity_tags (entity_id, tag_id)
          values (${entityA}::uuid, ${tagB}::uuid)
        `,
    );
  });

  it('el enlace de mapa y entidad debe ser del mismo mundo', async () => {
    await expectCheckViolation(
      () =>
        getClient()`
          insert into public.map_entity_links (map_id, entity_id, feature_id)
          values (${mapA}::uuid, ${entityB}::uuid, 'feature-1')
        `,
    );
  });

  it('el POV de una escena debe ser del mundo del manuscrito', async () => {
    await expectCheckViolation(
      () =>
        getClient()`
          insert into public.scenes (chapter_id, title, pov_entity_id)
          select c.id, 'Escena cruzada', ${entityB}::uuid
          from public.chapters as c
          join public.books as b on b.id = c.book_id
          join public.manuscripts as m on m.id = b.manuscript_id
          where m.world_id = ${worldA.id}::uuid
          limit 1
        `,
    );
  });

  it('una fila no puede cambiar de mundo', async () => {
    await expectCheckViolation(
      () =>
        getClient()`
          update public.entities set world_id = ${worldB.id}::uuid
          where id = ${entityA}::uuid
        `,
    );
  });

  it('una tabla de juego no editable rechaza entradas de un cliente', async () => {
    await asUser(editor.id, async (tx) => {
      await expectCheckViolation(
        () => tx`
          insert into public.game_table_entries (table_id, text)
          values (${lockedTableA}::uuid, 'Entrada cruzada')
        `,
      );
    });
  });

  it('la escena creada sigue existiendo sin POV cruzado', async () => {
    const rows = await getClient()<{ count: number }[]>`
      select count(*)::int as count from public.scenes
      where id = ${sceneA}::uuid and pov_entity_id is null
    `;

    expect(first(rows).count).toBe(1);
  });
});
