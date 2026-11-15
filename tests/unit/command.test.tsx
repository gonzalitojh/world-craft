// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CommandPaletteDialog,
  type CommandPaletteItem,
} from '@/components/ui/command';

/**
 * Paleta de comandos (issue #8, fase 2).
 *
 * Cubre lo que aporta la composición: atajo global, carga diferida del
 * contenido, filtrado, selección con flechas y Enter, cierre con Escape y
 * devolución del foco al disparador.
 */

afterEach(cleanup);

function buildItems(handlers: {
  onHome: () => void;
  onLight: () => void;
  onDark: () => void;
}): CommandPaletteItem[] {
  return [
    {
      id: 'nav-home',
      label: 'Ir al inicio',
      group: 'Navegación',
      onSelect: handlers.onHome,
    },
    {
      id: 'theme-light',
      label: 'Tema claro',
      group: 'Tema',
      onSelect: handlers.onLight,
    },
    {
      id: 'theme-dark',
      label: 'Tema oscuro',
      group: 'Tema',
      onSelect: handlers.onDark,
    },
  ];
}

function buildSpies() {
  return { onHome: vi.fn(), onLight: vi.fn(), onDark: vi.fn() };
}

describe('CommandPaletteDialog', () => {
  it('no carga el contenido hasta que se abre', () => {
    const handlers = buildSpies();

    render(<CommandPaletteDialog items={buildItems(handlers)} />);

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre con el atajo Ctrl+K y muestra los comandos agrupados', async () => {
    const handlers = buildSpies();

    render(<CommandPaletteDialog items={buildItems(handlers)} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const dialog = await screen.findByRole('dialog', {
      name: 'Paleta de comandos',
    });
    const input = await screen.findByRole('combobox');

    expect(dialog).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });
    expect(screen.getByRole('option', { name: 'Ir al inicio' })).toBeTruthy();
    expect(input.getAttribute('placeholder')).toBe(
      'Escribe un comando o busca…',
    );
  });

  it('abre con el disparador y cierra con Escape devolviendo el foco', async () => {
    const handlers = buildSpies();

    render(<CommandPaletteDialog items={buildItems(handlers)} />);

    const trigger = screen.getByRole('button', {
      name: /Abrir la paleta de comandos/,
    });

    fireEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'Paleta de comandos' });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('filtra los comandos al escribir', async () => {
    const handlers = buildSpies();

    render(<CommandPaletteDialog items={buildItems(handlers)} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const input = await screen.findByRole('combobox');

    fireEvent.change(input, { target: { value: 'tema' } });

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });
    expect(screen.queryByRole('option', { name: 'Ir al inicio' })).toBeNull();
  });

  it('muestra el estado vacío cuando nada coincide', async () => {
    const handlers = buildSpies();

    render(<CommandPaletteDialog items={buildItems(handlers)} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const input = await screen.findByRole('combobox');

    fireEvent.change(input, { target: { value: 'zzzz' } });

    expect(
      await screen.findByText('Ningún comando coincide con esa búsqueda.'),
    ).toBeTruthy();
  });

  it('mueve la selección con las flechas y ejecuta con Enter', async () => {
    const handlers = buildSpies();

    render(<CommandPaletteDialog items={buildItems(handlers)} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const input = await screen.findByRole('combobox');

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(
        screen
          .getByRole('option', { name: 'Tema claro' })
          .getAttribute('aria-selected'),
      ).toBe('true');
    });

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(handlers.onLight).toHaveBeenCalledTimes(1);
    });
    expect(handlers.onHome).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
