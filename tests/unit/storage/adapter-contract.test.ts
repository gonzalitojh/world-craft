import { describe, expect, it } from 'vitest';

import {
  buildWorldAssetKey,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
  type StorageAdapter,
  StorageError,
} from '@/lib/storage';
import { MemoryStorageAdapter } from '../../helpers/memory-storage';

const WORLD_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_IDS = [
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
] as const;

const BODY = new Uint8Array([1, 2, 3, 4]);

function createAdapter(): StorageAdapter {
  return new MemoryStorageAdapter();
}

describe('contrato de StorageAdapter', () => {
  it('sube un objeto y devuelve sus metadatos', async () => {
    const adapter = createAdapter();
    const key = buildWorldAssetKey(WORLD_ID, ASSET_IDS[0], 'png');

    const stored = await adapter.upload({
      key,
      body: BODY,
      contentType: 'image/png',
    });

    expect(stored.key).toBe(key);
    expect(stored.size).toBe(BODY.byteLength);
    expect(stored.contentType).toBe('image/png');
    expect(stored.lastModified).toBeInstanceOf(Date);
  });

  it('firma una URL de lectura de corta duración', async () => {
    const adapter = createAdapter();
    const key = buildWorldAssetKey(WORLD_ID, ASSET_IDS[0], 'png');
    await adapter.upload({ key, body: BODY, contentType: 'image/png' });

    const url = await adapter.getSignedUrl(key, {
      expiresInSeconds: 60,
      operation: 'get',
    });

    expect(url).toContain(key.split('/').map(encodeURIComponent).join('/'));
    expect(url).toContain('operation=get');
    expect(url).toContain('expires=60');
  });

  it('firma una URL de subida aunque el objeto no exista', async () => {
    const adapter = createAdapter();
    const key = buildWorldAssetKey(WORLD_ID, ASSET_IDS[1], 'webp');

    await expect(
      adapter.getSignedUrl(key, { expiresInSeconds: 300, operation: 'put' }),
    ).resolves.toContain('operation=put');
  });

  it('rechaza una caducidad fuera del máximo', async () => {
    const adapter = createAdapter();
    const key = buildWorldAssetKey(WORLD_ID, ASSET_IDS[0], 'png');
    await adapter.upload({ key, body: BODY, contentType: 'image/png' });

    await expect(
      adapter.getSignedUrl(key, {
        expiresInSeconds: MAX_SIGNED_URL_EXPIRY_SECONDS + 1,
        operation: 'get',
      }),
    ).rejects.toMatchObject({ code: 'invalid_expiry' });
  });

  it('rechaza caducidades no enteras o no positivas', async () => {
    const adapter = createAdapter();
    const key = buildWorldAssetKey(WORLD_ID, ASSET_IDS[0], 'png');
    await adapter.upload({ key, body: BODY, contentType: 'image/png' });

    for (const expiresInSeconds of [0, -1, 1.5]) {
      await expect(
        adapter.getSignedUrl(key, { expiresInSeconds, operation: 'get' }),
      ).rejects.toBeInstanceOf(StorageError);
    }
  });

  it('devuelve not_found al firmar una lectura inexistente', async () => {
    const adapter = createAdapter();
    const key = buildWorldAssetKey(WORLD_ID, ASSET_IDS[2], 'png');

    await expect(
      adapter.getSignedUrl(key, { expiresInSeconds: 60, operation: 'get' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('borra un objeto y avisa si ya no existe', async () => {
    const adapter = createAdapter();
    const key = buildWorldAssetKey(WORLD_ID, ASSET_IDS[0], 'png');
    await adapter.upload({ key, body: BODY, contentType: 'image/png' });

    await adapter.delete(key);
    await expect(adapter.delete(key)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('lista por prefijo y pagina con cursor', async () => {
    const adapter = createAdapter();

    for (const assetId of ASSET_IDS) {
      await adapter.upload({
        key: buildWorldAssetKey(WORLD_ID, assetId, 'png'),
        body: BODY,
        contentType: 'image/png',
      });
    }

    const firstPage = await adapter.list(`world/${WORLD_ID}/`, { limit: 2 });

    expect(firstPage.objects).toHaveLength(2);

    const cursor = firstPage.cursor;

    if (cursor === undefined) {
      throw new Error('La primera página debería traer cursor');
    }

    const secondPage = await adapter.list(`world/${WORLD_ID}/`, {
      limit: 2,
      cursor,
    });

    expect(secondPage.objects).toHaveLength(1);
    expect(secondPage.cursor).toBeUndefined();
  });

  it('devuelve una lista vacía para un prefijo sin objetos', async () => {
    const adapter = createAdapter();
    const result = await adapter.list('world/other/');

    expect(result.objects).toEqual([]);
    expect(result.cursor).toBeUndefined();
  });

  it('rechaza una clave vacía al subir', async () => {
    const adapter = createAdapter();

    await expect(
      adapter.upload({ key: '', body: BODY, contentType: 'image/png' }),
    ).rejects.toMatchObject({ code: 'invalid_key' });
  });

  it('descarga un objeto y respeta el límite de tamaño', async () => {
    const adapter = createAdapter();
    const key = buildWorldAssetKey(WORLD_ID, ASSET_IDS[0], 'png');
    await adapter.upload({ key, body: BODY, contentType: 'image/png' });

    const download = adapter.download?.bind(adapter);

    expect(download).toBeTypeOf('function');
    await expect(download!(key)).resolves.toEqual(BODY);
    await expect(download!(key, { maxBytes: 2 })).rejects.toMatchObject({
      code: 'too_large',
    });
    await expect(
      download!(buildWorldAssetKey(WORLD_ID, ASSET_IDS[1], 'png')),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
