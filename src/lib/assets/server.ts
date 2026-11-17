/**
 * Servicio de assets del servidor.
 *
 * `server-only` garantiza que ni el servicio ni el adaptador acaben en el bundle
 * del cliente. La creación es perezosa: importar este módulo no lee el entorno.
 */
import 'server-only';

import { resolveStorageBucketName, resolveStorageEnv } from '@/lib/storage/env';
import { getStorage } from '@/lib/storage/server';

import { logCleanupError } from './cleanup';
import { createAssetService, type AssetService } from './service';
import { createAssetStore } from './store';

let service: AssetService | undefined;

/** Devuelve el servicio de assets del proceso, creándolo en la primera llamada. */
export function getAssetService(): AssetService {
  if (service === undefined) {
    const env = resolveStorageEnv();

    service = createAssetService({
      storage: getStorage(),
      store: createAssetStore(),
      bucket: resolveStorageBucketName(env),
      onCleanupError: logCleanupError,
    });
  }

  return service;
}
