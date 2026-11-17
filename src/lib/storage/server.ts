/**
 * Punto de entrada de almacenamiento para el servidor.
 *
 * `server-only` impide que un componente cliente importe el adaptador o las
 * claves. La creación es perezosa: importar este módulo no lee el entorno ni
 * construye el cliente S3, así que `next build` funciona sin credenciales.
 *
 * El adaptador se guarda en un singleton por proceso. En serverless cada
 * instancia tiene el suyo, que es exactamente lo que interesa.
 */
import 'server-only';

import { createLocalRouteAdapter, createStorageAdapter } from './driver';
import { resolveStorageEnv } from './env';
import type { LocalStorageAdapter } from './local-adapter';
import type { StorageAdapter } from './types';

let adapter: StorageAdapter | undefined;

/** Devuelve el adaptador efectivo del proceso, creándolo en la primera llamada. */
export function getStorage(): StorageAdapter {
  adapter ??= createStorageAdapter(resolveStorageEnv());
  return adapter;
}

/**
 * Adaptador local para `/api/storage/local`, o `undefined` si la ruta no debe
 * existir en este entorno.
 */
export function getLocalRouteAdapter(): LocalStorageAdapter | undefined {
  return createLocalRouteAdapter(resolveStorageEnv());
}

/** Descarta el singleton; lo usan las pruebas y los scripts. */
export function resetStorage(): void {
  adapter = undefined;
}
