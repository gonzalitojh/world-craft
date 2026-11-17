import { describe, expect, it } from 'vitest';

import { AssetError } from '@/lib/assets/errors';
import type { ProcessedImage } from '@/lib/assets/image';
import { buildTempUploadKey, createAssetService } from '@/lib/assets/service';
import type {
  AssetListOptions,
  AssetRecord,
  AssetStore,
  NewAssetRecord,
} from '@/lib/assets/store';
import type { WorldRole } from '@/lib/assets/policy';
import {
  buildWorldAssetKey,
  StorageError,
  type StorageAdapter,
  type StorageSignedUrlOptions,
  type StorageUploadInput,
} from '@/lib/storage';
import { buildThumbnailKey } from '@/lib/storage/thumbnail-key';
import { MemoryStorageAdapter } from '../../helpers/memory-storage';

const WORLD_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_WORLD_ID = '22222222-2222-4222-8222-222222222222';
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EDITOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STRANGER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ASSET_ID = '33333333-3333-4333-8333-333333333333';
const BUCKET = 'world-craft-test';

const PROCESSED: ProcessedImage = {
  body: new Uint8Array([1, 2, 3]),
  mime: 'image/webp',
  width: 120,
  height: 80,
  thumbnail: {
    body: new Uint8Array([4, 5]),
    mime: 'image/webp',
    width: 48,
    height: 32,
  },
  inputMime: 'image/png',
};

interface Log {
  calls: string[];
}

class FakeStore implements AssetStore {
  readonly roles = new Map<string, WorldRole>();

  readonly records = new Map<string, AssetRecord>();

  insertError: Error | undefined;

  findError: Error | undefined;

  removeError: Error | undefined;

  constructor(private readonly log: Log) {}

  setRole(actorId: string, role: WorldRole, worldId = WORLD_ID): void {
    this.roles.set(`${actorId}:${worldId}`, role);
  }

  async getRole(actorId: string, worldId: string): Promise<WorldRole | null> {
    return this.roles.get(`${actorId}:${worldId}`) ?? null;
  }

  async insert(_actorId: string, input: NewAssetRecord): Promise<AssetRecord> {
    this.log.calls.push('store:insert');

    if (this.insertError !== undefined) {
      throw this.insertError;
    }

    const record: AssetRecord = {
      ...input,
      createdAt: new Date('2026-11-16T10:00:00Z'),
    };

    this.records.set(record.id, record);

    return record;
  }

  async find(
    _actorId: string,
    worldId: string,
    assetId: string,
  ): Promise<AssetRecord | null> {
    if (this.findError !== undefined) {
      throw this.findError;
    }

    const record = this.records.get(assetId);

    return record !== undefined && record.worldId === worldId ? record : null;
  }

  async list(
    _actorId: string,
    worldId: string,
    options: AssetListOptions = {},
  ): Promise<AssetRecord[]> {
    const records = [...this.records.values()]
      .filter((record) => record.worldId === worldId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options.cursor === undefined) {
      return records.slice(0, options.limit ?? 50);
    }

    return records.slice(options.limit ?? 50);
  }

  async remove(
    _actorId: string,
    worldId: string,
    assetId: string,
  ): Promise<AssetRecord | null> {
    this.log.calls.push('store:remove');

    if (this.removeError !== undefined) {
      throw this.removeError;
    }

    const record = await this.find(_actorId, worldId, assetId);

    if (record === null) {
      return null;
    }

    this.records.delete(assetId);

    return record;
  }
}

class RecordingStorage implements StorageAdapter {
  failUploadKeys = new Set<string>();

  failDeleteKeys = new Set<string>();

  readonly signedOptions: StorageSignedUrlOptions[] = [];

  readonly downloadErrors = new Map<string, StorageError>();

  private readonly inner = new MemoryStorageAdapter();

  constructor(private readonly log: Log) {}

