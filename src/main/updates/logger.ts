/**
 * Log JSONL del actualizador.
 *
 * Solo admite eventos tipados: sin URLs, sin rutas, sin versiones, sin
 * mensajes crudos y sin contenido del usuario. Rota a los 256 KiB y un fallo
 * de escritura nunca interrumpe la comprobación ni la descarga.
 */
import { appendJsonLine } from '../logging/jsonl';
import type { UpdateUnavailableReason } from '../../shared/contracts/updates';

/** Tamaño máximo antes de rotar el log del actualizador. */
export const UPDATE_LOG_MAX_BYTES = 256 * 1024;

/** Eventos que puede registrar el servicio. */
export type UpdateLogEntry =
  | {
      readonly event: 'update.composition';
      readonly outcome: 'enabled';
    }
  | {
      readonly event: 'update.composition';
      readonly outcome: 'disabled';
      readonly reason: UpdateUnavailableReason;
    }
  | {
      readonly event: 'update.check';
      readonly outcome:
        | 'started'
        | 'up-to-date'
        | 'available'
        | 'cancelled'
        | 'timeout'
        | 'failed';
    }
  | {
      readonly event: 'update.download';
      readonly outcome: 'started' | 'completed' | 'cancelled' | 'failed';
    }
  | {
      readonly event: 'update.install';
      readonly outcome: 'started' | 'failed';
    }
  | {
      readonly event: 'update.command';
      readonly outcome: 'rejected';
    };

/** Logger mínimo del actualizador. */
export interface UpdateLogger {
  log(entry: UpdateLogEntry): void;
}

export interface UpdateLoggerOptions {
  /** Límite de rotación; se inyecta en pruebas. */
  readonly maxBytes?: number;
}

/** Crea un logger que añade una línea JSON por evento. */
export function createUpdateLogger(
  file: string,
  now: () => number = Date.now,
  options?: UpdateLoggerOptions,
): UpdateLogger {
  const maxBytes = options?.maxBytes ?? UPDATE_LOG_MAX_BYTES;

  return {
    log(entry) {
      appendJsonLine(file, maxBytes, {
        timestamp: new Date(now()).toISOString(),
        ...entry,
      });
    },
  };
}

/** Logger que no escribe nada; se usa cuando el diagnóstico no aplica. */
export const silentUpdateLogger: UpdateLogger = { log() {} };
