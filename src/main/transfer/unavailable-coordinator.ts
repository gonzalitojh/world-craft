/**
 * Coordinador de sustitución cuando la base no está disponible (modo seguro).
 *
 * No abre diálogos, no arranca el worker y no escribe nada. Cualquier
 * exportación o importación devuelve un fallo de dominio estable que la
 * interfaz puede traducir.
 */
import type { TransferCoordinator } from './coordinator';

/** Crea el coordinador inerte de modo seguro. */
export function createUnavailableTransferCoordinator(): TransferCoordinator {
  return {
    exportWorld: async () => ({
      status: 'failed',
      code: 'TRANSFER_UNAVAILABLE',
    }),
    importWorld: async () => ({
      status: 'failed',
      code: 'TRANSFER_UNAVAILABLE',
    }),
    cancel: () => ({ cancelled: false }),
    isBusy: () => false,
    subscribe: () => () => {},
    dispose: () => {},
  };
}
