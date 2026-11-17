/**
 * Firma HMAC de las URLs del adaptador local.
 *
 * En desarrollo y en las pruebas no hay R2: el adaptador local firma URLs
 * apuntando a `/api/storage/local/{clave}` con un HMAC-SHA256 cuyo secreto vive
 * en `.local/storage-secret` (ignorado por git). La ruta `/api/storage/local`
 * solo responde en desarrollo/test; en producción devuelve 404.
 *
 * La firma cubre operación, caducidad y clave, con un prefijo de versión para
 * poder rotar el formato sin ambigüedad. La comparación es en tiempo constante.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Origen con el que se construyen las URLs locales. */
export const LOCAL_STORAGE_BASE_URL = 'http://localhost:3000';

/** Operaciones que admite una URL local firmada. */
export type LocalStorageOperation = 'get' | 'put';

/** Prefijo de versión de la firma. */
const SIGNATURE_VERSION = 'v1';

/** Comprueba que la operación sea una de las admitidas. */
export function isLocalStorageOperation(
  value: string,
): value is LocalStorageOperation {
  return value === 'get' || value === 'put';
}

/** Cadena canónica que se firma. */
function canonicalPayload(
  key: string,
  operation: LocalStorageOperation,
  expiresAt: number,
): string {
  return [SIGNATURE_VERSION, operation, String(expiresAt), key].join('\n');
}

/** Firma una petición local y devuelve el HMAC en hexadecimal. */
export function signLocalStorageRequest(params: {
  key: string;
  operation: LocalStorageOperation;
  expiresAt: number;
  secret: string;
}): string {
  return createHmac('sha256', params.secret)
    .update(canonicalPayload(params.key, params.operation, params.expiresAt))
    .digest('hex');
}

/**
 * Verifica una firma local caducada o manipulada.
 *
 * Devuelve el motivo para que la ruta pueda responder 403 sin distinguir entre
 * «firma mala» y «caducada» en el cuerpo.
 */
export type LocalSignatureCheck = 'ok' | 'expired' | 'invalid';

/**
 * Verifica una firma en tiempo constante.
 *
 * `nowMs` se inyecta para que las pruebas controlen la caducidad.
 */
export function verifyLocalStorageSignature(params: {
  key: string;
  operation: LocalStorageOperation;
  expiresAt: number;
  signature: string;
  secret: string;
  nowMs?: number;
}): LocalSignatureCheck {
  if (
    !Number.isInteger(params.expiresAt) ||
    !/^[0-9a-f]{64}$/i.test(params.signature)
  ) {
    return 'invalid';
  }

  const expected = Buffer.from(signLocalStorageRequest(params), 'hex');
  const provided = Buffer.from(params.signature, 'hex');

  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return 'invalid';
  }

  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);

  if (params.expiresAt <= nowSeconds) {
    return 'expired';
  }

  return 'ok';
}

/**
 * Construye la URL firmada de una clave local.
 *
 * La ruta codifica cada segmento por separado para que los `/` sigan siendo
 * separadores y ninguna clave pueda inyectar una ruta distinta.
 */
export function buildLocalStorageUrl(params: {
  key: string;
  operation: LocalStorageOperation;
  expiresInSeconds: number;
  secret: string;
  baseUrl?: string;
  nowMs?: number;
}): string {
  const expiresAt =
    Math.floor((params.nowMs ?? Date.now()) / 1000) + params.expiresInSeconds;
  const signature = signLocalStorageRequest({
    key: params.key,
    operation: params.operation,
    expiresAt,
    secret: params.secret,
  });
  const path = params.key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const query = new URLSearchParams({
    operation: params.operation,
    expires: String(expiresAt),
    sig: signature,
  });

  return `${params.baseUrl ?? LOCAL_STORAGE_BASE_URL}/api/storage/local/${path}?${query.toString()}`;
}
