import { resolveInternalView } from './internal-views';
import type { AppView } from './views';

/**
 * Ruta de la página de Ajustes.
 *
 * El hash es estable para que el enlace pueda restaurarse al recargar la
 * ventana y para que la navegación no dependa de estado en memoria.
 */
export const SETTINGS_HASH = '#/settings';

/**
 * Resuelve una vista de producto a partir del hash de la ventana.
 *
 * Delega primero en las vistas internas (Muestras) para conservar su acceso
 * reservado. El resto de hashes desconocidos devuelve `null`; el consumidor
 * decide la vista de respaldo (Inicio), nunca Muestras.
 */
export function resolveAppView(hash: string): AppView | null {
  const internal = resolveInternalView(hash);

  if (internal !== null) {
    return internal;
  }

  return hash.trim().toLowerCase() === SETTINGS_HASH ? 'settings' : null;
}
