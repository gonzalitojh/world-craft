import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultUiPreferences } from '@/shared/contracts/preferences';
import { entities } from '@/main/db/schema/entities';
import { exportWorld } from '@/main/transfer/export/service';
import { createImportService } from '@/main/transfer/import/service';
import {
  extractArchiveEntry,
  readArchiveEntry,
} from '@/main/transfer/archive/reader';
import { closeDatabase, openDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';
import type { WorldCraftDatabase } from '@/main/db/client';
import type { SqliteDatabase } from '@/main/db/connection';
import { createWorldsService } from '@/main/worlds/service';
import { inspectBackupFile } from '@/main/backup/verify';
import { parseLibraryManifestJson } from '@/main/data/library/manifest';
import { parseLibrarySettingsJson } from '@/main/data/library/settings';
import { readLibraryArchiveIndex } from '@/main/data/library/archive';
import { exportAll } from '@/main/data/library/service';
import { verifyLibraryArchive } from '@/main/data/library/verify';
import {
  createTransferFixture,
  FIXTURE_WORLD_ID,
  type TransferFixture,
} from '../helpers/transfer-fixture';
import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const EXPORT_TIME = 1_800_000_000_000;

let fixture: TransferFixture;
let destination: string;

beforeEach(async () => {
  fixture = await createTransferFixture();
  destination = join(fixture.rootDir, 'biblioteca.zip');
  fixture.sqlite
    .prepare(
      `insert or replace into app_settings (key, value, updated_at) values (?, ?, ?)`,
    )
    .run('ui.theme', '"dark"', EXPORT_TIME);
  fixture.sqlite
    .prepare(
      `insert or replace into app_settings (key, value, updated_at) values (?, ?, ?)`,
    )
    .run('ui.last-view', '"entity"', EXPORT_TIME);
  fixture.sqlite
    .prepare(
      `insert or replace into app_settings (key, value, updated_at) values (?, ?, ?)`,
    )
    .run(
      'ui.recent-location',
      JSON.stringify({
        kind: 'world',
        worldId: FIXTURE_WORLD_ID,
      }),
      EXPORT_TIME,
    );
});

afterEach(async () => {
  fixture.close();
  await fixture.cleanup();
});

function preferences() {
  return {
    ...createDefaultUiPreferences(),
    theme: 'dark' as const,
    density: 'compact' as const,
    fontScale: 'large' as const,
    railCollapsed: true,
  };
}

function worlds() {
  return createWorldsService({
    database: fixture.database,
    sqlite: fixture.sqlite,
    now: () => EXPORT_TIME,
  });
}

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    database: fixture.database,
    sqlite: fixture.sqlite,
    exportsTempDir: fixture.exportsTempDir,
    assetsDir: fixture.assetsDir,
    destinationFile: destination,
    appVersion: '0.1.0',
    schemaVersion: fixture.schemaVersion,
    worlds: worlds(),
    preferences: { get: () => preferences() },
    now: () => EXPORT_TIME,
    ...overrides,
  };
}

async function extractWorldToImport(): Promise<string> {
  const index = await readLibraryArchiveIndex(destination);
  const worldEntry = index.entries.find(
    (entry) => entry.parsed.kind === 'world',
  );

  if (worldEntry === undefined) {
    throw new Error('La biblioteca no contiene ningún mundo.');
  }

  const file = join(fixture.rootDir, 'mundo-extraido.zip');
  await extractArchiveEntry(
    destination,
    worldEntry.path,
    file,
    worldEntry.uncompressedSize,
    undefined,
    { maxCompressionRatio: Number.POSITIVE_INFINITY },
  );

  return file;
}

