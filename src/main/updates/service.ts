/**
 * Máquina de estados del actualizador.
 *
 * No conoce Electron ni electron-updater: recibe un puerto `UpdateAdapter` y
 * se prueba con dobles. La comprobación es siempre manual, devuelve el
 * snapshot de inmediato y continúa en segundo plano. Un `epoch` descarta
 * resultados tardíos después de cancelar o de un timeout.
 */
import { CancellationToken } from 'builder-util-runtime';

import {
  createIdleUpdateSnapshot,
  type UpdateErrorCode,
  type UpdateSnapshot,
  type UpdateUnavailableReason,
} from '../../shared/contracts/updates';
import type { UpdateLogger } from './logger';

/** Resultado de una comprobación real. */
export interface UpdateCheckOutcome {
  readonly available: boolean;
  readonly version: string | null;
}

/** Petición de descarga que el adaptador traduce a electron-updater. */
export interface UpdateDownloadRequest {
  readonly token: CancellationToken;
  readonly onProgress: (percent: number) => void;
}

/** Puerto que implementa el adaptador real o un doble de prueba. */
export interface UpdateAdapter {
  check(): Promise<UpdateCheckOutcome>;
  download(request: UpdateDownloadRequest): Promise<'downloaded' | 'cancelled'>;
  install(): void;
  dispose(): void;
}

/** Servicio consumido por los handlers IPC y la composición. */
export interface UpdatesService {
  getState(): UpdateSnapshot;
  subscribe(listener: (snapshot: UpdateSnapshot) => void): () => void;
  check(): UpdateSnapshot;
  cancel(): UpdateSnapshot;
  download(): UpdateSnapshot;
  install(): UpdateSnapshot;
  dispose(): void;
}

export interface UpdatesServiceOptions {
  readonly adapter: UpdateAdapter;
  readonly currentVersion: string;
  readonly logger?: UpdateLogger;
  readonly now?: () => number;
  /** Timeout de la comprobación; se inyecta en pruebas. */
  readonly checkTimeoutMs?: number;
}

/** Timeout por defecto de una comprobación, en milisegundos. */
export const UPDATE_CHECK_TIMEOUT_MS = 30_000;

const CHECKABLE_PHASES = new Set(['idle', 'up-to-date', 'available', 'error']);

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

/**
 * Crea un servicio deshabilitado que conserva el motivo.
 *
 * No tiene adaptador ni red: todas las órdenes devuelven el mismo snapshot.
 */
export function createUnavailableUpdatesService(options: {
  readonly reason: UpdateUnavailableReason;
  readonly currentVersion: string;
}): UpdatesService {
  const snapshot: UpdateSnapshot = Object.freeze({
    ...createIdleUpdateSnapshot(options.currentVersion),
    phase: 'unavailable' as const,
    unavailableReason: options.reason,
  });

  return {
    getState: () => snapshot,
    subscribe: () => () => {},
    check: () => snapshot,
    cancel: () => snapshot,
    download: () => snapshot,
    install: () => snapshot,
    dispose: () => {},
  };
}

class StatefulUpdatesService implements UpdatesService {
  private readonly adapter: UpdateAdapter;
  private readonly logger: UpdateLogger | undefined;
  private readonly now: () => number;
  private readonly checkTimeoutMs: number;
  private readonly listeners = new Set<(snapshot: UpdateSnapshot) => void>();

  private snapshot: UpdateSnapshot;
  private checkEpoch = 0;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private downloadEpoch = 0;
  private downloadToken: CancellationToken | null = null;
  private disposed = false;

  constructor(options: UpdatesServiceOptions) {
    this.adapter = options.adapter;
    this.logger = options.logger;
    this.now = options.now ?? Date.now;
    this.checkTimeoutMs = options.checkTimeoutMs ?? UPDATE_CHECK_TIMEOUT_MS;
    this.snapshot = createIdleUpdateSnapshot(options.currentVersion);
  }

