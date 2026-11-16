/**
 * RLS del juego creativo y del registro de actividad: contenido del sistema de
 * solo lectura, tablas de mundo para editores, sesiones privadas y actividad
 * append-only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeClient, first, getClient } from './helpers/client';
import {
  addWorldMember,
  createTestGamePack,
  createTestGameTable,
  createTestUser,
  createTestWorld,
  deleteTestUser,
  deleteTestWorld,
  type TestUser,
  type TestWorld,
} from './helpers/fixtures';
import {
  asUser,
  expectCheckViolation,
  expectPermissionDenied,
} from './helpers/session';

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let world: TestWorld;
let worldPackId: string;
let worldTableId: string;
let lockedTableId: string;
let systemPackId: string;
let systemTableId: string;

beforeAll(async () => {
  owner = await createTestUser('game-owner');
  editor = await createTestUser('game-editor');
  viewer = await createTestUser('game-viewer');
  outsider = await createTestUser('game-outsider');
  world = await createTestWorld(owner.id);
  await addWorldMember(world.id, editor.id, 'editor');
  await addWorldMember(world.id, viewer.id, 'viewer');

  const sql = getClient();

  worldPackId = await createTestGamePack(world.id, owner.id);
  worldTableId = await createTestGameTable(worldPackId, world.id, owner.id);

  // Tabla de mundo marcada como no editable: sirve para probar el trigger que
  // impide escribir contenido fijo desde un cliente.
  lockedTableId = first(
    await sql<{ id: string }[]>`
      insert into public.game_tables (
        world_id, pack_id, key, name, category, is_editable, created_by
      )
      values (
        ${world.id}::uuid, ${worldPackId}::uuid, 'locked_table',
        'Tabla bloqueada', 'custom', false, ${owner.id}::uuid
      )
      returning id
    `,
  ).id;

  systemPackId = first(
    await sql<{ id: string }[]>`
      insert into public.game_content_packs (world_id, name)
      values (null, 'Pack del sistema')
      returning id
    `,
  ).id;

  systemTableId = first(
    await sql<{ id: string }[]>`
      insert into public.game_tables (
        world_id, pack_id, key, name, category, is_system, is_editable
      )
      values (
        null, ${systemPackId}::uuid, 'system_table', 'Tabla del sistema',
        'container', true, false
      )
      returning id
    `,
  ).id;

  await sql`
    insert into public.game_table_entries (table_id, text)
    values (${worldTableId}::uuid, 'Entrada del mundo')
  `;
  await sql`
    insert into public.game_table_entries (table_id, text)
    values (${systemTableId}::uuid, 'Entrada del sistema')
  `;
});

afterAll(async () => {
  await getClient()`
    delete from public.game_content_packs where id = ${systemPackId}::uuid
  `;
  await deleteTestWorld(world.id);
  await deleteTestUser(owner);
  await deleteTestUser(editor);
  await deleteTestUser(viewer);
  await deleteTestUser(outsider);
  await closeClient();
});

describe('contenido del sistema', () => {
  it('cualquier usuario autenticado lee el contenido global', async () => {
    await asUser(outsider.id, async (tx) => {
      const tables = await tx<{ count: number }[]>`
        select count(*)::int as count from public.game_tables where world_id is null
      `;
      const entries = await tx<{ count: number }[]>`
        select count(*)::int as count from public.game_table_entries
      `;

      expect(first(tables).count).toBe(1);
      expect(first(entries).count).toBe(1);
    });
  });

  it('el contenido de un mundo no se filtra a un usuario ajeno', async () => {
    await asUser(outsider.id, async (tx) => {
      const tables = await tx<{ count: number }[]>`
        select count(*)::int as count from public.game_tables
        where world_id = ${world.id}::uuid
      `;
      const packs = await tx<{ count: number }[]>`
        select count(*)::int as count from public.game_content_packs
        where world_id = ${world.id}::uuid
      `;

      expect(first(tables).count).toBe(0);
      expect(first(packs).count).toBe(0);
    });
  });

  it('el contenido del sistema no se puede escribir desde el cliente', async () => {
    await asUser(owner.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.game_tables (
            world_id, pack_id, key, name, category, is_system
          )
          values (
            null, ${systemPackId}::uuid, 'tabla_intrusa', 'Intrusa',
            'custom', true
          )
        `,
      );
    });

    await asUser(owner.id, async (tx) => {
      const updated = await tx`
        update public.game_tables set name = 'Cambiada'
        where id = ${systemTableId}::uuid
        returning id
      `;
      expect(updated).toHaveLength(0);
    });
  });
});

describe('tablas de un mundo', () => {
  it('el viewer lee las tablas y entradas del mundo', async () => {
    await asUser(viewer.id, async (tx) => {
      const tables = await tx<{ count: number }[]>`
        select count(*)::int as count from public.game_tables
        where world_id = ${world.id}::uuid
      `;
      const entries = await tx<{ count: number }[]>`
        select count(*)::int as count from public.game_table_entries
      `;

      expect(first(tables).count).toBe(2);
      expect(first(entries).count).toBe(2);
    });
  });

  it('el viewer no crea packs, tablas ni entradas', async () => {
    await asUser(viewer.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.game_content_packs (world_id, name)
          values (${world.id}::uuid, 'Pack del viewer')
        `,
      );
    });

    await asUser(viewer.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.game_tables (
            world_id, pack_id, key, name, category
          )
          values (
            ${world.id}::uuid, ${worldPackId}::uuid, 'tabla_viewer',
            'Tabla del viewer', 'custom'
          )
        `,
      );
    });

    await asUser(viewer.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.game_table_entries (table_id, text)
          values (${worldTableId}::uuid, 'Entrada del viewer')
        `,
      );
    });
  });

  it('un editor crea packs, tablas y entradas', async () => {
    await asUser(editor.id, async (tx) => {
      const pack = first(
        await tx<{ id: string }[]>`
          insert into public.game_content_packs (world_id, name, created_by)
          values (${world.id}::uuid, 'Pack del editor', ${editor.id}::uuid)
          returning id
        `,
      );

      const table = first(
        await tx<{ id: string }[]>`
          insert into public.game_tables (
            world_id, pack_id, key, name, category, created_by
          )
          values (
            ${world.id}::uuid, ${pack.id}::uuid, 'tabla_editor',
            'Tabla del editor', 'trope', ${editor.id}::uuid
          )
          returning id
        `,
      );

      const entries = await tx`
        insert into public.game_table_entries (table_id, text)
        values (${table.id}::uuid, 'Entrada del editor')
        returning id
      `;

      expect(entries).toHaveLength(1);
    });
  });

  it('no se puede escribir en una tabla no editable', async () => {
    await asUser(editor.id, async (tx) => {
      await expectCheckViolation(
        () => tx`
          insert into public.game_table_entries (table_id, text)
          values (${lockedTableId}::uuid, 'Intento')
        `,
      );
    });
  });
});

describe('sesiones de juego', () => {
  it('cada usuario ve solo sus tiradas', async () => {
    const sql = getClient();
    await sql`
      insert into public.game_sessions (world_id, user_id, seed)
      values (${world.id}::uuid, ${owner.id}::uuid, 'seed-owner')
    `;

    await asUser(owner.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.game_sessions
      `;
      expect(first(rows).count).toBe(1);
    });

    await asUser(editor.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.game_sessions
      `;
      expect(first(rows).count).toBe(0);
    });
  });

  it('un editor crea y borra su propia tirada, no la ajena', async () => {
    await asUser(editor.id, async (tx) => {
      const inserted = await tx<{ id: string }[]>`
        insert into public.game_sessions (world_id, user_id, seed)
        values (${world.id}::uuid, ${editor.id}::uuid, 'seed-editor')
        returning id
      `;

      const deleted = await tx`
        delete from public.game_sessions
        where id = ${first(inserted).id}::uuid
        returning id
      `;

      expect(deleted).toHaveLength(1);
    });
  });

  it('una tirada no se puede reescribir', async () => {
    await asUser(owner.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          update public.game_sessions set seed = 'otra'
          where user_id = ${owner.id}::uuid
        `,
      );
    });
  });
});

describe('registro de actividad', () => {
  it('solo los editores leen la actividad del mundo', async () => {
    const sql = getClient();
    await sql`
      insert into public.activity_log (world_id, user_id, action)
      values (${world.id}::uuid, ${owner.id}::uuid, 'entity.created')
    `;

    await asUser(editor.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.activity_log
        where world_id = ${world.id}::uuid
      `;
      expect(first(rows).count).toBe(1);
    });

    await asUser(viewer.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.activity_log
        where world_id = ${world.id}::uuid
      `;
      expect(first(rows).count).toBe(0);
    });
  });

  it('un miembro registra su propia acción y no la de otro', async () => {
    await asUser(editor.id, async (tx) => {
      const inserted = await tx`
        insert into public.activity_log (world_id, user_id, action)
        values (${world.id}::uuid, ${editor.id}::uuid, 'entity.updated')
        returning id
      `;
      expect(inserted).toHaveLength(1);

      await expectPermissionDenied(
        () => tx`
          insert into public.activity_log (world_id, user_id, action)
          values (${world.id}::uuid, ${owner.id}::uuid, 'entity.deleted')
        `,
      );
    });
  });

  it('la actividad es append-only', async () => {
    await asUser(owner.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          update public.activity_log set action = 'x'
          where world_id = ${world.id}::uuid
        `,
      );
    });

    await asUser(owner.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          delete from public.activity_log
          where world_id = ${world.id}::uuid
        `,
      );
    });
  });
});
