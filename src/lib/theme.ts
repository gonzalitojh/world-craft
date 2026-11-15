import { THEME_COLORS } from './theme-palette';

/**
 * Preferencia de tema y arranque sin parpadeo (issue #8, ADR 0010).
 *
 * El tema resuelto se escribe en `<html data-theme>` y la preferencia elegida
 * en `<html data-theme-preference>`. Separarlos permite que el script de
 * arranque (que corre antes del primer pintado) sepa si debe seguir al sistema
 * o mantenerse en una elección explícita, incluso cuando otro script cambia la
 * preferencia después.
 *
 * Módulo compartido por servidor y cliente: no toca `window` al importarse.
 */

/** Clave de `localStorage` con la preferencia. */
export const THEME_STORAGE_KEY = 'wc-theme';

/** Atributos del elemento raíz que leen el CSS y el script de arranque. */
export const THEME_ATTRIBUTES = {
  theme: 'data-theme',
  preference: 'data-theme-preference',
} as const;

/** Qué eligió el usuario. «Sistema» sigue a `prefers-color-scheme`. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Qué se pinta realmente. */
export type ResolvedTheme = 'light' | 'dark';

/** Preferencias válidas, en el orden en que se ofrecen. */
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'system',
  'light',
  'dark',
];

/** Estructura mínima de `localStorage` que se usa aquí. */
type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/** Comprueba si un valor desconocido es una preferencia de tema válida. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some((preference) => preference === value);
}

/** Resuelve la preferencia en el tema que hay que pintar. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return preference;
}

/**
 * Devuelve `localStorage` o `null` si el navegador lo bloquea (modo privado,
 * cookies de terceros, políticas del navegador). Acceder a `window.localStorage`
 * puede lanzar, por eso el `try`.
 */
function defaultStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Lee la preferencia guardada.
 *
 * Nunca lanza: si el almacenamiento falta, está bloqueado o contiene basura,
 * devuelve «sistema», que es el comportamiento por defecto.
 */
export function readStoredPreference(
  storage?: ReadableStorage | null,
): ThemePreference {
  const target = storage === undefined ? defaultStorage() : storage;

  if (!target) {
    return 'system';
  }

  try {
    const value = target.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Guarda la preferencia y tolera un almacenamiento bloqueado o lleno. */
export function storePreference(
  preference: ThemePreference,
  storage?: WritableStorage | null,
): void {
  const target = storage === undefined ? defaultStorage() : storage;

  if (!target) {
    return;
  }

  try {
    target.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Sin persistencia el tema sigue funcionando durante la sesión.
  }
}

/** Colores de superficie por tema, para `<meta name="theme-color">`. */
const surfaceByTheme: Record<ResolvedTheme, string> = {
  light: THEME_COLORS.light.surface,
  dark: THEME_COLORS.dark.surface,
};

/**
 * Script que fija el tema antes del primer pintado.
 *
 * Es estático: solo interpola constantes del propio proyecto (la clave de
 * almacenamiento, los atributos y los colores de `theme-palette.ts`), nunca
 * datos de usuario. Se emite como `<script>` en línea en `layout.tsx` y no con
 * `next/script` (`strategy="beforeInteractive"`): con esa estrategia Next lo
 * encola en `self.__next_s` y no se ejecuta antes de terminar el parseo, así
 * que el tema claro llegaba a pintarse.
 *
 * Si `localStorage` o `matchMedia` fallan, cae al tema claro que `:root` ya
 * define; el `catch` exterior garantiza que nunca deja la página a medias.
 */
export function createThemeScript(): string {
  return `(function () {
  var root = document.documentElement;
  try {
    var storeKey = '${THEME_STORAGE_KEY}';
    var preferenceAttribute = '${THEME_ATTRIBUTES.preference}';
    var readPreference = function () {
      var value = root.getAttribute(preferenceAttribute);
      if (value === 'light' || value === 'dark') {
        return value;
      }
      return 'system';
    };
    var query = null;
    try {
      query = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    } catch (error) {
      query = null;
    }
    var stored = 'system';
    try {
      var candidate = window.localStorage.getItem(storeKey);
      if (candidate === 'light' || candidate === 'dark' || candidate === 'system') {
        stored = candidate;
      }
    } catch (error) {
      stored = 'system';
    }
    root.setAttribute(preferenceAttribute, stored);
    var surfaceColors = ${JSON.stringify(surfaceByTheme)};
    var apply = function () {
      var preference = readPreference();
      var resolved = preference === 'system'
        ? (query && query.matches ? 'dark' : 'light')
        : preference;
      root.setAttribute('${THEME_ATTRIBUTES.theme}', resolved);
      root.style.colorScheme = resolved;
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      for (var index = 0; index < metas.length; index += 1) {
        metas[index].setAttribute('content', surfaceColors[resolved]);
      }
    };
    apply();
    if (query) {
      var onChange = function () {
        apply();
      };
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', onChange);
      } else if (typeof query.addListener === 'function') {
        query.addListener(onChange);
      }
    }
  } catch (error) {
    root.setAttribute('${THEME_ATTRIBUTES.theme}', 'light');
  }
})();`;
}
