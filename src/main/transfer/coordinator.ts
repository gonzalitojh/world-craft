/**
 * Contrato del coordinador de transferencia.
 *
 * Es un módulo puro: los handlers IPC y las pruebas pueden depender de esta
 * interfaz sin cargar Electron. La implementación real vive en
 * `composition.ts`; la de modo seguro, en `unavailable-coordinator.ts`.
 */
import type {
  TransferCancelResult,
  TransferExportResult,
  TransferImportResult,
  TransferProgressEvent,
  TransferRunResult,
} from '../../shared/contracts/transfer';

/** Operaciones del coordinador. */
export interface TransferCoordinator {
  exportWorld(
    worldId: string,
  ): Promise<TransferRunResult<TransferExportResult>>;
  importWorld(): Promise<TransferRunResult<TransferImportResult>>;
  cancel(): TransferCancelResult;
  isBusy(): boolean;
  subscribe(listener: (event: TransferProgressEvent) => void): () => void;
  dispose(): void;
}
