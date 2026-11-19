/**
 * Restauración de una copia verificada en modo seguro.
 *
 * El flujo no abre ninguna conexión de escritura: verifica la copia en solo
 * lectura, crea una copia de preservación de la base actual (aunque esté
 * corrupta), sustituye los archivos con un archivo temporal y un `.rollback`,
 * y ante cualquier fallo devuelve la base anterior a su sitio.
 *
 * Un `.restore.lock` con `wx` y el PID evita dos restauraciones simultáneas; un
 * lock de un proceso que ya no vive se considera obsoleto. Un marcador durable
 * `.restore.pending` sobrevive a un cierre abrupto y garantiza que el arranque
 * no cree una base vacía. Los errores no incluyen rutas ni contenido.
 */
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { DatabaseError } from '../db/errors';
import { DATABASE_FILE_NAME } from '../db/paths';
import {
  createPreservationCopy,
  formatBackupDirectoryName,
  readDatabaseIntegrity,
  readDatabaseSchemaVersion,
} from './create';
import { fileExists } from './fs';
import { listBackups } from './inventory';
import { acquireRestoreLock, RESTORE_LOCK_FILE_NAME } from './lock';
import {
  removeRestorePending,
  RESTORE_PENDING_FILE_NAME,
  writeRestorePending,
} from './pending';
import {
  isRestorableManifest,
  type BackupManifest,
  type RestorableBackupManifest,
} from './manifest';
import {
  computeFileSha256,
  inspectBackup,
  inspectBackupFile,
  type BackupFailureReason,
} from './verify';

/** Motivo estable de un fallo de restauración. */
export type RestoreFailureReason = BackupFailureReason | 'rollback';

/** Códigos que puede devolver una restauración fallida. */
export type RestoreErrorCode =
  'DB_RESTORE_INVALID' | 'DB_RESTORE_FAILED' | 'DB_RESTORE_ROLLBACK_FAILED';

/** Copia válida lista para restaurar. */
export interface RestorableBackup {
  readonly directory: string;
  readonly manifest: RestorableBackupManifest;
}

export type RestoreInspection =
  | { readonly ok: true; readonly backup: RestorableBackup }
  | { readonly ok: false; readonly reason: BackupFailureReason };

export type RestoreResult =
  | {
      readonly ok: true;
      readonly manifest: RestorableBackupManifest;
      readonly preservationDirectory: string | null;
    }
  | {
      readonly ok: false;
      readonly code: RestoreErrorCode;
      readonly reason: RestoreFailureReason;
    };

/**
 * Operaciones de archivo que participan en el reemplazo.
 *
 * Se inyectan en pruebas para simular un renombrado bloqueado en cada paso sin
 * tocar el sistema de archivos real.
 */
export interface RestoreFileOperations {
  copyFile(source: string, target: string): Promise<void>;
  rename(source: string, target: string): Promise<void>;
}

/** Operaciones por defecto, con reintentos breves para Windows. */
export function createRestoreFileOperations(): RestoreFileOperations {
  return {
    copyFile: (source, target) => copyFile(source, target),
    rename: (source, target) => renameWithRetry(source, target),
  };
}

/**
 * Reintenta un renombrado bloqueado por antivirus o indexadores de Windows.
 *
 * Tres intentos con 100 ms entre ellos; cualquier otro error se propaga sin
 * esperar.
 */
export async function renameWithRetry(
  source: string,
  target: string,
): Promise<void> {
  const attempts = 3;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rename(source, target);

      return;
    } catch (error) {
      lastError = error;

      if (!isRetryableRenameError(error) || attempt === attempts - 1) {
        break;
      }

      await delay(100);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('rename');
}

export interface RestoreBackupOptions {
  /** Carpeta de la copia elegida, ya validada dentro de `backups/`. */
  readonly backupDirectory: string;
  readonly dataDir: string;
  readonly databaseFile: string;
  readonly preRestoreDir: string;
  /** Última versión del journal instalado; una copia futura se rechaza. */
  readonly targetSchemaVersion: number;
  /** Instante de la restauración; inyectable en pruebas. */
  readonly timestamp: number;
  /** PID que se escribe en el lock; en pruebas permite simular otro proceso. */
  readonly pid?: number;
  readonly operations?: RestoreFileOperations;
}