  async upload(input: StorageUploadInput) {
    this.log.calls.push(`storage:upload:${input.key}`);

    if (this.failUploadKeys.has(input.key)) {
      throw new StorageError('unavailable', 'fallo simulado de subida');
    }

    return this.inner.upload(input);
  }

  async getSignedUrl(key: string, options: StorageSignedUrlOptions) {
    this.log.calls.push(`storage:sign:${options.operation}:${key}`);
    this.signedOptions.push(options);

    return this.inner.getSignedUrl(key, options);
  }

  async delete(key: string): Promise<void> {
    this.log.calls.push(`storage:delete:${key}`);

    if (this.failDeleteKeys.has(key)) {
      throw new StorageError('unavailable', 'fallo simulado de borrado');
    }

    try {
      await this.inner.delete(key);
    } catch (error) {
      // El servicio tolera objetos ausentes; no debe romper el borrado.
      if (error instanceof StorageError && error.code === 'not_found') {
        return;
      }

      throw error;
    }
  }

  async list(prefix: string, options?: Parameters<StorageAdapter['list']>[1]) {
    return this.inner.list(prefix, options);
  }

  async download(key: string, options?: { maxBytes?: number }) {
    const error = this.downloadErrors.get(key);

    if (error !== undefined) {
      throw error;
    }

    return this.inner.download(key, options);
  }

  exists(key: string): boolean {
    return this.inner.read(key) !== undefined;
  }
}

interface Harness {
  service: ReturnType<typeof createAssetService>;
  store: FakeStore;
  storage: RecordingStorage;
  log: Log;
  cleanup: { key: string; error: unknown }[];
}

function createHarness(
  options: {
    processImage?: (input: Uint8Array) => Promise<ProcessedImage>;
  } = {},
): Harness {
  const log: Log = { calls: [] };
  const store = new FakeStore(log);
  const storage = new RecordingStorage(log);
  const cleanup: { key: string; error: unknown }[] = [];

  store.setRole(OWNER, 'owner');
  store.setRole(EDITOR, 'editor');
  store.setRole(VIEWER, 'viewer');

  const service = createAssetService({
    storage,
    store,
    bucket: BUCKET,
    createId: () => ASSET_ID,
    processImage: options.processImage ?? (async () => PROCESSED),
    onCleanupError: (event) => cleanup.push(event),
  });

  return { service, store, storage, log, cleanup };
}

/** Sube un temporal con el ticket de requestUpload. */
async function prepareTemp(
  harness: Harness,
  actorId = EDITOR,
): Promise<{ assetId: string; key: string }> {
  const ticket = await harness.service.requestUpload(
    { userId: actorId },
    { worldId: WORLD_ID, contentType: 'image/png', size: 1024 },
  );

  await harness.storage.upload({
    key: ticket.key,
    body: new Uint8Array([9, 9, 9]),
    contentType: 'image/png',
  });

  return { assetId: ticket.assetId, key: ticket.key };
}

