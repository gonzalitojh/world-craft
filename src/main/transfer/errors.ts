/**
 * Códigos estables de los fallos de transferencia.
 *
 * Ni el renderer ni los logs reciben rutas, IDs, SQL, nombres de usuario ni
 * mensajes internos del sistema de archivos: solo el código y un texto
 * genérico en español. `cause` conserva el detalle técnico en memoria para las
 * pruebas y el diagnóstico local.
 */
import {
  type TransferErrorCode,
  isTransferErrorCode,
} from '../../shared/contracts/transfer';

const TRANSFER_ERROR_MESSAGES: Record<TransferErrorCode, string> = {
  TRANSFER_INPUT_INVALID: 'Los datos de la transferencia no son válidos.',
  TRANSFER_SOURCE_NOT_FOUND:
    'El mundo de origen no existe o está en la papelera.',
  TRANSFER_SOURCE_UNREADABLE:
    'No se pudo leer el archivo de exportación o la base de datos.',
  TRANSFER_FORMAT_UNSUPPORTED:
    'El archivo no tiene un formato de mundo compatible.',
  TRANSFER_MANIFEST_INVALID: 'El manifiesto del archivo no es válido.',
  TRANSFER_WORLD_INVALID: 'El contenido del mundo no es válido.',
  TRANSFER_LIMIT_EXCEEDED:
    'El archivo supera los límites de tamaño, entradas o contenido.',
  TRANSFER_ENTRY_REJECTED: 'El archivo contiene una entrada no permitida.',
  TRANSFER_CHECKSUM_MISMATCH:
    'Un archivo del paquete no coincide con su checksum.',
  TRANSFER_ASSET_INVALID: 'Una imagen del paquete no es válida.',
  TRANSFER_DESTINATION_UNAVAILABLE:
    'El destino no está disponible o ya está en uso.',
  TRANSFER_NO_SPACE: 'No hay espacio suficiente para completar la operación.',
  TRANSFER_CANCELLED: 'La operación se canceló.',
  TRANSFER_BUSY: 'Ya hay una transferencia en curso.',
  TRANSFER_SAVE_FAILED: 'No se pudo guardar el resultado de la operación.',
  TRANSFER_UNAVAILABLE:
    'La exportación e importación no están disponibles en modo seguro.',
  TRANSFER_INTERNAL: 'La operación falló por un error interno.',
};

/** Error interno de transferencia con código estable. */
export class TransferError extends Error {
  readonly code: TransferErrorCode;

  constructor(code: TransferErrorCode, options?: { readonly cause?: unknown }) {
    super(TRANSFER_ERROR_MESSAGES[code], options);
    this.name = 'TransferError';
    this.code = code;
  }
}

/** Normaliza cualquier excepción a un fallo con código estable. */
export function toTransferError(
  error: unknown,
  fallbackCode: TransferErrorCode = 'TRANSFER_INTERNAL',
): TransferError {
  if (error instanceof TransferError) {
    return error;
  }

  return new TransferError(fallbackCode, { cause: error });
}

/** Indica si un error es una cancelación solicitada por el usuario. */
export function isCancellationError(error: unknown): boolean {
  return error instanceof TransferError && error.code === 'TRANSFER_CANCELLED';
}

/** Convierte un valor desconocido en un código de error estable. */
export function toTransferErrorCode(
  error: unknown,
  fallbackCode: TransferErrorCode = 'TRANSFER_INTERNAL',
): TransferErrorCode {
  if (error instanceof TransferError) {
    return error.code;
  }

  if (isTransferErrorCode(error)) {
    return error;
  }

  return fallbackCode;
}
