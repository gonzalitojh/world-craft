import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { importAsset } from '@/main/assets/import-asset';
import type { ProcessedImage } from '@/main/assets/image';
import { purgeOrphans } from '@/main/assets/orphans';
import type { AssetRecord } from '@/main/assets/store';
import { createUuidv7Generator } from '@/main/db/ids';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0xb1),
});

const WORLD_ID = generator.generate();
const ASSET_ID = generator.generate();
const ORPHAN_WORLD_ID = generator.generate();
const ORPHAN_ID = generator.generate();
const NOW = 1_760_000_700_000;

const FAKE_IMAGE: ProcessedImage = {
  data: Buffer.from('webp-principal'),
  width: 32,
  height: 24,
  size: 14,
  hash: 'a'.repeat(64),
  mime: 'image/webp',
  thumbnail: {
    data: Buffer.from('webp-miniatura'),
    width: 32,
    height: 24,
    size: 15,
  },
};

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-lock-'));
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

describe('serialización de importación y purga', () => {
  it('una purga no borra un asset que se está importando', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const assetsTempDir = join(assetsDir, '.tmp');
    const records: AssetRecord[] = [];
    const repository = {
      insert(record: AssetRecord) {
        records.push(record);
      },
      listAll: () => records,
    };

    await mkdir(join(assetsDir, 'worlds'), { recursive: true });
    await mkdir(assetsTempDir, { recursive: true });

    let releaseImport: () => void = () => {};
    const importGate = new Promise<void>((resolve) => {
      releaseImport = resolve;
    });
    let signalStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });

    const importPromise = importAsset(
      {
        userDataDir: root,
        assetsDir,
        assetsTempDir,
        repository,
        generateId: () => ASSET_ID,
        process: async () => {
          signalStarted();
          // La importación queda con el cerrojo tomado y sin INSERT todavía.
          await importGate;

          return FAKE_IMAGE;
        },
      },
      {
        worldId: WORLD_ID,
        kind: 'image',
        source: { kind: 'buffer', data: Buffer.from('png') },
      },
    );

    await started;

    let purgeSettled = false;
    const purgePromise = purgeOrphans(
      {
        userDataDir: root,
        assetsDir,
        orphanBackupsDir: join(root, 'backups', 'orphans'),
        repository,
        now: () => NOW,
      },
      { confirmation: 'purge-orphans' },
    ).finally(() => {
      purgeSettled = true;
    });

    // La purga espera al cerrojo: no puede planificar ni borrar nada aún.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(purgeSettled).toBe(false);

    releaseImport();

    const imported = await importPromise;
    const purgeResult = await purgePromise;

    expect(records).toHaveLength(1);
    expect(purgeResult.purged).toEqual([]);
    expect(purgeResult.backupDirectory).toBeNull();
    expect(
      await readFile(
        join(assetsDir, ...imported.asset.relativePath.split('/')),
        'utf8',
      ),
    ).toBe('webp-principal');
  });

  it('libera el cerrojo si una importación falla y la purga posterior continúa', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const records: AssetRecord[] = [];
    const repository = {
      insert(record: AssetRecord) {
        records.push(record);
      },
      listAll: () => records,
    };
    const orphanPath = `worlds/${ORPHAN_WORLD_ID}/${ORPHAN_ID}.webp`;

    await mkdir(join(assetsDir, 'worlds', ORPHAN_WORLD_ID), {
      recursive: true,
    });
    await mkdir(join(assetsDir, '.tmp'), { recursive: true });
    await writeFile(
      join(assetsDir, 'worlds', ORPHAN_WORLD_ID, `${ORPHAN_ID}.webp`),
      'huerfano',
      'utf8',
    );

    await expect(
      importAsset(
        {
          userDataDir: root,
          assetsDir,
          assetsTempDir: join(assetsDir, '.tmp'),
          repository,
          generateId: () => ASSET_ID,
          process: async () => {
            throw new Error('fallo simulado de procesamiento');
          },
        },
        {
          worldId: WORLD_ID,
          kind: 'image',
          source: { kind: 'buffer', data: Buffer.from('png') },
        },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_STORAGE_FAILED' });

    const result = await purgeOrphans(
      {
        userDataDir: root,
        assetsDir,
        orphanBackupsDir: join(root, 'backups', 'orphans'),
        repository,
        now: () => NOW,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(result.purged).toEqual([orphanPath]);
    expect(records).toEqual([]);
  });
});
