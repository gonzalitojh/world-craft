import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { verifyBackup } from '@/main/backup/verify';
import { closeDatabase, openDatabase } from '@/main/db/connection';
import { ensureDataDirectories } from '@/main/db/paths';
import { initializeDatabase } from '@/main/db/startup';

import {
  cleanup,
  createMigrationFixture,
  createTestDatabase,
  INIT_MIGRATION_SQL,
  REPOSITORY_MIGRATIONS_DIR,
} from '../helpers/temp-db';

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

async function hashTree(root: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};

  for (const file of (await collectFiles(root)).sort()) {
    const relative = file.slice(root.length).replaceAll('\\', '/');
    hashes[relative] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  }

  return hashes;
}

describe('preservación de datos entre instalaciones', () => {
  it('actualizar, reinstalar y desinstalar no toca userData ni la copia previa', async () => {
    const test = await createTestDatabase();
    const fixtureMigrations = join(test.rootDir, 'migrations-0000');
    const installDir = join(test.rootDir, 'install-dir');

    try {
      await createMigrationFixture(fixtureMigrations, [
        { tag: '0000_init', sql: INIT_MIGRATION_SQL },
      ]);
      ensureDataDirectories(test.paths);

      // Instalación 0.1.0 con el esquema 0000 y datos de usuario.
      const first = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: fixtureMigrations,
      });

      expect(first.status).toBe('ready');

      if (first.status !== 'ready') {
        throw new Error('Se esperaba una base lista.');
      }

      first.client.sqlite
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
        )
        .run('theme', '"dark"', 1_760_000_000_000);
      closeDatabase(first.client.sqlite);

      // Actualización a una versión con el esquema real: crea copia previa.
      const migrated = await initializeDatabase({
        userDataDir: test.userDataDir,
        migrationsDir: REPOSITORY_MIGRATIONS_DIR,
      });

      expect(migrated.status).toBe('ready');

      if (migrated.status !== 'ready') {
        throw new Error('Se esperaba una base migrada.');
      }

      expect(migrated.appliedMigrations).toBe(8);
      expect(migrated.backup).not.toBeNull();

      const assetRelativePath =
        'worlds/01900000-0000-7000-8000-000000000002/01900000-0000-7000-8000-000000000001.webp';
      const assetFile = join(test.paths.assetsDir, assetRelativePath);

      await mkdir(join(assetFile, '..'), { recursive: true });
      await writeFile(assetFile, Buffer.from('imagen de prueba'), 'binary');

      migrated.client.sqlite
        .prepare(
          `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          '01900000-0000-7000-8000-000000000001',
          '01900000-0000-7000-8000-000000000002',
          'image',
          assetRelativePath,
          'image/webp',
          16,
          'a'.repeat(64),
          1_760_000_000_000,
        );
      closeDatabase(migrated.client.sqlite);

      if (migrated.backup === null) {
        throw new Error('No se creó la copia previa a la migración.');
      }

      const backupBefore = await verifyBackup(migrated.backup.directory);
      expect(backupBefore).toMatchObject({
        reason: 'pre-migration',
        schemaVersion: 1,
        integrity: 'ok',
      });

      const userDataBefore = await hashTree(test.userDataDir);

      // Instalación inicial: una carpeta de instalación separada de userData.
      await mkdir(join(installDir, 'resources'), { recursive: true });
      await writeFile(join(installDir, 'World Craft.exe'), 'binario');
      await writeFile(join(installDir, 'resources', 'app.asar'), 'asar');

      // Actualización/reinstalación: se sustituyen los binarios.
      await rm(installDir, { recursive: true, force: true });
      await mkdir(join(installDir, 'resources'), { recursive: true });
      await writeFile(join(installDir, 'World Craft.exe'), 'binario nuevo');
      await writeFile(join(installDir, 'resources', 'app.asar'), 'asar nuevo');

      expect(await hashTree(test.userDataDir)).toEqual(userDataBefore);

      // Desinstalación: se borra la carpeta de instalación.
      await rm(installDir, { recursive: true, force: true });

      expect(await hashTree(test.userDataDir)).toEqual(userDataBefore);

      // Los datos siguen legibles y la copia previa sigue siendo verificable.
      const database = openDatabase({
        file: test.paths.databaseFile,
        readonly: true,
      });

      try {
        expect(
          database
            .prepare('SELECT value FROM app_settings WHERE key = ?')
            .get('theme'),
        ).toEqual({ value: '"dark"' });
        expect(
          database
            .prepare('SELECT relative_path FROM assets WHERE id = ?')
            .get('01900000-0000-7000-8000-000000000001'),
        ).toEqual({ relative_path: assetRelativePath });
        expect(database.pragma('user_version', { simple: true })).toBe(9);
      } finally {
        closeDatabase(database);
      }

      expect(await readFile(assetFile, 'utf8')).toBe('imagen de prueba');
      expect(await verifyBackup(migrated.backup.directory)).toMatchObject({
        integrity: 'ok',
      });
    } finally {
      await cleanup(test.rootDir);
    }
  });
});
