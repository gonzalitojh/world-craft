/**
 * Servicio de dominio de las preferencias de interfaz.
 *
 * Orquesta la lectura tolerante, la fusión de parches, la escritura atómica y
 * el aviso de cambio de tema. No conoce Electron ni IPC: recibe la base y un
 * callback opcional para aplicar el tema a la ventana viva.
 *
 * Semántica clave:
 *
 * - Leer no crea filas ni repara valores.
 * - Escribir solo toca las claves cuyo JSON cambia y agrupa todo en una
 *   transacción.
 * - `recentLocation: null` borra la fila, nunca guarda `null`.
 * - `reset` borra solo `ui.*` y devuelve los valores por defecto.
 */
import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import {
  applyUiPreferencesPatch,
  createDefaultUiPreferences,
  type ThemePreference,
  type UiPreferences,
  type UiPreferencesPatch,
} from '../../shared/contracts/preferences';
import { PreferencesInputError } from './errors';
import { UI_PREFERENCE_KEYS, type UiPreferenceKey } from './keys';
import {
  createPreferencesRepository,
  type PreferencesRepository,
} from './repository';
import { readStoredPreferences, uiPreferencesPatchSchema } from './validation';

/** Operaciones expuestas por el servicio. */
export interface PreferencesService {
  get(): UiPreferences;
  update(patch: UiPreferencesPatch): UiPreferences;
  reset(): UiPreferences;
}

/** Dependencias del servicio; todas se inyectan para las pruebas. */
export interface PreferencesServiceOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  /** Repositorio alternativo (pruebas de atomicidad). */
  readonly repository?: PreferencesRepository;
  /** Reloj inyectable; por defecto `Date.now`. */
  readonly now?: () => number;
  /** Se invoca tras confirmar la transacción, solo si el tema cambió. */
  readonly onThemeChanged?: (theme: ThemePreference) => void;
}

interface StoredEntry {
  readonly key: UiPreferenceKey;
  readonly value: string;
}

/**
 * Serializa el snapshot canónico.
 *
 * `recentLocation` ausente significa «borrar la fila»; el resto de claves
 * siempre se serializan para poder comparar con lo almacenado.
 */
function toStoredEntries(preferences: UiPreferences): StoredEntry[] {
  const entries: StoredEntry[] = [
    {
      key: UI_PREFERENCE_KEYS.theme,
      value: JSON.stringify(preferences.theme),
    },
    {
      key: UI_PREFERENCE_KEYS.density,
      value: JSON.stringify(preferences.density),
    },
    {
      key: UI_PREFERENCE_KEYS.fontScale,
      value: JSON.stringify(preferences.fontScale),
    },
    {
      key: UI_PREFERENCE_KEYS.railCollapsed,
      value: JSON.stringify(preferences.railCollapsed),
    },
    {
      key: UI_PREFERENCE_KEYS.entityView,
      value: JSON.stringify(preferences.entityView),
    },
    {
      key: UI_PREFERENCE_KEYS.lastView,
      value: JSON.stringify(preferences.lastView),
    },
  ];

  if (preferences.recentLocation !== null) {
    entries.push({
      key: UI_PREFERENCE_KEYS.recentLocation,
      value: JSON.stringify(preferences.recentLocation),
    });
  }

  return entries;
}

