/**
 * Handlers IPC de exportación e importación.
 *
 * A diferencia del resto de canales, un fallo de dominio no se convierte en
 * `INTERNAL_ERROR`: el coordinador devuelve un `TransferRunResult` con su código
 * estable y el router lo envuelve como `ok: true`. Solo los errores de
 * validación del payload o de transporte quedan como `IpcResult` negativo.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type {
  TransferCancelResult,
  TransferRunResult,
} from '../../../shared/contracts/transfer';
import type { TransferCoordinator } from '../../transfer/coordinator';
import { toTransferErrorCode } from '../../transfer/errors';
import type { IpcHandlers } from '../registry';
import { defineIpcHandler } from '../registry';
import {
  transferCancelPayloadSchema,
  transferExportPayloadSchema,
  transferImportPayloadSchema,
  type TransferCancelPayload,
  type TransferExportPayload,
  type TransferImportPayload,
} from '../schemas/transfer';

/** Canales que atiende este módulo. */
export type TransferIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.transferExportWorld
  | typeof IPC_CHANNELS.transferImportWorld
  | typeof IPC_CHANNELS.transferCancel
>;

/** Construye los handlers a partir del coordinador. */
export function createTransferIpcHandlers(
  coordinator: TransferCoordinator,
): TransferIpcHandlers {
  return {
    [IPC_CHANNELS.transferExportWorld]: defineIpcHandler<TransferExportPayload>(
      {
        schema: transferExportPayloadSchema,
        handle: (payload) =>
          runTransferResult(() => coordinator.exportWorld(payload.worldId)),
      },
    ),

    [IPC_CHANNELS.transferImportWorld]: defineIpcHandler<TransferImportPayload>(
      {
        schema: transferImportPayloadSchema,
        handle: () => runTransferResult(() => coordinator.importWorld()),
      },
    ),

    [IPC_CHANNELS.transferCancel]: defineIpcHandler<TransferCancelPayload>({
      schema: transferCancelPayloadSchema,
      handle: () => runCancel(coordinator),
    }),
  };
}

async function runTransferResult<T>(
  operation: () => Promise<TransferRunResult<T>>,
): Promise<TransferRunResult<T>> {
  try {
    return await operation();
  } catch (error) {
    const code = toTransferErrorCode(error, 'TRANSFER_INTERNAL');

    return code === 'TRANSFER_CANCELLED'
      ? { status: 'cancelled' }
      : { status: 'failed', code };
  }
}

function runCancel(coordinator: TransferCoordinator): TransferCancelResult {
  try {
    return coordinator.cancel();
  } catch {
    return { cancelled: false };
  }
}
