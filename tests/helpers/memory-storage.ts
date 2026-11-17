/**
 * Adaptador de almacenamiento en memoria para las pruebas del contrato.
 *
 * No toca red ni disco: guarda los objetos en un `Map` y firma URLs ficticias
 * con el mismo formato que usaría R2. Sirve para comprobar que cualquier
 * implementación (R2 incluida, en M0-10) respeta el contrato sin depender de
 * credenciales.
 */
import {
  assertValidExpiry,
  StorageError,
  type StorageAdapter,
  type StorageDownloadOptions,
  type StorageListOptions,
  type StorageListResult,
  type StorageObject,
  type StorageSignedUrlOptions,
  type StorageUploadInput,
} from '@/lib/storage';

interface StoredObject {
  body: Uint8Array;
  metadata: StorageObject;
}

/** Límite de página del listado, igual que un proveedor real. */
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<string, StoredObject>();

  private readonly baseUrl: string;

  /** Reloj lógico para que `lastModified` sea determinista en las pruebas. */
  private tick = 0;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl ?? 'memory://world-craft-assets';
  }

  async upload(input: StorageUploadInput): Promise<StorageObject> {
    if (input.key.trim() === '') {
      throw new StorageError('invalid_key', 'La clave no puede estar vacía.');
    }

    const metadata: StorageObject = {
      key: input.key,
      size: input.body.byteLength,
      contentType: input.contentType,
      etag: `"memory-${this.tick}"`,
      lastModified: new Date(Date.UTC(2026, 0, 1) + this.tick * 1000),
    };

    this.tick += 1;
    this.objects.set(input.key, { body: input.body.slice(), metadata });

    return { ...metadata };
  }

  async getSignedUrl(
    key: string,
    options: StorageSignedUrlOptions,
  ): Promise<string> {
    assertValidExpiry(options.expiresInSeconds);

    if (options.operation === 'get' && !this.objects.has(key)) {
      throw new StorageError('not_found', `No existe el objeto «${key}».`);
    }

    const params = new URLSearchParams({
      operation: options.operation,
      expires: String(options.expiresInSeconds),
    });

    return `${this.baseUrl}/${key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}?${params.toString()}`;
  }

  async delete(key: string): Promise<void> {
    if (!this.objects.delete(key)) {
      throw new StorageError('not_found', `No existe el objeto «${key}».`);
    }
  }

  async list(
    prefix: string,
    options: StorageListOptions = {},
  ): Promise<StorageListResult> {
    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );

    const keys = [...this.objects.keys()]
      .filter((key) => key.startsWith(prefix))
      .filter((key) => options.cursor === undefined || key > options.cursor)
      .sort();

    const page = keys.slice(0, limit);
    const lastKey = page.at(-1);
    const hasMore = keys.length > page.length && lastKey !== undefined;

    return {
      objects: page.map((key) => ({ ...this.objects.get(key)!.metadata })),
      ...(hasMore ? { cursor: lastKey } : {}),
    };
  }

  /** Devuelve el contenido guardado, solo para aserciones de pruebas. */
  read(key: string): Uint8Array | undefined {
    return this.objects.get(key)?.body.slice();
  }

  /** Descarga un objeto en memoria, con el mismo tope que los adaptadores reales. */
  async download(
    key: string,
    options: StorageDownloadOptions = {},
  ): Promise<Uint8Array> {
    const stored = this.objects.get(key);

    if (stored === undefined) {
      throw new StorageError('not_found', `No existe el objeto «${key}».`);
    }

    if (
      options.maxBytes !== undefined &&
      stored.body.byteLength > options.maxBytes
    ) {
      throw new StorageError(
        'too_large',
        `El objeto «${key}» supera los ${options.maxBytes} bytes.`,
      );
    }

    return stored.body.slice();
  }
}
