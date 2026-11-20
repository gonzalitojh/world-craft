import {
  access,
  appendFile,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createBackup } from '@/main/backup/create';
import {
  createRestoreFileOperations,
  findLatestRestorableBackup,
  inspectRestorableBackup,
  restoreBackup,
  type RestoreBackupOptions,
  type RestoreFileOperations,
} from '@/main/backup/restore';
import { closeDatabase, openDatabase } from '@/main/db/connection';
import { readTargetSchemaVersion } from '@/main/db/migrations';
import { initializeDatabase } from '@/main/db/startup';

import {
  createMigrationFixture,
  createTestDatabase,
  deadPid,
  INIT_MIGRATION_SQL,
  REPOSITORY_MIGRATIONS_DIR,
} from './helpers/temp-db';

type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
type Backup = Awaited<ReturnType<typeof createDailyBackup>>;

const RESTORE_TIMESTAMP = 1_763_640_000_000;
const TARGET_SCHEMA_VERSION = readTargetSchemaVersion(
  REPOSITORY_MIGRATIONS_DIR,
);

async function createReadyDatabase(
  test: TestDatabase,
  migrationsDir = test.migrationsDir,
): Promise<void> {
  const result = await initializeDatabase({
    userDataDir: test.userDataDir,
    migrationsDir,
  });

  if (result.status !== 'ready') {
    throw new Error(`Se esperaba ready y llegó ${result.code}.`);
  }

  closeDatabase(result.client.sqlite);
}

async function writeSetting(
  test: TestDatabase,
  key: string,
  value: string,
): Promise<void> {
  const database = openDatabase({ file: test.paths.databaseFile });

  try {
    database
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), RESTORE_TIMESTAMP);
  } finally {
    closeDatabase(database);
  }
}

async function readSetting(
  file: string,
  key: string,
): Promise<string | undefined> {
  const database = openDatabase({ file, readonly: true });

  try {
    const row = database
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get(key) as { value: string } | undefined;

    return row?.value;
  } finally {
    closeDatabase(database);
  }
}

async function createDailyBackup(
  test: TestDatabase,
  timestamp = RESTORE_TIMESTAMP,
) {
  return createBackupWithSchemaVersion(test, timestamp, TARGET_SCHEMA_VERSION);
}

async function createBackupWithSchemaVersion(
  test: TestDatabase,
  timestamp: number,
  schemaVersion: number,
) {
  const database = openDatabase({ file: test.paths.databaseFile });

  try {
    return await createBackup({
      database,
      parentDir: test.paths.dailyBackupsDir,
      reason: 'daily',
      timestamp,
      schemaVersion,
    });
  } finally {
    closeDatabase(database);
  }
}

function restoreOptions(
  test: TestDatabase,
  backup: Backup,
  overrides?: Partial<RestoreBackupOptions>,
): RestoreBackupOptions {
  return {
    backupDirectory: backup.directory,
    dataDir: test.paths.dataDir,
    databaseFile: test.paths.databaseFile,
    preRestoreDir: test.paths.preRestoreBackupsDir,
    targetSchemaVersion: TARGET_SCHEMA_VERSION,
    timestamp: RESTORE_TIMESTAMP,
    ...overrides,
  };
}

async function expectMissing(file: string): Promise<void> {
  await expect(access(file)).rejects.toThrow();
}

async function expectPresent(file: string): Promise<void> {
  await expect(access(file)).resolves.toBeUndefined();
}

/** Configura un fallo en el renombrado indicado (o en varios). */
function failingRenameOperations(
  failAt: number | readonly number[],
): RestoreFileOperations {
  const base = createRestoreFileOperations();
  const failing = new Set(typeof failAt === 'number' ? [failAt] : failAt);
  let calls = 0;

  return {
    copyFile: base.copyFile,
    async rename(source, target) {
      calls += 1;

      if (failing.has(calls)) {
        throw new Error('renombrado inyectado');
      }

      return base.rename(source, target);
    },
  };
}

/** Falla al instalar el temporal sobre la base, sin contar otros renombrados. */
function failingInstallRenameOperations(
  databaseFile: string,
): RestoreFileOperations {
  const base = createRestoreFileOperations();

  return {
    copyFile: base.copyFile,
    async rename(source, target) {
      if (source.endsWith('.restore.tmp') && target === databaseFile) {
        throw new Error('renombrado inyectado');
      }

      return base.rename(source, target);
    },
  };
}

