/**
 * Adaptador de almacenamiento local para desarrollo y pruebas.
 *
 * Sustituye a R2 cuando no hay credenciales (decisión del plan de M0-10, issue
 * #40) con las mismas garantías del contrato:
 * - Bucket privado: solo se entrega una URL firmada con HMAC-SHA256.
 * - Caducidad máxima de una hora y verificación en tiempo constante.
 * - Rechazo de claves peligrosas: traversal, rutas absolutas, barras
 *   invertidas, segmentos vacíos, NUL y componentes simbólicos.
 * - Escritura atómica (temporal + `rename`) y sidecar `.meta.json` con el
 *   `contentType`, para que la ruta de descarga lo devuelva sin adivinar.
 *
 * El secreto vive en `.local/storage-secret` (ignorado por git) y se genera la
 * primera vez. El directorio por defecto es `.local/storage`. En producción el
 * driver está prohibido (`driver.ts`), así que este adaptador nunca se sirve
 * desde un despliegue real.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { DEFAULT_STORAGE_LOCAL_SECRET_FILE } from './env';
import {
  buildLocalStorageUrl,
  verifyLocalStorageSignature,
  type LocalSignatureCheck,
  type LocalStorageOperation,
} from './local-signature';
import {
  assertSafeStorageObjectKey,
  assertSafeStoragePrefix,
} from './object-key';
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
} from './types';

/** Tamaño máximo de un objeto local: 10 MiB, igual que el límite de subida. */
export const LOCAL_STORAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Sufijo del sidecar de metadatos. */
export const LOCAL_STORAGE_META_SUFFIX = '.meta.json';

/** Metadatos persistidos junto al objeto. */
interface LocalObjectMeta {
  contentType: string;
  size: number;
  cacheControl?: string;
  createdAt: string;
  etag: string;
}

/** Configuración del adaptador local. */
export interface LocalStorageAdapterConfig {
  /** Directorio raíz de los objetos. */
  directory: string;
  /** Secreto HMAC. Si falta, se lee o genera en `secretFile`. */
  secret?: string;
  /** Ruta del secreto. Por defecto, hermano del directorio. */
  secretFile?: string;
  /** Origen de las URLs firmadas. */
  baseUrl?: string;
  /** Reloj inyectable para las pruebas. */
  now?: () => number;
}

/** Comprueba que un código de error de Node sea `ENOENT`. */
function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

/** Traduce errores del sistema de archivos a errores de dominio. */
function mapFileError(error: unknown, key: string): StorageError {
  if (error instanceof StorageError) {
    return error;
  }

  if (isEnoent(error)) {
    return new StorageError('not_found', `No existe el objeto «${key}».`, {
      cause: error,
    });
  }

  return new StorageError(
    'unavailable',
    `No se pudo acceder al almacenamiento local de «${key}».`,
    { cause: error },
  );
}

/**
 * Valida una clave de objeto local.
 *
 * Es más estricta que la clave de asset de mundo a propósito: cualquier clave
 * que use el adaptador (incluidos los temporales `.upload`) debe ser segura en
 * disco. La regla compartida vive en `object-key.ts`.
 */
export const assertLocalStorageKey = assertSafeStorageObjectKey;

/**
 * Valida un prefijo de listado.
 *
 * Admite la cadena vacía y un `/` final, que son útiles para listar todo el
 * bucket o un mundo completo; el resto de reglas es el de una clave.
 */
export const assertLocalStoragePrefix = assertSafeStoragePrefix;

/** Resuelve una clave dentro del directorio raíz, sin salir de él. */
function resolveWithinRoot(root: string, key: string): string {
  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, ...key.split('/'));

  if (
    absolute !== absoluteRoot &&
    !absolute.startsWith(`${absoluteRoot}${sep}`)
  ) {
    throw new StorageError(
      'invalid_key',
      `La clave «${key}» se sale del directorio de almacenamiento.`,
    );
  }

  return absolute;
}

/** Rechaza cualquier componente existente que sea un enlace simbólico. */
async function assertNoSymlink(root: string, key: string): Promise<void> {
  let current = resolve(root);

  for (const segment of key.split('/')) {
    current = join(current, segment);

    try {
      const info = await lstat(current);

      if (info.isSymbolicLink()) {
        throw new StorageError(
          'invalid_key',
          `La ruta «${key}» contiene un enlace simbólico.`,
        );
      }
    } catch (error) {
      if (isEnoent(error)) {
        return;
      }

      throw error;
    }
  }
}

/** Resultado de leer un objeto local. */
export interface LocalObject {
  body: Uint8Array;
  contentType: string;
  meta: LocalObjectMeta;
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly directory: string;

  private readonly secret: string | undefined;

  private readonly secretFile: string;

  private readonly baseUrl: string | undefined;

  private readonly now: () => number;

  private secretPromise: Promise<string> | undefined;

