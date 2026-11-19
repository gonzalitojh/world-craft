/**
 * Log del servicio de assets en JSONL.
 *
 * Registra solo eventos tipados: códigos estables, estados y contadores. No
 * incluye rutas, IDs de asset ni de mundo, ni contenido del usuario. Rota a los
 * 256 KiB y un fallo de escritura nunca rompe la operación registrada.
 */
import { appendJsonLine } from '../logging/jsonl';
import { ASSET_LOG_MAX_BYTES } from './constants';
import type { AssetErrorCode } from './errors';

/** Eventos que puede registrar el servicio. */
export type AssetLogEntry =
  | {
      readonly event: 'asset.import';
      readonly outcome: 'created';
    }
  | {
      readonly event: 'asset.import';
      readonly outcome: 'rejected';
      readonly code: AssetErrorCode;
    }
  | {
      readonly event: 'asset.request';
      readonly outcome: 'served';
      readonly status: 200;
    }
  | {
      readonly event: 'asset.request';
      readonly outcome: 'rejected';
      readonly status: number;
      readonly code: AssetErrorCode;
    }
  | {
      readonly event: 'asset.orphans';
      readonly outcome: 'purged';
      readonly files: number;
    }
  | {
      readonly event: 'asset.orphans';
      readonly outcome: 'aborted';
      readonly code: AssetErrorCode;
    }
  | {
      readonly event: 'asset.paths';
      readonly outcome: 'invalid';
      readonly count: number;
    };

/** Logger mínimo del servicio de assets. */
export interface AssetLogger {
  log(entry: AssetLogEntry): void;
}

export interface AssetLoggerOptions {
  /** Límite de rotación; se inyecta en pruebas. */
  readonly maxBytes?: number;
}

/** Crea un logger que añade una línea JSON por evento. */
export function createAssetLogger(
  file: string,
  now: () => number = Date.now,
  options?: AssetLoggerOptions,
): AssetLogger {
  const maxBytes = options?.maxBytes ?? ASSET_LOG_MAX_BYTES;

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
export const silentAssetLogger: AssetLogger = { log() {} };
