import { describe, expect, it, vi } from 'vitest';

import { createUnavailableAssetsService } from '@/main/assets/service';
import { createUnavailableEntitiesService } from '@/main/entities/service';
import { createUnavailableEntityTypesService } from '@/main/entity-types/service';
import { createIpcHandlers } from '@/main/ipc/handlers';
import { createIpcRouter } from '@/main/ipc/registry';
import { createUnavailablePreferencesService } from '@/main/preferences/service';
import { createUnavailableRelationsService } from '@/main/relations/service';
import { createUnavailableSearchService } from '@/main/search/service';
import { createUnavailableTrashService } from '@/main/trash/service';
import { createUnavailableUpdatesService } from '@/main/updates/service';
import type { VersionsService } from '@/main/versions/service';
import { createUnavailableWorldsService } from '@/main/worlds/service';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type {
  EntityVersionSummary,
  VersionCreateResult,
  VersionRestoreResult,
} from '@/shared/contracts/versions';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';
const VERSION_ID = '01900000-0000-7000-8000-000000000003';

const version: EntityVersionSummary = {
  id: VERSION_ID,
  entityId: ENTITY_ID,
  origin: 'manual',
  label: 'Antes de reescribir',
  createdAt: 1_760_000_000_000,
  descriptionTextPreview: 'Texto',
};

function createService(
  overrides: Partial<VersionsService> = {},
): VersionsService {
  return {
    list: vi.fn(() => [version]),
    create: vi.fn((): VersionCreateResult => ({ created: true, version })),
    restore: vi.fn((): VersionRestoreResult => ({ restored: true })),
    ...overrides,
  };
}

function createRoute(service: VersionsService) {
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
      search: createUnavailableSearchService(),
      assets: createUnavailableAssetsService(),
      trash: createUnavailableTrashService(),
      versions: service,
      pickImages: async () => [],
    }),
  );
}

describe('handlers IPC de versiones', () => {
  it('lista el historial de una ficha viva', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.versionsList, {
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        limit: 20,
      }),
    ).resolves.toEqual({ ok: true, data: [version] });
    expect(service.list).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      entityId: ENTITY_ID,
      limit: 20,
    });
  });

  it('rechaza una etiqueta vacía antes de crear', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.versionsCreate, {
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        label: '   ',
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('crea una manual y devuelve el límite como motivo de dominio', async () => {
    const route = createRoute(createService());

    await expect(
      route(IPC_CHANNELS.versionsCreate, {
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        label: 'Antes de reescribir',
      }),
    ).resolves.toEqual({ ok: true, data: { created: true, version } });

    const limited = createRoute(
      createService({
        create: vi.fn((): VersionCreateResult => ({
          created: false,
          reason: 'manual-limit',
        })),
      }),
    );

    await expect(
      limited(IPC_CHANNELS.versionsCreate, {
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        label: 'Otra',
      }),
    ).resolves.toEqual({
      ok: true,
      data: { created: false, reason: 'manual-limit' },
    });
  });

  it('restaura por versionId y valida el identificador', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.versionsRestore, {
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        versionId: VERSION_ID,
      }),
    ).resolves.toEqual({ ok: true, data: { restored: true } });

    await expect(
      route(IPC_CHANNELS.versionsRestore, {
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        versionId: 'nope',
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });
});
