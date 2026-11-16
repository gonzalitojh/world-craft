/**
 * Allowlist de la aplicación: ni lectura ni escritura desde el cliente, y la
 * allowlist no concede acceso a los mundos de otra persona.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeClient, first } from './helpers/client';
import {
  createTestUser,
  createTestWorld,
  deleteTestUser,
  deleteTestWorld,
  type TestUser,
  type TestWorld,
} from './helpers/fixtures';
import { asUser, expectPermissionDenied } from './helpers/session';

let owner: TestUser;
let outsider: TestUser;
let world: TestWorld;

beforeAll(async () => {
  owner = await createTestUser('allowlist-owner');
  outsider = await createTestUser('allowlist-outsider');
  world = await createTestWorld(owner.id);
});

afterAll(async () => {
  await deleteTestWorld(world.id);
  await deleteTestUser(owner);
  await deleteTestUser(outsider);
  await closeClient();
});

describe('allowlist', () => {
  it('authenticated no puede leer allowed_emails', async () => {
    await asUser(outsider.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`select * from public.allowed_emails`,
      );
    });
  });

  it('authenticated no puede insertar en allowed_emails', async () => {
    await asUser(outsider.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.allowed_emails (email)
          values ('intruso@world-craft.invalid')
        `,
      );
    });
  });

  it('authenticated no puede actualizar ni borrar allowed_emails', async () => {
    await asUser(outsider.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          update public.allowed_emails set note = 'x'
          where email = 'nadie@world-craft.invalid'
        `,
      );
      await expectPermissionDenied(
        () => tx`
          delete from public.allowed_emails
          where email = 'nadie@world-craft.invalid'
        `,
      );
    });
  });

  it('un usuario autorizado sin membresía no ve el mundo ajeno', async () => {
    await asUser(outsider.id, async (tx) => {
      const worlds = await tx<{ count: number }[]>`
        select count(*)::int as count from public.worlds
      `;
      const members = await tx<{ count: number }[]>`
        select count(*)::int as count from public.world_members
      `;

      expect(first(worlds).count).toBe(0);
      expect(first(members).count).toBe(0);
    });
  });

  it('el propietario sí ve su mundo y su membresía', async () => {
    await asUser(owner.id, async (tx) => {
      const worlds = await tx<{ count: number }[]>`
        select count(*)::int as count from public.worlds
      `;
      const members = await tx<{ role: string }[]>`
        select role from public.world_members where world_id = ${world.id}::uuid
      `;

      expect(first(worlds).count).toBe(1);
      expect(first(members).role).toBe('owner');
    });
  });
});
