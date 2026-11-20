import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tabs } from '../../src/renderer/components/tabs';

const items = [
  { id: 'sheets', label: 'Fichas', content: <p>Contenido de fichas</p> },
  { id: 'maps', label: 'Mapas', content: <p>Contenido de mapas</p> },
  {
    id: 'writing',
    label: 'Manuscrito',
    content: <p>Contenido del manuscrito</p>,
  },
] as const;

describe('Tabs', () => {
  it('monta la primera pestaña y su panel como seleccionados', () => {
    render(<Tabs items={items} label="Secciones del mundo" />);

    expect(screen.getByRole('tab', { name: 'Fichas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Mapas' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Contenido de fichas',
    );
  });

  it('mueve el foco y la selección con las flechas, Inicio y Fin', async () => {
    const user = userEvent.setup();

    render(<Tabs items={items} label="Secciones del mundo" />);

    const first = screen.getByRole('tab', { name: 'Fichas' });
    first.focus();

    await user.keyboard('{ArrowRight}');

    const second = screen.getByRole('tab', { name: 'Mapas' });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Contenido de mapas',
    );

    await user.keyboard('{End}');

    const last = screen.getByRole('tab', { name: 'Manuscrito' });
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');

    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  it('selecciona una pestaña al pulsarla', async () => {
    const user = userEvent.setup();

    render(<Tabs items={items} label="Secciones del mundo" />);

    await user.click(screen.getByRole('tab', { name: 'Manuscrito' }));

    expect(screen.getByRole('tab', { name: 'Manuscrito' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Contenido del manuscrito',
    );
  });
});
