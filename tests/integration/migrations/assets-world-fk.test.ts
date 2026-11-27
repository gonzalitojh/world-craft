import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { verifyBackup } from '@/main/backup/verify';
import { closeDatabase, openDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';

import {
  createMigrationFixture,
  createTestDatabase,
  INIT_MIGRATION_SQL,
  REPOSITORY_MIGRATIONS_DIR,
  type TempDatabase,
} from '../helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;
const W1 = '01900000-0000-7000-8000-000000000101';
const W2 = '01900000-0000-7000-8000-000000000102';
const MISSING_WORLD = '01900000-0000-7000-8000-000000000199';
const E1 = '01900000-0000-7000-8000-000000000201';
const E2 = '01900000-0000-7000-8000-000000000202';
const A1 = '01900000-0000-7000-8000-000000000301';
const A2 = '01900000-0000-7000-8000-000000000302';
const A3 = '01900000-0000-7000-8000-000000000303';
const A4 = '01900000-0000-7000-8000-000000000304';
const A5 = '01900000-0000-7000-8000-000000000305';
const A6 = '01900000-0000-7000-8000-000000000306';
const A7 = '01900000-0000-7000-8000-000000000307';
const A8 = '01900000-0000-7000-8000-000000000308';
const A9 = '01900000-0000-7000-8000-000000000309';

interface AssetRow {
  readonly id: string;
  readonly world_id: string;
  readonly kind: string;
  readonly relative_path: string;
  readonly mime: string;
  readonly size: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
  readonly hash: string;
  readonly created_at: number;
}

interface SeededDatabase {
  readonly test: TempDatabase;
  readonly before: readonly AssetRow[];
  readonly fileHashes: Readonly<Record<string, string>>;
}

const ASSET_FILES: Readonly<Record<string, { worldId: string; kind: string }>> =
  {
    [A1]: { worldId: W1, kind: 'image' },
    [A2]: { worldId: W1, kind: 'image' },
    [A3]: { worldId: W1, kind: 'image' },
    [A4]: { worldId: W2, kind: 'image' },
    [A5]: { worldId: MISSING_WORLD, kind: 'image' },
    [A6]: { worldId: MISSING_WORLD, kind: 'image' },
    [A7]: { worldId: MISSING_WORLD, kind: 'image' },
    [A8]: { worldId: MISSING_WORLD, kind: 'image' },
    [A9]: { worldId: W1, kind: 'map' },
  };

async function seedSchemaNine(): Promise<SeededDatabase> {
  const test = await createTestDatabase();
  const fixtureMigrations = join(test.rootDir, 'migrations-0009');
  const files = [
    ['0000_init', INIT_MIGRATION_SQL],
    ['0001_assets', '0001_assets.sql'],
    ['0002_worlds', '0002_worlds.sql'],
    ['0003_entity_types', '0003_entity_types.sql'],
    ['0004_entities', '0004_entities.sql'],
    ['0005_relations', '0005_relations.sql'],
    ['0006_search', '0006_search.sql'],
    ['0007_trash_versions', '0007_trash_versions.sql'],
    ['0008_world_description', '0008_world_description.sql'],
  ] as const;
  const entries = await Promise.all(
    files.map(async ([tag, file]) => ({
      tag,
      sql:
        file === INIT_MIGRATION_SQL
          ? file
          : await readFile(join(REPOSITORY_MIGRATIONS_DIR, file), 'utf8'),
    })),
  );

  await createMigrationFixture(fixtureMigrations, entries);

  const first = await initializeDatabase({
    userDataDir: test.userDataDir,
    migrationsDir: fixtureMigrations,
  });

  if (first.status !== 'ready') {
    await test.cleanup();
    throw new Error(`La base de la prueba no arrancó: ${first.code}.`);
  }

  const sqlite = first.client.sqlite;

  sqlite
    .prepare(
      `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, '[]', 'active', 'es', '{}', ?, ?, ?)`,
    )
    .run(W1, 'Mundo vivo', 'mundo-vivo', BASE_TIME, BASE_TIME, null);
  sqlite
    .prepare(
      `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, '[]', 'active', 'es', '{}', ?, ?, ?)`,
    )
    .run(
      W2,
      'Mundo en papelera',
      'mundo-en-papelera',
      BASE_TIME,
      BASE_TIME,
      BASE_TIME,
    );

  const insertAsset = sqlite.prepare(
    `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, width, height, alt, hash, created_at)
     VALUES (?, ?, ?, ?, 'image/webp', 128, 640, 480, ?, ?, ?)`,
  );

  for (const [index, assetId] of Object.keys(ASSET_FILES).entries()) {
    const info = ASSET_FILES[assetId];

    if (info === undefined) {
      throw new Error('Falta la definición del asset.');
    }

    insertAsset.run(
      assetId,
      info.worldId,
      info.kind,
      `worlds/${info.worldId}/${assetId}.webp`,
      `Alt ${index}`,
      index.toString(16).padStart(64, '0'),
      BASE_TIME + index,
    );
  }

  sqlite
    .prepare(
      `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, attributes, status, is_favorite, image_asset_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', '{}', 'active', 0, ?, ?, ?)`,
    )
    .run(
      E1,
      W1,
      '018f0000-0000-7000-8000-000000000001',
      'Ficha con huérfanas',
      'ficha-con-huerfanas',
      A7,
      BASE_TIME,
      BASE_TIME,
    );
  sqlite
    .prepare(
      `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, attributes, status, is_favorite, image_asset_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', '{}', 'active', 0, ?, ?, ?)`,
    )
    .run(
      E2,
      W1,
      '018f0000-0000-7000-8000-000000000001',
      'Ficha válida',
      'ficha-valida',
      A2,
      BASE_TIME,
      BASE_TIME,
    );

  sqlite
    .prepare('UPDATE worlds SET cover_asset_id = ? WHERE id = ?')
    .run(A1, W1);
  sqlite
    .prepare('UPDATE worlds SET cover_asset_id = ? WHERE id = ?')
    .run(A6, W2);
  sqlite
    .prepare(
      'INSERT INTO entity_gallery (entity_id, asset_id, position) VALUES (?, ?, 0)',
    )
    .run(E1, A8);
  sqlite
    .prepare(
      'INSERT INTO entity_gallery (entity_id, asset_id, position) VALUES (?, ?, 1)',
    )
    .run(E2, A3);

  const fileHashes: Record<string, string> = {};

  for (const [assetId, info] of Object.entries(ASSET_FILES)) {
    const relativePath = `worlds/${info.worldId}/${assetId}.webp`;
    const absolute = join(test.paths.assetsDir, ...relativePath.split('/'));

    await mkdir(join(test.paths.assetsDir, 'worlds', info.worldId), {
      recursive: true,
    });
    await writeFile(absolute, `archivo-${assetId}`, 'binary');
    await writeFile(
      join(
        test.paths.assetsDir,
        'worlds',
        info.worldId,
        `${assetId}.thumb.webp`,
      ),
      `miniatura-${assetId}`,
      'binary',
    );

    fileHashes[relativePath] = createHash('sha256')
      .update(await readFile(absolute))
      .digest('hex');
  }

  const before = sqlite
    .prepare('SELECT * FROM assets ORDER BY id')
    .all() as AssetRow[];

  closeDatabase(sqlite);

  return { test, before, fileHashes };
}

async function migrateToCurrent(
  test: TempDatabase,
): Promise<Awaited<ReturnType<typeof initializeDatabase>>> {
  return initializeDatabase({
    userDataDir: test.userDataDir,
    migrationsDir: test.migrationsDir,
    now: () => BASE_TIME,
  });
}

describe('migración 0009 de FK de assets y cuarentena', () => {
  it('preserva filas y archivos válidos y audita los vínculos a huérfanos', async () => {
    const seeded = await seedSchemaNine();

    try {
      const upgraded = await migrateToCurrent(seeded.test);

      expect(upgraded.status).toBe('ready');

      if (upgraded.status !== 'ready') {
        return;
      }

      const sqlite = upgraded.client.sqlite;

      try {
        expect(upgraded.schemaVersion).toBe(10);
        expect(upgraded.appliedMigrations).toBe(1);
        expect(upgraded.backup).not.toBeNull();

        if (upgraded.backup !== null) {
          await expect(
            verifyBackup(upgraded.backup.directory),
          ).resolves.toMatchObject({
            schemaVersion: 9,
            integrity: 'ok',
          });
        }

        expect(sqlite.pragma('user_version', { simple: true })).toBe(10);
        expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
        expect(sqlite.pragma('foreign_key_check')).toEqual([]);
        expect(
          sqlite.prepare('SELECT id FROM schema_migrations ORDER BY id').all(),
        ).toEqual(expect.arrayContaining([{ id: '0009_assets_world_fk' }]));

        const after = sqlite
          .prepare('SELECT * FROM assets ORDER BY id')
          .all() as AssetRow[];
        const expectedSurvivors = seeded.before
          .filter((row) => [A1, A2, A3, A4, A9].includes(row.id))
          .sort((left, right) => left.id.localeCompare(right.id));

        expect(after).toEqual(expectedSurvivors);

        const quarantine = sqlite
          .prepare('SELECT * FROM assets_quarantine ORDER BY id')
          .all() as (AssetRow & {
          reason: string;
          quarantined_at: number;
        })[];
        const expectedQuarantine = seeded.before
          .filter((row) => [A5, A6, A7, A8].includes(row.id))
          .sort((left, right) => left.id.localeCompare(right.id));

        expect(quarantine).toHaveLength(4);

        for (const row of expectedQuarantine) {
          const stored = quarantine.find((item) => item.id === row.id);

          expect(stored).toMatchObject(row);
          expect(stored?.reason).toBe('world-missing');
          expect(stored?.quarantined_at).toBeGreaterThanOrEqual(0);
        }

        expect(
          sqlite
            .prepare('SELECT id, cover_asset_id FROM worlds ORDER BY id')
            .all(),
        ).toEqual([
          { id: W1, cover_asset_id: A1 },
          { id: W2, cover_asset_id: null },
        ]);
        expect(
          sqlite
            .prepare('SELECT id, image_asset_id FROM entities ORDER BY id')
            .all(),
        ).toEqual([
          { id: E1, image_asset_id: null },
          { id: E2, image_asset_id: A2 },
        ]);
        expect(
          sqlite
            .prepare(
              'SELECT entity_id, asset_id, position FROM entity_gallery ORDER BY entity_id, position',
            )
            .all(),
        ).toEqual([{ entity_id: E2, asset_id: A3, position: 1 }]);
        expect(
          sqlite
            .prepare(
              'SELECT asset_id, table_name, row_id, column_name, position FROM assets_quarantine_references ORDER BY table_name, row_id',
            )
            .all(),
        ).toEqual([
          {
            asset_id: A7,
            table_name: 'entities',
            row_id: E1,
            column_name: 'image_asset_id',
            position: null,
          },
          {
            asset_id: A8,
            table_name: 'entity_gallery',
            row_id: E1,
            column_name: 'asset_id',
            position: 0,
          },
          {
            asset_id: A6,
            table_name: 'worlds',
            row_id: W2,
            column_name: 'cover_asset_id',
            position: null,
          },
        ]);

        const foreignKeys = sqlite
          .prepare('PRAGMA foreign_key_list(assets)')
          .all() as {
          table: string;
          from: string;
          to: string;
          on_delete: string;
        }[];

        expect(foreignKeys).toEqual([
          expect.objectContaining({
            table: 'worlds',
            from: 'world_id',
            to: 'id',
            on_delete: 'RESTRICT',
          }),
        ]);
        expect(
          (
            sqlite
              .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).toEqual(
          expect.arrayContaining([
            'assets_world_idx',
            'assets_hash_idx',
            'worlds_cover_asset_idx',
            'entities_image_asset_idx',
          ]),
        );

        expect(() =>
          sqlite.prepare('DELETE FROM worlds WHERE id = ?').run(W1),
        ).toThrow();
        expect(
          sqlite
            .prepare('UPDATE worlds SET deleted_at = ? WHERE id = ?')
            .run(BASE_TIME + 1, W1),
        ).toBeTruthy();
        expect(() =>
          sqlite
            .prepare(
              `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, hash, created_at)
               VALUES (?, ?, 'image', ?, 'image/webp', 1, ?, ?)`,
            )
            .run(
              '01900000-0000-7000-8000-000000000399',
              MISSING_WORLD,
              `worlds/${MISSING_WORLD}/01900000-0000-7000-8000-000000000399.webp`,
              'f'.repeat(64),
              BASE_TIME,
            ),
        ).toThrow();

        for (const [relativePath, expectedHash] of Object.entries(
          seeded.fileHashes,
        )) {
          const absolute = join(
            seeded.test.paths.assetsDir,
            ...relativePath.split('/'),
          );
          const hash = createHash('sha256')
            .update(await readFile(absolute))
            .digest('hex');

          expect(hash).toBe(expectedHash);
          await expect(readFile(absolute)).resolves.toBeDefined();
          await expect(
            readFile(
              join(
                seeded.test.paths.assetsDir,
                ...relativePath.replace(/\.webp$/, '.thumb.webp').split('/'),
              ),
            ),
          ).resolves.toBeDefined();
        }
      } finally {
        closeDatabase(sqlite);
      }
    } finally {
      await seeded.test.cleanup();
    }
  });

  it('no registra referencias si los huérfanos no estaban enlazados', async () => {
    const test = await createTestDatabase();
    const fixtureMigrations = join(test.rootDir, 'migrations-0009');
    const files = [
      ['0000_init', INIT_MIGRATION_SQL],
      ['0001_assets', '0001_assets.sql'],
      ['0002_worlds', '0002_worlds.sql'],
      ['0003_entity_types', '0003_entity_types.sql'],
      ['0004_entities', '0004_entities.sql'],
      ['0005_relations', '0005_relations.sql'],
      ['0006_search', '0006_search.sql'],
      ['0007_trash_versions', '0007_trash_versions.sql'],
      ['0008_world_description', '0008_world_description.sql'],
    ] as const;

    try {
      await createMigrationFixture(
        fixtureMigrations,
        await Promise.all(
          files.map(async ([tag, file]) => ({
            tag,
            sql:
              file === INIT_MIGRATION_SQL
                ? file
                : await readFile(join(REPOSITORY_MIGRATIONS_DIR, file), 'utf8'),
          })),
        ),
      );

      const first = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: fixtureMigrations,
      });

      if (first.status !== 'ready') {
        throw new Error(`La base no arrancó: ${first.code}.`);
      }

      first.client.sqlite
        .prepare(
          `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, hash, created_at)
           VALUES (?, ?, 'image', ?, 'image/webp', 1, ?, ?)`,
        )
        .run(
          A5,
          MISSING_WORLD,
          `worlds/${MISSING_WORLD}/${A5}.webp`,
          'a'.repeat(64),
          BASE_TIME,
        );
      closeDatabase(first.client.sqlite);

      const upgraded = await migrateToCurrent(test);

      expect(upgraded.status).toBe('ready');

      if (upgraded.status !== 'ready') {
        return;
      }

      const sqlite = upgraded.client.sqlite;

      try {
        expect(
          sqlite.prepare('SELECT count(*) AS total FROM assets').get(),
        ).toEqual({ total: 0 });
        expect(
          sqlite
            .prepare('SELECT count(*) AS total FROM assets_quarantine')
            .get(),
        ).toEqual({ total: 1 });
        expect(
          sqlite
            .prepare(
              'SELECT count(*) AS total FROM assets_quarantine_references',
            )
            .get(),
        ).toEqual({ total: 0 });
        expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      } finally {
        closeDatabase(sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('el rollback restaura esquema, filas y referencias y la migración se reaplica', async () => {
    const seeded = await seedSchemaNine();

    try {
      const upgraded = await migrateToCurrent(seeded.test);

      expect(upgraded.status).toBe('ready');

      if (upgraded.status !== 'ready') {
        return;
      }

      closeDatabase(upgraded.client.sqlite);

      const rollbackSql = await readFile(
        join(
          REPOSITORY_MIGRATIONS_DIR,
          'rollback',
          '0009_assets_world_fk.down.sql',
        ),
        'utf8',
      );
      const database = openDatabase({
        file: seeded.test.paths.databaseFile,
      });

      try {
        database.exec(rollbackSql);

        expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
        expect(database.pragma('user_version', { simple: true })).toBe(9);
        expect(database.pragma('foreign_key_check')).toEqual([]);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('assets_quarantine');

        const assets = database
          .prepare('SELECT * FROM assets ORDER BY id')
          .all() as AssetRow[];

        expect(assets).toEqual(
          [...seeded.before].sort((left, right) =>
            left.id.localeCompare(right.id),
          ),
        );
        expect(
          database.prepare('PRAGMA foreign_key_list(assets)').all(),
        ).toEqual([]);
        expect(
          database
            .prepare(
              'SELECT cover_asset_id FROM worlds WHERE id IN (?, ?) ORDER BY id',
            )
            .all(W1, W2),
        ).toEqual([{ cover_asset_id: A1 }, { cover_asset_id: A6 }]);
        expect(
          database
            .prepare('SELECT id, image_asset_id FROM entities ORDER BY id')
            .all(),
        ).toEqual([
          { id: E1, image_asset_id: A7 },
          { id: E2, image_asset_id: A2 },
        ]);
        expect(
          database
            .prepare(
              'SELECT entity_id, asset_id, position FROM entity_gallery ORDER BY entity_id, position',
            )
            .all(),
        ).toEqual([
          { entity_id: E1, asset_id: A8, position: 0 },
          { entity_id: E2, asset_id: A3, position: 1 },
        ]);
        expect(
          database
            .prepare(
              "SELECT count(*) AS total FROM sqlite_master WHERE type = 'index' AND name IN ('worlds_cover_asset_idx', 'entities_image_asset_idx')",
            )
            .get(),
        ).toEqual({ total: 0 });
      } finally {
        closeDatabase(database);
      }

      const reapplied = await migrateToCurrent(seeded.test);

      expect(reapplied.status).toBe('ready');

      if (reapplied.status !== 'ready') {
        return;
      }

      const sqlite = reapplied.client.sqlite;

      try {
        expect(reapplied.schemaVersion).toBe(10);
        expect(reapplied.appliedMigrations).toBe(1);
        expect(
          sqlite.prepare('SELECT count(*) AS total FROM assets').get(),
        ).toEqual({ total: 5 });
        expect(
          sqlite
            .prepare('SELECT count(*) AS total FROM assets_quarantine')
            .get(),
        ).toEqual({ total: 4 });
        expect(
          sqlite
            .prepare(
              'SELECT count(*) AS total FROM assets_quarantine_references',
            )
            .get(),
        ).toEqual({ total: 3 });
        expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      } finally {
        closeDatabase(sqlite);
      }
    } finally {
      await seeded.test.cleanup();
    }
  });
});
