/**
 * Propiedad de un mundo: creación con membresía automática, protección del
 * `owner` y transferencia atómica.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeClient, first } from './helpers/client';
import {
  addWorldMember,
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
let outsider: TestUser;
let world: TestWorld;

beforeAll(async () => {
  owner = await createTestUser('owner');
  editor = await createTestUser('editor');
  outsider = await createTestUser('outsider');
  world = await createTestWorld(owner.id);
  await addWorldMember(world.id, editor.id, 'editor');
});

afterAll(async () => {
  await deleteTestWorld(world.id);
  await deleteTestUser(owner);
  await deleteTestUser(editor);
  await deleteTestUser(outsider);
  await closeClient();
});

describe('propiedad del mundo', () => {
  it('crear un mundo como usuario materializa la membresía owner', async () => {
    await asUser(owner.id, async (tx) => {
      const worldRows = await tx<{ id: string }[]>`
        insert into public.worlds (owner_id, name, slug)
        values (${owner.id}::uuid, 'Mundo nuevo', ${`nuevo-${Date.now()}`})
        returning id
      `;
      const created = first(worldRows);

      const memberRows = await tx<{ role: string }[]>`
        select role from public.world_members where world_id = ${created.id}::uuid
      `;

      expect(first(memberRows).role).toBe('owner');
    });
  });

  it('el owner no puede degradarse sin transferir', async () => {
    await asUser(owner.id, async (tx) => {
      await expectCheckViolation(
        () => tx`
          update public.world_members set role = 'editor'
          where world_id = ${world.id}::uuid and user_id = ${owner.id}::uuid
        `,
      );
    });
  });

  it('el owner no puede eliminar su membresía', async () => {
    await asUser(owner.id, async (tx) => {
      await expectCheckViolation(
        () => tx`
          delete from public.world_members
          where world_id = ${world.id}::uuid and user_id = ${owner.id}::uuid
        `,
      );
    });
  });

  it('un segundo owner es imposible', async () => {
    await asUser(owner.id, async (tx) => {
      await expectCheckViolation(
        () => tx`
          update public.world_members set role = 'owner'
          where world_id = ${world.id}::uuid and user_id = ${editor.id}::uuid
        `,
      );
    });
  });

  it('un editor no puede gestionar miembros', async () => {
    await asUser(editor.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.world_members (world_id, user_id, role)
          values (${world.id}::uuid, ${outsider.id}::uuid, 'viewer')
        `,
      );
    });
  });

  it('un editor no puede transferir la propiedad', async () => {
    await asUser(editor.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          select app.transfer_world_ownership(
            ${world.id}::uuid,
            ${editor.id}::uuid
          )
        `,
      );
    });
  });

  it('la transferencia deja al antiguo owner como editor y al nuevo como owner', async () => {
    await asUser(owner.id, async (tx) => {
      await tx`
        select app.transfer_world_ownership(
          ${world.id}::uuid,
          ${editor.id}::uuid
        )
      `;

      const worlds = await tx<{ owner_id: string }[]>`
        select owner_id from public.worlds where id = ${world.id}::uuid
      `;
      const members = await tx<{ user_id: string; role: string }[]>`
        select user_id, role from public.world_members
        where world_id = ${world.id}::uuid
        order by role
      `;
      const activity = await tx<{ count: number }[]>`
        select count(*)::int as count from public.activity_log
        where world_id = ${world.id}::uuid
          and action = 'world.ownership_transferred'
      `;

      expect(first(worlds).owner_id).toBe(editor.id);
      expect(
        members.reduce<Record<string, string>>((roles, member) => {
          roles[member.user_id] = member.role;
          return roles;
        }, {}),
      ).toEqual({ [owner.id]: 'editor', [editor.id]: 'owner' });
      expect(first(activity).count).toBe(1);
    });
  });

  it('el nuevo owner debe ser miembro del mundo', async () => {
    await asUser(owner.id, async (tx) => {
      await expectCheckViolation(
        () => tx`
          select app.transfer_world_ownership(
            ${world.id}::uuid,
            ${outsider.id}::uuid
          )
        `,
      );
    });
  });
});
