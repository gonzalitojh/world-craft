/**
 * Adaptador de Cloudflare R2 (S3-compatible).
 *
 * Decisiones de M0-10 (issue #40):
 * - Cliente S3 **solo en servidor**. El bucket es privado y nunca se publica.
 * - El cliente es inyectable para probar comandos y traducción de errores sin
 *   red ni credenciales.
 * - `forcePathStyle` y región `auto`, con endpoint derivado de la cuenta si no
 *   se configura uno explícito.
 * - Checksums del SDK en `WHEN_REQUIRED`: R2 no implementa el conjunto completo
 *   de checksums flexibles y un `STREAMING-UNSIGNED-PAYLOAD-TRAILER` provoca
 *   fallos en algunas operaciones.
 * - Los errores del proveedor se traducen a `StorageError`; nunca se propaga la
 *   respuesta de AWS tal cual.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { R2StorageConfig } from './env';
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

/** Cliente mínimo que necesita el adaptador; permite inyectar un doble. */
export interface R2ClientLike {
  send(command: unknown): Promise<unknown>;
}

/** Firmador inyectable para las pruebas. */
export type R2Presigner = (
  client: R2ClientLike,
  command: unknown,
  options: { expiresIn: number },
) => Promise<string>;

/** Configuración del adaptador R2. */
export interface R2AdapterConfig {
  config: R2StorageConfig;
  client?: R2ClientLike;
  presigner?: R2Presigner;
}

/** Respuesta mínima de S3 que consume el adaptador. */
interface S3ErrorLike {
  name?: string;
  message?: string;
  $metadata?: { httpStatusCode?: number };
}

/** Respuesta de `GetObject`. */
interface GetObjectResponse {
  Body?: unknown;
  ContentLength?: number;
  ContentType?: string;
  ETag?: string;
  LastModified?: Date;
}

/** Respuesta de `ListObjectsV2`. */
interface ListObjectsResponse {
  Contents?: {
    Key?: string;
    Size?: number;
    ETag?: string;
    LastModified?: Date;
  }[];
  NextContinuationToken?: string;
  IsTruncated?: boolean;
}

/** Firmador real del SDK; se evita en las pruebas. */
const defaultPresigner: R2Presigner = (client, command, options) =>
  getSignedUrl(client as S3Client, command as never, options);

/** Traduce un error de S3/R2 a un código del dominio. */
function mapR2Error(error: unknown, key: string): StorageError {
  if (error instanceof StorageError) {
    return error;
  }

  const candidate = error as S3ErrorLike | null;
  const status = candidate?.$metadata?.httpStatusCode;
  const name = candidate?.name;

  if (
    status === 404 ||
    name === 'NoSuchKey' ||
    name === 'NotFound' ||
    name === 'NoSuchBucket'
  ) {
    return new StorageError('not_found', `No existe el objeto «${key}».`, {
      cause: error,
    });
  }

  return new StorageError(
    'unavailable',
    `Cloudflare R2 no pudo completar la operación sobre «${key}».`,
    { cause: error },
  );
}

/** Verifica el tope de tamaño y devuelve los bytes. */
function checkSize(
  bytes: Uint8Array,
  maxBytes: number | undefined,
): Uint8Array {
  if (maxBytes !== undefined && bytes.byteLength > maxBytes) {
    throw new StorageError(
      'too_large',
      `El objeto supera el máximo de ${maxBytes} bytes.`,
    );
  }

  return bytes;
}

/**
 * Convierte el cuerpo de una respuesta S3 en bytes.
 *
 * El SDK v3 entrega un `SdkStream` con `transformToByteArray`; los dobles de
 * prueba pueden entregar directamente un `Uint8Array` o un iterable async.
 */
async function readResponseBody(
  body: unknown,
  maxBytes: number | undefined,
): Promise<Uint8Array> {
  if (body === undefined || body === null) {
    throw new StorageError(
      'unavailable',
      'La respuesta de R2 no traía cuerpo.',
    );
  }

  if (body instanceof Uint8Array) {
    return checkSize(body, maxBytes);
  }

  const transformable = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };

  if (typeof transformable.transformToByteArray === 'function') {
    return checkSize(
      new Uint8Array(await transformable.transformToByteArray()),
      maxBytes,
    );
  }

  const iterable = body as Partial<AsyncIterable<Uint8Array>>;

  if (typeof iterable[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    let total = 0;

    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;

      if (maxBytes !== undefined && total > maxBytes) {
        throw new StorageError(
          'too_large',
          `El objeto supera el máximo de ${maxBytes} bytes.`,
        );
      }

      chunks.push(chunk);
    }

    const combined = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return combined;
  }

  throw new StorageError(
    'unavailable',
    'La respuesta de R2 usa un tipo de cuerpo no soportado.',
  );
}

