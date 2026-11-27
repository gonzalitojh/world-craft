/**
 * Imágenes de un mundo para el selector de portada.
 *
 * La lista se carga **al abrir** el selector, no al montar la página ni el
 * formulario. Cada carga lleva una revisión: una respuesta antigua (cierre,
 * cambio de mundo o reintento) se descarta. La importación reutiliza
 * `assets:import`; las imágenes ya importadas se guardan en el mundo aunque el
 * formulario se cancele, porque el canal es inmediato.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AssetSummary } from '../../shared/contracts/assets';

export type WorldAssetsState = 'loading' | 'ready' | 'error';

interface WorldAssetsSnapshot {
  readonly worldId: string | null;
  readonly revision: number;
  readonly state: WorldAssetsState;
  readonly assets: readonly AssetSummary[];
}

const EMPTY: WorldAssetsSnapshot = {
  worldId: null,
  revision: -1,
  state: 'ready',
  assets: [],
};

export interface UseWorldAssetsResult {
  readonly assets: readonly AssetSummary[];
  readonly state: WorldAssetsState;
  readonly importing: boolean;
  readonly importError: string | null;
  readonly retry: () => void;
  readonly importAssets: (errorMessage: string) => Promise<readonly string[]>;
}

export function useWorldAssets(
  worldId: string | null,
  enabled: boolean,
): UseWorldAssetsResult {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldAssetsSnapshot>(EMPTY);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importRequest = useRef(0);

  useEffect(() => {
    if (!enabled || worldId === null) {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const result = await window.worldCraft.assets.list(worldId);

        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setSnapshot({
            worldId,
            revision,
            state: 'error',
            assets: [],
          });
          return;
        }

        setSnapshot({
          worldId,
          revision,
          state: 'ready',
          assets: result.data,
        });
      } catch {
        if (!cancelled) {
          setSnapshot({
            worldId,
            revision,
            state: 'error',
            assets: [],
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
    setImportError(null);
    setRevision((current) => current + 1);
  }, []);

  const importAssets = useCallback(
    async (errorMessage: string): Promise<readonly string[]> => {
      if (worldId === null || importing) {
        return [];
      }

      importRequest.current += 1;
      const request = importRequest.current;
      setImporting(true);
      setImportError(null);

      try {
        const result = await window.worldCraft.assets.import({ worldId });

        if (request !== importRequest.current) {
          return [];
        }

        if (!result.ok) {
          setImportError(errorMessage);
          return [];
        }

        // Una importación cancelada no cambia la lista ni avisa.
        if (result.data.imported.length === 0) {
          return [];
        }

        setSnapshot((current) => {
          const known = new Set(current.assets.map((asset) => asset.id));
          const fresh = result.data.imported.filter(
            (asset) => !known.has(asset.id),
          );

          return {
            worldId,
            revision,
            state: 'ready',
            assets: [...fresh, ...current.assets],
          };
        });

        return result.data.imported.map((asset) => asset.id);
      } catch {
        if (request === importRequest.current) {
          setImportError(errorMessage);
        }

        return [];
      } finally {
        if (request === importRequest.current) {
          setImporting(false);
        }
      }
    },
    [worldId, importing, revision],
  );

  if (!enabled || worldId === null) {
    return {
      assets: [],
      state: 'ready',
      importing: false,
      importError: null,
      retry,
      importAssets,
    };
  }

  const current =
    snapshot.worldId === worldId && snapshot.revision === revision
      ? snapshot
      : {
          state: 'loading' as const,
          assets: [],
        };

  return {
    assets: current.assets,
    state: current.state,
    importing,
    importError,
    retry,
    importAssets,
  };
}
