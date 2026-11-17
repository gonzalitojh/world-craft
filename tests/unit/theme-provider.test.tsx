// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithI18n } from '../helpers/render';

import { ThemeProvider, useTheme } from '@/components/theme/theme-provider';
import { ThemeSelector } from '@/components/theme/theme-selector';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { es } from '@/messages/es';

/**
 * Proveedor y selector de tema (issue #8).
 *
 * Comprueban lo que el usuario percibe: elegir un tema lo aplica al documento,
 * lo persiste y no destruye lo que el script de arranque ya había resuelto.
 */

/** Espía del contexto: muestra lo que ve cualquier consumidor. */
function ThemeProbe() {
  const { preference, resolved } = useTheme();

  return <output data-testid="probe">{`${preference}|${resolved}`}</output>;
}

function renderSelector() {
  renderWithI18n(
    <ThemeProvider>
      <ThemeSelector />
      <ThemeProbe />
    </ThemeProvider>,
  );

  return screen.getByLabelText(es.theme.label) as HTMLSelectElement;
}

function probe(): string {
  return screen.getByTestId('probe').textContent ?? '';
}

/** Sustituye temporalmente `matchMedia` por una preferencia del sistema fija. */
function stubSystemTheme(prefersDark: boolean): () => void {
  const original = window.matchMedia;

  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: prefersDark,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;

  return () => {
    window.matchMedia = original;
  };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
  document.documentElement.style.colorScheme = '';
});

describe('ThemeSelector', () => {
  it('ofrece sistema, claro y oscuro', () => {
    renderSelector();

    const labels = Array.from(
      (screen.getByLabelText(es.theme.label) as HTMLSelectElement).options,
    ).map((option) => option.textContent);

    expect(labels).toEqual([es.theme.system, es.theme.light, es.theme.dark]);
  });

  it('empieza en sistema cuando no hay preferencia guardada', () => {
    expect(renderSelector().value).toBe('system');
    expect(probe()).toBe('system|light');
  });

  it('aplica el tema elegido al documento y lo persiste', () => {
    const select = renderSelector();

    fireEvent.change(select, { target: { value: 'dark' } });

    expect(select.value).toBe('dark');
    expect(probe()).toBe('dark|dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-preference')).toBe(
      'dark',
    );
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('recupera la preferencia guardada al montar', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    expect(renderSelector().value).toBe('light');
  });

  it('respeta lo que dejó el script de arranque antes de hidratar', () => {
    // El script ya escribió el tema y la preferencia en `<html>`; React no
    // puede sobrescribirlos con el «sistema» del render del servidor.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-theme-preference', 'dark');

    const select = renderSelector();

    expect(select.value).toBe('dark');
    expect(probe()).toBe('dark|dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-preference')).toBe(
      'dark',
    );
  });

  it('resuelve «sistema» con la preferencia del sistema operativo', () => {
    const restore = stubSystemTheme(true);

    try {
      renderSelector();

      expect(probe()).toBe('system|dark');
    } finally {
      restore();
    }
  });
});
