// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Pestañas (issue #8, fase 2).
 *
 * El rol, la asociación `aria-controls`/`aria-labelledby` y la navegación con
 * flechas los aporta `@radix-ui/react-tabs`; estas pruebas fijan ese contrato
 * para que un cambio de estilos o de API no lo rompa en silencio.
 */

afterEach(cleanup);

function renderTabs() {
  return render(
    <Tabs defaultValue="fichas">
      <TabsList aria-label="Secciones del mundo">
        <TabsTrigger value="fichas">Fichas</TabsTrigger>
        <TabsTrigger value="mapas">Mapas</TabsTrigger>
        <TabsTrigger value="manuscritos">Manuscritos</TabsTrigger>
      </TabsList>
      <TabsContent value="fichas">Listado de fichas</TabsContent>
      <TabsContent value="mapas">Mapa del mundo</TabsContent>
      <TabsContent value="manuscritos">Escenas del manuscrito</TabsContent>
    </Tabs>,
  );
}

describe('Tabs', () => {
  it('expone los roles de pestañas y el panel activo', () => {
    renderTabs();

    const tablist = screen.getByRole('tablist', {
      name: 'Secciones del mundo',
    });
    const tabs = screen.getAllByRole('tab');

    expect(tablist).toBeTruthy();
    expect(tabs).toHaveLength(3);
    expect(
      screen.getByRole('tab', { name: 'Fichas' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.getByRole('tab', { name: 'Mapas' }).getAttribute('aria-selected'),
    ).toBe('false');
    expect(screen.getByRole('tabpanel').textContent).toBe('Listado de fichas');
  });

  it('asocia cada pestaña con su panel por aria-controls', () => {
    renderTabs();

    const fichas = screen.getByRole('tab', { name: 'Fichas' });
    const mapas = screen.getByRole('tab', { name: 'Mapas' });
    const panel = screen.getByRole('tabpanel');

    expect(fichas.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(fichas.id);
    // El panel inactivo no existe en el DOM con la activación por defecto.
    expect(mapas.getAttribute('aria-controls')).not.toBe(panel.id);
  });

  it('cambia de pestaña con las flechas y activa el panel al enfocar', async () => {
    renderTabs();

    const fichas = screen.getByRole('tab', { name: 'Fichas' });

    fichas.focus();
    fireEvent.keyDown(fichas, { key: 'ArrowRight' });

    const mapas = screen.getByRole('tab', { name: 'Mapas' });

    // El primitivo mueve el foco en un `setTimeout(0)` para no encadenar
    // re-render y foco en el mismo tick.
    await waitFor(() => {
      expect(document.activeElement).toBe(mapas);
    });
    expect(mapas.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('Mapa del mundo');
  });

  it('vuelve al principio y al final con Inicio y Fin', async () => {
    renderTabs();

    const fichas = screen.getByRole('tab', { name: 'Fichas' });

    fichas.focus();
    fireEvent.keyDown(fichas, { key: 'End' });

    await waitFor(() => {
      expect(
        screen
          .getByRole('tab', { name: 'Manuscritos' })
          .getAttribute('aria-selected'),
      ).toBe('true');
    });

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });

    await waitFor(() => {
      expect(
        screen
          .getByRole('tab', { name: 'Fichas' })
          .getAttribute('aria-selected'),
      ).toBe('true');
    });
  });

  it('pinta el estado activo con el token de acento', () => {
    renderTabs();

    const fichas = screen.getByRole('tab', { name: 'Fichas' });

    expect(fichas.className).toContain('data-[state=active]:border-accent');
    expect(fichas.className).toContain('data-[state=active]:text-accent');
    expect(fichas.className).toContain('h-11');
  });
});
