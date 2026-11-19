import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createBackup, createPreservationCopy } from '@/main/backup/create';
import { rotateBackups } from '@/main/backup/rotation';
import {
  runScheduledBackups,
  type ScheduledBackupDirectories,
} from '@/main/backup/scheduler';
import { closeDatabase, openDatabase } from '@/main/db/connection';
import type { StartupLogEntry } from '@/main/db/logger';
import { readTargetSchemaVersion } from '@/main/db/migrations';
import { initializeDatabase } from '@/main/db/startup';

import {
  createTestDatabase,
  REPOSITORY_MIGRATIONS_DIR,
} from './helpers/temp-db';

type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;

const SCHEMA_VERSION = readTargetSchemaVersion(REPOSITORY_MIGRATIONS_DIR);

function backupDirectories(test: TestDatabase): ScheduledBackupDirectories {
  return {
    daily: test.paths.dailyBackupsDir,
    weekly: test.paths.weeklyBackupsDir,
    monthly: test.paths.monthlyBackupsDir,
    preMigration: test.paths.preMigrationBackupsDir,
  };
}

function localTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 10,
): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

async function createReadyDatabase(test: TestDatabase): Promise<void> {
  const result = await initializeDatabase({
    userDataDir: test.userDataDir,
    migrationsDir: test.migrationsDir,
  });

  if (result.status !== 'ready') {
    throw new Error(`Se esperaba ready y llegó ${result.code}.`);
  }

  closeDatabase(result.client.sqlite);
}

async function createDailyBackupAt(test: TestDatabase, timestamp: number) {
  const database = openDatabase({ file: test.paths.databaseFile });

  try {
    return await createBackup({
      database,
      parentDir: test.paths.dailyBackupsDir,
      reason: 'daily',
      timestamp,
      schemaVersion: SCHEMA_VERSION,
    });
  } finally {
    closeDatabase(database);
  }
}

async function runScheduler(
  test: TestDatabase,
  timestamp: number,
  options?: { readonly forceRotation?: boolean },
): Promise<{
  created: readonly string[];
  failed: readonly string[];
  rotation: { readonly removed: number };
  entries: StartupLogEntry[];
}> {
  const database = openDatabase({ file: test.paths.databaseFile });
  const entries: StartupLogEntry[] = [];

  try {
    const result = await runScheduledBackups({
      database,
      directories: backupDirectories(test),
      timestamp,
      targetSchemaVersion: SCHEMA_VERSION,
      ...(options?.forceRotation === true ? { forceRotation: true } : {}),
      logger: { log: (entry) => entries.push(entry) },
    });

    return {
      created: result.created,
      failed: result.failed,
      rotation: result.rotation,
      entries,
    };
  } finally {
    closeDatabase(database);
  }
}

