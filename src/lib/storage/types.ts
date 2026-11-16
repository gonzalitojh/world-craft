/**
 * Contrato de almacenamiento de objetos de World Craft.
 *
 * La implementación real (Cloudflare R2) llega con M0-10 (issue #40); aquí solo
 * se fija el contrato que usarán las subidas, las URLs firmadas y la limpieza
 * de huérfanos. Mantenerlo estable permite cerrar el modelo de `assets` y su
 * RLS sin configurar ningún bucket.
 *
 * Reglas:
 * - El bucket es **privado**: nunca se devuelve una URL pública, solo firmada.
 * - Las URLs firmadas caducan como máximo en una hora
 *   (`MAX_SIGNED_URL_EXPIRY_SECONDS`).
 * - Los errores son de dominio (`StorageError`), no de proveedor: la interfaz
 *   traduce `not_found`, `invalid_key`, `invalid_expiry` y `unavailable` sin
 *   conocer R2.
 */
export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  etag?: string;
  lastModified?: Date;
}

export interface StorageUploadInput {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}

export interface StorageListOptions {
  cursor?: string;
  limit?: number;
}

export interface StorageSignedUrlOptions {
  /** Segundos de validez de la URL. Máximo 3600. */
  expiresInSeconds: number;
  operation: 'get' | 'put';
}

export interface StorageListResult {
  objects: StorageObject[];
  cursor?: string;
}

export interface StorageAdapter {
  upload(input: StorageUploadInput): Promise<StorageObject>;
  getSignedUrl(key: string, options: StorageSignedUrlOptions): Promise<string>;
  delete(key: string): Promise<void>;
  list(
    prefix: string,
    options?: StorageListOptions,
  ): Promise<StorageListResult>;
}

/** Caducidad máxima admitida para una URL firmada: una hora. */
export const MAX_SIGNED_URL_EXPIRY_SECONDS = 3600;

/** Códigos de error estables del dominio de almacenamiento. */
export type StorageErrorCode =
  'not_found' | 'invalid_key' | 'invalid_expiry' | 'unavailable';

/**
 * Error de almacenamiento con un código estable.
 *
 * La capa de interfaz decide el mensaje en español a partir del código; el
 * mensaje técnico queda para logs y pruebas. No se propaga nunca la respuesta
 * del proveedor tal cual.
 */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageError';
    this.code = code;
  }
}

/**
 * Comprueba que una caducidad de URL firmada sea válida.
 *
 * Debe ser un entero entre 1 y `MAX_SIGNED_URL_EXPIRY_SECONDS`. Lanza
 * `invalid_expiry` para que un adaptador no pueda firmar una URL de un día por
 * error.
 */
export function assertValidExpiry(expiresInSeconds: number): void {
  if (
    !Number.isInteger(expiresInSeconds) ||
    expiresInSeconds < 1 ||
    expiresInSeconds > MAX_SIGNED_URL_EXPIRY_SECONDS
  ) {
    throw new StorageError(
      'invalid_expiry',
      `Caducidad de URL firmada no válida: ${expiresInSeconds}. Debe ser un entero entre 1 y ${MAX_SIGNED_URL_EXPIRY_SECONDS} segundos.`,
    );
  }
}
