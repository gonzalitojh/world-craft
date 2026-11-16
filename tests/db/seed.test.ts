/**
 * Seed del catálogo del sistema: conteos, idempotencia y protección de los
 * tipos globales frente a escrituras de clientes.
 */
import { execFileSync } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeClient, first, getClient } from './helpers/client';
import {
  addWorldMember,
  createTestUser,
  createTestWorld,
  deleteTestUser,
  deleteTestWorld,
  type TestUser,
  type TestWorld,
} from './helpers/fixtures';
import { asUser, expectPermissionDenied } from './helpers/session';

let owner: TestUser;
let viewer: TestUser;
let world: TestWorld;

beforeAll(async () => {
  owner = await createTestUser('seed-owner');
  viewer = await createTestUser('seed-viewer');
  world = await createTestWorld(owner.id);
  await addWorldMember(world.id, viewer.id, 'viewer');
});

afterAll(async () => {
  await deleteTestWorld(world.id);
  await deleteTestUser(owner);
  await deleteTestUser(viewer);
  await closeClient();
});

describe('seed del sistema', () => {
  it('tiene 12 tipos de entidad y 15 de relación del sistema', async () => {
    const entityTypes = first(
      await getClient()<{ count: number }[]>`
        select count(*)::int as count
        from public.entity_types
        where world_id is null and is_system
      `,
    );
    const relationTypes = first(
      await getClient()<{ count: number }[]>`
        select count(*)::int as count
        from public.relation_types
        where world_id is null and is_system
      `,
    );

    expect(entityTypes.count).toBe(12);
    expect(relationTypes.count).toBe(15);
  });

  it('todos los tipos del sistema tienen world_id nulo e is_system verdadero', async () => {
    const invalid = first(
      await getClient()<{ count: number }[]>`
        select count(*)::int as count
        from (
          select world_id, is_system from public.entity_types
          union all
          select world_id, is_system from public.relation_types
        ) as types
        where (world_id is null) <> is_system
      `,
    );

    expect(invalid.count).toBe(0);
  });

  it('es idempotente: dos ejecuciones no cambian los conteos', async () => {
    const sql = getClient();
    const totalQuery = sql<{ count: number }[]>`
      select
        (select count(*) from public.entity_types where world_id is null)
        + (select count(*) from public.relation_types where world_id is null)
        as count
    `;

    const before = first(await totalQuery);

    execFileSync(process.execPath, ['scripts/db/seed.mjs'], {
      env: process.env,
      stdio: 'pipe',
    });
    execFileSync(process.execPath, ['scripts/db/seed.mjs'], {
      env: process.env,
      stdio: 'pipe',
    });

    const after = first(
      await sql<{ count: number }[]>`
        select
          (select count(*) from public.entity_types where world_id is null)
          + (select count(*) from public.relation_types where world_id is null)
          as count
      `,
    );

    expect(after.count).toBe(before.count);
  });

  it('un cliente no puede modificar un tipo del sistema', async () => {
    await asUser(owner.id, async (tx) => {
      const updated = await tx`
        update public.entity_types set name = 'Cambiado'
        where world_id is null
        returning id
      `;

      expect(updated).toHaveLength(0);
    });
  });

  it('un cliente no puede crear un tipo global', async () => {
    await asUser(owner.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.entity_types (world_id, key, name, is_system)
          values (null, 'global_intruso', 'Intruso', true)
        `,
      );
    });
  });

  it('un editor crea tipos propios del mundo', async () => {
    await asUser(owner.id, async (tx) => {
      const rows = await tx<{ id: string }[]>`
        insert into public.entity_types (world_id, key, name)
        values (${world.id}::uuid, 'custom_type', 'Tipo propio')
        returning id
      `;

      expect(rows).toHaveLength(1);
    });
  });

  it('un viewer no crea tipos del mundo', async () => {
    await asUser(viewer.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.entity_types (world_id, key, name)
          values (${world.id}::uuid, 'viewer_type', 'Tipo del viewer')
        `,
      );
    });
  });
});
