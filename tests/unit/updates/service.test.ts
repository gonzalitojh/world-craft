import { describe, expect, it, vi } from 'vitest';

import {
  createUnavailableUpdatesService,
  createUpdatesService,
  type UpdateAdapter,
  type UpdateCheckOutcome,
  type UpdateDownloadRequest,
} from '@/main/updates/service';
import type { UpdateLogEntry } from '@/main/updates/logger';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

class FakeAdapter implements UpdateAdapter {
  checkResult: Promise<UpdateCheckOutcome> = Promise.resolve({
    available: false,
    version: null,
  });
  downloadResult: Promise<'downloaded' | 'cancelled'> =
    Promise.resolve('downloaded');
  checkCalls = 0;
  downloadCalls = 0;
  installCalls = 0;
  disposeCalls = 0;
  lastDownloadRequest: UpdateDownloadRequest | null = null;

  check(): Promise<UpdateCheckOutcome> {
    this.checkCalls += 1;
    return this.checkResult;
  }

  download(
    request: UpdateDownloadRequest,
  ): Promise<'downloaded' | 'cancelled'> {
    this.downloadCalls += 1;
    this.lastDownloadRequest = request;
    return this.downloadResult;
  }

  install(): void {
    this.installCalls += 1;
  }

  dispose(): void {
    this.disposeCalls += 1;
  }
}

function createService(
  adapter: FakeAdapter,
  options?: {
    readonly checkTimeoutMs?: number;
    readonly now?: () => number;
    readonly logger?: { log(entry: UpdateLogEntry): void };
  },
) {
  return createUpdatesService({
    adapter,
    currentVersion: '0.1.0',
    ...(options?.checkTimeoutMs === undefined
      ? {}
      : { checkTimeoutMs: options.checkTimeoutMs }),
    ...(options?.now === undefined ? {} : { now: options.now }),
    ...(options?.logger === undefined ? {} : { logger: options.logger }),
  });
}

async function makeAvailable(
  service: ReturnType<typeof createService>,
  adapter: FakeAdapter,
): Promise<void> {
  adapter.checkResult = Promise.resolve({
    available: true,
    version: '0.2.0',
  });
  service.check();
  await vi.waitFor(() => {
    expect(service.getState().phase).toBe('available');
  });
}

