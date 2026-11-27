import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDataService } from '@/main/data/service';
import { createAssetRepository } from '@/main/assets/store';
import { initializeDatabase } from '@/main/db/startup';
import type { SqliteDatabase } from '@/main/db/connection';
import { createTestDatabase, type TempDatabase } from '../helpers/temp-db';

const NOW = 1_760_000_000_000;
const ACTIVE_WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ARCHIVED_WORLD_ID = '01900000-0000-7000-8000-000000000002';
const TRASH_WORLD_ID = '01900000-0000-7000-8000-000000000003';
const ENTITY_LIVE_ID = '01900000-0000-7000-8000-000000000004';
const ENTITY_TRASH_ID = '01900000-0000-7000-8000-000000000005';
const ASSET_ID = '01900000-0000-7000-8000-000000000006';
const ORPHAN_ID = '01900000-0000-7000-8000-000000000007';

interface Context {
  readonly temp: TempDatabase;
  readonly service: ReturnType<typeof createDataService>;
  readonly sqlite: SqliteDatabase;
  readonly openPath: ReturnType<typeof vi.fn>;
  readonly referencedFile: string;
  readonly orphanFile: string;
  cleanup(): Promise<void>;
}

let context: Context | null = null;

afterEach(async () => {
  if (context !== null) {
    const current = context;
    context = null;
    await current.cleanup();
  }
});

