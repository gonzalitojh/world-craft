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

  it('muestra el indicador de progreso y bloquea el botón con loading', () => {
    render(<Button loading>Guardando</Button>);

    const button = screen.getByRole('button', { name: 'Guardando' });
    const spinner = button.querySelector('svg');

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
    expect(spinner?.getAttribute('class')).toContain('animate-spin');
    expect(spinner?.getAttribute('class')).toContain(
      'motion-reduce:animate-none',
    );
  });

  it('no marca aria-busy ni bloquea cuando no está cargando', () => {
    render(<Button>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });

    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.querySelector('svg')).toBeNull();
  });

  it('aplica la variante link sin relleno y con el token de acento', () => {
    render(<Button variant="link">Volver al inicio</Button>);

    const button = screen.getByRole('button', { name: 'Volver al inicio' });

    expect(button.className).toContain('text-accent');
    expect(button.className).toContain('underline-offset-4');
    expect(button.className).not.toContain('bg-accent');
  });

  it('usa tonos fuertes en el hover para no bajar el contraste', () => {
    render(<Button>Entrar</Button>);

    const button = screen.getByRole('button', { name: 'Entrar' });

    expect(button.className).toContain('hover:bg-accent-strong');
    expect(button.className).not.toContain('hover:bg-accent/90');
  });

  it('no anima el color del anillo de foco', () => {
    render(<Button>Entrar</Button>);

    const button = screen.getByRole('button', { name: 'Entrar' });

    // `transition-colors` incluye `outline-color`: el foco arrancaría con el
    // color del texto en lugar del token `--focus`.
    expect(button.className).not.toContain('transition-colors');
    expect(button.className).toContain(
      'transition-[color,background-color,border-color]',
    );
  });
});
