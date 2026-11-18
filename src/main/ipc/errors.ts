/**
 * Error de entrada rechazada por una regla de dominio del proceso principal.
 *
 * El router lo traduce a `INVALID_INPUT`; cualquier otra excepción se convierte
 * en `INTERNAL_ERROR` sin filtrar mensaje, stack ni valores recibidos.
 */
export class IpcInputError extends Error {
  readonly code = 'INVALID_INPUT' as const;

  constructor() {
    super('Entrada IPC rechazada por una regla de dominio.');
    this.name = 'IpcInputError';
  }
}
