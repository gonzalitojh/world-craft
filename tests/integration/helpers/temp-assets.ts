/**
 * Utilidades de integración del servicio de assets.
 *
 * Todo vive en `os.tmpdir()`: base migrada, carpeta `assets/`, copias y log.
 * Ninguna prueba toca `%APPDATA%` ni el repositorio.
 */
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createAssetRepository } from '@/main/assets/store';
import type { AssetRepository } from '@/main/assets/store';
import { closeDatabase, type SqliteDatabase } from '@/main/db/connection';
import { resolveDataPaths, type DataPaths } from '@/main/db/paths';
import { initializeDatabase } from '@/main/db/startup';

export interface AssetFixture {
  readonly rootDir: string;
  readonly userDataDir: string;
  readonly migrationsDir: string;
  readonly paths: DataPaths;
  readonly repository: AssetRepository;
  readonly sqlite: SqliteDatabase;
  close(): void;
  cleanup(): Promise<void>;
}

/** Crea una base migrada con el servicio de assets listo. */
export async function createAssetFixture(): Promise<AssetFixture> {
  const rootDir = await mkdtemp(join(tmpdir(), 'world-craft-assets-db-'));
  const userDataDir = join(rootDir, 'user-data');
  const migrationsDir = join(rootDir, 'migrations');

  // Se copian las migraciones reales del repositorio para que la prueba ejerza
  // exactamente el journal versionado.
  await copyRepositoryMigrations(migrationsDir);

  const result = await initializeDatabase({ userDataDir, migrationsDir });

  if (result.status !== 'ready') {
    throw new Error(`La base de la prueba no arrancó: ${result.code}`);
  }

  return {
    rootDir,
    userDataDir,
    migrationsDir,
    paths: resolveDataPaths(userDataDir),
    repository: createAssetRepository(result.client.orm),
    sqlite: result.client.sqlite,
    close: () => closeDatabase(result.client.sqlite),
    cleanup: () => cleanup(rootDir),
  };
}

/** Copia `drizzle/` a una carpeta temporal. */
async function copyRepositoryMigrations(target: string): Promise<void> {
  const source = new URL('../../../drizzle/', import.meta.url);

  await cp(source, target, { recursive: true });
}

/** Escribe un archivo creando sus carpetas. */
export async function writeAssetFile(
  assetsDir: string,
  relativePath: string,
  contents: string | Uint8Array,
): Promise<string> {
  const absolutePath = join(assetsDir, ...relativePath.split('/'));

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);

  return absolutePath;
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
