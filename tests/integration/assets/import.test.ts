import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { importAsset } from '@/main/assets/import-asset';
import { processImage, sha256 } from '@/main/assets/image';
import type { AssetRecord } from '@/main/assets/store';
import { closeDatabase } from '@/main/db/connection';
import { createUuidv7Generator } from '@/main/db/ids';
import { initializeDatabase } from '@/main/db/startup';

import {
  createAssetFixture,
  insertTestWorld,
  writeAssetFile,
  type AssetFixture,
} from '../helpers/temp-assets';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0x81),
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

async function createPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 20, g: 120, b: 200, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function importImage(
  fixture: AssetFixture,
  data: Buffer,
  options?: {
    readonly alt?: string;
    readonly repository?: { insert(record: AssetRecord): void };
  },
) {
  return importAsset(
    {
      userDataDir: fixture.userDataDir,
      assetsDir: fixture.paths.assetsDir,
      assetsTempDir: fixture.paths.assetsTempDir,
      repository: options?.repository ?? fixture.repository,
    },
    {
      worldId: WORLD_ID,
      kind: 'image',
      ...(options?.alt === undefined ? {} : { alt: options.alt }),
      source: { kind: 'buffer', data },
    },
  );
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);

    return true;
  } catch {
    return false;
  }
}

