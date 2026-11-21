import type { EntitySummary } from '../../shared/contracts/entities';
import type { IpcResult } from '../../shared/contracts/result';

/**
 * Estado del recuento de fichas de un mundo.
 *
 * Es información secundaria: mientras carga o si la lectura falla, la vista de
 * mundo sigue siendo usable y simplemente omite el recuento.
 */
export type EntityCountState = 'loading' | 'ready' | 'error';

export interface EntityCountSnapshot {
  readonly state: EntityCountState;
  readonly count: number | null;
  /** La lista alcanzó el límite pedido, así que el total real puede ser mayor. */
  readonly capped: boolean;
}

/** Valor inicial: el recuento aún no se ha pedido. */
export const ENTITY_COUNT_INITIAL: EntityCountSnapshot = Object.freeze({
  state: 'loading',
  count: null,
  capped: false,
});

/**
 * Traduce el resultado de `entities.list` a un recuento presentable.
 *
 * La lista llega limitada por `entities.list`, así que una respuesta que alcanza
 * el límite se marca como «N o más fichas» para no mentir con un total exacto.
 * No muta la lista recibida.
 */
export function entityCountFromResult(
  result: IpcResult<readonly EntitySummary[]>,
  limit: number,
): EntityCountSnapshot {
  if (!result.ok) {
    return { state: 'error', count: null, capped: false };
  }

  const count = result.data.length;

  return { state: 'ready', count, capped: count >= limit };
}
