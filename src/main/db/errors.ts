/**
 * Códigos estables de los fallos de persistencia.
 *
 * El renderer, los diálogos y los logs solo conocen el código: nunca se
 * propaga el mensaje crudo de SQLite, el SQL ejecutado ni rutas del usuario.
 */
export const DATABASE_ERROR_CODES = [
  'DB_OPEN_FAILED',
  'DB_INTEGRITY_FAILED',
  'DB_VERSION_AHEAD',
  'DB_MIGRATION_CHECKSUM_MISMATCH',
  'DB_BACKUP_FAILED',
  'DB_MIGRATION_FAILED',
] as const;

/** Fallo estable de apertura, integridad, copia o migración. */
export type DatabaseErrorCode = (typeof DATABASE_ERROR_CODES)[number];

const DATABASE_ERROR_MESSAGES: Record<DatabaseErrorCode, string> = {
  DB_OPEN_FAILED: 'No se pudo abrir la base de datos local.',
  DB_INTEGRITY_FAILED: 'La comprobación de integridad de la base falló.',
  DB_VERSION_AHEAD:
    'La base de datos pertenece a una versión más reciente de la aplicación.',
  DB_MIGRATION_CHECKSUM_MISMATCH:
    'Una migración aplicada no coincide con el SQL versionado.',
  DB_BACKUP_FAILED: 'No se pudo crear o verificar la copia previa.',
  DB_MIGRATION_FAILED: 'No se pudieron aplicar las migraciones pendientes.',
};

/**
 * Error interno de persistencia. `cause` conserva el detalle técnico para
 * pruebas y diagnóstico local, pero no se escribe en los logs de arranque ni
 * se muestra al usuario.
 */
export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;

  constructor(code: DatabaseErrorCode, options?: { readonly cause?: unknown }) {
    super(DATABASE_ERROR_MESSAGES[code], options);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

/** Normaliza cualquier excepción a un fallo con código estable. */
export function toDatabaseError(
  error: unknown,
  fallbackCode: DatabaseErrorCode,
): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  return new DatabaseError(fallbackCode, { cause: error });
}
