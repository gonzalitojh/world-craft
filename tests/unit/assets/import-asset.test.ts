import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { importAsset, normalizeAlt } from '@/main/assets/import-asset';
import type { ProcessedImage } from '@/main/assets/image';
import type { AssetLogger } from '@/main/assets/logger';
import { createAssetLogger } from '@/main/assets/logger';
import type { AssetRecord } from '@/main/assets/store';
import { createUuidv7Generator } from '@/main/db/ids';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0x31),
});

const WORLD_ID = generator.generate();
const ASSET_ID = generator.generate();

const FAKE_IMAGE: ProcessedImage = {
  data: Buffer.from('webp-principal'),
  width: 800,
  height: 600,
  size: 14,
  hash: 'a'.repeat(64),
  mime: 'image/webp',
  thumbnail: {
    data: Buffer.from('webp-miniatura'),
    width: 320,
    height: 240,
    size: 15,
  },
};

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-import-'));
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

function createRepository(options?: { readonly failOnInsert?: boolean }) {
  const inserted: AssetRecord[] = [];

  return {
    inserted,
    insert(record: AssetRecord) {
      if (options?.failOnInsert === true) {
        throw new Error('fallo simulado de SQLite');
      }

      inserted.push(record);
    },
  };
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);

    return true;
  } catch {
    return false;
  }
}

describe('normalización del texto alternativo', () => {
  it('recorta, convierte vacío en nulo y limita a 500 caracteres', () => {
    expect(normalizeAlt(undefined)).toBeNull();
    expect(normalizeAlt(null)).toBeNull();
    expect(normalizeAlt('   ')).toBeNull();
    expect(normalizeAlt('  Mapa del norte  ')).toBe('Mapa del norte');
    expect(normalizeAlt('a'.repeat(500))).toBe('a'.repeat(500));
    expect(() => normalizeAlt('a'.repeat(501))).toThrow(
      expect.objectContaining({ code: 'ASSET_INPUT_INVALID' }),
    );
  });

  it('rechaza caracteres de control y valores que no son texto', () => {
    expect(() => normalizeAlt('linea\u0000oculta')).toThrow(
      expect.objectContaining({ code: 'ASSET_INPUT_INVALID' }),
    );
    expect(() => normalizeAlt('salto\nde línea')).toThrow(
      expect.objectContaining({ code: 'ASSET_INPUT_INVALID' }),
    );
    expect(() => normalizeAlt(42)).toThrow(
      expect.objectContaining({ code: 'ASSET_INPUT_INVALID' }),
    );
  });
});

