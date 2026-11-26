import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PRE_DELETE_RECOVERY_FILE,
  deleteAll,
  parsePreDeleteRecovery,
} from '@/main/data/delete-all';
import {
  ASSETS_COPY_MANIFEST_FILE,
  verifyAssetsCopy,
} from '@/main/data/verified-copy';
import { tryReadBackupManifest } from '@/main/backup/manifest';
import { closeDatabase } from '@/main/db/connection';
import { resolveDataPaths, type DataPaths } from '@/main/db/paths';
import { initializeDatabase } from '@/main/db/startup';
import {
  createTransferFixture,
  FIXTURE_WORLD_ID,
  type TransferFixture,
} from '../helpers/transfer-fixture';
import {
  createTestDatabase,
  REPOSITORY_MIGRATIONS_DIR,
} from '../helpers/temp-db';

const DELETE_TIME = 1_900_000_000_000;

let fixture: TransferFixture;
let paths: DataPaths;
let destinationSentinel: string;
let unknownEntry: string;
let updaterId: string;

beforeEach(async () => {
  fixture = await createTransferFixture();
  paths = resolveDataPaths(fixture.userDataDir);
  destinationSentinel = join(fixture.rootDir, 'instalacion-sentinel.bin');
  unknownEntry = join(fixture.userDataDir, 'entrada-desconocida.bin');
  updaterId = join(fixture.userDataDir, '.updaterId');

  await writeFile(destinationSentinel, 'instalacion', 'utf8');
  await writeFile(unknownEntry, 'no tocar', 'utf8');
  await writeFile(updaterId, 'actualizador', 'utf8');
  await mkdir(join(paths.importsTempDir), { recursive: true });
  await mkdir(join(paths.exportsTempDir), { recursive: true });
  await mkdir(join(paths.assetsTempDir), { recursive: true });
  await writeFile(join(paths.importsTempDir, 'import.tmp'), 'i', 'utf8');
  await writeFile(join(paths.exportsTempDir, 'export.tmp'), 'e', 'utf8');
  await writeFile(join(paths.assetsTempDir, 'asset.tmp'), 'a', 'utf8');
  await mkdir(join(paths.backupsDir, 'daily', 'vieja'), { recursive: true });
  await writeFile(join(paths.backupsDir, 'daily', 'vieja', 'dato'), 'copia');
  await writeFile(join(paths.logsDir, 'startup.log'), 'log', 'utf8');
});

afterEach(async () => {
  fixture.close();
  await fixture.cleanup();
});

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    paths,
    database: fixture.sqlite,
    schemaVersion: fixture.schemaVersion,
    confirmation: 'delete-all-data',
    keepBackups: false,
    isTransferBusy: () => false,
    closePersistence: () => fixture.close(),
    now: () => DELETE_TIME,
    ...overrides,
  };
}

async function expectMissing(target: string): Promise<void> {
  await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
}

async function findPreDelete(): Promise<string> {
  const entries = await readdir(paths.preDeleteBackupsDir);

  expect(entries).toHaveLength(1);

  return join(paths.preDeleteBackupsDir, entries[0] as string);
}

