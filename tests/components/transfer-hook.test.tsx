import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import { useWorldTransfer } from '@/renderer/transfer/use-world-transfer';
import type {
  TransferExportResult,
  TransferImportResult,
  TransferProgressEvent,
  TransferRunResult,
} from '@/shared/contracts/transfer';
import type { IpcResult } from '@/shared/contracts/result';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const WORLD_NAME = 'Mundo de prueba';
const OPERATION_ID = '018f1000-0000-7000-8000-000000000010';

const counts = {
  entities: 1,
  entityTypes: 1,
  relationTypes: 1,
  tags: 1,
  relations: 1,
  versions: 1,
  assets: 1,
};

const exportResult: TransferExportResult = {
  worldId: WORLD_ID,
  worldName: WORLD_NAME,
  fileName: 'mundo.zip',
  size: 10,
  counts,
  warnings: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

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

function installTransferApi() {
  let listener: ((next: TransferProgressEvent) => void) | null = null;
  const exportWorld =
    vi.fn<
      (
        worldId: string,
      ) => Promise<IpcResult<TransferRunResult<TransferExportResult>>>
    >();
  const importWorld =
    vi.fn<() => Promise<IpcResult<TransferRunResult<TransferImportResult>>>>();
  const cancel = vi.fn(async () => ({
    ok: true as const,
    data: { cancelled: true },
  }));

  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: {
      transfer: {
        exportWorld,
        importWorld,
        cancel,
        onEvent: vi.fn((next: (event: TransferProgressEvent) => void) => {
          listener = next;
          return () => {
            listener = null;
          };
        }),
      },
    },
  });

  return {
    exportWorld,
    importWorld,
    cancel,
    emit: (next: TransferProgressEvent) => {
      listener?.(next);
    },
  };
}

function renderTransferHook() {
  const onNotify = vi.fn();
  const onImported = vi.fn();
  const hook = renderHook(() => useWorldTransfer({ onNotify, onImported }), {
    wrapper: ({ children }: { readonly children: ReactNode }) => (
      <I18nProvider locale="es">{children}</I18nProvider>
    ),
  });

  return { ...hook, onNotify, onImported };
}

