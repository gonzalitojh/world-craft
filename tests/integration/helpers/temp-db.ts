/**
 * Utilidades compartidas por las pruebas de integración.
 *
 * Todas las bases viven en `os.tmpdir()`; ninguna prueba toca
 * `app.getPath('userData')`, `%APPDATA%` ni el repositorio.
 */
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveDataPaths, type DataPaths } from '../../../src/main/db/paths';

/** Carpeta `drizzle/` del repositorio, con las migraciones reales. */
export const REPOSITORY_MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../drizzle/', import.meta.url),
);

/** SQL de la migración inicial real. */
export const INIT_MIGRATION_SQL = readFileSync(
  join(REPOSITORY_MIGRATIONS_DIR, '0000_init.sql'),
  'utf8',
);

export interface TempDatabase {
  readonly rootDir: string;
  readonly userDataDir: string;
  readonly paths: DataPaths;
  readonly migrationsDir: string;
  cleanup(): Promise<void>;
}

/**
 * Crea una carpeta temporal aislada con su propia carpeta `userData`.
 * `migrationsDir` apunta a las migraciones reales salvo que la prueba indique
 * un fixture propio.
 */
export async function createTestDatabase(options?: {
  readonly migrationsDir?: string;
}): Promise<TempDatabase> {
  const rootDir = await mkdtemp(join(tmpdir(), 'world-craft-db-'));
  const userDataDir = join(rootDir, 'user-data');
  const migrationsDir = options?.migrationsDir ?? REPOSITORY_MIGRATIONS_DIR;

  return {
    rootDir,
    userDataDir,
    paths: resolveDataPaths(userDataDir),
    migrationsDir,
    cleanup: () => cleanup(rootDir),
  };
}

/** Elimina una carpeta temporal con reintentos para Windows. */
export async function cleanup(directory: string): Promise<void> {
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}

export interface MigrationFixture {
  readonly tag: string;
  readonly sql: string;
}

/**
 * Escribe un journal y los `.sql` de un fixture de migraciones.
 *
 * La primera entrada de cada fixture debe crear `schema_migrations`, igual que
 * la migración 0000 real.
 */
export async function createMigrationFixture(
  directory: string,
  migrations: readonly MigrationFixture[],
): Promise<void> {
  await mkdir(join(directory, 'meta'), { recursive: true });

  const entries = migrations.map((migration, index) => ({
    idx: index,
    version: '6',
    when: 1_760_000_000_000 + index,
    tag: migration.tag,
    breakpoints: true,
  }));

  await writeFile(
    join(directory, 'meta', '_journal.json'),
    `${JSON.stringify(
      { version: '7', dialect: 'sqlite', entries },
      null,
      2,
    )}\n`,
    'utf8',
  );

  for (const migration of migrations) {
    await writeFile(
      join(directory, `${migration.tag}.sql`),
      migration.sql,
      'utf8',
    );
  }
}
