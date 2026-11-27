import { readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { importAsset } from '@/main/assets/import-asset';
import { createAssetLogger } from '@/main/assets/logger';
import { handleAssetRequest } from '@/main/assets/protocol';
import type { AssetRecord } from '@/main/assets/store';
import { createUuidv7Generator } from '@/main/db/ids';

import {
  createAssetFixture,
  insertTestWorld,
  writeAssetFile,
  type AssetFixture,
} from '../helpers/temp-assets';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0x91),
});

const WORLD_ID = generator.generate();

const fixtures: AssetFixture[] = [];

async function createFixture(): Promise<AssetFixture> {
  const fixture = await createAssetFixture();

  insertTestWorld(fixture.sqlite, WORLD_ID);
  fixtures.push(fixture);

  return fixture;
}

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map(async (fixture) => {
      fixture.close();
      await fixture.cleanup();
    }),
  );
});

async function importPng(fixture: AssetFixture): Promise<AssetRecord> {
  const png = await sharp({
    create: {
      width: 240,
      height: 160,
      channels: 3,
      background: { r: 15, g: 90, b: 45 },
    },
  })
    .png()
    .toBuffer();
  const { asset } = await importAsset(
    {
      userDataDir: fixture.userDataDir,
      assetsDir: fixture.paths.assetsDir,
      assetsTempDir: fixture.paths.assetsTempDir,
      repository: fixture.repository,
    },
    {
      worldId: WORLD_ID,
      kind: 'image',
      source: { kind: 'buffer', data: png },
    },
  );

  return asset;
}

describe('protocolo de assets con base de datos', { timeout: 60_000 }, () => {
  it('sirve el archivo y la miniatura de una fila real', async () => {
    const fixture = await createFixture();
    const asset = await importPng(fixture);
    const logFile = join(fixture.rootDir, 'assets.log');
    const logger = createAssetLogger(logFile);
    const dependencies = {
      assetsDir: fixture.paths.assetsDir,
      repository: fixture.repository,
      logger,
    };

    const main = await handleAssetRequest(
      dependencies,
      `wc-asset://asset/${asset.id}`,
    );
    const thumbnail = await handleAssetRequest(
      dependencies,
      `wc-asset://thumb/${asset.id}`,
    );

    expect(main.status).toBe(200);
    expect(main.headers['content-type']).toBe('image/webp');
    expect(main.headers['content-length']).toBe(
      String(Buffer.from(main.body).byteLength),
    );

    const diskBytes = await readFile(
      join(fixture.paths.assetsDir, ...asset.relativePath.split('/')),
    );

    expect(Buffer.from(main.body).equals(diskBytes)).toBe(true);

    expect(thumbnail.status).toBe(200);

    const thumbnailBytes = await readFile(
      join(
        fixture.paths.assetsDir,
        'worlds',
        WORLD_ID,
        `${asset.id}.thumb.webp`,
      ),
    );

    expect(Buffer.from(thumbnail.body).equals(thumbnailBytes)).toBe(true);

    const log = await readFile(logFile, 'utf8');
    expect(log).toContain('"outcome":"served"');
    expect(log).not.toContain(asset.id);
  });

  it('devuelve 404 para un ID desconocido y para una miniatura ausente', async () => {
    const fixture = await createFixture();
    const asset = await importPng(fixture);

    await rm(
      join(
        fixture.paths.assetsDir,
        'worlds',
        WORLD_ID,
        `${asset.id}.thumb.webp`,
      ),
    );

    const dependencies = {
      assetsDir: fixture.paths.assetsDir,
      repository: fixture.repository,
    };

    const unknown = await handleAssetRequest(
      dependencies,
      `wc-asset://asset/${generator.generate()}`,
    );
    const withoutThumbnail = await handleAssetRequest(
      dependencies,
      `wc-asset://thumb/${asset.id}`,
    );

    expect(unknown.status).toBe(404);
    expect(withoutThumbnail.status).toBe(404);
    expect(unknown.body).not.toContain(fixture.rootDir);
  });

  it('rechaza con 403 el traversal, el mundo distinto y la fila con ruta ajena', async () => {
    const fixture = await createFixture();
    const asset = await importPng(fixture);
    const insert = fixture.sqlite.prepare(
      `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, hash, created_at)
       VALUES (?, ?, 'image', ?, 'image/webp', 10, ?, 1760000000000)`,
    );
    const traversalId = generator.generate();
    const foreignWorldId = generator.generate();
    const foreignAssetId = generator.generate();
    const mismatchedId = generator.generate();

    insert.run(
      traversalId,
      WORLD_ID,
      `worlds/../../${traversalId}.webp`,
      'f'.repeat(64),
    );
    insertTestWorld(fixture.sqlite, foreignWorldId);
    insert.run(
      foreignAssetId,
      foreignWorldId,
      `worlds/${WORLD_ID}/${foreignAssetId}.webp`,
      'f'.repeat(64),
    );
    // Fila con id propio y la ruta del asset real: la ruta no le pertenece.
    insert.run(mismatchedId, WORLD_ID, asset.relativePath, 'f'.repeat(64));

    const dependencies = {
      assetsDir: fixture.paths.assetsDir,
      repository: fixture.repository,
    };

    for (const id of [traversalId, foreignAssetId, mismatchedId]) {
      const response = await handleAssetRequest(
        dependencies,
        `wc-asset://asset/${id}`,
      );

      expect(response.status).toBe(403);
      expect(response.body).not.toContain(fixture.rootDir);
    }
  });

  it('rechaza un enlace simbólico en lugar del archivo real', async (context) => {
    const fixture = await createFixture();
    const asset = await importPng(fixture);
    const mainFile = join(
      fixture.paths.assetsDir,
      ...asset.relativePath.split('/'),
    );
    const outside = join(fixture.rootDir, 'externo.webp');

    await writeFile(outside, 'externo', 'utf8');

    try {
      await rm(mainFile);
      await symlink(outside, mainFile, 'file');
    } catch {
      context.skip();
      return;
    }

    const linked = await handleAssetRequest(
      {
        assetsDir: fixture.paths.assetsDir,
        repository: fixture.repository,
      },
      `wc-asset://asset/${asset.id}`,
    );

    expect(linked.status).toBe(403);
    expect(linked.body).not.toContain(fixture.rootDir);
  });

  it('responde 415 si el MIME guardado no está admitido', async () => {
    const fixture = await createFixture();
    const id = generator.generate();

    await writeAssetFile(
      fixture.paths.assetsDir,
      `worlds/${WORLD_ID}/${id}.webp`,
      'no es webp',
    );
    fixture.sqlite
      .prepare(
        `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, hash, created_at)
         VALUES (?, ?, 'image', ?, 'text/html', 9, ?, 1760000000000)`,
      )
      .run(id, WORLD_ID, `worlds/${WORLD_ID}/${id}.webp`, 'a'.repeat(64));

    const response = await handleAssetRequest(
      {
        assetsDir: fixture.paths.assetsDir,
        repository: fixture.repository,
      },
      `wc-asset://asset/${id}`,
    );

    expect(response.status).toBe(415);
  });
});
