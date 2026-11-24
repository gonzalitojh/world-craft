import { createHash } from 'node:crypto';
import {
  appendFile,
  copyFile,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createPreMigrationBackup } from '@/main/backup/create';
import { verifyBackup } from '@/main/backup/verify';
import { closeDatabase, openDatabase } from '@/main/db/connection';
import { ensureDataDirectories } from '@/main/db/paths';
import {
  initializeDatabase,
  type DatabaseStartupResult,
} from '@/main/db/startup';

import {
  createMigrationFixture,
  createTestDatabase,
  INIT_MIGRATION_SQL,
  REPOSITORY_MIGRATIONS_DIR,
} from './helpers/temp-db';

type ReadyResult = Extract<DatabaseStartupResult, { status: 'ready' }>;
type SafeModeResult = Extract<DatabaseStartupResult, { status: 'safe-mode' }>;

function expectReady(result: DatabaseStartupResult): ReadyResult {
  expect(result.status).toBe('ready');

  if (result.status !== 'ready') {
    throw new Error(`Se esperaba ready y llegó ${result.code}.`);
  }

  return result;
}

function expectSafeMode(
  result: DatabaseStartupResult,
  code: string,
): SafeModeResult {
  expect(result).toMatchObject({ status: 'safe-mode', code });

  if (result.status !== 'safe-mode') {
    throw new Error('Se esperaba modo seguro.');
  }

  return result;
}

const NOTES_MIGRATION = {
  tag: '0001_notes',
  sql: 'CREATE TABLE notes (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);\n',
};

const BROKEN_MIGRATION = {
  tag: '0001_broken',
  sql: 'CREATE TABLE should_not_exist (id TEXT PRIMARY KEY NOT NULL);\nESTO NO ES SQL VALIDO;\n',
};