  constructor(config: LocalStorageAdapterConfig) {
    this.directory = resolve(config.directory);
    this.secret = config.secret;
    this.secretFile = resolve(
      config.secretFile ?? DEFAULT_STORAGE_LOCAL_SECRET_FILE,
    );
    this.baseUrl = config.baseUrl;
    this.now = config.now ?? Date.now;
  }

  async upload(input: StorageUploadInput): Promise<StorageObject> {
    const key = assertLocalStorageKey(input.key);

    if (input.body.byteLength > LOCAL_STORAGE_MAX_BYTES) {
      throw new StorageError(
        'too_large',
        `El objeto «${key}» supera los ${LOCAL_STORAGE_MAX_BYTES} bytes.`,
      );
    }

    await this.ensureRoot();

    try {
      await assertNoSymlink(this.directory, key);

      const absolute = resolveWithinRoot(this.directory, key);
      const folder = dirname(absolute);

      await mkdir(folder, { recursive: true });
      await assertNoSymlink(this.directory, key);

      const temporary = `${absolute}.${randomUUID()}.tmp`;
      await writeFile(temporary, input.body);

      // Si el destino era un enlace simbólico, no se sigue: se rechaza.
      try {
        const target = await lstat(absolute);

        if (target.isSymbolicLink()) {
          throw new StorageError(
            'invalid_key',
            `La clave «${key}» apunta a un enlace simbólico.`,
          );
        }
      } catch (error) {
        if (!isEnoent(error)) {
          throw error;
        }
      }

      await rename(temporary, absolute);

      const meta: LocalObjectMeta = {
        contentType: input.contentType,
        size: input.body.byteLength,
        createdAt: new Date(this.now()).toISOString(),
        etag: `"${createHash('sha256').update(input.body).digest('hex')}"`,
        ...(input.cacheControl === undefined
          ? {}
          : { cacheControl: input.cacheControl }),
      };

      await writeFile(
        `${absolute}${LOCAL_STORAGE_META_SUFFIX}`,
        JSON.stringify(meta),
      );

      return {
        key,
        size: meta.size,
        contentType: meta.contentType,
        etag: meta.etag,
        lastModified: new Date(meta.createdAt),
      };
    } catch (error) {
      throw mapFileError(error, key);
    }
  }

  async getSignedUrl(
    key: string,
    options: StorageSignedUrlOptions,
  ): Promise<string> {
    assertValidExpiry(options.expiresInSeconds);

    const safeKey = assertLocalStorageKey(key);

    if (options.operation === 'get' && !(await this.exists(safeKey))) {
      throw new StorageError('not_found', `No existe el objeto «${safeKey}».`);
    }

    const secret = await this.loadSecret();

    return buildLocalStorageUrl({
      key: safeKey,
      operation: options.operation,
      expiresInSeconds: options.expiresInSeconds,
      secret,
      nowMs: this.now(),
      ...(this.baseUrl === undefined ? {} : { baseUrl: this.baseUrl }),
    });
  }

  async delete(key: string): Promise<void> {
    const safeKey = assertLocalStorageKey(key);

    try {
      const absolute = resolveWithinRoot(this.directory, safeKey);
      await assertNoSymlink(this.directory, safeKey);
      const info = await lstat(absolute);

      if (!info.isFile()) {
        throw new StorageError(
          'invalid_key',
          `La clave «${safeKey}» no es un objeto.`,
        );
      }

      await rm(absolute);
      await rm(`${absolute}${LOCAL_STORAGE_META_SUFFIX}`, { force: true });
    } catch (error) {
      throw mapFileError(error, safeKey);
    }
  }

  async list(
    prefix: string,
    options: StorageListOptions = {},
  ): Promise<StorageListResult> {
    const safePrefix = assertLocalStoragePrefix(prefix);
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000);
    const keys: string[] = [];

    await this.collectKeys(this.directory, '', keys);

    const matching = keys
      .filter((key) => key.startsWith(safePrefix))
      .filter((key) => options.cursor === undefined || key > options.cursor)
      .sort();
    const page = matching.slice(0, limit);
    const lastKey = page.at(-1);
    const objects: StorageObject[] = [];

    for (const key of page) {
      const meta = await this.readMeta(key).catch(() => undefined);

      objects.push({
        key,
        size: meta?.size ?? 0,
        contentType: meta?.contentType ?? 'application/octet-stream',
        ...(meta?.etag === undefined ? {} : { etag: meta.etag }),
        ...(meta?.createdAt === undefined
          ? {}
          : { lastModified: new Date(meta.createdAt) }),
      });
    }

