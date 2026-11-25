import { describe, expect, it, vi } from 'vitest';

import { AssetError } from '@/main/assets/errors';
import type { AssetsService } from '@/main/assets/service';
import { EntityInputError } from '@/main/entities/errors';
import type { EntitiesService } from '@/main/entities/service';
import { createUnavailableEntityTypesService } from '@/main/entity-types/service';
import { createIpcHandlers } from '@/main/ipc/handlers';
import { createUnavailableTransferCoordinator } from '@/main/transfer/unavailable-coordinator';
import { createIpcRouter } from '@/main/ipc/registry';
import { createUnavailablePreferencesService } from '@/main/preferences/service';
import { createUnavailableRelationsService } from '@/main/relations/service';
import { createUnavailableSearchService } from '@/main/search/service';
import { createUnavailableTrashService } from '@/main/trash/service';
import { createUnavailableUpdatesService } from '@/main/updates/service';
import { createUnavailableVersionsService } from '@/main/versions/service';
import { createUnavailableWorldsService } from '@/main/worlds/service';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type { EntityDetail, EntityTag } from '@/shared/contracts/entities';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const TYPE_ID = '01900000-0000-7000-8000-000000000002';
const ENTITY_ID = '01900000-0000-7000-8000-000000000003';
const TAG_ID = '01900000-0000-7000-8000-000000000004';

const tag: EntityTag = {
  id: TAG_ID,
  worldId: WORLD_ID,
  name: 'Norte',
  color: 'moss',
  createdAt: 1_760_000_000_000,
};

const detail: EntityDetail = {
  id: ENTITY_ID,
  worldId: WORLD_ID,
  typeId: TYPE_ID,
  typeKey: 'character',
  typeName: 'Personaje',
  typeIcon: 'user-round',
  typeColor: 'moss',
  name: 'Mara',
  slug: 'mara',
  aliases: [],
  summary: null,
  imageAssetId: null,
  isFavorite: false,
  status: 'active',
  tags: [],
  createdAt: 1_760_000_000_000,
  updatedAt: 1_760_000_000_000,
  description: null,
  attributes: {},
  gallery: [],
};

function createEntitiesService(
  overrides: Partial<EntitiesService> = {},
): EntitiesService {
  return {
    list: vi.fn(() => [detail]),
    get: vi.fn(() => detail),
    create: vi.fn(() => detail),
    update: vi.fn(() => detail),
    setFavorite: vi.fn(() => detail),
    remove: vi.fn(() => ({ deleted: true })),
    listTags: vi.fn(() => [tag]),
    createTag: vi.fn(() => tag),
    ...overrides,
  };
}

function createAssetsService(
  overrides: Partial<AssetsService> = {},
): AssetsService {
  return {
    assertAvailable: vi.fn(),
    list: vi.fn(() => []),
    importFiles: vi.fn(async () => []),
    ...overrides,
  };
}

function createRoute(options?: {
  readonly entities?: EntitiesService;
  readonly assets?: AssetsService;
  readonly pickImages?: () => Promise<readonly string[]>;
}) {
  return createIpcRouter(
    createIpcHandlers({
      openExternal: async () => {},
      updates: createUnavailableUpdatesService({
        reason: 'not-packaged',
        currentVersion: '0.1.0',
      }),
      preferences: createUnavailablePreferencesService(),
      worlds: createUnavailableWorldsService(),
      entityTypes: createUnavailableEntityTypesService(),
      entities: options?.entities ?? createEntitiesService(),
      relations: createUnavailableRelationsService(),
      search: createUnavailableSearchService(),
      assets: options?.assets ?? createAssetsService(),
      trash: createUnavailableTrashService(),
      versions: createUnavailableVersionsService(),
      transfer: createUnavailableTransferCoordinator(),
      pickImages: options?.pickImages ?? (async () => []),
    }),
  );
}

