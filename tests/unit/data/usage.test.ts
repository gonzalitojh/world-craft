import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { measureDataUsage } from '@/main/data/usage';
import { resolveDataPaths, type DataPaths } from '@/main/db/paths';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-data-usage-'));
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

async function createFixture(): Promise<DataPaths> {
  const root = await createTemporaryDirectory();
  const paths = resolveDataPaths(root);

  await mkdir(join(paths.assetsDir, 'worlds', WORLD_ID), { recursive: true });
  await mkdir(join(paths.assetsDir, '.tmp'), { recursive: true });
  await mkdir(join(paths.backupsDir, 'daily', 'one'), { recursive: true });
  await mkdir(join(paths.importsDir, '.tmp'), { recursive: true });
  await mkdir(join(paths.exportsDir, '.tmp'), { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });
  await mkdir(paths.dataDir, { recursive: true });

  await writeFile(paths.databaseFile, '0123456789', 'utf8');
  await writeFile(`${paths.databaseFile}-wal`, '12345', 'utf8');
  await writeFile(join(paths.assetsDir, 'worlds', WORLD_ID, 'a.webp'), 'abcd');
  await writeFile(join(paths.assetsDir, '.tmp', 'b.tmp'), 'ab');
  await writeFile(join(paths.backupsDir, 'daily', 'one', 'copy'), 'abc');
  await writeFile(join(paths.logsDir, 'startup.log'), 'abcdef');
  await writeFile(join(paths.importsDir, '.tmp', 'i'), 'i');
  await writeFile(join(paths.exportsDir, '.tmp', 'e'), '1234567');

  return paths;
}

describe('medición de uso de disco', () => {
  it('suma bytes y entradas por categoría sin devolver rutas', async () => {
    const paths = await createFixture();
    const usage = await measureDataUsage({ paths });

    expect(usage.categories.database).toEqual({
      bytes: 15,
      entries: 2,
      partial: false,
    });
    expect(usage.categories.assets).toEqual({
      bytes: 4,
      entries: 3,
      partial: false,
    });
    expect(usage.categories.backups).toEqual({
      bytes: 3,
      entries: 3,
      partial: false,
    });
    expect(usage.categories.logs).toEqual({
      bytes: 6,
      entries: 1,
      partial: false,
    });
    expect(usage.categories.temporary).toEqual({
      bytes: 10,
      entries: 3,
      partial: false,
    });
    expect(usage.totalBytes).toBe(38);
    expect(usage.totalEntries).toBe(12);
    expect(usage.partial).toBe(false);
    expect(JSON.stringify(usage)).not.toContain(paths.userDataDir);
  });

  it('marca partial y conserva el total si una categoría falla', async () => {
    const paths = await createFixture();
    await rm(paths.logsDir, { recursive: true, force: true });
    await writeFile(paths.logsDir, 'no es una carpeta', 'utf8');

    const usage = await measureDataUsage({ paths });

    expect(usage.categories.logs).toEqual({
      bytes: 0,
      entries: 0,
      partial: true,
    });
    expect(usage.categories.assets.bytes).toBe(4);
    expect(usage.totalBytes).toBe(32);
    expect(usage.partial).toBe(true);
  });

  it('respeta el límite de entradas y lo marca como parcial', async () => {
    const paths = await createFixture();
    const usage = await measureDataUsage({ paths, maxEntries: 3 });

    expect(usage.totalEntries).toBe(3);
    expect(usage.partial).toBe(true);
  });

  it('respeta el límite de tiempo con un reloj inyectado', async () => {
    const paths = await createFixture();
    let tick = 0;
    const usage = await measureDataUsage({
      paths,
      maxDurationMs: 3,
      now: () => tick++,
    });

    expect(usage.partial).toBe(true);
    expect(usage.totalEntries).toBeLessThan(12);
  });

  it('no sigue enlaces simbólicos ni cuenta su contenido', async (context) => {
    const paths = await createFixture();
    const outside = await createTemporaryDirectory();
    const outsideFile = join(outside, 'fuera.bin');
    await writeFile(outsideFile, 'x'.repeat(1000), 'utf8');

    try {
      await symlink(outsideFile, join(paths.assetsDir, 'enlace'), 'file');
    } catch {
      context.skip();
    }

    const usage = await measureDataUsage({ paths });

    expect(usage.totalBytes).toBe(38);
    expect(usage.categories.assets.partial).toBe(true);
    expect(usage.partial).toBe(true);
  });
});