describe('hook de transferencia', () => {
  it('no abre el diálogo ni avisa si se cancela el selector nativo', async () => {
    const api = installTransferApi();
    api.importWorld.mockResolvedValue({
      ok: true,
      data: { status: 'cancelled' },
    });
    const { result, onNotify } = renderTransferHook();

    act(() => {
      result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('closed');
    });
    expect(onNotify).not.toHaveBeenCalled();
  });

  it('abre con el primer evento, cancela y muestra el aviso al cerrar', async () => {
    const api = installTransferApi();
    const pending =
      deferred<IpcResult<TransferRunResult<TransferExportResult>>>();
    api.exportWorld.mockReturnValue(pending.promise);
    const { result, onNotify } = renderTransferHook();

    act(() => {
      result.current.startExport({ id: WORLD_ID, name: WORLD_NAME });
    });
    expect(result.current.state.status).toBe('closed');

    act(() => {
      api.emit(event());
    });
    expect(result.current.state).toMatchObject({
      status: 'running',
      operationId: OPERATION_ID,
      worldName: WORLD_NAME,
      cancelable: true,
    });

    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.status).toBe('cancelling');

    await act(async () => {
      pending.resolve({ ok: true, data: { status: 'cancelled' } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('closed');
    });
    expect(onNotify).toHaveBeenCalledWith(
      'info',
      messages.transfer.toasts.exportCancelled(WORLD_NAME),
    );
  });

  it('si el coordinador rechaza la cancelación, bloquea el botón sin error', async () => {
    const api = installTransferApi();
    const pending =
      deferred<IpcResult<TransferRunResult<TransferExportResult>>>();
    api.exportWorld.mockReturnValue(pending.promise);
    api.cancel.mockResolvedValue({
      ok: true,
      data: { cancelled: false },
    });
    const { result } = renderTransferHook();

    act(() => {
      result.current.startExport({ id: WORLD_ID, name: WORLD_NAME });
      api.emit(event());
    });
    await act(async () => {
      result.current.cancel();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        status: 'running',
        cancelable: false,
        cancelError: false,
      });
    });

    await act(async () => {
      pending.resolve({
        ok: true,
        data: { status: 'completed', data: exportResult },
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe('exported');
    });
  });

  it('permite reintentar la cancelación si falla el transporte', async () => {
    const api = installTransferApi();
    const pending =
      deferred<IpcResult<TransferRunResult<TransferExportResult>>>();
    api.exportWorld.mockReturnValue(pending.promise);
    api.cancel.mockResolvedValueOnce({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
    const { result } = renderTransferHook();

    act(() => {
      result.current.startExport({ id: WORLD_ID, name: WORLD_NAME });
      api.emit(event());
    });
    await act(async () => {
      result.current.cancel();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        status: 'running',
        cancelable: true,
        cancelError: true,
      });
    });

    await act(async () => {
      result.current.cancel();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('cancelling');
    });
    expect(api.cancel).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending.resolve({ ok: true, data: { status: 'cancelled' } });
      await Promise.resolve();
    });
  });

  it('mantiene el éxito si la operación termina después de aceptar cancelar', async () => {
    const api = installTransferApi();
    const pending =
      deferred<IpcResult<TransferRunResult<TransferExportResult>>>();
    api.exportWorld.mockReturnValue(pending.promise);
    const { result, onNotify } = renderTransferHook();

    act(() => {
      result.current.startExport({ id: WORLD_ID, name: WORLD_NAME });
      api.emit(event());
    });
    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      pending.resolve({
        ok: true,
        data: { status: 'completed', data: exportResult },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'exported',
        result: exportResult,
      });
    });
    expect(onNotify).not.toHaveBeenCalled();
  });

  it('reintenta el último fallo y adopta el nuevo operationId', async () => {
    const api = installTransferApi();
    const first =
      deferred<IpcResult<TransferRunResult<TransferExportResult>>>();
    const second =
      deferred<IpcResult<TransferRunResult<TransferExportResult>>>();
    api.exportWorld
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderTransferHook();

    act(() => {
      result.current.startExport({ id: WORLD_ID, name: WORLD_NAME });
      api.emit(event());
    });
    await act(async () => {
      first.resolve({
        ok: true,
        data: { status: 'failed', code: 'TRANSFER_SAVE_FAILED' },
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        status: 'failed',
        code: 'TRANSFER_SAVE_FAILED',
      });
    });

    const retryOperationId = '018f1000-0000-7000-8000-000000000011';

    act(() => {
      result.current.retry();
    });
    expect(api.exportWorld).toHaveBeenCalledTimes(2);
    expect(result.current.state).toMatchObject({
      status: 'failed',
      retrying: true,
    });

    act(() => {
      api.emit(event({ operationId: retryOperationId, phase: 'finalizing' }));
    });
    expect(result.current.state).toMatchObject({
      status: 'running',
      operationId: retryOperationId,
    });

    await act(async () => {
      second.resolve({
        ok: true,
        data: { status: 'completed', data: exportResult },
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe('exported');
    });
  });

  it('traduce los fallos de transporte a TRANSPORT o UNKNOWN', async () => {
    const api = installTransferApi();
    api.exportWorld
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'INTERNAL_ERROR' },
      });
    const { result } = renderTransferHook();

    act(() => {
      result.current.startExport({ id: WORLD_ID, name: WORLD_NAME });
    });
    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        status: 'failed',
        code: 'TRANSPORT',
      });
    });

    act(() => {
      result.current.close();
      result.current.startExport({ id: WORLD_ID, name: WORLD_NAME });
    });
    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        status: 'failed',
        code: 'UNKNOWN',
      });
    });
  });

  it('propaga el formato no compatible sin convertirlo en fallo de manifiesto', async () => {
    const api = installTransferApi();
    api.importWorld.mockResolvedValue({
      ok: true,
      data: { status: 'failed', code: 'TRANSFER_FORMAT_UNSUPPORTED' },
    });
    const { result } = renderTransferHook();

    act(() => {
      result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        status: 'failed',
        operation: 'import',
        code: 'TRANSFER_FORMAT_UNSUPPORTED',
      });
    });
  });

  it('notifica la importación completada y llama a onImported', async () => {
    const api = installTransferApi();
    api.importWorld.mockResolvedValue({
      ok: true,
      data: {
        status: 'completed',
        data: {
          worldId: WORLD_ID,
          worldName: WORLD_NAME,
          slug: 'mundo-2',
          slugAdjusted: true,
          counts,
          warnings: [],
        },
      },
    });
    const { result, onImported } = renderTransferHook();

    act(() => {
      result.current.startImport();
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('imported');
    });
    expect(onImported).toHaveBeenCalledWith(WORLD_ID);
  });

  it('ignora eventos sin operación pendiente y de otra operación', async () => {
    const api = installTransferApi();
    const { result } = renderTransferHook();

    act(() => {
      api.emit(event());
    });
    expect(result.current.state.status).toBe('closed');

    const pending =
      deferred<IpcResult<TransferRunResult<TransferExportResult>>>();
    api.exportWorld.mockReturnValue(pending.promise);
    act(() => {
      result.current.startExport({ id: WORLD_ID, name: WORLD_NAME });
      api.emit(event({ operation: 'import' }));
    });
    expect(result.current.state.status).toBe('closed');

    await act(async () => {
      pending.resolve({ ok: true, data: { status: 'cancelled' } });
      await Promise.resolve();
    });
  });
});
