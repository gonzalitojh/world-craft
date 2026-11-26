import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiPreferences } from '@/renderer/preferences/use-ui-preferences';
import { applyAppearance } from '@/renderer/theme';
import {
  createDefaultUiPreferences,
  type UiPreferences,
  type UiPreferencesPatch,
} from '@/shared/contracts/preferences';
import type { IpcResult } from '@/shared/contracts/result';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

function createInitial(overrides: Partial<UiPreferences> = {}): UiPreferences {
  return { ...createDefaultUiPreferences(), ...overrides };
}

interface ApiMock {
  readonly update: ReturnType<typeof vi.fn>;
  readonly reset: ReturnType<typeof vi.fn>;
}

function installApi(
  updateImpl?: (patch: UiPreferencesPatch) => Promise<IpcResult<UiPreferences>>,
  resetImpl?: () => Promise<IpcResult<UiPreferences>>,
): ApiMock {
  const update = vi.fn(
    updateImpl ??
      (async (patch: UiPreferencesPatch) => ({
        ok: true as const,
        data: createInitial(patch as Partial<UiPreferences>),
      })),
  );
  const reset = vi.fn(
    resetImpl ??
      (async () => ({ ok: true as const, data: createDefaultUiPreferences() })),
  );

  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: { preferences: { get: vi.fn(), update, reset } },
  });

  return { update, reset };
}

beforeEach(() => {
  document.documentElement.dataset.theme = 'light';
  document.documentElement.dataset.density = 'comfortable';
  document.documentElement.dataset.fontScale = 'normal';
});

describe('applyAppearance', () => {
  it('fija tema, densidad y tamaño en el mismo evento', () => {
    applyAppearance({ theme: 'dark', density: 'compact', fontScale: 'large' });

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(document.documentElement.dataset.fontScale).toBe('large');
  });

  it('cae a los valores seguros si la forma es inválida', () => {
    applyAppearance({
      theme: 'sepia',
      density: 'amplia',
      fontScale: 'gigante',
    } as unknown as Parameters<typeof applyAppearance>[0]);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.density).toBe('comfortable');
    expect(document.documentElement.dataset.fontScale).toBe('normal');
  });
});

describe('useUiPreferences', () => {
  it('parte del snapshot del bootstrap sin volver a pedirlo', () => {
    installApi();
    const initial = createInitial({ theme: 'dark', railCollapsed: true });

    const { result } = renderHook(() => useUiPreferences(initial));

    expect(result.current.preferences).toEqual(initial);
    expect(window.worldCraft.preferences.get).not.toHaveBeenCalled();
  });

  it('aplica el cambio de forma optimista y adopta la respuesta canónica', async () => {
    const pending = deferred<IpcResult<UiPreferences>>();
    const { update } = installApi(() => pending.promise);
    const initial = createInitial();
    const { result } = renderHook(() => useUiPreferences(initial));

    act(() => {
      result.current.update({ theme: 'dark' });
    });

    expect(result.current.preferences.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(update).toHaveBeenCalledWith({ theme: 'dark' });

    await act(async () => {
      pending.resolve({
        ok: true,
        data: createInitial({
          theme: 'dark',
          railCollapsed: true,
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.preferences.railCollapsed).toBe(true);
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('aplica densidad y tamaño de forma optimista y adopta la respuesta', async () => {
    const pending = deferred<IpcResult<UiPreferences>>();
    const { update } = installApi(() => pending.promise);
    const { result } = renderHook(() => useUiPreferences(createInitial()));

    act(() => {
      result.current.update({ density: 'compact', fontScale: 'large' });
    });

    expect(result.current.preferences.density).toBe('compact');
    expect(result.current.preferences.fontScale).toBe('large');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(document.documentElement.dataset.fontScale).toBe('large');

    await act(async () => {
      pending.resolve({
        ok: true,
        data: createInitial({ density: 'compact', fontScale: 'small' }),
      });
    });

    await waitFor(() => {
      expect(result.current.preferences.fontScale).toBe('small');
    });
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(document.documentElement.dataset.fontScale).toBe('small');
    expect(update).toHaveBeenCalledWith({
      density: 'compact',
      fontScale: 'large',
    });
  });

  it('conserva el estado de la sesión si la escritura falla', async () => {
    installApi(async () => ({ ok: false, error: { code: 'INTERNAL_ERROR' } }));
    const { result } = renderHook(() => useUiPreferences(createInitial()));

    act(() => {
      result.current.update({ railCollapsed: true });
    });

    await waitFor(() => {
      expect(result.current.preferences.railCollapsed).toBe(true);
    });
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('descarta una respuesta tardía frente a un cambio más reciente', async () => {
    const first = deferred<IpcResult<UiPreferences>>();
    const second = deferred<IpcResult<UiPreferences>>();
    let call = 0;
    installApi(() => {
      call += 1;

      return call === 1 ? first.promise : second.promise;
    });
    const { result } = renderHook(() => useUiPreferences(createInitial()));

    act(() => {
      result.current.update({ theme: 'dark' });
    });
    act(() => {
      result.current.update({ theme: 'light' });
    });

    await act(async () => {
      second.resolve({ ok: true, data: createInitial({ theme: 'light' }) });
    });
    await act(async () => {
      first.resolve({ ok: true, data: createInitial({ theme: 'dark' }) });
    });

    expect(result.current.preferences.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('alterna el tema con el estado más reciente', async () => {
    const { update } = installApi(async (patch) => ({
      ok: true,
      data: createInitial(patch as Partial<UiPreferences>),
    }));
    const { result } = renderHook(() =>
      useUiPreferences(createInitial({ theme: 'light' })),
    );

    act(() => {
      result.current.toggleTheme();
    });

    expect(update).toHaveBeenLastCalledWith({ theme: 'dark' });
    expect(result.current.preferences.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('reset adopta los defectos en caliente', async () => {
    const { reset } = installApi();
    const { result } = renderHook(() =>
      useUiPreferences(
        createInitial({
          theme: 'dark',
          density: 'compact',
          fontScale: 'large',
          railCollapsed: true,
          lastView: 'entity',
          recentLocation: {
            kind: 'world',
            worldId: '01900000-0000-7000-8000-000000000001',
          },
        }),
      ),
    );

    act(() => {
      result.current.reset();
    });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(result.current.preferences).toEqual(createDefaultUiPreferences());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.density).toBe('comfortable');
    expect(document.documentElement.dataset.fontScale).toBe('normal');
  });
});
