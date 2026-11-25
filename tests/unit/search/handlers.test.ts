import { describe, expect, it, vi } from 'vitest';

import { createUnavailableAssetsService } from '@/main/assets/service';
import { createUnavailableTrashService } from '@/main/trash/service';
import { createUnavailableVersionsService } from '@/main/versions/service';
import { createUnavailableEntitiesService } from '@/main/entities/service';
import { createUnavailableEntityTypesService } from '@/main/entity-types/service';
import { createIpcHandlers } from '@/main/ipc/handlers';
import { createUnavailableTransferCoordinator } from '@/main/transfer/unavailable-coordinator';
import { createIpcRouter } from '@/main/ipc/registry';
import { createUnavailablePreferencesService } from '@/main/preferences/service';
import { createUnavailableRelationsService } from '@/main/relations/service';
import type { SearchService } from '@/main/search/service';
import { createUnavailableUpdatesService } from '@/main/updates/service';
import { createUnavailableWorldsService } from '@/main/worlds/service';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type {
  SearchHit,
  SearchResponse,
  SearchSuggestions,
} from '@/shared/contracts/search';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';

const hit: SearchHit = {
  id: `entity:${ENTITY_ID}`,
  kind: 'entity',
  sourceId: ENTITY_ID,
  contextId: null,
  worldId: WORLD_ID,
  worldName: 'Las Mareas Grises',
  title: 'Gandalf el Gris',
  titleHighlight: '\u0001Gandalf\u0002 el Gris',
  snippet: 'Mago de la \u0001Tierra\u0002 Media',
  status: 'active',
  isFavorite: true,
  updatedAt: 1_760_000_000_000,
};

const response: SearchResponse = {
  items: [hit],
  total: 1,
  tookMs: 12,
  fuzzyTerms: ['gandalf'],
};

const suggestions: SearchSuggestions = {
  recent: [hit],
  favorites: [hit],
};

function createService(overrides: Partial<SearchService> = {}): SearchService {
  return {
    query: vi.fn(() => response),
    suggestions: vi.fn(() => suggestions),
    rebuild: vi.fn(() => ({ documents: 7, tookMs: 3 })),
    ...overrides,
  };
}

function createRoute(service: SearchService) {
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
      entities: createUnavailableEntitiesService(),
      relations: createUnavailableRelationsService(),
      search: service,
      assets: createUnavailableAssetsService(),

      trash: createUnavailableTrashService(),

      versions: createUnavailableVersionsService(),
      transfer: createUnavailableTransferCoordinator(),
      pickImages: async () => [],
    }),
  );
}

describe('handlers IPC de búsqueda', () => {
  it('delega la consulta con los filtros validados', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.searchQuery, {
        query: '  gandalf ',
        filters: { worldId: WORLD_ID, kind: 'entity', status: 'active' },
        limit: 10,
      }),
    ).resolves.toEqual({ ok: true, data: response });

    expect(service.query).toHaveBeenCalledWith({
      query: 'gandalf',
      filters: { worldId: WORLD_ID, kind: 'entity', status: 'active' },
      limit: 10,
    });
  });

  it('devuelve sugerencias y reconstruye el índice', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.searchSuggestions, { worldId: WORLD_ID }),
    ).resolves.toEqual({ ok: true, data: suggestions });
    await expect(route(IPC_CHANNELS.searchRebuild, {})).resolves.toEqual({
      ok: true,
      data: { documents: 7, tookMs: 3 },
    });

    expect(service.suggestions).toHaveBeenCalledWith({ worldId: WORLD_ID });
    expect(service.rebuild).toHaveBeenCalledTimes(1);
  });

  it('rechaza una entrada inválida sin llamar al servicio', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.searchQuery, { query: '', extra: true }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(service.query).not.toHaveBeenCalled();
  });

  it('convierte un fallo del servicio en INTERNAL_ERROR sin filtrar detalles', async () => {
    const route = createRoute(
      createService({
        query: () => {
          throw new Error('SQL interno y ruta privada');
        },
      }),
    );

    const result = await route(IPC_CHANNELS.searchQuery, { query: 'mara' });

    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(JSON.stringify(result)).not.toContain('SQL interno');
  });
});
