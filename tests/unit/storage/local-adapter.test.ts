import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assertLocalStorageKey,
  LOCAL_STORAGE_MAX_BYTES,
  LocalStorageAdapter,
} from '@/lib/storage/local-adapter';

const WORLD_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '33333333-3333-4333-8333-333333333333';
const KEY = `world/${WORLD_ID}/${ASSET_ID}.webp`;
const SECRET = 's'.repeat(32);

let root: string;
let secretFile: string;
let now: number;

/** Reloj controlado para probar caducidad sin esperas. */
const clock = () => now;

function createAdapter(): LocalStorageAdapter {
  return new LocalStorageAdapter({
    directory: join(root, 'storage'),
    secretFile,
    secret: SECRET,
    baseUrl: 'http://localhost:3000',
    now: clock,
  });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'world-craft-storage-'));
  secretFile = join(root, 'storage-secret');
  now = Date.UTC(2026, 10, 16, 12, 0, 0);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('claves locales', () => {
  it('acepta claves anidadas normales', () => {
    expect(assertLocalStorageKey(KEY)).toBe(KEY);
    expect(assertLocalStorageKey(`world/${WORLD_ID}/${ASSET_ID}.upload`)).toBe(
      `world/${WORLD_ID}/${ASSET_ID}.upload`,
    );
  });

  it('rechaza traversal, rutas absolutas y barras invertidas', () => {
    for (const key of [
      '../secreto',
      `world/${WORLD_ID}/../../x`,
      `/etc/passwd`,
      `world\\${WORLD_ID}\\x.webp`,
      'world//x.webp',
      'world/./x.webp',
      'world/x.webp/',
      'C:/windows/x',
      '',
    ]) {
      expect(() => assertLocalStorageKey(key), key).toThrow(/clave|segmento/);
    }
  });
});

describe('LocalStorageAdapter', () => {
  it('sube, descarga y devuelve metadatos con escritura atómica', async () => {
    const adapter = createAdapter();
    const body = new Uint8Array([1, 2, 3, 4, 5]);

    const stored = await adapter.upload({
      key: KEY,
      body,
      contentType: 'image/webp',
    });

    expect(stored).toMatchObject({
      key: KEY,
      size: body.byteLength,
      contentType: 'image/webp',
    });
    expect(stored.etag).toMatch(/^"[0-9a-f]{64}"$/);

    await expect(adapter.download(KEY)).resolves.toEqual(body);

    const object = await adapter.readObject(KEY);
    expect(object.contentType).toBe('image/webp');
  });

  it('lista por prefijo y pagina con cursor, sin sidecars', async () => {
    const adapter = createAdapter();

    for (const id of [
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ]) {
      await adapter.upload({
        key: `world/${WORLD_ID}/${id}.webp`,
        body: new Uint8Array([1]),
        contentType: 'image/webp',
      });
    }

    const first = await adapter.list(`world/${WORLD_ID}/`, { limit: 2 });
    expect(first.objects).toHaveLength(2);
    expect(first.objects.every((o) => !o.key.endsWith('.meta.json'))).toBe(
      true,
    );
    expect(first.cursor).toBeDefined();

    const cursor = first.cursor;

    if (cursor === undefined) {
      throw new Error('La primera página debería traer cursor');
    }

    const second = await adapter.list(`world/${WORLD_ID}/`, {
      limit: 2,
      cursor,
    });
    expect(second.objects).toHaveLength(1);
    expect(second.cursor).toBeUndefined();
  });

  it('borra el objeto y el sidecar, y avisa si ya no existe', async () => {
    const adapter = createAdapter();
    await adapter.upload({
      key: KEY,
      body: new Uint8Array([1]),
      contentType: 'image/webp',
    });

    await adapter.delete(KEY);
    await expect(adapter.download(KEY)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(adapter.delete(KEY)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('firma URLs de lectura y escritura y las verifica', async () => {
    const adapter = createAdapter();
    await adapter.upload({
      key: KEY,
      body: new Uint8Array([1]),
      contentType: 'image/webp',
    });

    const url = new URL(
      await adapter.getSignedUrl(KEY, {
        expiresInSeconds: 60,
        operation: 'get',
      }),
    );

    expect(url.origin).toBe('http://localhost:3000');
    expect(url.pathname).toBe(`/api/storage/local/${KEY}`);
    expect(url.searchParams.get('operation')).toBe('get');
    expect(url.searchParams.get('expires')).toBe(String(now / 1000 + 60));

    const params = {
      key: KEY,
      operation: 'get' as const,
      expiresAt: Number(url.searchParams.get('expires')),
      signature: url.searchParams.get('sig') ?? '',
    };

    await expect(adapter.verifyRequest(params)).resolves.toBe('ok');
    await expect(
      adapter.verifyRequest({ ...params, key: `${KEY}x` }),
    ).resolves.toBe('invalid');
    await expect(
      adapter.verifyRequest({
        ...params,
        signature: 'f'.repeat(64),
      }),
    ).resolves.toBe('invalid');

    now += 61_000;
    await expect(adapter.verifyRequest(params)).resolves.toBe('expired');
  });

  it('rechaza firmar una lectura inexistente y una caducidad excesiva', async () => {
    const adapter = createAdapter();

    await expect(
      adapter.getSignedUrl(KEY, { expiresInSeconds: 60, operation: 'get' }),
    ).rejects.toMatchObject({ code: 'not_found' });

    await adapter.upload({
      key: KEY,
      body: new Uint8Array([1]),
      contentType: 'image/webp',
    });

    await expect(
      adapter.getSignedUrl(KEY, { expiresInSeconds: 3601, operation: 'get' }),
    ).rejects.toMatchObject({ code: 'invalid_expiry' });
  });

  it('genera el secreto en disco si no se configura', async () => {
    const adapter = new LocalStorageAdapter({
      directory: join(root, 'storage'),
      secretFile,
      now: clock,
    });

    await adapter.getSignedUrl(KEY, { expiresInSeconds: 60, operation: 'put' });

    const value = (await readFile(secretFile, 'utf8')).trim();
    expect(value.length).toBeGreaterThanOrEqual(16);
  });

  it('limita el tamaño al subir y al descargar', async () => {
    const adapter = createAdapter();

    await expect(
      adapter.upload({
        key: KEY,
        body: new Uint8Array(LOCAL_STORAGE_MAX_BYTES + 1),
        contentType: 'image/webp',
      }),
    ).rejects.toMatchObject({ code: 'too_large' });

    await adapter.upload({
      key: KEY,
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/webp',
    });

    await expect(adapter.download(KEY, { maxBytes: 2 })).rejects.toMatchObject({
      code: 'too_large',
    });
  });

  it('rechaza escribir sobre un enlace simbólico', async () => {
    const adapter = createAdapter();
    const outside = join(root, 'outside.txt');
    const inside = join(root, 'storage', 'world', WORLD_ID, `${ASSET_ID}.webp`);

    await writeFile(outside, 'original');
    await adapter.upload({
      key: KEY,
      body: new Uint8Array([1]),
      contentType: 'image/webp',
    });
    await rm(inside);

    try {
      await symlink(outside, inside);
    } catch {
      // Windows puede exigir privilegios para crear enlaces simbólicos.
      return;
    }

    await expect(
      adapter.upload({
        key: KEY,
        body: new Uint8Array([9]),
        contentType: 'image/webp',
      }),
    ).rejects.toMatchObject({ code: 'invalid_key' });
    await expect(adapter.download(KEY)).rejects.toMatchObject({
      code: 'invalid_key',
    });
  });
});
