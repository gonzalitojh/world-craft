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
        expect(upgraded.schemaVersion).toBe(5);
        expect(upgraded.appliedMigrations).toBe(4);
        expect(upgraded.backup).not.toBeNull();
        expect(
          upgraded.client.sqlite.pragma('user_version', { simple: true }),
        ).toBe(5);
        expect(
          upgraded.client.sqlite
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('theme'),
        ).toEqual({ value: '"dark"' });
        expect(
          upgraded.client.sqlite
            .prepare('SELECT count(*) AS total FROM schema_migrations')
            .get(),
        ).toEqual({ total: 5 });

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
        expect(upgraded.schemaVersion).toBe(5);
        expect(upgraded.appliedMigrations).toBe(2);
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

  it('aplica 0004 sobre mundos y tipos existentes sin perder datos', async () => {
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
        expect(upgraded.schemaVersion).toBe(5);
        expect(upgraded.appliedMigrations).toBe(1);
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
        // El rollback de 0001 solo es válido después de deshacer 0004, 0003 y
        // 0002, porque las fichas, `entity_types` y `worlds` referencian
        // tablas anteriores.
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

      // Al reabrir, las migraciones 0001, 0002, 0003 y 0004 se vuelven a
      // aplicar con copia previa.
      const reapplied = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        expect(reapplied.schemaVersion).toBe(5);
        expect(reapplied.appliedMigrations).toBe(4);
        expect(reapplied.backup).not.toBeNull();
      } finally {
        closeDatabase(reapplied.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });
});