describe('handlers IPC de fichas y assets', () => {
  it('lista fichas y etiquetas con el mundo validado', async () => {
    const entities = createEntitiesService();
    const route = createRoute({ entities });

    await expect(
      route(IPC_CHANNELS.entitiesList, {
        worldId: WORLD_ID,
        filter: { favorite: true, search: 'mara' },
      }),
    ).resolves.toEqual({ ok: true, data: [detail] });
    expect(entities.list).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      filter: { favorite: true, search: 'mara' },
    });

    await expect(
      route(IPC_CHANNELS.tagsList, { worldId: WORLD_ID }),
    ).resolves.toEqual({ ok: true, data: [tag] });
    expect(entities.listTags).toHaveBeenCalledWith(WORLD_ID);
  });

  it('rechaza una entrada inválida antes de llamar al servicio', async () => {
    const entities = createEntitiesService();
    const route = createRoute({ entities });

    await expect(
      route(IPC_CHANNELS.entitiesList, { worldId: 'no-es-uuid' }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(entities.list).not.toHaveBeenCalled();
  });

  it('traduce el error de dominio de una ficha a INVALID_INPUT', async () => {
    const entities = createEntitiesService({
      create: vi.fn(() => {
        throw new EntityInputError('referencia inválida');
      }),
    });
    const route = createRoute({ entities });

    await expect(
      route(IPC_CHANNELS.entitiesCreate, {
        worldId: WORLD_ID,
        typeId: TYPE_ID,
        name: 'Mara',
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('cambia el favorito y borra con el mundo y el id', async () => {
    const entities = createEntitiesService();
    const route = createRoute({ entities });

    await expect(
      route(IPC_CHANNELS.entitiesSetFavorite, {
        worldId: WORLD_ID,
        id: ENTITY_ID,
        favorite: true,
      }),
    ).resolves.toEqual({ ok: true, data: detail });
    expect(entities.setFavorite).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      id: ENTITY_ID,
      favorite: true,
    });

    await expect(
      route(IPC_CHANNELS.entitiesRemove, {
        worldId: WORLD_ID,
        id: ENTITY_ID,
      }),
    ).resolves.toEqual({ ok: true, data: { deleted: true } });
  });

  it('importa desde el selector nativo y devuelve vacío al cancelar', async () => {
    const assets = createAssetsService({
      importFiles: vi.fn(async () => [
        {
          id: TAG_ID,
          worldId: WORLD_ID,
          width: 100,
          height: 100,
          alt: null,
          createdAt: 1_760_000_000_000,
        },
      ]),
    });
    const pickImages = vi.fn(async () => ['C:\\tmp\\imagen.png']);
    const route = createRoute({ assets, pickImages });

    await expect(
      route(IPC_CHANNELS.assetsImport, { worldId: WORLD_ID }),
    ).resolves.toEqual({
      ok: true,
      data: {
        imported: [
          {
            id: TAG_ID,
            worldId: WORLD_ID,
            width: 100,
            height: 100,
            alt: null,
            createdAt: 1_760_000_000_000,
          },
        ],
      },
    });
    expect(assets.importFiles).toHaveBeenCalledWith(
      WORLD_ID,
      ['C:\\tmp\\imagen.png'],
      undefined,
    );

    const cancelRoute = createRoute({
      assets: createAssetsService(),
      pickImages: async () => [],
    });
    await expect(
      cancelRoute(IPC_CHANNELS.assetsImport, { worldId: WORLD_ID }),
    ).resolves.toEqual({ ok: true, data: { imported: [] } });
  });

  it('traduce un fallo de assets a INVALID_INPUT', async () => {
    const route = createRoute({
      assets: createAssetsService({
        list: vi.fn(() => {
          throw new AssetError('ASSET_NOT_FOUND');
        }),
      }),
    });

    await expect(
      route(IPC_CHANNELS.assetsList, { worldId: WORLD_ID }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });
});
