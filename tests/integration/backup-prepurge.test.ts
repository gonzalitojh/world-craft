import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createPrePurgeBackup } from '@/main/backup/create';
import { rotateBackups } from '@/main/backup/rotation';
import { inspectBackup } from '@/main/backup/verify';
import { closeDatabase, readUserVersion } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';

import { createTestDatabase } from './helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;

describe('copia previa a la purga', () => {
  it('crea manifiestos pre-purge verificables y rota a diez sin borrar la más reciente', async () => {
    const test = await createTestDatabase();
    const startup = await initializeDatabase({
      userDataDir: test.userDataDir,
      migrationsDir: test.migrationsDir,
    });

    if (startup.status !== 'ready') {
      await test.cleanup();
      throw new Error(`La base de prueba no arrancó: ${startup.code}.`);
    }

    const sqlite = startup.client.sqlite;

    try {
      const schemaVersion = readUserVersion(sqlite);
      const created: string[] = [];

      for (let index = 0; index < 11; index += 1) {
        const result = await createPrePurgeBackup({
          database: sqlite,
          backupRootDir: test.paths.prePurgeBackupsDir,
          timestamp: BASE_TIME + index * 1_000,
          schemaVersion,
        });

        created.push(result.directory);
      }

      const verification = await inspectBackup(
        created[created.length - 1] as string,
        {
          expectedSchemaVersion: schemaVersion,
        },
      );

      expect(verification.ok).toBe(true);
      expect(verification.ok ? verification.manifest.reason : null).toBe(
        'pre-purge',
      );
      expect(verification.ok ? verification.manifest.formatVersion : null).toBe(
        2,
      );

      const rotation = await rotateBackups({
        directories: {
          daily: test.paths.dailyBackupsDir,
          weekly: test.paths.weeklyBackupsDir,
          monthly: test.paths.monthlyBackupsDir,
          preMigration: test.paths.preMigrationBackupsDir,
          prePurge: test.paths.prePurgeBackupsDir,
        },
        targetSchemaVersion: schemaVersion,
      });

      const remaining = await readdir(test.paths.prePurgeBackupsDir);

      expect(rotation.removed).toBe(1);
      expect(remaining).toHaveLength(10);
      expect(remaining).toContain(
        created[created.length - 1]?.split(/[\\/]/).pop(),
      );
      expect(remaining).not.toContain(created[0]?.split(/[\\/]/).pop());
    } finally {
      closeDatabase(sqlite);
      await test.cleanup();
    }
  });

  it('no deja una copia parcial si no puede escribir la carpeta', async () => {
    const test = await createTestDatabase();
    const startup = await initializeDatabase({
      userDataDir: test.userDataDir,
      migrationsDir: test.migrationsDir,
    });

    if (startup.status !== 'ready') {
      await test.cleanup();
      throw new Error(`La base de prueba no arrancó: ${startup.code}.`);
    }

    const sqlite = startup.client.sqlite;

    try {
      const blocked = join(test.rootDir, 'carpeta-bloqueada');
      const { writeFile } = await import('node:fs/promises');

      await writeFile(blocked, 'no es una carpeta', 'utf8');

      await expect(
        createPrePurgeBackup({
          database: sqlite,
          backupRootDir: blocked,
          timestamp: BASE_TIME,
          schemaVersion: readUserVersion(sqlite),
        }),
      ).rejects.toMatchObject({ code: 'DB_BACKUP_FAILED' });
    } finally {
      closeDatabase(sqlite);
      await test.cleanup();
    }
  });
});