describe('servicio de actualizaciones', () => {
  it('arranca en idle con la versión actual y sin última comprobación', () => {
    const service = createService(new FakeAdapter());

    expect(service.getState()).toMatchObject({
      phase: 'idle',
      currentVersion: '0.1.0',
      availableVersion: null,
      errorCode: null,
      progressPercent: null,
      lastCheckedAt: null,
    });
  });

  it('check devuelve checking de inmediato y termina en available', async () => {
    const adapter = new FakeAdapter();
    const outcome = deferred<UpdateCheckOutcome>();
    adapter.checkResult = outcome.promise;
    const now = () => 1_760_000_000_000;
    const service = createService(adapter, { now });

    expect(service.check().phase).toBe('checking');
    expect(service.getState().phase).toBe('checking');

    outcome.resolve({ available: true, version: '0.2.0' });

    await vi.waitFor(() => {
      expect(service.getState()).toMatchObject({
        phase: 'available',
        availableVersion: '0.2.0',
        errorCode: null,
        lastCheckedAt: new Date(now()).toISOString(),
      });
    });
  });

  it('check termina en up-to-date cuando no hay versión nueva', async () => {
    const service = createService(new FakeAdapter());

    service.check();

    await vi.waitFor(() => {
      expect(service.getState().phase).toBe('up-to-date');
    });
  });

  it('un error de comprobación se traduce al código estable', async () => {
    const adapter = new FakeAdapter();
    adapter.checkResult = Promise.reject(new Error('mensaje interno'));
    const service = createService(adapter);

    service.check();

    await vi.waitFor(() => {
      expect(service.getState()).toMatchObject({
        phase: 'error',
        errorCode: 'UPDATE_CHECK_FAILED',
      });
    });
    expect(JSON.stringify(service.getState())).not.toContain('mensaje interno');
  });

  it('aplica el timeout y descarta el resultado tardío', async () => {
    vi.useFakeTimers();

    try {
      const adapter = new FakeAdapter();
      const outcome = deferred<UpdateCheckOutcome>();
      adapter.checkResult = outcome.promise;
      const service = createService(adapter, { checkTimeoutMs: 100 });

      service.check();

      await vi.advanceTimersByTimeAsync(100);

      expect(service.getState()).toMatchObject({
        phase: 'error',
        errorCode: 'UPDATE_CHECK_FAILED',
      });

      outcome.resolve({ available: true, version: '0.2.0' });
      await Promise.resolve();
      await Promise.resolve();

      expect(service.getState()).toMatchObject({
        phase: 'error',
        errorCode: 'UPDATE_CHECK_FAILED',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancel detiene la comprobación y descarta su resultado', async () => {
    const adapter = new FakeAdapter();
    const outcome = deferred<UpdateCheckOutcome>();
    adapter.checkResult = outcome.promise;
    const service = createService(adapter);

    service.check();
    expect(service.getState().phase).toBe('checking');
    expect(service.cancel().phase).toBe('idle');

    outcome.resolve({ available: true, version: '0.2.0' });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.getState().phase).toBe('idle');
  });

  it('download solo se acepta en available y avanza el progreso', async () => {
    const adapter = new FakeAdapter();
    const service = createService(adapter);
    const download = deferred<'downloaded' | 'cancelled'>();
    adapter.downloadResult = download.promise;

    await makeAvailable(service, adapter);

    expect(service.getState().phase).toBe('available');
    expect(service.download().phase).toBe('downloading');

    adapter.lastDownloadRequest?.onProgress(42);
    expect(service.getState().progressPercent).toBe(42);

    download.resolve('downloaded');

    await vi.waitFor(() => {
      expect(service.getState()).toMatchObject({
        phase: 'downloaded',
        availableVersion: '0.2.0',
        progressPercent: 100,
      });
    });
  });

  it('cancel cancela el token de descarga y vuelve a available', async () => {
    const adapter = new FakeAdapter();
    const service = createService(adapter);
    adapter.downloadResult = new Promise(() => {});

    await makeAvailable(service, adapter);
    service.download();

    const token = adapter.lastDownloadRequest?.token;
    expect(token?.cancelled).toBe(false);

    expect(service.cancel().phase).toBe('available');
    expect(token?.cancelled).toBe(true);
  });

  it('un segundo download durante la descarga no cambia el estado ni repite la llamada', async () => {
    const adapter = new FakeAdapter();
    const service = createService(adapter);
    adapter.downloadResult = new Promise(() => {});

    await makeAvailable(service, adapter);

    expect(service.download().phase).toBe('downloading');
    expect(service.download().phase).toBe('downloading');
    expect(adapter.downloadCalls).toBe(1);
  });

  it('install durante downloading devuelve el snapshot sin pasar a error', async () => {
    const adapter = new FakeAdapter();
    const service = createService(adapter);
    adapter.downloadResult = new Promise(() => {});

    await makeAvailable(service, adapter);
    service.download();

    expect(service.install().phase).toBe('downloading');
    expect(adapter.installCalls).toBe(0);
  });

  it('un segundo install durante la instalación no repite la llamada', async () => {
    const adapter = new FakeAdapter();
    const service = createService(adapter);

    await makeAvailable(service, adapter);
    service.download();
    await vi.waitFor(() => {
      expect(service.getState().phase).toBe('downloaded');
    });

    expect(service.install().phase).toBe('installing');
    expect(service.install().phase).toBe('installing');
    expect(adapter.installCalls).toBe(1);
  });

  it('un error de descarga se traduce al código estable', async () => {
    const adapter = new FakeAdapter();
    const service = createService(adapter);

    await makeAvailable(service, adapter);
    adapter.downloadResult = Promise.reject(new Error('detalle interno'));
    service.download();

    await vi.waitFor(() => {
      expect(service.getState()).toMatchObject({
        phase: 'error',
        errorCode: 'UPDATE_DOWNLOAD_FAILED',
      });
    });
  });

  it('download fuera de available se rechaza con UPDATE_INVALID_STATE', () => {
    const service = createService(new FakeAdapter());

    expect(service.download()).toMatchObject({
      phase: 'error',
      errorCode: 'UPDATE_INVALID_STATE',
    });
  });

  it('install solo se acepta en downloaded y llama al adaptador', async () => {
    const adapter = new FakeAdapter();
    const service = createService(adapter);

    expect(service.install()).toMatchObject({
      phase: 'error',
      errorCode: 'UPDATE_INVALID_STATE',
    });

    await makeAvailable(service, adapter);
    service.download();

    await vi.waitFor(() => {
      expect(service.getState().phase).toBe('downloaded');
    });

    expect(service.install().phase).toBe('installing');
    expect(adapter.installCalls).toBe(1);
  });

  it('un fallo de instalación se traduce al código estable', async () => {
    const adapter = new FakeAdapter();
    adapter.install = () => {
      throw new Error('fallo');
    };
    const service = createService(adapter);

    await makeAvailable(service, adapter);
    service.download();
    await vi.waitFor(() => {
      expect(service.getState().phase).toBe('downloaded');
    });

    expect(service.install()).toMatchObject({
      phase: 'error',
      errorCode: 'UPDATE_INSTALL_FAILED',
    });
  });

  it('notifica cambios y permite desuscribirse', async () => {
    const service = createService(new FakeAdapter());
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    service.check();
    await vi.waitFor(() => {
      expect(service.getState().phase).toBe('up-to-date');
    });

    const callsBeforeUnsubscribe = listener.mock.calls.length;
    expect(callsBeforeUnsubscribe).toBeGreaterThan(0);

    unsubscribe();
    service.check();
    await vi.waitFor(() => {
      expect(service.getState().phase).toBe('up-to-date');
    });

    expect(listener.mock.calls.length).toBe(callsBeforeUnsubscribe);
  });

  it('registra solo eventos tipados', async () => {
    const entries: UpdateLogEntry[] = [];
    const service = createService(new FakeAdapter(), {
      logger: { log: (entry) => entries.push(entry) },
    });

    service.check();
    await vi.waitFor(() => {
      expect(service.getState().phase).toBe('up-to-date');
    });

    expect(entries).toEqual([
      { event: 'update.check', outcome: 'started' },
      { event: 'update.check', outcome: 'up-to-date' },
    ]);
  });

  it('dispose cancela, limpia la suscripción y libera el adaptador', () => {
    const adapter = new FakeAdapter();
    const service = createService(adapter);
    const listener = vi.fn();

    service.subscribe(listener);
    service.dispose();
    service.dispose();
    service.check();

    expect(adapter.disposeCalls).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    expect(service.getState().phase).toBe('idle');
  });

  it('el servicio deshabilitado no ejecuta ninguna orden', () => {
    const service = createUnavailableUpdatesService({
      reason: 'safe-mode',
      currentVersion: '0.1.0',
    });

    for (const snapshot of [
      service.getState(),
      service.check(),
      service.cancel(),
      service.download(),
      service.install(),
    ]) {
      expect(snapshot).toMatchObject({
        phase: 'unavailable',
        unavailableReason: 'safe-mode',
      });
    }
  });
});
