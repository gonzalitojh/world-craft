/**
 * Integración de assets contra PostgreSQL real.
 *
 * Comprueba el flujo completo con RLS activa (owner, editor, viewer y ajeno) y
 * la guarda de la migración 0007: un `authenticated` sin el contexto del
 * servidor no puede insertar metadatos de asset; con el contexto, sí.
 *
 * Requiere `DIRECT_URL` (`pnpm test:db`). Los objetos viven en memoria: R2 real
 * se prueba con `pnpm storage:smoke`.
 */
import { randomUUID } from 'node:crypto';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AssetError } from '@/lib/assets/errors';
import { createAssetService, type AssetService } from '@/lib/assets/service';
import { createAssetStore } from '@/lib/assets/store';
import { buildWorldAssetKey } from '@/lib/storage';
import { buildThumbnailKey } from '@/lib/storage/thumbnail-key';
import { MemoryStorageAdapter } from '../helpers/memory-storage';
import { closeClient } from './helpers/client';
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

const BUCKET = 'world-craft-test';

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let world: TestWorld;
let storage: MemoryStorageAdapter;
let service: AssetService;
let png: Uint8Array;

beforeAll(async () => {
  owner = await createTestUser('asset-svc-owner');
  editor = await createTestUser('asset-svc-editor');
  viewer = await createTestUser('asset-svc-viewer');
  stranger = await createTestUser('asset-svc-stranger');
  world = await createTestWorld(owner.id);
  await addWorldMember(world.id, editor.id, 'editor');
  await addWorldMember(world.id, viewer.id, 'viewer');

  storage = new MemoryStorageAdapter();
  service = createAssetService({
    storage,
    store: createAssetStore(),
    bucket: BUCKET,
  });

  png = new Uint8Array(
    await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer(),
  );
});

afterAll(async () => {
  await deleteTestWorld(world.id);
  await deleteTestUser(owner);
  await deleteTestUser(editor);
  await deleteTestUser(viewer);
  await deleteTestUser(stranger);
  await closeClient();
});

describe('servicio de assets con PostgreSQL', () => {
  it('el editor sube, el viewer descarga y el ajeno no ve nada', async () => {
    const ticket = await service.requestUpload(
      { userId: editor.id },
      { worldId: world.id, contentType: 'image/png', size: png.byteLength },
    );

    await storage.upload({
      key: ticket.key,
      body: png,
      contentType: 'image/png',
    });

    const record = await service.finalizeUpload(
      { userId: editor.id },
      { worldId: world.id, assetId: ticket.assetId, alt: 'Mapa de prueba' },
    );

    expect(record).toMatchObject({
      worldId: world.id,
      path: buildWorldAssetKey(world.id, ticket.assetId, 'webp'),
      mime: 'image/webp',
      width: 64,
      height: 48,
      alt: 'Mapa de prueba',
      bucket: BUCKET,
    });
    expect(
      storage.read(buildThumbnailKey(world.id, ticket.assetId)),
    ).toBeDefined();

    const download = await service.getDownloadUrl(
      { userId: viewer.id },
      { worldId: world.id, assetId: ticket.assetId },
    );

    expect(download.url).toContain(record.path);
    expect(download.thumbnailUrl).toBeDefined();

    await expect(
      service.getDownloadUrl(
        { userId: stranger.id },
        { worldId: world.id, assetId: ticket.assetId },
      ),
    ).rejects.toMatchObject({ code: 'not_found' });

    await expect(
      service.deleteAsset(
        { userId: viewer.id },
        { worldId: world.id, assetId: ticket.assetId },
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });

    await expect(
      service.deleteAsset(
        { userId: editor.id },
        { worldId: world.id, assetId: ticket.assetId },
      ),
    ).resolves.toEqual({ id: ticket.assetId });

    await expect(
      service.getDownloadUrl(
        { userId: viewer.id },
        { worldId: world.id, assetId: ticket.assetId },
      ),
    ).rejects.toBeInstanceOf(AssetError);
  });

  it('la guarda rechaza un insert authenticated sin contexto de servidor', async () => {
    const assetId = randomUUID();
    const path = buildWorldAssetKey(world.id, assetId, 'webp');

    await asUser(editor.id, async (tx) => {
      await expectPermissionDenied(
        () => tx`
          insert into public.assets (
            id, world_id, uploader_id, bucket, path, mime, size, width, height
          )
          values (
            ${assetId}::uuid, ${world.id}::uuid, ${editor.id}::uuid,
            ${BUCKET}, ${path}, 'image/webp', 1024, 64, 48
          )
        `,
      );
    });
  });

  it('con el contexto del servidor, el insert authenticated funciona', async () => {
    const assetId = randomUUID();
    const path = buildWorldAssetKey(world.id, assetId, 'webp');

    await asUser(editor.id, async (tx) => {
      await tx`select set_config('app.asset_write', 'on', true)`;
      await tx`select set_config('app.asset_bucket', ${BUCKET}, true)`;

      const rows = await tx<{ id: string }[]>`
        insert into public.assets (
          id, world_id, uploader_id, bucket, path, mime, size, width, height
        )
        values (
          ${assetId}::uuid, ${world.id}::uuid, ${editor.id}::uuid,
          ${BUCKET}, ${path}, 'image/webp', 1024, 64, 48
        )
        returning id
      `;

      expect(rows[0]?.id).toBe(assetId);
    });
  });

  it('la guarda rechaza metadatos falsificados aunque haya contexto', async () => {
    const assetId = randomUUID();
    const path = buildWorldAssetKey(world.id, assetId, 'webp');

    await asUser(editor.id, async (tx) => {
      await tx`select set_config('app.asset_write', 'on', true)`;
      await tx`select set_config('app.asset_bucket', ${BUCKET}, true)`;

      await expectCheckViolation(
        () => tx`
          insert into public.assets (
            id, world_id, uploader_id, bucket, path, mime, size, width, height
          )
          values (
            ${assetId}::uuid, ${world.id}::uuid, ${editor.id}::uuid,
            ${BUCKET}, ${path}, 'image/png', 1024, 64, 48
          )
        `,
      );
    });
  });

  it('las fixtures privilegiadas siguen pudiendo insertar sin GUC', async () => {
    const asset = await createTestAsset(world.id, owner.id);

    expect(asset.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('el viewer no puede pedir una URL de subida', async () => {
    await expect(
      service.requestUpload(
        { userId: viewer.id },
        { worldId: world.id, contentType: 'image/png', size: 10 },
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});
