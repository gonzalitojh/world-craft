/**
 * Claves de assets: la restricción `check` exige el prefijo del mundo y la RLS
 * impide insertar assets de otro mundo o suplantar al cargador.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeClient, first } from './helpers/client';
import {
  addWorldMember,
  createTestAsset,
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
let world: TestWorld;
let otherWorld: TestWorld;

beforeAll(async () => {
  owner = await createTestUser('assets-owner');
  editor = await createTestUser('assets-editor');
  viewer = await createTestUser('assets-viewer');
  world = await createTestWorld(owner.id);
  otherWorld = await createTestWorld(owner.id);
  await addWorldMember(world.id, editor.id, 'editor');
  await addWorldMember(world.id, viewer.id, 'viewer');
});

afterAll(async () => {
  await deleteTestWorld(world.id);
  await deleteTestWorld(otherWorld.id);
  await deleteTestUser(owner);
  await deleteTestUser(editor);
  await deleteTestUser(viewer);
  await closeClient();
});

describe('claves de assets', () => {
  it('el servidor tampoco puede insertar una clave con otro prefijo', async () => {
    await expectCheckViolation(() =>
      createTestAsset(world.id, owner.id, {
        path: `world/${otherWorld.id}/33333333-3333-4333-8333-333333333333.png`,
      }),
    );
  });

  it('un editor no puede insertar un asset de otro mundo', async () => {
    await asUser(editor.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.assets (
            world_id, uploader_id, bucket, path, mime, size
          )
          values (
            ${world.id}::uuid, ${editor.id}::uuid, 'world-craft-assets',
            ${`world/${otherWorld.id}/44444444-4444-4444-8444-444444444444.png`},
            'image/png', 10
          )
        `,
      );
    });
  });

  it('un editor no puede suplantar al cargador', async () => {
    await asUser(editor.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.assets (
            world_id, uploader_id, bucket, path, mime, size
          )
          values (
            ${world.id}::uuid, ${owner.id}::uuid, 'world-craft-assets',
            ${`world/${world.id}/55555555-5555-4555-8555-555555555555.png`},
            'image/png', 10
          )
        `,
      );
    });
  });

  it('un editor inserta un asset válido y el viewer lo lee', async () => {
    await asUser(editor.id, async (tx) => {
      // La guarda 0007 exige el contexto que fija el servicio de assets.
      await tx`select set_config('app.asset_write', 'on', true)`;
      await tx`select set_config('app.asset_bucket', 'world-craft-assets', true)`;

      const rows = await tx<{ path: string }[]>`
        insert into public.assets (
          world_id, uploader_id, bucket, path, mime, size, width, height
        )
        values (
          ${world.id}::uuid, ${editor.id}::uuid, 'world-craft-assets',
          ${`world/${world.id}/66666666-6666-4666-8666-666666666666.webp`},
          'image/webp', 1024, 64, 48
        )
        returning path
      `;

      expect(first(rows).path).toContain(`world/${world.id}/`);
    });

    const asset = await createTestAsset(world.id, owner.id);

    await asUser(viewer.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.assets
        where id = ${asset.id}::uuid
      `;

      expect(first(rows).count).toBe(1);
    });
  });

  it('un asset de un mundo no se ve desde otro mundo del mismo owner', async () => {
    const asset = await createTestAsset(world.id, owner.id);

    await asUser(owner.id, async (tx) => {
      const rows = await tx<{ count: number }[]>`
        select count(*)::int as count from public.assets
        where id = ${asset.id}::uuid and world_id = ${otherWorld.id}::uuid
      `;

      expect(first(rows).count).toBe(0);
    });
  });
});
