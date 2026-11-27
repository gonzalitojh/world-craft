import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '@/main/db/connection';
import {
  applyPendingMigrations,
  inspectMigrations,
} from '@/main/db/migrations';
import { initializeDatabase } from '@/main/db/startup';

import {
  createMigrationFixture,
  createTestDatabase,
  INIT_MIGRATION_SQL,
} from '../helpers/temp-db';

const VALID_MIGRATION = {
  tag: '0001_notes',
  sql: 'CREATE TABLE notes (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);\n',
};

const ORPHAN_MIGRATION = {
  tag: '0001_orphan',
  sql: `CREATE TABLE parents (id TEXT PRIMARY KEY NOT NULL);
CREATE TABLE children (
  id TEXT PRIMARY KEY NOT NULL,
  parent_id TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES parents(id)
);
INSERT INTO children (id, parent_id) VALUES ('01900000-0000-7000-8000-000000000001', 'no-existe');
`,
};

const BROKEN_MIGRATION = {
  tag: '0001_broken',
  sql: 'CREATE TABLE should_not_exist (id TEXT PRIMARY KEY NOT NULL);\nESTO NO ES SQL;\n',
};

async function openBase(migrations: readonly { tag: string; sql: string }[]) {
  const test = await createTestDatabase();
  const migrationsDir = join(test.rootDir, 'migrations');

  await createMigrationFixture(migrationsDir, [
    { tag: '0000_init', sql: INIT_MIGRATION_SQL },
  ]);

  const first = await initializeDatabase({
    userDataDir: test.userDataDir,
    migrationsDir,
  });

  if (first.status !== 'ready') {
    await test.cleanup();
    throw new Error(`La base no arrancó: ${first.code}.`);
  }

  closeDatabase(first.client.sqlite);
  await createMigrationFixture(migrationsDir, [
    { tag: '0000_init', sql: INIT_MIGRATION_SQL },
    ...migrations,
  ]);

  return {
    test,
    migrationsDir,
    database: openDatabase({ file: test.paths.databaseFile }),
  };
}

describe('runner de migraciones con claves foráneas', () => {
  it('aplica un lote válido y deja foreign_keys activo', async () => {
    const fixture = await openBase([VALID_MIGRATION]);

    try {
      const plan = inspectMigrations(fixture.database, fixture.migrationsDir);
      const applied = applyPendingMigrations(fixture.database, plan);

      expect(applied).toBe(1);
      expect(fixture.database.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(fixture.database.pragma('user_version', { simple: true })).toBe(2);
      expect(
        fixture.database
          .prepare("SELECT name FROM sqlite_master WHERE name = 'notes'")
          .get(),
      ).toEqual({ name: 'notes' });
    } finally {
      closeDatabase(fixture.database);
      await fixture.test.cleanup();
    }
  });

  it('revierte el lote si foreign_key_check detecta un huérfano', async () => {
    const fixture = await openBase([ORPHAN_MIGRATION]);

    try {
      const plan = inspectMigrations(fixture.database, fixture.migrationsDir);

      expect(() => applyPendingMigrations(fixture.database, plan)).toThrowError(
        expect.objectContaining({ code: 'DB_MIGRATION_FAILED' }),
      );
      expect(fixture.database.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(fixture.database.pragma('user_version', { simple: true })).toBe(1);
      expect(fixture.database.inTransaction).toBe(false);
      expect(
        fixture.database
          .prepare(
            "SELECT count(*) AS total FROM sqlite_master WHERE name IN ('children', 'parents')",
          )
          .get(),
      ).toEqual({ total: 0 });
      expect(
        fixture.database
          .prepare('SELECT id FROM schema_migrations ORDER BY id')
          .all(),
      ).toEqual([{ id: '0000_init' }]);
      expect(fixture.database.pragma('foreign_key_check')).toEqual([]);
    } finally {
      closeDatabase(fixture.database);
      await fixture.test.cleanup();
    }
  });

  it('revierte y restaura foreign_keys si una migración lanza', async () => {
    const fixture = await openBase([BROKEN_MIGRATION]);

    try {
      const plan = inspectMigrations(fixture.database, fixture.migrationsDir);

      expect(() => applyPendingMigrations(fixture.database, plan)).toThrowError(
        expect.objectContaining({ code: 'DB_MIGRATION_FAILED' }),
      );
      expect(fixture.database.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(fixture.database.pragma('user_version', { simple: true })).toBe(1);
      expect(
        fixture.database
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'should_not_exist'",
          )
          .get(),
      ).toBeUndefined();
    } finally {
      closeDatabase(fixture.database);
      await fixture.test.cleanup();
    }
  });

  it('rechaza una llamada dentro de una transacción activa', async () => {
    const fixture = await openBase([VALID_MIGRATION]);

    try {
      const plan = inspectMigrations(fixture.database, fixture.migrationsDir);

      const run = fixture.database.transaction(() => {
        expect(() =>
          applyPendingMigrations(fixture.database, plan),
        ).toThrowError(
          expect.objectContaining({ code: 'DB_MIGRATION_FAILED' }),
        );
        expect(fixture.database.pragma('foreign_keys', { simple: true })).toBe(
          1,
        );
      });

      run();
      expect(fixture.database.pragma('user_version', { simple: true })).toBe(1);
    } finally {
      closeDatabase(fixture.database);
      await fixture.test.cleanup();
    }
  });

  it('aplica 0009 sobre una base nueva sin cuarentena', async () => {
    const test = await createTestDatabase();

    try {
      const result = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      expect(result.status).toBe('ready');

      if (result.status !== 'ready') {
        return;
      }

      try {
        expect(result.schemaVersion).toBe(10);
        expect(
          result.client.sqlite.pragma('foreign_keys', { simple: true }),
        ).toBe(1);
        expect(
          result.client.sqlite
            .prepare('SELECT count(*) AS total FROM assets_quarantine')
            .get(),
        ).toEqual({ total: 0 });
        expect(
          result.client.sqlite
            .prepare(
              'SELECT count(*) AS total FROM assets_quarantine_references',
            )
            .get(),
        ).toEqual({ total: 0 });
        expect(result.client.sqlite.pragma('foreign_key_check')).toEqual([]);
      } finally {
        closeDatabase(result.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });
});
