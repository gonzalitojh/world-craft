/**
 * Aislamiento de mundos, miembros e invitaciones entre owner, editor, viewer y
 * un usuario ajeno.
 */
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
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let world: TestWorld;

beforeAll(async () => {
  owner = await createTestUser('worlds-owner');
  editor = await createTestUser('worlds-editor');
  viewer = await createTestUser('worlds-viewer');
  outsider = await createTestUser('worlds-outsider');
  world = await createTestWorld(owner.id, { name: 'Mundo original' });
  await addWorldMember(world.id, editor.id, 'editor');
  await addWorldMember(world.id, viewer.id, 'viewer');
});

afterAll(async () => {
  await deleteTestWorld(world.id);
  await deleteTestUser(owner);
  await deleteTestUser(editor);
  await deleteTestUser(viewer);
  await deleteTestUser(outsider);
  await closeClient();
});

describe('lectura de mundos', () => {
  it.each([
    ['owner', () => owner],
    ['editor', () => editor],
    ['viewer', () => viewer],
  ])('%s ve el mundo y sus miembros', async (_label, getUser) => {
    await asUser(getUser().id, async (tx) => {
      const worlds = await tx<{ count: number }[]>`
        select count(*)::int as count from public.worlds
      `;
      const members = await tx<{ count: number }[]>`
        select count(*)::int as count from public.world_members
        where world_id = ${world.id}::uuid
      `;

      expect(first(worlds).count).toBe(1);
      expect(first(members).count).toBe(3);
    });
  });

  it('un usuario ajeno no ve nada del mundo', async () => {
    await asUser(outsider.id, async (tx) => {
      const worlds = await tx<{ count: number }[]>`
        select count(*)::int as count from public.worlds
      `;
      const members = await tx<{ count: number }[]>`
        select count(*)::int as count from public.world_members
      `;
      const invitations = await tx<{ count: number }[]>`
        select count(*)::int as count from public.world_invitations
      `;

      expect(first(worlds).count).toBe(0);
      expect(first(members).count).toBe(0);
      expect(first(invitations).count).toBe(0);
    });
  });
});

describe('escritura del mundo', () => {
  it('solo el owner actualiza el mundo', async () => {
    await asUser(owner.id, async (tx) => {
      const rows = await tx`
        update public.worlds set summary = 'Resumen del owner'
        where id = ${world.id}::uuid
        returning id
      `;
      expect(rows).toHaveLength(1);
    });

    for (const user of [editor, viewer]) {
      await asUser(user.id, async (tx) => {
        const rows = await tx`
          update public.worlds set summary = 'Intento sin permiso'
          where id = ${world.id}::uuid
          returning id
        `;
        expect(rows).toHaveLength(0);
      });
    }

    const row = first(
      await getClient()<{ summary: string }[]>`
        select summary from public.worlds where id = ${world.id}::uuid
      `,
    );
    expect(row.summary).toBe('');
  });

  it('un usuario no puede crear un mundo a nombre de otro', async () => {
    await asUser(outsider.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.worlds (owner_id, name, slug)
          values (${owner.id}::uuid, 'Mundo ajeno', 'mundo-ajeno')
        `,
      );
    });
  });
});

describe('invitaciones', () => {
  it('el owner crea y lee invitaciones de su mundo', async () => {
    await asUser(owner.id, async (tx) => {
      const inserted = await tx<{ id: string }[]>`
        insert into public.world_invitations (
          world_id, email, role, token_hash, expires_at
        )
        values (
          ${world.id}::uuid,
          'invitado@world-craft.invalid',
          'viewer',
          ${'a'.repeat(64)},
          now() + interval '7 days'
        )
        returning id
      `;
      const read = await tx<{ count: number }[]>`
        select count(*)::int as count from public.world_invitations
        where world_id = ${world.id}::uuid
      `;

      expect(inserted).toHaveLength(1);
      expect(first(read).count).toBe(1);
    });
  });

  it('un editor no puede invitar', async () => {
    await asUser(editor.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.world_invitations (
            world_id, email, role, token_hash, expires_at
          )
          values (
            ${world.id}::uuid,
            'invitado@world-craft.invalid',
            'viewer',
            ${'b'.repeat(64)},
            now() + interval '7 days'
          )
        `,
      );
    });
  });

  it('un viewer no ve las invitaciones', async () => {
    await asUser(viewer.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.world_invitations
      `;

      expect(first(rows).count).toBe(0);
    });
  });
});
