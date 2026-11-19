import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertAssetRoot,
  assertContained,
  buildRelativePath,
  resolveAssetFile,
  resolveStoreFilePath,
} from '@/main/assets/paths';
import { createUuidv7Generator } from '@/main/db/ids';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0x24),
});

const WORLD_ID = generator.generate();
const OTHER_WORLD_ID = generator.generate();
const ASSET_ID = generator.generate();

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-assets-'));
  temporaryDirectories.push(directory);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function expectAssetError(callback: () => unknown, code: string): void {
  let caught: unknown;

  try {
    callback();
  } catch (error) {
    caught = error;
  }

  expect(caught).toMatchObject({ code });
}

async function createAssetFile(
  assetsDir: string,
  relativePath: string,
  contents = 'contenido webp',
): Promise<string> {
  const absolutePath = join(assetsDir, ...relativePath.split('/'));

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, 'utf8');

  return absolutePath;
}

describe('resolución de archivos de asset', () => {
  it('resuelve el archivo principal y la miniatura dentro de assets/', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const relativePath = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });
    const thumbnailPath = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'thumb',
    });

    await createAssetFile(assetsDir, relativePath, 'principal');
    await createAssetFile(assetsDir, thumbnailPath, 'miniatura');

    const main = resolveAssetFile({
      assetsDir,
      relativePath,
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });
    const thumbnail = resolveAssetFile({
      assetsDir,
      relativePath: thumbnailPath,
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'thumb',
    });

    expect(main.relativePath).toBe(relativePath);
    expect(main.size).toBe(Buffer.byteLength('principal'));
    expect(thumbnail.relativePath).toBe(thumbnailPath);
    expect(thumbnail.size).toBe(Buffer.byteLength('miniatura'));
  });

  it('distingue archivo ausente, carpeta y mundo que no coincide', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const relativePath = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });

    expectAssetError(
      () =>
        resolveAssetFile({
          assetsDir,
          relativePath,
          worldId: WORLD_ID,
          assetId: ASSET_ID,
          variant: 'asset',
        }),
      'ASSET_NOT_FOUND',
    );

    await mkdir(join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.webp`), {
      recursive: true,
    });

    expectAssetError(
      () =>
        resolveAssetFile({
          assetsDir,
          relativePath,
          worldId: WORLD_ID,
          assetId: ASSET_ID,
          variant: 'asset',
        }),
      'ASSET_NOT_FOUND',
    );

    expectAssetError(
      () =>
        resolveAssetFile({
          assetsDir,
          relativePath,
          worldId: OTHER_WORLD_ID,
          assetId: ASSET_ID,
          variant: 'asset',
        }),
      'ASSET_PATH_INVALID',
    );
  });

  it('rechaza una variante distinta de la ruta y traversal en la base', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const relativePath = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });

    await createAssetFile(assetsDir, relativePath);

    expectAssetError(
      () =>
        resolveAssetFile({
          assetsDir,
          relativePath,
          worldId: WORLD_ID,
          assetId: ASSET_ID,
          variant: 'thumb',
        }),
      'ASSET_PATH_INVALID',
    );

    // La ruta pertenece a otro asset: una fila manipulada no puede servirse.
    expectAssetError(
      () =>
        resolveAssetFile({
          assetsDir,
          relativePath,
          worldId: WORLD_ID,
          assetId: OTHER_WORLD_ID,
          variant: 'asset',
        }),
      'ASSET_PATH_INVALID',
    );

    for (const traversal of [
      `worlds/../../${ASSET_ID}.webp`,
      `worlds/${WORLD_ID}/../../../${ASSET_ID}.webp`,
      `../${ASSET_ID}.webp`,
      `worlds/${WORLD_ID}/${ASSET_ID}.webp/../../x.webp`,
    ]) {
      expectAssetError(
        () =>
          resolveAssetFile({
            assetsDir,
            relativePath: traversal,
            worldId: WORLD_ID,
            assetId: ASSET_ID,
            variant: 'asset',
          }),
        'ASSET_PATH_INVALID',
      );
    }
  });

  it('rechaza un enlace simbólico en lugar del archivo', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'outside.webp');
    const relativePath = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });
    const target = join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.webp`);

    await writeFile(outside, 'fuera de assets', 'utf8');
    await mkdir(join(assetsDir, 'worlds', WORLD_ID), { recursive: true });

    try {
      await symlink(outside, target, 'file');
    } catch {
      // Windows sin modo desarrollador no permite crear symlinks de archivo.
      context.skip();
      return;
    }

    expectAssetError(
      () =>
        resolveAssetFile({
          assetsDir,
          relativePath,
          worldId: WORLD_ID,
          assetId: ASSET_ID,
          variant: 'asset',
        }),
      'ASSET_PATH_INVALID',
    );
  });

  it('rechaza una junction de directorio que sale de assets/', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outsideWorld = join(root, 'mundo-externo');
    const relativePath = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });

    await mkdir(outsideWorld, { recursive: true });
    await writeFile(join(outsideWorld, `${ASSET_ID}.webp`), 'externo', 'utf8');
    await mkdir(join(assetsDir, 'worlds'), { recursive: true });

    try {
      await symlink(
        outsideWorld,
        join(assetsDir, 'worlds', WORLD_ID),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    expectAssetError(
      () =>
        resolveAssetFile({
          assetsDir,
          relativePath,
          worldId: WORLD_ID,
          assetId: ASSET_ID,
          variant: 'asset',
        }),
      'ASSET_PATH_INVALID',
    );
  });

  it('calcula la ruta de escritura sin exigir que exista', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const relativePath = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });

    expect(resolveStoreFilePath(assetsDir, relativePath)).toBe(
      resolve(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.webp`),
    );
    expectAssetError(
      () => resolveStoreFilePath(assetsDir, '../fuera.webp'),
      'ASSET_PATH_INVALID',
    );
  });

  it('rechaza la ruta de escritura si worlds/ es una junction', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'fuera-de-assets');
    const relativePath = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });

    await mkdir(assetsDir, { recursive: true });
    await mkdir(outside, { recursive: true });

    try {
      await symlink(
        outside,
        join(assetsDir, 'worlds'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    expectAssetError(
      () => resolveStoreFilePath(assetsDir, relativePath),
      'ASSET_PATH_INVALID',
    );
  });

  it('exige que la raíz de assets sea real y esté contenida en userData', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');

    await mkdir(assetsDir, { recursive: true });

    expect(() => assertAssetRoot(root, assetsDir)).not.toThrow();
    // Una carpeta ausente se acepta: la composición la crea antes de usarla.
    expect(() => assertAssetRoot(root, join(root, 'sin-crear'))).not.toThrow();

    const outside = join(root, 'datos-externos');
    const linked = join(root, 'assets-enlazado');

    await mkdir(outside, { recursive: true });

    try {
      await symlink(
        outside,
        linked,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    expectAssetError(() => assertAssetRoot(root, linked), 'ASSET_PATH_INVALID');

    // Una raíz fuera de userData tampoco es válida.
    const otherRoot = await createTemporaryDirectory();

    expectAssetError(
      () => assertAssetRoot(root, otherRoot),
      'ASSET_PATH_INVALID',
    );
  });

  it('comprueba contención de forma estricta', () => {
    const root = resolve(process.cwd(), 'datos', 'assets');
    const inside = resolve(root, 'worlds', 'x.webp');

    expect(() => assertContained(root, inside)).not.toThrow();
    expectAssetError(
      () => assertContained(root, resolve(root, '..', 'fuera.webp')),
      'ASSET_PATH_INVALID',
    );
    expectAssetError(() => assertContained(root, root), 'ASSET_PATH_INVALID');
    expectAssetError(
      () => assertContained(root, resolve(process.cwd(), 'otro', 'x.webp')),
      'ASSET_PATH_INVALID',
    );
  });
});
