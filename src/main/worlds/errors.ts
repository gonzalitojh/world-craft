/**
 * Errores de dominio de los mundos.
 *
 * El proceso principal los traduce a `INVALID_INPUT` en el handler IPC. No
 * heredan de ningún error de infraestructura: la capa de datos y la interfaz
 * permanecen independientes.
 */

/** Entrada de mundo rechazada por una regla de dominio. */
export class WorldInputError extends Error {
  constructor(message = 'Datos del mundo no válidos.') {
    super(message);
    this.name = 'WorldInputError';
  }
}
