/**
 * Arranque de la base local.
 *
 * Orquesta el orden del ADR 0002 sin conocer Electron:
 * abrir sin WAL → integridad → inspeccionar migraciones → copia previa si hay
 * datos y migraciones pendientes → activar WAL → migrar en transacción →
 * integridad posterior.
 *
 * Cualquier fallo cierra la conexión de escritura, registra un código estable
 * y devuelve `safe-mode`. La restauración guiada desde copia llega en M0-07;
 * aquí la copia queda creada y verificada.
 */
import { createDatabaseClient, type DatabaseClient } from './client';
import { createPreMigrationBackup, type BackupResult } from './backup';
import {
  closeDatabase,
  enableWritePragmas,
  openDatabase,
  readUserVersion,
  type SqliteDatabase,
} from './connection';
import {
  DatabaseError,
  toDatabaseError,
  type DatabaseErrorCode,
} from './errors';
import { checkIntegrity } from './integrity';
import {
  createStartupLogger,
  type StartupLogIntegrity,
  type StartupLogger,
} from './logger';
import { applyPendingMigrations, inspectMigrations } from './migrations';
import {
  ensureDataDirectories,
  isNewDatabase,
  resolveDataPaths,
  type DataPaths,
} from './paths';

export interface InitializeDatabaseOptions {
  /** Carpeta `userData` ya resuelta por Electron. */
  readonly userDataDir: string;
  /** Carpeta que contiene `meta/_journal.json` y los `.sql`. */
  readonly migrationsDir: string;
  /** Reloj inyectable para pruebas; por defecto `Date.now`. */
  readonly now?: () => number;
}

export type DatabaseStartupResult =
  | {
      readonly status: 'ready';
      readonly client: DatabaseClient;
      readonly paths: DataPaths;
      readonly schemaVersion: number;
      readonly appliedMigrations: number;
      readonly newDatabase: boolean;
      readonly backup: BackupResult | null;
    }
  | {
      readonly status: 'safe-mode';
      readonly code: DatabaseErrorCode;
      readonly schemaVersion: number | null;
      readonly backup: BackupResult | null;
      /**
       * Rutas resueltas si se pudieron calcular; `null` si la propia carpeta
       * `userData` no era válida. La composición las reutiliza para el aviso.
       */
      readonly paths: DataPaths | null;
    };

/** Abre, verifica y migra la base; nunca lanza por un fallo de datos. */
export async function initializeDatabase(
  options: InitializeDatabaseOptions,
): Promise<DatabaseStartupResult> {
  const now = options.now ?? Date.now;

  let paths: DataPaths | null = null;
  let logger: StartupLogger | null = null;
  let database: SqliteDatabase | null = null;
  let schemaVersion: number | null = null;
  let backup: BackupResult | null = null;
  let newDatabase: boolean;

  try {
    const resolvedPaths = resolveDataPaths(options.userDataDir);
    paths = resolvedPaths;
    logger = createStartupLogger(resolvedPaths.startupLogFile, now);
    ensureDataDirectories(resolvedPaths);

    newDatabase = isNewDatabase(resolvedPaths.databaseFile);
    database = openDatabase({
      file: resolvedPaths.databaseFile,
      deferWritePragmas: true,
    });

    // La integridad se comprueba antes de leer o escribir cualquier estado.
    // Con `deferWritePragmas` todavía no se ha activado WAL: una base corrupta
    // no debe recibir escrituras en la cabecera.
    if (!checkIntegrity(database).ok) {
      throw new DatabaseError('DB_INTEGRITY_FAILED');
    }

    schemaVersion = readUserVersion(database);

    const plan = inspectMigrations(database, options.migrationsDir);
    let appliedMigrations = 0;

    if (plan.pending.length > 0) {
      if (!newDatabase) {
        // Base existente: la copia se crea y verifica antes de tocar nada.
        backup = await createPreMigrationBackup({
          database,
          backupRootDir: resolvedPaths.preMigrationBackupsDir,
          timestamp: now(),
          schemaVersion: plan.currentVersion,
        });

        logger.log({
          event: 'database.backup',
          outcome: 'created',
          schemaVersion: plan.currentVersion,
        });
      }
    }

    // WAL y synchronous solo se activan cuando la integridad ha pasado, el
    // estado es coherente y, si hacía falta, la copia ya está verificada.
    enableWritePragmas(database);

    if (plan.pending.length > 0) {
      appliedMigrations = applyPendingMigrations(database, plan, { now });

      logger.log({
        event: 'database.migrations',
        outcome: 'applied',
        count: appliedMigrations,
        schemaVersion: plan.targetVersion,
      });

      if (!checkIntegrity(database).ok) {
        throw new DatabaseError('DB_INTEGRITY_FAILED');
      }
    }

    const verifiedPlan = inspectMigrations(database, options.migrationsDir);
    schemaVersion = verifiedPlan.currentVersion;
    const client = createDatabaseClient(database);

    logger.log({
      event: 'database.startup',
      outcome: 'ready',
      schemaVersion,
      appliedMigrations,
      newDatabase,
      backupCreated: backup !== null,
      integrity: 'ok',
    });

    return {
      status: 'ready',
      client,
      paths: resolvedPaths,
      schemaVersion,
      appliedMigrations,
      newDatabase,
      backup,
    };
  } catch (error) {
    const databaseError = toDatabaseError(error, 'DB_OPEN_FAILED');
    let integrity: StartupLogIntegrity = 'unknown';

    if (database !== null) {
      try {
        schemaVersion = readUserVersion(database);
      } catch {
        // Se conserva la última versión conocida, si la hubo.
      }

      try {
        integrity = checkIntegrity(database).ok ? 'ok' : 'failed';
      } catch {
        integrity = 'unknown';
      }

      closeDatabase(database);
    }

    logger?.log({
      event: 'database.startup',
      outcome: 'safe-mode',
      code: databaseError.code,
      schemaVersion,
      integrity,
    });

    return {
      status: 'safe-mode',
      code: databaseError.code,
      schemaVersion,
      backup,
      paths,
    };
  }
}
