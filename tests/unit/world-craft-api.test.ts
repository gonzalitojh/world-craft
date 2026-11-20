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

const snapshot = createIdleUpdateSnapshot(APP_VERSION);

describe('world-craft-api', () => {
  it('expone únicamente la identidad, el puente de shell y las actualizaciones', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(WORLD_CRAFT_API_KEY).toBe('worldCraft');
    expect(Object.keys(api)).toEqual(['appInfo', 'shell', 'updates']);
    expect(Object.keys(api.shell)).toEqual(['openExternal']);
    expect(Object.keys(api.updates)).toEqual([
      'getState',
      'check',
      'cancel',
      'download',
      'install',
      'onStateChanged',
    ]);
    expect(api.appInfo).toEqual({ name: 'World Craft', version: APP_VERSION });
  });

  it('congela la API, su información, el puente de shell y las actualizaciones', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(Object.isFrozen(api)).toBe(true);
    expect(Object.isFrozen(api.appInfo)).toBe(true);
    expect(Object.isFrozen(api.shell)).toBe(true);
    expect(Object.isFrozen(api.updates)).toBe(true);

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
});
