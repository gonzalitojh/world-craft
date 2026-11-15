import { describe, expect, it } from 'vitest';

import {
  createThemeScript,
  isThemePreference,
  readStoredPreference,
  resolveTheme,
  storePreference,
  THEME_ATTRIBUTES,
  THEME_STORAGE_KEY,
} from '@/lib/theme';
import { THEME_COLORS } from '@/lib/theme-palette';

/**
 * Contrato del tema (issue #8).
 *
 * Cubre la lógica que decide qué se pinta, la lectura tolerante del
 * almacenamiento, el contenido del script de arranque y la persistencia. El
 * comportamiento del proveedor y del selector se prueba en
 * `theme-provider.test.tsx`.
 */

/** `localStorage` de juguete para probar lecturas y escrituras. */
function createStorage(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial));

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

describe('resolveTheme', () => {
  it('sigue al sistema cuando la preferencia es system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('respeta la elección explícita por encima del sistema', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('isThemePreference', () => {
  it('acepta solo las tres preferencias válidas', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});

describe('readStoredPreference', () => {
  it('lee la preferencia guardada', () => {
    const storage = createStorage({ [THEME_STORAGE_KEY]: 'dark' });

    expect(readStoredPreference(storage)).toBe('dark');
  });

  it('cae en system si no hay valor o es inválido', () => {
    expect(readStoredPreference(createStorage())).toBe('system');
    expect(
      readStoredPreference(createStorage({ [THEME_STORAGE_KEY]: 'sepia' })),
    ).toBe('system');
  });

  it('tolera un almacenamiento bloqueado o inexistente', () => {
    const blocked = createStorage();
    blocked.getItem = () => {
      throw new Error('almacenamiento bloqueado');
    };

    expect(readStoredPreference(blocked)).toBe('system');
    expect(readStoredPreference(null)).toBe('system');
  });
});

describe('storePreference', () => {
  it('persiste la preferencia con la clave acordada', () => {
    const storage = createStorage();

    storePreference('light', storage);

    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('no lanza si el almacenamiento rechaza la escritura', () => {
    const blocked = createStorage();
    blocked.setItem = () => {
      throw new Error('cuota agotada');
    };

    expect(() => storePreference('dark', blocked)).not.toThrow();
    expect(() => storePreference('dark', null)).not.toThrow();
  });
});

describe('createThemeScript', () => {
  const script = createThemeScript();

  it('fija el tema y la preferencia antes del primer pintado', () => {
    expect(script).toContain(THEME_ATTRIBUTES.theme);
    expect(script).toContain(THEME_ATTRIBUTES.preference);
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain("setAttribute('data-theme', resolved)");
  });

  it('seguir al sistema exige escuchar prefers-color-scheme', () => {
    expect(script).toContain('(prefers-color-scheme: dark)');
    expect(script).toContain('addEventListener');
  });

  it('usa los colores de superficie de theme-palette.ts', () => {
    expect(script).toContain(THEME_COLORS.light.surface);
    expect(script).toContain(THEME_COLORS.dark.surface);
  });

  it('es estático y no se puede romper el documento con él', () => {
    expect(createThemeScript()).toBe(script);
    expect(script).not.toContain('</script>');
  });

  it('nunca deja la página sin tema si algo falla', () => {
    expect(script).toContain('catch (error)');
    expect(script).toContain("setAttribute('data-theme', 'light')");
  });
});
