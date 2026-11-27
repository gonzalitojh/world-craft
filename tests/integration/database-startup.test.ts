import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  closeDatabase,
  enableWritePragmas,
  openDatabase,
} from '@/main/db/connection';
import { ensureDataDirectories } from '@/main/db/paths';
import { appSettings } from '@/main/db/schema';
import {
  initializeDatabase,
  type DatabaseStartupResult,
} from '@/main/db/startup';

import { createTestDatabase, deadPid } from './helpers/temp-db';

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

describe('arranque de la base de datos', () => {
  it('crea la base con pragmas, esquema inicial y las migraciones aplicadas', async () => {
    const test = await createTestDatabase();

    try {
      const result = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      const database = result.client.sqlite;

      try {
        expect(database.pragma('journal_mode', { simple: true })).toBe('wal');
        expect(database.pragma('synchronous', { simple: true })).toBe(1);
        expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
        expect(database.pragma('busy_timeout', { simple: true })).toBe(5000);
        // 0000_init + 0001_assets + 0002_worlds + 0003_entity_types +
        // 0004_entities + 0005_relations + 0006_search + 0007_trash_versions +
        // 0008_world_description => user_version 9
        // (número de migraciones, no el prefijo de la etiqueta).
        expect(database.pragma('user_version', { simple: true })).toBe(9);

        const tables = (
          database
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all() as { name: string }[]
        ).map((row) => row.name);

        expect(tables).toEqual(
          expect.arrayContaining([
            'schema_migrations',
            'app_settings',
            'assets',
            'worlds',
            'activity_log',
            'entity_types',
            'entities',
            'tags',
            'entity_tags',
            'entity_gallery',
            'relation_types',
            'relations',
            'search_documents',
            'entity_versions',
          ]),
        );

        const migration = database
          .prepare('SELECT id, checksum FROM schema_migrations ORDER BY id')
          .get() as { id: string; checksum: string };

        expect(migration.id).toBe('0000_init');
        expect(migration.checksum).toMatch(/^[a-f0-9]{64}$/);

        expect(result.client.orm.select().from(appSettings).all()).toEqual([]);
      } finally {
        closeDatabase(database);
      }

      expect(result.schemaVersion).toBe(9);
      expect(result.appliedMigrations).toBe(9);
      expect(result.newDatabase).toBe(true);
      expect(result.backup).toBeNull();
      expect(await readdir(test.paths.preMigrationBackupsDir)).toEqual([]);
      expect((await stat(result.paths.databaseFile)).isFile()).toBe(true);
    } finally {
      await test.cleanup();
    }
  });

  it('no crea copia en una base nueva y es idempotente al reabrir', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      expect(first.newDatabase).toBe(true);
      expect(first.backup).toBeNull();
      closeDatabase(first.client.sqlite);

      // Se deja la base en DELETE para comprobar que, sin migraciones
      // pendientes, el arranque vuelve a activar WAL antes de `ready`.
      const deleteMode = openDatabase({
        file: test.paths.databaseFile,
        deferWritePragmas: true,
      });
      deleteMode.pragma('journal_mode = DELETE');
      closeDatabase(deleteMode);

      const second = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      try {
        expect(second.newDatabase).toBe(false);
        expect(second.appliedMigrations).toBe(0);
        expect(second.backup).toBeNull();
        expect(second.schemaVersion).toBe(9);
        expect(
          second.client.sqlite.pragma('journal_mode', { simple: true }),
        ).toBe('wal');
        expect(await readdir(test.paths.preMigrationBackupsDir)).toEqual([]);
      } finally {
        closeDatabase(second.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('detecta una versión de esquema adelantada y no escribe', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      const database = openDatabase({ file: test.paths.databaseFile });
      database.pragma('user_version = 10');
      closeDatabase(database);

      const result = expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
        'DB_VERSION_AHEAD',
      );

      expect(result.schemaVersion).toBe(10);
    } finally {
      await test.cleanup();
    }
  });

  it('detecta un estado incoherente entre schema_migrations y user_version', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      const database = openDatabase({ file: test.paths.databaseFile });
      database.pragma('user_version = 0');
      closeDatabase(database);

      expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
        'DB_MIGRATION_FAILED',
      );
    } finally {
      await test.cleanup();
    }
  });

  it('entra en modo seguro con un archivo que no es SQLite', async () => {
    const test = await createTestDatabase();

    try {
      ensureDataDirectories(test.paths);
      await writeFile(test.paths.databaseFile, 'esto no es sqlite', 'utf8');

      const result = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      expect(result.status).toBe('safe-mode');

      if (result.status === 'safe-mode') {
        expect(['DB_OPEN_FAILED', 'DB_INTEGRITY_FAILED']).toContain(
          result.code,
        );
      }
    } finally {
      await test.cleanup();
    }
  });

  it('no crea una base vacía si quedan restos .rollback de una restauración', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      await rename(
        test.paths.databaseFile,
        `${test.paths.databaseFile}.rollback`,
      );
      await writeFile(`${test.paths.databaseFile}.rollback-wal`, 'wal', 'utf8');
      await writeFile(
        `${test.paths.databaseFile}.rollback-journal`,
        'journal',
        'utf8',
      );

      const result = expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
        'DB_RESTORE_INTERRUPTED',
      );

      expect(result.paths).not.toBeNull();
      await expect(access(test.paths.databaseFile)).rejects.toThrow();
      await expect(
        access(`${test.paths.databaseFile}.rollback`),
      ).resolves.toBeUndefined();
    } finally {
      await test.cleanup();
    }
  });

  it('no crea una base vacía si queda un temporal de restauración', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      await rename(
        test.paths.databaseFile,
        join(test.rootDir, 'base-guardada.sqlite'),
      );
      await writeFile(
        `${test.paths.databaseFile}.restore.tmp`,
        'resto',
        'utf8',
      );

      expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
        'DB_RESTORE_INTERRUPTED',
      );
      await expect(access(test.paths.databaseFile)).rejects.toThrow();
    } finally {
      await test.cleanup();
    }
  });

  it('limpia un lock de restauración obsoleto y arranca', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      const lockFile = join(test.paths.dataDir, '.restore.lock');

      await writeFile(
        lockFile,
        JSON.stringify({ pid: await deadPid(), createdAt: '2026-11-19' }),
        'utf8',
      );

      const ready = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      closeDatabase(ready.client.sqlite);

      await expect(access(lockFile)).rejects.toThrow();
    } finally {
      await test.cleanup();
    }
  });

  it('entra en modo seguro si el lock de restauración está vivo', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      const lockFile = join(test.paths.dataDir, '.restore.lock');

      await writeFile(
        lockFile,
        JSON.stringify({ pid: process.pid, createdAt: '2026-11-19' }),
        'utf8',
      );

      expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
        'DB_RESTORE_INTERRUPTED',
      );
      await expect(access(lockFile)).resolves.toBeUndefined();
    } finally {
      await test.cleanup();
    }
  });

  it('entra en modo seguro si hay un marcador de restauración pendiente', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(first.client.sqlite);

      const pendingFile = join(test.paths.dataDir, '.restore.pending');

      await writeFile(
        pendingFile,
        JSON.stringify({ pid: 999_999, createdAt: '2026-11-19' }),
        'utf8',
      );

      expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
        'DB_RESTORE_INTERRUPTED',
      );
      await expect(access(pendingFile)).resolves.toBeUndefined();
    } finally {
      await test.cleanup();
    }
  });

  it('difiere WAL hasta después de comprobar la integridad', async () => {
    const test = await createTestDatabase();

    try {
      ensureDataDirectories(test.paths);

      const database = openDatabase({
        file: test.paths.databaseFile,
        deferWritePragmas: true,
      });

      try {
        expect(database.pragma('journal_mode', { simple: true })).toBe(
          'delete',
        );
        expect(database.pragma('synchronous', { simple: true })).toBe(2);
        expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
        expect(database.pragma('busy_timeout', { simple: true })).toBe(5000);

        enableWritePragmas(database);

        expect(database.pragma('journal_mode', { simple: true })).toBe('wal');
        expect(database.pragma('synchronous', { simple: true })).toBe(1);
      } finally {
        closeDatabase(database);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('detecta una página corrupta y entra en modo seguro sin escribir', async () => {
    const test = await createTestDatabase();

    try {
      const first = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );

      const database = first.client.sqlite;
      const insert = database.prepare(
        'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      );

      for (let index = 0; index < 200; index += 1) {
        insert.run(`clave-${index}`, '"valor"', index);
      }

      const pageSize = database.pragma('page_size', { simple: true }) as number;
      const pageCount = database.pragma('page_count', {
        simple: true,
      }) as number;

      expect(pageCount).toBeGreaterThan(1);
      database.pragma('wal_checkpoint(TRUNCATE)');
      closeDatabase(database);

      // Se deja la base en modo DELETE para comprobar que el arranque en modo
      // seguro ni siquiera activa WAL sobre una base corrupta.
      const deleteMode = openDatabase({
        file: test.paths.databaseFile,
        deferWritePragmas: true,
      });

      try {
        // Tras el primer arranque, WAL es persistente en la cabecera; el modo
        // diferido no lo cambia. Se pasa a DELETE para la prueba de corrupción.
        expect(deleteMode.pragma('journal_mode', { simple: true })).toBe('wal');
        deleteMode.pragma('journal_mode = DELETE');
        expect(deleteMode.pragma('journal_mode', { simple: true })).toBe(
          'delete',
        );
      } finally {
        closeDatabase(deleteMode);
      }

      // Se conserva el tamaño del archivo y la cabecera; solo se destruye la
      // segunda página para que `integrity_check` detecte la corrupción.
      const bytes = await readFile(test.paths.databaseFile);
      const corrupted = Buffer.from(bytes);
      Buffer.alloc(pageSize).copy(corrupted, pageSize);
      await writeFile(test.paths.databaseFile, corrupted);

      const before = await readFile(test.paths.databaseFile);

      expectSafeMode(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
        'DB_INTEGRITY_FAILED',
      );

      const after = await readFile(test.paths.databaseFile);
      expect(after.equals(before)).toBe(true);
    } finally {
      await test.cleanup();
    }
  });

  it('registra el arranque sin rutas, SQL ni contenido del usuario', async () => {
    const test = await createTestDatabase();

    try {
      const result = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(result.client.sqlite);

      const log = await readFile(test.paths.startupLogFile, 'utf8');

      expect(log.trim().split('\n').length).toBeGreaterThan(0);
      expect(log).not.toContain(test.rootDir);
      expect(log).not.toContain('world-craft.sqlite');
      expect(log).not.toContain('CREATE TABLE');
      expect(log).not.toContain('app_settings');

      for (const line of log.trim().split('\n')) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    } finally {
      await test.cleanup();
    }
  });

  it('escribe solo dentro de userData y no en la carpeta de instalación', async () => {
    const test = await createTestDatabase();
    const installDir = join(test.rootDir, 'install');

    try {
      await mkdir(installDir, { recursive: true });

      const result = expectReady(
        await initializeDatabase({
          userDataDir: test.userDataDir,
          migrationsDir: test.migrationsDir,
        }),
      );
      closeDatabase(result.client.sqlite);

      expect(result.paths.databaseFile).toBe(test.paths.databaseFile);
      expect(result.paths.databaseFile.startsWith(test.userDataDir)).toBe(true);
      expect(await readdir(installDir)).toEqual([]);

      const dataFiles = await readdir(test.paths.dataDir);
      expect(dataFiles).toContain('world-craft.sqlite');
    } finally {
      await test.cleanup();
    }
  });
});
