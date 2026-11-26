/** Normalización de errores de la biblioteca a códigos DATA_LIBRARY_*. */
import { TransferError } from '../../transfer/errors';
import type { DataErrorCode } from '../constants';
import { DataError } from '../errors';

export function toLibraryError(
  error: unknown,
  fallback: DataErrorCode,
): DataError {
  if (error instanceof DataError) {
    return error;
  }

  if (error instanceof TransferError) {
    switch (error.code) {
      case 'TRANSFER_NO_SPACE':
        return new DataError('DATA_LIBRARY_NO_SPACE', { cause: error });
      case 'TRANSFER_DESTINATION_UNAVAILABLE':
        return new DataError('DATA_LIBRARY_DESTINATION_UNAVAILABLE', {
          cause: error,
        });
      default:
        return new DataError(fallback, { cause: error });
    }
  }

  return new DataError(fallback, { cause: error });
}