async function expectAssetError(
  promise: Promise<unknown>,
  code: AssetError['code'],
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AssetError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('requestUpload', () => {
  it('firma un PUT de un temporal para owner y editor', async () => {
    const harness = createHarness();

    for (const actorId of [OWNER, EDITOR]) {
      const ticket = await harness.service.requestUpload(
        { userId: actorId },
        { worldId: WORLD_ID, contentType: 'image/png', size: 1000 },
      );

      expect(ticket.assetId).toBe(ASSET_ID);
      expect(ticket.key).toBe(buildTempUploadKey(WORLD_ID, ASSET_ID));
      // El lifecycle de R2 purga `tmp/`; los objetos publicados no viven ahí.
      expect(ticket.key.startsWith('tmp/')).toBe(true);
      expect(ticket.uploadUrl).toContain('operation=put');
      expect(ticket.expiresInSeconds).toBe(600);
      expect(ticket.maxBytes).toBe(10 * 1024 * 1024);
      expect(harness.storage.signedOptions.at(-1)).toMatchObject({
        operation: 'put',
        contentType: 'image/png',
        contentLength: 1000,
      });
    }
  });

  it('prohíbe subir a un viewer', async () => {
    const harness = createHarness();

    await expectAssetError(
      harness.service.requestUpload(
        { userId: VIEWER },
        { worldId: WORLD_ID, contentType: 'image/png', size: 10 },
      ),
      'forbidden',
    );
  });

  it('devuelve not_found a quien no es miembro, sin revelar el mundo', async () => {
    const harness = createHarness();

    await expectAssetError(
      harness.service.requestUpload(
        { userId: STRANGER },
        { worldId: WORLD_ID, contentType: 'image/png', size: 10 },
      ),
      'not_found',
    );
  });

  it('rechaza MIME no permitido y tamaños fuera de rango', async () => {
    const harness = createHarness();

    await expectAssetError(
      harness.service.requestUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, contentType: 'image/svg+xml', size: 10 },
      ),
      'unsupported_type',
    );
    await expectAssetError(
      harness.service.requestUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, contentType: 'image/png', size: 0 },
      ),
      'too_large',
    );
    await expectAssetError(
      harness.service.requestUpload(
        { userId: EDITOR },
        {
          worldId: WORLD_ID,
          contentType: 'image/png',
          size: 10 * 1024 * 1024 + 1,
        },
      ),
      'too_large',
    );
  });
});