describe('exportación total de la biblioteca', () => {
  it('exporta base, settings y mundos con entradas exactas y verificables', async () => {
    const result = await exportAll(baseOptions());

    expect(result).toMatchObject({
      status: 'completed',
      fileName: 'biblioteca.zip',
      worlds: 1,
    });

    if (result.status !== 'completed') {
      throw new Error('La exportación no se completó.');
    }

    expect(result.counts).toEqual({
      entities: 2,
      entityTypes: 1,
      relationTypes: 1,
      tags: 2,
      relations: 3,
      versions: 2,
      assets: 5,
    });
    expect(result.warnings).toEqual([]);
    expect(result.size).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain(fixture.userDataDir);

    const index = await readLibraryArchiveIndex(destination);

    expect(index.entries.map((entry) => entry.path).sort()).toEqual([
      'database/world-craft.sqlite',
      'manifest.json',
      'settings.json',
      'worlds/cronica-de-las-mareas.zip',
    ]);

    const manifest = parseLibraryManifestJson(
      (
        await readArchiveEntry(destination, 'manifest.json', 16 * 1024 ** 2)
      ).toString('utf8'),
    );

    expect(manifest.format).toBe('world-craft-library');
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.schemaVersion).toBe(fixture.schemaVersion);
    expect(manifest.database.integrity).toBe('ok');
    expect(manifest.database.schemaVersion).toBe(fixture.schemaVersion);
    expect(manifest.worlds).toHaveLength(1);
    expect(manifest.worlds[0]?.slug).toBe('cronica-de-las-mareas');
    expect(manifest.counts).toEqual(result.counts);

    const databaseEntry = index.entries.find(
      (entry) => entry.parsed.kind === 'database',
    );
    const worldEntry = index.entries.find(
      (entry) => entry.parsed.kind === 'world',
    );

    expect(databaseEntry?.compressedSize).toBe(databaseEntry?.uncompressedSize);
    expect(worldEntry?.compressedSize).toBe(worldEntry?.uncompressedSize);

    const settings = parseLibrarySettingsJson(
      (
        await readArchiveEntry(destination, 'settings.json', 64 * 1024)
      ).toString('utf8'),
    );

    expect(settings).toMatchObject({
      theme: 'dark',
      density: 'compact',
      fontScale: 'large',
      railCollapsed: true,
    });
    expect(settings).not.toHaveProperty('lastView');
    expect(settings).not.toHaveProperty('recentLocation');

    const databaseFile = join(fixture.rootDir, 'base-extraida.sqlite');

    await extractArchiveEntry(
      destination,
      'database/world-craft.sqlite',
      databaseFile,
      manifest.database.size,
      undefined,
      { maxCompressionRatio: Number.POSITIVE_INFINITY },
    );

    expect(inspectBackupFile(databaseFile, manifest.schemaVersion)).toBe('ok');

    const database = openDatabase({ file: databaseFile, readonly: true });

    try {
      const trashed = database
        .prepare(
          'select count(*) as total from worlds where deleted_at is not null',
        )
        .get() as { readonly total: number };
      const activity = database
        .prepare('select count(*) as total from activity_log')
        .get() as { readonly total: number };
      const theme = database
        .prepare("select value from app_settings where key = 'ui.theme'")
        .get() as { readonly value: string };
      const lastView = database
        .prepare("select value from app_settings where key = 'ui.last-view'")
        .get() as { readonly value: string };

      expect(trashed.total).toBe(1);
      expect(activity.total).toBeGreaterThan(0);
      expect(theme.value).toBe('"dark"');
      expect(lastView.value).toBe('"entity"');
    } finally {
      closeDatabase(database);
    }

    const worldZip = await extractWorldToImport();
    const importService = createImportService({
      database: fixture.database,
      sqlite: fixture.sqlite,
      importsDir: fixture.importsDir,
      assetsDir: fixture.assetsDir,
      assetsWorldsDir: fixture.assetsWorldsDir,
      assetsTempDir: fixture.assetsTempDir,
      schemaVersion: fixture.schemaVersion,
      now: () => EXPORT_TIME + 1,
    });
    const imported = await importService.importWorld(worldZip);

    expect(imported.counts).toEqual(result.counts);
    expect(imported.slug).toBe('cronica-de-las-mareas-2');

    const importedEntities = fixture.database
      .select()
      .from(entities)
      .where(eq(entities.worldId, imported.worldId))
      .all()
      .map((entity) => entity.name)
      .sort();

    expect(importedEntities).toEqual(['Aria', 'Orden del Faro']);
  });

  it('incluye mundos archivados', async () => {
    const service = worlds();
    const archived = service.create({ name: 'Mundo archivado' });

    service.setArchived({ id: archived.id, archived: true });

    const result = await exportAll(baseOptions({ worlds: service }));

    expect(result).toMatchObject({ status: 'completed', worlds: 2 });

    const index = await readLibraryArchiveIndex(destination);
    const worldPaths = index.entries
      .filter((entry) => entry.parsed.kind === 'world')
      .map((entry) => entry.path)
      .sort();

    expect(worldPaths).toEqual([
      'worlds/cronica-de-las-mareas.zip',
      'worlds/mundo-archivado.zip',
    ]);
  });

  it('produce una biblioteca vacía válida', async () => {
    const empty = await createEmptyLibraryFixture();

    try {
      const result = await exportAll({
        database: empty.database,
        sqlite: empty.sqlite,
        exportsTempDir: empty.exportsTempDir,
        assetsDir: empty.assetsDir,
        destinationFile: join(empty.rootDir, 'vacia.zip'),
        appVersion: '0.1.0',
        schemaVersion: empty.schemaVersion,
        worlds: createWorldsService({
          database: empty.database,
          sqlite: empty.sqlite,
        }),
        preferences: { get: () => createDefaultUiPreferences() },
        now: () => EXPORT_TIME,
      });

      expect(result).toMatchObject({
        status: 'completed',
        worlds: 0,
        counts: {
          entities: 0,
          entityTypes: 0,
          relationTypes: 0,
          tags: 0,
          relations: 0,
          versions: 0,
          assets: 0,
        },
      });

      const index = await readLibraryArchiveIndex(
        join(empty.rootDir, 'vacia.zip'),
      );

      expect(index.entries.map((entry) => entry.path).sort()).toEqual([
        'database/world-craft.sqlite',
        'manifest.json',
        'settings.json',
      ]);
    } finally {
      empty.close();
      await empty.cleanup();
    }
  });

  it('falla entero y limpia el staging si un mundo falla', async () => {
    const service = worlds();
    service.create({ name: 'Segundo mundo' });
    let calls = 0;
    const exportWorldFile = vi.fn(
      async (options: Parameters<typeof exportWorld>[0]) => {
        calls += 1;

        if (calls === 2) {
          throw new Error('fallo simulado');
        }

        return exportWorld(options);
      },
    );

    const result = await exportAll(
      baseOptions({ worlds: service, exportWorldFile }),
    );

    expect(result).toMatchObject({
      status: 'failed',
      code: 'DATA_LIBRARY_WORLD_FAILED',
    });
    await expect(readFile(destination)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readdir(fixture.exportsTempDir)).resolves.toEqual([]);
  });

  it('se cancela antes de escribir y no publica nada', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await exportAll(baseOptions({ signal: controller.signal }));

    expect(result).toEqual({ status: 'cancelled' });
    await expect(readFile(destination)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('falla sin espacio antes de publicar', async () => {
    const result = await exportAll(
      baseOptions({ readFreeSpace: async () => 0 }),
    );

    expect(result).toMatchObject({
      status: 'failed',
      code: 'DATA_LIBRARY_NO_SPACE',
    });
    await expect(readFile(destination)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('sustituye un destino existente solo al publicar', async () => {
    await writeFile(destination, 'anterior', 'utf8');

    const result = await exportAll(baseOptions());

    expect(result).toMatchObject({ status: 'completed' });
    const index = await readLibraryArchiveIndex(destination);

    expect(index.entries.length).toBe(4);
  });

  it('rechaza slugs duplicados antes de escribir', async () => {
    const list = worlds().list();

    const result = await exportAll(
      baseOptions({
        worlds: { list: () => [list[0]!, { ...list[0]!, id: 'otro' }] },
      }),
    );

    expect(result).toMatchObject({
      status: 'failed',
      code: 'DATA_LIBRARY_ENTRY_INVALID',
    });
    await expect(readFile(destination)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('verifica una biblioteca recién creada y rechaza una corrupta', async () => {
    await exportAll(baseOptions());

    const manifest = parseLibraryManifestJson(
      (
        await readArchiveEntry(destination, 'manifest.json', 16 * 1024 ** 2)
      ).toString('utf8'),
    );
    const stagedWorld = join(fixture.rootDir, 'staged-world.zip');

    await extractArchiveEntry(
      destination,
      manifest.worlds[0]!.path,
      stagedWorld,
      manifest.worlds[0]!.size,
      undefined,
      { maxCompressionRatio: Number.POSITIVE_INFINITY },
    );

    await expect(
      verifyLibraryArchive({
        file: destination,
        stagedDatabaseFile: join(fixture.rootDir, 'no-existe.sqlite'),
        stagedWorldFiles: new Map([[manifest.worlds[0]!.path, stagedWorld]]),
      }),
    ).rejects.toMatchObject({ code: 'DATA_LIBRARY_VERIFY_FAILED' });

    const corrupt = join(fixture.rootDir, 'corrupta.zip');
    await writeFile(corrupt, 'no es un zip', 'utf8');

    await expect(
      verifyLibraryArchive({
        file: corrupt,
        stagedDatabaseFile: join(fixture.rootDir, 'no-existe.sqlite'),
        stagedWorldFiles: new Map(),
      }),
    ).rejects.toMatchObject({ code: 'DATA_LIBRARY_VERIFY_FAILED' });
  });
});

interface EmptyLibraryFixture {
  readonly rootDir: string;
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly exportsTempDir: string;
  readonly assetsDir: string;
  readonly schemaVersion: number;
  close(): void;
  cleanup(): Promise<void>;
}

async function createEmptyLibraryFixture(): Promise<EmptyLibraryFixture> {
  const temp: TempDatabase = await createTestDatabase();
  const startup = await initializeDatabase({
    userDataDir: temp.userDataDir,
    migrationsDir: temp.migrationsDir,
  });

  if (startup.status !== 'ready') {
    throw new Error(`La base vacía no arrancó: ${startup.code}`);
  }

  return {
    rootDir: temp.rootDir,
    database: startup.client.orm,
    sqlite: startup.client.sqlite,
    exportsTempDir: startup.paths.exportsTempDir,
    assetsDir: startup.paths.assetsDir,
    schemaVersion: startup.client.sqlite.pragma('user_version', {
      simple: true,
    }) as number,
    close: () => startup.client.sqlite.close(),
    cleanup: () => temp.cleanup(),
  };
}
