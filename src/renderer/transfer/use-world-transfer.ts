/**
 * Hook del diálogo de exportación e importación.
 *
 * Mantiene la máquina de estados, filtra eventos de operaciones ajenas y
 * distingue el cierre del selector nativo de una cancelación real con
 * `sawProgressRef`. La API del preload es la única frontera de transporte.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import type {
  TransferExportResult,
  TransferImportResult,
  TransferProgressEvent,
  TransferRunResult,
} from '../../shared/contracts/transfer';
import type { IpcResult } from '../../shared/contracts/result';
import type { ToastTone } from '../components/toast';
import type { WorldSummary } from '../../shared/contracts/worlds';
import { useMessages } from '../i18n/provider';

import {
  INITIAL_TRANSFER_DIALOG_STATE,
  isTerminal,
  transferDialogReducer,
  type TransferDialogState,
} from './state';

type TransferRequest =
  | {
      readonly operation: 'export';
      readonly worldId: string;
      readonly worldName: string;
    }
  | {
      readonly operation: 'import';
    };

export interface UseWorldTransferOptions {
  readonly onNotify: (tone: ToastTone, message: string) => void;
  readonly onImported: (worldId: string) => void;
}

export interface WorldTransferController {
  readonly state: TransferDialogState;
  readonly startExport: (world: Pick<WorldSummary, 'id' | 'name'>) => void;
  readonly startImport: () => void;
  readonly cancel: () => void;
  readonly retry: () => void;
  readonly close: () => void;
}

type TransferResponse =
  | IpcResult<TransferRunResult<TransferExportResult>>
  | IpcResult<TransferRunResult<TransferImportResult>>;

/** Hook que conecta la API de transferencia con la máquina de estados. */
export function useWorldTransfer({
  onNotify,
  onImported,
}: UseWorldTransferOptions): WorldTransferController {
  const messages = useMessages();
  const [state, dispatch] = useReducer(
    transferDialogReducer,
    INITIAL_TRANSFER_DIALOG_STATE,
  );
  const pendingRef = useRef<TransferRequest | null>(null);
  const lastRequestRef = useRef<TransferRequest | null>(null);
  const sawProgressRef = useRef(false);
  const retryingRef = useRef(false);
  const operationIdRef = useRef<string | null>(null);
  const cancelInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const api = window.worldCraft.transfer;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const notifyCancelled = useCallback(
    (request: TransferRequest): void => {
      if (request.operation === 'export') {
        onNotify(
          'info',
          messages.transfer.toasts.exportCancelled(request.worldName),
        );
        return;
      }

      onNotify('info', messages.transfer.toasts.importCancelled);
    },
    [messages, onNotify],
  );

  const finishRequest = useCallback(
    (request: TransferRequest, result: TransferResponse): void => {
      if (!mountedRef.current) {
        return;
      }

      if (pendingRef.current !== request) {
        return;
      }

      pendingRef.current = null;
      const sawProgress = sawProgressRef.current;
      const wasRetrying = retryingRef.current;

      sawProgressRef.current = false;
      retryingRef.current = false;
      operationIdRef.current = null;
      cancelInFlightRef.current = false;

      if (!result.ok) {
        dispatch({
          type: 'failed',
          operation: request.operation,
          worldName: request.operation === 'export' ? request.worldName : null,
          code:
            result.error.code === 'INTERNAL_ERROR' ? 'UNKNOWN' : 'TRANSPORT',
        });
        return;
      }

      const data = result.data;

      if (data.status === 'completed') {
        if (request.operation === 'export') {
          dispatch({
            type: 'exportCompleted',
            result: data.data as TransferExportResult,
          });
        } else {
          dispatch({
            type: 'importCompleted',
            result: data.data as TransferImportResult,
          });
          onImported(data.data.worldId);
        }
        return;
      }

      if (data.status === 'cancelled') {
        if (wasRetrying) {
          dispatch({ type: 'retryCancelled' });
          return;
        }

        if (sawProgress) {
          dispatch({ type: 'cancelled' });
          notifyCancelled(request);
          return;
        }

        dispatch({ type: 'close' });
        return;
      }

      dispatch({
        type: 'failed',
        operation: request.operation,
        worldName: request.operation === 'export' ? request.worldName : null,
        code: data.code,
      });
    },
    [notifyCancelled, onImported],
  );

  const runRequest = useCallback(
    (request: TransferRequest): void => {
      const promise: Promise<TransferResponse> =
        request.operation === 'export'
          ? api.exportWorld(request.worldId)
          : api.importWorld();

      void promise.then(
        (result) => {
          finishRequest(request, result);
        },
        () => {
          if (!mountedRef.current || pendingRef.current !== request) {
            return;
          }

          pendingRef.current = null;
          sawProgressRef.current = false;
          retryingRef.current = false;
          operationIdRef.current = null;
          cancelInFlightRef.current = false;
          dispatch({
            type: 'failed',
            operation: request.operation,
            worldName:
              request.operation === 'export' ? request.worldName : null,
            code: 'TRANSPORT',
          });
        },
      );
    },
    [api, finishRequest],
  );

  const start = useCallback(
    (request: TransferRequest): void => {
      if (pendingRef.current !== null) {
        return;
      }

      pendingRef.current = request;
      lastRequestRef.current = request;
      sawProgressRef.current = false;
      retryingRef.current = false;
      operationIdRef.current = null;
      cancelInFlightRef.current = false;
      dispatch({ type: 'reset' });
      runRequest(request);
    },
    [runRequest],
  );

  const startExport = useCallback(
    (world: Pick<WorldSummary, 'id' | 'name'>): void => {
      start({
        operation: 'export',
        worldId: world.id,
        worldName: world.name,
      });
    },
    [start],
  );

  const startImport = useCallback((): void => {
    start({ operation: 'import' });
  }, [start]);

  const cancel = useCallback((): void => {
    if (
      state.status !== 'running' ||
      !state.cancelable ||
      cancelInFlightRef.current
    ) {
      return;
    }

    cancelInFlightRef.current = true;
    dispatch({ type: 'cancelRequested' });
    void api.cancel().then(
      (result) => {
        if (!mountedRef.current) {
          return;
        }

        if (!result.ok) {
          cancelInFlightRef.current = false;
          dispatch({ type: 'cancelRejected', error: true });
          return;
        }

        if (!result.data.cancelled) {
          cancelInFlightRef.current = false;
          dispatch({ type: 'cancelRejected', error: false });
        }

        // Si `cancelled` es true, se espera al resultado de la operación.
      },
      () => {
        if (!mountedRef.current) {
          return;
        }

        cancelInFlightRef.current = false;
        dispatch({ type: 'cancelRejected', error: true });
      },
    );
  }, [api, state]);

  const retry = useCallback((): void => {
    if (state.status !== 'failed' || state.retrying) {
      return;
    }

    const request = lastRequestRef.current;

    if (request === null || pendingRef.current !== null) {
      return;
    }

    retryingRef.current = true;
    pendingRef.current = request;
    sawProgressRef.current = false;
    operationIdRef.current = null;
    cancelInFlightRef.current = false;
    dispatch({ type: 'retryStarted' });
    runRequest(request);
  }, [runRequest, state]);

  const close = useCallback((): void => {
    if (
      !isTerminal(state) ||
      state.status === 'closed' ||
      (state.status === 'failed' && state.retrying)
    ) {
      return;
    }

    pendingRef.current = null;
    lastRequestRef.current = null;
    sawProgressRef.current = false;
    retryingRef.current = false;
    operationIdRef.current = null;
    cancelInFlightRef.current = false;
    dispatch({ type: 'close' });
  }, [state]);

  useEffect(() => {
    return api.onEvent((event: TransferProgressEvent) => {
      if (pendingRef.current === null) {
        return;
      }

      if (event.operation !== pendingRef.current.operation) {
        return;
      }

      if (
        operationIdRef.current !== null &&
        operationIdRef.current !== event.operationId
      ) {
        return;
      }

      operationIdRef.current = event.operationId;
      sawProgressRef.current = true;
      dispatch({
        type: 'event',
        event,
        worldName:
          pendingRef.current.operation === 'export'
            ? pendingRef.current.worldName
            : null,
      });
    });
  }, [api]);

  return {
    state,
    startExport,
    startImport,
    cancel,
    retry,
    close,
  };
}
