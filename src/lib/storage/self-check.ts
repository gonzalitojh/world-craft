/**
 * Self-check de almacenamiento para previews y desarrollo.
 *
 * Hace un ciclo completo contra el driver efectivo sin tocar la base de datos:
 * sube un objeto pequeño bajo `_smoke/`, comprueba que una URL sin firma no
 * lee, firma una GET y comprueba que devuelve 200, y borra el objeto. Solo
 * devuelve booleanos; nunca claves, URLs firmadas ni cuerpos.
 *
 * La ruta que lo expone decide si puede existir según `NODE_ENV` y
 * `VERCEL_ENV`; en una preview de Vercel `NODE_ENV` es `production` y el
 * self-check sigue disponible con token.
 */
import { randomUUID } from 'node:crypto';

import type { StorageEnv } from './env';
import type { StorageAdapter } from './types';

/** Prefijo reservado para objetos de diagnóstico. */
export const SELF_CHECK_KEY_PREFIX = '_smoke/';

/** Campos del entorno que deciden si el self-check existe. */
export type SelfCheckEnv = Pick<
  StorageEnv,
  'NODE_ENV' | 'VERCEL_ENV' | 'STORAGE_SMOKE_TOKEN'
>;

/**
 * Indica si el self-check puede responder.
 *
 * Requiere token y se bloquea en producción real. En una preview de Vercel
 * (`VERCEL_ENV === 'preview'`) se permite aunque `NODE_ENV` sea `production`.
 */
export function isSelfCheckEnabled(env: SelfCheckEnv): boolean {
  if (env.STORAGE_SMOKE_TOKEN === undefined) {
    return false;
  }

  return env.NODE_ENV !== 'production' || env.VERCEL_ENV === 'preview';
}

/** Resultado booleano del ciclo de almacenamiento. */
export interface StorageSelfCheckResult {
  uploaded: boolean;
  unsignedRejected: boolean;
  signedRead: boolean;
  deleted: boolean;
}

/** Dependencias del self-check. */
export interface StorageSelfCheckOptions {
  storage: Pick<StorageAdapter, 'upload' | 'getSignedUrl' | 'delete'>;
  /** Cuerpo pequeño del objeto de prueba. */
  body: Uint8Array;
  /** `fetch` inyectable para las pruebas. */
  fetchImpl?: typeof fetch;
  /**
   * Origen con el que resolver URLs locales. La ruta pasa el origen de la
   * petición porque el adaptador local firma contra `localhost:3000`.
   */
  baseUrl?: string;
  /** Clave inyectable para las pruebas. */
  key?: string;
}

/** Sustituye el origen de una URL firmada local por el de la petición. */
function withBaseUrl(url: string, baseUrl: string | undefined): string {
  if (baseUrl === undefined) {
    return url;
  }

  const parsed = new URL(url);
  const base = new URL(baseUrl);

  return new URL(`${parsed.pathname}${parsed.search}`, base).toString();
}

/** Elimina la query de una URL firmada para simular una lectura sin firma. */
function withoutQuery(url: string): string {
  const parsed = new URL(url);
  parsed.search = '';
  return parsed.toString();
}

/** Obtiene el estado HTTP sin lanzar por errores de red. */
async function statusOf(fetchImpl: typeof fetch, url: string): Promise<number> {
  try {
    const response = await fetchImpl(url, { method: 'GET' });
    return response.status;
  } catch {
    return 0;
  }
}

/**
 * Ejecuta el ciclo completo y devuelve solo booleanos.
 *
 * Nunca lanza: los fallos quedan como `false` para que la ruta responda 503
 * sin filtrar detalles del proveedor.
 */
export async function runStorageSelfCheck(
  options: StorageSelfCheckOptions,
): Promise<StorageSelfCheckResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const key = options.key ?? `${SELF_CHECK_KEY_PREFIX}${randomUUID()}.png`;
  const result: StorageSelfCheckResult = {
    uploaded: false,
    unsignedRejected: false,
    signedRead: false,
    deleted: false,
  };

  try {
    await options.storage.upload({
      key,
      body: options.body,
      contentType: 'image/png',
    });
    result.uploaded = true;

    const signedUrl = withBaseUrl(
      await options.storage.getSignedUrl(key, {
        expiresInSeconds: 60,
        operation: 'get',
      }),
      options.baseUrl,
    );

    const unsignedStatus = await statusOf(fetchImpl, withoutQuery(signedUrl));
    result.unsignedRejected =
      unsignedStatus === 400 ||
      unsignedStatus === 403 ||
      unsignedStatus === 404;
    result.signedRead = (await statusOf(fetchImpl, signedUrl)) === 200;
  } catch {
    // Los booleanos que no se hayan marcado quedan en `false`.
  } finally {
    try {
      await options.storage.delete(key);
      result.deleted = true;
    } catch {
      result.deleted = false;
    }
  }

  return result;
}