describe('finalizeUpload', () => {
  it('procesa, publica WebP y miniatura, inserta y limpia el temporal', async () => {
    const harness = createHarness();
    const { assetId, key } = await prepareTemp(harness);
    harness.log.calls.length = 0;

    const record = await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId, alt: '  Un mapa  ' },
    );

    const path = buildWorldAssetKey(WORLD_ID, assetId, 'webp');
    const thumb = buildThumbnailKey(WORLD_ID, assetId);

    expect(record).toMatchObject({
      id: assetId,
      worldId: WORLD_ID,
      bucket: BUCKET,
      path,
      mime: 'image/webp',
      size: 3,
      width: 120,
      height: 80,
      alt: 'Un mapa',
    });

    expect(harness.storage.exists(path)).toBe(true);
    expect(harness.storage.exists(thumb)).toBe(true);
    expect(harness.storage.exists(key)).toBe(false);
    expect(harness.log.calls).toEqual([
      `storage:upload:${path}`,
      `storage:upload:${thumb}`,
      'store:insert',
      `storage:delete:${key}`,
    ]);
  });

  it('no es idempotente: la segunda llamada no encuentra el temporal', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);

    await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId },
    );

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
      'not_found',
    );
  });

  it('compensa los objetos si falla la inserción de metadatos', async () => {
    const harness = createHarness();
    const { assetId, key } = await prepareTemp(harness);
    harness.store.insertError = new Error('fallo de base de datos');

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
      'storage_unavailable',
    );

    expect(harness.storage.exists(key)).toBe(true);
    expect(
      harness.storage.exists(buildWorldAssetKey(WORLD_ID, assetId, 'webp')),
    ).toBe(false);
    expect(harness.storage.exists(buildThumbnailKey(WORLD_ID, assetId))).toBe(
      false,
    );
    expect(harness.store.records.size).toBe(0);
  });

  it('compensa el WebP si falla la miniatura', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);
    harness.storage.failUploadKeys.add(buildThumbnailKey(WORLD_ID, assetId));

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
      'storage_unavailable',
    );

    expect(
      harness.storage.exists(buildWorldAssetKey(WORLD_ID, assetId, 'webp')),
    ).toBe(false);
    expect(harness.store.records.size).toBe(0);
  });

  it('propaga el error del pipeline sin publicar nada', async () => {
    const harness = createHarness({
      processImage: async () => {
        throw new AssetError('invalid_image', 'no es una imagen');
      },
    });
    const { assetId, key } = await prepareTemp(harness);
    harness.log.calls.length = 0;

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
      'invalid_image',
    );

    // El temporal ya no sirve: se borra para no dejar basura en `tmp/`.
    expect(harness.storage.exists(key)).toBe(false);
    expect(
      harness.log.calls.filter((call) => call.startsWith('storage:upload')),
    ).toEqual([]);
  });

  it('un reintento con la fila ya insertada limpia el temporal y no borra los objetos', async () => {
    const harness = createHarness();
    const { assetId, key } = await prepareTemp(harness);
    const path = buildWorldAssetKey(WORLD_ID, assetId, 'webp');
    const thumb = buildThumbnailKey(WORLD_ID, assetId);

    // Simula que el primer finalize insertó la fila pero falló al limpiar el
    // temporal: el reintento vuelve a procesar y publicar, y el INSERT choca
    // con la clave primaria.
    harness.store.records.set(assetId, {
      id: assetId,
      worldId: WORLD_ID,
      uploaderId: EDITOR,
      bucket: BUCKET,
      path,
      mime: 'image/webp',
      size: 3,
      width: 120,
      height: 80,
      alt: '',
      createdAt: new Date('2026-11-16T10:00:00Z'),
    });
    harness.store.insertError = new Error('duplicate key');

    const record = await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId },
    );

    expect(record.id).toBe(assetId);
    expect(harness.storage.exists(path)).toBe(true);
    expect(harness.storage.exists(thumb)).toBe(true);
    expect(harness.storage.exists(key)).toBe(false);
    expect(harness.cleanup).toEqual([]);
  });

  it('si la fila existente apunta a otro path, no borra los objetos publicados', async () => {
    const harness = createHarness();
    const { assetId, key } = await prepareTemp(harness);

    harness.store.records.set(assetId, {
      id: assetId,
      worldId: WORLD_ID,
      uploaderId: EDITOR,
      bucket: BUCKET,
      path: 'world/otro/asset.webp',
      mime: 'image/webp',
      size: 3,
      width: 120,
      height: 80,
      alt: '',
      createdAt: new Date('2026-11-16T10:00:00Z'),
    });
    harness.store.insertError = new Error('duplicate key');

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
      'storage_unavailable',
    );

    expect(
      harness.storage.exists(buildWorldAssetKey(WORLD_ID, assetId, 'webp')),
    ).toBe(true);
    expect(harness.storage.exists(key)).toBe(false);
  });

  it('no compensa si no puede confirmar si hay fila', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);

    // `insert` falla y la comprobación posterior también: borrar a ciegas
    // podría dejar una fila apuntando a objetos inexistentes.
    harness.store.insertError = new Error('fallo de base de datos');
    harness.store.findError = new Error('base de datos caída');

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
      'storage_unavailable',
    );

    expect(
      harness.storage.exists(buildWorldAssetKey(WORLD_ID, assetId, 'webp')),
    ).toBe(true);
  });

  it('borra el temporal si supera el límite al recuperarlo', async () => {
    const harness = createHarness();
    const { assetId, key } = await prepareTemp(harness);
    harness.storage.downloadErrors.set(
      key,
      new StorageError('too_large', 'demasiado grande'),
    );

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
      'too_large',
    );

    expect(harness.storage.exists(key)).toBe(false);
  });

  it('rechaza un alt demasiado largo y a un viewer', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId, alt: 'x'.repeat(501) },
      ),
      'invalid_input',
    );

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: VIEWER },
        { worldId: WORLD_ID, assetId },
      ),
      'forbidden',
    );
  });

  it('trata un mundo inexistente o ajeno como not_found', async () => {
    const harness = createHarness();

    await expectAssetError(
      harness.service.finalizeUpload(
        { userId: STRANGER },
        { worldId: OTHER_WORLD_ID, assetId: ASSET_ID },
      ),
      'not_found',
    );
  });
});

