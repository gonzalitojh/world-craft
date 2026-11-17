/**
 * Servicio de assets: subida directa firmada, finalización, descarga y borrado.
 *
 * Decisión D1 de M0-10 (issue #40): el navegador sube el archivo **directo a
 * R2** con un PUT firmado de corta duración; el servidor nunca recibe el cuerpo
 * por una Server Action (el límite de Vercel impediría los 10 MB). Después,
 * `finalizeUpload` descarga el temporal, valida y procesa con sharp, publica el
 * WebP y su miniatura, inserta los metadatos y limpia el temporal.
 *
 * Reglas:
 * - El actor viaja explícito (`{ userId }`); M1-01 lo sacará de la cookie.
 * - No miembro ⇒ `not_found` para no revelar la existencia de mundos ajenos.
 * - Viewer ⇒ `forbidden` para escrituras; owner y editor escriben.
 * - `finalizeUpload` **no es idempotente**: una segunda llamada no encuentra el
 *   temporal y devuelve `not_found`. Si la inserción falla, se busca la fila
 *   existente antes de compensar: un reintento tras un fallo de limpieza no
 *   debe borrar objetos que la fila ya referencia.
 * - El borrado elimina primero la fila y después los objetos. Si R2 falla, se
 *   registra el huérfano y la operación devuelve éxito: la fila ya no existe y
 *   el lifecycle acabará limpiando.
 */
import { randomUUID } from 'node:crypto';

import {
  buildWorldAssetKey,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
  StorageError,
  type StorageAdapter,
} from '@/lib/storage';
import { assertSafeStorageObjectKey } from '@/lib/storage/object-key';
import { buildThumbnailKey } from '@/lib/storage/thumbnail-key';

import { AssetError } from './errors';
import { processAssetImage, type ProcessedImage } from './image';
import {
  DEFAULT_LIST_LIMIT,
  DOWNLOAD_URL_EXPIRY_SECONDS,
  isAllowedInputMime,
  MAX_ALT_LENGTH,
  MAX_ASSET_BYTES,
  MAX_LIST_LIMIT,
  TEMP_UPLOAD_EXTENSION,
  UPLOAD_URL_EXPIRY_SECONDS,
} from './limits';
import { canReadAssets, canWriteAssets } from './policy';
import {
  encodeAssetCursor,
  type AssetListOptions,
  type AssetRecord,
  type AssetStore,
  type NewAssetRecord,
} from './store';

/** Identidad mínima que autoriza una operación. */
export interface AssetActor {
  userId: string;
}

/** Dependencias y puntos de inyección del servicio. */
export interface AssetServiceDeps {
  storage: StorageAdapter;
  store: AssetStore;
  /** Bucket que se guarda en los metadatos y con el que se firma. */
  bucket: string;
  /** Pipeline de imagen inyectable para pruebas. */
  processImage?: (input: Uint8Array) => Promise<ProcessedImage>;
  /** Generador de ids inyectable para pruebas. */
  createId?: () => string;
  /** Hook para registrar objetos que no se pudieron borrar. */
  onCleanupError?: (event: { key: string; error: unknown }) => void;
}

/** Petición de una URL de subida directa. */
export interface RequestUploadInput {
  worldId: string;
  contentType: string;
  size: number;
}

/** Ticket de subida que recibe el cliente. */
export interface UploadTicket {
  assetId: string;
  worldId: string;
  key: string;
  uploadUrl: string;
  expiresInSeconds: number;
  maxBytes: number;
}

/** Datos para finalizar una subida. */
export interface FinalizeUploadInput {
  worldId: string;
  assetId: string;
  alt?: string;
}

/** Resultado de pedir una URL de descarga. */
export interface DownloadTicket {
  url: string;
  expiresInSeconds: number;
  asset: AssetRecord;
  thumbnailUrl?: string;
}

/** Página de assets. */
export interface AssetPage {
  assets: AssetRecord[];
  nextCursor?: string;
}

