import { describe, expect, it, vi } from 'vitest';

import { createMapsSpikeIpcHandlers } from '@/main/ipc/handlers/maps-spike';
import { createIpcRouter, type IpcHandlers } from '@/main/ipc/registry';
import {
  SpikeExportError,
  type SpikeExportStore,
} from '@/main/spike-maps/export-store';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import {
  SPIKE_EXPORT_MAX_BYTES,
  type SpikeExportInput,
  type SpikeExportResult,
} from '@/shared/contracts/maps-spike';

function store(overrides: Partial<SpikeExportStore> = {}): SpikeExportStore {
  return {
    saveExport: async (): Promise<SpikeExportResult> => ({
      fileName: 'wc-m2-01-svg-abcdef12.svg',
      bytes: 3,
    }),
    ...overrides,
  };
}

function routeWith(spikeStore: SpikeExportStore) {
  return createIpcRouter(
    createMapsSpikeIpcHandlers(spikeStore) as unknown as IpcHandlers,
  );
}

describe('handler IPC del laboratorio de mapas', () => {
  it('entrega kind y bytes al store y devuelve el resultado', async () => {
    const saveExport = vi.fn(async (input: SpikeExportInput) => ({
      fileName: `wc-m2-01-${input.kind}-abcdef12.${input.kind === 'markdown' ? 'md' : input.kind}`,
      bytes: input.content.byteLength,
    }));
    const route = routeWith(store({ saveExport }));
    const content = new Uint8Array([1, 2, 3]);

    await expect(
      route(IPC_CHANNELS.mapsSpikeSaveExport, {
        kind: 'svg',
        content,
      }),
    ).resolves.toEqual({
      ok: true,
      data: { fileName: 'wc-m2-01-svg-abcdef12.svg', bytes: 3 },
    });
    expect(saveExport).toHaveBeenCalledWith({ kind: 'svg', content });
  });

  it('valida el payload con Zod antes de llamar al store', async () => {
    const saveExport = vi.fn(async () => ({
      fileName: 'wc-m2-01-svg-abcdef12.svg',
      bytes: 3,
    }));
    const route = routeWith(store({ saveExport }));

    for (const payload of [
      {},
      { kind: 'pdf', content: new Uint8Array([1]) },
      { kind: 'svg', content: 'texto' },
      { kind: 'svg', content: new Uint8Array() },
      {
        kind: 'svg',
        content: new Uint8Array(SPIKE_EXPORT_MAX_BYTES + 1),
      },
      { kind: 'svg', content: new Uint8Array([1]), path: 'C:\\fuera.svg' },
      { kind: 'svg', content: new Uint8Array([1]), fileName: 'x.svg' },
    ]) {
      await expect(
        route(IPC_CHANNELS.mapsSpikeSaveExport, payload),
      ).resolves.toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
    }

    expect(saveExport).not.toHaveBeenCalled();
  });

  it('traduce el rechazo de dominio a INVALID_INPUT', async () => {
    const route = routeWith(
      store({
        saveExport: async () => {
          throw new SpikeExportError('SPIKE_EXPORT_INVALID_INPUT');
        },
      }),
    );

    await expect(
      route(IPC_CHANNELS.mapsSpikeSaveExport, {
        kind: 'svg',
        content: new Uint8Array([1]),
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('oculta un fallo de escritura o de disponibilidad', async () => {
    for (const code of [
      'SPIKE_EXPORT_UNAVAILABLE',
      'SPIKE_EXPORT_WRITE_FAILED',
    ] as const) {
      const route = routeWith(
        store({
          saveExport: async () => {
            throw new SpikeExportError(code, {
              cause: new Error('C:\\datos\\privados\\salida.svg'),
            });
          },
        }),
      );
      const result = await route(IPC_CHANNELS.mapsSpikeSaveExport, {
        kind: 'svg',
        content: new Uint8Array([1]),
      });

      expect(result).toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR' },
      });
      expect(JSON.stringify(result)).not.toContain('privados');
    }
  });
});
