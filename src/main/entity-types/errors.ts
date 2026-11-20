/**
 * Errores de dominio de los tipos de entidad.
 *
 * El proceso principal los traduce a `INVALID_INPUT` en el handler IPC. No
 * heredan de ningún error de infraestructura: la capa de datos y la interfaz
 * permanecen independientes.
 */

/** Entrada de tipo de entidad rechazada por una regla de dominio. */
export class EntityTypeInputError extends Error {
  constructor(message = 'Datos del tipo de entidad no válidos.') {
    super(message);
    this.name = 'EntityTypeInputError';
  }
}

/** Intento de modificar o borrar un tipo del sistema. */
export class EntityTypeProtectedError extends EntityTypeInputError {
  constructor() {
    super('Los tipos del sistema no se pueden modificar ni borrar.');
    this.name = 'EntityTypeProtectedError';
  }
}
