import { describe, expect, it, vi } from 'vitest';

import {
  createWorldCraftApi,
  WORLD_CRAFT_API_KEY,
} from '@/shared/contracts/world-craft-api';
import { APP_VERSION } from '@/shared/app-info';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import {
  createIdleUpdateSnapshot,
  UPDATE_STATE_CHANGED_CHANNEL,
} from '@/shared/contracts/updates';
import type { EntityTypeSummary } from '@/shared/contracts/entity-types';
import type {
  WorldActivityEntry,
  WorldDetail,
} from '@/shared/contracts/worlds';

const snapshot = createIdleUpdateSnapshot(APP_VERSION);

const world: WorldDetail = {
  id: '01900000-0000-7000-8000-000000000001',
  name: 'Las Mareas Grises',
  slug: 'las-mareas-grises',
  summary: 'Una historia de mareas.',
  description: 'Descripción.',
  genres: ['Fantasía'],
  language: 'es',
  status: 'active',
  coverAssetId: null,
  createdAt: 1_760_000_000_000,
  updatedAt: 1_760_000_001_000,
  archivedAt: null,
};

const entityType: EntityTypeSummary = {
  id: '01900000-0000-7000-8000-000000000010',
  worldId: world.id,
  key: 'orden-del-alba',
  name: 'Orden del Alba',
  icon: 'crown',
  color: 'ochre',
  isSystem: false,
  fields: [
    {
      key: 'leader',
      label: 'Líder',
      type: 'text',
      required: true,
      maxLength: 80,
    },
  ],
  createdAt: 1_760_000_000_000,
  updatedAt: 1_760_000_001_000,
};

const activity: WorldActivityEntry = {
  id: '01900000-0000-7000-8000-000000000099',
  worldId: world.id,
  worldName: world.name,
  action: 'world.created',
  entityType: 'world',
  entityId: world.id,
  createdAt: 1_760_000_001_000,
};