  getState(): UpdateSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: UpdateSnapshot) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  check(): UpdateSnapshot {
    if (this.disposed || !CHECKABLE_PHASES.has(this.snapshot.phase)) {
      return this.snapshot;
    }

    this.checkEpoch += 1;
    const epoch = this.checkEpoch;

    this.clearCheckTimer();
    this.logger?.log({ event: 'update.check', outcome: 'started' });
    this.setSnapshot({
      ...this.snapshot,
      phase: 'checking',
      availableVersion: null,
      errorCode: null,
      progressPercent: null,
    });

    this.checkTimer = setTimeout(() => {
      if (epoch !== this.checkEpoch || this.disposed) {
        return;
      }

      this.checkTimer = null;
      this.checkEpoch += 1;
      this.logger?.log({ event: 'update.check', outcome: 'timeout' });
      this.finishCheckWithError('UPDATE_CHECK_FAILED');
    }, this.checkTimeoutMs);
    this.checkTimer.unref?.();

    void Promise.resolve()
      .then(() => this.adapter.check())
      .then((outcome) => {
        if (epoch !== this.checkEpoch || this.disposed) {
          return;
        }

        this.clearCheckTimer();

        if (outcome.available && outcome.version !== null) {
          this.logger?.log({ event: 'update.check', outcome: 'available' });
          this.setSnapshot({
            ...this.snapshot,
            phase: 'available',
            availableVersion: outcome.version,
            errorCode: null,
            progressPercent: null,
            lastCheckedAt: this.timestamp(),
          });
          return;
        }

        this.logger?.log({ event: 'update.check', outcome: 'up-to-date' });
        this.setSnapshot({
          ...this.snapshot,
          phase: 'up-to-date',
          availableVersion: null,
          errorCode: null,
          progressPercent: null,
          lastCheckedAt: this.timestamp(),
        });
      })
      .catch(() => {
        if (epoch !== this.checkEpoch || this.disposed) {
          return;
        }

        this.clearCheckTimer();
        this.logger?.log({ event: 'update.check', outcome: 'failed' });
        this.finishCheckWithError('UPDATE_CHECK_FAILED');
      });

    return this.snapshot;
  }

  cancel(): UpdateSnapshot {
    if (this.disposed) {
      return this.snapshot;
    }

    if (this.snapshot.phase === 'checking') {
      this.checkEpoch += 1;
      this.clearCheckTimer();
      this.logger?.log({ event: 'update.check', outcome: 'cancelled' });
      this.setSnapshot({
        ...this.snapshot,
        phase: 'idle',
        availableVersion: null,
        errorCode: null,
        progressPercent: null,
      });
      return this.snapshot;
    }

    if (this.snapshot.phase === 'downloading') {
      this.downloadEpoch += 1;
      this.downloadToken?.cancel();
      this.downloadToken = null;
      this.logger?.log({ event: 'update.download', outcome: 'cancelled' });
      this.setSnapshot({
        ...this.snapshot,
        phase: 'available',
        errorCode: null,
        progressPercent: null,
      });
    }

    return this.snapshot;
  }

  download(): UpdateSnapshot {
    if (this.disposed) {
      return this.snapshot;
    }

    // Un doble clic o una orden repetida durante la descarga o la instalación
    // no debe convertir el estado en un error mientras la operación original
    // sigue viva. Se devuelve el snapshot actual sin tocar el adaptador.
    if (
      this.snapshot.phase === 'downloading' ||
      this.snapshot.phase === 'downloaded' ||
      this.snapshot.phase === 'installing'
    ) {
      return this.snapshot;
    }

    if (this.snapshot.phase !== 'available') {
      return this.invalidState();
    }

    const version = this.snapshot.availableVersion;

    if (version === null) {
      return this.invalidState();
    }

    this.downloadEpoch += 1;
    const epoch = this.downloadEpoch;
    const token = new CancellationToken();
    this.downloadToken = token;

    this.logger?.log({ event: 'update.download', outcome: 'started' });
    this.setSnapshot({
      ...this.snapshot,
      phase: 'downloading',
      errorCode: null,
      progressPercent: 0,
    });

    const onProgress = (percent: number): void => {
      if (
        this.disposed ||
        epoch !== this.downloadEpoch ||
        this.snapshot.phase !== 'downloading'
      ) {
        return;
      }

      this.setSnapshot({
        ...this.snapshot,
        progressPercent: clampPercent(percent),
      });
    };

    let pending: Promise<'downloaded' | 'cancelled'>;

    try {
      pending = this.adapter.download({ token, onProgress });
    } catch {
      this.downloadToken = null;
      token.dispose();
      this.logger?.log({ event: 'update.download', outcome: 'failed' });
      this.setSnapshot({
        ...this.snapshot,
        phase: 'error',
        errorCode: 'UPDATE_DOWNLOAD_FAILED',
        progressPercent: null,
      });

      return this.snapshot;
    }

    void pending
      .then((result) => {
        if (this.disposed || epoch !== this.downloadEpoch) {
          return;
        }

        if (result === 'cancelled' || token.cancelled) {
          this.logger?.log({ event: 'update.download', outcome: 'cancelled' });
          this.setSnapshot({
            ...this.snapshot,
            phase: 'available',
            errorCode: null,
            progressPercent: null,
          });
          return;
        }

        this.logger?.log({ event: 'update.download', outcome: 'completed' });
        this.setSnapshot({
          ...this.snapshot,
          phase: 'downloaded',
          availableVersion: version,
          errorCode: null,
          progressPercent: 100,
        });
      })
      .catch(() => {
        if (this.disposed || epoch !== this.downloadEpoch) {
          return;
        }

        if (token.cancelled) {
          this.logger?.log({ event: 'update.download', outcome: 'cancelled' });
          this.setSnapshot({
            ...this.snapshot,
            phase: 'available',
            errorCode: null,
            progressPercent: null,
          });
          return;
        }

        this.logger?.log({ event: 'update.download', outcome: 'failed' });
        this.setSnapshot({
          ...this.snapshot,
          phase: 'error',
          errorCode: 'UPDATE_DOWNLOAD_FAILED',
          progressPercent: null,
        });
      })
      .finally(() => {
        if (this.downloadToken === token) {
          this.downloadToken = null;
        }

        token.dispose();
      });

    return this.snapshot;
  }

  install(): UpdateSnapshot {
    if (this.disposed) {
      return this.snapshot;
    }

    if (
      this.snapshot.phase === 'installing' ||
      this.snapshot.phase === 'downloading'
    ) {
      return this.snapshot;
    }

    if (this.snapshot.phase !== 'downloaded') {
      return this.invalidState();
    }

    this.logger?.log({ event: 'update.install', outcome: 'started' });
    this.setSnapshot({
      ...this.snapshot,
      phase: 'installing',
      errorCode: null,
    });

    try {
      this.adapter.install();
    } catch {
      this.logger?.log({ event: 'update.install', outcome: 'failed' });
      this.setSnapshot({
        ...this.snapshot,
        phase: 'error',
        errorCode: 'UPDATE_INSTALL_FAILED',
      });
    }

    return this.snapshot;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.checkEpoch += 1;
    this.downloadEpoch += 1;
    this.clearCheckTimer();
    this.downloadToken?.cancel();
    this.downloadToken = null;
    this.listeners.clear();

    try {
      this.adapter.dispose();
    } catch {
      // La liberación del adaptador nunca debe impedir el cierre.
    }
  }

  private invalidState(): UpdateSnapshot {
    this.logger?.log({ event: 'update.command', outcome: 'rejected' });
    this.setSnapshot({
      ...this.snapshot,
      phase: 'error',
      errorCode: 'UPDATE_INVALID_STATE',
      progressPercent: null,
    });

    return this.snapshot;
  }

  private finishCheckWithError(code: UpdateErrorCode): void {
    this.setSnapshot({
      ...this.snapshot,
      phase: 'error',
      errorCode: code,
      progressPercent: null,
      lastCheckedAt: this.timestamp(),
    });
  }

  private clearCheckTimer(): void {
    if (this.checkTimer !== null) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
  }

  private timestamp(): string {
    return new Date(this.now()).toISOString();
  }

  private setSnapshot(snapshot: UpdateSnapshot): void {
    this.snapshot = Object.freeze(snapshot);

    for (const listener of this.listeners) {
      try {
        listener(this.snapshot);
      } catch {
        // Un consumidor roto no debe detener la máquina de estados.
      }
    }
  }
}

/** Crea el servicio con adaptador real o inyectado. */
export function createUpdatesService(
  options: UpdatesServiceOptions,
): UpdatesService {
  return new StatefulUpdatesService(options);
}
