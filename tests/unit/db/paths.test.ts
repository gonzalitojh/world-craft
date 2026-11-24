import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { DatabaseError } from '@/main/db/errors';
import {
  DATABASE_FILE_NAME,
  ensureDataDirectories,
  isNewDatabase,
  resolveDataPaths,
} from '@/main/db/paths';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-paths-'));
  temporaryDirectories.push(directory);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('rutas de datos', () => {
  it('cuelga todos los datos de userData con nombres fijos', () => {
    const userDataDir = join(tmpdir(), 'datos', 'usuario');
    const paths = resolveDataPaths(userDataDir);

    expect(paths.userDataDir).toBe(resolve(userDataDir));
    expect(paths.dataDir).toBe(join(resolve(userDataDir), 'data'));
    expect(paths.databaseFile).toBe(
      join(resolve(userDataDir), 'data', DATABASE_FILE_NAME),
    );
    expect(paths.startupLogFile).toBe(
      join(resolve(userDataDir), 'logs', 'startup.log'),
    );
    expect(paths.preMigrationBackupsDir).toBe(
      join(resolve(userDataDir), 'backups', 'pre-migration'),
    );
    expect(paths.dailyBackupsDir).toBe(
      join(resolve(userDataDir), 'backups', 'daily'),
    );
    expect(paths.weeklyBackupsDir).toBe(
      join(resolve(userDataDir), 'backups', 'weekly'),
    );
    expect(paths.monthlyBackupsDir).toBe(
      join(resolve(userDataDir), 'backups', 'monthly'),
    );
    expect(paths.preRestoreBackupsDir).toBe(
      join(resolve(userDataDir), 'backups', 'pre-restore'),
    );
    expect(paths.prePurgeBackupsDir).toBe(
      join(resolve(userDataDir), 'backups', 'pre-purge'),
    );
  });

  it('deriva las rutas de assets y del log de assets dentro de userData', () => {
    const userDataDir = join(tmpdir(), 'datos', 'assets');
    const paths = resolveDataPaths(userDataDir);
    const root = resolve(userDataDir);

    expect(paths.assetsDir).toBe(join(root, 'assets'));
    expect(paths.assetsWorldsDir).toBe(join(root, 'assets', 'worlds'));
    expect(paths.assetsTempDir).toBe(join(root, 'assets', '.tmp'));
    expect(paths.orphanBackupsDir).toBe(join(root, 'backups', 'orphans'));
    expect(paths.assetsLogFile).toBe(join(root, 'logs', 'assets.log'));
  });

  it('rechaza una carpeta userData vacía, con NUL o relativa', () => {
    expect(() => resolveDataPaths('')).toThrow(DatabaseError);
    expect(() => resolveDataPaths('   ')).toThrow(DatabaseError);
    expect(() =>
      resolveDataPaths(`datos${String.fromCharCode(0)}ocultos`),
    ).toThrow(DatabaseError);

    const relativePath = join('datos', 'usuario');
    let caught: unknown;

    try {
      resolveDataPaths(relativePath);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DatabaseError);
    expect((caught as Error).message).not.toContain(relativePath);
  });

  it('normaliza la raíz y mantiene todas las rutas dentro de userData', () => {
    const root = join(tmpdir(), 'world-craft-contained');
    const paths = resolveDataPaths(root);
    const normalizedRoot = resolve(root);

    expect(paths.userDataDir).toBe(normalizedRoot);

    for (const candidate of [
      paths.dataDir,
      paths.logsDir,
      paths.backupsDir,
      paths.dailyBackupsDir,
      paths.weeklyBackupsDir,
      paths.monthlyBackupsDir,
      paths.preMigrationBackupsDir,
      paths.preRestoreBackupsDir,
      paths.databaseFile,
      paths.startupLogFile,
      paths.assetsDir,
      paths.assetsWorldsDir,
      paths.assetsTempDir,
      paths.assetsLogFile,
      paths.orphanBackupsDir,
    ]) {
      const relation = relative(normalizedRoot, candidate);

      expect(relation.length).toBeGreaterThan(0);
      expect(relation.startsWith('..')).toBe(false);
      expect(isAbsolute(relation)).toBe(false);
    }
  });

  it('crea las carpetas necesarias y detecta una base nueva', async () => {
    const directory = await createTemporaryDirectory();
    const paths = resolveDataPaths(directory);

    ensureDataDirectories(paths);

    for (const expected of [
      paths.dataDir,
      paths.logsDir,
      paths.dailyBackupsDir,
      paths.weeklyBackupsDir,
      paths.monthlyBackupsDir,
      paths.preMigrationBackupsDir,
      paths.preRestoreBackupsDir,
      paths.assetsDir,
      paths.assetsWorldsDir,
      paths.assetsTempDir,
      paths.orphanBackupsDir,
    ]) {
      expect((await stat(expected)).isDirectory()).toBe(true);
    }

    expect(isNewDatabase(paths.databaseFile)).toBe(true);

    await writeFile(paths.databaseFile, '', 'utf8');
    expect(isNewDatabase(paths.databaseFile)).toBe(true);

    await writeFile(paths.databaseFile, 'contenido', 'utf8');
    expect(isNewDatabase(paths.databaseFile)).toBe(false);
  });

  it('no bloquea el arranque si una carpeta de copias no se puede crear', async () => {
    const directory = await createTemporaryDirectory();
    const paths = resolveDataPaths(directory);

    await mkdir(paths.backupsDir, { recursive: true });
    await writeFile(paths.dailyBackupsDir, 'bloqueado', 'utf8');

    expect(() => ensureDataDirectories(paths)).not.toThrow();

    for (const expected of [
      paths.dataDir,
      paths.logsDir,
      paths.assetsDir,
      paths.assetsWorldsDir,
      paths.assetsTempDir,
    ]) {
      expect((await stat(expected)).isDirectory()).toBe(true);
    }

    expect((await stat(paths.dailyBackupsDir)).isFile()).toBe(true);
  });

  it('sigue fallando si una carpeta esencial no se puede crear', async () => {
    const directory = await createTemporaryDirectory();
    const paths = resolveDataPaths(directory);

    await writeFile(paths.dataDir, 'no es una carpeta', 'utf8');

    expect(() => ensureDataDirectories(paths)).toThrow(DatabaseError);
  });
});
