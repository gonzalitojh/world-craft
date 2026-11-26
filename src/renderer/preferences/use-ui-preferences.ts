/**
 * Estado de preferencias de interfaz en el renderer.
 *
 * El snapshot inicial llega del bootstrap de `main.tsx` (antes del primer
 * render). Cada cambio se aplica de forma optimista, se envía por la API
 * tipada y, si la respuesta canónica es la más reciente, se adopta. Una
 * respuesta tardía nunca pisa un cambio posterior y un fallo conserva el
 * estado de la sesión sin anuncios ni estado de «guardando».
 *
 * Tema, densidad y tamaño de texto se aplican juntos en el mismo evento para
 * que el primer clic repinte la interfaz sin esperar al IPC (C2 de #79).
 *
 * No lee ni escribe `localStorage`: la única fuente de verdad es la API del
 * preload y el servicio de `app_settings`.
 */
import { useCallback, useRef, useState } from 'react';

import {
  applyUiPreferencesPatch,
  createDefaultUiPreferences,
  isUiPreferences,
  type UiPreferences,
  type UiPreferencesPatch,
} from '../../shared/contracts/preferences';
import type { IpcResult } from '../../shared/contracts/result';
import { applyAppearance } from '../theme';

/** API del hook; suficiente para `App` y para Ajustes (#79). */
export interface UseUiPreferencesResult {
  readonly preferences: UiPreferences;
  /** Fusiona un parche y aplica la apariencia en el mismo evento. */
  readonly update: (patch: UiPreferencesPatch) => void;
  /** Alterna Claro/Oscuro usando el estado más reciente. */
  readonly toggleTheme: () => void;
  /** Vuelve a los valores por defecto y los adopta en caliente. */
  readonly reset: () => void;
}

/** Hook de preferencias con actualización optimista y secuencia. */
export function useUiPreferences(
  initialPreferences: UiPreferences,
): UseUiPreferencesResult {
  const [preferences, setPreferences] =
    useState<UiPreferences>(initialPreferences);
  const preferencesRef = useRef(initialPreferences);
  const sequenceRef = useRef(0);

  const adopt = useCallback((next: UiPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    applyAppearance(next);
  }, []);

  const update = useCallback(
    (patch: UiPreferencesPatch) => {
      // Cada operación tiene su secuencia; solo la última puede adoptar la
      // respuesta canónica del proceso principal.
      sequenceRef.current += 1;
      const sequence = sequenceRef.current;
      const next = applyUiPreferencesPatch(preferencesRef.current, patch);

      // La apariencia no espera al IPC: el mismo clic repinta la interfaz.
      adopt(next);

      let request: Promise<IpcResult<UiPreferences>>;

      try {
        request = window.worldCraft.preferences.update(patch);
      } catch {
        // Un transporte roto conserva el estado optimista de la sesión.
        return;
      }

      void request.then(
        (result) => {
          if (sequence !== sequenceRef.current) {
            return;
          }

          if (result.ok && isUiPreferences(result.data)) {
            adopt(result.data);
          }
        },
        () => {
          // Se conserva el estado optimista de la sesión.
        },
      );
    },
    [adopt],
  );

  const toggleTheme = useCallback(() => {
    update({
      theme: preferencesRef.current.theme === 'light' ? 'dark' : 'light',
    });
  }, [update]);

  const reset = useCallback(() => {
    sequenceRef.current += 1;
    const sequence = sequenceRef.current;

    adopt(createDefaultUiPreferences());

    let request: Promise<IpcResult<UiPreferences>>;

    try {
      request = window.worldCraft.preferences.reset();
    } catch {
      return;
    }

    void request.then(
      (result) => {
        if (sequence !== sequenceRef.current) {
          return;
        }

        if (result.ok && isUiPreferences(result.data)) {
          adopt(result.data);
        }
      },
      () => {
        // Se conserva el estado optimista de la sesión.
      },
    );
  }, [adopt]);

  return { preferences, update, toggleTheme, reset };
}
