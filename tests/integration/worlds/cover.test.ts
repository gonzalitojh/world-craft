import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { createAssetsService } from '@/main/assets/service';
import { createAssetRepository } from '@/main/assets/store';
import { planOrphanCleanup } from '@/main/assets/orphans';
import { closeDatabase, type SqliteDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';
import { WorldInputError } from '@/main/worlds/errors';
import { createWorldsService } from '@/main/worlds/service';

import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const WORLD_A = '01900000-0000-7000-8000-000000000101';
const WORLD_B = '01900000-0000-7000-8000-000000000102';

interface CoverFixture {
  readonly test: TempDatabase;
  readonly sqlite: SqliteDatabase;
  readonly assets: ReturnType<typeof createAssetsService>;
  readonly repository: ReturnType<typeof createAssetRepository>;
  readonly worlds: ReturnType<typeof createWorldsService>;
  close(): Promise<void>;
}

async function createCoverFixture(): Promise<CoverFixture> {
  const test = await createTestDatabase();
  const startup = await initializeDatabase({
    userDataDir: test.userDataDir,
    migrationsDir: test.migrationsDir,
  });

  if (startup.status !== 'ready') {
    await test.cleanup();
    throw new Error(`La base de prueba no arrancó: ${startup.code}.`);
  }

  const repository = createAssetRepository(startup.client.orm);

  return {
    test,
    sqlite: startup.client.sqlite,
    repository,
    assets: createAssetsService({
      userDataDir: test.userDataDir,
      repository,
    }),
    worlds: createWorldsService({
      database: startup.client.orm,
      sqlite: startup.client.sqlite,
    }),
    async close() {
      closeDatabase(startup.client.sqlite);
      await test.cleanup();
    },
  };
}

function insertWorld(
  sqlite: SqliteDatabase,
  id: string,
  name: string,
  slug: string,
): void {
  sqlite
    .prepare(
      `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at)
       VALUES (?, ?, ?, '[]', 'active', 'es', '{}', 1760000000000, 1760000000000)`,
    )
    .run(id, name, slug);
}

async function createPngFixture(
  test: TempDatabase,
  name: string,
): Promise<string> {
  const path = join(test.rootDir, name);

  await sharp({
    create: {
      width: 96,
      height: 96,
      channels: 3,
      background: '#5a7a55',
    },
  })
    .png()
    .toFile(path);

  return path;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('portada del mundo con importación real', () => {
  it('asocia imágenes propias, aísla otros mundos y conserva los archivos', async () => {
    const fixture = await createCoverFixture();

    try {
      insertWorld(fixture.sqlite, WORLD_A, 'Mundo A', 'mundo-a');
      insertWorld(fixture.sqlite, WORLD_B, 'Mundo B', 'mundo-b');

      const sourceA = await createPngFixture(fixture.test, 'a.png');
      const sourceB = await createPngFixture(fixture.test, 'b.png');
      const sourceForeign = await createPngFixture(fixture.test, 'ajena.png');

      const [assetA] = await fixture.assets.importFiles(WORLD_A, [sourceA]);
      const [assetB] = await fixture.assets.importFiles(WORLD_A, [sourceB]);
      const [foreign] = await fixture.assets.importFiles(WORLD_B, [
        sourceForeign,
      ]);

      if (
        assetA === undefined ||
        assetB === undefined ||
        foreign === undefined
      ) {
        throw new Error('Se esperaban tres imágenes importadas.');
      }

      const first = fixture.worlds.setCover({
        worldId: WORLD_A,
        assetId: assetA.id,
      });

      expect(first?.coverAssetId).toBe(assetA.id);

      // Cambiar A por B deja A disponible en el selector y en disco.
      const second = fixture.worlds.setCover({
        worldId: WORLD_A,
        assetId: assetB.id,
      });

      expect(second?.coverAssetId).toBe(assetB.id);
      expect(fixture.assets.list(WORLD_A).map((asset) => asset.id)).toEqual(
        expect.arrayContaining([assetA.id, assetB.id]),
      );

      const worldDir = join(fixture.test.paths.assetsDir, 'worlds', WORLD_A);
      const files = await readdir(worldDir);

      expect(files).toEqual(
        expect.arrayContaining([
          `${assetA.id}.webp`,
          `${assetA.id}.thumb.webp`,
          `${assetB.id}.webp`,
          `${assetB.id}.thumb.webp`,
        ]),
      );

      // La imagen de otro mundo se rechaza y no se mezcla con las de A.
      expect(() =>
        fixture.worlds.setCover({ worldId: WORLD_A, assetId: foreign.id }),
      ).toThrow(WorldInputError);

      expect(
        fixture.assets.list(WORLD_A).map((asset) => asset.id),
      ).not.toContain(foreign.id);
      expect(fixture.worlds.get(WORLD_A)?.coverAssetId).toBe(assetB.id);

      // Quitar la portada no borra la imagen: sigue disponible y referenciada.
      fixture.worlds.setCover({ worldId: WORLD_A, assetId: null });

      expect(fixture.worlds.get(WORLD_A)?.coverAssetId).toBeNull();
      expect(fixture.assets.list(WORLD_A).map((asset) => asset.id)).toEqual(
        expect.arrayContaining([assetA.id, assetB.id]),
      );
      expect(await exists(join(worldDir, `${assetB.id}.webp`))).toBe(true);

      const plan = planOrphanCleanup({
        assetsDir: fixture.test.paths.assetsDir,
        records: fixture.repository.listAll(),
      });

      expect(plan.unreferencedFiles).toEqual([]);
      expect(plan.orphanThumbnails).toEqual([]);
      expect(plan.missingFiles).toEqual([]);
    } finally {
      await fixture.close();
    }
  }, 60_000);
});
