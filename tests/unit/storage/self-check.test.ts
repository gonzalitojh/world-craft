import { describe, expect, it } from 'vitest';

import { resolveStorageEnv } from '@/lib/storage/env';
import {
  isSelfCheckEnabled,
  runStorageSelfCheck,
} from '@/lib/storage/self-check';
import { MemoryStorageAdapter } from '../../helpers/memory-storage';

const KEY = '_smoke/test.png';
const BODY = new Uint8Array([1, 2, 3]);

/** Simula el proveedor: sin query no se lee; con firma, sí. */
function fakeFetch(storage: MemoryStorageAdapter): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const key = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const signed =
      url.searchParams.has('operation') && url.searchParams.has('expires');

    if (!signed) {
      return new Response(null, { status: 403 });
    }

    return new Response(null, {
      status: storage.read(key) === undefined ? 404 : 200,
    });
  }) as typeof fetch;
}

describe('isSelfCheckEnabled', () => {
  const TOKEN = 'x'.repeat(32);

  it('existe en desarrollo con token', () => {
    const env = resolveStorageEnv({
      NODE_ENV: 'development',
      STORAGE_SMOKE_TOKEN: TOKEN,
    });

    expect(isSelfCheckEnabled(env)).toBe(true);
  });

  it('no existe en producción real ni sin token', () => {
    expect(
      isSelfCheckEnabled(
        resolveStorageEnv({
          NODE_ENV: 'production',
          STORAGE_SMOKE_TOKEN: TOKEN,
        }),
      ),
    ).toBe(false);
    expect(
      isSelfCheckEnabled(
        resolveStorageEnv({
          NODE_ENV: 'development',
        }),
      ),
    ).toBe(false);
  });

  it('existe en una preview de Vercel aunque NODE_ENV sea production', () => {
    const env = resolveStorageEnv({
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      STORAGE_SMOKE_TOKEN: TOKEN,
    });

    expect(isSelfCheckEnabled(env)).toBe(true);
  });
});

describe('runStorageSelfCheck', () => {
  it('sube, rechaza sin firma, lee firmado y borra', async () => {
    const storage = new MemoryStorageAdapter({
      baseUrl: 'https://example.test',
    });

    const result = await runStorageSelfCheck({
      storage,
      body: BODY,
      key: KEY,
      fetchImpl: fakeFetch(storage),
    });

    expect(result).toEqual({
      uploaded: true,
      unsignedRejected: true,
      signedRead: true,
      deleted: true,
    });
    expect(storage.read(KEY)).toBeUndefined();
  });

  it('no da por bueno un proveedor que lee sin firma', async () => {
    const storage = new MemoryStorageAdapter({
      baseUrl: 'https://example.test',
    });

    const result = await runStorageSelfCheck({
      storage,
      body: BODY,
      key: KEY,
      fetchImpl: (async () =>
        new Response(null, { status: 200 })) as typeof fetch,
    });

    expect(result.unsignedRejected).toBe(false);
    expect(result.signedRead).toBe(true);
    expect(result.deleted).toBe(true);
    expect(storage.read(KEY)).toBeUndefined();
  });

  it('no lanza si el almacenamiento no responde y no deja el objeto', async () => {
    const storage = new MemoryStorageAdapter();
    const originalUpload = storage.upload.bind(storage);

    storage.upload = async () => {
      throw new Error('proveedor caído');
    };

    const result = await runStorageSelfCheck({
      storage,
      body: BODY,
      key: KEY,
    });

    expect(result).toMatchObject({
      uploaded: false,
      unsignedRejected: false,
      signedRead: false,
      deleted: false,
    });

    storage.upload = originalUpload;
  });
});
