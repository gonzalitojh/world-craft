/**
 * Conexión SQLite de World Craft.
 *
 * Una única conexión de escritura en el proceso principal. En usos normales se
 * aplican WAL, `synchronous = NORMAL`, claves foráneas y `busy_timeout` antes
 * de usar la base. El arranque puede diferir los pragmas de escritura para
 * comprobar la integridad sin tocar la cabecera de una base corrupta.
 */
import Database from 'better-sqlite3';

import { DatabaseError, toDatabaseError } from './errors';

/** Tipo de la conexión que expone better-sqlite3. */
export type SqliteDatabase = InstanceType<typeof Database>;

/** Tiempo máximo de espera ante un bloqueo de SQLite. */
export const BUSY_TIMEOUT_MS = 5000;

/** Opciones de apertura de una conexión. */
export interface OpenDatabaseOptions {
  readonly file: string;
  readonly readonly?: boolean;
  /**
   * Abre solo con los pragmas de conexión (`busy_timeout` y claves foráneas) y
   * pospone WAL y `synchronous` hasta llamar a `enableWritePragmas`. Lo usa el
   * arranque para ejecutar `integrity_check` antes de escribir la cabecera.
   */
  readonly deferWritePragmas?: boolean;
}

/**
 * Abre la base y aplica los pragmas de seguridad.
 *
 * En escritura exige WAL salvo que `deferWritePragmas` sea `true`. En solo
 * lectura no se cambia el modo del journal y se fuerza `query_only`.
 */
export function openDatabase({
  file,
  readonly = false,
  deferWritePragmas = false,
}: OpenDatabaseOptions): SqliteDatabase {
  let database: SqliteDatabase | null = null;

  try {
    database = new Database(file, {
      readonly,
      fileMustExist: readonly,
      timeout: BUSY_TIMEOUT_MS,
    });

    database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
    database.pragma('foreign_keys = ON');

    if (readonly) {
      database.pragma('query_only = ON');
    } else if (!deferWritePragmas) {
      enableWritePragmas(database);
    }

    return database;
  } catch (error) {
    if (database !== null) {
      closeDatabase(database);
    }

    throw toDatabaseError(error, 'DB_OPEN_FAILED');
  }
}

/**
 * Activa WAL y `synchronous = NORMAL` en una conexión de escritura.
 *
 * Es idempotente y debe llamarse después de comprobar la integridad y de crear
 * la copia previa si hay migraciones pendientes.
 */
export function enableWritePragmas(database: SqliteDatabase): void {
  const journalMode = database.pragma('journal_mode = WAL', {
    simple: true,
  });

  if (journalMode !== 'wal') {
    throw new DatabaseError('DB_OPEN_FAILED');
  }

  database.pragma('synchronous = NORMAL');
}

/** Cierra una conexión sin lanzar si ya estaba cerrada. */
export function closeDatabase(database: SqliteDatabase): void {
  try {
    if (database.open) {
      database.close();
    }
  } catch {
    // El cierre es best-effort: no debe enmascarar el fallo original ni
    // impedir que la aplicación termine.
  }
}

/**
 * Lee `PRAGMA user_version`.
 *
 * En World Craft este valor es el **número de migraciones aplicadas**, no el
 * prefijo ni el índice de la etiqueta: con `0000_init` aplicada vale 1.
 */
export function readUserVersion(database: SqliteDatabase): number {
  const value = database.pragma('user_version', { simple: true });

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new DatabaseError('DB_OPEN_FAILED');
  }

  return value;
}

/**
 * Fija `PRAGMA user_version` como número de migraciones aplicadas.
 *
 * `0000_init` deja el valor en 1; no se guarda el prefijo `0000`.
 */
export function writeUserVersion(
  database: SqliteDatabase,
  version: number,
): void {
  if (!Number.isInteger(version) || version < 0) {
    throw new RangeError(
      'La versión de esquema debe ser un entero no negativo.',
    );
  }

  database.pragma(`user_version = ${version}`);
}
