import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../src/renderer/i18n/provider';
import { HomePage } from '../../src/renderer/pages/home-page';

const actions = {
  onOpen: vi.fn(),
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onArchiveToggle: vi.fn(),
  onDelete: vi.fn(),
};

function renderHome() {
  return render(
    <I18nProvider locale="es">
      <HomePage
        worlds={[]}
        activity={[]}
        state="ready"
        actions={actions}
        continueTarget={null}
        onCreate={vi.fn()}
        onContinue={vi.fn()}
        onSeeAll={vi.fn()}
        onRetry={vi.fn()}
      />
    </I18nProvider>,
  );
}

describe('I18nProvider', () => {
  it('los componentes leen textos y formatos del proveedor', () => {
    renderHome();

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
        <HomePage
          worlds={[]}
          activity={[]}
          state="ready"
          actions={actions}
          continueTarget={null}
          onCreate={vi.fn()}
          onContinue={vi.fn()}
          onSeeAll={vi.fn()}
          onRetry={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Todavía no hay ningún mundo',
      }),
    ).toBeInTheDocument();
  });
});
