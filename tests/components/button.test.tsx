import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '../../src/renderer/components/button';

describe('Button', () => {
  it('renderiza un botón nativo con su nombre accesible y dispara onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toBeEnabled();

    await user.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('se activa con Enter y con Espacio', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });
    button.focus();

    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('en estado loading se deshabilita, anuncia aria-busy y oculta el spinner', () => {
    const { container } = render(<Button loading>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.wc-button__spinner')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('acepta variantes y tamaño sin perder el contenido', () => {
    render(
      <Button variant="danger" size="sm">
        Borrar mundo
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Borrar mundo' });

    expect(button).toHaveClass('wc-button', 'wc-button--danger');
    expect(button).toHaveClass('wc-button--sm');
  });
});
