/**
 * Memoria de sesión del último destino abierto.
 *
 * No se persiste nada: al recargar la ventana el bloque «Continuar» desaparece.
 * La persistencia de preferencias llega con #132. La resolución es pura para
 * poder probarla sin React y para descartar destinos cuyo mundo ya no está en
 * la biblioteca.
 */
import type { WorldSummary } from '../../shared/contracts/worlds';

/** Destino recordado mientras la aplicación está abierta. */
export type RecentLocation =
  | { readonly kind: 'world'; readonly worldId: string }
  | {
      readonly kind: 'entity';
      readonly worldId: string;
      readonly entityId: string;
      /** Se completa cuando la ficha termina de cargar; `null` si aún no se sabe. */
      readonly entityName: string | null;
    };

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