/** Crea el servicio sobre la base compartida del proceso principal. */
export function createPreferencesService(
  options: PreferencesServiceOptions,
): PreferencesService {
  const repository =
    options.repository ??
    createPreferencesRepository(options.database, options.sqlite);
  const now = options.now ?? Date.now;

  const readSnapshot = (): UiPreferences =>
    readStoredPreferences(repository.readAll());

  const notifyTheme = (theme: ThemePreference): void => {
    if (options.onThemeChanged === undefined) {
      return;
    }

    try {
      options.onThemeChanged(theme);
    } catch {
      // El commit ya está hecho: un fallo al repintar la ventana no debe
      // convertir una escritura válida en error de IPC.
      console.error('No se pudo aplicar el tema a la ventana.');
    }
  };

  return {
    get() {
      return readSnapshot();
    },

    update(patch) {
      // Defensa adicional: el router ya validó, pero el servicio no confía en
      // un llamador interno ni en una evolución futura del canal.
      const parsed = uiPreferencesPatchSchema.safeParse(patch);

      if (!parsed.success) {
        throw new PreferencesInputError();
      }

      const stored = repository.readAll();
      const current = readStoredPreferences(stored);
      const next = applyUiPreferencesPatch(
        current,
        parsed.data as UiPreferencesPatch,
      );

      const writes: StoredEntry[] = [];
      const writeIfChanged = (
        key: UiPreferenceKey,
        value: string,
        semanticChange: boolean,
        explicitlyPatched: boolean,
      ): void => {
        // Se escribe si el valor canónico cambió o si el parche toca la clave
        // y la fila guardada no coincide (por ejemplo, un JSON corrupto que la
        // siguiente escritura explícita repara). Las claves no tocadas no se
        // siembran al azar.
        if (
          semanticChange ||
          (explicitlyPatched && stored.get(key) !== value)
        ) {
          writes.push({ key, value });
        }
      };
      const entries = new Map(
        toStoredEntries(next).map((entry) => [entry.key, entry.value]),
      );

      writeIfChanged(
        UI_PREFERENCE_KEYS.theme,
        entries.get(UI_PREFERENCE_KEYS.theme) ?? '',
        current.theme !== next.theme,
        parsed.data.theme !== undefined,
      );
      writeIfChanged(
        UI_PREFERENCE_KEYS.density,
        entries.get(UI_PREFERENCE_KEYS.density) ?? '',
        current.density !== next.density,
        parsed.data.density !== undefined,
      );
      writeIfChanged(
        UI_PREFERENCE_KEYS.fontScale,
        entries.get(UI_PREFERENCE_KEYS.fontScale) ?? '',
        current.fontScale !== next.fontScale,
        parsed.data.fontScale !== undefined,
      );
      writeIfChanged(
        UI_PREFERENCE_KEYS.railCollapsed,
        entries.get(UI_PREFERENCE_KEYS.railCollapsed) ?? '',
        current.railCollapsed !== next.railCollapsed,
        parsed.data.railCollapsed !== undefined,
      );
      writeIfChanged(
        UI_PREFERENCE_KEYS.entityView,
        entries.get(UI_PREFERENCE_KEYS.entityView) ?? '',
        JSON.stringify(current.entityView) !== JSON.stringify(next.entityView),
        parsed.data.entityView !== undefined,
      );
      writeIfChanged(
        UI_PREFERENCE_KEYS.lastView,
        entries.get(UI_PREFERENCE_KEYS.lastView) ?? '',
        current.lastView !== next.lastView,
        parsed.data.lastView !== undefined,
      );

      if (next.recentLocation !== null) {
        writeIfChanged(
          UI_PREFERENCE_KEYS.recentLocation,
          entries.get(UI_PREFERENCE_KEYS.recentLocation) ?? '',
          JSON.stringify(current.recentLocation) !==
            JSON.stringify(next.recentLocation),
          parsed.data.recentLocation !== undefined,
        );
      }

      const deletes: UiPreferenceKey[] = [];

      if (
        next.recentLocation === null &&
        parsed.data.recentLocation !== undefined &&
        stored.has(UI_PREFERENCE_KEYS.recentLocation)
      ) {
        deletes.push(UI_PREFERENCE_KEYS.recentLocation);
      }

      if (writes.length > 0 || deletes.length > 0) {
        const at = now();

        try {
          repository.transaction(() => {
            for (const entry of writes) {
              repository.upsert(entry.key, entry.value, at);
            }

            repository.deleteKeys(deletes);
          });
        } catch (error) {
          // C2: el tema validado se aplica al cromo aunque la escritura falle;
          // el renderer conserva el cambio durante la sesión y no hay anuncio.
          if (current.theme !== next.theme) {
            notifyTheme(next.theme);
          }

          throw error;
        }
      }

      if (current.theme !== next.theme) {
        notifyTheme(next.theme);
      }

      return next;
    },

    reset() {
      const current = readSnapshot();

      try {
        repository.transaction(() => {
          repository.deleteUiKeys();
        });
      } catch (error) {
        if (current.theme !== 'light') {
          notifyTheme('light');
        }

        throw error;
      }

      if (current.theme !== 'light') {
        notifyTheme('light');
      }

      return createDefaultUiPreferences();
    },
  };
}

/** Opciones del servicio de sustitución en modo seguro. */
export interface UnavailablePreferencesOptions {
  /**
   * Aplica el tema al cromo aunque no haya base. El renderer ya lo cambia de
   * forma optimista; sin este callback `nativeTheme` y el fondo quedarían
   * desincronizados en modo seguro.
   */
  readonly onThemeChanged?: (theme: ThemePreference) => void;
}

/**
 * Servicio de sustitución en modo seguro.
 *
 * Leer devuelve los valores por defecto y no toca la base; escribir falla para
 * no simular una persistencia que no existe. Un parche válido con cambio de
 * tema (o un reset desde un tema no Claro) aplica el tema al cromo antes de
 * fallar.
 */
export function createUnavailablePreferencesService(
  options: UnavailablePreferencesOptions = {},
): PreferencesService {
  // Sin base no hay filas, pero el cromo de la ventana sí puede cambiar durante
  // la sesión. Este estado de sesión evita que un reset posterior se quede en
  // Claro mientras `nativeTheme` sigue Oscuro.
  let lastAppliedTheme: ThemePreference = 'light';

  const notifyTheme = (theme: ThemePreference): void => {
    try {
      options.onThemeChanged?.(theme);
    } catch {
      console.error('No se pudo aplicar el tema a la ventana.');
    }
  };

  const unavailable = (): never => {
    throw new Error('Las preferencias no están disponibles en modo seguro.');
  };

  return {
    get: () => createDefaultUiPreferences(),
    update: (patch) => {
      // Defensa en profundidad: el router ya valida, pero un parche inválido no
      // debe llegar a calcular un tema.
      const parsed = uiPreferencesPatchSchema.safeParse(patch);

      if (!parsed.success) {
        throw new PreferencesInputError();
      }

      const current: UiPreferences = {
        ...createDefaultUiPreferences(),
        theme: lastAppliedTheme,
      };
      const next = applyUiPreferencesPatch(
        current,
        parsed.data as UiPreferencesPatch,
      );

      if (current.theme !== next.theme) {
        notifyTheme(next.theme);
        lastAppliedTheme = next.theme;
      }

      return unavailable();
    },
    reset: () => {
      if (lastAppliedTheme !== 'light') {
        notifyTheme('light');
        lastAppliedTheme = 'light';
      }

      return unavailable();
    },
  };
}