/** API del servicio. */
export interface AssetService {
  requestUpload(
    actor: AssetActor,
    input: RequestUploadInput,
  ): Promise<UploadTicket>;
  finalizeUpload(
    actor: AssetActor,
    input: FinalizeUploadInput,
  ): Promise<AssetRecord>;
  getDownloadUrl(
    actor: AssetActor,
    input: { worldId: string; assetId: string; expiresInSeconds?: number },
  ): Promise<DownloadTicket>;
  deleteAsset(
    actor: AssetActor,
    input: { worldId: string; assetId: string },
  ): Promise<{ id: string }>;
  listAssets(
    actor: AssetActor,
    input: { worldId: string } & AssetListOptions,
  ): Promise<AssetPage>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Exige un UUID con `invalid_input`. */
function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new AssetError('invalid_input', `${label} debe ser un UUID.`);
  }
}

/**
 * Clave del objeto temporal de una subida directa.
 *
 * Vive bajo `tmp/` para que el lifecycle de R2 pueda purgar temporales sin
 * tocar los objetos publicados. El asset final y su miniatura siguen en
 * `world/{worldId}/...`.
 */
export function buildTempUploadKey(worldId: string, assetId: string): string {
  assertUuid(worldId, 'El mundo');
  assertUuid(assetId, 'El asset');

  return assertSafeStorageObjectKey(
    `tmp/${worldId}/${assetId}.${TEMP_UPLOAD_EXTENSION}`,
  );
}

/** Traduce errores de almacenamiento a errores de dominio de assets. */
function mapStorageError(error: unknown, action: string): AssetError {
  if (error instanceof AssetError) {
    return error;
  }

  if (error instanceof StorageError) {
    switch (error.code) {
      case 'not_found':
        return new AssetError('not_found', 'No existe el objeto solicitado.', {
          cause: error,
        });
      case 'too_large':
        return new AssetError('too_large', 'El archivo es demasiado grande.', {
          cause: error,
        });
      case 'invalid_key':
      case 'invalid_expiry':
        return new AssetError('invalid_input', 'La petición no es válida.', {
          cause: error,
        });
      default:
        return new AssetError(
          'storage_unavailable',
          `No se pudo ${action}: el almacenamiento no está disponible.`,
          { cause: error },
        );
    }
  }

  return new AssetError(
    'storage_unavailable',
    `No se pudo ${action}: el almacenamiento no está disponible.`,
    { cause: error },
  );
}

/** Normaliza y valida el MIME declarado por el cliente. */
function normalizeContentType(value: string): string {
  return value.split(';')[0]?.trim().toLowerCase() ?? '';
}

/**
 * Crea el servicio de assets.
 *
 * Es una fábrica: no lee variables de entorno ni abre conexiones. Eso lo hace
 * `server.ts` cuando la aplicación lo necesita.
 */
