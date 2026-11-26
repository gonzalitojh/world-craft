/**
 * Borrado total con copia previa verificable.
 *
 * La operación se divide en tres fases:
 *
 * 1. Copia `backups/pre-delete/<timestamp>/` con base v2 `pre-delete`, árbol de
 *    assets verificado y manifiestos de recuperación.
 * 2. Cierre de la persistencia mediante un callback inyectado; a partir de ahí
 *    no se vuelve a consultar SQLite y cualquier resultado parcial exige
 *    reiniciar la aplicación.
 * 3. Borrado ordenado de temporales, base, assets, logs y copias antiguas.
 *
 * Ninguna ruta se devuelve en el resultado. Las raíces se validan con
 * `inspectDirectoryInside` antes y después de la copia —incluidos los
 * directorios temporales y la carpeta de copias previas—: un enlace, junction o
 * escape de `userData` aborta sin seguir el destino. `userData`, sus entradas
 * desconocidas, `.updaterId` y la instalación nunca se borran.
 */
import {
  lstat,
  opendir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { z } from 'zod';

import { inspectDirectoryInside } from '../assets/paths';
import { createPreDeleteBackup, type BackupResult } from '../backup/create';
import { tryReadBackupManifest } from '../backup/manifest';
import { computeFileSha256, inspectBackupFile } from '../backup/verify';
import {
  DATA_DELETE_ALL_CONFIRMATION,
  DATA_PRE_DELETE_FORMAT,
  type DataDeleteCategory,
  type DataDeleteCounts,
  type DataDeleteResult,
} from '../../shared/contracts/data';
import type { SqliteDatabase } from '../db/connection';
import { DATABASE_FILE_NAME, type DataPaths } from '../db/paths';

export type {
  DataDeleteCounts,
  DataDeleteResult,
} from '../../shared/contracts/data';
import { DataError } from './errors';
import {
  ASSETS_COPY_FORMAT_ID,
  ASSETS_COPY_FORMAT_VERSION,
  ASSETS_COPY_MANIFEST_FILE,
  copyAndVerifyAssetsTree,
  verifyAssetsCopy,
  type CopyAssetsTreeOptions,
  type VerifiedAssetsCopy,
} from './verified-copy';

export const PRE_DELETE_RECOVERY_FORMAT = DATA_PRE_DELETE_FORMAT.id;
export const PRE_DELETE_RECOVERY_VERSION = DATA_PRE_DELETE_FORMAT.version;
export const PRE_DELETE_RECOVERY_FILE = 'recovery.json';
export const PRE_DELETE_ASSETS_DIR = 'assets';

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const recoverySchema = z
  .strictObject({
    format: z.literal(PRE_DELETE_RECOVERY_FORMAT),
    formatVersion: z.literal(PRE_DELETE_RECOVERY_VERSION),
    createdAt: z.string().datetime(),
    schemaVersion: z.number().int().min(1),
    database: z
      .strictObject({
        path: z.literal(DATABASE_FILE_NAME),
        sizeBytes: z.number().int().min(0),
        sha256: sha256Schema,
        schemaVersion: z.number().int().min(1),
      })
      .strict(),
    assets: z
      .strictObject({
        manifestPath: z.literal(ASSETS_COPY_MANIFEST_FILE),
        formatId: z.literal(ASSETS_COPY_FORMAT_ID),
        version: z.literal(ASSETS_COPY_FORMAT_VERSION),
        count: z.number().int().min(0),
        bytes: z.number().int().min(0),
        sha256: sha256Schema,
      })
      .strict(),
    instructions: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type PreDeleteRecovery = z.infer<typeof recoverySchema>;

export interface DataDeleteInput {
  readonly confirmation: string;
  readonly keepBackups: boolean;
}

export interface DeleteAllOptions extends DataDeleteInput {
  readonly paths: DataPaths;
  readonly database: SqliteDatabase;
  readonly schemaVersion: number;
  /** Debe consultar el coordinador de transferencias, no solo el flag local. */
  readonly isTransferBusy: () => boolean;
  /** Cierra la conexión y cualquier servicio que escriba en la base. */
  readonly closePersistence: () => void | Promise<void>;
  readonly now?: () => number;
  readonly createBackup?: typeof createPreDeleteBackup;
  readonly copyAssets?: (
    options: CopyAssetsTreeOptions,
  ) => Promise<VerifiedAssetsCopy>;
  /** Borrado inyectable; las pruebas lo usan para simular un fallo de disco. */
  readonly removePath?: (target: string) => Promise<void>;
}

/**
 * Ejecuta el borrado total y devuelve un resultado de dominio.
 *
 * Un token inválido, una transferencia activa o una raíz no segura se rechazan
 * con un error estable. Un fallo de copia devuelve `failed` y no borra nada;
 * los fallos de borrado se agregan en `partial`.
 */
export async function deleteAll(
  options: DeleteAllOptions,
): Promise<DataDeleteResult> {
  if (options.confirmation !== DATA_DELETE_ALL_CONFIRMATION) {
    throw new DataError('DATA_DELETE_CONFIRMATION_REQUIRED');
  }

  if (options.isTransferBusy()) {
    throw new DataError('DATA_BUSY');
  }

  validateRoots(options.paths);

  const now = options.now ?? Date.now;
  const removePath = options.removePath ?? removeWithRetries;
  let counts = await measureCounts(options.paths, options.keepBackups);
  let backup: BackupResult | null = null;

  try {
    backup = await (options.createBackup ?? createPreDeleteBackup)({
      database: options.database,
      backupRootDir: options.paths.preDeleteBackupsDir,
      timestamp: now(),
      schemaVersion: options.schemaVersion,
    });

    const assetsCopy = await (options.copyAssets ?? copyAndVerifyAssetsTree)({
      sourceAssetsDir: options.paths.assetsDir,
      targetAssetsDir: join(backup.directory, PRE_DELETE_ASSETS_DIR),
      manifestFile: join(backup.directory, ASSETS_COPY_MANIFEST_FILE),
    });

    counts = { ...counts, assetFiles: assetsCopy.manifest.count };

    await writeRecovery({
      backup,
      assetsCopy,
      schemaVersion: options.schemaVersion,
      createdAt: new Date(now()).toISOString(),
    });

    await verifyBackupBundle({
      backup,
      assetsCopy,
      schemaVersion: options.schemaVersion,
    });
  } catch (error) {
    if (backup !== null) {
      await removeWithRetries(backup.directory).catch(() => undefined);
    }

    return {
      status: 'failed',
      code: error instanceof DataError ? error.code : 'DATA_DELETE_COPY_FAILED',
      restartRequired: false,
      counts,
      remaining: [],
    };
  }

  try {
    validateRoots(options.paths);
  } catch (error) {
    await removeWithRetries(backup.directory).catch(() => undefined);
    throw error;
  }

  if (options.isTransferBusy()) {
    await removeWithRetries(backup.directory).catch(() => undefined);
    throw new DataError('DATA_BUSY');
  }

  try {
    await options.closePersistence();
  } catch {
    await removeWithRetries(backup.directory).catch(() => undefined);

    return {
      status: 'failed',
      code: 'DATA_DELETE_FAILED',
      restartRequired: false,
      counts,
      remaining: [],
    };
  }

  try {
    validateRoots(options.paths);
  } catch (error) {
    await removeWithRetries(backup.directory).catch(() => undefined);
    throw error;
  }

  const remaining = new Set<DataDeleteCategory>();

  await removeTemporaries(options.paths, removePath, remaining);
  await removeCategory(
    'database',
    options.paths.dataDir,
    removePath,
    remaining,
  );
  await removeCategory(
    'assets',
    options.paths.assetsDir,
    removePath,
    remaining,
  );
  await removeCategory('logs', options.paths.logsDir, removePath, remaining);

  if (!options.keepBackups) {
    await removeBackupsExcept(
      options.paths.backupsDir,
      backup.directory,
      removePath,
      remaining,
    );
  }

  const verification = await verifyDeletion({
    paths: options.paths,
    backupDirectory: backup.directory,
    keepBackups: options.keepBackups,
  });

  // La verificación final sobre disco es la fuente de verdad: un fallo de `rm`
  // que no dejó restos no convierte la operación en parcial.
  remaining.clear();

  for (const category of verification.remaining) {
    remaining.add(category);
  }

  // La persistencia ya se cerró: cualquier resultado parcial exige reinicio.
  // Al volver a arrancar, la aplicación reabre la base si quedó en disco o
  // crea una nueva si se borró; nunca se queda una sesión con la base cerrada.
  const restartRequired = true;

  if (remaining.size === 0) {
    return {
      status: 'deleted',
      restartRequired: true,
      counts,
      remaining: [],
    };
  }

  return {
    status: 'partial',
    restartRequired,
    counts,
    remaining: [...remaining],
  };
}

function validateRoots(paths: DataPaths): void {
  for (const root of [
    paths.dataDir,
    paths.assetsDir,
    paths.assetsTempDir,
    paths.logsDir,
    paths.importsDir,
    paths.importsTempDir,
    paths.exportsDir,
    paths.exportsTempDir,
    paths.backupsDir,
    paths.preDeleteBackupsDir,
  ]) {
    const state = inspectDirectoryInside(paths.userDataDir, root);

    if (
      state.state === 'link' ||
      state.state === 'escapes' ||
      state.state === 'not-directory'
    ) {
      throw new DataError('DATA_DELETE_ROOT_INVALID');
    }
  }
}

async function removeTemporaries(
  paths: DataPaths,
  removePath: (target: string) => Promise<void>,
  remaining: Set<DataDeleteCategory>,
): Promise<void> {
  for (const temporary of [
    paths.importsTempDir,
    paths.exportsTempDir,
    paths.assetsTempDir,
  ]) {
    try {
      await removePath(temporary);
    } catch {
      remaining.add('temporaries');
    }
  }
}

async function removeCategory(
  category: DataDeleteCategory,
  target: string,
  removePath: (target: string) => Promise<void>,
  remaining: Set<DataDeleteCategory>,
): Promise<void> {
  try {
    await removePath(target);
  } catch {
    remaining.add(category);
  }
}

async function removeBackupsExcept(
  backupsDir: string,
  preservedDirectory: string,
  removePath: (target: string) => Promise<void>,
  remaining: Set<DataDeleteCategory>,
): Promise<void> {
  let entries;

  try {
    entries = await readdir(backupsDir, { withFileTypes: true });
  } catch (error) {
    if (!isMissingError(error)) {
      remaining.add('backups');
    }

    return;
  }

  const preserved = normalizePath(preservedDirectory);

  for (const entry of entries) {
    const child = join(backupsDir, entry.name);
    const normalizedChild = normalizePath(child);

    try {
      if (normalizedChild === preserved) {
        continue;
      }

      if (isInside(normalizedChild, preserved)) {
        const grandchildren = await readdir(child, { withFileTypes: true });

        for (const grandchild of grandchildren) {
          const candidate = join(child, grandchild.name);

          if (normalizePath(candidate) === preserved) {
            continue;
          }

          await removePath(candidate);
        }

        continue;
      }

      await removePath(child);
    } catch (error) {
      if (!isMissingError(error)) {
        remaining.add('backups');
      }
    }
  }
}

async function verifyDeletion(input: {
  readonly paths: DataPaths;
  readonly backupDirectory: string;
  readonly keepBackups: boolean;
}): Promise<{
  readonly remaining: readonly DataDeleteCategory[];
  readonly backupValid: boolean;
}> {
  const remaining = new Set<DataDeleteCategory>();
  const dataClean = await isAbsentOrEmpty(input.paths.dataDir);
  const assetsClean = await isAbsentOrEmpty(input.paths.assetsDir);
  const logsClean = await isAbsentOrEmpty(input.paths.logsDir);
  const temporariesClean =
    (await isAbsentOrEmpty(input.paths.importsTempDir)) &&
    (await isAbsentOrEmpty(input.paths.exportsTempDir)) &&
    (await isAbsentOrEmpty(input.paths.assetsTempDir));
  const backupValid = await verifyBackupBundleAfterDeletion(input);

  if (!dataClean) {
    remaining.add('database');
  }

  if (!assetsClean) {
    remaining.add('assets');
  }

  if (!logsClean) {
    remaining.add('logs');
  }

  if (!temporariesClean) {
    remaining.add('temporaries');
  }

  if (!backupValid) {
    remaining.add('backups');
  }

  if (!input.keepBackups) {
    const leftovers = await listUnexpectedBackups(
      input.paths.backupsDir,
      input.backupDirectory,
    );

    if (leftovers) {
      remaining.add('backups');
    }
  }

  return { remaining: [...remaining], backupValid };
}

async function verifyBackupBundleAfterDeletion(input: {
  readonly paths: DataPaths;
  readonly backupDirectory: string;
  readonly keepBackups: boolean;
}): Promise<boolean> {
  const manifest = await tryReadBackupManifest(input.backupDirectory);

  if (
    manifest === null ||
    manifest.reason !== 'pre-delete' ||
    manifest.integrity !== 'ok' ||
    manifest.schemaVersion === null
  ) {
    return false;
  }

  const databaseFile = join(input.backupDirectory, manifest.databaseFile);
  const databaseStats = await lstat(databaseFile).catch(() => null);

  if (
    databaseStats === null ||
    !databaseStats.isFile() ||
    databaseStats.size !== manifest.sizeBytes ||
    (await computeFileSha256(databaseFile)) !== manifest.sha256 ||
    inspectBackupFile(
      databaseFile,
      manifest.schemaVersion,
      manifest.schemaVersion,
    ) !== 'ok'
  ) {
    return false;
  }

  try {
    const assetsManifestFile = join(
      input.backupDirectory,
      ASSETS_COPY_MANIFEST_FILE,
    );
    const assets = await verifyAssetsCopy({
      assetsDir: join(input.backupDirectory, PRE_DELETE_ASSETS_DIR),
      manifestFile: assetsManifestFile,
    });
    const recovery = parsePreDeleteRecovery(
      JSON.parse(
        await readFile(
          join(input.backupDirectory, PRE_DELETE_RECOVERY_FILE),
          'utf8',
        ),
      ) as unknown,
    );

    if (
      recovery.database.path !== manifest.databaseFile ||
      recovery.database.sizeBytes !== manifest.sizeBytes ||
      recovery.database.sha256 !== manifest.sha256 ||
      recovery.assets.count !== assets.count ||
      recovery.assets.bytes !== assets.bytes ||
      recovery.assets.sha256 !== (await computeFileSha256(assetsManifestFile))
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function listUnexpectedBackups(
  backupsDir: string,
  preservedDirectory: string,
): Promise<boolean> {
  let entries;

  try {
    entries = await readdir(backupsDir, { withFileTypes: true });
  } catch (error) {
    return !isMissingError(error);
  }

  const preserved = normalizePath(preservedDirectory);

  for (const entry of entries) {
    const child = join(backupsDir, entry.name);
    const normalizedChild = normalizePath(child);

    if (normalizedChild === preserved) {
      continue;
    }

    if (isInside(normalizedChild, preserved)) {
      let grandchildren;

      try {
        grandchildren = await readdir(child, { withFileTypes: true });
      } catch {
        return true;
      }

      for (const grandchild of grandchildren) {
        if (normalizePath(join(child, grandchild.name)) !== preserved) {
          return true;
        }
      }

      continue;
    }

    return true;
  }

  return false;
}

async function writeRecovery(input: {
  readonly backup: BackupResult;
  readonly assetsCopy: VerifiedAssetsCopy;
  readonly schemaVersion: number;
  readonly createdAt: string;
}): Promise<PreDeleteRecovery> {
  const recovery: PreDeleteRecovery = {
    format: PRE_DELETE_RECOVERY_FORMAT,
    formatVersion: PRE_DELETE_RECOVERY_VERSION,
    createdAt: input.createdAt,
    schemaVersion: input.schemaVersion,
    database: {
      path: DATABASE_FILE_NAME,
      sizeBytes: input.backup.manifest.sizeBytes,
      sha256: input.backup.manifest.sha256,
      schemaVersion: input.schemaVersion,
    },
    assets: {
      manifestPath: ASSETS_COPY_MANIFEST_FILE,
      formatId: ASSETS_COPY_FORMAT_ID,
      version: ASSETS_COPY_FORMAT_VERSION,
      count: input.assetsCopy.manifest.count,
      bytes: input.assetsCopy.manifest.bytes,
      sha256: await computeFileSha256(input.assetsCopy.manifestFile),
    },
    instructions: [
      'Cierra World Craft completamente.',
      'Copia world-craft.sqlite de esta carpeta en la carpeta data de la aplicación.',
      'Copia la carpeta assets de esta carpeta junto a data.',
      `Comprueba los archivos con ${ASSETS_COPY_MANIFEST_FILE} antes de abrir la aplicación.`,
    ],
  };

  await writeFile(
    join(input.backup.directory, PRE_DELETE_RECOVERY_FILE),
    `${JSON.stringify(recovery, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );

  return recovery;
}

async function verifyBackupBundle(input: {
  readonly backup: BackupResult;
  readonly assetsCopy: VerifiedAssetsCopy;
  readonly schemaVersion: number;
}): Promise<void> {
  const manifest = await tryReadBackupManifest(input.backup.directory);

  if (
    manifest === null ||
    manifest.reason !== 'pre-delete' ||
    manifest.integrity !== 'ok' ||
    manifest.schemaVersion !== input.schemaVersion ||
    inspectBackupFile(
      join(input.backup.directory, manifest.databaseFile),
      input.schemaVersion,
      input.schemaVersion,
    ) !== 'ok'
  ) {
    throw new DataError('DATA_DELETE_COPY_FAILED');
  }

  await verifyAssetsCopy({
    assetsDir: input.assetsCopy.assetsDir,
    manifestFile: input.assetsCopy.manifestFile,
  });

  const recovery = parsePreDeleteRecovery(
    JSON.parse(
      await readFile(
        join(input.backup.directory, PRE_DELETE_RECOVERY_FILE),
        'utf8',
      ),
    ) as unknown,
  );

  if (
    recovery.database.path !== manifest.databaseFile ||
    recovery.database.sizeBytes !== manifest.sizeBytes ||
    recovery.database.sha256 !== manifest.sha256 ||
    recovery.assets.count !== input.assetsCopy.manifest.count ||
    recovery.assets.bytes !== input.assetsCopy.manifest.bytes ||
    recovery.assets.sha256 !==
      (await computeFileSha256(input.assetsCopy.manifestFile))
  ) {
    throw new DataError('DATA_DELETE_COPY_FAILED');
  }
}

/** Valida `recovery.json` ya deserializado. */
export function parsePreDeleteRecovery(value: unknown): PreDeleteRecovery {
  const parsed = recoverySchema.safeParse(value);

  if (!parsed.success) {
    throw new DataError('DATA_DELETE_COPY_FAILED', { cause: parsed.error });
  }

  return parsed.data;
}

async function measureCounts(
  paths: DataPaths,
  keepBackups: boolean,
): Promise<DataDeleteCounts> {
  const [databaseFiles, logEntries, temporaryEntries, backupDirectories] =
    await Promise.all([
      countDatabaseFiles(paths),
      countTreeEntries(paths.logsDir),
      sum([
        countTreeEntries(paths.importsTempDir),
        countTreeEntries(paths.exportsTempDir),
        countTreeEntries(paths.assetsTempDir),
      ]),
      keepBackups ? Promise.resolve(0) : countBackupChildren(paths.backupsDir),
    ]);

  return {
    databaseFiles,
    assetFiles: 0,
    logEntries,
    temporaryEntries,
    backupDirectories,
  };
}

async function countDatabaseFiles(paths: DataPaths): Promise<number> {
  let count = 0;

  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const stats = await lstat(`${paths.databaseFile}${suffix}`).catch(
      () => null,
    );

    if (stats?.isFile() === true && !stats.isSymbolicLink()) {
      count += 1;
    }
  }

  return count;
}

async function countTreeEntries(root: string): Promise<number> {
  const stats = await lstat(root).catch(() => null);

  if (stats === null || stats.isSymbolicLink()) {
    return 0;
  }

  if (!stats.isDirectory()) {
    return 1;
  }

  let count = 0;
  const pending = [root];

  while (pending.length > 0) {
    const directory = pending.pop();

    if (directory === undefined) {
      break;
    }

    try {
      const handle = await opendir(directory);

      for await (const entry of handle) {
        count += 1;

        if (entry.isSymbolicLink()) {
          continue;
        }

        if (entry.isDirectory()) {
          pending.push(join(directory, entry.name));
        }
      }
    } catch {
      return count;
    }
  }

  return count;
}

async function countBackupChildren(backupsDir: string): Promise<number> {
  try {
    const entries = await readdir(backupsDir, { withFileTypes: true });

    return entries.length;
  } catch {
    return 0;
  }
}

async function sum(promises: readonly Promise<number>[]): Promise<number> {
  const values = await Promise.all(promises);

  return values.reduce((total, value) => total + value, 0);
}

async function isAbsentOrEmpty(target: string): Promise<boolean> {
  const stats = await lstat(target).catch(() => null);

  if (stats === null) {
    return true;
  }

  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    return false;
  }

  try {
    const entries = await readdir(target);
    return entries.length === 0;
  } catch {
    return false;
  }
}

async function removeWithRetries(target: string): Promise<void> {
  await rm(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

function normalizePath(target: string): string {
  const path = resolve(target);

  return process.platform === 'win32' ? path.toLowerCase() : path;
}

function isInside(parent: string, child: string): boolean {
  const relation = relative(parent, child);

  return (
    relation.length > 0 && !relation.startsWith('..') && !isAbsolute(relation)
  );
}

function isMissingError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}