describe('programación y rotación de copias', () => {
  it('crea una copia de cada bucket en el primer arranque y no duplica', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const first = await runScheduler(test, localTimestamp(2026, 11, 19));

      expect([...first.created].sort()).toEqual(['daily', 'monthly', 'weekly']);
      expect(first.failed).toEqual([]);
      expect(await readdir(test.paths.dailyBackupsDir)).toHaveLength(1);
      expect(await readdir(test.paths.weeklyBackupsDir)).toHaveLength(1);
      expect(await readdir(test.paths.monthlyBackupsDir)).toHaveLength(1);

      const second = await runScheduler(test, localTimestamp(2026, 11, 19));

      expect(second.created).toEqual([]);
      expect(second.entries).toContainEqual({
        event: 'backup.schedule',
        outcome: 'skipped',
      });
      expect(await readdir(test.paths.dailyBackupsDir)).toHaveLength(1);
    } finally {
      await test.cleanup();
    }
  });

  it('crea solo el bucket diario cuando cambia el día', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await runScheduler(test, localTimestamp(2026, 11, 19));

      const nextDay = await runScheduler(test, localTimestamp(2026, 11, 20));

      expect(nextDay.created).toEqual(['daily']);
      expect(await readdir(test.paths.dailyBackupsDir)).toHaveLength(2);
    } finally {
      await test.cleanup();
    }
  });

  it('crea el bucket semanal cuando cambia la semana ISO', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await runScheduler(test, localTimestamp(2026, 11, 19));

      const nextWeek = await runScheduler(test, localTimestamp(2026, 11, 23));

      expect([...nextWeek.created].sort()).toEqual(['daily', 'weekly']);
      expect(await readdir(test.paths.weeklyBackupsDir)).toHaveLength(2);
      expect(await readdir(test.paths.monthlyBackupsDir)).toHaveLength(1);
    } finally {
      await test.cleanup();
    }
  });

  it('rota las diarias a 7 sin tocar las corruptas', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        for (let index = 0; index < 8; index += 1) {
          await createBackup({
            database,
            parentDir: test.paths.dailyBackupsDir,
            reason: 'daily',
            timestamp: localTimestamp(2026, 11, 1 + index),
            schemaVersion: SCHEMA_VERSION,
          });
        }
      } finally {
        closeDatabase(database);
      }

      const corruptDirectory = join(test.paths.dailyBackupsDir, 'corrupta');

      await mkdir(corruptDirectory, { recursive: true });
      await writeFile(
        join(corruptDirectory, 'manifest.json'),
        'no-json',
        'utf8',
      );

      const result = await rotateBackups({
        directories: backupDirectories(test),
        retention: { daily: 7, weekly: 4, monthly: 12, preMigration: 5 },
        targetSchemaVersion: SCHEMA_VERSION,
      });

      expect(result).toMatchObject({
        removed: 1,
        corrupt: 1,
        skipped: 0,
        failed: 0,
      });
      expect(await readdir(test.paths.dailyBackupsDir)).toHaveLength(8);
      expect(await readdir(test.paths.dailyBackupsDir)).toContain('corrupta');
    } finally {
      await test.cleanup();
    }
  });

  it('nunca poda la única copia válida de un bucket aunque la retención sea 0', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        await createBackup({
          database,
          parentDir: test.paths.dailyBackupsDir,
          reason: 'daily',
          timestamp: localTimestamp(2026, 11, 19),
          schemaVersion: SCHEMA_VERSION,
        });
      } finally {
        closeDatabase(database);
      }

      const result = await rotateBackups({
        directories: backupDirectories(test),
        retention: { daily: 0, weekly: 4, monthly: 12, preMigration: 5 },
        targetSchemaVersion: SCHEMA_VERSION,
      });

      expect(result.removed).toBe(0);
      expect(await readdir(test.paths.dailyBackupsDir)).toHaveLength(1);
    } finally {
      await test.cleanup();
    }
  });

  it('rota las copias pre-migración a 5 sin tocar las de otros motivos', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        for (let index = 0; index < 6; index += 1) {
          await createBackup({
            database,
            parentDir: test.paths.preMigrationBackupsDir,
            reason: 'pre-migration',
            timestamp: localTimestamp(2026, 11, 1 + index),
            schemaVersion: SCHEMA_VERSION,
          });
        }
      } finally {
        closeDatabase(database);
      }

      const result = await rotateBackups({
        directories: backupDirectories(test),
        targetSchemaVersion: SCHEMA_VERSION,
      });

      expect(result.removed).toBe(1);
      expect(await readdir(test.paths.preMigrationBackupsDir)).toHaveLength(5);
    } finally {
      await test.cleanup();
    }
  });

  it('no bloquea el arranque si la carpeta diaria es un archivo', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      // La carpeta diaria se sustituye por un archivo: el arranque debe seguir
      // en ready y el programador fallar solo ese bucket.
      await rm(test.paths.dailyBackupsDir, { recursive: true, force: true });
      await writeFile(test.paths.dailyBackupsDir, 'bloqueado', 'utf8');

      const startup = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: test.migrationsDir,
      });

      expect(startup.status).toBe('ready');

      if (startup.status !== 'ready') {
        throw new Error('Se esperaba ready con la carpeta diaria bloqueada.');
      }

      closeDatabase(startup.client.sqlite);

      const run = await runScheduler(test, localTimestamp(2026, 11, 19));

      expect(run.failed).toEqual(['daily']);
      expect([...run.created].sort()).toEqual(['monthly', 'weekly']);
      expect(run.entries).toContainEqual({
        event: 'backup.schedule',
        outcome: 'failed',
        reason: 'io',
        created: 2,
        failed: 1,
        pruned: 0,
      });
      expect(await readdir(test.paths.weeklyBackupsDir)).toHaveLength(1);
    } finally {
      await test.cleanup();
    }
  });

  it('no repite la rotación si no creó ninguna copia', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await runScheduler(test, localTimestamp(2026, 11, 19));

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        // Ocho diarias en el mismo bucket: si rotara, quedarían siete.
        for (let index = 0; index < 7; index += 1) {
          await createBackup({
            database,
            parentDir: test.paths.dailyBackupsDir,
            reason: 'daily',
            timestamp: localTimestamp(2026, 11, 19, 11 + index),
            schemaVersion: SCHEMA_VERSION,
          });
        }
      } finally {
        closeDatabase(database);
      }

      const run = await runScheduler(test, localTimestamp(2026, 11, 19));

      expect(run.created).toEqual([]);
      expect(run.entries).toContainEqual({
        event: 'backup.schedule',
        outcome: 'skipped',
      });
      expect(await readdir(test.paths.dailyBackupsDir)).toHaveLength(8);
    } finally {
      await test.cleanup();
    }
  });

  it('rota las pre-migración cuando el arranque creó una copia aunque no haya buckets nuevos', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await runScheduler(test, localTimestamp(2026, 11, 19));

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        for (let index = 0; index < 6; index += 1) {
          await createBackup({
            database,
            parentDir: test.paths.preMigrationBackupsDir,
            reason: 'pre-migration',
            timestamp: localTimestamp(2026, 11, 1 + index),
            schemaVersion: SCHEMA_VERSION,
          });
        }
      } finally {
        closeDatabase(database);
      }

      const run = await runScheduler(test, localTimestamp(2026, 11, 19), {
        forceRotation: true,
      });

      expect(run.created).toEqual([]);
      expect(run.rotation.removed).toBe(1);
      expect(await readdir(test.paths.preMigrationBackupsDir)).toHaveLength(5);
    } finally {
      await test.cleanup();
    }
  });

  it('no considera lleno el bucket si su única copia está corrupta', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await runScheduler(test, localTimestamp(2026, 11, 19));

      const [dailyDirectory] = await readdir(test.paths.dailyBackupsDir);

      if (dailyDirectory === undefined) {
        throw new Error('No se creó la copia diaria.');
      }

      await appendFile(
        join(test.paths.dailyBackupsDir, dailyDirectory, 'world-craft.sqlite'),
        'corrupto',
        'utf8',
      );

      const run = await runScheduler(test, localTimestamp(2026, 11, 19));

      expect(run.created).toEqual(['daily']);
      expect(await readdir(test.paths.dailyBackupsDir)).toHaveLength(2);
    } finally {
      await test.cleanup();
    }
  });

  it('no poda una copia de versión futura como si fuera válida', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const database = openDatabase({ file: test.paths.databaseFile });

      try {
        for (let index = 0; index < 8; index += 1) {
          await createBackup({
            database,
            parentDir: test.paths.dailyBackupsDir,
            reason: 'daily',
            timestamp: localTimestamp(2026, 11, 1 + index),
            schemaVersion: SCHEMA_VERSION,
          });
        }
      } finally {
        closeDatabase(database);
      }

      const future = await createDailyBackupAt(
        test,
        localTimestamp(2026, 11, 9),
      );

      const manifestFile = join(future.directory, 'manifest.json');
      const manifest = JSON.parse(
        await readFile(manifestFile, 'utf8'),
      ) as Record<string, unknown>;

      await writeFile(
        manifestFile,
        `${JSON.stringify({ ...manifest, schemaVersion: 99 })}\n`,
        'utf8',
      );

      const result = await rotateBackups({
        directories: backupDirectories(test),
        targetSchemaVersion: SCHEMA_VERSION,
      });

      expect(result).toMatchObject({
        removed: 1,
        corrupt: 1,
        skipped: 0,
        failed: 0,
      });

      const entries = await readdir(test.paths.dailyBackupsDir);

      expect(entries).toHaveLength(8);
      expect(entries).toContain(basename(future.directory));
    } finally {
      await test.cleanup();
    }
  });

  it('no considera una copia futura como copia del bucket', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);
      await runScheduler(test, localTimestamp(2026, 11, 19));

      const [dailyDirectory] = await readdir(test.paths.dailyBackupsDir);

      if (dailyDirectory === undefined) {
        throw new Error('No se creó la copia diaria.');
      }

      const manifestFile = join(
        test.paths.dailyBackupsDir,
        dailyDirectory,
        'manifest.json',
      );
      const manifest = JSON.parse(
        await readFile(manifestFile, 'utf8'),
      ) as Record<string, unknown>;

      await writeFile(
        manifestFile,
        `${JSON.stringify({ ...manifest, schemaVersion: 99 })}\n`,
        'utf8',
      );

      const run = await runScheduler(test, localTimestamp(2026, 11, 19));

      expect(run.created).toEqual(['daily']);
      expect(await readdir(test.paths.dailyBackupsDir)).toHaveLength(2);
    } finally {
      await test.cleanup();
    }
  });

  it('no poda las copias pre-restauración', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      for (let index = 0; index < 6; index += 1) {
        await createPreservationCopy({
          databaseFile: test.paths.databaseFile,
          parentDir: test.paths.preRestoreBackupsDir,
          timestamp: localTimestamp(2026, 11, 1 + index),
          schemaVersion: SCHEMA_VERSION,
          integrity: 'ok',
        });
      }

      const result = await rotateBackups({
        directories: backupDirectories(test),
        targetSchemaVersion: SCHEMA_VERSION,
      });

      expect(result.removed).toBe(0);
      expect(await readdir(test.paths.preRestoreBackupsDir)).toHaveLength(6);
    } finally {
      await test.cleanup();
    }
  });
});
