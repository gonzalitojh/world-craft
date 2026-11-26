/**
 * Candidatas a mención para la descripción de un mundo.
 *
 * Carga como máximo `ENTITY_LIST_LIMIT_DEFAULT` fichas vivas del mundo con el
 * canal existente `entities.list`. `complete` indica si la lista cabe entera:
 * con 200 o más fichas la interfaz no puede validar todos los enlaces y el
 * proceso principal sigue siendo la autoridad.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  ENTITY_LIST_LIMIT_DEFAULT,
  type EntitySummary,
} from '../../shared/contracts/entities';

export type EntityCandidatesState = 'loading' | 'ready' | 'error';

interface CandidatesSnapshot {
  readonly worldId: string | null;
  readonly revision: number;
  readonly state: EntityCandidatesState;
  readonly candidates: readonly EntitySummary[];
  readonly complete: boolean;
}

const EMPTY: CandidatesSnapshot = {
  worldId: null,
  revision: -1,
  state: 'ready',
  candidates: [],
  complete: true,
};

/** Resultado del hook de candidatas. */
export interface UseEntityCandidatesResult {
  readonly candidates: readonly EntitySummary[];
  readonly state: EntityCandidatesState;
  readonly complete: boolean;
  readonly retry: () => void;
}

export function useEntityCandidates(
  worldId: string | null,
  enabled = true,
): UseEntityCandidatesResult {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<CandidatesSnapshot>(EMPTY);

  useEffect(() => {
    if (!enabled || worldId === null) {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const result = await window.worldCraft.entities.list({
          worldId,
          filter: { limit: ENTITY_LIST_LIMIT_DEFAULT },
        });

        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setSnapshot({
            worldId,
            revision,
            state: 'error',
            candidates: [],
            complete: false,
          });
          return;
        }

        setSnapshot({
          worldId,
          revision,
          state: 'ready',
          candidates: result.data,
          complete: result.data.length < ENTITY_LIST_LIMIT_DEFAULT,
        });
      } catch {
        if (!cancelled) {
          setSnapshot({
            worldId,
            revision,
            state: 'error',
            candidates: [],
            complete: false,
          });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [worldId, enabled, revision]);

  const retry = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  // Mientras el mundo, la habilitación o el reintento cambian, se muestra
  // «cargando» sin escribir estado desde el efecto.
  if (!enabled || worldId === null) {
    return { candidates: [], state: 'ready', complete: true, retry };
  }

  const current =
    snapshot.worldId === worldId && snapshot.revision === revision
      ? snapshot
      : { state: 'loading' as const, candidates: [], complete: true };

  return {
    candidates: current.candidates,
    state: current.state,
    complete: current.complete,
    retry,
  };
}
