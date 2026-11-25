import { describe, expect, it } from 'vitest';

import type {
  TransferExportResult,
  TransferImportResult,
  TransferProgressEvent,
} from '@/shared/contracts/transfer';
import {
  INITIAL_TRANSFER_DIALOG_STATE,
  hasTransferWarnings,
  isTerminal,
  isTransferRetryable,
  transferDialogReducer,
  type TransferDialogState,
} from '@/renderer/transfer/state';

const OPERATION_ID = '018f1000-0000-7000-8000-000000000001';
const OTHER_ID = '018f1000-0000-7000-8000-000000000002';

const counts = {
  entities: 1,
  entityTypes: 1,
  relationTypes: 1,
  tags: 1,
  relations: 1,
  versions: 1,
  assets: 1,
};

function event(
  overrides: Partial<TransferProgressEvent> = {},
): TransferProgressEvent {
  return {
    operationId: OPERATION_ID,
    operation: 'export',
    phase: 'packaging',
    completed: 1,
    total: 2,
    unit: 'files',
    cancelable: true,
    warnings: 0,
    ...overrides,
  };
}

function running(): TransferDialogState {
  return transferDialogReducer(INITIAL_TRANSFER_DIALOG_STATE, {
    type: 'event',
    event: event(),
    worldName: 'Mundo',
  });
}

