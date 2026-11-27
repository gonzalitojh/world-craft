import { describe, expect, it } from 'vitest';

import {
  countQuarantine,
  quarantineWorldAssets,
} from '@/main/assets/quarantine';
import { createAssetRepository } from '@/main/assets/store';
import { closeDatabase, openDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';

import { createTestDatabase } from '../helpers/temp-db';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const WORLD_SLUG = 'mundo-de-cuarentena';
const ASSET_ID = '01900000-0000-7000-8000-000000000002';
const TIME = 1_760_000_000_000;

describe('cuarentena de assets', () => {
  it('mueve las filas del mundo sin tocar los metadatos y devuelve el recuento', async () => {
    const test = await createTestDatabase();

    try {
      const startup = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      if (startup.status !== 'ready') {
        throw new Error(`La base no arrancó: ${startup.code}.`);
      }

      const sqlite = startup.client.sqlite;

      try {
        sqlite
          .prepare(
            `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at)
             VALUES (?, 'Mundo', ?, '[]', 'active', 'es', '{}', ?, ?)`,
          )
          .run(WORLD_ID, WORLD_SLUG, TIME, TIME);
        createAssetRepository(startup.client.orm).insert({
          id: ASSET_ID,
          worldId: WORLD_ID,
          kind: 'image',
          relativePath: `worlds/${WORLD_ID}/${ASSET_ID}.webp`,
          mime: 'image/webp',
          size: 128,
          width: 640,
          height: 480,
          alt: 'Bosque',
          hash: 'a'.repeat(64),
          createdAt: TIME,
        });

        expect(countQuarantine(sqlite)).toEqual({ assets: 0, references: 0 });
        expect(quarantineWorldAssets(sqlite, WORLD_ID, TIME)).toBe(1);

        expect(
          sqlite
            .prepare('SELECT count(*) AS total FROM assets WHERE id = ?')
            .get(ASSET_ID),
        ).toEqual({ total: 0 });
        expect(
          sqlite
            .prepare(
              `SELECT world_id, kind, relative_path, mime, size, width, height,
                      alt, hash, created_at, reason, quarantined_at
               FROM assets_quarantine WHERE id = ?`,
            )
            .get(ASSET_ID),
        ).toEqual({
          world_id: WORLD_ID,
          kind: 'image',
          relative_path: `worlds/${WORLD_ID}/${ASSET_ID}.webp`,
          mime: 'image/webp',
          size: 128,
          width: 640,
          height: 480,
          alt: 'Bosque',
          hash: 'a'.repeat(64),
          created_at: TIME,
          reason: 'world-purged',
          quarantined_at: TIME,
        });
        expect(countQuarantine(sqlite)).toEqual({ assets: 1, references: 0 });
      } finally {
        closeDatabase(sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('devuelve ceros en una base sin las tablas de cuarentena', () => {
    const sqlite = openDatabase({ file: ':memory:', deferWritePragmas: true });

    try {
      expect(countQuarantine(sqlite)).toEqual({ assets: 0, references: 0 });
    } finally {
      closeDatabase(sqlite);
    }
  });
});
