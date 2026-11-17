/**
 * Pruebas de la ruta interna `/api/storage/local`.
 *
 * Es una frontera de seguridad del adaptador local: sin firma no se lee ni se
 * escribe, la firma caduca, solo se sirve en desarrollo y los métodos ajenos
 * se rechazan. El adaptador se prueba por separado; aquí se comprueba el
 * handler HTTP completo.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { LocalStorageAdapter } from '@/lib/storage/local-adapter';
import { createStorageAdapter } from '@/lib/storage/driver';
import { resolveStorageEnv } from '@/lib/storage/env';

const SECRET = 's'.repeat(32);
const BASE_URL = 'http://localhost:3000';
const KEY =
  'tmp/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.upload';
const BODY = new Uint8Array([1, 2, 3, 4]);

let directory: string;
let adapter: LocalStorageAdapter;
let route: typeof import('@/app/api/storage/local/[...key]/route');

function context(key = KEY) {
  return { params: Promise.resolve({ key: key.split('/') }) };
}

function urlFor(key = KEY): string {
  const path = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${BASE_URL}/api/storage/local/${path}`;
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'world-craft-storage-route-'));
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_LOCAL_DIR = directory;
  process.env.STORAGE_LOCAL_SECRET = SECRET;
  process.env.STORAGE_LOCAL_BASE_URL = BASE_URL;

  adapter = createStorageAdapter(resolveStorageEnv()) as LocalStorageAdapter;
  route = await import('@/app/api/storage/local/[...key]/route');
});

afterAll(async () => {
  delete process.env.STORAGE_DRIVER;
  delete process.env.STORAGE_LOCAL_DIR;
  delete process.env.STORAGE_LOCAL_SECRET;
  delete process.env.STORAGE_LOCAL_BASE_URL;
  await rm(directory, { recursive: true, force: true });
});

describe('GET/PUT /api/storage/local', () => {
  it('rechaza una lectura sin firma', async () => {
    const response = await route.GET(new Request(urlFor()), context());

    expect(response.status).toBe(403);
  });

  it('acepta un PUT firmado y devuelve el objeto con un GET firmado', async () => {
    const putUrl = await adapter.getSignedUrl(KEY, {
      expiresInSeconds: 60,
      operation: 'put',
    });
    const put = await route.PUT(
      new Request(putUrl, {
        method: 'PUT',
        body: BODY,
        headers: { 'content-type': 'image/png' },
      }),
      context(),
    );

    expect(put.status).toBe(200);

    const getUrl = await adapter.getSignedUrl(KEY, {
      expiresInSeconds: 60,
      operation: 'get',
    });
    const get = await route.GET(new Request(getUrl), context());

    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(BODY);
  });

  it('rechaza una firma manipulada o una operación distinta', async () => {
    const getUrl = new URL(
      await adapter.getSignedUrl(KEY, {
        expiresInSeconds: 60,
        operation: 'get',
      }),
    );
    getUrl.searchParams.set('sig', 'f'.repeat(64));

    const tampered = await route.GET(new Request(getUrl), context());
    expect(tampered.status).toBe(403);

    const putUrl = await adapter.getSignedUrl(KEY, {
      expiresInSeconds: 60,
      operation: 'put',
    });
    const wrongMethod = await route.GET(new Request(putUrl), context());
    expect(wrongMethod.status).toBe(403);
  });

  it('devuelve 405 para métodos no permitidos', async () => {
    const getUrl = await adapter.getSignedUrl(KEY, {
      expiresInSeconds: 60,
      operation: 'get',
    });
    const request = new Request(getUrl, { method: 'DELETE' });

    // El handler solo exporta GET y PUT, así que se invoca GET con el verbo
    // DELETE para cubrir la rama interna que responde 405.
    const response = await route.GET(request, context());

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, PUT');
  });

  it('devuelve 404 en producción sin revelar la ruta', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    try {
      const response = await route.GET(new Request(urlFor()), context());
      expect(response.status).toBe(404);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
