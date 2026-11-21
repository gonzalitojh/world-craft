import { useEffect, useState } from 'react';

import { ENTITY_LIST_LIMIT_DEFAULT } from '../../shared/contracts/entities';
import {
  ENTITY_COUNT_INITIAL,
  entityCountFromResult,
  type EntityCountSnapshot,
} from '../lib/entity-count';

interface CountState {
  readonly worldId: string | null;
  readonly snapshot: EntityCountSnapshot;
}

/**
 * Recuento de fichas de un mundo para la navegación modular.
 *
 * Se lee una sola vez por montaje con el canal existente `entities.list`. Al
 * volver de Fichas, `WorldPage` se remonta y el recuento se refresca. Si el
 * puente no existe, la promesa falla o la componente se desmonta, el resultado
 * se descarta: la página sigue usable y el recuento simplemente no se pinta.
 *
 * El estado se etiqueta con el mundo al que pertenece, de modo que al cambiar
 * de mundo se vuelve a «cargando» sin escribir en el efecto.
 */
export function useEntityCount(worldId: string | null): EntityCountSnapshot {
  const [state, setState] = useState<CountState>({
    worldId: null,
    snapshot: ENTITY_COUNT_INITIAL,
  });

  useEffect(() => {
    if (worldId === null) {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const result = await window.worldCraft.entities.list({
          worldId,
          filter: { limit: ENTITY_LIST_LIMIT_DEFAULT },
        });

        if (!cancelled) {
          setState({
            worldId,
            snapshot: entityCountFromResult(result, ENTITY_LIST_LIMIT_DEFAULT),
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            worldId,
            snapshot: entityCountFromResult(
              { ok: false, error: { code: 'INTERNAL_ERROR' } },
              ENTITY_LIST_LIMIT_DEFAULT,
            ),
          });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [worldId]);

  return state.worldId === worldId ? state.snapshot : ENTITY_COUNT_INITIAL;
}
