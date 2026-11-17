/**
 * Almacenamiento de objetos: contrato y claves.
 *
 * Solo se exportan tipos y funciones puras. La implementación de Cloudflare R2
 * llega con M0-10 (issue #40) y no debe cambiar este contrato.
 */
export {
  assertValidExpiry,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
  StorageError,
} from './types';
export type {
  StorageAdapter,
  StorageDownloadOptions,
  StorageErrorCode,
  StorageListOptions,
  StorageListResult,
  StorageObject,
  StorageSignedUrlOptions,
  StorageUploadInput,
} from './types';
export {
  assertWorldAssetKey,
  buildWorldAssetKey,
  isWorldAssetKey,
  WORLD_ASSET_EXTENSIONS,
} from './asset-key';
export type { WorldAssetExtension } from './asset-key';
