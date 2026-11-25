/**
 * Rutas de los datos locales de World Craft.
 *
 * Este módulo no conoce Electron: recibe la carpeta `userData` ya resuelta por
 * el proceso principal. La raíz debe ser absoluta; se normaliza con `resolve` y
 * se comprueba con `relative` que todos los directorios derivados quedan
 * dentro. Las rutas inválidas se rechazan con `DB_OPEN_FAILED` sin incluir la
 * ruta en el error.
 */
import { mkdirSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { DatabaseError } from './errors';

/** Nombre del archivo principal de SQLite. */
export const DATABASE_FILE_NAME = 'world-craft.sqlite';

/** Nombre del log JSONL de arranque. */
export const STARTUP_LOG_FILE_NAME = 'startup.log';

/** Nombre del log JSONL del servicio de assets. */
export const ASSETS_LOG_FILE_NAME = 'assets.log';

/** Nombre del log JSONL de exportación e importación. */
export const TRANSFER_LOG_FILE_NAME = 'transfer.log';

/** Carpeta de preparación de importaciones. */
export const IMPORTS_DIR_NAME = 'imports';

/** Carpeta de escrituras temporales de exportación e importación. */
export const TRANSFER_TEMP_DIR_NAME = '.tmp';

/** Carpeta de escrituras temporales de exportación. */
export const EXPORTS_DIR_NAME = 'exports';

/** Carpeta de assets con rutas relativas a ella. */
export const ASSETS_DIR_NAME = 'assets';

/** Subcarpeta de assets de los mundos. */
export const ASSETS_WORLDS_DIR_NAME = 'worlds';

/** Subcarpeta de escrituras temporales de assets. */
export const ASSETS_TEMP_DIR_NAME = '.tmp';

/** Subcarpeta de copias de huérfanos purgados. */
export const ORPHAN_BACKUPS_DIR_NAME = 'orphans';

/** Rutas derivadas de la carpeta de datos del usuario. */
export interface DataPaths {
  readonly userDataDir: string;
  readonly dataDir: string;
  readonly databaseFile: string;
  readonly logsDir: string;
  readonly startupLogFile: string;
  readonly backupsDir: string;
  readonly dailyBackupsDir: string;
  readonly weeklyBackupsDir: string;
  readonly monthlyBackupsDir: string;
  readonly preMigrationBackupsDir: string;
  readonly preRestoreBackupsDir: string;
  readonly prePurgeBackupsDir: string;
  readonly assetsDir: string;
  readonly assetsWorldsDir: string;
  readonly assetsTempDir: string;
  readonly assetsLogFile: string;
  readonly orphanBackupsDir: string;
  readonly importsDir: string;
  readonly importsTempDir: string;
  readonly exportsDir: string;
  readonly exportsTempDir: string;
  readonly transferLogFile: string;
}

/** Calcula y valida todas las rutas de datos a partir de `userData`. */
export function resolveDataPaths(userDataDir: string): DataPaths {
  if (
    typeof userDataDir !== 'string' ||
    userDataDir.trim().length === 0 ||
    userDataDir.includes('\0') ||
    !isAbsolute(userDataDir)
  ) {
    throw new DatabaseError('DB_OPEN_FAILED');
  }

  const root = resolve(userDataDir);
  const dataDir = resolve(root, 'data');
  const logsDir = resolve(root, 'logs');
  const backupsDir = resolve(root, 'backups');
  const dailyBackupsDir = resolve(backupsDir, 'daily');
  const weeklyBackupsDir = resolve(backupsDir, 'weekly');
  const monthlyBackupsDir = resolve(backupsDir, 'monthly');
  const preMigrationBackupsDir = resolve(backupsDir, 'pre-migration');
  const preRestoreBackupsDir = resolve(backupsDir, 'pre-restore');
  const prePurgeBackupsDir = resolve(backupsDir, 'pre-purge');
  const assetsDir = resolve(root, ASSETS_DIR_NAME);
  const assetsWorldsDir = resolve(assetsDir, ASSETS_WORLDS_DIR_NAME);
  const assetsTempDir = resolve(assetsDir, ASSETS_TEMP_DIR_NAME);
  const orphanBackupsDir = resolve(backupsDir, ORPHAN_BACKUPS_DIR_NAME);
  const importsDir = resolve(root, IMPORTS_DIR_NAME);
  const importsTempDir = resolve(importsDir, TRANSFER_TEMP_DIR_NAME);
  const exportsDir = resolve(root, EXPORTS_DIR_NAME);
  const exportsTempDir = resolve(exportsDir, TRANSFER_TEMP_DIR_NAME);
  const databaseFile = resolve(dataDir, DATABASE_FILE_NAME);
  const startupLogFile = resolve(logsDir, STARTUP_LOG_FILE_NAME);
  const assetsLogFile = resolve(logsDir, ASSETS_LOG_FILE_NAME);
  const transferLogFile = resolve(logsDir, TRANSFER_LOG_FILE_NAME);

  for (const candidate of [
    dataDir,
    logsDir,
    backupsDir,
    dailyBackupsDir,
    weeklyBackupsDir,
    monthlyBackupsDir,
    preMigrationBackupsDir,
    preRestoreBackupsDir,
    prePurgeBackupsDir,
    assetsDir,
    assetsWorldsDir,
    assetsTempDir,
    orphanBackupsDir,
    importsDir,
    importsTempDir,
    exportsDir,
    exportsTempDir,
    databaseFile,
    startupLogFile,
    assetsLogFile,
    transferLogFile,
  ]) {
    assertInside(root, candidate);
  }

  return {
    userDataDir: root,
    dataDir,
    databaseFile,
    logsDir,
    startupLogFile,
    backupsDir,
    dailyBackupsDir,
    weeklyBackupsDir,
    monthlyBackupsDir,
    preMigrationBackupsDir,
    preRestoreBackupsDir,
    prePurgeBackupsDir,
    assetsDir,
    assetsWorldsDir,
    assetsTempDir,
    assetsLogFile,
    orphanBackupsDir,
    importsDir,
    importsTempDir,
    exportsDir,
    exportsTempDir,
    transferLogFile,
  };
}

/**
 * Crea las carpetas necesarias usando rutas ya validadas.
 *
 * Las carpetas esenciales (datos, logs y assets) son estrictas: sin ellas la
 * aplicación no puede trabajar. Las de `backups/` son best-effort: una ruta
 * ocupada por un archivo o sin permisos no debe impedir arrancar con una base
 * sana; cada copia crea su carpeta bajo demanda.
 */
export function ensureDataDirectories(paths: DataPaths): void {
  try {
    mkdirSync(paths.dataDir, { recursive: true });
    mkdirSync(paths.logsDir, { recursive: true });
    mkdirSync(paths.assetsDir, { recursive: true });
    mkdirSync(paths.assetsWorldsDir, { recursive: true });
    mkdirSync(paths.assetsTempDir, { recursive: true });
  } catch (error) {
    throw new DatabaseError('DB_OPEN_FAILED', { cause: error });
  }

  for (const directory of [
    paths.backupsDir,
    paths.dailyBackupsDir,
    paths.weeklyBackupsDir,
    paths.monthlyBackupsDir,
    paths.preMigrationBackupsDir,
    paths.preRestoreBackupsDir,
    paths.prePurgeBackupsDir,
    paths.orphanBackupsDir,
    paths.importsDir,
    paths.importsTempDir,
    paths.exportsDir,
    paths.exportsTempDir,
  ]) {
    try {
      mkdirSync(directory, { recursive: true });
    } catch {
      // Best-effort: la copia, la purga o la transferencia crearán su carpeta
      // cuando puedan; una carpeta ocupada no impide arrancar.
    }
  }
}

/**
 * Una base es nueva cuando el archivo no existe o está vacío.
 *
 * En ese caso no hay datos que preservar y la migración inicial no necesita
 * copia previa; el runner lo documenta y las pruebas lo verifican.
 */
export function isNewDatabase(databaseFile: string): boolean {
  try {
    return statSync(databaseFile).size === 0;
  } catch (error) {
    if (isMissingFileError(error)) {
      return true;
    }

    throw new DatabaseError('DB_OPEN_FAILED', { cause: error });
  }
}

function assertInside(root: string, candidate: string): void {
  const relation = relative(root, candidate);

  if (
    relation.length === 0 ||
    relation.startsWith('..') ||
    isAbsolute(relation)
  ) {
    throw new DatabaseError('DB_OPEN_FAILED');
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