/**
 * Restaura una copia y devuelve un resultado estable; nunca lanza por datos o
 * bloqueos (los fallos inesperados se clasifican como `io`).
 */
export async function restoreBackup(
  options: RestoreBackupOptions,
): Promise<RestoreResult> {
  const selection = await inspectRestorableBackup({
    directory: options.backupDirectory,
    targetSchemaVersion: options.targetSchemaVersion,
  });

  if (!selection.ok) {
    return {
      ok: false,
      code: 'DB_RESTORE_INVALID',
      reason: selection.reason,
    };
  }

  const manifest = selection.backup.manifest;
  const sourceDatabase = join(
    selection.backup.directory,
    manifest.databaseFile,
  );
  const operations = options.operations ?? createRestoreFileOperations();
  const lockFile = join(options.dataDir, RESTORE_LOCK_FILE_NAME);
  const pid = options.pid ?? process.pid;

  try {
    await mkdir(options.dataDir, { recursive: true });
  } catch {
    return { ok: false, code: 'DB_RESTORE_FAILED', reason: 'io' };
  }

  const lock = await acquireRestoreLock(lockFile, pid, options.timestamp);

  if (lock !== 'acquired') {
    return {
      ok: false,
      code: 'DB_RESTORE_FAILED',
      reason: lock === 'held' ? 'lock' : 'io',
    };
  }

  const rollbackFile = `${options.databaseFile}.rollback`;
  const rollbackWalFile = `${rollbackFile}-wal`;
  const rollbackShmFile = `${rollbackFile}-shm`;
  const rollbackJournalFile = `${rollbackFile}-journal`;
  const tempFile = `${options.databaseFile}.restore.tmp`;
  const tempWalFile = `${tempFile}-wal`;
  const tempShmFile = `${tempFile}-shm`;
  const tempJournalFile = `${tempFile}-journal`;
  const pendingFile = join(options.dataDir, RESTORE_PENDING_FILE_NAME);
  let pendingWritten = false;
  let preservationDirectory: string | null = null;
  let tempOwned = false;

  /**
   * Retira el marcador solo cuando hay una base viva y el resultado no es un
   * rollback fallido. Si hay dudas, se conserva: el siguiente arranque entrará
   * en modo seguro en vez de crear una base vacía.
   */
  const settlePending = async (
    result: RestoreResult,
  ): Promise<RestoreResult> => {
    if (!pendingWritten) {
      return result;
    }

    try {
      const liveDatabaseExists = await fileExists(options.databaseFile);
      const canClear =
        liveDatabaseExists &&
        (result.ok || result.code !== 'DB_RESTORE_ROLLBACK_FAILED');

      if (canClear) {
        await removeRestorePending(pendingFile);
        pendingWritten = false;
      }
    } catch {
      // Se conserva el marcador.
    }

    return result;
  };

  try {
    await writeRestorePending(pendingFile, pid, options.timestamp);
    pendingWritten = true;

    const liveDatabaseExists = await fileExists(options.databaseFile);

    if (liveDatabaseExists) {
      const preservation = await createPreservationCopy({
        databaseFile: options.databaseFile,
        parentDir: options.preRestoreDir,
        timestamp: options.timestamp,
        schemaVersion: readDatabaseSchemaVersion(options.databaseFile),
        integrity: readDatabaseIntegrity(options.databaseFile),
      });

      preservationDirectory = preservation?.directory ?? null;
    }

    // Restos de una restauración anterior interrumpida: se guardan antes de
    // reutilizar los nombres `.rollback` o `.restore.tmp`, nunca se borran.
    await preserveStaleRollback({
      preRestoreDir: options.preRestoreDir,
      timestamp: options.timestamp,
      operations,
      rollbackFile,
      rollbackWalFile,
      rollbackShmFile,
      rollbackJournalFile,
    });

    await preserveStaleTemporary({
      preRestoreDir: options.preRestoreDir,
      timestamp: options.timestamp,
      operations,
      tempFile,
      tempWalFile,
      tempShmFile,
      tempJournalFile,
    });

    // A partir de aquí el temporal es nuestro y se puede limpiar aunque el
    // reemplazo falle.
    tempOwned = true;
    await rm(tempFile, { force: true });
    await operations.copyFile(sourceDatabase, tempFile);

    if (!(await matchesManifest(tempFile, manifest))) {
      return await settlePending({
        ok: false,
        code: 'DB_RESTORE_INVALID',
        reason: 'checksum',
      });
    }

    return await settlePending(
      await replaceDatabase({
        options,
        operations,
        manifest,
        tempFile,
        rollbackFile,
        rollbackWalFile,
        rollbackShmFile,
        rollbackJournalFile,
        preservationDirectory,
      }),
    );
  } catch {
    return await settlePending({
      ok: false,
      code: 'DB_RESTORE_FAILED',
      reason: 'io',
    });
  } finally {
    if (tempOwned) {
      for (const file of [
        tempFile,
        tempWalFile,
        tempShmFile,
        tempJournalFile,
      ]) {
        await rm(file, { force: true }).catch(() => {
          // Limpieza best-effort; el lock se libera igualmente.
        });
      }
    }

    await rm(lockFile, { force: true }).catch(() => {
      // Si no se puede borrar, un PID muerto lo convierte en obsoleto.
    });
  }
}

