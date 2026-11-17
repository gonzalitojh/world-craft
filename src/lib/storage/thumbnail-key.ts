/**
 * Clave de la miniatura de un asset.
 *
 * Decisión D2 de M0-10 (issue #40): la miniatura **no ocupa fila** en `assets`.
 * Su clave se deriva del identificador del asset con UUIDv5, así que es estable,
 * no colisiona con ningún asset real y se puede borrar o regenerar sin tocar la
 * base de datos.
 *
 * Formato: `world/{worldId}/{thumbnailUuid}.webp`, donde
 * `thumbnailUuid = UUIDv5(namespace, assetId)`. La clave pasa
 * `assertWorldAssetKey`, de modo que comparte la misma validación y el mismo
 * prefijo que el objeto principal.
 */
import { createHash } from 'node:crypto';

import { assertWorldAssetKey, buildWorldAssetKey } from './asset-key';
import { StorageError } from './types';

/**
 * Namespace UUIDv5 de las miniaturas de World Craft.
 *
 * Es un UUID fijo y documentado: cambiarlo invalida todas las miniaturas
 * existentes. No es un secreto, solo una etiqueta de dominio.
 */
export const THUMBNAIL_NAMESPACE = '6f1c2a3e-9b47-5d8a-8f0e-2c4b6a8d0e1f';

/** UUID con grupos de 8-4-4-4-12. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Convierte un UUID canónico en sus 16 bytes. */
function uuidToBytes(value: string): Buffer {
  if (!UUID_PATTERN.test(value)) {
    throw new StorageError('invalid_key', `«${value}» no es un UUID válido.`);
  }

  return Buffer.from(value.replaceAll('-', ''), 'hex');
}

/** Formatea 16 bytes como UUID canónico en minúsculas. */
function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Calcula el UUIDv5 de `assetId` con el namespace de miniaturas.
 *
 * Implementación directa de RFC 4122 §4.3 (SHA-1): Node no incluye `uuidv5` y
 * una dependencia entera no se justifica para 15 líneas.
 */
export function thumbnailUuid(assetId: string): string {
  const namespace = uuidToBytes(THUMBNAIL_NAMESPACE);
  const name = uuidToBytes(assetId);
  const digest = createHash('sha1').update(namespace).update(name).digest();

  // Versión 5 (SHA-1) y variante RFC 4122.
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;

  return bytesToUuid(digest.subarray(0, 16));
}

/**
 * Construye la clave de miniatura de un asset de mundo.
 *
 * Lanza `invalid_key` si el mundo o el asset no son UUID. La clave resultante
 * pasa `assertWorldAssetKey` y pertenece al mismo mundo que el asset.
 */
export function buildThumbnailKey(worldId: string, assetId: string): string {
  return assertWorldAssetKey(
    buildWorldAssetKey(worldId, thumbnailUuid(assetId), 'webp'),
    worldId,
  );
}
