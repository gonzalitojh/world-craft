import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cleanupTransferTempDirectories } from '@/main/transfer/cleanup';

const DIRECTORIES: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-cleanup-'));
  DIRECTORIES.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    DIRECTORIES.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true, maxRetries: 3 }),
    ),
  );
});

describe('limpieza de temporales de transferencia', () => {
  it('vacía imports, exports y assets temporales sin tocar assets/worlds', async () => {
    const root = await temporaryDirectory();
    const importsDir = join(root, 'imports');
    const importsTempDir = join(importsDir, '.tmp');
    const exportsTempDir = join(root, 'exports', '.tmp');
    const assetsTempDir = join(root, 'assets', '.tmp');
    const assetsWorldsDir = join(root, 'assets', 'worlds');

    await writeFile(
      join(
        await ensure(
          join(importsTempDir, '018f1000-0000-7000-8000-000000000901'),
        ),
        'plan.json',
      ),
      '{}',
      'utf8',
    );
    await writeFile(
      join(
        await ensure(join(importsDir, '018f1000-0000-7000-8000-000000000902')),
        'plan.json',
      ),
      '{}',
      'utf8',
    );
    await writeFile(
      join(await ensure(join(importsDir, 'no-borrar')), 'nota.txt'),
      'dato ajeno',
      'utf8',
    );
    await writeFile(
      join(await ensure(join(exportsTempDir, 'op-2')), 'x.partial'),
      'x',
      'utf8',
    );
    await writeFile(
      join(await ensure(join(assetsTempDir, 'op-3')), 'a.webp'),
      'x',
      'utf8',
    );

    const worldFile = join(
      await ensure(join(assetsWorldsDir, 'mundo')),
      'asset.webp',
    );
    await writeFile(worldFile, 'dato del usuario', 'utf8');

    const result = await cleanupTransferTempDirectories({
      importsTempDir,
      exportsTempDir,
      assetsTempDir,
    });

    expect(result.removed).toBe(4);
    expect(await readdir(importsTempDir)).toEqual([]);
    expect(await readdir(exportsTempDir)).toEqual([]);
    expect(await readdir(assetsTempDir)).toEqual([]);
    expect((await readdir(importsDir)).sort()).toEqual(['.tmp', 'no-borrar']);
    expect((await stat(worldFile)).size).toBeGreaterThan(0);
  });

  it('elimina un staging interrumpido en imports/.tmp aunque el UUID sea válido', async () => {
    const root = await temporaryDirectory();
    const importsDir = join(root, 'imports');
    const importsTempDir = join(importsDir, '.tmp');
    const operationId = '018f1000-0000-7000-8000-000000000903';

    await writeFile(
      join(await ensure(join(importsTempDir, operationId)), 'world.json'),
      '{"parcial":true}',
      'utf8',
    );

    await cleanupTransferTempDirectories({
      importsTempDir,
      exportsTempDir: join(root, 'exports', '.tmp'),
      assetsTempDir: join(root, 'assets', '.tmp'),
    });

    expect(await readdir(importsTempDir)).toEqual([]);
  });

  it.runIf(process.platform === 'win32')(
    'no sigue una junction al limpiar los temporales',
    async () => {
      const root = await temporaryDirectory();
      const importsDir = join(root, 'imports');
      const importsTempDir = join(importsDir, '.tmp');
      const outside = join(root, 'fuera');
      const sentinel = join(outside, 'sentinel.txt');
      const link = join(importsTempDir, '018f1000-0000-7000-8000-000000000904');

      await ensure(importsTempDir);
      await ensure(outside);
      await writeFile(sentinel, 'dato externo', 'utf8');

      try {
        await symlink(outside, link, 'junction');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
          return;
        }

        throw error;
      }

      const result = await cleanupTransferTempDirectories({
        importsTempDir,
        exportsTempDir: join(root, 'exports', '.tmp'),
        assetsTempDir: join(root, 'assets', '.tmp'),
      });

      expect(result.removed).toBe(0);
      expect(await readFile(sentinel, 'utf8')).toBe('dato externo');
      expect(await readdir(outside)).toEqual(['sentinel.txt']);
    },
  );

  it('crea las carpetas si no existen y no falla con una ya vacía', async () => {
    const root = await temporaryDirectory();
    const importsTempDir = join(root, 'imports', '.tmp');
    const exportsTempDir = join(root, 'exports', '.tmp');
    const assetsTempDir = join(root, 'assets', '.tmp');

    await expect(
      cleanupTransferTempDirectories({
        importsTempDir,
        exportsTempDir,
        assetsTempDir,
      }),
    ).resolves.toEqual({ removed: 0 });
    expect((await stat(importsTempDir)).isDirectory()).toBe(true);
  });
});

async function ensure(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  return directory;
}
