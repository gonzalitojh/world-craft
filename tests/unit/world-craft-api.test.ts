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
import type { UiPreferences } from '@/shared/contracts/preferences';
import type {
  WorldActivityEntry,
  WorldDetail,
} from '@/shared/contracts/worlds';
import { plainTextToRichTextDocument } from '@/shared/entities/description';

const snapshot = createIdleUpdateSnapshot(APP_VERSION);

const world: WorldDetail = {
  id: '01900000-0000-7000-8000-000000000001',
  name: 'Las Mareas Grises',
  slug: 'las-mareas-grises',
  summary: 'Una historia de mareas.',
  description: plainTextToRichTextDocument('Descripción.'),
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

function createPreferences(theme: 'light' | 'dark'): UiPreferences {
  return {
    theme,
    density: 'comfortable',
    fontScale: 'normal',
    railCollapsed: false,
    entityView: {
      propertiesOpen: true,
      propertiesWidth: 320,
      sections: {
        description: true,
        attributes: false,
        relations: false,
        resources: false,
      },
    },
    lastView: 'home',
    recentLocation: null,
  };
}

describe('world-craft-api', () => {
  it('expone la identidad, el puente de shell, actualizaciones, mundos y tipos', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(WORLD_CRAFT_API_KEY).toBe('worldCraft');
    expect(Object.keys(api)).toEqual([
      'appInfo',
      'shell',
      'updates',
      'preferences',
      'worlds',
      'entityTypes',
      'entities',
      'tags',
      'relationTypes',
      'relations',
      'search',
      'assets',
      'trash',
      'versions',
      'transfer',
      'data',
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
    expect(Object.keys(api.trash)).toEqual([
      'list',
      'restore',
      'purge',
      'empty',
    ]);
    expect(Object.keys(api.versions)).toEqual(['list', 'create', 'restore']);
    expect(Object.keys(api.data)).toEqual([
      'getSummary',
      'getUsage',
      'openFolder',
      'exportAll',
      'deleteAll',
      'planOrphans',
      'purgeOrphans',
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
    expect(Object.isFrozen(api.preferences)).toBe(true);
    expect(Object.isFrozen(api.worlds)).toBe(true);
    expect(Object.isFrozen(api.entityTypes)).toBe(true);
    expect(Object.isFrozen(api.entities)).toBe(true);
    expect(Object.isFrozen(api.tags)).toBe(true);
    expect(Object.isFrozen(api.relationTypes)).toBe(true);
    expect(Object.isFrozen(api.relations)).toBe(true);
    expect(Object.isFrozen(api.search)).toBe(true);
    expect(Object.isFrozen(api.assets)).toBe(true);
    expect(Object.isFrozen(api.transfer)).toBe(true);
    expect(Object.isFrozen(api.data)).toBe(true);

    expect(() => {
      (api.appInfo as { version: string }).version = '9.9.9';
    }).toThrow(TypeError);
  });

  it('valida la respuesta de búsqueda y degrada una forma inesperada', async () => {
    const response = {
      items: [
        {
          id: 'entity:01900000-0000-7000-8000-000000000099',
          kind: 'entity',
          sourceId: '01900000-0000-7000-8000-000000000099',
          contextId: null,
          worldId: world.id,
          worldName: world.name,
          title: 'Gandalf',
          titleHighlight: '\u0001Gandalf\u0002',
          snippet: 'Mago',
          status: 'active',
          isFavorite: false,
          updatedAt: 1_760_000_000_000,
        },
      ],
      total: 1,
      tookMs: 4,
      fuzzyTerms: ['gandalf'],
    };
    const invoke = vi.fn(async (channel: string) => {
      if (channel === IPC_CHANNELS.searchSuggestions) {
        return { ok: true, data: { recent: [], favorites: [] } };
      }

      if (channel === IPC_CHANNELS.searchRebuild) {
        return { ok: true, data: { documents: 1, tookMs: 2 } };
      }

      return { ok: true, data: response };
    });
    const api = createWorldCraftApi({ invoke });

    await expect(
      api.search.query({ query: 'gand', filters: { worldId: world.id } }),
    ).resolves.toEqual({ ok: true, data: response });
    await expect(api.search.suggestions()).resolves.toEqual({
      ok: true,
      data: { recent: [], favorites: [] },
    });
    await expect(api.search.rebuild()).resolves.toEqual({
      ok: true,
      data: { documents: 1, tookMs: 2 },
    });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.searchSuggestions, {});
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.searchRebuild, {});

    const broken = createWorldCraftApi({
      invoke: async () => ({
        ok: true,
        data: { ...response, items: [{ ...response.items[0], kind: 'map' }] },
      }),
    });

    await expect(broken.search.query({ query: 'gand' })).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });

  it('envía preferencias por sus canales y valida la forma', async () => {
    const preferences = {
      theme: 'dark',
      density: 'compact',
      fontScale: 'large',
      railCollapsed: true,
      entityView: {
        propertiesOpen: false,
        propertiesWidth: 360,
        sections: {
          description: false,
          attributes: true,
          relations: true,
          resources: false,
        },
      },
      lastView: 'entity',
      recentLocation: {
        kind: 'entity',
        worldId: world.id,
        entityId: '01900000-0000-7000-8000-000000000077',
        entityName: 'Mara Viento',
      },
    } as const;
    const invoke = vi.fn(async (): Promise<unknown> => ({
      ok: true,
      data: preferences,
    }));
    const api = createWorldCraftApi({ invoke });

    await expect(api.preferences.get()).resolves.toEqual({
      ok: true,
      data: preferences,
    });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.preferencesGet, {});

    await expect(
      api.preferences.update({ theme: 'dark', railCollapsed: true }),
    ).resolves.toEqual({ ok: true, data: preferences });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.preferencesUpdate, {
      theme: 'dark',
      railCollapsed: true,
    });

    await expect(api.preferences.reset()).resolves.toEqual({
      ok: true,
      data: preferences,
    });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.preferencesReset, {});
  });

  it('degrada a INTERNAL_ERROR un snapshot de preferencias incoherente', async () => {
    for (const data of [
      null,
      { ...createPreferences('light'), theme: 'sepia' },
      { ...createPreferences('light'), railCollapsed: 'yes' },
      {
        ...createPreferences('light'),
        entityView: {
          ...createPreferences('light').entityView,
          propertiesWidth: 999,
        },
      },
      { ...createPreferences('light'), lastView: 'samples' },
      {
        ...createPreferences('light'),
        recentLocation: { kind: 'entity', worldId: world.id },
      },
      { ...createPreferences('light'), extra: true },
    ]) {
      const api = createWorldCraftApi({
        invoke: async () => ({ ok: true, data }),
      });

      await expect(api.preferences.get()).resolves.toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR' },
      });
    }
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

  it('expone papelera y versiones con guardas y objetos congelados', async () => {
    const invoke = vi.fn(async () => ({
      ok: true,
      data: { items: [], nextCursor: null },
    }));
    const api = createWorldCraftApi({ invoke });

    expect(Object.isFrozen(api.trash)).toBe(true);
    expect(Object.isFrozen(api.versions)).toBe(true);

    await expect(api.trash.list({ group: 'worlds' })).resolves.toEqual({
      ok: true,
      data: { items: [], nextCursor: null },
    });
    expect(invoke).toHaveBeenLastCalledWith(IPC_CHANNELS.trashList, {
      group: 'worlds',
    });

    await expect(
      api.trash.restore({ kind: 'world', id: world.id }),
    ).resolves.toEqual({ ok: false, error: { code: 'INTERNAL_ERROR' } });

    await expect(
      api.versions.list({ worldId: world.id, entityId: entityType.id }),
    ).resolves.toEqual({ ok: false, error: { code: 'INTERNAL_ERROR' } });

    const malformed = createWorldCraftApi({
      invoke: async () => ({ ok: true, data: { items: [{}] } }),
    });

    await expect(malformed.trash.list({ group: 'worlds' })).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
