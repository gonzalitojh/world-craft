import { describe, expect, it, vi } from 'vitest';

import { IPC_CHANNELS } from '@/shared/contracts/channels';
import type { TransferCoordinator } from '@/main/transfer/coordinator';
import { TransferError } from '@/main/transfer/errors';
import { createTransferIpcHandlers } from '@/main/ipc/handlers/transfer';
import { createIpcRouter, type IpcHandlers } from '@/main/ipc/registry';

const WORLD_ID = '018f1000-0000-7000-8000-000000000001';

const counts = {
  entities: 0,
  entityTypes: 0,
  relationTypes: 0,
  tags: 0,
  relations: 0,
  versions: 0,
  assets: 0,
};

function coordinator(
  overrides: Partial<TransferCoordinator> = {},
): TransferCoordinator {
  return {
    exportWorld: async () => ({
      status: 'completed',
      data: {
        worldId: WORLD_ID,
        worldName: 'Mundo',
        fileName: 'mundo.zip',
        size: 10,
        counts,
        warnings: [],
      },
    }),
    importWorld: async () => ({
      status: 'completed',
      data: {
        worldId: WORLD_ID,
        worldName: 'Mundo',
        slug: 'mundo-2',
        slugAdjusted: true,
        counts,
        warnings: [],
      },
    }),
    cancel: () => ({ cancelled: true }),
    isBusy: () => false,
    subscribe: () => () => {},
    dispose: () => {},
    ...overrides,
  };
}

function routeWith(service: TransferCoordinator) {
  return createIpcRouter(
    createTransferIpcHandlers(service) as unknown as IpcHandlers,
  );
}

describe('handlers IPC de transferencia', () => {
  it('devuelve el resultado de exportación como ok:true', async () => {
    const route = routeWith(coordinator());

    await expect(
      route(IPC_CHANNELS.transferExportWorld, { worldId: WORLD_ID }),
    ).resolves.toEqual({
      ok: true,
      data: {
        status: 'completed',
        data: {
          worldId: WORLD_ID,
          worldName: 'Mundo',
          fileName: 'mundo.zip',
          size: 10,
          counts,
          warnings: [],
        },
      },
    });
  });

  it('conserva un fallo de dominio sin degradarlo a INTERNAL_ERROR', async () => {
    const route = routeWith(
      coordinator({
        exportWorld: async () => ({
          status: 'failed',
          code: 'TRANSFER_SOURCE_NOT_FOUND',
        }),
      }),
    );

    await expect(
      route(IPC_CHANNELS.transferExportWorld, { worldId: WORLD_ID }),
    ).resolves.toEqual({
      ok: true,
      data: { status: 'failed', code: 'TRANSFER_SOURCE_NOT_FOUND' },
    });
  });

  it('traduce una excepción de cancelación a cancelled', async () => {
    const route = routeWith(
      coordinator({
        importWorld: async () => {
          throw new TransferError('TRANSFER_CANCELLED');
        },
      }),
    );

    await expect(route(IPC_CHANNELS.transferImportWorld, {})).resolves.toEqual({
      ok: true,
      data: { status: 'cancelled' },
    });
  });

  it('traduce cualquier excepción no controlada a TRANSFER_INTERNAL', async () => {
    const route = routeWith(
      coordinator({
        exportWorld: async () => {
          throw new Error('boom con C:\\ruta\\privada');
        },
      }),
    );

    const result = await route(IPC_CHANNELS.transferExportWorld, {
      worldId: WORLD_ID,
    });

    expect(result).toEqual({
      ok: true,
      data: { status: 'failed', code: 'TRANSFER_INTERNAL' },
    });
    expect(JSON.stringify(result)).not.toContain('privada');
  });

  it('valida los payloads antes de llegar al coordinador', async () => {
    const exportWorld = vi.fn(async () => ({
      status: 'cancelled' as const,
    }));
    const route = routeWith(coordinator({ exportWorld }));

    await expect(
      route(IPC_CHANNELS.transferExportWorld, {
        worldId: 'no-es-uuid',
        extra: true,
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
    await expect(
      route(IPC_CHANNELS.transferImportWorld, { extra: true }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
    await expect(
      route(IPC_CHANNELS.transferCancel, { extra: true }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(exportWorld).not.toHaveBeenCalled();
  });

  it('devuelve el resultado de cancelación', async () => {
    const route = routeWith(coordinator());

    await expect(route(IPC_CHANNELS.transferCancel, {})).resolves.toEqual({
      ok: true,
      data: { cancelled: true },
    });
  });

  it('si cancelar lanza, devuelve cancelled:false sin filtrar detalles', async () => {
    const route = routeWith(
      coordinator({
        cancel: () => {
          throw new Error('detalle interno');
        },
      }),
    );

    await expect(route(IPC_CHANNELS.transferCancel, {})).resolves.toEqual({
      ok: true,
      data: { cancelled: false },
    });
  });
});
