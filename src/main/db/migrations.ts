/**
 * Runner de migraciones versionadas.
 *
 * No usa `drizzle-kit push` ni `drizzle-kit migrate`: lee el journal validado,
 * compara el estado real con `schema_migrations` y `PRAGMA user_version` y
 * aplica el lote pendiente dentro de una única transacción. Una migración ya
 * aplicada no se puede editar: si cambia su SQL, el checksum no coincide y la
 * app entra en modo seguro.
 */
import { z } from 'zod';

import {
  readUserVersion,
  writeUserVersion,
  type SqliteDatabase,
} from './connection';
import { DatabaseError, toDatabaseError } from './errors';
import { checkForeignKeys } from './integrity';
import { loadMigrations, type LoadedMigration } from './journal';

const appliedMigrationRowSchema = z.object({
  id: z.string().min(1),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

interface AppliedMigrationRow {
  readonly id: string;
  readonly checksum: string;
}

/** Estado de las migraciones respecto al journal versionado. */
export interface MigrationPlan {
  readonly entries: readonly LoadedMigration[];
  readonly applied: readonly AppliedMigrationRow[];
  readonly pending: readonly LoadedMigration[];
  readonly currentVersion: number;
  readonly targetVersion: number;
}

/**
 * Inspecciona la base y calcula el lote pendiente.
 *
 * Lanza un código estable si la base pertenece a una versión más nueva
 * (`DB_VERSION_AHEAD`), si el estado de `schema_migrations` y `user_version` no
 * es coherente (`DB_MIGRATION_FAILED`) o si una migración aplicada cambió
 * (`DB_MIGRATION_CHECKSUM_MISMATCH`).
 */
export function inspectMigrations(
  database: SqliteDatabase,
  migrationsDir: string,
): MigrationPlan {
  const entries = loadMigrations(migrationsDir);
  const hasMigrationsTable = hasSchemaMigrationsTable(database);

  if (!hasMigrationsTable && hasUserTables(database)) {
    // Una base con tablas propias pero sin registro de migraciones no es
    // nuestra: no se adopta ni se le aplica 0000_init.
    throw new DatabaseError('DB_MIGRATION_FAILED');
  }

  const currentVersion = readUserVersion(database);

  if (currentVersion > entries.length) {
    throw new DatabaseError('DB_VERSION_AHEAD');
  }

  const applied = readAppliedMigrations(database);

  if (applied.length > entries.length) {
    throw new DatabaseError('DB_VERSION_AHEAD');
  }

  if (currentVersion !== applied.length) {
    throw new DatabaseError('DB_MIGRATION_FAILED');
  }

  if (hasMigrationsTable && applied.length === 0) {
    // Una transacción fallida deshace también la creación de la tabla. Una
    // tabla presente y vacía indica un estado manipulado o incompleto.
    throw new DatabaseError('DB_MIGRATION_FAILED');
  }

  applied.forEach((migration, index) => {
    const entry = entries[index];

    if (entry === undefined || migration.id !== entry.tag) {
      throw new DatabaseError('DB_MIGRATION_FAILED');
    }

    if (migration.checksum !== entry.checksum) {
      throw new DatabaseError('DB_MIGRATION_CHECKSUM_MISMATCH');
    }
  });

  return {
    entries,
    applied,
    pending: entries.slice(applied.length),
    currentVersion,
    // `user_version` es el número de migraciones del journal (0000_init => 1),
    // no el prefijo ni el índice de la última etiqueta (0000).
    targetVersion: entries.length,
  };
}

/**
 * Devuelve la versión de esquema que instalaría el journal actual.
 *
 * Se usa para rechazar la restauración de una copia creada por una versión más
 * reciente de la aplicación: `user_version` es el número de migraciones.
 */
export function readTargetSchemaVersion(migrationsDir: string): number {
  return loadMigrations(migrationsDir).length;
}

/**
 * Aplica todas las migraciones pendientes en una sola transacción.
 *
 * Las claves foráneas se desactivan **fuera** de la transacción: una migración
 * que reconstruye una tabla referenciada (por ejemplo `assets`) no puede
 * disparar `RESTRICT`, `SET NULL` ni `CASCADE` al hacer `DROP TABLE`. Antes del
 * commit se ejecuta `PRAGMA foreign_key_check`; cualquier violación revierte el
 * lote completo. En el `finally` se restaura siempre `foreign_keys = ON` y se
 * verifica que quedó activo; si no, el arranque entra en modo seguro.
 *
 * Devuelve cuántas se aplicaron. Si una falla, SQLite revierte el lote entero
 * y se lanza `DB_MIGRATION_FAILED` sin SQL ni mensajes internos.
 */
export function applyPendingMigrations(
  database: SqliteDatabase,
  plan: MigrationPlan,
  options?: { readonly now?: () => number },
): number {
  if (plan.pending.length === 0) {
    return 0;
  }

  if (database.inTransaction) {
    throw new DatabaseError('DB_MIGRATION_FAILED');
  }

  const now = options?.now ?? Date.now;
  let failure: unknown = null;

  try {
    // El pragma no se puede cambiar dentro de una transacción y el runner
    // necesita desactivarlo antes de abrirla. Una conexión sin FKs activas es
    // un estado incoherente para migrar.
    if (database.pragma('foreign_keys', { simple: true }) !== 1) {
      throw new DatabaseError('DB_MIGRATION_FAILED');
    }

    database.pragma('foreign_keys = OFF');

    const applyBatch = database.transaction(() => {
      for (const migration of plan.pending) {
        database.exec(migration.sql);

        // La sentencia se prepara después de aplicar la migración: la primera
        // puede crear `schema_migrations` (0000_init).
        database
          .prepare(
            'INSERT INTO schema_migrations (id, applied_at, checksum) VALUES (?, ?, ?)',
          )
          .run(migration.tag, now(), migration.checksum);
      }

      writeUserVersion(database, plan.targetVersion);

      // Se comprueba antes del commit: si una migración con FKs desactivadas
      // dejó huérfanos, el lote completo se revierte. No se registran tablas
      // ni identificadores.
      if (checkForeignKeys(database).length > 0) {
        throw new DatabaseError('DB_MIGRATION_FAILED');
      }
    });

    applyBatch();
  } catch (error) {
    failure = error;
  } finally {
    try {
      database.pragma('foreign_keys = ON');

      if (database.pragma('foreign_keys', { simple: true }) !== 1) {
        failure ??= new DatabaseError('DB_MIGRATION_FAILED');
      }
    } catch (error) {
      failure ??= error;
    }
  }

  if (failure !== null) {
    throw toDatabaseError(failure, 'DB_MIGRATION_FAILED');
  }

  return plan.pending.length;
}

function hasSchemaMigrationsTable(database: SqliteDatabase): boolean {
  const row = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .get();

  return row !== undefined;
}

/**
 * Detecta tablas de usuario distintas de las internas de SQLite.
 *
 * Se usa solo cuando no existe `schema_migrations`: en ese caso cualquier
 * tabla propia indica una base ajena que no debemos adoptar.
 */
function hasUserTables(database: SqliteDatabase): boolean {
  const row = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1",
    )
    .get();

  return row !== undefined;
}

function readAppliedMigrations(
  database: SqliteDatabase,
): readonly AppliedMigrationRow[] {
  if (!hasSchemaMigrationsTable(database)) {
    return [];
  }

  try {
    const rows = database
      .prepare('SELECT id, checksum FROM schema_migrations ORDER BY id')
      .all() as unknown[];

    return rows.map((row) => appliedMigrationRowSchema.parse(row));
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError('DB_MIGRATION_FAILED', { cause: error });
  }
}
