import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createBackup, createPreservationCopy } from '@/main/backup/create';
import { listBackups, selectValidBackups } from '@/main/backup/inventory';
import { verifyBackup } from '@/main/backup/verify';
import { closeDatabase, openDatabase } from '@/main/db/connection';
import { readTargetSchemaVersion } from '@/main/db/migrations';
import { initializeDatabase } from '@/main/db/startup';

import {
  createTestDatabase,
  REPOSITORY_MIGRATIONS_DIR,
} from './helpers/temp-db';

const SCHEMA_VERSION = readTargetSchemaVersion(REPOSITORY_MIGRATIONS_DIR);

async function createDatabaseCopy(
  test: Awaited<ReturnType<typeof createTestDatabase>>,
  timestamp: number,
) {
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

async function createReadyDatabase(
  test: Awaited<ReturnType<typeof createTestDatabase>>,
): Promise<void> {
  const result = await initializeDatabase({
    userDataDir: test.userDataDir,
    migrationsDir: test.migrationsDir,
  });

  if (result.status !== 'ready') {
    throw new Error(`Se esperaba ready y llegó ${result.code}.`);
  }

  closeDatabase(result.client.sqlite);
}

describe('creación e inventario de copias', () => {
  it('crea una copia v2 verificable con manifiesto completo', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const backup = await createDatabaseCopy(test, 1_763_636_400_000);

      expect(backup.manifest).toMatchObject({
        formatVersion: 2,
        reason: 'daily',
        schemaVersion: SCHEMA_VERSION,
        integrity: 'ok',
        assetsIncluded: false,
      });
      expect(backup.manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect((await stat(backup.databaseFile)).isFile()).toBe(true);

      await expect(verifyBackup(backup.directory)).resolves.toMatchObject({
        formatVersion: 2,
        reason: 'daily',
      });
    } finally {
      await test.cleanup();
    }
  });

  it('lee y verifica una copia pre-migración con manifiesto v1', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const backup = await createDatabaseCopy(test, 1_763_636_400_000);
      const manifestFile = join(backup.directory, 'manifest.json');

      await writeFile(
        manifestFile,
        `${JSON.stringify(
          {
            formatVersion: 1,
            reason: 'pre-migration',
            createdAt: backup.manifest.createdAt,
            databaseFile: backup.manifest.databaseFile,
            schemaVersion: backup.manifest.schemaVersion,
            sizeBytes: backup.manifest.sizeBytes,
            sha256: backup.manifest.sha256,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      await expect(verifyBackup(backup.directory)).resolves.toMatchObject({
        formatVersion: 1,
        reason: 'pre-migration',
        integrity: 'ok',
        assetsIncluded: false,
      });
    } finally {
      await test.cleanup();
    }
  });

  it('rechaza una copia con bytes alterados o manifiesto manipulado', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const alteredBytes = await createDatabaseCopy(test, 1_763_636_400_000);
      await appendFile(alteredBytes.databaseFile, 'alterado', 'utf8');

      await expect(verifyBackup(alteredBytes.directory)).rejects.toMatchObject({
        code: 'DB_BACKUP_FAILED',
      });

      const tamperedManifest = await createDatabaseCopy(
        test,
        1_763_636_500_000,
      );
      const manifestFile = join(tamperedManifest.directory, 'manifest.json');
      const manifest = JSON.parse(
        await readFile(manifestFile, 'utf8'),
      ) as Record<string, unknown>;

      await writeFile(
        manifestFile,
        `${JSON.stringify({ ...manifest, sha256: 'b'.repeat(64) })}\n`,
        'utf8',
      );

      await expect(
        verifyBackup(tamperedManifest.directory),
      ).rejects.toMatchObject({ code: 'DB_BACKUP_FAILED' });

      const invalidManifest = await createDatabaseCopy(test, 1_763_636_600_000);
      const invalidManifestFile = join(
        invalidManifest.directory,
        'manifest.json',
      );

      await writeFile(
        invalidManifestFile,
        `${JSON.stringify({ ...invalidManifest.manifest, integrity: 'failed' })}\n`,
        'utf8',
      );

      await expect(
        verifyBackup(invalidManifest.directory),
      ).rejects.toMatchObject({ code: 'DB_BACKUP_FAILED' });
    } finally {
      await test.cleanup();
    }
  });

  it('inventaría, ordena y separa copias válidas de corruptas', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      const oldest = await createDatabaseCopy(test, 1_763_636_400_000);
      const newest = await createDatabaseCopy(test, 1_763_636_500_000);

      await appendFile(newest.databaseFile, 'corrupto', 'utf8');
      await mkdir(join(test.paths.dailyBackupsDir, 'sin-manifiesto'));

      const entries = await listBackups(test.paths.dailyBackupsDir);

      expect(entries).toHaveLength(3);
      expect(entries.map((entry) => entry.directory)).toContain(
        oldest.directory,
      );
      expect(
        selectValidBackups(entries).map((entry) => entry.directory),
      ).toEqual([oldest.directory]);

      expect(await readdir(test.paths.dailyBackupsDir)).toContain(
        'sin-manifiesto',
      );
    } finally {
      await test.cleanup();
    }
  });

  it('copia en bruto la base corrupta y sus auxiliares WAL/SHM', async () => {
    const test = await createTestDatabase();

    try {
      await createReadyDatabase(test);

      await writeFile(test.paths.databaseFile, 'base corrupta', 'utf8');
      await writeFile(`${test.paths.databaseFile}-wal`, 'wal', 'utf8');
      await writeFile(`${test.paths.databaseFile}-shm`, 'shm', 'utf8');
      await writeFile(`${test.paths.databaseFile}-journal`, 'journal', 'utf8');

      const preservation = await createPreservationCopy({
        databaseFile: test.paths.databaseFile,
        parentDir: test.paths.preRestoreBackupsDir,
        timestamp: 1_763_636_400_000,
        schemaVersion: null,
        integrity: 'failed',
      });

      expect(preservation).not.toBeNull();

      if (preservation === null) {
        throw new Error('No se creó la copia de preservación.');
      }

      expect(preservation.manifest).toMatchObject({
        reason: 'pre-restore',
        schemaVersion: null,
        integrity: 'failed',
      });
      expect(await readFile(preservation.databaseFile, 'utf8')).toBe(
        'base corrupta',
      );
      expect(await readFile(`${preservation.databaseFile}-wal`, 'utf8')).toBe(
        'wal',
      );
      expect(await readFile(`${preservation.databaseFile}-shm`, 'utf8')).toBe(
        'shm',
      );
      expect(
        await readFile(`${preservation.databaseFile}-journal`, 'utf8'),
      ).toBe('journal');
    } finally {
      await test.cleanup();
    }
  });

  it('no crea copia de preservación si la base actual no existe', async () => {
    const test = await createTestDatabase();

    try {
      await expect(
        createPreservationCopy({
          databaseFile: test.paths.databaseFile,
          parentDir: test.paths.preRestoreBackupsDir,
          timestamp: 1_763_636_400_000,
          schemaVersion: null,
          integrity: 'unknown',
        }),
      ).resolves.toBeNull();
    } finally {
      await test.cleanup();
    }
  });
});
