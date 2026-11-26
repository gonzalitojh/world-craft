import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { DataError } from '@/main/data/errors';
import { planDataOrphans, purgeDataOrphans } from '@/main/data/orphans';
import { resolveDataPaths } from '@/main/db/paths';
import type { AssetRecord } from '@/main/assets/store';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const REFERENCED_ID = '01900000-0000-7000-8000-000000000002';
const ORPHAN_ID = '01900000-0000-7000-8000-000000000003';
const TEMP_ID = '01900000-0000-7000-8000-000000000004';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-data-orphans-'));
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

function record(id: string, relativePath: string, size: number): AssetRecord {
  return {
    id,
    worldId: WORLD_ID,
    kind: 'image',
    relativePath,
    mime: 'image/webp',
    size,
    width: 10,
    height: 10,
    alt: null,
    hash: 'a'.repeat(64),
    createdAt: 1,
  };
}

interface Fixture {
  readonly userDataDir: string;
  readonly assetsDir: string;
  readonly orphanBackupsDir: string;
  readonly records: readonly AssetRecord[];
  readonly referencedFile: string;
}

async function createFixture(): Promise<Fixture> {
  const root = await createTemporaryDirectory();
  const paths = resolveDataPaths(root);
  const referencedRelative = `worlds/${WORLD_ID}/${REFERENCED_ID}.webp`;
  const worldDir = join(paths.assetsDir, 'worlds', WORLD_ID);

  await mkdir(worldDir, { recursive: true });
  await mkdir(join(paths.assetsDir, '.tmp'), { recursive: true });
  await mkdir(paths.orphanBackupsDir, { recursive: true });

  const referencedFile = join(worldDir, `${REFERENCED_ID}.webp`);
  await writeFile(referencedFile, '0123456789', 'utf8');
  await writeFile(join(worldDir, `${ORPHAN_ID}.webp`), 'x'.repeat(20), 'utf8');
  await writeFile(join(worldDir, `${ORPHAN_ID}.thumb.webp`), 'xxx', 'utf8');
  await writeFile(join(paths.assetsDir, '.tmp', `${TEMP_ID}.tmp`), '12345');

  return {
    userDataDir: paths.userDataDir,
    assetsDir: paths.assetsDir,
    orphanBackupsDir: paths.orphanBackupsDir,
    records: [record(REFERENCED_ID, referencedRelative, 10)],
    referencedFile,
  };
}

describe('huérfanos de datos', () => {
  it('resume el plan con recuentos y bytes, sin rutas', async () => {
    const fixture = await createFixture();
    const summary = planDataOrphans({
      assetsDir: fixture.assetsDir,
      records: fixture.records,
    });

    expect(summary).toEqual({
      purgeableFiles: 3,
      unreferencedFiles: 1,
      orphanThumbnails: 1,
      temporaryFiles: 1,
      missingFiles: 0,
      unexpectedEntries: 0,
      suspiciousLinks: 0,
      recoverableBytes: 28,
    });
    expect(JSON.stringify(summary)).not.toContain(fixture.assetsDir);
    expect(
      Object.values(summary).every((value) => typeof value === 'number'),
    ).toBe(true);
  });

  it('purga solo los huérfanos y conserva el asset referenciado', async () => {
    const fixture = await createFixture();
    const result = await purgeDataOrphans(
      {
        userDataDir: fixture.userDataDir,
        assetsDir: fixture.assetsDir,
        orphanBackupsDir: fixture.orphanBackupsDir,
        records: fixture.records,
        now: () => 1_760_000_000_000,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(result).toEqual({
      purgedFiles: 3,
      purgedBytes: 28,
      backupCreated: true,
    });
    await expect(access(fixture.referencedFile)).resolves.toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(fixture.userDataDir);
  });

  it('exige el token exacto y no borra nada si no coincide', async () => {
    const fixture = await createFixture();

    await expect(
      purgeDataOrphans(
        {
          userDataDir: fixture.userDataDir,
          assetsDir: fixture.assetsDir,
          orphanBackupsDir: fixture.orphanBackupsDir,
          records: fixture.records,
        },
        { confirmation: 'borrar' },
      ),
    ).rejects.toMatchObject({
      code: 'DATA_ORPHAN_CONFIRMATION_REQUIRED',
    });

    await expect(access(fixture.referencedFile)).resolves.toBeUndefined();
    await expect(
      access(join(fixture.assetsDir, 'worlds', WORLD_ID, `${ORPHAN_ID}.webp`)),
    ).resolves.toBeUndefined();
  });

  it('tolera una raíz de assets ausente sin inventar huérfanos', async () => {
    const fixture = await createFixture();
    const missingRoot = join(fixture.userDataDir, 'no-existe');

    // La planificación es tolerante a una raíz ausente: no hay huérfanos.
    expect(
      planDataOrphans({ assetsDir: missingRoot, records: fixture.records })
        .purgeableFiles,
    ).toBe(0);
  });

  it('expone DataError sin incluir rutas en el mensaje', async () => {
    const fixture = await createFixture();
    let caught: unknown;

    try {
      await purgeDataOrphans(
        {
          userDataDir: fixture.userDataDir,
          assetsDir: fixture.assetsDir,
          orphanBackupsDir: fixture.orphanBackupsDir,
          records: fixture.records,
        },
        { confirmation: 'otro-token' },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DataError);
    expect((caught as Error).message).not.toContain(fixture.userDataDir);
  });
});