/**
 * Busca la copia válida más reciente entre los motivos indicados.
 *
 * Ignora copias corruptas, con manifiesto v1 ilegible o con una versión de
 * esquema superior a la instalada.
 */
export async function findLatestRestorableBackup(options: {
  readonly directories: readonly string[];
  readonly targetSchemaVersion: number;
}): Promise<RestorableBackup | null> {
  const candidates: RestorableBackup[] = [];

  for (const directory of options.directories) {
    let entries;

    try {
      entries = await listBackups(directory, {
        targetSchemaVersion: options.targetSchemaVersion,
      });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.verification.ok) {
        continue;
      }

      const manifest = entry.verification.manifest;

      if (
        !isRestorableManifest(manifest) ||
        manifest.reason === 'pre-restore'
      ) {
        continue;
      }

      candidates.push({ directory: entry.directory, manifest });
    }
  }

  return candidates.reduce<RestorableBackup | null>(
    (current, candidate) =>
      current === null || isNewer(candidate, current) ? candidate : current,
    null,
  );
}

/** Verifica una carpeta concreta y comprueba que es restaurable. */
export async function inspectRestorableBackup(options: {
  readonly directory: string;
  readonly targetSchemaVersion: number;
}): Promise<RestoreInspection> {
  const verification = await inspectBackup(options.directory, {
    targetSchemaVersion: options.targetSchemaVersion,
  });

  if (!verification.ok) {
    return { ok: false, reason: verification.reason };
  }

  if (!isRestorableManifest(verification.manifest)) {
    return { ok: false, reason: 'integrity' };
  }

  if (verification.manifest.reason === 'pre-restore') {
    return { ok: false, reason: 'manifest' };
  }

  return {
    ok: true,
    backup: {
      directory: options.directory,
      manifest: verification.manifest,
    },
  };
}

/**
 * Valida una carpeta elegida por el usuario y la deja como ruta real dentro de
 * `backups/`.
 *
 * Se resuelven las rutas reales con `realpath` y se comprueba la contención con
 * `relative` para que ni `..`, ni una junction, ni una unidad distinta puedan
 * sacar la restauración de la carpeta de copias.
 */
export function resolveRestoreDirectory(options: {
  readonly backupsDir: string;
  readonly candidate: string;
}): string {
  try {
    const { candidate } = options;

    if (
      typeof candidate !== 'string' ||
      candidate.length === 0 ||
      candidate.includes('\0') ||
      !isAbsolute(candidate)
    ) {
      throw new DatabaseError('DB_RESTORE_INVALID');
    }

    const root = realpathSync(resolve(options.backupsDir));
    const target = realpathSync(resolve(candidate));

    if (!statSync(target).isDirectory()) {
      throw new DatabaseError('DB_RESTORE_INVALID');
    }

    const relation = relative(root, target);

    if (
      relation.length === 0 ||
      relation.startsWith('..') ||
      isAbsolute(relation)
    ) {
      throw new DatabaseError('DB_RESTORE_INVALID');
    }

    return target;
  } catch {
    throw new DatabaseError('DB_RESTORE_INVALID');
  }
}

