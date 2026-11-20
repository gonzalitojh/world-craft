/**
 * Errores de dominio de las relaciones.
 *
 * El servicio los lanza con un mensaje en español para el registro interno; el
 * handler IPC los traduce a `INVALID_INPUT` sin filtrar el texto al renderer.
 */
export class RelationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RelationInputError';
  }
}

/** Un tipo de relación del sistema no se puede editar ni borrar. */
export class RelationTypeProtectedError extends RelationInputError {
  constructor() {
    super('Los tipos de relación del sistema no se pueden modificar.');
    this.name = 'RelationTypeProtectedError';
  }
}
