import { describe, expect, it, vi } from 'vitest';

import { createUnavailableAssetsService } from '@/main/assets/service';
import { createUnavailableEntitiesService } from '@/main/entities/service';
import { createUnavailableEntityTypesService } from '@/main/entity-types/service';
import { createIpcHandlers } from '@/main/ipc/handlers';
import { createUnavailableTransferCoordinator } from '@/main/transfer/unavailable-coordinator';
import { createIpcRouter } from '@/main/ipc/registry';
import { createUnavailablePreferencesService } from '@/main/preferences/service';
import { createUnavailableRelationsService } from '@/main/relations/service';
import { createUnavailableSearchService } from '@/main/search/service';
import type { TrashService } from '@/main/trash/service';
import { createUnavailableUpdatesService } from '@/main/updates/service';
import { createUnavailableVersionsService } from '@/main/versions/service';
import { createUnavailableWorldsService } from '@/main/worlds/service';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type {
  TrashEmptyResult,
  TrashPage,
  TrashPurgeResult,
  TrashRestoreResult,
} from '@/shared/contracts/trash';

const ITEM_ID = '01900000-0000-7000-8000-000000000002';

const page: TrashPage = {
  items: [
    { kind: 'world', id: ITEM_ID, name: 'Las Mareas Grises', deletedAt: 1 },
  ],
  nextCursor: null,
};

function createService(overrides: Partial<TrashService> = {}): TrashService {
  return {
    list: vi.fn(() => page),
    restore: vi.fn((): TrashRestoreResult => ({ restored: true })),
    purge: vi.fn(async (): Promise<TrashPurgeResult> => ({ purged: true })),
    empty: vi.fn(async (): Promise<TrashEmptyResult> => ({
      backup: 'created',
      purged: { worlds: 1, entities: 0, entityTypes: 0 },
      skipped: 0,
    })),
    ...overrides,
  };
}

function createRoute(service: TrashService) {
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
      trash: service,
      versions: createUnavailableVersionsService(),
      transfer: createUnavailableTransferCoordinator(),
      pickImages: async () => [],
    }),
  );
}

describe('handlers IPC de papelera', () => {
  it('lista y restaura con la entrada validada', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.trashList, { group: 'worlds', limit: 10 }),
    ).resolves.toEqual({ ok: true, data: page });
    expect(service.list).toHaveBeenCalledWith({ group: 'worlds', limit: 10 });

    await expect(
      route(IPC_CHANNELS.trashRestore, { kind: 'world', id: ITEM_ID }),
    ).resolves.toEqual({ ok: true, data: { restored: true } });
    expect(service.restore).toHaveBeenCalledWith({
      kind: 'world',
      id: ITEM_ID,
    });
  });

  it('exige la confirmación literal antes de purgar', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.trashPurge, {
        kind: 'world',
        id: ITEM_ID,
        confirm: 'delete-forever',
      }),
    ).resolves.toEqual({ ok: true, data: { purged: true } });
    expect(service.purge).toHaveBeenCalledWith({
      kind: 'world',
      id: ITEM_ID,
      confirm: 'delete-forever',
    });

    await expect(
      route(IPC_CHANNELS.trashPurge, {
        kind: 'world',
        id: ITEM_ID,
        confirm: 'yes',
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(service.purge).toHaveBeenCalledTimes(1);
  });

  it('devuelve los motivos de dominio sin lanzar y propaga el error interno', async () => {
    const route = createRoute(
      createService({
        restore: vi.fn((): TrashRestoreResult => ({
          restored: false,
          reason: 'world-in-trash',
        })),
        purge: vi.fn(async () => {
          throw new Error('disco');
        }),
      }),
    );

    await expect(
      route(IPC_CHANNELS.trashRestore, { kind: 'entity', id: ITEM_ID }),
    ).resolves.toEqual({
      ok: true,
      data: { restored: false, reason: 'world-in-trash' },
    });
    await expect(
      route(IPC_CHANNELS.trashPurge, {
        kind: 'world',
        id: ITEM_ID,
        confirm: 'delete-forever',
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INTERNAL_ERROR' } });
  });

  it('vacía con el literal y devuelve los contadores', async () => {
    const service = createService();
    const route = createRoute(service);

    await expect(
      route(IPC_CHANNELS.trashEmpty, { confirm: 'empty-trash' }),
    ).resolves.toEqual({
      ok: true,
      data: {
        backup: 'created',
        purged: { worlds: 1, entities: 0, entityTypes: 0 },
        skipped: 0,
      },
    });
    expect(service.empty).toHaveBeenCalledWith({ confirm: 'empty-trash' });
  });
});