interface ReplaceDatabaseOptions {
  readonly options: RestoreBackupOptions;
  readonly operations: RestoreFileOperations;
  readonly manifest: RestorableBackupManifest;
  readonly tempFile: string;
  readonly rollbackFile: string;
  readonly rollbackWalFile: string;
  readonly rollbackShmFile: string;
  readonly rollbackJournalFile: string;
  readonly preservationDirectory: string | null;
}

async function replaceDatabase(
  input: ReplaceDatabaseOptions,
): Promise<RestoreResult> {
  const { options, operations, manifest } = input;
  const databaseFile = options.databaseFile;
  const walFile = `${databaseFile}-wal`;
  const shmFile = `${databaseFile}-shm`;
  const journalFile = `${databaseFile}-journal`;
  const hadDatabase = await fileExists(databaseFile);
  const hadWal = await fileExists(walFile);
  const hadShm = await fileExists(shmFile);
  const hadJournal = await fileExists(journalFile);
  let movedDatabase = false;
  let movedWal = false;
  let movedShm = false;
  let movedJournal = false;
  let installedNew = false;

  try {
    if (hadDatabase) {
      await operations.rename(databaseFile, input.rollbackFile);
      movedDatabase = true;
    }

    if (hadWal) {
      await operations.rename(walFile, input.rollbackWalFile);
      movedWal = true;
    }

    if (hadShm) {
      await operations.rename(shmFile, input.rollbackShmFile);
      movedShm = true;
    }

    if (hadJournal) {
      await operations.rename(journalFile, input.rollbackJournalFile);
      movedJournal = true;
    }

    await operations.rename(input.tempFile, databaseFile);
    installedNew = true;

    const verification = inspectBackupFile(
      databaseFile,
      manifest.schemaVersion,
    );

    if (verification !== 'ok') {
      throw new RestoreReplacementError(verification);
    }

    await cleanupRollback(input);

    return {
      ok: true,
      manifest,
      preservationDirectory: input.preservationDirectory,
    };
  } catch (error) {
    const needsRollback =
      movedDatabase || movedWal || movedShm || movedJournal || installedNew;
    let rolledBack = true;

    if (needsRollback) {
      rolledBack = await rollbackOriginal({
        databaseFile,
        walFile,
        shmFile,
        journalFile,
        rollbackFile: input.rollbackFile,
        rollbackWalFile: input.rollbackWalFile,
        rollbackShmFile: input.rollbackShmFile,
        rollbackJournalFile: input.rollbackJournalFile,
        movedDatabase,
        movedWal,
        movedShm,
        movedJournal,
        installedNew,
        operations,
      });
    }

    if (!rolledBack) {
      return {
        ok: false,
        code: 'DB_RESTORE_ROLLBACK_FAILED',
        reason: 'rollback',
      };
    }

    return {
      ok: false,
      code: 'DB_RESTORE_FAILED',
      reason: error instanceof RestoreReplacementError ? error.reason : 'io',
    };
  }
}

class RestoreReplacementError extends Error {
  readonly reason: BackupFailureReason;

  constructor(reason: BackupFailureReason) {
    super('restore-replacement');
    this.name = 'RestoreReplacementError';
    this.reason = reason;
  }
}

async function rollbackOriginal(input: {
  readonly databaseFile: string;
  readonly walFile: string;
  readonly shmFile: string;
  readonly journalFile: string;
  readonly rollbackFile: string;
  readonly rollbackWalFile: string;
  readonly rollbackShmFile: string;
  readonly rollbackJournalFile: string;
  readonly movedDatabase: boolean;
  readonly movedWal: boolean;
  readonly movedShm: boolean;
  readonly movedJournal: boolean;
  readonly installedNew: boolean;
  readonly operations: RestoreFileOperations;
}): Promise<boolean> {
  try {
    // Solo se retira la base nueva si llegó a instalarse; si el fallo ocurrió
    // antes, la base anterior sigue en su sitio y no se toca.
    if (input.installedNew) {
      await rm(input.databaseFile, { force: true });
      await rm(input.walFile, { force: true });
      await rm(input.shmFile, { force: true });
      await rm(input.journalFile, { force: true });
    }

    if (input.movedDatabase) {
      await input.operations.rename(input.rollbackFile, input.databaseFile);
    }

    if (input.movedWal) {
      await input.operations.rename(input.rollbackWalFile, input.walFile);
    }

    if (input.movedShm) {
      await input.operations.rename(input.rollbackShmFile, input.shmFile);
    }

    if (input.movedJournal) {
      await input.operations.rename(
        input.rollbackJournalFile,
        input.journalFile,
      );
    }

    return true;
  } catch {
    return false;
  }
}

