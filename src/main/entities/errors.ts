/**
 * Error de entrada del dominio de fichas.
 *
 * Los handlers lo traducen a `INVALID_INPUT`; el mensaje nunca sale al
 * renderer. Las reglas concretas (campo obligatorio, referencia inexistente,
 * asset de otro mundo) se comprueban en el servicio y en la validación Zod.
 */
export class EntityInputError extends Error {
  readonly code = 'INVALID_INPUT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'EntityInputError';
  }
}
