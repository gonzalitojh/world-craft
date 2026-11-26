import { describe, expect, it } from 'vitest';

import { createPreDeleteBackup } from '@/main/backup/create';
import {
  findLatestRestorableBackup,
  inspectRestorableBackup,
} from '@/main/backup/restore';
import { inspectBackup } from '@/main/backup/verify';
import { closeDatabase, readUserVersion } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';

import { createTestDatabase } from './helpers/temp-db';

const BASE_TIME = 1_760_000_000_000;

describe('copia previa al borrado total', () => {
  it('crea una copia pre-delete v2 verificable', async () => {
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
      const result = await createPreDeleteBackup({
        database: sqlite,
        backupRootDir: test.paths.preDeleteBackupsDir,
        timestamp: BASE_TIME,
        schemaVersion,
      });
      const verification = await inspectBackup(result.directory, {
        expectedSchemaVersion: schemaVersion,
      });

      expect(verification.ok).toBe(true);
      expect(verification.ok ? verification.manifest.reason : null).toBe(
        'pre-delete',
      );
      expect(
        verification.ok ? verification.manifest.formatVersion : null,
      ).toBe(2);
      expect(
        verification.ok ? verification.manifest.assetsIncluded : null,
      ).toBe(false);
    } finally {
      closeDatabase(sqlite);
      await test.cleanup();
    }
  });

  it('no se ofrece para la restauración automática ni manual', async () => {
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
      const result = await createPreDeleteBackup({
        database: sqlite,
        backupRootDir: test.paths.preDeleteBackupsDir,
        timestamp: BASE_TIME,
        schemaVersion,
      });

      await expect(
        findLatestRestorableBackup({
          directories: [test.paths.preDeleteBackupsDir],
          targetSchemaVersion: schemaVersion,
        }),
      ).resolves.toBeNull();

      await expect(
        inspectRestorableBackup({
          directory: result.directory,
          targetSchemaVersion: schemaVersion,
        }),
      ).resolves.toEqual({ ok: false, reason: 'manifest' });
    } finally {
      closeDatabase(sqlite);
      await test.cleanup();
    }
  });
});
