import { describe, expect, it, vi } from 'vitest';

import { IPC_CHANNELS } from '@/shared/contracts/channels';
import {
  TRANSFER_EVENT_CHANNEL,
  type TransferProgressEvent,
} from '@/shared/contracts/transfer';
import {
  createWorldCraftApi,
  type IpcInvoke,
  type IpcSubscribe,
} from '@/shared/contracts/world-craft-api';

const WORLD_ID = '018f1000-0000-7000-8000-000000000001';
const OPERATION_ID = '018f1000-0000-7000-8000-000000000002';

const counts = {
  entities: 0,
  entityTypes: 0,
  relationTypes: 0,
  tags: 0,
  relations: 0,
  versions: 0,
  assets: 0,
};

const exportResult = {
  worldId: WORLD_ID,
  worldName: 'Mundo',
  fileName: 'mundo.zip',
  size: 10,
  counts,
  warnings: [],
};

const importResult = {
  worldId: WORLD_ID,
  worldName: 'Mundo',
  slug: 'mundo-2',
  slugAdjusted: true,
  counts,
  warnings: [],
};

describe('API de transferencia del preload', () => {
  it('invoca exportar con el mundo y valida el resultado', async () => {
    const invoke = vi.fn(async () => ({
      ok: true,
      data: { status: 'completed', data: exportResult },
    })) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(api.transfer.exportWorld(WORLD_ID)).resolves.toEqual({
      ok: true,
      data: { status: 'completed', data: exportResult },
    });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.transferExportWorld, {
      worldId: WORLD_ID,
    });
  });

  it('invoca importar y cancelar por sus canales', async () => {
    const invoke = vi.fn(async (channel: string) =>
      channel === IPC_CHANNELS.transferImportWorld
        ? {
            ok: true,
            data: { status: 'completed', data: importResult },
          }
        : { ok: true, data: { cancelled: true } },
    ) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(api.transfer.importWorld()).resolves.toEqual({
      ok: true,
      data: { status: 'completed', data: importResult },
    });
    await expect(api.transfer.cancel()).resolves.toEqual({
      ok: true,
      data: { cancelled: true },
    });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.transferImportWorld, {});
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.transferCancel, {});
  });

  it('degrada una forma inesperada a INTERNAL_ERROR', async () => {
    const api = createWorldCraftApi({
      invoke: (async () => ({
        ok: true,
        data: {
          status: 'completed',
          data: { ...exportResult, fileName: '../x.zip' },
        },
      })) as unknown as IpcInvoke,
    });

    await expect(api.transfer.exportWorld(WORLD_ID)).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });

    const importApi = createWorldCraftApi({
      invoke: (async () => ({
        ok: true,
        data: {
          status: 'completed',
          data: {
            ...importResult,
            slugAdjusted: 'sí',
          },
        },
      })) as unknown as IpcInvoke,
    });

    await expect(importApi.transfer.importWorld()).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });

  it('acepta fallos de dominio y cancelación como resultados válidos', async () => {
    const failed = createWorldCraftApi({
      invoke: (async () => ({
        ok: true,
        data: { status: 'failed', code: 'TRANSFER_BUSY' },
      })) as unknown as IpcInvoke,
    });
    const cancelled = createWorldCraftApi({
      invoke: (async () => ({
        ok: true,
        data: { status: 'cancelled' },
      })) as unknown as IpcInvoke,
    });

    await expect(failed.transfer.exportWorld(WORLD_ID)).resolves.toEqual({
      ok: true,
      data: { status: 'failed', code: 'TRANSFER_BUSY' },
    });
    await expect(cancelled.transfer.importWorld()).resolves.toEqual({
      ok: true,
      data: { status: 'cancelled' },
    });
  });

  it('solo entrega eventos de progreso válidos y devuelve la desuscripción', () => {
    let received: (payload: unknown) => void = () => {};
    const unsubscribe = vi.fn();
    const subscribe: IpcSubscribe = (channel, listener) => {
      expect(channel).toBe(TRANSFER_EVENT_CHANNEL);
      received = listener;
      return unsubscribe;
    };
    const api = createWorldCraftApi({
      invoke: async () => ({ ok: true, data: null }),
      subscribe,
    });
    const events: TransferProgressEvent[] = [];
    const off = api.transfer.onEvent((event) => events.push(event));
    const event: TransferProgressEvent = {
      operation: 'export',
      operationId: OPERATION_ID,
      phase: 'packaging',
      unit: 'files',
      cancelable: true,
      completed: 1,
      total: 2,
      warnings: 0,
    };

    received(event);
    received({ ...event, operationId: 'no-es-uuid' });
    received({ ...event, unit: 'items' });
    received({ ...event, cancelable: 'sí' });

    expect(events).toEqual([event]);
    off();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('no falla si no hay subscribe o el listener no es función', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(api.transfer.onEvent(() => {})).toEqual(expect.any(Function));
    expect(api.transfer.onEvent(null as unknown as () => void)).toEqual(
      expect.any(Function),
    );
  });

  it('congela el puente de transferencia', () => {
    const api = createWorldCraftApi({ invoke: async () => ({ ok: true }) });

    expect(Object.isFrozen(api.transfer)).toBe(true);
    expect(Object.keys(api.transfer)).toEqual([
      'exportWorld',
      'importWorld',
      'cancel',
      'onEvent',
    ]);
  });
});
