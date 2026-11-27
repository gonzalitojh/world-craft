import { describe, expect, it, vi } from 'vitest';

import type { AssetsService } from '@/main/assets/service';
import { createUnavailableEntityTypesService } from '@/main/entity-types/service';
import { createUnavailableEntitiesService } from '@/main/entities/service';
import { createIpcHandlers } from '@/main/ipc/handlers';
import { createIpcRouter } from '@/main/ipc/registry';
import { createUnavailablePreferencesService } from '@/main/preferences/service';
import { createUnavailableRelationsService } from '@/main/relations/service';
import { createUnavailableSearchService } from '@/main/search/service';
import { createUnavailableTransferCoordinator } from '@/main/transfer/unavailable-coordinator';
import { createUnavailableTrashService } from '@/main/trash/service';
import { createUnavailableUpdatesService } from '@/main/updates/service';
import { createUnavailableVersionsService } from '@/main/versions/service';
import { WorldInputError } from '@/main/worlds/errors';
import {
  createUnavailableWorldsService,
  type WorldsService,
} from '@/main/worlds/service';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type { WorldDetail } from '@/shared/contracts/worlds';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ASSET_ID = '01900000-0000-7000-8000-000000000002';

const world: WorldDetail = {
  id: WORLD_ID,
  name: 'Las Mareas Grises',
  slug: 'las-mareas-grises',
  summary: null,
  description: null,
  genres: [],
  language: 'es',
  status: 'active',
  coverAssetId: ASSET_ID,
  createdAt: 1_760_000_000_000,
  updatedAt: 1_760_000_000_000,
  archivedAt: null,
};

function createWorldsService(
  overrides: Partial<WorldsService> = {},
): WorldsService {
  return {
    ...createUnavailableWorldsService(),
    list: vi.fn(() => [world]),
    get: vi.fn(() => world),
    create: vi.fn(() => world),
    update: vi.fn(() => world),
    duplicate: vi.fn(() => world),
    setArchived: vi.fn(() => world),
    setCover: vi.fn(() => world),
    remove: vi.fn(() => true),
    listActivity: vi.fn(() => []),
    ...overrides,
  };
}

function createRoute(worlds: WorldsService) {
  return createIpcRouter(
    createIpcHandlers({
      openExternal: async () => {},
      updates: createUnavailableUpdatesService({
        reason: 'not-packaged',
        currentVersion: '0.1.0',
      }),
      preferences: createUnavailablePreferencesService(),
      worlds,
      entityTypes: createUnavailableEntityTypesService(),
      entities: createUnavailableEntitiesService(),
      relations: createUnavailableRelationsService(),
      search: createUnavailableSearchService(),
      assets: {
        assertAvailable: vi.fn(),
        list: vi.fn(() => []),
        importFiles: vi.fn(async () => []),
      } satisfies AssetsService,
      trash: createUnavailableTrashService(),
      versions: createUnavailableVersionsService(),
      transfer: createUnavailableTransferCoordinator(),
      pickImages: async () => [],
    }),
  );
}

describe('handlers IPC de mundos', () => {
  it('cambia la portada y devuelve el mundo actualizado', async () => {
    const worlds = createWorldsService();
    const route = createRoute(worlds);

    await expect(
      route(IPC_CHANNELS.worldsSetCover, {
        worldId: WORLD_ID,
        assetId: ASSET_ID,
      }),
    ).resolves.toEqual({ ok: true, data: world });
    expect(worlds.setCover).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
    });

    await expect(
      route(IPC_CHANNELS.worldsSetCover, { worldId: WORLD_ID, assetId: null }),
    ).resolves.toEqual({ ok: true, data: world });
    expect(worlds.setCover).toHaveBeenLastCalledWith({
      worldId: WORLD_ID,
      assetId: null,
    });
  });

  it('rechaza IDs no válidos y propiedades extra antes del servicio', async () => {
    const worlds = createWorldsService();
    const route = createRoute(worlds);

    await expect(
      route(IPC_CHANNELS.worldsSetCover, {
        worldId: 'no-es-uuid',
        assetId: null,
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });

    await expect(
      route(IPC_CHANNELS.worldsSetCover, {
        worldId: WORLD_ID,
        assetId: 'no-es-uuid',
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });

    await expect(
      route(IPC_CHANNELS.worldsSetCover, {
        worldId: WORLD_ID,
        assetId: null,
        extra: true,
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });

    expect(worlds.setCover).not.toHaveBeenCalled();
  });

  it('traduce el error de dominio de la portada a INVALID_INPUT', async () => {
    const worlds = createWorldsService({
      setCover: vi.fn(() => {
        throw new WorldInputError('asset ajeno');
      }),
    });
    const route = createRoute(worlds);

    await expect(
      route(IPC_CHANNELS.worldsSetCover, {
        worldId: WORLD_ID,
        assetId: ASSET_ID,
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('oculta un fallo interno como INTERNAL_ERROR', async () => {
    const worlds = createWorldsService({
      setCover: vi.fn(() => {
        throw new Error('detalle interno');
      }),
    });
    const route = createRoute(worlds);

    await expect(
      route(IPC_CHANNELS.worldsSetCover, { worldId: WORLD_ID, assetId: null }),
    ).resolves.toEqual({ ok: false, error: { code: 'INTERNAL_ERROR' } });
  });

  it('reenvía coverAssetId al actualizar y admite null', async () => {
    const worlds = createWorldsService();
    const route = createRoute(worlds);

    await expect(
      route(IPC_CHANNELS.worldsUpdate, {
        id: WORLD_ID,
        name: 'Las Mareas Grises',
        coverAssetId: ASSET_ID,
      }),
    ).resolves.toEqual({ ok: true, data: world });
    expect(worlds.update).toHaveBeenCalledWith({
      id: WORLD_ID,
      name: 'Las Mareas Grises',
      coverAssetId: ASSET_ID,
    });

    await expect(
      route(IPC_CHANNELS.worldsUpdate, {
        id: WORLD_ID,
        name: 'Las Mareas Grises',
        coverAssetId: null,
      }),
    ).resolves.toEqual({ ok: true, data: world });
    expect(worlds.update).toHaveBeenLastCalledWith({
      id: WORLD_ID,
      name: 'Las Mareas Grises',
      coverAssetId: null,
    });
  });
});
