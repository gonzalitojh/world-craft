/**
 * Comprobación de integridad de SQLite.
 *
 * Se ejecuta al arrancar, después de migrar y tras un fallo. Los mensajes de
 * SQLite se conservan solo en memoria para el diagnóstico interno; nunca se
 * escriben en el log de arranque ni se muestran al usuario.
 */
import { closeDatabase, openDatabase, type SqliteDatabase } from './connection';
import { DatabaseError, toDatabaseError } from './errors';

/** Resultado de `PRAGMA integrity_check`. */
export interface IntegrityCheckResult {
  readonly ok: boolean;
  readonly messages: readonly string[];
}

/** Violación de clave foránea normalizada. */
export interface ForeignKeyViolation {
  readonly table: string;
  readonly rowId: number;
  readonly parent: string;
  readonly foreignKeyId: number;
}

/** Ejecuta `PRAGMA integrity_check` y normaliza su resultado. */
export function checkIntegrity(database: SqliteDatabase): IntegrityCheckResult {
  try {
    const rows = database.pragma('integrity_check');
    const messages = Array.isArray(rows)
      ? rows.flatMap((row) => extractStrings(row))
      : extractStrings(rows);

    return {
      ok: messages.length === 1 && messages[0] === 'ok',
      messages,
    };
  } catch (error) {
    throw toDatabaseError(error, 'DB_INTEGRITY_FAILED');
  }
}

/** Abre una conexión de solo lectura y comprueba la integridad del archivo. */
export function checkIntegrityReadonly(file: string): IntegrityCheckResult {
  const database = openDatabase({ file, readonly: true });

  try {
    return checkIntegrity(database);
  } finally {
    closeDatabase(database);
  }
}

/** Lanza `DB_INTEGRITY_FAILED` si la comprobación no devuelve `ok`. */
export function assertIntegrity(database: SqliteDatabase): void {
  if (!checkIntegrity(database).ok) {
    throw new DatabaseError('DB_INTEGRITY_FAILED');
  }
}

/**
 * Ejecuta `PRAGMA foreign_key_check` y normaliza las violaciones.
 *
 * Devuelve solo filas con forma conocida. El llamador no debe registrar ni
 * mostrar tablas, rowids o identificadores: el detalle es para diagnóstico en
 * memoria y la decisión pública es un código estable.
 */
export function checkForeignKeys(
  database: SqliteDatabase,
): readonly ForeignKeyViolation[] {
  try {
    const rows = database.pragma('foreign_key_check');

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row) => {
      if (row === null || typeof row !== 'object') {
        throw new DatabaseError('DB_INTEGRITY_FAILED');
      }

      const record = row as Record<string, unknown>;
      const { table, rowid, parent, fkid } = record;

      if (
        typeof table !== 'string' ||
        typeof rowid !== 'number' ||
        !Number.isInteger(rowid) ||
        typeof parent !== 'string' ||
        typeof fkid !== 'number' ||
        !Number.isInteger(fkid)
      ) {
        throw new DatabaseError('DB_INTEGRITY_FAILED');
      }

      return { table, rowId: rowid, parent, foreignKeyId: fkid };
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }

    throw toDatabaseError(error, 'DB_INTEGRITY_FAILED');
  }
}

function extractStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (value !== null && typeof value === 'object') {
    return Object.values(value).filter(
      (entry): entry is string => typeof entry === 'string',
    );
  }

  return [];
}
