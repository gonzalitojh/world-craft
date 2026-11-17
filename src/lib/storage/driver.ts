/**
 * Selección del driver de almacenamiento y fábrica de adaptadores.
 *
 * Reglas de M0-10 (issue #40):
 * - `STORAGE_DRIVER` explícito manda. Si es `r2`, faltar credenciales es un
 *   error de configuración, no una excusa para caer a disco.
 * - Sin variable explícita: producción usa R2; desarrollo y pruebas usan local
 *   salvo que haya credenciales completas de R2.
 * - **Producción nunca usa local.** Si alguien fuerza el driver local o faltan
 *   credenciales, se lanza `StorageError('unavailable')` y la operación falla
 *   cerrada.
 *
 * No lleva `server-only`: `driver.ts` es la parte pura y testeable; el marcado
 * está en `server.ts`.
 */
import { resolve } from 'node:path';

import {
  assertR2Configured,
  DEFAULT_STORAGE_LOCAL_SECRET_FILE,
  missingR2Variables,
  type ResolvedStorageEnv,
  type StorageDriverName,
} from './env';
import {
  LocalStorageAdapter,
  type LocalStorageAdapterConfig,
} from './local-adapter';
import {
  R2StorageAdapter,
  type R2ClientLike,
  type R2Presigner,
} from './r2-adapter';
import { StorageError, type StorageAdapter } from './types';

/** Configuración equivalente a `LocalStorageAdapterConfig` sin el directorio. */
export interface LocalDriverConfig {
  directory: string;
  secretFile: string;
  secret?: string;
  baseUrl?: string;
}

/**
 * Resuelve el driver efectivo.
 *
 * No lanza: la comprobación de que el driver es válido para el entorno la hace
 * `createStorageAdapter`, que puede devolver un error de dominio.
 */
export function resolveStorageDriverName(
  env: ResolvedStorageEnv,
): StorageDriverName {
  if (env.STORAGE_DRIVER !== undefined) {
    return env.STORAGE_DRIVER;
  }

  if (env.NODE_ENV === 'production') {
    return 'r2';
  }

  return missingR2Variables(env).length === 0 ? 'r2' : 'local';
}

/**
 * Configuración del adaptador local a partir del entorno.
 *
 * El secreto explícito manda; si no hay, `LocalStorageAdapter` leerá o generará
 * `.local/storage-secret`.
 */
export function localStorageConfig(env: ResolvedStorageEnv): LocalDriverConfig {
  return {
    directory: resolve(env.STORAGE_LOCAL_DIR),
    secretFile: resolve(DEFAULT_STORAGE_LOCAL_SECRET_FILE),
    ...(env.STORAGE_LOCAL_BASE_URL === undefined
      ? {}
      : { baseUrl: env.STORAGE_LOCAL_BASE_URL }),
    ...(env.STORAGE_LOCAL_SECRET === undefined
      ? {}
      : { secret: env.STORAGE_LOCAL_SECRET }),
  };
}

/** Opciones de inyección para pruebas. */
export interface StorageFactoryOptions {
  local?: Partial<LocalStorageAdapterConfig>;
  r2Client?: R2ClientLike;
  r2Presigner?: R2Presigner;
}

/**
 * Crea el adaptador que corresponde al entorno.
 *
 * Lanza `StorageError('unavailable')` si la configuración no permite un driver
 * seguro. El mensaje enumera variables, nunca valores.
 */
export function createStorageAdapter(
  env: ResolvedStorageEnv,
  options: StorageFactoryOptions = {},
): StorageAdapter {
  const driver = resolveStorageDriverName(env);

  if (driver === 'local') {
    if (env.NODE_ENV === 'production') {
      throw new StorageError(
        'unavailable',
        'El almacenamiento local está prohibido en producción; configura R2.',
      );
    }

    const config = localStorageConfig(env);

    return new LocalStorageAdapter({
      ...config,
      ...options.local,
      directory: options.local?.directory ?? config.directory,
    });
  }

  const r2 = assertR2Configured(env);

  return new R2StorageAdapter({
    config: r2,
    ...(options.r2Client === undefined ? {} : { client: options.r2Client }),
    ...(options.r2Presigner === undefined
      ? {}
      : { presigner: options.r2Presigner }),
  });
}

/**
 * Crea un adaptador local para la ruta interna, o `undefined` si no aplica.
 *
 * La ruta `/api/storage/local` solo debe existir cuando el driver efectivo es
 * local; en producción devuelve siempre 404.
 */
export function createLocalRouteAdapter(
  env: ResolvedStorageEnv,
  options: Pick<StorageFactoryOptions, 'local'> = {},
): LocalStorageAdapter | undefined {
  if (env.NODE_ENV === 'production') {
    return undefined;
  }

  if (resolveStorageDriverName(env) !== 'local') {
    return undefined;
  }

  const config = localStorageConfig(env);

  return new LocalStorageAdapter({
    ...config,
    ...options.local,
    directory: options.local?.directory ?? config.directory,
  });
}
