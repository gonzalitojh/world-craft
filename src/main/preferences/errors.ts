/**
 * Errores de dominio de las preferencias.
 *
 * `PreferencesInputError` es el único error de entrada: el handler lo traduce a
 * `INVALID_INPUT`. El resto de excepciones (base cerrada, modo seguro, fallo de
 * SQLite) se convierten en `INTERNAL_ERROR` sin filtrar mensajes ni valores.
 */
export class PreferencesInputError extends Error {
  readonly code = 'INVALID_INPUT' as const;

  constructor() {
    super('Preferencias rechazadas por una regla de dominio.');
    this.name = 'PreferencesInputError';
  }
}
