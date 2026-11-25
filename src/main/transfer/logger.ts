/**
 * Log JSONL de exportación e importación.
 *
 * Registra solo eventos tipados: operación, fase, resultado, código y
 * recuentos. Nunca rutas, IDs, nombres de mundo, contenido del usuario ni
 * mensajes internos. Rota a 256 KiB y un fallo de escritura no interrumpe la
 * operación registrada.
 */
import type {
  TransferErrorCode,
  TransferOperation,
  TransferPhase,
} from '../../shared/contracts/transfer';
import { appendJsonLine } from '../logging/jsonl';
import { TRANSFER_LOG_MAX_BYTES } from './constants';

/** Evento de log de transferencia. */
export type TransferLogEntry =
  | {
      readonly event: 'transfer.operation';
      readonly operation: TransferOperation;
      readonly phase: TransferPhase;
      readonly outcome: 'started' | 'completed' | 'cancelled';
      readonly warnings: number;
    }
  | {
      readonly event: 'transfer.operation';
      readonly operation: TransferOperation;
      readonly phase: TransferPhase;
      readonly outcome: 'failed';
      readonly code: TransferErrorCode;
    }
  | {
      readonly event: 'transfer.cleanup';
      readonly outcome: 'completed' | 'failed';
      readonly removed: number;
    };

/** Logger mínimo de transferencia. */
export interface TransferLogger {
  log(entry: TransferLogEntry): void;
}

/** Opciones del logger; el límite se inyecta en pruebas. */
export interface TransferLoggerOptions {
  readonly maxBytes?: number;
}

/** Crea un logger que añade una línea JSON por evento. */
export function createTransferLogger(
  file: string,
  now: () => number = Date.now,
  options?: TransferLoggerOptions,
): TransferLogger {
  const maxBytes = options?.maxBytes ?? TRANSFER_LOG_MAX_BYTES;

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
export const silentTransferLogger: TransferLogger = { log() {} };
