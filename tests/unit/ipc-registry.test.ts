import type { IpcMain } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createUnavailableAssetsService } from '@/main/assets/service';
import { createUnavailableEntitiesService } from '@/main/entities/service';
import { createUnavailableEntityTypesService } from '@/main/entity-types/service';
import { createIpcHandlers } from '@/main/ipc/handlers';
import {
  createIpcRouter,
  defineIpcHandler,
  registerIpcHandlers,
} from '@/main/ipc/registry';
import { createUnavailableRelationsService } from '@/main/relations/service';
import { createUnavailableUpdatesService } from '@/main/updates/service';
import { createUnavailableWorldsService } from '@/main/worlds/service';
import { IPC_CHANNELS, IPC_CHANNEL_LIST } from '@/shared/contracts/channels';

const createHandlers = () =>
  createIpcHandlers({
    openExternal: async () => {},
    updates: createUnavailableUpdatesService({
      reason: 'not-packaged',
      currentVersion: '0.1.0',
    }),
    worlds: createUnavailableWorldsService(),
    entityTypes: createUnavailableEntityTypesService(),
    entities: createUnavailableEntitiesService(),
    relations: createUnavailableRelationsService(),
    assets: createUnavailableAssetsService(),
    pickImages: async () => [],
  });

type RegisteredListener = (
  event: { readonly senderFrame: { readonly url: string } | null },
  payload: unknown,
) => Promise<unknown>;

function createFakeIpcMain(): {
  ipcMain: IpcMain;
  listeners: Map<string, RegisteredListener>;
} {
  const listeners = new Map<string, RegisteredListener>();

  const ipcMain = {
    handle: (channel: string, listener: RegisteredListener) => {
      listeners.set(channel, listener);
    },
  } as unknown as IpcMain;

  return { ipcMain, listeners };
}

const trustedEvent = {
  senderFrame: { url: 'file:///C:/app/out/renderer/index.html' },
};

describe('createIpcRouter', () => {
  const route = createIpcRouter(createHandlers());

  it('ejecuta el handler con una entrada válida y la envuelve en un resultado', async () => {
    const result = await route(IPC_CHANNELS.shellOpenExternal, {
      url: 'https://example.com',
    });

    expect(result).toEqual({ ok: true, data: { opened: true } });
  });

  it('rechaza una entrada inválida sin devolver el valor recibido', async () => {
    const result = await route(IPC_CHANNELS.shellOpenExternal, {
      url: 424242,
      secreto: 'no debe aparecer',
    });

    expect(result).toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(JSON.stringify(result)).not.toContain('424242');
    expect(JSON.stringify(result)).not.toContain('secreto');
  });

  it('rechaza también payloads que no son objetos', async () => {
    for (const payload of [undefined, null, 'https://example.com', 7, []]) {
      const result = await route(IPC_CHANNELS.shellOpenExternal, payload);

      expect(result).toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
      expect(JSON.stringify(result)).not.toContain('https://example.com');
    }
  });

  it('responde UNKNOWN_CHANNEL a un canal fuera de la allowlist', async () => {
    for (const channel of [
      'shell:unknown',
      'shell:openExternal ',
      '',
      undefined,
      null,
      42,
      { channel: 'shell:openExternal' },
    ]) {
      expect(await route(channel, { url: 'https://example.com' })).toEqual({
        ok: false,
        error: { code: 'UNKNOWN_CHANNEL' },
      });
    }
  });

  it('convierte una excepción del handler en INTERNAL_ERROR sin filtrar detalles', async () => {
    const router = createIpcRouter({
      ...createHandlers(),
      [IPC_CHANNELS.shellOpenExternal]: defineIpcHandler({
        schema: z.strictObject({ url: z.string() }),
        handle: () => {
          throw new Error(
            'fallo en C:\\Users\\usuario\\datos.db con clave abc1234',
          );
        },
      }),
    });

    const result = await router(IPC_CHANNELS.shellOpenExternal, {
      url: 'https://example.com',
    });

    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(JSON.stringify(result)).not.toContain('datos.db');
    expect(JSON.stringify(result)).not.toContain('abc1234');
  });

  it('convierte un rechazo asíncrono en INTERNAL_ERROR', async () => {
    const router = createIpcRouter({
      ...createHandlers(),
      [IPC_CHANNELS.shellOpenExternal]: defineIpcHandler({
        schema: z.strictObject({ url: z.string() }),
        handle: () => Promise.reject(new Error('boom')),
      }),
    });

    expect(
      await router(IPC_CHANNELS.shellOpenExternal, { url: 'https://a.test' }),
    ).toEqual({ ok: false, error: { code: 'INTERNAL_ERROR' } });
  });

  it('responde INVALID_INPUT cuando una regla de dominio rechaza la entrada', async () => {
    const result = await route(IPC_CHANNELS.shellOpenExternal, {
      url: 'http://example.com',
    });

    expect(result).toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });
});