describe('importación de assets sin sharp', () => {
  it('publica el WebP y la miniatura y guarda la fila', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const assetsTempDir = join(assetsDir, '.tmp');
    const repository = createRepository();
    const process = vi.fn(async () => FAKE_IMAGE);

    const imported = await importAsset(
      {
        userDataDir: root,
        assetsDir,
        assetsTempDir,
        repository,
        generateId: () => ASSET_ID,
        now: () => 1_760_000_000_500,
        process,
      },
      {
        worldId: WORLD_ID,
        kind: 'image',
        alt: '  Bosque  ',
        source: { kind: 'buffer', data: Buffer.from('png-de-entrada') },
      },
    );

    expect(process).toHaveBeenCalledOnce();
    expect(imported.asset).toMatchObject({
      id: ASSET_ID,
      worldId: WORLD_ID,
      kind: 'image',
      relativePath: `worlds/${WORLD_ID}/${ASSET_ID}.webp`,
      mime: 'image/webp',
      size: FAKE_IMAGE.size,
      width: 800,
      height: 600,
      alt: 'Bosque',
      hash: FAKE_IMAGE.hash,
      createdAt: 1_760_000_000_500,
    });
    expect(imported.thumbnailRelativePath).toBe(
      `worlds/${WORLD_ID}/${ASSET_ID}.thumb.webp`,
    );
    expect(repository.inserted).toHaveLength(1);

    expect(
      await readFile(
        join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.webp`),
        'utf8',
      ),
    ).toBe('webp-principal');
    expect(
      await readFile(
        join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.thumb.webp`),
        'utf8',
      ),
    ).toBe('webp-miniatura');

    // Nunca se copia el original y el temporal queda limpio.
    expect(await fileExists(join(assetsDir, '.tmp', ASSET_ID))).toBe(false);

    const worldFiles = await readdir(join(assetsDir, 'worlds', WORLD_ID));

    expect(worldFiles).toHaveLength(2);
    expect(worldFiles).toEqual(
      expect.arrayContaining([`${ASSET_ID}.webp`, `${ASSET_ID}.thumb.webp`]),
    );
  });

  it('compensa si falla el INSERT: sin fila y sin archivos', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const assetsTempDir = join(assetsDir, '.tmp');
    const repository = createRepository({ failOnInsert: true });

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir,
          repository,
          generateId: () => ASSET_ID,
          process: async () => FAKE_IMAGE,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_DATABASE_FAILED' });

    expect(
      await fileExists(join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.webp`)),
    ).toBe(false);
    expect(
      await fileExists(
        join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.thumb.webp`),
      ),
    ).toBe(false);
    expect(await fileExists(join(assetsDir, '.tmp', ASSET_ID))).toBe(false);
    expect(repository.inserted).toEqual([]);
  });

  it('no sobrescribe un archivo existente si el ID se repite', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const repository = createRepository();
    const process = vi
      .fn<() => Promise<ProcessedImage>>()
      .mockResolvedValueOnce(FAKE_IMAGE)
      .mockResolvedValueOnce({
        ...FAKE_IMAGE,
        data: Buffer.from('webp-distinto'),
        thumbnail: {
          ...FAKE_IMAGE.thumbnail,
          data: Buffer.from('mini-distinta'),
        },
      });
    const dependencies = {
      userDataDir: root,
      assetsDir,
      assetsTempDir: join(assetsDir, '.tmp'),
      repository,
      generateId: () => ASSET_ID,
      process,
    };
    const input = {
      worldId: WORLD_ID,
      kind: 'image' as const,
      source: { kind: 'buffer' as const, data: Buffer.from('png') },
    };
    const mainFile = join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.webp`);

    await importAsset(dependencies, input);

    await expect(importAsset(dependencies, input)).rejects.toMatchObject({
      code: 'ASSET_STORAGE_FAILED',
    });

    expect(await readFile(mainFile, 'utf8')).toBe('webp-principal');
    expect(repository.inserted).toHaveLength(1);
    expect(await fileExists(join(assetsDir, '.tmp', ASSET_ID))).toBe(false);
  });

  it('rechaza el WebP procesado si supera el límite antes del INSERT', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const repository = createRepository();
    const process = vi.fn(async () => ({
      ...FAKE_IMAGE,
      size: 25 * 1024 * 1024 + 1,
    }));

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository,
          generateId: () => ASSET_ID,
          process,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' });

    expect(repository.inserted).toEqual([]);
    expect(await fileExists(join(assetsDir, 'worlds', WORLD_ID))).toBe(false);
  });

  it('no escribe si worlds/ es una junction', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'mundo-externo');
    const repository = createRepository();

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

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository,
          generateId: () => ASSET_ID,
          process: async () => FAKE_IMAGE,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(repository.inserted).toEqual([]);
    expect(await readdir(outside)).toEqual([]);
  });

  it('no escribe si .tmp es una junction', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'temporal-externo');
    const repository = createRepository();

    await mkdir(assetsDir, { recursive: true });
    await mkdir(outside, { recursive: true });

    try {
      await symlink(
        outside,
        join(assetsDir, '.tmp'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository,
          generateId: () => ASSET_ID,
          process: async () => FAKE_IMAGE,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(repository.inserted).toEqual([]);
    expect(await readdir(outside)).toEqual([]);
  });

  it('no escribe si worlds/<worldId> es una junction', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'mundo-externo');
    const repository = createRepository();

    await mkdir(join(assetsDir, 'worlds'), { recursive: true });
    await mkdir(outside, { recursive: true });

    try {
      await symlink(
        outside,
        join(assetsDir, 'worlds', WORLD_ID),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository,
          generateId: () => ASSET_ID,
          process: async () => FAKE_IMAGE,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(repository.inserted).toEqual([]);
    expect(await readdir(outside)).toEqual([]);
  });

  it('no escribe si .tmp/<assetId> es una junction', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'temporal-externo');
    const repository = createRepository();

    await mkdir(join(assetsDir, '.tmp'), { recursive: true });
    await mkdir(outside, { recursive: true });

    try {
      await symlink(
        outside,
        join(assetsDir, '.tmp', ASSET_ID),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository,
          generateId: () => ASSET_ID,
          process: async () => FAKE_IMAGE,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(repository.inserted).toEqual([]);
    expect(await readdir(outside)).toEqual([]);
  });

  it('no escribe si la raíz assets/ es una junction fuera de userData', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'datos-externos');
    const repository = createRepository();

    await mkdir(outside, { recursive: true });

    try {
      await symlink(
        outside,
        assetsDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository,
          generateId: () => ASSET_ID,
          process: async () => FAKE_IMAGE,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(repository.inserted).toEqual([]);
    expect(await readdir(outside)).toEqual([]);
  });

  it('rechaza un mundo inválido antes de procesar la imagen', async () => {
    const root = await createTemporaryDirectory();
    const process = vi.fn(async () => FAKE_IMAGE);

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir: join(root, 'assets'),
          assetsTempDir: join(root, 'assets', '.tmp'),
          repository: createRepository(),
          process,
        },
        {
          worldId: 'mundo-invalido',
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_INPUT_INVALID' });

    expect(process).not.toHaveBeenCalled();
  });

  it('rechaza un archivo de origen que supera el límite antes de leerlo', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const process = vi.fn(async () => FAKE_IMAGE);
    const bigFile = join(root, 'grande.png');

    // 25 MB + 1 byte: se rechaza por el tamaño del archivo, no por contenido.
    await writeFile(bigFile, Buffer.alloc(25 * 1024 * 1024 + 1));

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository: createRepository(),
          process,
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'path', path: bigFile },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' });

    expect(process).not.toHaveBeenCalled();
  });

  it('registra el rechazo sin rutas ni identificadores', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const logFile = join(root, 'assets.log');
    const logger: AssetLogger = createAssetLogger(logFile);
    const repository = createRepository();

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository,
          logger,
          generateId: () => ASSET_ID,
          process: async () => {
            throw new Error('fallo interno de sharp con ruta C:\\secreto');
          },
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_STORAGE_FAILED' });

    const log = await readFile(logFile, 'utf8');

    expect(log).toContain('"event":"asset.import"');
    expect(log).toContain('"outcome":"rejected"');
    expect(log).toContain('ASSET_STORAGE_FAILED');
    expect(log).not.toContain(WORLD_ID);
    expect(log).not.toContain(ASSET_ID);
    expect(log).not.toContain('C:\\\\secreto');
    expect(repository.inserted).toEqual([]);
  });
});
