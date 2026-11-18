/**
 * Códigos estables de los fallos del servicio de assets.
 *
 * Ni el renderer ni los logs reciben rutas, IDs, SQL ni mensajes internos de
 * sharp o del sistema de archivos: solo el código y un texto genérico en
 * español. `cause` conserva el detalle técnico en memoria para las pruebas y el
 * diagnóstico local.
 */

/** Fallos posibles de importación, rutas, protocolo, purga y almacenamiento. */
export const ASSET_ERROR_CODES = [
  'ASSET_URL_INVALID',
  'ASSET_PATH_INVALID',
  'ASSET_NOT_FOUND',
  'ASSET_UNSUPPORTED_FORMAT',
  'ASSET_UNSUPPORTED_MEDIA_TYPE',
  'ASSET_TOO_LARGE',
  'ASSET_DIMENSIONS_TOO_LARGE',
  'ASSET_IMAGE_INVALID',
  'ASSET_INPUT_INVALID',
  'ASSET_STORAGE_FAILED',
  'ASSET_DATABASE_FAILED',
  'ASSET_PURGE_CONFIRMATION_REQUIRED',
  'ASSET_ORPHAN_BACKUP_FAILED',
] as const;

/** Código estable de fallo de assets. */
export type AssetErrorCode = (typeof ASSET_ERROR_CODES)[number];

const ASSET_ERROR_MESSAGES: Record<AssetErrorCode, string> = {
  ASSET_URL_INVALID: 'La dirección del asset no es válida.',
  ASSET_PATH_INVALID: 'La ruta del asset no es válida.',
  ASSET_NOT_FOUND: 'El asset no existe.',
  ASSET_UNSUPPORTED_FORMAT: 'El formato de la imagen no está admitido.',
  ASSET_UNSUPPORTED_MEDIA_TYPE: 'El tipo de archivo no está admitido.',
  ASSET_TOO_LARGE: 'El archivo supera el tamaño máximo permitido.',
  ASSET_DIMENSIONS_TOO_LARGE:
    'Las dimensiones de la imagen superan el máximo permitido.',
  ASSET_IMAGE_INVALID: 'La imagen está dañada o no se puede leer.',
  ASSET_INPUT_INVALID: 'Los datos del asset no son válidos.',
  ASSET_STORAGE_FAILED: 'No se pudo leer o escribir el archivo del asset.',
  ASSET_DATABASE_FAILED: 'No se pudieron guardar los metadatos del asset.',
  ASSET_PURGE_CONFIRMATION_REQUIRED:
    'La purga de huérfanos exige una confirmación explícita.',
  ASSET_ORPHAN_BACKUP_FAILED:
    'No se pudo crear o verificar la copia de los huérfanos.',
};

/** Error interno del servicio de assets con código estable. */
export class AssetError extends Error {
  readonly code: AssetErrorCode;

  constructor(code: AssetErrorCode, options?: { readonly cause?: unknown }) {
    super(ASSET_ERROR_MESSAGES[code], options);
    this.name = 'AssetError';
    this.code = code;
  }
}

/** Normaliza cualquier excepción a un fallo con código estable. */
export function toAssetError(
  error: unknown,
  fallbackCode: AssetErrorCode,
): AssetError {
  if (error instanceof AssetError) {
    return error;
  }

  return new AssetError(fallbackCode, { cause: error });
}