export class R2StorageAdapter implements StorageAdapter {
  private readonly bucket: string;

  private readonly client: R2ClientLike;

  private readonly presigner: R2Presigner;

  constructor(adapterConfig: R2AdapterConfig) {
    const { config } = adapterConfig;

    this.bucket = config.bucket;
    this.presigner = adapterConfig.presigner ?? defaultPresigner;
    this.client =
      adapterConfig.client ??
      new S3Client({
        region: 'auto',
        endpoint: config.endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        // R2 no soporta todos los checksums flexibles del SDK v3.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
  }

  async upload(input: StorageUploadInput): Promise<StorageObject> {
    const key = assertSafeStorageObjectKey(input.key);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.body,
          ContentType: input.contentType,
          ...(input.cacheControl === undefined
            ? {}
            : { CacheControl: input.cacheControl }),
        }),
      );

      return {
        key,
        size: input.body.byteLength,
        contentType: input.contentType,
        lastModified: new Date(),
      };
    } catch (error) {
      throw mapR2Error(error, key);
    }
  }

  async getSignedUrl(
    key: string,
    options: StorageSignedUrlOptions,
  ): Promise<string> {
    assertValidExpiry(options.expiresInSeconds);

    const safeKey = assertSafeStorageObjectKey(key);

    try {
      const command =
        options.operation === 'put'
          ? new PutObjectCommand({
              Bucket: this.bucket,
              Key: safeKey,
              ...(options.contentType === undefined
                ? {}
                : { ContentType: options.contentType }),
              ...(options.contentLength === undefined
                ? {}
                : { ContentLength: options.contentLength }),
            })
          : new GetObjectCommand({ Bucket: this.bucket, Key: safeKey });

      return await this.presigner(this.client, command, {
        expiresIn: options.expiresInSeconds,
      });
    } catch (error) {
      throw mapR2Error(error, safeKey);
    }
  }

  async delete(key: string): Promise<void> {
    const safeKey = assertSafeStorageObjectKey(key);

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey }),
      );
    } catch (error) {
      const mapped = mapR2Error(error, safeKey);

      // DELETE en S3/R2 es idempotente: un objeto ausente no es un fallo.
      if (mapped.code === 'not_found') {
        return;
      }

      throw mapped;
    }
  }

  async list(
    prefix: string,
    options: StorageListOptions = {},
  ): Promise<StorageListResult> {
    const safePrefix = assertSafeStoragePrefix(prefix);
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000);

    try {
      const response = (await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: safePrefix === '' ? undefined : safePrefix,
          MaxKeys: limit,
          ...(options.cursor === undefined
            ? {}
            : { ContinuationToken: options.cursor }),
        }),
      )) as ListObjectsResponse;

      const objects: StorageObject[] = (response.Contents ?? []).flatMap(
        (item) => {
          if (item.Key === undefined) {
            return [];
          }

          return [
            {
              key: item.Key,
              size: item.Size ?? 0,
              contentType: 'application/octet-stream',
              ...(item.ETag === undefined ? {} : { etag: item.ETag }),
              ...(item.LastModified === undefined
                ? {}
                : { lastModified: item.LastModified }),
            },
          ];
        },
      );

      return {
        objects,
        ...(response.IsTruncated === true &&
        response.NextContinuationToken !== undefined
          ? { cursor: response.NextContinuationToken }
          : {}),
      };
    } catch (error) {
      throw mapR2Error(error, safePrefix);
    }
  }

  async download(
    key: string,
    options: StorageDownloadOptions = {},
  ): Promise<Uint8Array> {
    const safeKey = assertSafeStorageObjectKey(key);

    try {
      const response = (await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: safeKey }),
      )) as GetObjectResponse;

      if (
        options.maxBytes !== undefined &&
        response.ContentLength !== undefined &&
        response.ContentLength > options.maxBytes
      ) {
        throw new StorageError(
          'too_large',
          `El objeto «${safeKey}» supera los ${options.maxBytes} bytes.`,
        );
      }

      return await readResponseBody(response.Body, options.maxBytes);
    } catch (error) {
      throw mapR2Error(error, safeKey);
    }
  }
}
