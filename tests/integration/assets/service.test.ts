import { describe, expect, it } from 'vitest';

import { AssetError } from '@/main/assets/errors';
import { createAssetsService } from '@/main/assets/service';
import { createAssetRepository } from '@/main/assets/store';
import { closeDatabase, type SqliteDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';

import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const WORLD_A = '01900000-0000-7000-8000-000000000001';
const WORLD_B = '01900000-0000-7000-8000-000000000002';
const ASSET_A = '01900000-0000-7000-8000-000000000010';
const ASSET_B = '01900000-0000-7000-8000-000000000011';

interface Fixture {
  readonly test: TempDatabase;
  readonly sqlite: SqliteDatabase;
  readonly repository: ReturnType<typeof createAssetRepository>;
  readonly service: ReturnType<typeof createAssetsService>;
  close(): Promise<void>;
}

async function createFixture(): Promise<Fixture> {
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
    service: createAssetsService({
      userDataDir: test.userDataDir,
      repository,
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

function insertAsset(
  repository: ReturnType<typeof createAssetRepository>,
  id: string,
  worldId: string,
  alt: string,
): void {
  repository.insert({
    id,
    worldId,
    kind: 'image',
    relativePath: `worlds/${worldId}/${id}.webp`,
    mime: 'image/webp',
    size: 10,
    width: 320,
    height: 240,
    alt,
    hash: 'a'.repeat(64),
    createdAt: 1_760_000_000_000,
  });
}

describe('servicio de assets expuesto al renderer', () => {
  it('lista solo las imágenes del mundo y nunca devuelve rutas', async () => {
    const fixture = await createFixture();

    try {
      insertWorld(fixture.sqlite, WORLD_A, 'Mundo A', 'mundo-a');
      insertWorld(fixture.sqlite, WORLD_B, 'Mundo B', 'mundo-b');
      insertAsset(fixture.repository, ASSET_A, WORLD_A, 'Mapa');
      insertAsset(fixture.repository, ASSET_B, WORLD_B, 'Retrato');

      const list = fixture.service.list(WORLD_A);

      expect(list).toEqual([
        {
          id: ASSET_A,
          worldId: WORLD_A,
          width: 320,
          height: 240,
          alt: 'Mapa',
          createdAt: 1_760_000_000_000,
        },
      ]);
      expect(JSON.stringify(list)).not.toContain('worlds/');
      expect(fixture.service.list(WORLD_B).map((asset) => asset.id)).toEqual([
        ASSET_B,
      ]);
    } finally {
      await fixture.close();
    }
  });

  it('rechaza un mundo inexistente o en la papelera', async () => {
    const fixture = await createFixture();

    try {
      expect(() => fixture.service.list(WORLD_A)).toThrow(AssetError);

      insertWorld(fixture.sqlite, WORLD_A, 'Mundo A', 'mundo-a');
      fixture.sqlite
        .prepare('UPDATE worlds SET deleted_at = ? WHERE id = ?')
        .run(1_760_000_000_000, WORLD_A);

      expect(() => fixture.service.list(WORLD_A)).toThrow(AssetError);
    } finally {
      await fixture.close();
    }
  });
});
