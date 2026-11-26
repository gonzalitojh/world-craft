/**
 * Errores estables del servicio de datos.
 *
 * El renderer y los logs solo reciben un código `DATA_*` y un mensaje genérico.
 * Ninguna ruta, nombre de mundo, SQL ni detalle del sistema de archivos llega al
 * mensaje; `cause` conserva el detalle en memoria para diagnóstico local.
 */
import type { DataErrorCode } from '../../shared/contracts/data';

export type { DataErrorCode } from '../../shared/contracts/data';

const DATA_ERROR_MESSAGES: Record<DataErrorCode, string> = {
  DATA_UNAVAILABLE:
    'Los datos de la aplicación no están disponibles en este momento.',
  DATA_BUSY: 'Ya hay una operación de datos en curso.',
  DATA_FOLDER_INVALID: 'La carpeta solicitada no es válida.',
  DATA_FOLDER_OPEN_FAILED: 'No se pudo abrir la carpeta solicitada.',
  DATA_COUNTS_FAILED: 'No se pudieron contar los datos de la aplicación.',
  DATA_ORPHAN_CONFIRMATION_REQUIRED:
    'La purga de imágenes huérfanas exige una confirmación explícita.',
  DATA_ORPHAN_PLAN_FAILED:
    'No se pudo revisar las imágenes huérfanas de la aplicación.',
  DATA_ORPHAN_PURGE_FAILED: 'No se pudieron eliminar las imágenes huérfanas.',
  DATA_LIBRARY_INPUT_INVALID:
    'Los datos de la exportación de la biblioteca no son válidos.',
  DATA_LIBRARY_ENTRY_INVALID:
    'La biblioteca contiene una entrada no permitida.',
  DATA_LIBRARY_MANIFEST_INVALID: 'El manifiesto de la biblioteca no es válido.',
  DATA_LIBRARY_SETTINGS_INVALID:
    'Los ajustes incluidos en la biblioteca no son válidos.',
  DATA_LIBRARY_WORLD_FAILED:
    'No se pudo exportar uno de los mundos de la biblioteca.',
  DATA_LIBRARY_DATABASE_FAILED:
    'No se pudo crear o verificar la copia de la base de datos.',
  DATA_LIBRARY_VERIFY_FAILED:
    'La biblioteca no pasó la verificación posterior.',
  DATA_LIBRARY_CREATE_FAILED:
    'No se pudo escribir el archivo de la biblioteca.',
  DATA_LIBRARY_NO_SPACE:
    'No hay espacio suficiente para exportar la biblioteca.',
  DATA_LIBRARY_DESTINATION_UNAVAILABLE:
    'El destino de la biblioteca no está disponible.',
  DATA_DELETE_CONFIRMATION_REQUIRED:
    'El borrado total exige una confirmación explícita.',
  DATA_DELETE_ROOT_INVALID:
    'Una carpeta de datos no es válida y no se puede borrar con seguridad.',
  DATA_DELETE_COPY_FAILED:
    'No se pudo crear o verificar la copia previa al borrado.',
  DATA_DELETE_FAILED: 'No se pudieron eliminar todos los datos.',
};

/** Error interno del servicio de datos con código estable. */
export class DataError extends Error {
  readonly code: DataErrorCode;

  constructor(code: DataErrorCode, options?: { readonly cause?: unknown }) {
    super(DATA_ERROR_MESSAGES[code], options);
    this.name = 'DataError';
    this.code = code;
  }
}

/** Normaliza cualquier excepción a un fallo con código estable. */
export function toDataError(
  error: unknown,
  fallbackCode: DataErrorCode,
): DataError {
  if (error instanceof DataError) {
    return error;
  }

  return new DataError(fallbackCode, { cause: error });
}
