// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';

afterEach(cleanup);

describe('Button', () => {
  it('renderiza un botón de tipo button por defecto', () => {
    render(<Button>Entrar al taller</Button>);

    const button = screen.getByRole('button', { name: 'Entrar al taller' });

    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('bg-accent');
    expect(button.className).toContain('h-11');
  });

  it('respeta el tipo submit cuando se indica', () => {
    render(<Button type="submit">Enviar</Button>);

    expect(
      screen.getByRole('button', { name: 'Enviar' }).getAttribute('type'),
    ).toBe('submit');
  });

  it('aplica la variante outline con borde visible', () => {
    render(<Button variant="outline">Ver estado</Button>);

    const button = screen.getByRole('button', { name: 'Ver estado' });

    expect(button.className).toContain('border-border');
    expect(button.className).not.toContain('bg-accent');
  });

  it('aplica la variante destructive con el token de peligro', () => {
    render(<Button variant="destructive">Eliminar</Button>);

    expect(
      screen.getByRole('button', { name: 'Eliminar' }).className,
    ).toContain('bg-danger');
  });

  it('renderiza el hijo en lugar de un botón con asChild', () => {
    render(
      <Button asChild>
        <a href="/entrar">Entrar</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Entrar' });

    expect(link.className).toContain('bg-accent');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no impide que las etiquetas largas envuelvan', () => {
    render(
      <Button>Una etiqueta bastante larga para comprobar el ajuste</Button>,
    );

    expect(screen.getByRole('button').className).not.toContain(
      'whitespace-nowrap',
    );
  });

  it('marca el estado deshabilitado con tokens legibles, sin opacidad', () => {
    render(<Button disabled>Entrar (no disponible)</Button>);

    const button = screen.getByRole('button', {
      name: 'Entrar (no disponible)',
    });

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.className).toContain('disabled:bg-surface-raised');
    expect(button.className).toContain('disabled:text-muted-foreground');
    expect(button.className).toContain('disabled:border-border');
    expect(button.className).not.toContain('opacity-60');
  });
});
