/**
 * Resolución pura del destino «Continuar».
 *
 * El destino se persiste como `recentLocation` en `app_settings`; este módulo
 * solo lo valida contra la biblioteca de mundos y lo convierte en el objetivo
 * que pinta Inicio. Nunca navega por sí mismo ni muta el destino recordado.
 */
import type { RecentLocationPreference } from '../../shared/contracts/preferences';
import type { WorldSummary } from '../../shared/contracts/worlds';

/** Destino recordado; alias del tipo compartido para el renderer. */
export type RecentLocation = RecentLocationPreference;

/** Destino resuelto que la interfaz puede pintar y reabrir. */
export interface ContinueTarget {
  readonly kind: 'world' | 'entity';
  readonly worldId: string;
  readonly worldName: string;
  readonly entityId: string | null;
  readonly entityName: string | null;
}

/**
 * Devuelve `null` si no hay destino o si su mundo ya no existe en la
 * biblioteca. Nunca muta el destino recordado.
 */
export function resolveContinueTarget(
  location: RecentLocation | null,
  worlds: readonly WorldSummary[],
): ContinueTarget | null {
  if (location === null) {
    return null;
  }

  const world = worlds.find((entry) => entry.id === location.worldId);

  if (world === undefined) {
    return null;
  }

  if (location.kind === 'world') {
    return {
      kind: 'world',
      worldId: world.id,
      worldName: world.name,
      entityId: null,
      entityName: null,
    };
  }

  return {
    kind: 'entity',
    worldId: world.id,
    worldName: world.name,
    entityId: location.entityId,
    entityName: location.entityName,
  };
}
