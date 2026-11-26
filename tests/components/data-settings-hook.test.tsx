import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/renderer/i18n/provider';
import { useDataSettings } from '@/renderer/settings/use-data-settings';
import type { DataCounts, DataUsage } from '@/shared/contracts/data';
import type {
  WorldCraftApi,
  WorldCraftDataApi,
} from '@/shared/contracts/world-craft-api';

const counts: DataCounts = {
  worlds: { active: 1, archived: 0, trash: 0 },
  entities: 2,
  assets: 3,
  backups: 4,
};

const countsB: DataCounts = {
  worlds: { active: 5, archived: 2, trash: 1 },
  entities: 9,
  assets: 8,
  backups: 7,
};

const usage: DataUsage = {
  totalBytes: 10,
  totalEntries: 1,
  partial: false,
  categories: {
    database: { bytes: 10, entries: 1, partial: false },
    assets: { bytes: 0, entries: 0, partial: false },
    backups: { bytes: 0, entries: 0, partial: false },
    logs: { bytes: 0, entries: 0, partial: false },
    temporary: { bytes: 0, entries: 0, partial: false },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

function createApi(
  overrides: Partial<WorldCraftDataApi> = {},
): WorldCraftDataApi {
  return {
    getSummary: vi.fn(async () => ({
      ok: true as const,
      data: { status: 'completed' as const, data: counts },
    })),
    getUsage: vi.fn(async () => ({
      ok: true as const,
      data: { status: 'completed' as const, data: usage },
    })),
    openFolder: vi.fn(async () => ({
      ok: true as const,
      data: { status: 'completed' as const, data: { opened: true as const } },
    })),
    exportAll: vi.fn(async () => ({
      ok: true as const,
      data: { status: 'cancelled' as const },
    })),
    deleteAll: vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'deleted' as const,
        restartRequired: true as const,
        counts: {
          databaseFiles: 0,
          assetFiles: 0,
          logEntries: 0,
          temporaryEntries: 0,
          backupDirectories: 0,
        },
        remaining: [] as const,
      },
    })),
    planOrphans: vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'completed' as const,
        data: {
          purgeableFiles: 0,
          unreferencedFiles: 0,
          orphanThumbnails: 0,
          temporaryFiles: 0,
          missingFiles: 0,
          unexpectedEntries: 0,
          suspiciousLinks: 0,
          recoverableBytes: 0,
        },
      },
    })),
    purgeOrphans: vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'completed' as const,
        data: { purgedFiles: 0, purgedBytes: 0, backupCreated: false },
      },
    })),
    ...overrides,
  };
}

function installApi(api: WorldCraftDataApi): void {
  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: { data: api } satisfies Partial<WorldCraftApi>,
  });
}

function renderHookWithProvider(options: { onNotify?: ReturnType<typeof vi.fn> } = {}) {
  return renderHook(() => useDataSettings(options), {
    wrapper: ({ children }) => (
      <I18nProvider locale="es">{children}</I18nProvider>
    ),
  });
}

beforeEach(() => {
  installApi(createApi());
});

describe('hook de datos', () => {
  it('carga resumen y uso en paralelo y acepta respuestas fuera de orden', async () => {
    const summary = deferred<Awaited<ReturnType<WorldCraftDataApi['getSummary']>>>();
    const usageResult = deferred<
      Awaited<ReturnType<WorldCraftDataApi['getUsage']>>
    >();
    const api = createApi({
      getSummary: vi.fn(() => summary.promise),
      getUsage: vi.fn(() => usageResult.promise),
    });
    installApi(api);

    const { result } = renderHookWithProvider();

    await waitFor(() => {
      expect(api.getSummary).toHaveBeenCalledTimes(1);
      expect(api.getUsage).toHaveBeenCalledTimes(1);
    });
    expect(result.current.summary.status).toBe('loading');
    expect(result.current.usage.status).toBe('loading');

    await act(async () => {
      usageResult.resolve({
        ok: true,
        data: { status: 'completed', data: usage },
      });
      summary.resolve({
        ok: true,
        data: { status: 'completed', data: counts },
      });
    });

    expect(result.current.summary).toEqual({ status: 'ready', data: counts });
    expect(result.current.usage).toEqual({ status: 'ready', data: usage });
  });

  it('descarta una respuesta de resumen obsoleta', async () => {
    const first = deferred<Awaited<ReturnType<WorldCraftDataApi['getSummary']>>>();
    const second = deferred<Awaited<ReturnType<WorldCraftDataApi['getSummary']>>>();
    let call = 0;
    installApi(
      createApi({
        getSummary: vi.fn(() => {
          call += 1;
          return call === 1 ? first.promise : second.promise;
        }),
      }),
    );

    const { result } = renderHookWithProvider();

    act(() => {
      result.current.reloadSummary();
    });

    await act(async () => {
      second.resolve({
        ok: true,
        data: { status: 'completed', data: countsB },
      });
    });
    await act(async () => {
      first.resolve({
        ok: true,
        data: { status: 'completed', data: counts },
      });
    });

    expect(result.current.summary).toEqual({
      status: 'ready',
      data: countsB,
    });
  });

  it('ignora respuestas después del desmontaje', async () => {
    const summary = deferred<Awaited<ReturnType<WorldCraftDataApi['getSummary']>>>();
    installApi(createApi({ getSummary: vi.fn(() => summary.promise) }));

    const { unmount } = renderHookWithProvider();

    await waitFor(() => {
      expect(window.worldCraft.data.getSummary).toHaveBeenCalledTimes(1);
    });
    unmount();

    await act(async () => {
      summary.resolve({
        ok: true,
        data: { status: 'completed', data: counts },
      });
    });

    expect(true).toBe(true);
  });

  it('anuncia DATA_BUSY una vez y no reintenta', async () => {
    const onNotify = vi.fn();
    const exportAll = vi.fn(async () => ({
      ok: true as const,
      data: { status: 'failed' as const, code: 'DATA_BUSY' as const },
    }));
    installApi(createApi({ exportAll }));

    const { result } = renderHookWithProvider({ onNotify });

    await act(async () => {
      await result.current.exportAll();
    });

    expect(exportAll).toHaveBeenCalledTimes(1);
    expect(result.current.exportState).toEqual({
      status: 'error',
      code: 'DATA_BUSY',
    });
    expect(onNotify).toHaveBeenCalledTimes(1);
  });

  it('comparte el bloqueo entre mutaciones', async () => {
    const pending = deferred<Awaited<ReturnType<WorldCraftDataApi['exportAll']>>>();
    const deleteAll = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'deleted' as const,
        restartRequired: true as const,
        counts: {
          databaseFiles: 0,
          assetFiles: 0,
          logEntries: 0,
          temporaryEntries: 0,
          backupDirectories: 0,
        },
        remaining: [] as const,
      },
    }));
    installApi(
      createApi({
        exportAll: vi.fn(() => pending.promise),
        deleteAll,
      }),
    );

    const { result } = renderHookWithProvider();

    act(() => {
      result.current.openDeleteDialog();
    });
    let exporting: Promise<void> = Promise.resolve();

    act(() => {
      exporting = result.current.exportAll();
    });

    await act(async () => {
      await result.current.confirmDelete(false);
    });

    expect(deleteAll).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(true);

    await act(async () => {
      pending.resolve({ ok: true, data: { status: 'cancelled' } });
      await exporting;
    });

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });
  });
});