describe('world-craft-api', () => {
  it('expone la identidad, el puente de shell, actualizaciones, mundos y tipos', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(WORLD_CRAFT_API_KEY).toBe('worldCraft');
    expect(Object.keys(api)).toEqual([
      'appInfo',
      'shell',
      'updates',
      'worlds',
      'entityTypes',
    ]);
    expect(Object.keys(api.shell)).toEqual(['openExternal']);
    expect(Object.keys(api.updates)).toEqual([
      'getState',
      'check',
      'cancel',
      'download',
      'install',
      'onStateChanged',
    ]);
    expect(Object.keys(api.worlds)).toEqual([
      'list',
      'get',
      'create',
      'update',
      'duplicate',
      'setArchived',
      'remove',
      'listActivity',
    ]);
    expect(api.appInfo).toEqual({ name: 'World Craft', version: APP_VERSION });
  });

  it('congela la API, su información, el puente de shell y las actualizaciones', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(Object.isFrozen(api)).toBe(true);
    expect(Object.isFrozen(api.appInfo)).toBe(true);
    expect(Object.isFrozen(api.shell)).toBe(true);
    expect(Object.isFrozen(api.updates)).toBe(true);
    expect(Object.isFrozen(api.worlds)).toBe(true);
    expect(Object.isFrozen(api.entityTypes)).toBe(true);

    expect(() => {
      (api.appInfo as { version: string }).version = '9.9.9';
    }).toThrow(TypeError);
  });

  it('no expone un invoke genérico', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect('invoke' in api).toBe(false);
    expect(Object.keys(api)).not.toContain('ipcRenderer');
  });

  it('envía el canal y el payload esperados y devuelve el resultado del proceso principal', async () => {
    const invoke = vi.fn(async () => ({ ok: true, data: { opened: true } }));
    const api = createWorldCraftApi({ invoke });

    await expect(
      api.shell.openExternal('https://example.com'),
    ).resolves.toEqual({ ok: true, data: { opened: true } });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.shellOpenExternal, {
      url: 'https://example.com',
    });
  });

  it('propaga el error tipado del proceso principal', async () => {
    const api = createWorldCraftApi({
      invoke: async () => ({ ok: false, error: { code: 'INVALID_INPUT' } }),
    });

    await expect(api.shell.openExternal('http://example.com')).resolves.toEqual(
      { ok: false, error: { code: 'INVALID_INPUT' } },
    );
  });

  it('convierte una excepción del transporte en INTERNAL_ERROR', async () => {
    const api = createWorldCraftApi({
      invoke: async () => {
        throw new Error('Error invoking remote method pila interna');
      },
    });

    const result = await api.shell.openExternal('https://example.com');

    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(result)).not.toContain('pila interna');
  });

  it('no confía en una respuesta con forma inesperada', async () => {
    for (const response of [
      undefined,
      null,
      'ok',
      { ok: true },
      { ok: true, data: { opened: false } },
      { ok: false },
      { ok: false, error: { code: 'OTRO' } },
    ]) {
      const api = createWorldCraftApi({ invoke: async () => response });

      await expect(
        api.shell.openExternal('https://example.com'),
      ).resolves.toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  });

  it('envía las órdenes de actualizaciones por sus canales con un payload vacío', async () => {
    const invoke = vi.fn(async () => ({ ok: true, data: snapshot }));
    const api = createWorldCraftApi({ invoke });

    await api.updates.getState();
    await api.updates.check();
    await api.updates.cancel();
    await api.updates.download();
    await api.updates.install();

    expect(invoke.mock.calls).toEqual([
      [IPC_CHANNELS.updatesGetState, {}],
      [IPC_CHANNELS.updatesCheck, {}],
      [IPC_CHANNELS.updatesCancel, {}],
      [IPC_CHANNELS.updatesDownload, {}],
      [IPC_CHANNELS.updatesInstall, {}],
    ]);
  });

  it('descarta snapshots de actualizaciones incoherentes', async () => {
    for (const data of [
      null,
      { ...snapshot, phase: 'inventada' },
      { ...snapshot, progressPercent: 120 },
      { ...snapshot, phase: 'downloading', progressPercent: null },
      { ...snapshot, phase: 'unavailable', unavailableReason: null },
      { ...snapshot, phase: 'error', errorCode: null },
    ]) {
      const api = createWorldCraftApi({
        invoke: async () => ({ ok: true, data }),
      });

      await expect(api.updates.getState()).resolves.toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR' },
      });
    }
  });

  it('solo entrega cambios de estado válidos y permite desuscribirse', () => {
    const events: { emit: ((payload: unknown) => void) | null } = {
      emit: null,
    };
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(
      (channel: string, listener: (payload: unknown) => void) => {
        expect(channel).toBe(UPDATE_STATE_CHANGED_CHANNEL);
        events.emit = listener;

        return unsubscribe;
      },
    );
    const api = createWorldCraftApi({
      invoke: async () => ({ ok: true }),
      subscribe,
    });
    const listener = vi.fn();

    const stop = api.updates.onStateChanged(listener);

    events.emit?.({ ...snapshot, phase: 'inventada' });
    expect(listener).not.toHaveBeenCalled();

    events.emit?.(snapshot);
    expect(listener).toHaveBeenCalledWith(snapshot);

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('envía los canales y payloads de mundos y valida la forma', async () => {
    const invoke = vi.fn(async (): Promise<unknown> => ({
      ok: true,
      data: [world],
    }));
    const api = createWorldCraftApi({ invoke });

    await expect(api.worlds.list()).resolves.toEqual({
      ok: true,
      data: [world],
    });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.worldsList, {});

    invoke.mockResolvedValueOnce({ ok: true, data: world });
    await expect(api.worlds.get(world.id)).resolves.toEqual({
      ok: true,
      data: world,
    });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.worldsGet, {
      id: world.id,
    });

    invoke.mockResolvedValueOnce({ ok: true, data: world });
    await api.worlds.create({ name: 'Nuevo mundo' });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.worldsCreate, {
      name: 'Nuevo mundo',
    });

    invoke.mockResolvedValueOnce({ ok: true, data: null });
    await expect(
      api.worlds.update({ id: world.id, name: world.name }),
    ).resolves.toEqual({
      ok: true,
      data: null,
    });

    invoke.mockResolvedValueOnce({ ok: true, data: { deleted: true } });
    await expect(api.worlds.remove(world.id)).resolves.toEqual({
      ok: true,
      data: { deleted: true },
    });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.worldsRemove, {
      id: world.id,
    });

    invoke.mockResolvedValueOnce({ ok: true, data: [activity] });
    await expect(
      api.worlds.listActivity({ worldId: world.id, limit: 5 }),
    ).resolves.toEqual({ ok: true, data: [activity] });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.worldsListActivity, {
      worldId: world.id,
      limit: 5,
    });
  });

  it('degrada a INTERNAL_ERROR las respuestas de mundos incoherentes', async () => {
    const api = createWorldCraftApi({
      invoke: async () => ({
        ok: true,
        data: [{ ...world, status: 'inventado' }],
      }),
    });

    await expect(api.worlds.list()).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });

    const detailApi = createWorldCraftApi({
      invoke: async () => ({
        ok: true,
        data: { ...world, genres: 'no-es-un-array' },
      }),
    });

    await expect(detailApi.worlds.get(world.id)).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });

    await expect(
      detailApi.worlds.create({ name: world.name }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });

  it('envía los canales y payloads de tipos de entidad y valida la forma', async () => {
    const invoke = vi.fn(async (): Promise<unknown> => ({
      ok: true,
      data: [entityType],
    }));
    const api = createWorldCraftApi({ invoke });

    await expect(api.entityTypes.list(world.id)).resolves.toEqual({
      ok: true,
      data: [entityType],
    });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.entityTypesList, {
      worldId: world.id,
    });

    invoke.mockResolvedValueOnce({ ok: true, data: entityType });
    await expect(
      api.entityTypes.create({
        worldId: world.id,
        name: entityType.name,
        icon: entityType.icon,
        color: entityType.color,
        fields: entityType.fields,
      }),
    ).resolves.toEqual({ ok: true, data: entityType });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.entityTypesCreate, {
      worldId: world.id,
      name: entityType.name,
      icon: entityType.icon,
      color: entityType.color,
      fields: entityType.fields,
    });

    invoke.mockResolvedValueOnce({ ok: true, data: null });
    await expect(
      api.entityTypes.update({
        worldId: world.id,
        id: entityType.id,
        name: entityType.name,
        icon: entityType.icon,
        color: entityType.color,
        fields: entityType.fields,
      }),
    ).resolves.toEqual({ ok: true, data: null });

    invoke.mockResolvedValueOnce({ ok: true, data: entityType });
    await expect(
      api.entityTypes.duplicate({
        worldId: world.id,
        id: entityType.id,
        name: 'Copia',
      }),
    ).resolves.toEqual({ ok: true, data: entityType });

    invoke.mockResolvedValueOnce({ ok: true, data: { deleted: true } });
    await expect(
      api.entityTypes.remove({ worldId: world.id, id: entityType.id }),
    ).resolves.toEqual({ ok: true, data: { deleted: true } });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.entityTypesRemove, {
      worldId: world.id,
      id: entityType.id,
    });
  });

  it('degrada a INTERNAL_ERROR las respuestas de tipos incoherentes', async () => {
    const api = createWorldCraftApi({
      invoke: async () => ({
        ok: true,
        data: [{ ...entityType, icon: 'icono-inventado' }],
      }),
    });

    await expect(api.entityTypes.list(world.id)).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });

    const fieldsApi = createWorldCraftApi({
      invoke: async () => ({
        ok: true,
        data: {
          ...entityType,
          fields: [
            { key: 'x', label: 'X', type: 'desconocido', required: false },
          ],
        },
      }),
    });

    await expect(fieldsApi.entityTypes.list(world.id)).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
