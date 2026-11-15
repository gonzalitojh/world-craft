// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from '@/components/ui/toast';

/**
 * Avisos efímeros (issue #8, fase 2).
 *
 * Se comprueba el comportamiento, no el CSS: cola máxima, temporizadores por
 * variante, error persistente, pausa al pasar el ratón o al enfocar, cierre
 * manual y que los avisos vivan en la región `aria-live` que les corresponde.
 *
 * Nota sobre los eventos: React sintetiza `onMouseEnter`/`onMouseLeave` a partir
 * de `mouseover`/`mouseout`, así que las pruebas usan esos dos últimos.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness() {
  const { toast } = useToast();

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          toast({ title: 'Borrador guardado', variant: 'success' })
        }
      >
        guardar
      </button>
      <button
        type="button"
        onClick={() =>
          toast({
            title: 'Quedan pocos cambios sin exportar',
            variant: 'warning',
            description: 'Exporta el mundo para no perderlos.',
          })
        }
      >
        avisar
      </button>
      <button
        type="button"
        onClick={() => toast({ title: 'No se pudo guardar', variant: 'error' })}
      >
        fallar
      </button>
      <button
        type="button"
        onClick={() =>
          toast({ title: 'Nuevo miembro invitado', variant: 'info' })
        }
      >
        informar
      </button>
      {[1, 2, 3, 4].map((index) => (
        <button
          key={index}
          type="button"
          onClick={() => toast({ title: `Aviso ${index}` })}
        >
          {`cola ${index}`}
        </button>
      ))}
    </div>
  );
}

function renderToasts() {
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

function toasts(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-slot="toast"]'),
  );
}

function advance(milliseconds: number): void {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe('Toast', () => {
  it('pinta dos regiones vivas persistentes aunque no haya avisos', () => {
    renderToasts();

    expect(
      screen.getByRole('region', { name: 'Avisos' }).getAttribute('aria-live'),
    ).toBe('polite');
    expect(
      screen
        .getByRole('region', { name: 'Avisos urgentes' })
        .getAttribute('aria-live'),
    ).toBe('assertive');
    expect(toasts()).toHaveLength(0);
  });

  it('no repite el rol en cada aviso para evitar el doble anuncio', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'guardar' }));

    const toast = toasts()[0];

    expect(toast).toBeDefined();
    expect(toast?.hasAttribute('role')).toBe(false);
    expect(
      within(toast as HTMLElement).getByText('Borrador guardado'),
    ).toBeTruthy();
  });

  it('limita la cola a tres avisos visibles', () => {
    renderToasts();

    for (const index of [1, 2, 3, 4]) {
      fireEvent.click(screen.getByRole('button', { name: `cola ${index}` }));
    }

    expect(toasts()).toHaveLength(3);
    expect(screen.queryByText('Aviso 1')).toBeNull();
    expect(screen.getByText('Aviso 4')).toBeTruthy();
  });

  it('cierra solo los avisos informativos a los 6 segundos', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'guardar' }));

    advance(5_900);
    expect(screen.getByText('Borrador guardado')).toBeTruthy();

    advance(200);
    expect(screen.queryByText('Borrador guardado')).toBeNull();
  });

  it('deja los avisos de advertencia 10 segundos', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));

    advance(6_000);
    expect(screen.getByText('Quedan pocos cambios sin exportar')).toBeTruthy();

    advance(4_100);
    expect(screen.queryByText('Quedan pocos cambios sin exportar')).toBeNull();
  });

  it('mantiene los errores hasta que se descartan a mano', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'fallar' }));

    advance(60_000);
    expect(screen.getByText('No se pudo guardar')).toBeTruthy();

    const assertive = screen.getByRole('region', { name: 'Avisos urgentes' });

    fireEvent.click(
      within(assertive).getByRole('button', { name: 'Descartar el aviso' }),
    );

    expect(screen.queryByText('No se pudo guardar')).toBeNull();
  });

  it('coloca los errores en la región urgente y el resto en la educada', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'informar' }));
    fireEvent.click(screen.getByRole('button', { name: 'fallar' }));

    const polite = screen.getByRole('region', { name: 'Avisos' });
    const assertive = screen.getByRole('region', { name: 'Avisos urgentes' });

    expect(within(polite).getByText('Nuevo miembro invitado')).toBeTruthy();
    expect(within(assertive).getByText('No se pudo guardar')).toBeTruthy();
  });

  it('pausa el temporizador al pasar el ratón y lo reanuda al salir', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'guardar' }));

    const toast = toasts()[0] as HTMLElement;

    fireEvent.mouseOver(toast);
    advance(30_000);
    expect(screen.getByText('Borrador guardado')).toBeTruthy();

    fireEvent.mouseOut(toast);
    advance(6_000);
    expect(screen.queryByText('Borrador guardado')).toBeNull();
  });

  it('pausa el temporizador mientras el foco está dentro del aviso', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'guardar' }));

    const toast = toasts()[0] as HTMLElement;
    const dismiss = within(toast).getByRole('button', {
      name: 'Descartar el aviso',
    });

    act(() => {
      dismiss.focus();
    });
    advance(30_000);
    expect(screen.getByText('Borrador guardado')).toBeTruthy();

    act(() => {
      dismiss.blur();
    });
    advance(6_000);
    expect(screen.queryByText('Borrador guardado')).toBeNull();
  });

  it('permite descartar cualquier aviso con un botón de tamaño táctil', () => {
    renderToasts();

    fireEvent.click(screen.getByRole('button', { name: 'informar' }));

    const dismiss = screen.getByRole('button', { name: 'Descartar el aviso' });

    expect(dismiss.className).toContain('size-11');

    fireEvent.click(dismiss);

    expect(screen.queryByText('Nuevo miembro invitado')).toBeNull();
  });
});
