/**
 * Log de arranque en JSONL.
 *
 * Solo admite eventos tipados con códigos estables, versiones y contadores. No
 * hay campo libre para mensajes: así es imposible que se cuelen SQL, filas,
 * rutas absolutas o mensajes crudos de SQLite. Rota a los 256 KiB y ningún
 * fallo de escritura impide arrancar.
 */
import type { RestoreErrorCode, RestoreFailureReason } from '../backup/restore';
import type { BackupFailureReason } from '../backup/verify';
import { appendJsonLine } from '../logging/jsonl';
import type { DatabaseErrorCode } from './errors';

/** Tamaño máximo antes de rotar el log de arranque. */
export const STARTUP_LOG_MAX_BYTES = 256 * 1024;

export type StartupLogIntegrity = 'ok' | 'failed' | 'unknown';

export type StartupLogEntry =
  | {
      readonly event: 'database.startup';
      readonly outcome: 'ready';
      readonly schemaVersion: number;
      readonly appliedMigrations: number;
      readonly newDatabase: boolean;
      readonly backupCreated: boolean;
      readonly integrity: 'ok';
    }
  | {
      readonly event: 'database.startup';
      readonly outcome: 'safe-mode';
      readonly code: DatabaseErrorCode;
      readonly schemaVersion: number | null;
      readonly integrity: StartupLogIntegrity;
    }
  | {
      readonly event: 'database.backup';
      readonly outcome: 'created';
      readonly schemaVersion: number;
    }
  | {
      readonly event: 'database.migrations';
      readonly outcome: 'applied';
      readonly count: number;
      readonly schemaVersion: number;
    }
  | {
      readonly event: 'backup.schedule';
      readonly outcome: 'created';
      readonly daily: boolean;
      readonly weekly: boolean;
      readonly monthly: boolean;
      readonly pruned: number;
    }
  | {
      readonly event: 'backup.schedule';
      readonly outcome: 'skipped';
    }
  | {
      readonly event: 'backup.schedule';
      readonly outcome: 'failed';
      readonly reason: BackupFailureReason;
      readonly created: number;
      readonly failed: number;
      readonly pruned: number;
    }
  | {
      readonly event: 'backup.restore';
      readonly outcome: 'restored';
      readonly schemaVersion: number;
    }
  | {
      readonly event: 'backup.restore';
      readonly outcome: 'failed';
      readonly code: RestoreErrorCode;
      readonly reason: RestoreFailureReason;
    };

/** Logger mínimo del arranque. */
export interface StartupLogger {
  log(entry: StartupLogEntry): void;
}

export interface StartupLoggerOptions {
  /** Límite de rotación; se inyecta en pruebas. */
  readonly maxBytes?: number;
}

/** Crea un logger que añade una línea JSON por evento. */
export function createStartupLogger(
  file: string,
  now: () => number = Date.now,
  options?: StartupLoggerOptions,
): StartupLogger {
  const maxBytes = options?.maxBytes ?? STARTUP_LOG_MAX_BYTES;

  return {
    log(entry) {
      appendJsonLine(file, maxBytes, {
        timestamp: new Date(now()).toISOString(),
        ...entry,
      });
    },
  };
}
