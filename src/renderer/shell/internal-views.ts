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
 * Vista interna del laboratorio de mapas (#80).
 *
 * Valida MapLibre GL 6, Terra Draw y el worker en el build real antes de abrir
 * el editor de mapas de M2. Igual que Muestras, solo se llega por hash: no
 * aparece en el rail, la paleta ni `lastView`, y el manual no la presenta como
 * funcionalidad disponible.
 */
export const INTERNAL_MAPS_SPIKE_HASH = '#/internal/maps-spike';

const INTERNAL_VIEWS: Readonly<Record<string, AppView>> = {
  [INTERNAL_SAMPLES_HASH]: 'samples',
  [INTERNAL_MAPS_SPIKE_HASH]: 'maps-spike',
};

/**
 * Resuelve una vista interna a partir del hash de la ventana.
 *
 * El hash se compara sin distinguir mayúsculas y sin espacios sobrantes para
 * tolerar enlaces escritos a mano. Cualquier otro hash devuelve `null`: el
 * consumidor decide la vista de respaldo (Inicio), nunca una vista interna.
 */
export function resolveInternalView(hash: string): AppView | null {
  const normalized = hash.trim().toLowerCase();

  return INTERNAL_VIEWS[normalized] ?? null;
}
