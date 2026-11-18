import { describe, expect, it, vi } from 'vitest';

import {
  createWorldCraftApi,
  WORLD_CRAFT_API_KEY,
} from '@/shared/contracts/world-craft-api';
import { IPC_CHANNELS } from '@/shared/contracts/channels';

describe('world-craft-api', () => {
  it('expone únicamente la identidad de la aplicación y el puente de shell', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(WORLD_CRAFT_API_KEY).toBe('worldCraft');
    expect(Object.keys(api)).toEqual(['appInfo', 'shell']);
    expect(Object.keys(api.shell)).toEqual(['openExternal']);
    expect(api.appInfo).toEqual({ name: 'World Craft', version: '0.0.0' });
  });

  it('congela la API, su información y el puente de shell', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(Object.isFrozen(api)).toBe(true);
    expect(Object.isFrozen(api.appInfo)).toBe(true);
    expect(Object.isFrozen(api.shell)).toBe(true);

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
});