async function createContext(): Promise<Context> {
  const temp = await createTestDatabase();
  const startup = await initializeDatabase({
    userDataDir: temp.userDataDir,
    migrationsDir: temp.migrationsDir,
    now: () => NOW,
  });

  if (startup.status !== 'ready') {
    throw new Error(`La base de prueba no arrancó: ${startup.code}`);
  }

  const { sqlite } = startup.client;
  const type = sqlite
    .prepare('select id from entity_types where world_id is null limit 1')
    .get() as { readonly id: string };
  const insertWorld = sqlite.prepare(
    `insert into worlds (id, name, slug, genres, status, language, settings, created_at, updated_at, archived_at, deleted_at)
     values (?, ?, ?, '[]', ?, 'es', '{}', ?, ?, ?, ?)`,
  );

  insertWorld.run(
    ACTIVE_WORLD_ID,
    'Mundo vivo',
    'mundo-vivo',
    'active',
    NOW,
    NOW,
    null,
    null,
  );
  insertWorld.run(
    ARCHIVED_WORLD_ID,
    'Mundo archivado',
    'mundo-archivado',
    'archived',
    NOW,
    NOW,
    NOW,
    null,
  );
  insertWorld.run(
    TRASH_WORLD_ID,
    'Mundo en papelera',
    'mundo-en-papelera',
    'active',
    NOW,
    NOW,
    null,
    NOW,
  );

  const insertEntity = sqlite.prepare(
    `insert into entities (id, world_id, type_id, name, slug, created_at, updated_at, deleted_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  insertEntity.run(
    ENTITY_LIVE_ID,
    ACTIVE_WORLD_ID,
    type.id,
    'Ficha viva',
    'ficha-viva',
    NOW,
    NOW,
    null,
  );
  insertEntity.run(
    ENTITY_TRASH_ID,
    ACTIVE_WORLD_ID,
    type.id,
    'Ficha en papelera',
    'ficha-en-papelera',
    NOW,
    NOW,
    NOW,
  );

  const worldDir = join(startup.paths.assetsWorldsDir, ACTIVE_WORLD_ID);
  await mkdir(worldDir, { recursive: true });
  const referencedFile = join(worldDir, `${ASSET_ID}.webp`);
  const orphanFile = join(worldDir, `${ORPHAN_ID}.webp`);
  await writeFile(referencedFile, '0123456789', 'utf8');
  await writeFile(orphanFile, 'x'.repeat(20), 'utf8');
  await mkdir(join(startup.paths.dailyBackupsDir, 'uno'), {
    recursive: true,
  });
  await mkdir(join(startup.paths.weeklyBackupsDir, 'dos'), {
    recursive: true,
  });
  await writeFile(
    join(startup.paths.importsTempDir, 'import.tmp'),
    '1234567',
    'utf8',
  );
  await writeFile(
    join(startup.paths.exportsTempDir, 'export.tmp'),
    '123456789',
    'utf8',
  );
  await writeFile(
    join(startup.paths.assetsTempDir, 'asset.tmp'),
    '12345678901',
    'utf8',
  );
  // Un archivo fuera de los temporales de importación no lo borra el borrado
  // total y tampoco debe contarse como «Temporales».
  await writeFile(join(startup.paths.importsDir, 'resto.tmp'), '12345', 'utf8');

  const assets = createAssetRepository(startup.client.orm);

  assets.insert({
    id: ASSET_ID,
    worldId: ACTIVE_WORLD_ID,
    kind: 'image',
    relativePath: `worlds/${ACTIVE_WORLD_ID}/${ASSET_ID}.webp`,
    mime: 'image/webp',
    size: 10,
    width: 10,
    height: 10,
    alt: null,
    hash: 'a'.repeat(64),
    createdAt: NOW,
  });

  const openPath = vi.fn(async () => {});
  const service = createDataService({
    paths: startup.paths,
    sqlite,
    assets,
    openPath,
    now: () => NOW,
  });

  const current: Context = {
    temp,
    service,
    sqlite,
    openPath,
    referencedFile,
    orphanFile,
    cleanup: async () => {
      sqlite.close();
      await temp.cleanup();
    },
  };

  context = current;

  return current;
}

describe('servicio de datos con base temporal', () => {
  it('resume la base y las copias sin devolver rutas', async () => {
    const current = await createContext();
    const summary = current.service.summary();

    expect(summary).toEqual({
      worlds: { active: 1, archived: 1, trash: 1 },
      entities: 1,
      assets: 1,
      backups: 2,
      quarantine: { assets: 0, references: 0 },
    });
    expect(JSON.stringify(summary)).not.toContain(current.temp.userDataDir);
  });

  it('mide el uso real de la base, assets, copias y logs', async () => {
    const current = await createContext();
    const usage = await current.service.usage();

    expect(usage.categories.database.bytes).toBeGreaterThan(0);
    // 10 + 20 bytes de los dos assets; `assets/.tmp` no suma como imagen.
    expect(usage.categories.assets.bytes).toBe(30);
    expect(usage.categories.backups.bytes).toBe(0);
    // Solo los directorios que borra el borrado total: 7 + 9 + 11 bytes.
    expect(usage.categories.temporary.bytes).toBe(27);
    expect(usage.categories.temporary.entries).toBe(3);
    // El archivo suelto de `imports/` (fuera de `.tmp/`) no se cuenta.
    expect(usage.totalBytes).toBe(
      Object.values(usage.categories).reduce(
        (total, category) => total + category.bytes,
        0,
      ),
    );
    expect(usage.partial).toBe(false);
  });

  it('abre una carpeta real y no devuelve su ruta', async () => {
    const current = await createContext();

    await expect(current.service.openFolder('logs')).resolves.toEqual({
      opened: true,
    });
    expect(current.openPath).toHaveBeenCalledTimes(1);
    expect(JSON.stringify({ opened: true })).not.toContain(
      current.temp.userDataDir,
    );
  });

  it('planifica, exige token y purga conservando el asset referenciado', async () => {
    const current = await createContext();
    const plan = current.service.planOrphans();

    expect(plan.unreferencedFiles).toBe(1);
    // El archivo de `assets/.tmp` también es purgable.
    expect(plan.purgeableFiles).toBe(2);
    expect(plan.recoverableBytes).toBe(31);

    await expect(
      current.service.purgeOrphans('token-incorrecto'),
    ).rejects.toMatchObject({ code: 'DATA_ORPHAN_CONFIRMATION_REQUIRED' });
    await expect(access(current.referencedFile)).resolves.toBeUndefined();
    await expect(access(current.orphanFile)).resolves.toBeUndefined();

    await expect(
      current.service.purgeOrphans('purge-orphans'),
    ).resolves.toEqual({
      purgedFiles: 2,
      purgedBytes: 31,
      backupCreated: true,
    });
    await expect(access(current.referencedFile)).resolves.toBeUndefined();
    await expect(access(current.orphanFile)).rejects.toThrow();
  });

  it('cuenta la cuarentena y la trata como huérfana sin borrar sus metadatos', async () => {
    const current = await createContext();
    const quarantinedId = '01900000-0000-7000-8000-000000000008';
    const quarantinedRelativePath = `worlds/${ACTIVE_WORLD_ID}/${quarantinedId}.webp`;
    const quarantinedFile = join(
      current.temp.paths.assetsDir,
      ...quarantinedRelativePath.split('/'),
    );

    await writeFile(quarantinedFile, 'cuarentena', 'utf8');
    current.sqlite
      .prepare(
        `INSERT INTO assets_quarantine (id, world_id, kind, relative_path, mime, size, width, height, alt, hash, created_at, reason, quarantined_at)
         VALUES (?, ?, 'image', ?, 'image/webp', 10, 10, 10, NULL, ?, ?, 'world-missing', ?)`,
      )
      .run(
        quarantinedId,
        '01900000-0000-7000-8000-000000000099',
        quarantinedRelativePath,
        'b'.repeat(64),
        NOW,
        NOW,
      );
    current.sqlite
      .prepare(
        `INSERT INTO assets_quarantine_references (asset_id, table_name, row_id, column_name, position, created_at)
         VALUES (?, 'worlds', ?, 'cover_asset_id', NULL, ?)`,
      )
      .run(quarantinedId, '01900000-0000-7000-8000-000000000098', NOW);

    expect(current.service.summary()).toEqual({
      worlds: { active: 1, archived: 1, trash: 1 },
      entities: 1,
      assets: 1,
      backups: 2,
      quarantine: { assets: 1, references: 1 },
    });

    const plan = current.service.planOrphans();

    expect(plan.unreferencedFiles).toBe(2);
    expect(plan.purgeableFiles).toBe(3);
    expect(await readFile(quarantinedFile, 'utf8')).toBe('cuarentena');

    await expect(
      current.service.purgeOrphans('purge-orphans'),
    ).resolves.toMatchObject({ purgedFiles: 3, backupCreated: true });
    await expect(access(quarantinedFile)).rejects.toThrow();
    expect(
      current.sqlite
        .prepare('SELECT count(*) AS total FROM assets_quarantine')
        .get(),
    ).toEqual({ total: 1 });
  });
});