describe('importación de imágenes con sharp', { timeout: 60_000 }, () => {
  it('genera el WebP, la miniatura, las dimensiones y el hash', async () => {
    const fixture = await createFixture();
    const source = await createPng(800, 600);

    const { asset, thumbnailRelativePath } = await importImage(
      fixture,
      source,
      { alt: '  Bosque de prueba  ' },
    );

    expect(asset).toMatchObject({
      worldId: WORLD_ID,
      kind: 'image',
      mime: 'image/webp',
      width: 800,
      height: 600,
      alt: 'Bosque de prueba',
    });
    expect(asset.relativePath).toBe(`worlds/${WORLD_ID}/${asset.id}.webp`);

    const mainFile = join(
      fixture.paths.assetsDir,
      ...asset.relativePath.split('/'),
    );
    const thumbnailFile = join(
      fixture.paths.assetsDir,
      ...thumbnailRelativePath.split('/'),
    );
    const mainBytes = await readFile(mainFile);

    expect(mainBytes.byteLength).toBe(asset.size);
    expect(sha256(mainBytes)).toBe(asset.hash);

    const mainMetadata = await sharp(mainBytes).metadata();
    expect(mainMetadata.format).toBe('webp');
    expect(mainMetadata.width).toBe(800);
    expect(mainMetadata.height).toBe(600);
    expect(mainMetadata.exif).toBeUndefined();

    const thumbnailMetadata = await sharp(
      await readFile(thumbnailFile),
    ).metadata();
    expect(thumbnailMetadata.format).toBe('webp');
    expect(thumbnailMetadata.width).toBe(320);
    expect(thumbnailMetadata.height).toBe(240);

    // Una importación no guarda el original ni deja temporales.
    expect(
      await readdir(join(fixture.paths.assetsDir, 'worlds', WORLD_ID)),
    ).toHaveLength(2);
    expect(await readdir(fixture.paths.assetsTempDir)).toEqual([]);
    expect(fixture.repository.count()).toBe(1);
  });

  it('no amplía la miniatura de una imagen pequeña', async () => {
    const fixture = await createFixture();
    const { thumbnailRelativePath } = await importImage(
      fixture,
      await createPng(100, 50),
    );

    const metadata = await sharp(
      await readFile(
        join(fixture.paths.assetsDir, ...thumbnailRelativePath.split('/')),
      ),
    ).metadata();

    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(50);
  });

  it('acepta JPEG aunque la extensión diga .png y rechaza HTML disfrazado', async () => {
    const fixture = await createFixture();
    const jpeg = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 200, g: 30, b: 60 },
      },
    })
      .jpeg()
      .toBuffer();
    const fakePng = join(fixture.rootDir, 'foto.png');
    const fakeImage = join(fixture.rootDir, 'imagen.png');

    await writeFile(fakePng, jpeg);
    await writeFile(
      fakeImage,
      '<!doctype html><html><body>no soy imagen',
      'utf8',
    );

    const imported = await importAsset(
      {
        userDataDir: fixture.userDataDir,
        assetsDir: fixture.paths.assetsDir,
        assetsTempDir: fixture.paths.assetsTempDir,
        repository: fixture.repository,
      },
      {
        worldId: WORLD_ID,
        kind: 'image',
        source: { kind: 'path', path: fakePng },
      },
    );

    expect(imported.asset.mime).toBe('image/webp');
    expect(imported.asset.width).toBe(320);

    await expect(
      importAsset(
        {
          userDataDir: fixture.userDataDir,
          assetsDir: fixture.paths.assetsDir,
          assetsTempDir: fixture.paths.assetsTempDir,
          repository: fixture.repository,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'path', path: fakeImage },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_UNSUPPORTED_FORMAT' });

    expect(fixture.repository.count()).toBe(1);
  });

  it('rechaza un PNG truncado sin dejar archivos ni filas', async () => {
    const fixture = await createFixture();
    const source = await createPng(640, 480);
    const truncated = source.subarray(0, Math.floor(source.byteLength / 2));

    await expect(importImage(fixture, truncated)).rejects.toMatchObject({
      code: 'ASSET_IMAGE_INVALID',
    });

    expect(fixture.repository.count()).toBe(0);
    expect(await fileExists(join(fixture.paths.assetsDir, 'worlds'))).toBe(
      true,
    );
    expect(await readdir(join(fixture.paths.assetsDir, 'worlds'))).toEqual([]);
  });

  it('elimina EXIF y GPS y aplica la orientación', async () => {
    const fixture = await createFixture();
    const source = await sharp({
      create: {
        width: 2,
        height: 4,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({
        IFD0: { Copyright: 'World Craft' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 25/1 0/1' },
      })
      .toBuffer();

    const sourceMetadata = await sharp(source).metadata();
    expect(sourceMetadata.exif).toBeDefined();
    expect(sourceMetadata.orientation).toBe(6);

    const { asset } = await importImage(fixture, source);
    const metadata = await sharp(
      await readFile(
        join(fixture.paths.assetsDir, ...asset.relativePath.split('/')),
      ),
    ).metadata();

    // La orientación EXIF rota la imagen: 2×4 pasa a 4×2.
    expect(metadata.width).toBe(4);
    expect(metadata.height).toBe(2);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it('aplica los límites exactos de bytes, lado y píxeles', async () => {
    const png = await createPng(16, 16);

    await expect(
      processImage(png, { maxBytes: png.byteLength }),
    ).resolves.toBeDefined();
    await expect(
      processImage(png, { maxBytes: png.byteLength - 1 }),
    ).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' });

    await expect(
      processImage(png, { maxDimensionPx: 16 }),
    ).resolves.toBeDefined();
    await expect(
      processImage(png, { maxDimensionPx: 15 }),
    ).rejects.toMatchObject({
      code: 'ASSET_DIMENSIONS_TOO_LARGE',
    });

    await expect(processImage(png, { maxPixels: 256 })).resolves.toBeDefined();
    await expect(processImage(png, { maxPixels: 255 })).rejects.toMatchObject({
      code: 'ASSET_DIMENSIONS_TOO_LARGE',
    });

    // Límite por defecto de lado (8192 px).
    const wide = await createPng(9000, 1);
    await expect(processImage(wide)).rejects.toMatchObject({
      code: 'ASSET_DIMENSIONS_TOO_LARGE',
    });
  });

  it('compensa los archivos si falla el INSERT', async () => {
    const fixture = await createFixture();
    const source = await createPng(200, 200);

    await expect(
      importImage(fixture, source, {
        repository: {
          insert() {
            throw new Error('fallo simulado');
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'ASSET_DATABASE_FAILED' });

    expect(fixture.repository.count()).toBe(0);
    expect(await readdir(join(fixture.paths.assetsDir, 'worlds'))).toEqual([]);
    expect(await readdir(fixture.paths.assetsTempDir)).toEqual([]);
  });

  it('no deduplica: el mismo contenido genera dos filas y dos pares de archivos', async () => {
    const fixture = await createFixture();
    const source = await createPng(120, 90);

    const first = await importImage(fixture, source);
    const second = await importImage(fixture, source);

    expect(first.asset.id).not.toBe(second.asset.id);
    expect(first.asset.hash).toBe(second.asset.hash);
    expect(fixture.repository.count()).toBe(2);
    expect(
      await readdir(join(fixture.paths.assetsDir, 'worlds', WORLD_ID)),
    ).toHaveLength(4);
  });

  it('conserva las filas y los archivos al reabrir la base', async () => {
    const fixture = await createFixture();
    const { asset } = await importImage(fixture, await createPng(64, 48));
    const mainFile = join(
      fixture.paths.assetsDir,
      ...asset.relativePath.split('/'),
    );

    fixture.close();

    const reopened = await initializeDatabase({
      userDataDir: fixture.userDataDir,
      migrationsDir: fixture.migrationsDir,
    });

    expect(reopened.status).toBe('ready');

    if (reopened.status !== 'ready') {
      throw new Error('Se esperaba ready.');
    }

    try {
      const row = reopened.client.sqlite
        .prepare('SELECT id, hash FROM assets WHERE id = ?')
        .get(asset.id);

      expect(row).toEqual({ id: asset.id, hash: asset.hash });
      expect(await fileExists(mainFile)).toBe(true);
    } finally {
      closeDatabase(reopened.client.sqlite);
    }
  });

  it('no toca el archivo original ni escribe fuera de assets/', async () => {
    const fixture = await createFixture();
    const original = await createPng(300, 200);
    const originalFile = await writeAssetFile(
      fixture.rootDir,
      'origen.png',
      original,
    );

    await importAsset(
      {
        userDataDir: fixture.userDataDir,
        assetsDir: fixture.paths.assetsDir,
        assetsTempDir: fixture.paths.assetsTempDir,
        repository: fixture.repository,
      },
      {
        worldId: WORLD_ID,
        kind: 'image',
        source: { kind: 'path', path: originalFile },
      },
    );

    expect(sha256(await readFile(originalFile))).toBe(sha256(original));

    // Solo existe el mundo importado dentro de assets/worlds; el original vive
    // fuera de la carpeta de assets.
    expect(await readdir(fixture.paths.assetsWorldsDir)).toEqual([WORLD_ID]);
    expect(await readdir(fixture.paths.assetsDir)).toEqual(
      expect.arrayContaining(['worlds', '.tmp']),
    );
  });
});
