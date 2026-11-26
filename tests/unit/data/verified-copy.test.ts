import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  copyAndVerifyAssetsTree,
  parseAssetsCopyManifest,
  verifyAssetsCopy,
} from '@/main/data/verified-copy';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-assets-copy-'));
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

function manifestWithPath(path: string) {
  return {
    formatId: 'world-craft-pre-delete-assets',
    version: 1,
    count: 1,
    bytes: 4,
    files: [{ path, size: 4, sha256: 'a'.repeat(64) }],
  };
}

function expectManifestPathRejected(path: string): void {
  try {
    parseAssetsCopyManifest(manifestWithPath(path));
  } catch (error) {
    expect(error).toMatchObject({ code: 'DATA_DELETE_COPY_FAILED' });
    return;
  }

  throw new Error(`La ruta ${path} debería rechazarse.`);
}

describe('copia verificable de assets', () => {
  it.each([
    ['../secreto.webp'],
    ['mundo/../../secreto.webp'],
    ['/etc/passwd'],
    ['C:/Windows/secreto.webp'],
    ['C:\\Windows\\secreto.webp'],
    ['mundo\\secreto.webp'],
    ['mundo:secreto.webp'],
    ['mundo/secreto\0.webp'],
    ['mundo/secreto.webp/'],
  ])('rechaza la ruta no segura %s en el manifiesto', (path) => {
    expectManifestPathRejected(path);
  });

  it('acepta una ruta relativa válida y verifica su contenido', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const manifestFile = join(root, 'assets-manifest.json');

    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(assetsDir, 'a.webp'), 'aaaa');

    const sha256 = createHash('sha256').update('aaaa').digest('hex');

    await writeFile(
      manifestFile,
      JSON.stringify({
        ...manifestWithPath('a.webp'),
        files: [{ path: 'a.webp', size: 4, sha256 }],
      }),
    );

    await expect(
      verifyAssetsCopy({ assetsDir, manifestFile }),
    ).resolves.toMatchObject({
      count: 1,
      files: [{ path: 'a.webp', size: 4, sha256 }],
    });
  });

  it('rechaza con verifyAssetsCopy un manifiesto con traversal', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const manifestFile = join(root, 'assets-manifest.json');

    await mkdir(assetsDir, { recursive: true });
    await writeFile(manifestFile, JSON.stringify(manifestWithPath('../fuera')));

    await expect(
      verifyAssetsCopy({ assetsDir, manifestFile }),
    ).rejects.toMatchObject({ code: 'DATA_DELETE_COPY_FAILED' });
  });
  it('copia el árbol, escribe el manifiesto y verifica hashes', async () => {
    const root = await createTemporaryDirectory();
    const source = join(root, 'assets');
    const target = join(root, 'backup', 'assets');
    const manifestFile = join(root, 'backup', 'assets-manifest.json');

    await mkdir(join(source, 'worlds', 'mundo'), { recursive: true });
    await writeFile(join(source, 'worlds', 'mundo', 'a.webp'), 'aaaa');
    await writeFile(join(source, 'suelto.txt'), 'bb', 'utf8');

    const result = await copyAndVerifyAssetsTree({
      sourceAssetsDir: source,
      targetAssetsDir: target,
      manifestFile,
    });

    expect(result.manifest.count).toBe(2);
    expect(result.manifest.bytes).toBe(6);
    expect(result.manifest.files.map((file) => file.path)).toEqual([
      'suelto.txt',
      'worlds/mundo/a.webp',
    ]);
    expect(JSON.stringify(result.manifest)).not.toContain(root);
    await expect(
      verifyAssetsCopy({ assetsDir: target, manifestFile }),
    ).resolves.toEqual(result.manifest);

    const raw = JSON.parse(await readFile(manifestFile, 'utf8')) as {
      files: { path: string }[];
    };

    expect(raw.files.every((file) => !file.path.includes(root))).toBe(true);
  });

  it('falla si la copia se altera después de verificarla', async () => {
    const root = await createTemporaryDirectory();
    const source = join(root, 'assets');
    const target = join(root, 'backup', 'assets');
    const manifestFile = join(root, 'backup', 'assets-manifest.json');

    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'a.webp'), 'aaaa');
    await copyAndVerifyAssetsTree({
      sourceAssetsDir: source,
      targetAssetsDir: target,
      manifestFile,
    });
    await writeFile(join(target, 'a.webp'), 'bbbb');

    await expect(
      verifyAssetsCopy({ assetsDir: target, manifestFile }),
    ).rejects.toMatchObject({ code: 'DATA_DELETE_COPY_FAILED' });
  });

  it('genera una copia vacía válida si assets no existe', async () => {
    const root = await createTemporaryDirectory();
    const result = await copyAndVerifyAssetsTree({
      sourceAssetsDir: join(root, 'no-existe'),
      targetAssetsDir: join(root, 'backup', 'assets'),
      manifestFile: join(root, 'backup', 'assets-manifest.json'),
    });

    expect(result.manifest).toMatchObject({
      count: 0,
      bytes: 0,
      files: [],
    });
  });

  it('no sigue un enlace o junction dentro de assets', async (context) => {
    const root = await createTemporaryDirectory();
    const source = join(root, 'assets');
    const outside = join(root, 'fuera');
    const target = join(root, 'backup', 'assets');
    const manifestFile = join(root, 'backup', 'assets-manifest.json');

    await mkdir(source, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'secreto.webp'), 'nunca');

    try {
      await symlink(
        outside,
        join(source, 'enlace'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
    }

    await expect(
      copyAndVerifyAssetsTree({
        sourceAssetsDir: source,
        targetAssetsDir: target,
        manifestFile,
      }),
    ).rejects.toMatchObject({ code: 'DATA_DELETE_COPY_FAILED' });
    await expect(readFile(join(outside, 'secreto.webp'), 'utf8')).resolves.toBe(
      'nunca',
    );
  });
});
