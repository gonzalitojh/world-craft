import { describe, expect, it } from 'vitest';

import {
  createIdleUpdateSnapshot,
  isUpdateSnapshot,
  UPDATE_ERROR_CODES,
  UPDATE_PHASES,
  UPDATE_STATE_CHANGED_CHANNEL,
  UPDATE_UNAVAILABLE_REASONS,
} from '@/shared/contracts/updates';
import { isIpcChannel } from '@/shared/contracts/channels';

describe('contrato de actualizaciones', () => {
  it('publica las fases, códigos y motivos estables', () => {
    expect(UPDATE_PHASES).toEqual([
      'unavailable',
      'idle',
      'checking',
      'up-to-date',
      'available',
      'downloading',
      'downloaded',
      'installing',
      'error',
    ]);
    expect(UPDATE_ERROR_CODES).toEqual([
      'UPDATE_CHECK_FAILED',
      'UPDATE_DOWNLOAD_FAILED',
      'UPDATE_INSTALL_FAILED',
      'UPDATE_INVALID_STATE',
    ]);
    expect(UPDATE_UNAVAILABLE_REASONS).toEqual([
      'not-packaged',
      'safe-mode',
      'not-configured',
      'module-missing',
    ]);
  });

  it('crea un snapshot idle válido', () => {
    const snapshot = createIdleUpdateSnapshot('0.1.0');

    expect(isUpdateSnapshot(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('mantiene el evento de estado fuera de la allowlist de invoke', () => {
    expect(UPDATE_STATE_CHANGED_CHANNEL).toBe('updates:stateChanged');
    expect(isIpcChannel(UPDATE_STATE_CHANGED_CHANNEL)).toBe(false);
  });

  it('rechaza snapshots incoherentes', () => {
    for (const value of [
      null,
      {},
      { ...createIdleUpdateSnapshot('0.1.0'), phase: 'inventada' },
      { ...createIdleUpdateSnapshot('0.1.0'), currentVersion: '' },
      { ...createIdleUpdateSnapshot('0.1.0'), progressPercent: -1 },
      { ...createIdleUpdateSnapshot('0.1.0'), progressPercent: 101 },
      { ...createIdleUpdateSnapshot('0.1.0'), lastCheckedAt: 'ayer' },
      {
        ...createIdleUpdateSnapshot('0.1.0'),
        phase: 'unavailable',
        unavailableReason: null,
      },
      {
        ...createIdleUpdateSnapshot('0.1.0'),
        phase: 'downloading',
        availableVersion: '0.2.0',
        progressPercent: null,
      },
      {
        ...createIdleUpdateSnapshot('0.1.0'),
        phase: 'error',
        errorCode: 'OTRO',
      },
    ]) {
      expect(isUpdateSnapshot(value)).toBe(false);
    }
  });
});
