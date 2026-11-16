/**
 * Claves de los objetos de un mundo.
 *
 * Formato único: `world/{worldId}/{assetId}.{ext}`, con UUID y una extensión de
 * imagen de la lista permitida. La tabla `assets` impone el mismo prefijo con
 * un `check`; estos helpers evitan que la aplicación construya una clave
 * distinta o peligrosa antes de llegar a la base de datos.
 *
 * Se rechaza cualquier clave con `..`, barras invertidas, rutas absolutas,
 * dobles barras, UUID inválidos o extensiones fuera de la lista. Un prefijo de
 * otro mundo se detecta comparando con el `worldId` esperado.
 */
import { StorageError } from './types';

/** Extensiones de imagen admitidas para los assets de un mundo. */
export const WORLD_ASSET_EXTENSIONS = [
  'avif',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'webp',
] as const;

/** Extensión válida de un asset de mundo. */
export type WorldAssetExtension = (typeof WORLD_ASSET_EXTENSIONS)[number];

/** UUID en minúsculas o mayúsculas. */
const UUID_SOURCE =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_PATTERN = new RegExp(`^${UUID_SOURCE}$`, 'i');

/** Clave completa, con el mundo y el asset capturados. */
const WORLD_ASSET_KEY_PATTERN = new RegExp(
  `^world/(${UUID_SOURCE})/(${UUID_SOURCE})\\.([a-z0-9]+)$`,
  'i',
);

/** Lanza `invalid_key` si el valor no es un UUID. */
function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new StorageError('invalid_key', `${label} no es un UUID válido.`);
  }
}

/** Normaliza una extensión escrita con o sin punto y en cualquier caja. */
function normalizeExtension(extension: string): string {
  return extension.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Construye la clave `world/{worldId}/{assetId}.{ext}`.
 *
 * Lanza `invalid_key` si algún identificador no es un UUID o si la extensión no
 * está permitida.
 */
export function buildWorldAssetKey(
  worldId: string,
  assetId: string,
  extension: string,
): string {
  assertUuid(worldId, 'El mundo');
  assertUuid(assetId, 'El asset');

  const normalized = normalizeExtension(extension);

  if (!WORLD_ASSET_EXTENSIONS.includes(normalized as WorldAssetExtension)) {
    throw new StorageError(
      'invalid_key',
      `Extensión no permitida: «${extension}». Usa ${WORLD_ASSET_EXTENSIONS.join(', ')}.`,
    );
  }

  return `world/${worldId.toLowerCase()}/${assetId.toLowerCase()}.${normalized}`;
}

/**
 * Comprueba si una clave cumple el formato de asset de un mundo.
 *
 * Si se indica `worldId`, además exige que el prefijo sea el de ese mundo.
 */
export function isWorldAssetKey(key: string, worldId?: string): boolean {
  if (
    key.length === 0 ||
    key.length > 512 ||
    key.startsWith('/') ||
    key.includes('\\') ||
    key.includes('..') ||
    key.includes('//')
  ) {
    return false;
  }

  const match = WORLD_ASSET_KEY_PATTERN.exec(key);

  if (!match) {
    return false;
  }

  const [, keyWorldId, , extension] = match;

  if (
    extension === undefined ||
    !WORLD_ASSET_EXTENSIONS.includes(
      extension.toLowerCase() as WorldAssetExtension,
    )
  ) {
    return false;
  }

  return (
    worldId === undefined || keyWorldId?.toLowerCase() === worldId.toLowerCase()
  );
}

/**
 * Valida una clave y la devuelve tal cual para poder encadenar.
 *
 * Lanza `StorageError` con código `invalid_key` si no cumple el formato o si
 * pertenece a otro mundo.
 */
export function assertWorldAssetKey(key: string, worldId?: string): string {
  if (!isWorldAssetKey(key, worldId)) {
    throw new StorageError(
      'invalid_key',
      worldId === undefined
        ? `La clave «${key}» no es un asset de mundo válido.`
        : `La clave «${key}» no pertenece al mundo ${worldId}.`,
    );
  }

  return key;
}
