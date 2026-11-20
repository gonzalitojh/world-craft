import { describe, expect, it, vi } from 'vitest';

import { createUnavailableAssetsService } from '@/main/assets/service';
import { createUnavailableEntitiesService } from '@/main/entities/service';
import { createUnavailableEntityTypesService } from '@/main/entity-types/service';
import { createIpcHandlers } from '@/main/ipc/handlers';
import { createIpcRouter } from '@/main/ipc/registry';
import {
  RelationInputError,
  RelationTypeProtectedError,
} from '@/main/relations/errors';
import type { RelationsService } from '@/main/relations/service';
import { createUnavailableUpdatesService } from '@/main/updates/service';
import { createUnavailableWorldsService } from '@/main/worlds/service';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type { RelationEdge, RelationType } from '@/shared/contracts/relations';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ID = '01900000-0000-7000-8000-000000000002';
const OTHER_ID = '01900000-0000-7000-8000-000000000003';
const TYPE_ID = '018f0000-0000-7000-8000-000000000109';
const BASE_TIME = 1_760_000_000_000;

const relationType: RelationType = {
  id: TYPE_ID,
  worldId: null,
  key: 'located-in',
  name: 'Ubicado en',
  inverseName: 'Contiene',
  color: 'prussian',
  isSystem: true,
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const edge: RelationEdge = {
  id: ID,
  worldId: WORLD_ID,
  typeId: TYPE_ID,
  typeKey: 'located-in',
  typeName: 'Ubicado en',
  typeInverseName: 'Contiene',
  typeColor: 'prussian',
  isSystemType: true,
  label: null,
  inverseLabel: null,
  notes: null,
  strength: 1,
  metadata: {},
  source: {
    id: ID,
    name: 'Mara',
    typeKey: 'character',
    typeName: 'Personaje',
    typeIcon: 'user-round',
    typeColor: 'moss',
  },
  target: {
    id: OTHER_ID,
    name: 'Puerto Sal',
    typeKey: 'city',
    typeName: 'Ciudad',
    typeIcon: 'building-2',
    typeColor: 'ochre',
  },
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

function createService(
  overrides: Partial<RelationsService> = {},
): RelationsService {
  return {
    listTypes: vi.fn(() => [relationType]),
    createType: vi.fn(() => relationType),
    updateType: vi.fn(() => relationType),
    removeType: vi.fn(() => ({ deleted: true })),
    list: vi.fn(() => [edge]),
    create: vi.fn(() => edge),
    update: vi.fn(() => edge),
    remove: vi.fn(() => ({ deleted: true })),
    ...overrides,
  };
}

function createRoute(service: RelationsService) {
  return createIpcRouter(
    createIpcHandlers({
      openExternal: async () => {},
      updates: createUnavailableUpdatesService({
        reason: 'not-packaged',
        currentVersion: '0.1.0',
      }),
      worlds: createUnavailableWorldsService(),
      entityTypes: createUnavailableEntityTypesService(),
      entities: createUnavailableEntitiesService(),
      relations: service,
      assets: createUnavailableAssetsService(),
      pickImages: async () => [],
    }),
  );
}

describe('handlers IPC de relaciones', () => {
  it('delega la lista y la creación con el payload validado', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.relationsList, {
        worldId: WORLD_ID,
        filter: { entityId: ID },
      }),
    ).resolves.toEqual({ ok: true, data: [edge] });
    expect(service.list).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      filter: { entityId: ID },
    });

    await expect(
      route(IPC_CHANNELS.relationsCreate, {
        worldId: WORLD_ID,
        sourceId: ID,
        targetId: OTHER_ID,
        typeId: TYPE_ID,
      }),
    ).resolves.toEqual({ ok: true, data: edge });
  });

  it('traduce los errores de dominio y rechaza payloads inválidos', async () => {
    const service = createService({
      create: vi.fn(() => {
        throw new RelationInputError('duplicada');
      }),
      updateType: vi.fn(() => {
        throw new RelationTypeProtectedError();
      }),
    });
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.relationsCreate, {
        worldId: WORLD_ID,
        sourceId: ID,
        targetId: OTHER_ID,
        typeId: TYPE_ID,
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });

    await expect(
      route(IPC_CHANNELS.relationTypesUpdate, {
        worldId: WORLD_ID,
        id: TYPE_ID,
        name: 'Otro',
        inverseName: 'Otra',
        color: 'moss',
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });

    await expect(
      route(IPC_CHANNELS.relationsCreate, {
        worldId: WORLD_ID,
        sourceId: ID,
        targetId: OTHER_ID,
        typeId: TYPE_ID,
        strength: 9,
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });
});
