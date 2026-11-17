// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useI18n } from '@/components/i18n/locale-provider';
import type { Locale } from '@/lib/i18n/locale';

import { pseudoMessages, pseudoText } from '../fixtures/i18n/pseudo';
import { renderWithI18n } from '../helpers/render';

/**
 * Proveedor de idioma (M0-12).
 *
 * Comprueba el contrato que comparten servidor y cliente: el catálogo que llega
 * por props es el que se pinta, los formateadores usan el locale de la petición
 * y cambiar de idioma pasa siempre por la Server Action y un refresco.
 */

const action = vi.hoisted(() => ({
  setLocale: vi.fn(async (locale: string) => ({
    ok: true as const,
    locale: locale as Locale,
  })),
}));

const router = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('@/lib/i18n/actions', () => ({
  setLocale: action.setLocale,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
}));

afterEach(() => {
  cleanup();
  action.setLocale.mockClear();
  router.refresh.mockClear();
});

function Probe({ next = 'en' as Locale }: { next?: Locale }) {
  const { locale, t, format, availableLocales, setLocale, isPending } =
    useI18n();

  return (
    <div>
      <p data-testid="title">{t('home.title')}</p>
      <p data-testid="locale">{locale}</p>
      <p data-testid="locales">{availableLocales.join(',')}</p>
      <p data-testid="number">{format.number(1234.5)}</p>
      <p data-testid="pending">{String(isPending)}</p>
      <button
        type="button"
        onClick={() => {
          setLocale(next);
        }}
      >
        cambiar
      </button>
    </div>
  );
}

describe('useI18n', () => {
  it('falla si se usa fuera del proveedor', () => {
    function Orphan() {
      useI18n();
      return null;
    }

    // React imprime el error por consola aunque el test lo espere.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => render(<Orphan />)).toThrow(
      'useI18n debe usarse dentro de <LocaleProvider>.',
    );

    consoleError.mockRestore();
  });

  it('pinta el catálogo que recibe, no un texto fijo', () => {
    renderWithI18n(<Probe />, { messages: pseudoMessages });

    expect(screen.getByTestId('title').textContent).toBe(
      pseudoText(
        'Un taller de cartógrafo para dar forma a mundos que aún no existen',
      ),
    );
  });

  it('expone el locale, los idiomas disponibles y sus formatos', () => {
    renderWithI18n(<Probe />, {
      availableLocales: ['es', 'en'],
    });

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('locales').textContent).toBe('es,en');
    expect(screen.getByTestId('number').textContent).toBe('1234,5');
    expect(screen.getByTestId('pending').textContent).toBe('false');
  });

  it('cambia el idioma con la Server Action y refresca la vista', async () => {
    renderWithI18n(<Probe next="en" />, { availableLocales: ['es', 'en'] });

    fireEvent.click(screen.getByRole('button', { name: 'cambiar' }));

    await waitFor(() => {
      expect(action.setLocale).toHaveBeenCalledWith('en');
    });
    await waitFor(() => {
      expect(router.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('no llama al servidor si el idioma es el mismo', () => {
    renderWithI18n(<Probe next="es" />, { availableLocales: ['es', 'en'] });

    fireEvent.click(screen.getByRole('button', { name: 'cambiar' }));

    expect(action.setLocale).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
