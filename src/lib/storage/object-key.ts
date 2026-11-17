/**
 * Validación de claves de objeto para los adaptadores reales.
 *
 * Es más estricta que `asset-key.ts` a propósito: el adaptador recibe también
 * claves internas (temporales de subida, miniaturas) y no debe aceptar rutas
 * que escapen del prefijo o que un sistema de archivos interprete distinto.
 *
 * No conoce ni el proveedor ni el disco: es una función pura reutilizada por el
 * adaptador local y el de R2.
 */
import { StorageError } from './types';

/** Longitud máxima de una clave (límite de S3 y del contrato). */
export const MAX_STORAGE_KEY_LENGTH = 512;

/** Comprueba caracteres de control, barra invertida o dos puntos de unidad. */
function hasUnsafeCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);

    return (
      code <= 0x1f || code === 0x7f || character === '\\' || character === ':'
    );
  });
}

/**
 * Valida una clave de objeto y la devuelve tal cual.
 *
 * Rechaza: cadena vacía, longitud excesiva, `/` inicial o final, doble barra,
 * barras invertidas, NUL/controles, `:` de unidad de Windows y segmentos `.` o
 * `..`.
 */
export function assertSafeStorageObjectKey(key: string): string {
  if (
    key.length === 0 ||
    key.length > MAX_STORAGE_KEY_LENGTH ||
    key.startsWith('/') ||
    key.endsWith('/') ||
    hasUnsafeCharacter(key) ||
    key.includes('//')
  ) {
    throw new StorageError(
      'invalid_key',
      `La clave «${key}» no es una clave de objeto segura.`,
    );
  }

  for (const segment of key.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new StorageError(
        'invalid_key',
        `La clave «${key}» contiene un segmento no permitido.`,
      );
    }
  }

  return key;
}

/**
 * Valida un prefijo de listado.
 *
 * Admite la cadena vacía y un `/` final; el resto sigue las reglas de una clave.
 */
export function assertSafeStoragePrefix(prefix: string): string {
  if (prefix === '') {
    return prefix;
  }

  if (prefix.endsWith('/')) {
    assertSafeStorageObjectKey(prefix.slice(0, -1));
    return prefix;
  }

  return assertSafeStorageObjectKey(prefix);
}
