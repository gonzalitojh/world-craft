import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';

const { exportLibrary } = vi.hoisted(() => ({
  exportLibrary: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { relaunch: vi.fn(), exit: vi.fn() },
}));

vi.mock('@/main/data/library/service', () => ({
  exportAll: exportLibrary,
}));

import { createDataComposition } from '@/main/data/composition';
import { resolveDataPaths } from '@/main/db/paths';
import { createDefaultUiPreferences } from '@/shared/contracts/preferences';

const paths = resolveDataPaths(join(tmpdir(), 'world-craft-composition'));

function options(overrides: Record<string, unknown> = {}) {
  return {
    database: {} as never,
    sqlite: {} as never,
    paths,
    assets: { listAll: () => [] },
    preferences: { get: () => createDefaultUiPreferences() },
    worlds: { list: () => [] },
    transfer: { isBusy: () => false, dispose: () => {} },
    updates: null,
    closePersistence: () => {},
    openPath: async () => {},
    appVersion: '0.1.0',
    schemaVersion: 8,
    now: () => 1_800_000_000_000,
    showExportDialog: async () => null,
    ...overrides,
  };
}

describe('composición del servicio de datos', () => {
  it('devuelve cancelled si el diálogo se cancela y no exporta', async () => {
    exportLibrary.mockClear();
    const service = createDataComposition(options());

    await expect(service.exportAll()).resolves.toEqual({
      status: 'cancelled',
    });
    expect(exportLibrary).not.toHaveBeenCalled();
  });

  it('pasa la ruta elegida al dominio sin devolverla', async () => {
    exportLibrary.mockResolvedValueOnce({
      status: 'completed',
      fileName: 'biblioteca.zip',
      size: 10,
      worlds: 0,
      counts: {
        entities: 0,
        entityTypes: 0,
        relationTypes: 0,
        tags: 0,
        relations: 0,
        versions: 0,
        assets: 0,
      },
      warnings: [],
    });
    const service = createDataComposition(
      options({
        showExportDialog: async () => 'C:\\salida\\biblioteca.zip',
      }),
    );

    const result = await service.exportAll();

    expect(result).toMatchObject({
      status: 'completed',
      fileName: 'biblioteca.zip',
    });
    expect(exportLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationFile: 'C:\\salida\\biblioteca.zip',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('C:\\salida');
  });

  it('rechaza exportAll con una transferencia activa sin abrir el diálogo', async () => {
    exportLibrary.mockClear();
    const showExportDialog = vi.fn(async () => null);
    const service = createDataComposition(
      options({
        transfer: { isBusy: () => true, dispose: () => {} },
        showExportDialog,
      }),
    );

    await expect(service.exportAll()).rejects.toMatchObject({
      code: 'DATA_BUSY',
    });
    expect(showExportDialog).not.toHaveBeenCalled();
    expect(exportLibrary).not.toHaveBeenCalled();
  });

  it('rechaza exportAll si la transferencia empieza con el diálogo abierto', async () => {
    exportLibrary.mockClear();
    let busy = false;
    const service = createDataComposition(
      options({
        transfer: {
          isBusy: () => busy,
          dispose: () => {},
        },
        showExportDialog: async () => {
          busy = true;
          return 'C:\\salida\\biblioteca.zip';
        },
      }),
    );

    await expect(service.exportAll()).resolves.toEqual({
      status: 'failed',
      code: 'DATA_BUSY',
    });
    expect(exportLibrary).not.toHaveBeenCalled();
  });

  it('rechaza deleteAll con una transferencia activa', async () => {
    const service = createDataComposition(
      options({
        transfer: { isBusy: () => true, dispose: () => {} },
      }),
    );

    await expect(
      service.deleteAll({ keepBackups: false }),
    ).rejects.toMatchObject({ code: 'DATA_BUSY' });
  });
});