/** Falla al copiar el origen al temporal. */
function failingCopyOperations(): RestoreFileOperations {
  const base = createRestoreFileOperations();

  return {
    copyFile: async () => {
      throw new Error('copia inyectada');
    },
    rename: base.rename,
  };
}

/** Corrompe el origen después de la inspección y antes de copiarlo. */
function corruptingCopyOperations(): RestoreFileOperations {
  const base = createRestoreFileOperations();

  return {
    copyFile: async (source, target) => {
      await appendFile(source, 'corrupto', 'utf8');

      return base.copyFile(source, target);
    },
    rename: base.rename,
  };
}

/** Base viva ausente y `.rollback*` de una restauración anterior. */
async function createInterruptedRestoreState(
  test: TestDatabase,
): Promise<Backup> {
  await createReadyDatabase(test);
  await writeSetting(test, 'marcador', 'respaldo');
  const backup = await createDailyBackup(test);

  await rename(test.paths.databaseFile, `${test.paths.databaseFile}.rollback`);

  return backup;
}

describe('restauración de copias', () => {
  it('restaura los datos, conserva la base actual y no toca los assets', async () => {
    const test = await createTestDatabase();
    const assetFile = join(
      test.paths.assetsWorldsDir,
      '01900000-0000-7000-8000-000000000001',
      '01900000-0000-7000-8000-000000000002.webp',
    );

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      await mkdir(dirname(assetFile), { recursive: true });
      await writeFile(assetFile, 'asset-de-prueba', 'utf8');

      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error('Se esperaba una restauración correcta.');
      }

      expect(result.preservationDirectory).not.toBeNull();
      expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
        '"respaldo"',
      );
      expect(await readFile(assetFile, 'utf8')).toBe('asset-de-prueba');
      await expectMissing(join(test.paths.dataDir, '.restore.lock'));
      await expectMissing(join(test.paths.dataDir, '.restore.pending'));
      await expectMissing(`${test.paths.databaseFile}.rollback`);
      await expectMissing(`${test.paths.databaseFile}.restore.tmp`);

      if (result.preservationDirectory !== null) {
        const preserved = join(
          result.preservationDirectory,
          'world-craft.sqlite',
        );

        expect(await readSetting(preserved, 'marcador')).toBe('"actual"');
      }
    } finally {
      await test.cleanup();
    }
  });

  it('restaura aunque la base actual falte y no crea preservación', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);

      await rm(test.paths.databaseFile, { force: true });
      await rm(`${test.paths.databaseFile}-wal`, { force: true });
      await rm(`${test.paths.databaseFile}-shm`, { force: true });

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result).toMatchObject({
        ok: true,
        preservationDirectory: null,
      });
      expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
        '"respaldo"',
      );
    } finally {
      await test.cleanup();
    }
  });

  it('rechaza una copia con bytes corruptos sin tocar la base actual', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      const before = await readFile(test.paths.databaseFile);

      await writeFile(backup.databaseFile, 'corrupto', 'utf8');

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result).toMatchObject({
        ok: false,
        code: 'DB_RESTORE_INVALID',
        reason: 'checksum',
      });
      expect((await readFile(test.paths.databaseFile)).equals(before)).toBe(
        true,
      );
      await expectMissing(join(test.paths.dataDir, '.restore.lock'));
    } finally {
      await test.cleanup();
    }
  });

  it('rechaza un manifiesto manipulado y una versión futura', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const tampered = await createDailyBackup(test, RESTORE_TIMESTAMP);
      const manifestFile = join(tampered.directory, 'manifest.json');
      const manifest = JSON.parse(
        await readFile(manifestFile, 'utf8'),
      ) as Record<string, unknown>;

      await writeFile(
        manifestFile,
        `${JSON.stringify({ ...manifest, sha256: 'c'.repeat(64) })}\n`,
        'utf8',
      );

      await expect(
        restoreBackup(restoreOptions(test, tampered)),
      ).resolves.toMatchObject({
        ok: false,
        code: 'DB_RESTORE_INVALID',
        reason: 'checksum',
      });

      const future = await createDailyBackup(test, RESTORE_TIMESTAMP + 1000);
      const futureManifestFile = join(future.directory, 'manifest.json');
      const futureManifest = JSON.parse(
        await readFile(futureManifestFile, 'utf8'),
      ) as Record<string, unknown>;

      await writeFile(
        futureManifestFile,
        `${JSON.stringify({ ...futureManifest, schemaVersion: 99 })}\n`,
        'utf8',
      );

      await expect(
        restoreBackup(restoreOptions(test, future)),
      ).resolves.toMatchObject({
        ok: false,
        code: 'DB_RESTORE_INVALID',
        reason: 'version-ahead',
      });
    } finally {
      await test.cleanup();
    }
  });

  it('devuelve la base anterior si falla cualquiera de los renombrados', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      const before = await readFile(test.paths.databaseFile);

      for (const failAt of [1, 2]) {
        const result = await restoreBackup(
          restoreOptions(test, backup, {
            operations: failingRenameOperations(failAt),
          }),
        );

        expect(result).toMatchObject({
          ok: false,
          code: 'DB_RESTORE_FAILED',
          reason: 'io',
        });
        expect((await readFile(test.paths.databaseFile)).equals(before)).toBe(
          true,
        );
        expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
          '"actual"',
        );
        await expectMissing(`${test.paths.databaseFile}.rollback`);
        await expectMissing(`${test.paths.databaseFile}.restore.tmp`);
        await expectMissing(join(test.paths.dataDir, '.restore.lock'));
        await expectMissing(join(test.paths.dataDir, '.restore.pending'));
      }
    } finally {
      await test.cleanup();
    }
  });

  it('recupera la base y sus WAL/SHM si falla cada renombrado del reemplazo', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);

      const crashDirectory = join(test.rootDir, 'crash-renames');
      await mkdir(crashDirectory, { recursive: true });

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        database
          .prepare(
            `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          )
          .run('marcador', '"actual"', RESTORE_TIMESTAMP);

        for (const suffix of ['-wal', '-shm'] as const) {
          await copyFile(
            `${test.paths.databaseFile}${suffix}`,
            join(crashDirectory, `world-craft.sqlite${suffix}`),
          );
        }

        await copyFile(
          test.paths.databaseFile,
          join(crashDirectory, 'world-craft.sqlite'),
        );
      } finally {
        closeDatabase(database);
      }

      for (const failAt of [1, 2, 3, 4]) {
        for (const suffix of ['', '-wal', '-shm'] as const) {
          await copyFile(
            join(crashDirectory, `world-craft.sqlite${suffix}`),
            `${test.paths.databaseFile}${suffix}`,
          );
        }

        const result = await restoreBackup(
          restoreOptions(test, backup, {
            operations: failingRenameOperations(failAt),
          }),
        );

        expect(result).toMatchObject({
          ok: false,
          code: 'DB_RESTORE_FAILED',
          reason: 'io',
        });
        expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
          '"actual"',
        );
        await expectMissing(`${test.paths.databaseFile}.rollback`);
        await expectMissing(`${test.paths.databaseFile}.rollback-wal`);
        await expectMissing(`${test.paths.databaseFile}.rollback-shm`);
        await expectMissing(`${test.paths.databaseFile}.restore.tmp`);
        await expectMissing(join(test.paths.dataDir, '.restore.lock'));
      }
    } finally {
      await test.cleanup();
    }
  });

  it('no aplica un WAL antiguo sobre la base restaurada', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);

      const crashDirectory = join(test.rootDir, 'crash');
      await mkdir(crashDirectory, { recursive: true });

      // Se captura el estado con un WAL sin consolidar, como tras un cierre
      // abrupto, y se restaura ese estado sobre la base viva.
      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        database
          .prepare(
            `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          )
          .run('marcador', '"obsoleto"', RESTORE_TIMESTAMP);
        database.pragma('wal_checkpoint(PASSIVE)');
        database
          .prepare('UPDATE app_settings SET value = ? WHERE key = ?')
          .run('"obsoleto"', 'marcador');

        await copyFile(
          test.paths.databaseFile,
          join(crashDirectory, 'world-craft.sqlite'),
        );
        await copyFile(
          `${test.paths.databaseFile}-wal`,
          join(crashDirectory, 'world-craft.sqlite-wal'),
        );
      } finally {
        closeDatabase(database);
      }

      await copyFile(
        join(crashDirectory, 'world-craft.sqlite'),
        test.paths.databaseFile,
      );
      await copyFile(
        join(crashDirectory, 'world-craft.sqlite-wal'),
        `${test.paths.databaseFile}-wal`,
      );

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result.ok).toBe(true);
      expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
        '"respaldo"',
      );
      await expectMissing(`${test.paths.databaseFile}.rollback`);
      await expectMissing(`${test.paths.databaseFile}.rollback-wal`);
    } finally {
      await test.cleanup();
    }
  });

  it('migra una copia con esquema antiguo al relanzar la aplicación', async () => {
    const test = await createTestDatabase();
    const legacyMigrations = join(test.rootDir, 'legacy-migrations');

    try {
      await createMigrationFixture(legacyMigrations, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
      ]);
      await createReadyDatabase(test, legacyMigrations);
      await writeSetting(test, 'marcador', 'antiguo');

      const backup = await createBackupWithSchemaVersion(
        test,
        RESTORE_TIMESTAMP,
        1,
      );

      await writeFile(test.paths.databaseFile, 'corrupto', 'utf8');

      const restored = await restoreBackup(restoreOptions(test, backup));

      expect(restored.ok).toBe(true);

      const startup = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      expect(startup.status).toBe('ready');

      if (startup.status !== 'ready') {
        throw new Error('Se esperaba ready tras restaurar.');
      }

      try {
        expect(startup.schemaVersion).toBe(TARGET_SCHEMA_VERSION);
        expect(startup.appliedMigrations).toBe(4);
        expect(startup.backup).not.toBeNull();
        expect(
          startup.client.sqlite
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('marcador'),
        ).toEqual({ value: '"antiguo"' });
      } finally {
        closeDatabase(startup.client.sqlite);
      }
    } finally {
      await test.cleanup();
    }
  });

  it('rechaza un lock vivo y recupera uno obsoleto o ilegible', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      const lockFile = join(test.paths.dataDir, '.restore.lock');
      const before = await readFile(test.paths.databaseFile);

      await writeFile(
        lockFile,
        JSON.stringify({ pid: process.pid, createdAt: '2026-11-19' }),
        'utf8',
      );

      await expect(
        restoreBackup(restoreOptions(test, backup)),
      ).resolves.toMatchObject({
        ok: false,
        code: 'DB_RESTORE_FAILED',
        reason: 'lock',
      });
      expect((await readFile(test.paths.databaseFile)).equals(before)).toBe(
        true,
      );
      await expectPresent(lockFile);

      await writeFile(
        lockFile,
        JSON.stringify({ pid: await deadPid(), createdAt: '2026-11-19' }),
        'utf8',
      );

      await expect(
        restoreBackup(restoreOptions(test, backup)),
      ).resolves.toMatchObject({ ok: true });
      await expectMissing(lockFile);
      expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
        '"respaldo"',
      );

      await writeSetting(test, 'marcador', 'actual');
      await writeFile(lockFile, 'basura', 'utf8');

      await expect(
        restoreBackup(restoreOptions(test, backup)),
      ).resolves.toMatchObject({ ok: true });
      await expectMissing(lockFile);
    } finally {
      await test.cleanup();
    }
  });

  it('encuentra la copia válida más reciente e ignora corruptas y futuras', async () => {
    const test = await createTestDatabase();
    const directories = [
      test.paths.dailyBackupsDir,
      test.paths.weeklyBackupsDir,
      test.paths.monthlyBackupsDir,
      test.paths.preMigrationBackupsDir,
    ];

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');

      expect(
        await findLatestRestorableBackup({
          directories,
          targetSchemaVersion: TARGET_SCHEMA_VERSION,
        }),
      ).toBeNull();

      const valid = await createDailyBackup(test, RESTORE_TIMESTAMP);
      const corrupt = await createDailyBackup(test, RESTORE_TIMESTAMP + 1000);
      const future = await createDailyBackup(test, RESTORE_TIMESTAMP + 2000);

      await writeFile(corrupt.databaseFile, 'corrupto', 'utf8');

      const futureManifestFile = join(future.directory, 'manifest.json');
      const futureManifest = JSON.parse(
        await readFile(futureManifestFile, 'utf8'),
      ) as Record<string, unknown>;

      await writeFile(
        futureManifestFile,
        `${JSON.stringify({ ...futureManifest, schemaVersion: 99 })}\n`,
        'utf8',
      );

      await expect(
        findLatestRestorableBackup({
          directories,
          targetSchemaVersion: TARGET_SCHEMA_VERSION,
        }),
      ).resolves.toMatchObject({ directory: valid.directory });

      await expect(
        inspectRestorableBackup({
          directory: corrupt.directory,
          targetSchemaVersion: TARGET_SCHEMA_VERSION,
        }),
      ).resolves.toEqual({ ok: false, reason: 'checksum' });

      await expect(
        inspectRestorableBackup({
          directory: future.directory,
          targetSchemaVersion: TARGET_SCHEMA_VERSION,
        }),
      ).resolves.toEqual({ ok: false, reason: 'version-ahead' });
    } finally {
      await test.cleanup();
    }
  });

  it('restaura una copia v1 pre-migración de extremo a extremo', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      const manifestFile = join(backup.directory, 'manifest.json');
      const manifest = JSON.parse(
        await readFile(manifestFile, 'utf8'),
      ) as Record<string, unknown>;

      await writeFile(
        manifestFile,
        `${JSON.stringify({
          formatVersion: 1,
          reason: 'pre-migration',
          createdAt: manifest.createdAt,
          databaseFile: manifest.databaseFile,
          schemaVersion: manifest.schemaVersion,
          sizeBytes: manifest.sizeBytes,
          sha256: manifest.sha256,
        })}\n`,
        'utf8',
      );
      await writeSetting(test, 'marcador', 'actual');

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result).toMatchObject({ ok: true });
      expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
        '"respaldo"',
      );
      await expectMissing(`${test.paths.databaseFile}.rollback`);
    } finally {
      await test.cleanup();
    }
  });

  it('preserva un .rollback obsoleto antes de restaurar', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      await copyFile(
        test.paths.databaseFile,
        `${test.paths.databaseFile}.rollback`,
      );
      await writeFile(
        `${test.paths.databaseFile}.rollback-journal`,
        '',
        'utf8',
      );

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result).toMatchObject({ ok: true });

      const directories = await readdir(test.paths.preRestoreBackupsDir, {
        withFileTypes: true,
      });
      const stale = directories.find(
        (entry) => entry.isDirectory() && entry.name.endsWith('-rollback'),
      );

      expect(stale).toBeDefined();

      if (stale === undefined) {
        throw new Error('No se preservó el .rollback obsoleto.');
      }

      expect(
        await readSetting(
          join(
            test.paths.preRestoreBackupsDir,
            stale.name,
            'world-craft.sqlite',
          ),
          'marcador',
        ),
      ).toBe('"actual"');
      expect(
        await readFile(
          join(
            test.paths.preRestoreBackupsDir,
            stale.name,
            'world-craft.sqlite-journal',
          ),
          'utf8',
        ),
      ).toBe('');
    } finally {
      await test.cleanup();
    }
  });

  it('mueve y recupera el journal de la base anterior al fallar el reemplazo', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      const journalFile = `${test.paths.databaseFile}-journal`;

      await writeFile(journalFile, '', 'utf8');

      // Orden con solo base y journal: base → .rollback, journal →
      // .rollback-journal y fallo al instalar el temporal.
      const result = await restoreBackup(
        restoreOptions(test, backup, {
          operations: failingRenameOperations(3),
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: 'DB_RESTORE_FAILED',
        reason: 'io',
      });
      expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
        '"actual"',
      );
      expect((await stat(journalFile)).size).toBe(0);
      await expectMissing(`${test.paths.databaseFile}.rollback`);
      await expectMissing(`${test.paths.databaseFile}.rollback-journal`);
    } finally {
      await test.cleanup();
    }
  });

  it('preserva un temporal de restauración obsoleto antes de restaurar', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      const staleTemp = `${test.paths.databaseFile}.restore.tmp`;

      await writeFile(staleTemp, 'temporal-obsoleto', 'utf8');

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result).toMatchObject({ ok: true });
      expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
        '"respaldo"',
      );
      await expectMissing(staleTemp);

      const directories = await readdir(test.paths.preRestoreBackupsDir, {
        withFileTypes: true,
      });
      const stale = directories.find(
        (entry) => entry.isDirectory() && entry.name.endsWith('-restore-tmp'),
      );

      expect(stale).toBeDefined();

      if (stale === undefined) {
        throw new Error('No se preservó el temporal obsoleto.');
      }

      expect(
        await readFile(
          join(
            test.paths.preRestoreBackupsDir,
            stale.name,
            'world-craft.sqlite.restore.tmp',
          ),
          'utf8',
        ),
      ).toBe('temporal-obsoleto');
    } finally {
      await test.cleanup();
    }
  });

  it('no crea una base vacía si falla la copia tras archivar el .rollback', async () => {
    const test = await createTestDatabase();

    try {
      const backup = await createInterruptedRestoreState(test);

      const result = await restoreBackup(
        restoreOptions(test, backup, { operations: failingCopyOperations() }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: 'DB_RESTORE_FAILED',
        reason: 'io',
      });
      await expectMissing(test.paths.databaseFile);
      await expectMissing(`${test.paths.databaseFile}.rollback`);
      await expectPresent(join(test.paths.dataDir, '.restore.pending'));

      const startup = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      expect(startup).toMatchObject({
        status: 'safe-mode',
        code: 'DB_RESTORE_INTERRUPTED',
      });
      await expectMissing(test.paths.databaseFile);
    } finally {
      await test.cleanup();
    }
  });

  it('no crea una base vacía si el origen deja de coincidir con el manifiesto', async () => {
    const test = await createTestDatabase();

    try {
      const backup = await createInterruptedRestoreState(test);

      const result = await restoreBackup(
        restoreOptions(test, backup, {
          operations: corruptingCopyOperations(),
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: 'DB_RESTORE_INVALID',
        reason: 'checksum',
      });
      await expectMissing(test.paths.databaseFile);
      await expectPresent(join(test.paths.dataDir, '.restore.pending'));

      const startup = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      expect(startup).toMatchObject({
        status: 'safe-mode',
        code: 'DB_RESTORE_INTERRUPTED',
      });
      await expectMissing(test.paths.databaseFile);
    } finally {
      await test.cleanup();
    }
  });

  it('no crea una base vacía si falla el primer renombrado del reemplazo', async () => {
    const test = await createTestDatabase();

    try {
      const backup = await createInterruptedRestoreState(test);

      const result = await restoreBackup(
        restoreOptions(test, backup, {
          operations: failingInstallRenameOperations(test.paths.databaseFile),
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: 'DB_RESTORE_FAILED',
        reason: 'io',
      });
      await expectMissing(test.paths.databaseFile);
      await expectPresent(join(test.paths.dataDir, '.restore.pending'));

      const startup = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      expect(startup).toMatchObject({
        status: 'safe-mode',
        code: 'DB_RESTORE_INTERRUPTED',
      });
      await expectMissing(test.paths.databaseFile);
    } finally {
      await test.cleanup();
    }
  });

  it('reutiliza un marcador pendiente anterior y lo elimina al restaurar', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      const pendingFile = join(test.paths.dataDir, '.restore.pending');

      await writeFile(
        pendingFile,
        JSON.stringify({ pid: 999_999, createdAt: '2026-11-18' }),
        'utf8',
      );

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result).toMatchObject({ ok: true });
      expect(await readSetting(test.paths.databaseFile, 'marcador')).toBe(
        '"respaldo"',
      );
      await expectMissing(pendingFile);
      await expectMissing(join(test.paths.dataDir, '.restore.lock'));
    } finally {
      await test.cleanup();
    }
  });

  it('devuelve DB_RESTORE_ROLLBACK_FAILED y el arranque detecta los restos', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);
      await writeSetting(test, 'marcador', 'actual');

      const result = await restoreBackup(
        restoreOptions(test, backup, {
          operations: failingRenameOperations([2, 3]),
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: 'DB_RESTORE_ROLLBACK_FAILED',
        reason: 'rollback',
      });
      await expectPresent(`${test.paths.databaseFile}.rollback`);
      await expectMissing(test.paths.databaseFile);
      await expectMissing(`${test.paths.databaseFile}.restore.tmp`);
      await expectMissing(join(test.paths.dataDir, '.restore.lock'));
      await expectPresent(join(test.paths.dataDir, '.restore.pending'));
      expect(
        (await readdir(test.paths.preRestoreBackupsDir)).length,
      ).toBeGreaterThan(0);

      const startup = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      expect(startup).toMatchObject({
        status: 'safe-mode',
        code: 'DB_RESTORE_INTERRUPTED',
      });
      await expectMissing(test.paths.databaseFile);
      await expectPresent(`${test.paths.databaseFile}.rollback`);
    } finally {
      await test.cleanup();
    }
  });

  it('no deja restos temporales al terminar una restauración correcta', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await writeSetting(test, 'marcador', 'respaldo');
      const backup = await createDailyBackup(test);

      const result = await restoreBackup(restoreOptions(test, backup));

      expect(result.ok).toBe(true);
      expect((await stat(test.paths.databaseFile)).isFile()).toBe(true);

      const dataFiles = await readdir(test.paths.dataDir);
      expect(dataFiles.filter((name) => name.includes('restore'))).toEqual([]);
      expect(dataFiles.filter((name) => name.includes('rollback'))).toEqual([]);
    } finally {
      await test.cleanup();
    }
  });
});
