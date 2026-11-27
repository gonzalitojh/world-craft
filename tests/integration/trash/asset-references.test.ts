import { describe, expect, it } from 'vitest';

import { closeDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';
import {
  countExternalAssetReferences,
  resolvePurgeableWorlds,
} from '@/main/trash/asset-references';
import { createTrashService } from '@/main/trash/service';

import { createTestDatabase } from '../helpers/temp-db';

interface ForeignKeyRow {
  readonly table: string;
  readonly from: string;
}

const BASE_TIME = 1_760_000_000_000;
const W1 = '01900000-0000-7000-8000-000000000101';
const W2 = '01900000-0000-7000-8000-000000000102';
const W3 = '01900000-0000-7000-8000-000000000103';
const A1 = '01900000-0000-7000-8000-000000000201';
const A2 = '01900000-0000-7000-8000-000000000202';

describe('referencias a assets', () => {
  it('solo existen las tres FKs conocidas cuyo padre es assets', async () => {
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
        const tables = (
          sqlite
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            )
            .all() as { name: string }[]
        ).map((row) => row.name);
        const references: ForeignKeyRow[] = [];

        for (const table of tables) {
          const rows = sqlite
            .prepare(`PRAGMA foreign_key_list('${table}')`)
            .all() as {
            table: string;
            from: string;
          }[];

          for (const row of rows) {
            if (row.table === 'assets') {
              references.push({ table, from: row.from });
            }
          }
        }

        expect(
          references.sort((left, right) =>
            `${left.table}.${left.from}`.localeCompare(
              `${right.table}.${right.from}`,
            ),
          ),
        ).toEqual([
          { table: 'entities', from: 'image_asset_id' },
          { table: 'entity_gallery', from: 'asset_id' },
          { table: 'worlds', from: 'cover_asset_id' },
        ]);

        expect(
          sqlite.prepare('PRAGMA foreign_key_list(assets)').all() as {
            table: string;
            from: string;
            on_delete: string;
          }[],
        ).toEqual([
          expect.objectContaining({
            table: 'worlds',
            from: 'world_id',
            on_delete: 'RESTRICT',
          }),
        ]);
      } finally {
        closeDatabase(sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('cuenta referencias externas con varios mundos permitidos y bloquea el mundo correcto', async () => {
    const test = await createTestDatabase();

    try {
      const startup = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      if (startup.status !== 'ready') {
        throw new Error(`La base no arrancó: ${startup.code}.`);
      }

      const { sqlite, orm } = startup.client;

      try {
        const insertWorld = sqlite.prepare(
          `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, '[]', 'active', 'es', '{}', ?, ?, ?)`,
        );

        insertWorld.run(
          W1,
          'Mundo A',
          'mundo-a',
          BASE_TIME,
          BASE_TIME,
          BASE_TIME,
        );
        insertWorld.run(
          W2,
          'Mundo B',
          'mundo-b',
          BASE_TIME,
          BASE_TIME,
          BASE_TIME,
        );
        insertWorld.run(
          W3,
          'Mundo vivo',
          'mundo-vivo',
          BASE_TIME,
          BASE_TIME,
          null,
        );

        const insertAsset = sqlite.prepare(
          `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, hash, created_at)
           VALUES (?, ?, 'image', ?, 'image/webp', 10, ?, ?)`,
        );

        insertAsset.run(
          A1,
          W1,
          `worlds/${W1}/${A1}.webp`,
          'a'.repeat(64),
          BASE_TIME,
        );
        insertAsset.run(
          A2,
          W2,
          `worlds/${W2}/${A2}.webp`,
          'b'.repeat(64),
          BASE_TIME,
        );
        sqlite
          .prepare('UPDATE worlds SET cover_asset_id = ? WHERE id = ?')
          .run(A2, W3);

        const allowed = new Set([W1, W2]);

        expect(countExternalAssetReferences(sqlite, W2, allowed)).toBe(1);
        expect(countExternalAssetReferences(sqlite, W1, allowed)).toBe(0);
        expect(resolvePurgeableWorlds(sqlite, [W1, W2])).toEqual({
          purgeable: [W1],
          blocked: [W2],
        });

        const service = createTrashService({
          database: orm,
          sqlite,
          now: () => BASE_TIME + 1_000,
          createSafetyCopy: async () => true,
        });
        const result = await service.empty({ confirm: 'empty-trash' });

        expect(result.purged.worlds).toBe(1);
        expect(result.skipped).toBe(1);
        expect(
          sqlite
            .prepare('SELECT count(*) AS total FROM worlds WHERE id = ?')
            .get(W1),
        ).toEqual({ total: 0 });
        expect(
          sqlite
            .prepare('SELECT count(*) AS total FROM worlds WHERE id = ?')
            .get(W2),
        ).toEqual({ total: 1 });
        expect(
          sqlite
            .prepare('SELECT cover_asset_id FROM worlds WHERE id = ?')
            .get(W3),
        ).toEqual({ cover_asset_id: A2 });
        expect(
          sqlite
            .prepare('SELECT count(*) AS total FROM assets WHERE id = ?')
            .get(A2),
        ).toEqual({ total: 1 });
        expect(
          sqlite
            .prepare('SELECT count(*) AS total FROM assets_quarantine')
            .get(),
        ).toEqual({ total: 1 });
        expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      } finally {
        closeDatabase(sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });
});