describe('getDownloadUrl', () => {
  it('firma la descarga y la miniatura para cualquier miembro', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);

    await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId },
    );

    const ticket = await harness.service.getDownloadUrl(
      { userId: VIEWER },
      { worldId: WORLD_ID, assetId, expiresInSeconds: 120 },
    );

    expect(ticket.url).toContain(buildWorldAssetKey(WORLD_ID, assetId, 'webp'));
    expect(ticket.thumbnailUrl).toContain(buildThumbnailKey(WORLD_ID, assetId));
    expect(ticket.expiresInSeconds).toBe(120);
    expect(ticket.asset.id).toBe(assetId);
  });

  it('rechaza caducidades inválidas y assets inexistentes', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);

    await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId },
    );

    await expectAssetError(
      harness.service.getDownloadUrl(
        { userId: VIEWER },
        { worldId: WORLD_ID, assetId, expiresInSeconds: 0 },
      ),
      'invalid_input',
    );

    await expectAssetError(
      harness.service.getDownloadUrl(
        { userId: VIEWER },
        { worldId: WORLD_ID, assetId: 'no-es-uuid' },
      ),
      'invalid_input',
    );

    await expectAssetError(
      harness.service.getDownloadUrl(
        { userId: STRANGER },
        { worldId: WORLD_ID, assetId },
      ),
      'not_found',
    );
  });
});

describe('deleteAsset', () => {
  it('borra primero la fila y después los objetos', async () => {
    const harness = createHarness();
    const { assetId, key } = await prepareTemp(harness);

    await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId },
    );
    harness.log.calls.length = 0;

    await expect(
      harness.service.deleteAsset(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
    ).resolves.toEqual({ id: assetId });

    expect(harness.log.calls).toEqual([
      'store:remove',
      `storage:delete:${buildWorldAssetKey(WORLD_ID, assetId, 'webp')}`,
      `storage:delete:${buildThumbnailKey(WORLD_ID, assetId)}`,
    ]);
    expect(harness.storage.exists(key)).toBe(false);
    expect(harness.store.records.size).toBe(0);
  });

  it('un viewer no puede borrar', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);

    await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId },
    );

    await expectAssetError(
      harness.service.deleteAsset(
        { userId: VIEWER },
        { worldId: WORLD_ID, assetId },
      ),
      'forbidden',
    );
  });

  it('si R2 falla, registra el huérfano y devuelve éxito', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);

    await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId },
    );

    harness.storage.failDeleteKeys.add(
      buildWorldAssetKey(WORLD_ID, assetId, 'webp'),
    );

    await expect(
      harness.service.deleteAsset(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId },
      ),
    ).resolves.toEqual({ id: assetId });

    expect(harness.cleanup).toHaveLength(1);
    expect(harness.cleanup[0]?.key).toBe(
      buildWorldAssetKey(WORLD_ID, assetId, 'webp'),
    );
    expect(harness.store.records.size).toBe(0);
  });

  it('devuelve not_found si el asset no existe', async () => {
    const harness = createHarness();

    await expectAssetError(
      harness.service.deleteAsset(
        { userId: EDITOR },
        { worldId: WORLD_ID, assetId: ASSET_ID },
      ),
      'not_found',
    );
  });
});

describe('listAssets', () => {
  it('lista para cualquier miembro y limita el tamaño de página', async () => {
    const harness = createHarness();
    const { assetId } = await prepareTemp(harness);

    await harness.service.finalizeUpload(
      { userId: EDITOR },
      { worldId: WORLD_ID, assetId },
    );

    const page = await harness.service.listAssets(
      { userId: VIEWER },
      { worldId: WORLD_ID, limit: 1000 },
    );

    expect(page.assets).toHaveLength(1);
    expect(page.nextCursor).toBeUndefined();
    expect(page.assets[0]?.id).toBe(assetId);
  });

  it('no revela nada a quien no es miembro', async () => {
    const harness = createHarness();

    await expectAssetError(
      harness.service.listAssets({ userId: STRANGER }, { worldId: WORLD_ID }),
      'not_found',
    );
  });
});