export function createAssetService(deps: AssetServiceDeps): AssetService {
  const process = deps.processImage ?? processAssetImage;
  const createId = deps.createId ?? randomUUID;

  /** Comprueba la pertenencia y el rol antes de cualquier operación. */
  async function requireRole(
    actor: AssetActor,
    worldId: string,
    mode: 'read' | 'write',
  ) {
    assertUuid(actor.userId, 'El usuario');
    assertUuid(worldId, 'El mundo');

    const role = await deps.store.getRole(actor.userId, worldId);

    if (role === null) {
      // No se revela si el mundo existe: un no miembro ve lo mismo que un id
      // inexistente.
      throw new AssetError('not_found', 'No se encontró el mundo.');
    }

    if (mode === 'write' && !canWriteAssets(role)) {
      throw new AssetError(
        'forbidden',
        'Tu rol en este mundo no permite modificar assets.',
      );
    }

    if (mode === 'read' && !canReadAssets(role)) {
      throw new AssetError('not_found', 'No se encontró el mundo.');
    }

    return role;
  }

  /** Borra un objeto sin romper la operación principal. */
  async function deleteQuietly(key: string): Promise<void> {
    try {
      await deps.storage.delete(key);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'not_found') {
        return;
      }

      deps.onCleanupError?.({ key, error });
    }
  }

  return {
    async requestUpload(actor, input) {
      await requireRole(actor, input.worldId, 'write');

      const contentType = normalizeContentType(input.contentType);

      if (!isAllowedInputMime(contentType)) {
        throw new AssetError(
          'unsupported_type',
          'Solo se admiten imágenes PNG, JPEG, WebP, AVIF o GIF estático.',
        );
      }

      if (
        !Number.isInteger(input.size) ||
        input.size <= 0 ||
        input.size > MAX_ASSET_BYTES
      ) {
        throw new AssetError(
          'too_large',
          `El archivo debe pesar entre 1 byte y ${MAX_ASSET_BYTES} bytes.`,
        );
      }

      const assetId = createId();
      const key = buildTempUploadKey(input.worldId, assetId);
      let uploadUrl: string;

      try {
        uploadUrl = await deps.storage.getSignedUrl(key, {
          expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
          operation: 'put',
          contentType,
          contentLength: input.size,
        });
      } catch (error) {
        throw mapStorageError(error, 'firmar la subida');
      }

      return {
        assetId,
        worldId: input.worldId,
        key,
        uploadUrl,
        expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
        maxBytes: MAX_ASSET_BYTES,
      };
    },

    async finalizeUpload(actor, input) {
      await requireRole(actor, input.worldId, 'write');
      assertUuid(input.assetId, 'El asset');

      const alt = input.alt?.trim() ?? '';

      if (alt.length > MAX_ALT_LENGTH) {
        throw new AssetError(
          'invalid_input',
          `El texto alternativo no puede superar ${MAX_ALT_LENGTH} caracteres.`,
        );
      }

      const tempKey = buildTempUploadKey(input.worldId, input.assetId);
      let raw: Uint8Array;

      if (deps.storage.download === undefined) {
        throw new AssetError(
          'storage_unavailable',
          'El almacenamiento no permite recuperar la subida.',
        );
      }

      try {
        raw = await deps.storage.download(tempKey, {
          maxBytes: MAX_ASSET_BYTES,
        });
      } catch (error) {
        const mapped = mapStorageError(error, 'leer la subida');

        // Un temporal que supera el límite no sirve para nada y ocuparía
        // cuota hasta que pase el lifecycle: se elimina al detectarlo.
        if (mapped.code === 'too_large') {
          await deleteQuietly(tempKey);
        }

        throw mapped;
      }

      let processed: ProcessedImage;

      try {
        processed = await process(raw);
      } catch (error) {
        // El temporal ya no sirve, pero el error original manda: no se enmascara.
        await deleteQuietly(tempKey);
        throw error;
      }

      const path = buildWorldAssetKey(input.worldId, input.assetId, 'webp');
      const thumbnailKey = buildThumbnailKey(input.worldId, input.assetId);

      try {
        await deps.storage.upload({
          key: path,
          body: processed.body,
          contentType: processed.mime,
        });
      } catch (error) {
        throw mapStorageError(error, 'publicar el asset');
      }

      try {
        await deps.storage.upload({
          key: thumbnailKey,
          body: processed.thumbnail.body,
          contentType: processed.thumbnail.mime,
        });
      } catch (error) {
        await deleteQuietly(path);
        throw mapStorageError(error, 'publicar la miniatura');
      }

      const record: NewAssetRecord = {
        id: input.assetId,
        worldId: input.worldId,
        uploaderId: actor.userId,
        bucket: deps.bucket,
        path,
        mime: processed.mime,
        size: processed.body.byteLength,
        width: processed.width,
        height: processed.height,
        alt,
      };

      let inserted: AssetRecord;

      try {
        inserted = await deps.store.insert(actor.userId, record);
      } catch (error) {
        // Un reintento puede llegar aquí si el primer finalize insertó la fila
        // pero no pudo borrar el temporal. En ese caso los objetos publicados
        // ya son válidos: se limpia el temporal y se devuelve la fila.
        let existing: AssetRecord | null | undefined;

        try {
          existing = await deps.store.find(
            actor.userId,
            input.worldId,
            input.assetId,
          );
        } catch {
          existing = undefined;
        }

        if (existing !== undefined) {
          if (existing !== null && existing.path === path) {
            await deleteQuietly(tempKey);
            return existing;
          }

          if (existing === null) {
            // No hay fila: los objetos publicados son huérfanos y se compensan.
            await deleteQuietly(path);
            await deleteQuietly(thumbnailKey);
            throw new AssetError(
              'storage_unavailable',
              'No se pudieron guardar los metadatos del asset.',
              { cause: error },
            );
          }

          // Hay una fila inesperada (path distinto): no se borran objetos
          // publicados; solo el temporal propio.
          await deleteQuietly(tempKey);
          throw new AssetError(
            'storage_unavailable',
            'No se pudieron guardar los metadatos del asset.',
            { cause: error },
          );
        }

        // Sin poder confirmar que no hay fila no se compensa: borrar a ciegas
        // podría dejar una fila apuntando a objetos inexistentes.
        throw new AssetError(
          'storage_unavailable',
          'No se pudieron guardar los metadatos del asset.',
          { cause: error },
        );
      }

      // El temporal se limpia al final; si falla, el lifecycle lo recoge.
      await deleteQuietly(tempKey);

      return inserted;
    },

    async getDownloadUrl(actor, input) {
      await requireRole(actor, input.worldId, 'read');
      assertUuid(input.assetId, 'El asset');

      const expiresInSeconds =
        input.expiresInSeconds ?? DOWNLOAD_URL_EXPIRY_SECONDS;

      if (
        !Number.isInteger(expiresInSeconds) ||
        expiresInSeconds < 1 ||
        expiresInSeconds > MAX_SIGNED_URL_EXPIRY_SECONDS
      ) {
        throw new AssetError(
          'invalid_input',
          `La caducidad debe ser un entero entre 1 y ${MAX_SIGNED_URL_EXPIRY_SECONDS} segundos.`,
        );
      }

      const asset = await deps.store.find(
        actor.userId,
        input.worldId,
        input.assetId,
      );

      if (asset === null) {
        throw new AssetError('not_found', 'No se encontró el asset.');
      }

      let url: string;

      try {
        url = await deps.storage.getSignedUrl(asset.path, {
          expiresInSeconds,
          operation: 'get',
        });
      } catch (error) {
        throw mapStorageError(error, 'firmar la descarga');
      }

      let thumbnailUrl: string | undefined;

      try {
        thumbnailUrl = await deps.storage.getSignedUrl(
          buildThumbnailKey(input.worldId, input.assetId),
          { expiresInSeconds, operation: 'get' },
        );
      } catch {
        // Una miniatura ausente no debe impedir descargar el asset original.
        thumbnailUrl = undefined;
      }

      return {
        url,
        expiresInSeconds,
        asset,
        ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
      };
    },

    async deleteAsset(actor, input) {
      await requireRole(actor, input.worldId, 'write');
      assertUuid(input.assetId, 'El asset');

      const removed = await deps.store.remove(
        actor.userId,
        input.worldId,
        input.assetId,
      );

      if (removed === null) {
        throw new AssetError('not_found', 'No se encontró el asset.');
      }

      // Primero la fila, después los objetos: si R2 falla, el lifecycle limpia
      // y no queda una fila apuntando a algo que ya no existe.
      await deleteQuietly(removed.path);
      await deleteQuietly(buildThumbnailKey(input.worldId, input.assetId));

      return { id: removed.id };
    },

    async listAssets(actor, input) {
      await requireRole(actor, input.worldId, 'read');

      const limit = Math.min(
        Math.max(input.limit ?? DEFAULT_LIST_LIMIT, 1),
        MAX_LIST_LIMIT,
      );
      const records = await deps.store.list(actor.userId, input.worldId, {
        limit,
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      });
      const last = records.at(-1);

      return {
        assets: records,
        ...(records.length === limit && last !== undefined
          ? { nextCursor: encodeAssetCursor(last) }
          : {}),
      };
    },
  };
}