    return {
      objects,
      ...(matching.length > page.length && lastKey !== undefined
        ? { cursor: lastKey }
        : {}),
    };
  }

  async download(
    key: string,
    options: StorageDownloadOptions = {},
  ): Promise<Uint8Array> {
    const safeKey = assertLocalStorageKey(key);

    try {
      const absolute = resolveWithinRoot(this.directory, safeKey);
      await assertNoSymlink(this.directory, safeKey);
      const info = await lstat(absolute);

      if (!info.isFile()) {
        throw new StorageError(
          'not_found',
          `No existe el objeto «${safeKey}».`,
        );
      }

      if (options.maxBytes !== undefined && info.size > options.maxBytes) {
        throw new StorageError(
          'too_large',
          `El objeto «${safeKey}» supera los ${options.maxBytes} bytes.`,
        );
      }

      return new Uint8Array(await readFile(absolute));
    } catch (error) {
      throw mapFileError(error, safeKey);
    }
  }

  /** Verifica la firma de una petición servida por `/api/storage/local`. */
  async verifyRequest(params: {
    key: string;
    operation: LocalStorageOperation;
    expiresAt: number;
    signature: string;
  }): Promise<LocalSignatureCheck> {
    const secret = await this.loadSecret();

    return verifyLocalStorageSignature({
      ...params,
      secret,
      nowMs: this.now(),
    });
  }

  /**
   * Lee un objeto y su `contentType` para servir una descarga local.
   *
   * Es un método propio del adaptador (no del contrato) usado por la ruta
   * interna, que necesita el MIME guardado en el sidecar.
   */
  async readObject(
    key: string,
    options: StorageDownloadOptions = {},
  ): Promise<LocalObject> {
    const body = await this.download(key, options);
    const meta = await this.readMeta(key);

    return {
      body,
      contentType: meta?.contentType ?? 'application/octet-stream',
      meta: meta ?? {
        contentType: 'application/octet-stream',
        size: body.byteLength,
        createdAt: new Date(this.now()).toISOString(),
        etag: `"${createHash('sha256').update(body).digest('hex')}"`,
      },
    };
  }

  /** Comprueba si existe un objeto, sin lanzar. */
  async exists(key: string): Promise<boolean> {
    const safeKey = assertLocalStorageKey(key);

    try {
      const absolute = resolveWithinRoot(this.directory, safeKey);
      await assertNoSymlink(this.directory, safeKey);
      return (await lstat(absolute)).isFile();
    } catch {
      return false;
    }
  }

  /** Directorio raíz resuelto (solo para pruebas y diagnóstico). */
  get rootDirectory(): string {
    return this.directory;
  }

  /** Metadatos de un objeto, si existen. */
  private async readMeta(key: string): Promise<LocalObjectMeta | undefined> {
    const absolute = resolveWithinRoot(this.directory, key);

    try {
      const raw = await readFile(
        `${absolute}${LOCAL_STORAGE_META_SUFFIX}`,
        'utf8',
      );
      return JSON.parse(raw) as LocalObjectMeta;
    } catch (error) {
      if (isEnoent(error)) {
        return undefined;
      }

      throw mapFileError(error, key);
    }
  }

  /** Recorre el directorio y acumula claves de objeto (sin sidecars). */
  private async collectKeys(
    folder: string,
    prefix: string,
    keys: string[],
  ): Promise<void> {
    let entries;

    try {
      entries = await readdir(folder, { withFileTypes: true });
    } catch (error) {
      if (isEnoent(error)) {
        return;
      }

      throw mapFileError(error, prefix);
    }

    for (const entry of entries) {
      const key = prefix === '' ? entry.name : `${prefix}/${entry.name}`;

      if (entry.isDirectory()) {
        await this.collectKeys(join(folder, entry.name), key, keys);
        continue;
      }

      if (
        entry.isFile() &&
        !entry.name.endsWith(LOCAL_STORAGE_META_SUFFIX) &&
        !entry.name.endsWith('.tmp')
      ) {
        keys.push(key);
      }
    }
  }

  /** Crea el directorio raíz y comprueba que no sea un enlace simbólico. */
  private async ensureRoot(): Promise<void> {
    await mkdir(this.directory, { recursive: true });

    try {
      const info = await lstat(this.directory);

      if (info.isSymbolicLink()) {
        throw new StorageError(
          'unavailable',
          'El directorio de almacenamiento local es un enlace simbólico.',
        );
      }
    } catch (error) {
      if (!isEnoent(error)) {
        throw mapFileError(error, '');
      }
    }
  }

  /** Lee el secreto configurado o lo genera en disco la primera vez. */
  private async loadSecret(): Promise<string> {
    this.secretPromise ??= this.readOrCreateSecret();
    return this.secretPromise;
  }

  private async readOrCreateSecret(): Promise<string> {
    if (this.secret !== undefined) {
      return this.secret;
    }

    try {
      const value = (await readFile(this.secretFile, 'utf8')).trim();

      if (value.length < 16) {
        throw new StorageError(
          'unavailable',
          `El secreto local «${this.secretFile}» es demasiado corto.`,
        );
      }

      return value;
    } catch (error) {
      if (!isEnoent(error)) {
        throw mapFileError(error, this.secretFile);
      }
    }

    try {
      await mkdir(dirname(this.secretFile), { recursive: true });
      const generated = randomUUID().replaceAll('-', '');
      await writeFile(this.secretFile, generated, { mode: 0o600 });
      return generated;
    } catch (error) {
      throw mapFileError(error, this.secretFile);
    }
  }
}
