import { describe, expect, it, vi } from 'vitest';

import { IPC_CHANNELS } from '@/shared/contracts/channels';
import {
  SPIKE_EXPORT_EXTENSIONS,
  SPIKE_EXPORT_FILE_NAME_PATTERN,
  SPIKE_EXPORT_MAX_BYTES,
  isSpikeExportKind,
  isSpikeExportResult,
} from '@/shared/contracts/maps-spike';
import {
  createWorldCraftApi,
  type IpcInvoke,
} from '@/shared/contracts/world-craft-api';

const content = new Uint8Array([1, 2, 3]);

describe('contrato de exportación del spike', () => {
  it('fija los tipos, extensiones y el patrón de nombre', () => {
    expect(SPIKE_EXPORT_EXTENSIONS).toEqual({
      svg: 'svg',
      png: 'png',
      geojson: 'geojson',
      json: 'json',
      markdown: 'md',
    });
    expect(isSpikeExportKind('geojson')).toBe(true);
    expect(isSpikeExportKind('pdf')).toBe(false);

    for (const kind of ['svg', 'png', 'geojson', 'json', 'markdown'] as const) {
      const fileName = `wc-m2-01-${kind}-abcdef12.${SPIKE_EXPORT_EXTENSIONS[kind]}`;

      expect(SPIKE_EXPORT_FILE_NAME_PATTERN.test(fileName)).toBe(true);
    }
  });

  it('acepta resultados bien formados y rechaza rutas o tamaños absurdos', () => {
    expect(
      isSpikeExportResult({
        fileName: 'wc-m2-01-svg-abcdef12.svg',
        bytes: 3,
      }),
    ).toBe(true);
    expect(
      isSpikeExportResult({
        fileName: 'wc-m2-01-markdown-abcdef12.md',
        bytes: 3,
      }),
    ).toBe(true);

    for (const value of [
      null,
      {},
      { fileName: '../wc-m2-01-svg-abcdef12.svg', bytes: 3 },
      { fileName: 'C:\\datos\\wc-m2-01-svg-abcdef12.svg', bytes: 3 },
      { fileName: 'wc-m2-01-svg-abcdef12.png', bytes: 3 },
      { fileName: 'wc-m2-01-pdf-abcdef12.pdf', bytes: 3 },
      { fileName: 'wc-m2-01-svg-ABCDEF12.svg', bytes: 3 },
      { fileName: 'wc-m2-01-svg-abcdef12.svg', bytes: 0 },
      { fileName: 'wc-m2-01-svg-abcdef12.svg', bytes: 1.5 },
      {
        fileName: 'wc-m2-01-svg-abcdef12.svg',
        bytes: SPIKE_EXPORT_MAX_BYTES + 1,
      },
      { fileName: 'wc-m2-01-svg-abcdef12.svg', bytes: '3' },
    ]) {
      expect(isSpikeExportResult(value)).toBe(false);
    }
  });

  it('invoca el canal con kind y bytes, y valida la respuesta', async () => {
    const invoke = vi.fn(async () => ({
      ok: true,
      data: { fileName: 'wc-m2-01-svg-abcdef12.svg', bytes: 3 },
    })) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(
      api.mapsSpike.saveExport({ kind: 'svg', content }),
    ).resolves.toEqual({
      ok: true,
      data: { fileName: 'wc-m2-01-svg-abcdef12.svg', bytes: 3 },
    });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.mapsSpikeSaveExport, {
      kind: 'svg',
      content,
    });
    expect(Object.isFrozen(api.mapsSpike)).toBe(true);
    expect(Object.keys(api.mapsSpike)).toEqual(['saveExport']);
  });

  it('degrada respuestas manipuladas a INTERNAL_ERROR', async () => {
    const invoke = (async () => ({
      ok: true,
      data: { fileName: '../../fuera.svg', bytes: 3 },
    })) as unknown as IpcInvoke;
    const api = createWorldCraftApi({ invoke });

    await expect(
      api.mapsSpike.saveExport({ kind: 'svg', content }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });

  it('propaga un error tipado del proceso principal', async () => {
    const api = createWorldCraftApi({
      invoke: async () => ({ ok: false, error: { code: 'INVALID_INPUT' } }),
    });

    await expect(
      api.mapsSpike.saveExport({ kind: 'png', content }),
    ).resolves.toEqual({ ok: false, error: { code: 'INVALID_INPUT' } });
  });
});
