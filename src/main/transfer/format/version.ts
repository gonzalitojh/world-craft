/**
 * Comprobación temprana de la versión del formato.
 *
 * Los esquemas Zod exigen `formatVersion: 1`, pero un archivo creado por una
 * versión futura merece un error específico que invite a actualizar la
 * aplicación. La inspección se hace antes del parse estricto y solo cuando el
 * identificador de formato coincide; si no coincide, el error sigue siendo el
 * genérico del manifiesto o del mundo.
 */
import {
  TRANSFER_FORMAT,
  TRANSFER_FORMAT_VERSION,
} from '../../../shared/contracts/transfer';
import { TransferError } from '../errors';

/** Lanza `TRANSFER_FORMAT_UNSUPPORTED` si el JSON es de una versión futura. */
export function assertSupportedTransferFormat(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return;
  }

  const record = value as Record<string, unknown>;

  if (record.format !== TRANSFER_FORMAT) {
    return;
  }

  const version = record.formatVersion;

  if (
    typeof version === 'number' &&
    Number.isInteger(version) &&
    version > TRANSFER_FORMAT_VERSION
  ) {
    throw new TransferError('TRANSFER_FORMAT_UNSUPPORTED');
  }
}
