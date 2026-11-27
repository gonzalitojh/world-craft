import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { es as messages } from '../../src/renderer/messages/es';

import { expect, launchElectronApp, test } from './fixtures/electron-app';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MIGRATIONS_DIR = join(REPOSITORY_ROOT, 'drizzle');

const NOW = 1_760_000_000_000;
const TRASHED_WORLD = '01900000-0000-7000-8000-000000000101';
const LIVE_WORLD = '01900000-0000-7000-8000-000000000102';
const MISSING_WORLD = '01900000-0000-7000-8000-000000000199';
const TRASHED_ASSET = '01900000-0000-7000-8000-000000000201';
const COVER_ASSET = '01900000-0000-7000-8000-000000000202';
const ORPHAN_ASSET = '01900000-0000-7000-8000-000000000203';
const TRASHED_WORLD_NAME = 'Mundo en cuarentena';

const SCHEMA_NINE_MIGRATIONS = [
  '0000_init',
  '0001_assets',
  '0002_worlds',
  '0003_entity_types',
  '0004_entities',
  '0005_relations',
  '0006_search',
  '0007_trash_versions',
  '0008_world_description',
] as const;

function checksum(sql: string): string {
  return createHash('sha256')
    .update(sql.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'))
    .digest('hex');
}

async function seedSchemaNine(userDataDir: string): Promise<string> {
  const dataDir = join(userDataDir, 'data');
  const databaseFile = join(dataDir, 'world-craft.sqlite');

  await mkdir(dataDir, { recursive: true });

  const sqlite = new Database(databaseFile);

  try {
    for (const tag of SCHEMA_NINE_MIGRATIONS) {
      sqlite.exec(await readFile(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8'));
    }

    const insertMigration = sqlite.prepare(
      'INSERT INTO schema_migrations (id, applied_at, checksum) VALUES (?, ?, ?)',
    );

    for (const tag of SCHEMA_NINE_MIGRATIONS) {
      const sql = await readFile(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');

      insertMigration.run(tag, NOW, checksum(sql));
    }

    sqlite.pragma('user_version = 9');

    const insertWorld = sqlite.prepare(
      `INSERT INTO worlds (id, name, slug, genres, status, language, settings, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, '[]', 'active', 'es', '{}', ?, ?, ?)`,
    );

    insertWorld.run(
      TRASHED_WORLD,
      TRASHED_WORLD_NAME,
      'mundo-en-cuarentena',
      NOW,
      NOW,
      NOW,
    );
    insertWorld.run(LIVE_WORLD, 'Mundo vivo', 'mundo-vivo', NOW, NOW, null);

    const insertAsset = sqlite.prepare(
      `INSERT INTO assets (id, world_id, kind, relative_path, mime, size, width, height, alt, hash, created_at)
       VALUES (?, ?, 'image', ?, 'image/webp', 10, 10, 10, NULL, ?, ?)`,
    );

    insertAsset.run(
      TRASHED_ASSET,
      TRASHED_WORLD,
      `worlds/${TRASHED_WORLD}/${TRASHED_ASSET}.webp`,
      'a'.repeat(64),
      NOW,
    );
    insertAsset.run(
      COVER_ASSET,
      MISSING_WORLD,
      `worlds/${MISSING_WORLD}/${COVER_ASSET}.webp`,
      'b'.repeat(64),
      NOW,
    );
    insertAsset.run(
      ORPHAN_ASSET,
      MISSING_WORLD,
      `worlds/${MISSING_WORLD}/${ORPHAN_ASSET}.webp`,
      'c'.repeat(64),
      NOW,
    );

    sqlite
      .prepare('UPDATE worlds SET cover_asset_id = ? WHERE id = ?')
      .run(COVER_ASSET, LIVE_WORLD);

    for (const [worldId, assetId] of [
      [TRASHED_WORLD, TRASHED_ASSET],
      [MISSING_WORLD, COVER_ASSET],
      [MISSING_WORLD, ORPHAN_ASSET],
    ] as const) {
      const directory = join(userDataDir, 'assets', 'worlds', worldId);

      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, `${assetId}.webp`),
        `archivo-${assetId}`,
        'binary',
      );
    }
  } finally {
    sqlite.close();
  }

  return databaseFile;
}

test('la cuarentena de assets sobrevive a la purga sin borrar archivos', async ({
  userDataDir,
}) => {
  const databaseFile = await seedSchemaNine(userDataDir);
  const { electronApp, page } = await launchElectronApp(userDataDir);

  try {
    await page
      .getByRole('navigation', { name: messages.shell.navigationLabel })
      .getByRole('button', { name: messages.shell.views.trash })
      .click();

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: messages.shell.views.trash,
      }),
    ).toBeVisible();

    const row = page.locator('[data-trash-kind="world"]').filter({
      hasText: TRASHED_WORLD_NAME,
    });

    await expect(row).toBeVisible();
    await page
      .getByRole('button', {
        name: messages.trash.row.purgeNamed(TRASHED_WORLD_NAME),
      })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: messages.trash.purgeDialog.submit })
      .click();
    await expect(
      page.getByText(messages.trash.row.purged(TRASHED_WORLD_NAME)),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }

  const sqlite = new Database(databaseFile, { readonly: true });

  try {
    expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({
      user_version: 10,
    });
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(
      sqlite
        .prepare('SELECT count(*) AS total FROM worlds WHERE id = ?')
        .get(TRASHED_WORLD),
    ).toEqual({ total: 0 });
    expect(
      sqlite
        .prepare('SELECT count(*) AS total FROM assets WHERE id = ?')
        .get(TRASHED_ASSET),
    ).toEqual({ total: 0 });
    expect(
      sqlite
        .prepare(
          'SELECT reason FROM assets_quarantine WHERE id = ? ORDER BY reason',
        )
        .all(COVER_ASSET),
    ).toEqual([{ reason: 'world-missing' }]);
    expect(
      sqlite
        .prepare('SELECT reason FROM assets_quarantine WHERE id = ?')
        .get(ORPHAN_ASSET),
    ).toEqual({ reason: 'world-missing' });
    expect(
      sqlite
        .prepare('SELECT reason FROM assets_quarantine WHERE id = ?')
        .get(TRASHED_ASSET),
    ).toEqual({ reason: 'world-purged' });
    expect(
      sqlite
        .prepare('SELECT cover_asset_id FROM worlds WHERE id = ?')
        .get(LIVE_WORLD),
    ).toEqual({ cover_asset_id: null });
  } finally {
    sqlite.close();
  }

  for (const [worldId, assetId] of [
    [TRASHED_WORLD, TRASHED_ASSET],
    [MISSING_WORLD, COVER_ASSET],
    [MISSING_WORLD, ORPHAN_ASSET],
  ] as const) {
    const file = join(
      userDataDir,
      'assets',
      'worlds',
      worldId,
      `${assetId}.webp`,
    );

    await expect(access(file)).resolves.toBeUndefined();
    expect(await readFile(file, 'utf8')).toBe(`archivo-${assetId}`);
  }
});