describe('borrado total de datos', () => {
  it('crea la copia pre-delete y borra todo conservando la recuperación', async () => {
    const closePersistence = vi.fn(() => fixture.close());
    const result = await deleteAll(baseOptions({ closePersistence }));

    expect(result).toMatchObject({
      status: 'deleted',
      restartRequired: true,
    });
    expect(result.counts.databaseFiles).toBeGreaterThan(0);
    expect(result.counts.assetFiles).toBeGreaterThan(0);
    expect(closePersistence).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain(fixture.userDataDir);

    await expectMissing(paths.dataDir);
    await expectMissing(paths.assetsDir);
    await expectMissing(paths.logsDir);
    await expectMissing(paths.importsTempDir);
    await expectMissing(paths.exportsTempDir);
    await expectMissing(paths.assetsTempDir);
    await expectMissing(join(paths.backupsDir, 'daily'));

    const backupDirectory = await findPreDelete();
    const manifest = await tryReadBackupManifest(backupDirectory);

    expect(manifest).toMatchObject({
      reason: 'pre-delete',
      formatVersion: 2,
      integrity: 'ok',
      assetsIncluded: false,
    });
    await expect(
      verifyAssetsCopy({
        assetsDir: join(backupDirectory, 'assets'),
        manifestFile: join(backupDirectory, ASSETS_COPY_MANIFEST_FILE),
      }),
    ).resolves.toMatchObject({ count: expect.any(Number) });
    expect(
      parsePreDeleteRecovery(
        JSON.parse(
          await readFile(
            join(backupDirectory, PRE_DELETE_RECOVERY_FILE),
            'utf8',
          ),
        ) as unknown,
      ),
    ).toMatchObject({
      format: 'world-craft-pre-delete',
      formatVersion: 1,
      schemaVersion: fixture.schemaVersion,
    });

    await expect(access(updaterId)).resolves.toBeUndefined();
    await expect(access(unknownEntry)).resolves.toBeUndefined();
    await expect(access(destinationSentinel)).resolves.toBeUndefined();

    // Una base nueva arranca vacía sobre el mismo userData.
    const reopened = await initializeDatabase({
      userDataDir: fixture.userDataDir,
      migrationsDir: REPOSITORY_MIGRATIONS_DIR,
    });

    if (reopened.status !== 'ready') {
      throw new Error(`La base nueva no arrancó: ${reopened.code}`);
    }

    try {
      const worlds = reopened.client.sqlite
        .prepare('select count(*) as total from worlds')
        .get() as { readonly total: number };

      expect(worlds.total).toBe(0);
    } finally {
      closeDatabase(reopened.client.sqlite);
    }
  });

  it('permite recuperar manualmente la base y los assets en otro userData', async () => {
    const deleted = await deleteAll(baseOptions());

    expect(deleted.status).toBe('deleted');

    const backupDirectory = await findPreDelete();
    const recovered = await createTestDatabase();
    const recoveredPaths = resolveDataPaths(recovered.userDataDir);

    try {
      await mkdir(recoveredPaths.dataDir, { recursive: true });
      await cp(
        join(backupDirectory, 'world-craft.sqlite'),
        recoveredPaths.databaseFile,
      );
      await cp(join(backupDirectory, 'assets'), recoveredPaths.assetsDir, {
        recursive: true,
      });

      const startup = await initializeDatabase({
        userDataDir: recovered.userDataDir,
        migrationsDir: REPOSITORY_MIGRATIONS_DIR,
      });

      if (startup.status !== 'ready') {
        throw new Error(`La recuperación no arrancó: ${startup.code}`);
      }

      try {
        const worlds = startup.client.sqlite
          .prepare('select count(*) as total from worlds where id = ?')
          .get(FIXTURE_WORLD_ID) as { readonly total: number };
        const entities = startup.client.sqlite
          .prepare('select count(*) as total from entities')
          .get() as { readonly total: number };

        expect(worlds.total).toBe(1);
        expect(entities.total).toBeGreaterThan(0);
        await expect(
          access(recoveredPaths.assetsWorldsDir),
        ).resolves.toBeUndefined();
      } finally {
        closeDatabase(startup.client.sqlite);
      }
    } finally {
      await recovered.cleanup();
    }
  });

  it('conserva todas las copias con keepBackups=true', async () => {
    const result = await deleteAll(baseOptions({ keepBackups: true }));

    expect(result).toMatchObject({ status: 'deleted' });
    expect(
      (await stat(join(paths.backupsDir, 'daily', 'vieja'))).isDirectory(),
    ).toBe(true);
    expect(await readdir(paths.preDeleteBackupsDir)).toHaveLength(1);
  });

  it('no borra nada si la copia de assets falla', async () => {
    const closePersistence = vi.fn(() => fixture.close());
    const result = await deleteAll(
      baseOptions({
        closePersistence,
        copyAssets: async () => {
          throw new Error('fallo de copia');
        },
      }),
    );

    expect(result).toMatchObject({
      status: 'failed',
      code: 'DATA_DELETE_COPY_FAILED',
      restartRequired: false,
    });
    expect(closePersistence).not.toHaveBeenCalled();
    await expect(access(paths.databaseFile)).resolves.toBeUndefined();
    await expect(access(paths.assetsDir)).resolves.toBeUndefined();
    await expect(readdir(paths.preDeleteBackupsDir)).resolves.toEqual([]);
  });

  it('devuelve parcial y conserva la copia si falla una categoría no crítica', async () => {
    const defaultRemove = (target: string) =>
      rm(target, { recursive: true, force: true, maxRetries: 5 });

    const result = await deleteAll(
      baseOptions({
        removePath: (target: string) =>
          target === paths.logsDir
            ? Promise.reject(new Error('bloqueado'))
            : defaultRemove(target),
      }),
    );

    expect(result).toMatchObject({
      status: 'partial',
      restartRequired: true,
    });
    expect(result.status === 'partial' ? result.remaining : []).toContain(
      'logs',
    );
    await expect(access(paths.logsDir)).resolves.toBeUndefined();
    await expect(access(paths.dataDir)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readdir(paths.preDeleteBackupsDir)).resolves.toHaveLength(1);
  });

  it('exige reinicio aunque falle una categoría crítica y reabre la base existente', async () => {
    const defaultRemove = (target: string) =>
      rm(target, { recursive: true, force: true, maxRetries: 5 });
    const result = await deleteAll(
      baseOptions({
        removePath: (target: string) =>
          target === paths.dataDir
            ? Promise.reject(new Error('bloqueado'))
            : defaultRemove(target),
      }),
    );

    expect(result).toMatchObject({
      status: 'partial',
      restartRequired: true,
    });
    expect(result.status === 'partial' ? result.remaining : []).toContain(
      'database',
    );
    await expect(access(paths.databaseFile)).resolves.toBeUndefined();
    await expect(readdir(paths.preDeleteBackupsDir)).resolves.toHaveLength(1);

    // La persistencia ya estaba cerrada: al reiniciar se reabre la base que
    // quedó en disco, sin perder el mundo de la fixture.
    const reopened = await initializeDatabase({
      userDataDir: fixture.userDataDir,
      migrationsDir: REPOSITORY_MIGRATIONS_DIR,
    });

    if (reopened.status !== 'ready') {
      throw new Error(`La base existente no se reabrió: ${reopened.code}`);
    }

    try {
      const worlds = reopened.client.sqlite
        .prepare('select count(*) as total from worlds where id = ?')
        .get(FIXTURE_WORLD_ID) as { readonly total: number };

      expect(worlds.total).toBe(1);
    } finally {
      closeDatabase(reopened.client.sqlite);
    }
  });

  it('rechaza un temporal enlazado sin seguirlo', async (context) => {
    const outside = join(fixture.rootDir, 'temporales-externos');
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'fuera.tmp'), 'fuera');
    await rm(paths.importsTempDir, { recursive: true, force: true });

    try {
      await symlink(
        outside,
        paths.importsTempDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
    }

    await expect(deleteAll(baseOptions())).rejects.toMatchObject({
      code: 'DATA_DELETE_ROOT_INVALID',
    });
    await expect(access(join(outside, 'fuera.tmp'))).resolves.toBeUndefined();
    await expect(access(paths.databaseFile)).resolves.toBeUndefined();
  });

  it('rechaza una copia previa enlazada sin seguirla', async (context) => {
    const outside = join(fixture.rootDir, 'copias-externas');
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'fuera.bin'), 'fuera');
    await rm(paths.preDeleteBackupsDir, { recursive: true, force: true });

    try {
      await symlink(
        outside,
        paths.preDeleteBackupsDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
    }

    await expect(deleteAll(baseOptions())).rejects.toMatchObject({
      code: 'DATA_DELETE_ROOT_INVALID',
    });
    await expect(access(paths.databaseFile)).resolves.toBeUndefined();
  });

  it('rechaza una raíz enlazada sin seguir el destino', async (context) => {
    const outside = join(fixture.rootDir, 'assets-externos');
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'fuera.webp'), 'fuera');
    await rm(paths.assetsDir, { recursive: true, force: true });

    try {
      await symlink(
        outside,
        paths.assetsDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
    }

    await expect(deleteAll(baseOptions())).rejects.toMatchObject({
      code: 'DATA_DELETE_ROOT_INVALID',
    });
    await expect(access(join(outside, 'fuera.webp'))).resolves.toBeUndefined();
    await expect(access(paths.databaseFile)).resolves.toBeUndefined();
  });

  it('rechaza token incorrecto y transferencia activa', async () => {
    await expect(
      deleteAll(baseOptions({ confirmation: 'ELIMINAR TODO' })),
    ).rejects.toMatchObject({ code: 'DATA_DELETE_CONFIRMATION_REQUIRED' });

    await expect(
      deleteAll(baseOptions({ isTransferBusy: () => true })),
    ).rejects.toMatchObject({ code: 'DATA_BUSY' });

    await expect(access(paths.databaseFile)).resolves.toBeUndefined();
    await expect(readdir(paths.preDeleteBackupsDir)).resolves.toEqual([]);
  });

  it('es idempotente al repetir sobre una base nueva vacía', async () => {
    const first = await deleteAll(baseOptions());

    expect(first.status).toBe('deleted');

    const reopened = await initializeDatabase({
      userDataDir: fixture.userDataDir,
      migrationsDir: REPOSITORY_MIGRATIONS_DIR,
    });

    if (reopened.status !== 'ready') {
      throw new Error(`La base nueva no arrancó: ${reopened.code}`);
    }

    try {
      const second = await deleteAll({
        ...baseOptions(),
        database: reopened.client.sqlite,
        closePersistence: () => closeDatabase(reopened.client.sqlite),
        now: () => DELETE_TIME + 1_000,
      });

      expect(second.status).toBe('deleted');
      const backups = await readdir(paths.preDeleteBackupsDir);

      expect(backups).toHaveLength(1);
    } finally {
      closeDatabase(reopened.client.sqlite);
    }
  });
});
