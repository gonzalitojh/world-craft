import type { AppView } from './views';

/**
 * Vista interna del banco de muestras.
 *
 * Muestras deja de formar parte de la navegación de producto en #126, pero el
 * banco sigue existiendo como herramienta de desarrollo y como contenido largo
 * para las pruebas E2E. Se accede solo por hash, sin enlace público ni comando
 * en la paleta.
 */
export const INTERNAL_SAMPLES_HASH = '#/internal/samples';

/**
 * Resuelve una vista interna a partir del hash de la ventana.
 *
 * El hash se compara sin distinguir mayúsculas y sin espacios sobrantes para
 * tolerar enlaces escritos a mano. Cualquier otro hash devuelve `null`: el
 * consumidor decide la vista de respaldo (Inicio), nunca Muestras.
 */
export function resolveInternalView(hash: string): AppView | null {
  const normalized = hash.trim().toLowerCase();

  return normalized === INTERNAL_SAMPLES_HASH ? 'samples' : null;
}
