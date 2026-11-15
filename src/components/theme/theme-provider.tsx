'use client';

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  isThemePreference,
  readStoredPreference,
  resolveTheme,
  storePreference,
  THEME_ATTRIBUTES,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';
import { THEME_COLORS } from '@/lib/theme-palette';

/*
 * Proveedor de tema Claro/Oscuro/Sistema (issue #8, ADR 0010).
 *
 * El estado vive fuera de React y se lee con `useSyncExternalStore`:
 *
 * 1. El atributo `<html data-theme-preference>`, que el script de arranque
 *    (`createThemeScript`) escribe antes del primer pintado.
 * 2. `matchMedia('(prefers-color-scheme: dark)')`, para la opción «Sistema».
 *
 * Quién escribe el tema:
 *
 * - El script de arranque, antes del primer pintado y en cada cambio del
 *   sistema operativo mientras la preferencia sea «sistema».
 * - Este proveedor, solo cuando el usuario elige (y persiste la preferencia).
 *
 * El proveedor NO vuelca su estado al documento desde un efecto: durante la
 * hidratación el servidor todavía cree que la preferencia es «sistema», y
 * escribirla sobrescribiría lo que el script ya había resuelto (destello de
 * tema claro y pérdida de la preferencia guardada). El DOM manda; React lo lee.
 */

/** Consulta del sistema operativo que decide el tema cuando la preferencia es «sistema». */
const DARK_QUERY = '(prefers-color-scheme: dark)';

export type ThemeContextValue = {
  /** Lo que eligió el usuario: `light`, `dark` o `system`. */
  preference: ThemePreference;
  /** Lo que se está pintando ahora mismo: `light` o `dark`. */
  resolved: ResolvedTheme;
  /** Cambia la preferencia, la aplica al documento y la persiste. */
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Consumidores suscritos a los cambios de preferencia. */
const preferenceListeners = new Set<() => void>();

function notifyPreferenceChange(): void {
  for (const listener of preferenceListeners) {
    listener();
  }
}

function subscribePreference(listener: () => void): () => void {
  preferenceListeners.add(listener);

  return () => {
    preferenceListeners.delete(listener);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  if (typeof document !== 'undefined') {
    const value = document.documentElement.getAttribute(
      THEME_ATTRIBUTES.preference,
    );

    if (isThemePreference(value)) {
      return value;
    }
  }

  return readStoredPreference();
}

function getPreferenceServerSnapshot(): ThemePreference {
  return 'system';
}

function subscribeSystemTheme(listener: () => void): () => void {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return () => {};
  }

  const query = window.matchMedia(DARK_QUERY);

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener);

    return () => query.removeEventListener('change', listener);
  }

  // Navegadores antiguos: `addListener` es la única API disponible.
  query.addListener(listener);

  return () => query.removeListener(listener);
}

function getSystemPrefersDark(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }

  return window.matchMedia(DARK_QUERY).matches;
}

function getServerSystemPrefersDark(): boolean {
  return false;
}

/**
 * Aplica el tema al documento: atributos del `<html>`, `color-scheme` y el
 * `<meta name="theme-color">`, que no puede leer variables CSS.
 */
function applyResolvedTheme(
  resolved: ResolvedTheme,
  preference: ThemePreference,
): void {
  const root = document.documentElement;
  root.setAttribute(THEME_ATTRIBUTES.theme, resolved);
  root.setAttribute(THEME_ATTRIBUTES.preference, preference);
  root.style.colorScheme = resolved;

  const color = THEME_COLORS[resolved].surface;
  const metas = document.querySelectorAll('meta[name="theme-color"]');

  for (const meta of metas) {
    meta.setAttribute('content', color);
  }
}

/**
 * Cambia la preferencia: la escribe en el documento, la aplica de inmediato
 * (sin esperar al siguiente render) y la persiste.
 */
function applyPreference(preference: ThemePreference): void {
  applyResolvedTheme(
    resolveTheme(preference, getSystemPrefersDark()),
    preference,
  );
  storePreference(preference);
  notifyPreferenceChange();
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot,
  );
  const systemPrefersDark = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemPrefersDark,
    getServerSystemPrefersDark,
  );
  const resolved = resolveTheme(preference, systemPrefersDark);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference: applyPreference }),
    [preference, resolved],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Acceso al tema actual. Falla si se usa fuera del proveedor. */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>.');
  }

  return value;
}