describe('máquina de estados de transferencia', () => {
  it('abre running con el primer evento y conserva el mundo', () => {
    const state = running();

    expect(state).toEqual({
      status: 'running',
      operation: 'export',
      operationId: OPERATION_ID,
      worldName: 'Mundo',
      phase: 'packaging',
      completed: 1,
      total: 2,
      unit: 'files',
      cancelable: true,
      cancelError: false,
    });
  });

  it('ignora eventos de otra operación, de otro operationId o terminales', () => {
    const state = running();

    expect(
      transferDialogReducer(state, {
        type: 'event',
        event: event({ operation: 'import' }),
        worldName: 'Mundo',
      }),
    ).toBe(state);
    expect(
      transferDialogReducer(state, {
        type: 'event',
        event: event({ operationId: OTHER_ID }),
        worldName: 'Mundo',
      }),
    ).toBe(state);

    const exported = transferDialogReducer(state, {
      type: 'exportCompleted',
      result: {
        worldId: OPERATION_ID,
        worldName: 'Mundo',
        fileName: 'mundo.zip',
        size: 1,
        counts,
        warnings: [],
      },
    });

    expect(
      transferDialogReducer(exported, {
        type: 'event',
        event: event(),
        worldName: 'Mundo',
      }),
    ).toBe(exported);
  });

  it('una vez cancelable=false ya no vuelve a true', () => {
    const locked = transferDialogReducer(running(), {
      type: 'event',
      event: event({ phase: 'saving', cancelable: false }),
      worldName: 'Mundo',
    });

    expect(locked.status).toBe('running');

    if (locked.status !== 'running') {
      return;
    }

    expect(locked.cancelable).toBe(false);
    const later = transferDialogReducer(locked, {
      type: 'event',
      event: event({ cancelable: true }),
      worldName: 'Mundo',
    });

    expect(later.status === 'running' && later.cancelable).toBe(false);
  });

  it('pasa a cancelling y vuelve a running si el coordinador rechaza', () => {
    const cancelling = transferDialogReducer(running(), {
      type: 'cancelRequested',
    });

    expect(cancelling.status).toBe('cancelling');

    const rejected = transferDialogReducer(cancelling, {
      type: 'cancelRejected',
      error: false,
    });

    expect(rejected).toMatchObject({
      status: 'running',
      cancelable: false,
      cancelError: false,
    });

    const failedCancel = transferDialogReducer(cancelling, {
      type: 'cancelRejected',
      error: true,
    });

    expect(failedCancel).toMatchObject({
      status: 'running',
      cancelable: true,
      cancelError: true,
    });

    // El fallo de transporte permite reintentar la cancelación.
    const retried = transferDialogReducer(failedCancel, {
      type: 'cancelRequested',
    });
    expect(retried.status).toBe('cancelling');
  });

  it('mantiene el progreso durante la cancelación y acepta el éxito tardío', () => {
    const cancelling = transferDialogReducer(running(), {
      type: 'cancelRequested',
    });
    const updated = transferDialogReducer(cancelling, {
      type: 'event',
      event: event({ phase: 'saving', completed: 2, cancelable: false }),
      worldName: 'Mundo',
    });

    expect(updated).toMatchObject({
      status: 'cancelling',
      phase: 'saving',
      completed: 2,
    });

    const result: TransferExportResult = {
      worldId: OPERATION_ID,
      worldName: 'Mundo',
      fileName: 'mundo.zip',
      size: 1,
      counts,
      warnings: [],
    };
    const exported = transferDialogReducer(updated, {
      type: 'exportCompleted',
      result,
    });

    expect(exported).toEqual({ status: 'exported', result });
  });

  it('registra fallo, reintento y cancelación del reintento', () => {
    const failed = transferDialogReducer(running(), {
      type: 'failed',
      operation: 'import',
      worldName: null,
      code: 'TRANSPORT',
    });

    expect(failed).toEqual({
      status: 'failed',
      operation: 'import',
      worldName: null,
      code: 'TRANSPORT',
      retrying: false,
    });

    const retrying = transferDialogReducer(failed, { type: 'retryStarted' });
    expect(retrying.status === 'failed' && retrying.retrying).toBe(true);

    const reopened = transferDialogReducer(retrying, {
      type: 'event',
      event: {
        ...event(),
        operation: 'import',
        operationId: OTHER_ID,
        phase: 'reading',
        total: null,
        unit: 'steps',
      },
      worldName: null,
    });

    expect(reopened).toMatchObject({
      status: 'running',
      operation: 'import',
      operationId: OTHER_ID,
      worldName: null,
      phase: 'reading',
      unit: 'steps',
    });

    const cancelled = transferDialogReducer(retrying, {
      type: 'retryCancelled',
    });
    expect(cancelled).toMatchObject({ status: 'failed', retrying: false });
  });

  it('cierra desde estados terminales y reinicia', () => {
    expect(transferDialogReducer(running(), { type: 'cancelled' })).toEqual(
      INITIAL_TRANSFER_DIALOG_STATE,
    );
    expect(transferDialogReducer(running(), { type: 'close' })).toEqual(
      INITIAL_TRANSFER_DIALOG_STATE,
    );
  });

  it('detecta terminales, avisos y errores reintentables', () => {
    expect(isTerminal(INITIAL_TRANSFER_DIALOG_STATE)).toBe(true);
    expect(isTerminal(running())).toBe(false);
    expect(
      isTerminal({
        status: 'failed',
        operation: 'export',
        worldName: null,
        code: 'UNKNOWN',
        retrying: false,
      }),
    ).toBe(true);

    const exported: TransferExportResult = {
      worldId: OPERATION_ID,
      worldName: 'Mundo',
      fileName: 'mundo.zip',
      size: 1,
      counts,
      warnings: [{ code: 'missing-tag', count: 2 }],
    };
    const imported: TransferImportResult = {
      worldId: OPERATION_ID,
      worldName: 'Mundo',
      slug: 'mundo-2',
      slugAdjusted: true,
      counts,
      warnings: [],
    };

    expect(hasTransferWarnings(exported)).toBe(true);
    expect(hasTransferWarnings(imported)).toBe(true);
    expect(hasTransferWarnings({ ...imported, slugAdjusted: false })).toBe(
      false,
    );
    expect(isTransferRetryable('TRANSPORT')).toBe(true);
    expect(isTransferRetryable('TRANSFER_BUSY')).toBe(true);
    expect(isTransferRetryable('TRANSFER_UNAVAILABLE')).toBe(false);
    expect(isTransferRetryable('TRANSFER_FORMAT_UNSUPPORTED')).toBe(false);
  });
});