describe('migraciones', () => {
  it.each(['worlds', 'app_settings'] as const)(
    'rechaza una base ajena con %s y sin schema_migrations',
    async (table) => {
      const test = await createTestDatabase();

      try {
        ensureDataDirectories(test.paths);

        const source = openDatabase({
          file: test.paths.databaseFile,
          deferWritePragmas: true,
        });

        try {
          source.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL);`);
        } finally {
          closeDatabase(source);
        }

        const safe = expectSafeMode(
          await initializeDatabase({
            userDataDir: test.userDataDir,
            migrationsDir: test.migrationsDir,
          }),
          'DB_MIGRATION_FAILED',
        );

        expect(safe.paths).not.toBeNull();
        expect(safe.backup).toBeNull();
        expect(await readdir(test.paths.preMigrationBackupsDir)).toEqual([]);

        const verification = openDatabase({
          file: test.paths.databaseFile,
          readonly: true,
        });

        try {
          expect(verification.pragma('user_version', { simple: true })).toBe(0);
          expect(
            verification
              .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
              )
              .get(),
          ).toBeUndefined();
          expect(
            verification
              .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
              )
              .get(table),
          ).toBeDefined();

          if (table === 'worlds') {
            expect(
              verification
                .prepare(
                  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'",
                )
                .get(),
            ).toBeUndefined();
          }
        } finally {
          closeDatabase(verification);
        }
      } finally {
        await test.cleanup();
      }
    },
  );

  it('rechaza una migración aplicada si su SQL cambia', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      await appendFile(
        join(migrationsDir, '0000_init.sql'),
        '\n-- contenido cambiado\n',
        'utf8',
      );

      const safe = expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
        'DB_MIGRATION_CHECKSUM_MISMATCH',
      );

      expect(safe.schemaVersion).toBe(1);

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        // 0000_init aplicada => user_version 1 (número de migraciones).
        expect(database.pragma('user_version', { simple: true })).toBe(1);
        expect(
          database
            .prepare('SELECT count(*) AS total FROM schema_migrations')
            .get(),
        ).toEqual({ total: 1 });
      } finally {
        closeDatabase(database);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('revierte el lote entero si una migración falla en una base nueva', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        BROKEN_MIGRATION,
      ]);

      const safe = expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
        'DB_MIGRATION_FAILED',
      );

      expect(safe.backup).toBeNull();

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        expect(database.pragma('user_version', { simple: true })).toBe(0);

        const tables = (
          database
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all() as { name: string }[]
        ).map((row) => row.name);

        expect(tables).not.toContain('schema_migrations');
        expect(tables).not.toContain('should_not_exist');
      } finally {
        closeDatabase(database);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('conserva los datos y la copia si falla una migración sobre una base existente', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );

      first.client.sqlite
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
        )
        .run('theme', '"dark"', 1_760_000_000_000);
      closeDatabase(first.client.sqlite);

      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        BROKEN_MIGRATION,
      ]);

      const safe = expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
        'DB_MIGRATION_FAILED',
      );

      expect(safe.backup).not.toBeNull();

      if (safe.backup === null) {
        throw new Error('No se creó la copia previa.');
      }

      const manifest = await verifyBackup(safe.backup.directory);
      expect(manifest).toMatchObject({
        formatVersion: 2,
        reason: 'pre-migration',
        schemaVersion: 1,
        integrity: 'ok',
        assetsIncluded: false,
      });

      const manifestFile = JSON.parse(
        await readFile(join(safe.backup.directory, 'manifest.json'), 'utf8'),
      ) as { sha256: string };

      const backupSha256 = createHash('sha256')
        .update(await readFile(safe.backup.databaseFile))
        .digest('hex');

      expect(manifestFile.sha256).toBe(backupSha256);

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        expect(database.pragma('user_version', { simple: true })).toBe(1);
        expect(
          database
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('theme'),
        ).toEqual({ value: '"dark"' });
        expect(
          database
            .prepare(
              "SELECT name FROM sqlite_master WHERE name = 'should_not_exist'",
            )
            .get(),
        ).toBeUndefined();
      } finally {
        closeDatabase(database);
      }

      const backupDatabase = openDatabase({
        file: safe.backup.databaseFile,
        readonly: true,
      });

      try {
        expect(
          backupDatabase
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('theme'),
        ).toEqual({ value: '"dark"' });
      } finally {
        closeDatabase(backupDatabase);
      }

      await appendFile(safe.backup.databaseFile, 'alterado', 'utf8');
      await expect(verifyBackup(safe.backup.directory)).rejects.toMatchObject({
        code: 'DB_BACKUP_FAILED',
      });
    } finally {
      await test.cleanup();
    }
  });

  it('preserva los datos al aplicar una migración válida y es idempotente', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );
      first.client.sqlite
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
        )
        .run('locale', '"es-ES"', 1_760_000_000_000);
      closeDatabase(first.client.sqlite);

      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        NOTES_MIGRATION,
      ]);

      const second = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );

      try {
        expect(second.schemaVersion).toBe(2);
        expect(second.appliedMigrations).toBe(1);
        expect(second.newDatabase).toBe(false);
        expect(second.backup).not.toBeNull();

        // 0000_init + 0001_notes => user_version 2 (número de migraciones).
        expect(
          second.client.sqlite.pragma('user_version', { simple: true }),
        ).toBe(2);
        expect(
          second.client.sqlite
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('locale'),
        ).toEqual({ value: '"es-ES"' });
        expect(
          second.client.sqlite
            .prepare("SELECT name FROM sqlite_master WHERE name = 'notes'")
            .get(),
        ).toBeDefined();
        expect(
          second.client.sqlite
            .prepare('SELECT count(*) AS total FROM schema_migrations')
            .get(),
        ).toEqual({ total: 2 });
      } finally {
        closeDatabase(second.client.sqlite);
      }

      const third = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );

      try {
        expect(third.appliedMigrations).toBe(0);
        expect(third.backup).toBeNull();
        expect(third.schemaVersion).toBe(2);
        expect(await readdir(test.paths.preMigrationBackupsDir)).toHaveLength(
          1,
        );
      } finally {
        closeDatabase(third.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('permite restaurar manualmente la copia y volver a migrar', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );
      first.client.sqlite
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
        )
        .run('original', '"sí"', 1_760_000_000_000);
      closeDatabase(first.client.sqlite);

      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        NOTES_MIGRATION,
      ]);

      const second = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );
      closeDatabase(second.client.sqlite);

      if (second.backup === null) {
        throw new Error('No se creó la copia previa.');
      }

      await rm(test.paths.databaseFile, { force: true });
      await rm(`${test.paths.databaseFile}-wal`, { force: true });
      await rm(`${test.paths.databaseFile}-shm`, { force: true });
      await copyFile(second.backup.databaseFile, test.paths.databaseFile);

      const restored = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );

      try {
        expect(restored.schemaVersion).toBe(2);
        expect(restored.appliedMigrations).toBe(1);
        expect(restored.backup).not.toBeNull();
        expect(
          restored.client.sqlite
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('original'),
        ).toEqual({ value: '"sí"' });
      } finally {
        closeDatabase(restored.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('devuelve DB_BACKUP_FAILED si no puede crear la carpeta de copia', async () => {
    const test = await createTestDatabase();
    const blockedPath = join(test.rootDir, 'backups-bloqueado');

    try {
      await writeFile(blockedPath, 'no es una carpeta', 'utf8');

      const database = openDatabase({
        file: join(test.rootDir, 'origen.sqlite'),
      });

      try {
        await expect(
          createPreMigrationBackup({
            database,
            backupRootDir: blockedPath,
            timestamp: 1_760_000_000_000,
            schemaVersion: 0,
          }),
        ).rejects.toMatchObject({ code: 'DB_BACKUP_FAILED' });
      } finally {
        closeDatabase(database);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('los rollbacks de referencia dejan la base vacía y sin versión', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      const rollbackSearchSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0006_search.down.sql'),
        'utf8',
      );
      const rollbackTrashVersionsSql = await readFile(
        join(
          REPOSITORY_MIGRATIONS_DIR,
          'rollback',
          '0007_trash_versions.down.sql',
        ),
        'utf8',
      );
      const rollbackRelationsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0005_relations.down.sql'),
        'utf8',
      );
      const rollbackEntitiesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0004_entities.down.sql'),
        'utf8',
      );
      const rollbackEntityTypesSql = await readFile(
        join(
          REPOSITORY_MIGRATIONS_DIR,
          'rollback',
          '0003_entity_types.down.sql',
        ),
        'utf8',
      );
      const rollbackWorldsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0002_worlds.down.sql'),
        'utf8',
      );
      const rollbackAssetsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0001_assets.down.sql'),
        'utf8',
      );
      const rollbackInitSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0000_init.down.sql'),
        'utf8',
      );
      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        database.exec(rollbackTrashVersionsSql);

        expect(database.pragma('user_version', { simple: true })).toBe(7);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('entity_versions');

        const indexesAfterRollback = (
          database
            .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
            .all() as { name: string }[]
        ).map((row) => row.name);

        expect(indexesAfterRollback).not.toContain('entities_deleted_idx');
        expect(indexesAfterRollback).not.toContain('entity_types_deleted_idx');

        database.exec(rollbackSearchSql);

        expect(database.pragma('user_version', { simple: true })).toBe(6);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('search_documents');
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('search_fts');

        database.exec(rollbackRelationsSql);

        expect(database.pragma('user_version', { simple: true })).toBe(5);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('relations');
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('relation_types');

        database.exec(rollbackEntitiesSql);

        expect(database.pragma('user_version', { simple: true })).toBe(4);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('entities');

        database.exec(rollbackEntityTypesSql);

        expect(database.pragma('user_version', { simple: true })).toBe(3);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('entity_types');

        database.exec(rollbackWorldsSql);

        expect(database.pragma('user_version', { simple: true })).toBe(2);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('worlds');

        database.exec(rollbackAssetsSql);

        expect(database.pragma('user_version', { simple: true })).toBe(1);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('assets');

        database.exec(rollbackInitSql);

        expect(database.pragma('user_version', { simple: true })).toBe(0);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).toEqual([]);
      } finally {
        closeDatabase(database);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('migra de 0000 al esquema actual conservando los datos y creando assets y mundos', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );
      first.client.sqlite
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
        )
        .run('theme', '"dark"', 1_760_000_000_000);
      closeDatabase(first.client.sqlite);

      const upgraded = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        expect(upgraded.schemaVersion).toBe(8);
        expect(upgraded.appliedMigrations).toBe(7);
        expect(upgraded.backup).not.toBeNull();
        expect(
          upgraded.client.sqlite.pragma('user_version', { simple: true }),
        ).toBe(8);
        expect(
          upgraded.client.sqlite
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('theme'),
        ).toEqual({ value: '"dark"' });
        expect(
          upgraded.client.sqlite
            .prepare('SELECT count(*) AS total FROM schema_migrations')
            .get(),
        ).toEqual({ total: 8 });

        expect(
          upgraded.client.sqlite
            .prepare(
              'SELECT count(*) AS total FROM entity_types WHERE is_system = 1',
            )
            .get(),
        ).toEqual({ total: 18 });

        const indexes = (
          upgraded.client.sqlite
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'assets'",
            )
            .all() as { name: string }[]
        ).map((row) => row.name);

        expect(indexes).toEqual(
          expect.arrayContaining(['assets_world_idx', 'assets_hash_idx']),
        );

        const insert = upgraded.client.sqlite.prepare(
          `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, width, height, alt, hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        const values = [
          '01900000-0000-7000-8000-000000000001',
          '01900000-0000-7000-8000-000000000002',
          'image',
          'worlds/01900000-0000-7000-8000-000000000002/01900000-0000-7000-8000-000000000001.webp',
          'image/webp',
          128,
          10,
          10,
          null,
          'd'.repeat(64),
          1_760_000_000_000,
        ];

        insert.run(...values);

        expect(
          upgraded.client.sqlite
            .prepare('SELECT count(*) AS total FROM assets')
            .get(),
        ).toEqual({ total: 1 });

        // CHECK de kind, tamaño y hash hexadecimal de 64 caracteres.
        expect(() =>
          insert.run(...[...values.slice(0, 2), 'video', ...values.slice(3)]),
        ).toThrow();
        expect(() =>
          insert.run(...[...values.slice(0, 5), -1, ...values.slice(6)]),
        ).toThrow();
        expect(() =>
          insert.run(
            ...[...values.slice(0, 9), 'hash-corto', ...values.slice(10)],
          ),
        ).toThrow();
        expect(() =>
          insert.run(
            ...[...values.slice(0, 9), 'G'.repeat(64), ...values.slice(10)],
          ),
        ).toThrow();
      } finally {
        closeDatabase(upgraded.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('aplica 0003 y 0004 sobre mundos y actividad existentes sin perder datos', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      const assetsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0001_assets.sql'),
        'utf8',
      );
      const worldsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0002_worlds.sql'),
        'utf8',
      );

      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        { tag: '0001_assets', sql: assetsSql },
        { tag: '0002_worlds', sql: worldsSql },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );

      first.client.sqlite
        .prepare(
          `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000001',
          'Las Mareas Grises',
          'las-mareas-grises',
          '[]',
          'active',
          'es',
          '{}',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      first.client.sqlite
        .prepare(
          `INSERT INTO activity_log (id, world_id, action, entity_type, entity_id, diff, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000002',
          '01900000-0000-7000-8000-000000000001',
          'world.created',
          'world',
          '01900000-0000-7000-8000-000000000001',
          '{}',
          1_760_000_000_000,
        );
      closeDatabase(first.client.sqlite);

      const upgraded = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        expect(upgraded.schemaVersion).toBe(8);
        expect(upgraded.appliedMigrations).toBe(5);
        expect(upgraded.backup).not.toBeNull();
        expect(
          upgraded.client.sqlite
            .prepare('SELECT name FROM worlds WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000001'),
        ).toEqual({ name: 'Las Mareas Grises' });
        expect(
          upgraded.client.sqlite
            .prepare('SELECT count(*) AS total FROM activity_log')
            .get(),
        ).toEqual({ total: 1 });
        expect(
          upgraded.client.sqlite
            .prepare(
              'SELECT count(*) AS total FROM entity_types WHERE is_system = 1',
            )
            .get(),
        ).toEqual({ total: 18 });
      } finally {
        closeDatabase(upgraded.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('aplica 0004 y 0005 sobre mundos y tipos existentes sin perder datos', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      const assetsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0001_assets.sql'),
        'utf8',
      );
      const worldsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0002_worlds.sql'),
        'utf8',
      );
      const entityTypesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0003_entity_types.sql'),
        'utf8',
      );

      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        { tag: '0001_assets', sql: assetsSql },
        { tag: '0002_worlds', sql: worldsSql },
        { tag: '0003_entity_types', sql: entityTypesSql },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );

      first.client.sqlite
        .prepare(
          `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000001',
          'Las Mareas Grises',
          'las-mareas-grises',
          '["Fantasía"]',
          'active',
          'es',
          '{}',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      first.client.sqlite
        .prepare(
          `INSERT INTO entity_types (id, world_id, key, name, icon, color, fields, is_system, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000002',
          '01900000-0000-7000-8000-000000000001',
          'reliquia',
          'Reliquia',
          'gem',
          'ochre',
          '[{"key":"poder","label":"Poder","type":"text","required":false}]',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      first.client.sqlite
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
        )
        .run('locale', '"es-ES"', 1_760_000_000_000);
      closeDatabase(first.client.sqlite);

      const upgraded = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        expect(upgraded.schemaVersion).toBe(8);
        expect(upgraded.appliedMigrations).toBe(4);
        expect(upgraded.backup).not.toBeNull();
        expect(
          upgraded.client.sqlite
            .prepare('SELECT name FROM worlds WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000001'),
        ).toEqual({ name: 'Las Mareas Grises' });
        expect(
          upgraded.client.sqlite
            .prepare('SELECT name FROM entity_types WHERE key = ?')
            .get('reliquia'),
        ).toEqual({ name: 'Reliquia' });
        expect(
          upgraded.client.sqlite
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('locale'),
        ).toEqual({ value: '"es-ES"' });
        expect(
          upgraded.client.sqlite
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('entities', 'tags', 'entity_tags', 'entity_gallery') ORDER BY name",
            )
            .all(),
        ).toEqual([
          { name: 'entities' },
          { name: 'entity_gallery' },
          { name: 'entity_tags' },
          { name: 'tags' },
        ]);
        expect(
          upgraded.client.sqlite
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('relation_types', 'relations') ORDER BY name",
            )
            .all(),
        ).toEqual([{ name: 'relation_types' }, { name: 'relations' }]);
        expect(
          upgraded.client.sqlite
            .prepare(
              'SELECT count(*) AS total FROM relation_types WHERE is_system = 1',
            )
            .get(),
        ).toEqual({ total: 18 });
      } finally {
        closeDatabase(upgraded.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('aplica 0005 sobre mundos, tipos y fichas existentes sin perder datos', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      const assetsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0001_assets.sql'),
        'utf8',
      );
      const worldsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0002_worlds.sql'),
        'utf8',
      );
      const entityTypesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0003_entity_types.sql'),
        'utf8',
      );
      const entitiesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0004_entities.sql'),
        'utf8',
      );

      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        { tag: '0001_assets', sql: assetsSql },
        { tag: '0002_worlds', sql: worldsSql },
        { tag: '0003_entity_types', sql: entityTypesSql },
        { tag: '0004_entities', sql: entitiesSql },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );

      first.client.sqlite
        .prepare(
          `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000001',
          'Las Mareas Grises',
          'las-mareas-grises',
          '["Fantasía"]',
          'active',
          'es',
          '{}',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      first.client.sqlite
        .prepare(
          `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, summary, attributes, status, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '[]', NULL, '{}', 'active', 0, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000003',
          '01900000-0000-7000-8000-000000000001',
          '018f0000-0000-7000-8000-000000000001',
          'Mara Viento',
          'mara-viento',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      closeDatabase(first.client.sqlite);

      const upgraded = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        expect(upgraded.schemaVersion).toBe(8);
        expect(upgraded.appliedMigrations).toBe(3);
        expect(upgraded.backup).not.toBeNull();
        expect(
          upgraded.client.sqlite
            .prepare('SELECT name FROM entities WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000003'),
        ).toEqual({ name: 'Mara Viento' });
        expect(
          upgraded.client.sqlite
            .prepare('SELECT name FROM worlds WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000001'),
        ).toEqual({ name: 'Las Mareas Grises' });
        expect(
          upgraded.client.sqlite
            .prepare(
              'SELECT count(*) AS total FROM relation_types WHERE is_system = 1',
            )
            .get(),
        ).toEqual({ total: 18 });
        expect(
          upgraded.client.sqlite
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'relations'",
            )
            .get(),
        ).toEqual({ name: 'relations' });
      } finally {
        closeDatabase(upgraded.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('aplica 0006 sobre mundos, fichas, etiquetas y relaciones existentes sin perder datos', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      const assetsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0001_assets.sql'),
        'utf8',
      );
      const worldsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0002_worlds.sql'),
        'utf8',
      );
      const entityTypesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0003_entity_types.sql'),
        'utf8',
      );
      const entitiesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0004_entities.sql'),
        'utf8',
      );
      const relationsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0005_relations.sql'),
        'utf8',
      );

      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        { tag: '0001_assets', sql: assetsSql },
        { tag: '0002_worlds', sql: worldsSql },
        { tag: '0003_entity_types', sql: entityTypesSql },
        { tag: '0004_entities', sql: entitiesSql },
        { tag: '0005_relations', sql: relationsSql },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );

      const sqlite = first.client.sqlite;

      sqlite
        .prepare(
          `INSERT INTO worlds (id, name, slug, summary, genres, status, language, settings, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000001',
          'Las Mareas Grises',
          'las-mareas-grises',
          'Un archipiélago de niebla',
          '["Fantasía"]',
          'active',
          'es',
          '{}',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      sqlite
        .prepare(
          `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, summary, description_text, attributes, status, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000003',
          '01900000-0000-7000-8000-000000000001',
          '018f0000-0000-7000-8000-000000000001',
          'Mara Viento',
          'mara-viento',
          '["La Cartógrafa"]',
          'Capitana del puerto',
          'Recorre las islas del norte con su cuaderno de mareas.',
          '{}',
          'active',
          1,
          1_760_000_000_000,
          1_760_000_000_000,
        );
      sqlite
        .prepare(
          `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, summary, description_text, attributes, status, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000004',
          '01900000-0000-7000-8000-000000000001',
          '018f0000-0000-7000-8000-000000000003',
          'Puerto Sal',
          'puerto-sal',
          '[]',
          'Puerto ballenero',
          'Un puerto de sal y goletas.',
          '{}',
          'active',
          0,
          1_760_000_000_000,
          1_760_000_000_000,
        );
      sqlite
        .prepare(
          'INSERT INTO tags (id, world_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          '01900000-0000-7000-8000-000000000005',
          '01900000-0000-7000-8000-000000000001',
          'Istari',
          'moss',
          1_760_000_000_000,
        );
      sqlite
        .prepare('INSERT INTO entity_tags (entity_id, tag_id) VALUES (?, ?)')
        .run(
          '01900000-0000-7000-8000-000000000003',
          '01900000-0000-7000-8000-000000000005',
        );
      sqlite
        .prepare(
          `INSERT INTO relations (id, world_id, source_id, target_id, type_id, notes, strength, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000006',
          '01900000-0000-7000-8000-000000000001',
          '01900000-0000-7000-8000-000000000003',
          '01900000-0000-7000-8000-000000000004',
          '018f0000-0000-7000-8000-000000000109',
          'Guardiana del puerto',
          3,
          '{}',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      closeDatabase(sqlite);

      const upgraded = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        expect(upgraded.schemaVersion).toBe(8);
        expect(upgraded.appliedMigrations).toBe(2);
        expect(upgraded.backup).not.toBeNull();

        const upgradedSqlite = upgraded.client.sqlite;

        expect(
          upgradedSqlite
            .prepare('SELECT name FROM entities WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000003'),
        ).toEqual({ name: 'Mara Viento' });
        expect(
          upgradedSqlite
            .prepare('SELECT name FROM worlds WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000001'),
        ).toEqual({ name: 'Las Mareas Grises' });
        expect(
          upgradedSqlite
            .prepare(
              'SELECT kind, count(*) AS total FROM search_documents GROUP BY kind ORDER BY kind',
            )
            .all(),
        ).toEqual([
          { kind: 'entity', total: 2 },
          { kind: 'relation', total: 1 },
          { kind: 'world', total: 1 },
        ]);
        expect(
          upgradedSqlite
            .prepare(
              'SELECT title, keywords FROM search_documents WHERE kind = ? AND source_id = ?',
            )
            .get('entity', '01900000-0000-7000-8000-000000000003'),
        ).toEqual({
          title: 'Mara Viento',
          keywords: '["La Cartógrafa"] Istari',
        });
        expect(
          upgradedSqlite
            .prepare(
              'SELECT d.kind FROM search_fts JOIN search_documents d ON d.rowid = search_fts.rowid WHERE search_fts MATCH ?',
            )
            .all('guardiana'),
        ).toEqual([{ kind: 'relation' }]);
        expect(
          upgradedSqlite
            .prepare(
              'SELECT d.kind FROM search_fts JOIN search_documents d ON d.rowid = search_fts.rowid WHERE search_fts MATCH ? ORDER BY d.kind',
            )
            .all('mareas'),
        ).toEqual([{ kind: 'entity' }, { kind: 'world' }]);
      } finally {
        closeDatabase(upgraded.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('aplica 0007 sobre una base 0006 con contenido y preserva datos, búsqueda y assets', async () => {
    const test = await createTestDatabase();
    const migrationsDir = join(test.rootDir, 'migrations');

    try {
      const assetsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0001_assets.sql'),
        'utf8',
      );
      const worldsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0002_worlds.sql'),
        'utf8',
      );
      const entityTypesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0003_entity_types.sql'),
        'utf8',
      );
      const entitiesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0004_entities.sql'),
        'utf8',
      );
      const relationsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0005_relations.sql'),
        'utf8',
      );
      const searchSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, '0006_search.sql'),
        'utf8',
      );

      await createMigrationFixture(migrationsDir, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
        { tag: '0001_assets', sql: assetsSql },
        { tag: '0002_worlds', sql: worldsSql },
        { tag: '0003_entity_types', sql: entityTypesSql },
        { tag: '0004_entities', sql: entitiesSql },
        { tag: '0005_relations', sql: relationsSql },
        { tag: '0006_search', sql: searchSql },
      ]);

      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir,
        }),
      );
      const sqlite = first.client.sqlite;

      sqlite
        .prepare(
          `INSERT INTO worlds (id, name, slug, summary, genres, status, language, settings, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000001',
          'Las Mareas Grises',
          'las-mareas-grises',
          'Un archipiélago de niebla',
          '["Fantasía"]',
          'active',
          'es',
          '{}',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      sqlite
        .prepare(
          `INSERT INTO entity_types (id, world_id, key, name, icon, color, fields, is_system, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000002',
          '01900000-0000-7000-8000-000000000001',
          'reliquia',
          'Reliquia',
          'gem',
          'ochre',
          '[]',
          1_760_000_000_000,
          1_760_000_000_000,
        );
      sqlite
        .prepare(
          `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, width, height, alt, hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000003',
          '01900000-0000-7000-8000-000000000001',
          'image',
          'worlds/01900000-0000-7000-8000-000000000001/01900000-0000-7000-8000-000000000003.webp',
          'image/webp',
          128,
          10,
          10,
          'Faro',
          'a'.repeat(64),
          1_760_000_000_000,
        );
      sqlite
        .prepare(
          `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, summary, description_text, image_asset_id, attributes, status, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000004',
          '01900000-0000-7000-8000-000000000001',
          '018f0000-0000-7000-8000-000000000001',
          'Mara Viento',
          'mara-viento',
          '["La Cartógrafa"]',
          'Capitana del puerto',
          'Recorre las islas del norte.',
          '01900000-0000-7000-8000-000000000003',
          '{}',
          'active',
          1,
          1_760_000_000_000,
          1_760_000_000_000,
        );
      sqlite
        .prepare(
          `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, summary, description_text, attributes, status, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000005',
          '01900000-0000-7000-8000-000000000001',
          '01900000-0000-7000-8000-000000000002',
          'Faro de Sal',
          'faro-de-sal',
          '[]',
          'Una reliquia del puerto',
          'Brilla sobre el muelle.',
          '{}',
          'active',
          0,
          1_760_000_000_000,
          1_760_000_000_000,
        );
      sqlite
        .prepare(
          'INSERT INTO tags (id, world_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          '01900000-0000-7000-8000-000000000006',
          '01900000-0000-7000-8000-000000000001',
          'Istari',
          'moss',
          1_760_000_000_000,
        );
      sqlite
        .prepare('INSERT INTO entity_tags (entity_id, tag_id) VALUES (?, ?)')
        .run(
          '01900000-0000-7000-8000-000000000004',
          '01900000-0000-7000-8000-000000000006',
        );
      sqlite
        .prepare(
          `INSERT INTO relations (id, world_id, source_id, target_id, type_id, notes, strength, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000007',
          '01900000-0000-7000-8000-000000000001',
          '01900000-0000-7000-8000-000000000004',
          '01900000-0000-7000-8000-000000000005',
          '018f0000-0000-7000-8000-000000000109',
          'Guardiana del faro',
          3,
          '{}',
          1_760_000_000_000,
          1_760_000_000_000,
        );

      // Las dos tablas de papelera con filas borradas para ejercitar los
      // índices nuevos sin depender de que SQLite elija un escaneo.
      for (let index = 0; index < 30; index += 1) {
        sqlite
          .prepare(
            `INSERT INTO entities (id, world_id, type_id, name, slug, aliases, attributes, status, is_favorite, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, '[]', '{}', 'active', 0, ?, ?, ?)`,
          )
          .run(
            `01900000-0000-7000-8100-${String(index).padStart(12, '0')}`,
            '01900000-0000-7000-8000-000000000001',
            '018f0000-0000-7000-8000-000000000001',
            `Eco ${index}`,
            `eco-${index}`,
            1_760_000_000_000,
            1_760_000_000_000,
            1_760_000_000_000 + index,
          );
      }
      sqlite
        .prepare(
          `INSERT INTO entity_types (id, world_id, key, name, icon, color, fields, is_system, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, '[]', 0, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000008',
          '01900000-0000-7000-8000-000000000001',
          'tipo-borrado',
          'Tipo borrado',
          'gem',
          'moss',
          1_760_000_000_000,
          1_760_000_000_000,
          1_760_000_000_000,
        );
      closeDatabase(sqlite);

      const upgraded = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        const migrated = upgraded.client.sqlite;

        expect(upgraded.schemaVersion).toBe(8);
        expect(upgraded.appliedMigrations).toBe(1);
        expect(upgraded.backup).not.toBeNull();
        expect(migrated.pragma('user_version', { simple: true })).toBe(8);

        expect(
          migrated
            .prepare('SELECT name FROM worlds WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000001'),
        ).toEqual({ name: 'Las Mareas Grises' });
        expect(
          migrated
            .prepare('SELECT name FROM entities WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000004'),
        ).toEqual({ name: 'Mara Viento' });
        expect(
          migrated.prepare('SELECT count(*) AS total FROM tags').get(),
        ).toEqual({ total: 1 });
        expect(
          migrated.prepare('SELECT count(*) AS total FROM entity_tags').get(),
        ).toEqual({ total: 1 });
        expect(
          migrated.prepare('SELECT count(*) AS total FROM relations').get(),
        ).toEqual({ total: 1 });
        expect(
          migrated.prepare('SELECT count(*) AS total FROM assets').get(),
        ).toEqual({ total: 1 });
        expect(
          migrated
            .prepare(
              "SELECT count(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'entity_versions'",
            )
            .get(),
        ).toEqual({ total: 1 });

        const indexes = (
          migrated
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('entities_deleted_idx', 'entity_types_deleted_idx', 'entity_versions_entity_created_idx')",
            )
            .all() as { name: string }[]
        ).map((row) => row.name);

        expect(indexes).toEqual(
          expect.arrayContaining([
            'entities_deleted_idx',
            'entity_types_deleted_idx',
            'entity_versions_entity_created_idx',
          ]),
        );

        const entityPlan = migrated
          .prepare(
            'EXPLAIN QUERY PLAN SELECT deleted_at, world_id FROM entities INDEXED BY entities_deleted_idx WHERE deleted_at IS NOT NULL',
          )
          .all() as { detail: string }[];
        expect(
          entityPlan.some((row) => row.detail.includes('entities_deleted_idx')),
        ).toBe(true);

        const typePlan = migrated
          .prepare(
            'EXPLAIN QUERY PLAN SELECT deleted_at, world_id FROM entity_types INDEXED BY entity_types_deleted_idx WHERE deleted_at IS NOT NULL',
          )
          .all() as { detail: string }[];
        expect(
          typePlan.some((row) =>
            row.detail.includes('entity_types_deleted_idx'),
          ),
        ).toBe(true);

        // La tabla nueva admite versiones y rechaza orígenes no admitidos.
        migrated
          .prepare(
            `INSERT INTO entity_versions (id, entity_id, description, description_text, origin, created_at)
             VALUES (?, ?, ?, ?, 'auto', ?)`,
          )
          .run(
            '01900000-0000-7000-8000-000000000009',
            '01900000-0000-7000-8000-000000000004',
            '{"type":"doc"}',
            'Texto anterior',
            1_760_000_000_000,
          );

        expect(() =>
          migrated
            .prepare(
              `INSERT INTO entity_versions (id, entity_id, origin, created_at)
               VALUES (?, ?, 'inventado', ?)`,
            )
            .run(
              '01900000-0000-7000-8000-000000000010',
              '01900000-0000-7000-8000-000000000004',
              1_760_000_000_000,
            ),
        ).toThrow();

        expect(
          migrated
            .prepare(
              'SELECT title FROM search_documents WHERE kind = ? AND source_id = ?',
            )
            .get('entity', '01900000-0000-7000-8000-000000000004'),
        ).toEqual({ title: 'Mara Viento' });
        expect(
          migrated
            .prepare(
              'SELECT d.kind FROM search_fts JOIN search_documents d ON d.rowid = search_fts.rowid WHERE search_fts MATCH ?',
            )
            .all('mareas'),
        ).toEqual([{ kind: 'world' }]);
      } finally {
        closeDatabase(upgraded.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('los rollbacks de 0002 y 0001 vuelven a la versión 1 sin tocar los datos', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      first.client.sqlite
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
        )
        .run('locale', '"es-ES"', 1_760_000_000_000);
      first.client.sqlite
        .prepare(
          `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000001',
          '01900000-0000-7000-8000-000000000002',
          'image',
          'worlds/01900000-0000-7000-8000-000000000002/01900000-0000-7000-8000-000000000001.webp',
          'image/webp',
          10,
          'e'.repeat(64),
          1_760_000_000_000,
        );
      closeDatabase(first.client.sqlite);

      const rollbackSearchSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0006_search.down.sql'),
        'utf8',
      );
      const rollbackTrashVersionsSql = await readFile(
        join(
          REPOSITORY_MIGRATIONS_DIR,
          'rollback',
          '0007_trash_versions.down.sql',
        ),
        'utf8',
      );
      const rollbackRelationsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0005_relations.down.sql'),
        'utf8',
      );
      const rollbackEntitiesSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0004_entities.down.sql'),
        'utf8',
      );
      const rollbackEntityTypesSql = await readFile(
        join(
          REPOSITORY_MIGRATIONS_DIR,
          'rollback',
          '0003_entity_types.down.sql',
        ),
        'utf8',
      );
      const rollbackWorldsSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0002_worlds.down.sql'),
        'utf8',
      );
      const rollbackSql = await readFile(
        join(REPOSITORY_MIGRATIONS_DIR, 'rollback', '0001_assets.down.sql'),
        'utf8',
      );
      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        // El rollback de 0001 solo es válido después de deshacer 0007, 0006,
        // 0005, 0004, 0003 y 0002, porque las relaciones, las fichas,
        // `entity_types`, `worlds` y las versiones referencian tablas
        // anteriores.
        database.exec(rollbackTrashVersionsSql);
        database.exec(rollbackSearchSql);
        database.exec(rollbackRelationsSql);
        database.exec(rollbackEntitiesSql);
        database.exec(rollbackEntityTypesSql);
        database.exec(rollbackWorldsSql);
        database.exec(rollbackSql);

        expect(database.pragma('user_version', { simple: true })).toBe(1);
        expect(
          (
            database
              .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
              .all() as { name: string }[]
          ).map((row) => row.name),
        ).not.toContain('assets');
        expect(
          database
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('locale'),
        ).toEqual({ value: '"es-ES"' });
        expect(
          database
            .prepare('SELECT count(*) AS total FROM schema_migrations')
            .get(),
        ).toEqual({ total: 1 });
      } finally {
        closeDatabase(database);
      }

      // Al reabrir, las migraciones 0001, 0002, 0003, 0004, 0005 y 0006 se
      // vuelven a aplicar con copia previa.
      const reapplied = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        expect(reapplied.schemaVersion).toBe(8);
        expect(reapplied.appliedMigrations).toBe(7);
        expect(reapplied.backup).not.toBeNull();
      } finally {
        closeDatabase(reapplied.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });
});
