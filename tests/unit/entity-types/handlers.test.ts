import { describe, expect, it, vi } from 'vitest';

import { createUnavailableAssetsService } from '@/main/assets/service';
import { createUnavailableEntitiesService } from '@/main/entities/service';
import { EntityTypeProtectedError } from '@/main/entity-types/errors';
import type { EntityTypesService } from '@/main/entity-types/service';
import { createIpcHandlers } from '@/main/ipc/handlers';
import { createIpcRouter } from '@/main/ipc/registry';
import { createUnavailablePreferencesService } from '@/main/preferences/service';
import { createUnavailableRelationsService } from '@/main/relations/service';
import { createUnavailableSearchService } from '@/main/search/service';
import { createUnavailableUpdatesService } from '@/main/updates/service';
import { createUnavailableWorldsService } from '@/main/worlds/service';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type { EntityTypeSummary } from '@/shared/contracts/entity-types';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const TYPE_ID = '01900000-0000-7000-8000-000000000002';

const entityType: EntityTypeSummary = {
  id: TYPE_ID,
  worldId: WORLD_ID,
  key: 'orden-del-alba',
  name: 'Orden del Alba',
  icon: 'crown',
  color: 'ochre',
  isSystem: false,
  fields: [],
  createdAt: 1_760_000_000_000,
  updatedAt: 1_760_000_000_000,
};

function createService(
  overrides: Partial<EntityTypesService> = {},
): EntityTypesService {
  return {
    list: vi.fn(() => [entityType]),
    create: vi.fn(() => entityType),
    update: vi.fn(() => null),
    duplicate: vi.fn(() => null),
    remove: vi.fn(() => ({ deleted: true })),
    exportTypes: vi.fn(() => ({ version: 1 as const, types: [] })),
    importTypes: vi.fn(() => []),
    copyFromWorld: vi.fn(),
    ...overrides,
  };
}

function createRoute(service: EntityTypesService) {
  return createIpcRouter(
    createIpcHandlers({
      openExternal: async () => {},
      updates: createUnavailableUpdatesService({
        reason: 'not-packaged',
        currentVersion: '0.1.0',
      }),
      preferences: createUnavailablePreferencesService(),
      worlds: createUnavailableWorldsService(),
      entityTypes: service,
      entities: createUnavailableEntitiesService(),
      relations: createUnavailableRelationsService(),
      search: createUnavailableSearchService(),
      assets: createUnavailableAssetsService(),
      pickImages: async () => [],
    }),
  );
}

describe('handlers IPC de tipos de entidad', () => {
  it('valida la entrada y devuelve la lista del servicio', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.entityTypesList, { worldId: WORLD_ID }),
    ).resolves.toEqual({ ok: true, data: [entityType] });
    expect(service.list).toHaveBeenCalledWith(WORLD_ID);

    await expect(
      route(IPC_CHANNELS.entityTypesList, { worldId: 'no-es-un-id' }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('traduce la protección del sistema a INVALID_INPUT', async () => {
    const service = createService({
      remove: vi.fn(() => {
        throw new EntityTypeProtectedError();
      }),
    });
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.entityTypesRemove, {
        worldId: WORLD_ID,
        id: TYPE_ID,
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('delega crear, actualizar y duplicar con el payload validado', async () => {
    const service = createService();
    const route = createRoute(service);
    const fields = [
      { key: 'leader', label: 'Líder', type: 'text', required: true },
    ];

    await route(IPC_CHANNELS.entityTypesCreate, {
      worldId: WORLD_ID,
      name: 'Orden del Alba',
      icon: 'crown',
      color: 'ochre',
      fields,
    });
    expect(service.create).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      name: 'Orden del Alba',
      icon: 'crown',
      color: 'ochre',
      fields,
    });

    await route(IPC_CHANNELS.entityTypesUpdate, {
      worldId: WORLD_ID,
      id: TYPE_ID,
      name: 'Orden del Alba',
      icon: 'crown',
      color: 'ochre',
      fields,
    });
    expect(service.update).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      id: TYPE_ID,
      name: 'Orden del Alba',
      icon: 'crown',
      color: 'ochre',
      fields,
    });

    await route(IPC_CHANNELS.entityTypesDuplicate, {
      worldId: WORLD_ID,
      id: TYPE_ID,
      name: 'Copia',
    });
    expect(service.duplicate).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      id: TYPE_ID,
      name: 'Copia',
    });
  });
});
