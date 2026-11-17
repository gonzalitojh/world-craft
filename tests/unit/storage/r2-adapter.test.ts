import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import type { R2StorageConfig } from '@/lib/storage/env';
import { R2StorageAdapter, type R2ClientLike } from '@/lib/storage/r2-adapter';
import { StorageError } from '@/lib/storage/types';

const KEY =
  'world/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.webp';

const CONFIG: R2StorageConfig = {
  accountId: 'a'.repeat(32),
  accessKeyId: 'b'.repeat(32),
  secretAccessKey: 'c'.repeat(64),
  bucket: 'world-craft-dev',
  endpoint: 'https://account.r2.cloudflarestorage.com',
};

class FakeClient implements R2ClientLike {
  readonly commands: unknown[] = [];

  constructor(
    private readonly handler: (command: unknown) => unknown = () => ({}),
  ) {}

  async send(command: unknown): Promise<unknown> {
    this.commands.push(command);
    return this.handler(command);
  }
}

interface CommandLike {
  input: Record<string, unknown>;
}

function inputOf(command: unknown): Record<string, unknown> {
  return (command as CommandLike).input;
}

function createAdapter(client: R2ClientLike, signedUrl = 'https://signed') {
  const presignerCalls: { command: unknown; expiresIn: number }[] = [];
  const adapter = new R2StorageAdapter({
    config: CONFIG,
    client,
    presigner: async (_client, command, options) => {
      presignerCalls.push({ command, expiresIn: options.expiresIn });
      return signedUrl;
    },
  });

  return { adapter, presignerCalls };
}

describe('R2StorageAdapter', () => {
  it('sube con PutObject y devuelve los metadatos', async () => {
    const client = new FakeClient();
    const { adapter } = createAdapter(client);
    const body = new Uint8Array([1, 2, 3]);

    const stored = await adapter.upload({
      key: KEY,
      body,
      contentType: 'image/webp',
      cacheControl: 'private, max-age=3600',
    });

    expect(stored).toMatchObject({
      key: KEY,
      size: 3,
      contentType: 'image/webp',
    });

    const [command] = client.commands;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(inputOf(command)).toMatchObject({
      Bucket: CONFIG.bucket,
      Key: KEY,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'private, max-age=3600',
    });
  });

  it('firma lecturas con GetObject y escrituras con PutObject', async () => {
    const client = new FakeClient();
    const { adapter, presignerCalls } = createAdapter(client);

    await expect(
      adapter.getSignedUrl(KEY, { expiresInSeconds: 120, operation: 'get' }),
    ).resolves.toBe('https://signed');
    await expect(
      adapter.getSignedUrl(KEY, {
        expiresInSeconds: 300,
        operation: 'put',
        contentType: 'image/png',
        contentLength: 1024,
      }),
    ).resolves.toBe('https://signed');

    expect(presignerCalls.map((call) => call.expiresIn)).toEqual([120, 300]);
    expect(presignerCalls[0]?.command).toBeInstanceOf(GetObjectCommand);
    expect(presignerCalls[1]?.command).toBeInstanceOf(PutObjectCommand);
    expect(inputOf(presignerCalls[1]?.command)).toMatchObject({
      Bucket: CONFIG.bucket,
      Key: KEY,
      ContentType: 'image/png',
      ContentLength: 1024,
    });
  });

  it('rechaza una caducidad fuera del máximo antes de firmar', async () => {
    const client = new FakeClient();
    const { adapter } = createAdapter(client);

    await expect(
      adapter.getSignedUrl(KEY, { expiresInSeconds: 3601, operation: 'get' }),
    ).rejects.toMatchObject({ code: 'invalid_expiry' });
    expect(client.commands).toHaveLength(0);
  });

  it('borra con DeleteObject y tolera un objeto ausente', async () => {
    const missing = Object.assign(new Error('no existe'), {
      name: 'NoSuchKey',
      $metadata: { httpStatusCode: 404 },
    });
    const client = new FakeClient((command) => {
      if (command instanceof DeleteObjectCommand) {
        throw missing;
      }

      return {};
    });
    const { adapter } = createAdapter(client);

    await expect(adapter.delete(KEY)).resolves.toBeUndefined();
    expect(client.commands[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('traduce errores de R2 a StorageError', async () => {
    const client = new FakeClient(() => {
      throw Object.assign(new Error('denegado'), {
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
    });
    const { adapter } = createAdapter(client);

    await expect(
      adapter.upload({ key: KEY, body: new Uint8Array([1]), contentType: 'x' }),
    ).rejects.toMatchObject({ code: 'unavailable' });

    expect(
      await adapter
        .upload({
          key: KEY,
          body: new Uint8Array([1]),
          contentType: 'x',
        })
        .catch((error: unknown) => error),
    ).toBeInstanceOf(StorageError);
  });

  it('lista por prefijo, pagina y omite el prefijo vacío', async () => {
    const client = new FakeClient(() => ({
      Contents: [
        {
          Key: KEY,
          Size: 3,
          ETag: '"etag"',
          LastModified: new Date('2026-11-16T10:00:00Z'),
        },
        { Key: undefined },
      ],
      IsTruncated: true,
      NextContinuationToken: 'next-token',
    }));
    const { adapter } = createAdapter(client);

    const result = await adapter.list('world/', { limit: 1 });

    expect(result.objects).toHaveLength(1);
    expect(result.objects[0]).toMatchObject({ key: KEY, size: 3 });
    expect(result.cursor).toBe('next-token');
    expect(inputOf(client.commands[0])).toMatchObject({
      Bucket: CONFIG.bucket,
      Prefix: 'world/',
      MaxKeys: 1,
    });

    await adapter.list('');
    expect(inputOf(client.commands[1]).Prefix).toBeUndefined();
  });

  it('descarga el cuerpo y respeta el tamaño máximo', async () => {
    const body = new Uint8Array([7, 8, 9]);
    const client = new FakeClient(() => ({
      Body: body,
      ContentLength: body.byteLength,
    }));
    const { adapter } = createAdapter(client);

    await expect(adapter.download(KEY)).resolves.toEqual(body);
    await expect(adapter.download(KEY, { maxBytes: 2 })).rejects.toMatchObject({
      code: 'too_large',
    });
  });

  it('lee un cuerpo con transformToByteArray y detecta not_found', async () => {
    const body = new Uint8Array([1, 2]);
    const client = new FakeClient((command) => {
      if (inputOf(command).Key === KEY) {
        return { Body: { transformToByteArray: async () => body } };
      }

      throw Object.assign(new Error('missing'), {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      });
    });
    const { adapter } = createAdapter(client);

    await expect(adapter.download(KEY)).resolves.toEqual(body);
    await expect(adapter.download('world/other/x.webp')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('rechaza claves inseguras antes de llamar al SDK', async () => {
    const client = new FakeClient();
    const { adapter } = createAdapter(client);

    await expect(
      adapter.upload({
        key: '../escape.webp',
        body: new Uint8Array([1]),
        contentType: 'image/webp',
      }),
    ).rejects.toMatchObject({ code: 'invalid_key' });
    await expect(adapter.list('../')).rejects.toMatchObject({
      code: 'invalid_key',
    });
    expect(client.commands).toHaveLength(0);
  });

  it('depura el cursor de paginación en ListObjectsV2', async () => {
    const client = new FakeClient(() => ({ Contents: [] }));
    const { adapter } = createAdapter(client);

    await adapter.list('world/', { cursor: 'token-2', limit: 10 });

    expect(inputOf(client.commands[0])).toMatchObject({
      ContinuationToken: 'token-2',
    });
  });
});
