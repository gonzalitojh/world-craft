/**
 * Patrón compartido de UUIDv7.
 *
 * Vive en `shared` para que la validación de enlaces internos y los contratos
 * puros no importen el generador de IDs del proceso principal, que usa Node.
 * Debe coincidir con `UUID_V7_PATTERN` de `src/main/db/ids.ts`; una prueba de
 * integración comprueba que ambos aceptan los mismos valores.
 */
export const UUID_V7_SOURCE =
  '[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export const UUID_V7_PATTERN = new RegExp(`^${UUID_V7_SOURCE}$`);