describe('createIpcHandlers', () => {
  it('registra exactamente los canales de la allowlist', () => {
    const handlers = createHandlers();

    expect(Object.keys(handlers).sort()).toEqual([...IPC_CHANNEL_LIST].sort());
  });

  it('atiende las órdenes de actualizaciones con un objeto vacío estricto', async () => {
    const route = createIpcRouter(createHandlers());

    for (const channel of [
      IPC_CHANNELS.updatesGetState,
      IPC_CHANNELS.updatesCheck,
      IPC_CHANNELS.updatesCancel,
      IPC_CHANNELS.updatesDownload,
      IPC_CHANNELS.updatesInstall,
    ]) {
      const result = await route(channel, {});

      expect(result).toMatchObject({
        ok: true,
        data: { phase: 'unavailable', unavailableReason: 'not-packaged' },
      });
    }

    await expect(
      route(IPC_CHANNELS.updatesCheck, { version: '9.9.9' }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
  });
});

describe('registerIpcHandlers', () => {
  it('registra en ipcMain solo los canales de la allowlist', () => {
    const { ipcMain, listeners } = createFakeIpcMain();

    registerIpcHandlers(ipcMain, createHandlers());

    expect([...listeners.keys()].sort()).toEqual([...IPC_CHANNEL_LIST].sort());
  });

  it('delega en el router y devuelve el resultado tipado', async () => {
    const { ipcMain, listeners } = createFakeIpcMain();
    const openExternal = vi.fn(async () => {});

    registerIpcHandlers(
      ipcMain,
      createIpcHandlers({
        openExternal,
        updates: createUnavailableUpdatesService({
          reason: 'not-packaged',
          currentVersion: '0.1.0',
        }),
        worlds: createUnavailableWorldsService(),
        entityTypes: createUnavailableEntityTypesService(),
        entities: createUnavailableEntitiesService(),
        relations: createUnavailableRelationsService(),
        assets: createUnavailableAssetsService(),
        pickImages: async () => [],
      }),
    );

    const listener = listeners.get(IPC_CHANNELS.shellOpenExternal);
    expect(listener).toBeDefined();

    await expect(
      listener?.(trustedEvent, { url: 'https://example.com/docs' }),
    ).resolves.toEqual({ ok: true, data: { opened: true } });
    expect(openExternal).toHaveBeenCalledWith('https://example.com/docs');
  });

  it('rechaza un remitente que no es la ventana de la aplicación', async () => {
    const { ipcMain, listeners } = createFakeIpcMain();

    registerIpcHandlers(ipcMain, createHandlers());

    const listener = listeners.get(IPC_CHANNELS.shellOpenExternal);

    for (const event of [
      { senderFrame: { url: 'https://evil.example.com/' } },
      { senderFrame: { url: '' } },
      { senderFrame: null },
    ]) {
      await expect(
        listener?.(event, { url: 'https://example.com' }),
      ).resolves.toEqual({
        ok: false,
        error: { code: 'UNTRUSTED_SENDER' },
      });
    }
  });

  it('acepta el renderer empaquetado y el servidor de desarrollo en loopback', async () => {
    const { ipcMain, listeners } = createFakeIpcMain();

    registerIpcHandlers(ipcMain, createHandlers());

    const listener = listeners.get(IPC_CHANNELS.shellOpenExternal);

    for (const event of [
      trustedEvent,
      { senderFrame: { url: 'http://localhost:5173/' } },
    ]) {
      await expect(
        listener?.(event, { url: 'https://example.com' }),
      ).resolves.toEqual({ ok: true, data: { opened: true } });
    }
  });
});