async function cleanupRollback(input: {
  readonly rollbackFile: string;
  readonly rollbackWalFile: string;
  readonly rollbackShmFile: string;
  readonly rollbackJournalFile: string;
}): Promise<void> {
  for (const file of [
    input.rollbackFile,
    input.rollbackWalFile,
    input.rollbackShmFile,
    input.rollbackJournalFile,
  ]) {
    await rm(file, { force: true }).catch(() => {
      // Un `.rollback` huérfano no invalida la restauración ya completada.
    });
  }
}

async function preserveStaleRollback(input: {
  readonly preRestoreDir: string;
  readonly timestamp: number;
  readonly operations: RestoreFileOperations;
  readonly rollbackFile: string;
  readonly rollbackWalFile: string;
  readonly rollbackShmFile: string;
  readonly rollbackJournalFile: string;
}): Promise<void> {
  const leftovers = [
    { source: input.rollbackFile, name: DATABASE_FILE_NAME },
    { source: input.rollbackWalFile, name: `${DATABASE_FILE_NAME}-wal` },
    { source: input.rollbackShmFile, name: `${DATABASE_FILE_NAME}-shm` },
    {
      source: input.rollbackJournalFile,
      name: `${DATABASE_FILE_NAME}-journal`,
    },
  ];
  const existing: typeof leftovers = [];

  for (const leftover of leftovers) {
    if (await fileExists(leftover.source)) {
      existing.push(leftover);
    }
  }

  if (existing.length === 0) {
    return;
  }

  const directory = join(
    input.preRestoreDir,
    `${formatBackupDirectoryName(input.timestamp)}-rollback`,
  );

  await mkdir(directory, { recursive: true });

  for (const leftover of existing) {
    await input.operations.rename(
      leftover.source,
      join(directory, leftover.name),
    );
  }
}

async function preserveStaleTemporary(input: {
  readonly preRestoreDir: string;
  readonly timestamp: number;
  readonly operations: RestoreFileOperations;
  readonly tempFile: string;
  readonly tempWalFile: string;
  readonly tempShmFile: string;
  readonly tempJournalFile: string;
}): Promise<void> {
  const leftovers = [
    { source: input.tempFile, name: `${DATABASE_FILE_NAME}.restore.tmp` },
    {
      source: input.tempWalFile,
      name: `${DATABASE_FILE_NAME}.restore.tmp-wal`,
    },
    {
      source: input.tempShmFile,
      name: `${DATABASE_FILE_NAME}.restore.tmp-shm`,
    },
    {
      source: input.tempJournalFile,
      name: `${DATABASE_FILE_NAME}.restore.tmp-journal`,
    },
  ];
  const existing: typeof leftovers = [];

  for (const leftover of leftovers) {
    if (await fileExists(leftover.source)) {
      existing.push(leftover);
    }
  }

  if (existing.length === 0) {
    return;
  }

  const directory = join(
    input.preRestoreDir,
    `${formatBackupDirectoryName(input.timestamp)}-restore-tmp`,
  );

  await mkdir(directory, { recursive: true });

  for (const leftover of existing) {
    await input.operations.rename(
      leftover.source,
      join(directory, leftover.name),
    );
  }
}

async function matchesManifest(
  file: string,
  manifest: BackupManifest,
): Promise<boolean> {
  try {
    const fileStats = await stat(file);

    if (fileStats.size !== manifest.sizeBytes) {
      return false;
    }

    return (
      (await computeFileSha256(file)) === manifest.sha256 &&
      inspectBackupFile(file, manifest.schemaVersion) === 'ok'
    );
  } catch {
    return false;
  }
}

function isNewer(left: RestorableBackup, right: RestorableBackup): boolean {
  if (left.manifest.createdAt !== right.manifest.createdAt) {
    return left.manifest.createdAt > right.manifest.createdAt;
  }

  return left.directory > right.directory;
}

function isRetryableRenameError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;

  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}
