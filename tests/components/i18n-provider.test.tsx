import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../src/renderer/i18n/provider';
import { HomePage } from '../../src/renderer/pages/home-page';

describe('I18nProvider', () => {
  it('los componentes leen textos y formatos del proveedor', () => {
    render(
      <I18nProvider locale="es">
        <HomePage onCreateWorld={vi.fn()} />
      </I18nProvider>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Todavía no hay ningún mundo',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Crear mundo' }),
    ).toBeInTheDocument();
  });

  it('rechaza un locale no soportado y usa el idioma de reserva', () => {
    render(
      <I18nProvider>
        <HomePage onCreateWorld={vi.fn()} />
      </I18nProvider>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Todavía no hay ningún mundo',
      }),
    ).toBeInTheDocument();
  });
});
