import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  createDefaultUiPreferences,
  isUiPreferences,
  type UiPreferences,
} from '../shared/contracts/preferences';
import type { WorldCraftApi } from '../shared/contracts/world-craft-api';
import { App } from './App';
import { I18nProvider } from './i18n/provider';
import { DEFAULT_LOCALE, getCatalog } from './messages';
import { applyTheme } from './theme';
import './styles/fonts.css';
import './styles/tokens/palette.css';
import './styles/tokens/semantic.css';
import './styles/tokens/scales.css';
import './styles/base.css';
import './styles/components.css';
import './styles/relations.css';

/** Margen máximo para leer las preferencias antes del primer render. */
const BOOTSTRAP_TIMEOUT_MS = 1500;

const container = document.getElementById('root');

if (container === null) {
  throw new Error('No se encontró el contenedor #root del renderer.');
}

/**
 * Lee el snapshot inicial sin bloquear el arranque indefinidamente.
 *
 * La lectura ocurre una sola vez, antes de montar React; así `StrictMode` no
 * duplica el `get` y una respuesta tardía (después del timeout) se descarta sin
 * cambiar el tema tras el primer pintado. Cualquier fallo, forma inválida o API
 * ausente cae en Claro.
 */
function loadInitialPreferences(): Promise<UiPreferences> {
  // La API puede faltar si el preload no llegó a publicarse; el contrato la
  // declara siempre presente, así que se comprueba desde una vista parcial.
  const api = (window as { readonly worldCraft?: Partial<WorldCraftApi> })
    .worldCraft?.preferences;

  if (api === undefined) {
    return Promise.resolve(createDefaultUiPreferences());
  }

  return new Promise<UiPreferences>((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(createDefaultUiPreferences());
      }
    }, BOOTSTRAP_TIMEOUT_MS);

    const settle = (preferences: UiPreferences): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timer);
      resolve(preferences);
    };

    try {
      void api.get().then(
        (result) => {
          settle(
            result.ok && isUiPreferences(result.data)
              ? result.data
              : createDefaultUiPreferences(),
          );
        },
        () => {
          settle(createDefaultUiPreferences());
        },
      );
    } catch {
      // Un preload roto puede lanzar de forma síncrona; el arranque cae en
      // Claro en vez de rechazar el top-level await.
      settle(createDefaultUiPreferences());
    }
  });
}

// Top-level await: el módulo no completa su evaluación hasta que el tema está
// fijado. Así `did-finish-load` (que espera a los módulos) ocurre después del
// primer pintado con el tema correcto y no hay destello claro.
const initialPreferences = await loadInitialPreferences();

applyTheme(initialPreferences.theme);
document.title = getCatalog(DEFAULT_LOCALE).app.title;

createRoot(container).render(
  <StrictMode>
    <I18nProvider locale={DEFAULT_LOCALE}>
      <App initialPreferences={initialPreferences} />
    </I18nProvider>
  </StrictMode>,
);
