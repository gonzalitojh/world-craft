import { afterEach, describe, expect, it } from 'vitest';

import type { AssetRecord } from '@/main/assets/store';
import { createAssetRepository } from '@/main/assets/store';
import { closeDatabase } from '@/main/db/connection';
import { createUuidv7Generator } from '@/main/db/ids';
import { initializeDatabase } from '@/main/db/startup';

import { createAssetFixture, type AssetFixture } from '../helpers/temp-assets';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0x71),
});

const WORLD_ID = generator.generate();

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

function createRecord(overrides: Partial<AssetRecord> = {}): AssetRecord {
  const id = overrides.id ?? generator.generate();

  return {
    id,
    worldId: WORLD_ID,
    kind: 'image',
    relativePath: `worlds/${WORLD_ID}/${id}.webp`,
    mime: 'image/webp',
    size: 128,
    width: 640,
    height: 480,
    alt: null,
    hash: 'a'.repeat(64),
    createdAt: 1_760_000_000_000,
    ...overrides,
  };
}

describe('repositorio de assets', () => {
  it('inserta, busca, lista y cuenta filas', async () => {
    const fixture = await createFixture();
    const first = createRecord({ createdAt: 1_760_000_000_000 });
    const second = createRecord({
      createdAt: 1_760_000_001_000,
      alt: 'Mapa del norte',
      width: null,
      height: null,
    });

    fixture.repository.insert(first);
    fixture.repository.insert(second);

    expect(fixture.repository.findById(first.id)).toEqual(first);
    expect(fixture.repository.findById(second.id)).toEqual(second);
    expect(fixture.repository.findById(generator.generate())).toBeNull();
    expect(fixture.repository.count()).toBe(2);
    expect(fixture.repository.listAll()).toEqual([first, second]);
  });

  it('rechaza violaciones de los CHECK con código estable', async () => {
    const fixture = await createFixture();

    for (const invalid of [
      createRecord({ kind: 'video' as AssetRecord['kind'] }),
      createRecord({ size: -1 }),
      createRecord({ hash: 'corto' }),
    ]) {
      expect(() => fixture.repository.insert(invalid)).toThrow(
        expect.objectContaining({ code: 'ASSET_DATABASE_FAILED' }),
      );
    }

    expect(fixture.repository.count()).toBe(0);
  });

  it('conserva las filas al cerrar y reabrir la base', async () => {
    const fixture = await createFixture();
    const record = createRecord({ alt: 'Bosque' });

    fixture.repository.insert(record);
    fixture.close();

    const reopened = await initializeDatabase({
      userDataDir: fixture.userDataDir,
      migrationsDir: fixture.migrationsDir,
    });

    expect(reopened.status).toBe('ready');

    if (reopened.status !== 'ready') {
      throw new Error('Se esperaba ready.');
    }

    try {
      const repository = createAssetRepository(reopened.client.orm);

      expect(repository.findById(record.id)).toEqual(record);
      expect(reopened.schemaVersion).toBe(7);
    } finally {
      closeDatabase(reopened.client.sqlite);
    }
  });
});
