/**
 * Errores de dominio de assets.
 *
 * La interfaz (M1-03) traducirá el código a un mensaje en español; el mensaje
 * técnico queda para logs y pruebas. Las capas de almacenamiento y base de datos
 * no exponen errores crudos del proveedor.
 */
export type AssetErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'unsupported_type'
  | 'too_large'
  | 'invalid_image'
  | 'storage_unavailable';

export class AssetError extends Error {
  readonly code: AssetErrorCode;

  constructor(code: AssetErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AssetError';
    this.code = code;
  }
}
