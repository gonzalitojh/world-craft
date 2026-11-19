import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { importAsset } from '@/main/assets/import-asset';
import { sha256 } from '@/main/assets/image';
import { planOrphanCleanup, purgeOrphans } from '@/main/assets/orphans';
import type { AssetRecord } from '@/main/assets/store';
import { createUuidv7Generator } from '@/main/db/ids';

import {
  createAssetFixture,
  writeAssetFile,
  type AssetFixture,
} from '../helpers/temp-assets';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0xa1),
});

const WORLD_ID = generator.generate();
const NOW = 1_760_000_900_000;

const fixtures: AssetFixture[] = [];

async function createFixture(): Promise<AssetFixture> {
  const fixture = await createAssetFixture();
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

async function importPng(
  fixture: AssetFixture,
  worldId = WORLD_ID,
): Promise<AssetRecord> {
  const png = await sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 90, g: 20, b: 120 },
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
      worldId,
      kind: 'image',
      source: { kind: 'buffer', data: png },
    },
  );

  return asset;
}

function expectedTimestamp(): string {
  return new Date(NOW).toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

describe('purga de huérfanos con base de datos', { timeout: 60_000 }, () => {
  it('conserva los referenciados y deja copia verificable del huérfano', async () => {
    const fixture = await createFixture();
    const asset = await importPng(fixture);
    const orphanId = generator.generate();
    const orphanPath = `worlds/${WORLD_ID}/${orphanId}.webp`;
    const orphanFile = await writeAssetFile(
      fixture.paths.assetsDir,
      orphanPath,
      'huerfano-real',
    );

    const result = await purgeOrphans(
      {
        userDataDir: fixture.userDataDir,
        assetsDir: fixture.paths.assetsDir,
        orphanBackupsDir: fixture.paths.orphanBackupsDir,
        repository: fixture.repository,
        now: () => NOW,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(result.purged).toEqual([orphanPath]);
    expect(result.backupDirectory).toBe(
      join(fixture.paths.orphanBackupsDir, expectedTimestamp()),
    );

    // La fila y sus archivos siguen intactos, con el contenido real.
    expect(fixture.repository.findById(asset.id)).not.toBeNull();

    const mainBytes = await readFile(
      join(fixture.paths.assetsDir, ...asset.relativePath.split('/')),
    );

    expect(mainBytes.byteLength).toBe(asset.size);
    expect(sha256(mainBytes)).toBe(asset.hash);

    const thumbnailBytes = await readFile(
      join(
        fixture.paths.assetsDir,
        'worlds',
        WORLD_ID,
        `${asset.id}.thumb.webp`,
      ),
    );

    expect(thumbnailBytes.byteLength).toBeGreaterThan(0);
    expect(thumbnailBytes.subarray(0, 4).toString('ascii')).toBe('RIFF');

    // El huérfano desapareció, pero su copia está en el manifiesto.
    await expect(readFile(orphanFile)).rejects.toMatchObject({
      code: 'ENOENT',
    });

    const manifest = JSON.parse(
      await readFile(
        join(result.backupDirectory as string, 'manifest.json'),
        'utf8',
      ),
    ) as { files: { path: string; sha256: string }[] };

    expect(manifest.files).toEqual([
      expect.objectContaining({ path: orphanPath }),
    ]);
    expect(
      await readFile(
        join(
          result.backupDirectory as string,
          'assets',
          ...orphanPath.split('/'),
        ),
        'utf8',
      ),
    ).toBe('huerfano-real');
  });

  it('informa de archivos ausentes sin borrar ni crear copia extra', async () => {
    const fixture = await createFixture();
    const asset = await importPng(fixture);
    const mainFile = join(
      fixture.paths.assetsDir,
      ...asset.relativePath.split('/'),
    );

    await rm(mainFile);

    const plan = planOrphanCleanup({
      assetsDir: fixture.paths.assetsDir,
      records: fixture.repository.listAll(),
    });

    expect(plan.missingFiles).toEqual([asset.relativePath]);
    expect(plan.unreferencedFiles).toEqual([]);

    const result = await purgeOrphans(
      {
        userDataDir: fixture.userDataDir,
        assetsDir: fixture.paths.assetsDir,
        orphanBackupsDir: fixture.paths.orphanBackupsDir,
        repository: fixture.repository,
        now: () => NOW,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(result.purged).toEqual([]);
    expect(result.backupDirectory).toBeNull();
    expect(fixture.repository.findById(asset.id)).not.toBeNull();
  });

  it('purga los temporales y es idempotente', async () => {
    const fixture = await createFixture();
    await importPng(fixture);

    await writeAssetFile(
      fixture.paths.assetsDir,
      `.tmp/${generator.generate()}/main.webp`,
      'temporal',
    );

    const first = await purgeOrphans(
      {
        userDataDir: fixture.userDataDir,
        assetsDir: fixture.paths.assetsDir,
        orphanBackupsDir: fixture.paths.orphanBackupsDir,
        repository: fixture.repository,
        now: () => NOW,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(first.purged).toHaveLength(1);
    expect(first.purged[0]).toMatch(/^\.tmp\//);

    const second = await purgeOrphans(
      {
        userDataDir: fixture.userDataDir,
        assetsDir: fixture.paths.assetsDir,
        orphanBackupsDir: fixture.paths.orphanBackupsDir,
        repository: fixture.repository,
        now: () => NOW + 1_000,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(second.purged).toEqual([]);
    expect(second.backupDirectory).toBeNull();
    expect(await readdir(fixture.paths.orphanBackupsDir)).toHaveLength(1);
  });
});
