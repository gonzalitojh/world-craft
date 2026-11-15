// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Search } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  type DrawerSide,
} from '@/components/ui/drawer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Overlays (issue #8, fase 2): diálogo, drawer y tooltip.
 *
 * Se comprueba el contrato que el primitivo de Radix aporta y que un componente
 * puede romper sin darse cuenta: nombre accesible, cierre con Escape,
 * devolución del foco al disparador y `aria-describedby` del tooltip.
 */

afterEach(cleanup);

describe('Dialog', () => {
  function renderDialog() {
    return render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir ajustes</Button>
        </DialogTrigger>
        <DialogContent
          title="Ajustes del mundo"
          description="Cambia el nombre y quién puede entrar."
        >
          <p>Contenido del diálogo</p>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>,
    );
  }

  it('usa el título como nombre accesible y la descripción como ayuda', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajustes' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Ajustes del mundo',
    });
    const description = screen.getByText(
      'Cambia el nombre y quién puede entrar.',
    );

    expect(dialog.getAttribute('aria-describedby')).toBe(description.id);
    expect(screen.getByText('Contenido del diálogo')).toBeTruthy();
  });

  it('cierra con Escape y devuelve el foco al disparador', async () => {
    renderDialog();

    const trigger = screen.getByRole('button', { name: 'Abrir ajustes' });

    fireEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'Ajustes del mundo' });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('se cierra con su botón de cierre interno', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await screen.findByRole('dialog', { name: 'Ajustes del mundo' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('mantiene el nombre accesible con el título oculto a la vista', async () => {
    render(
      <Dialog open>
        <DialogContent title="Paleta de comandos" titleHidden hideCloseButton>
          <p>Contenido</p>
        </DialogContent>
      </Dialog>,
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Paleta de comandos',
    });
    const heading = screen.getByText('Paleta de comandos');

    expect(heading.className).toContain('sr-only');
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('pinta un botón de cierre con nombre accesible', async () => {
    render(
      <Dialog open>
        <DialogContent title="Ajustes">Contenido</DialogContent>
      </Dialog>,
    );

    await screen.findByRole('dialog', { name: 'Ajustes' });

    expect(
      screen.getByRole('button', { name: 'Cerrar el diálogo' }),
    ).toBeTruthy();
  });

  it('tabula el cierre antes que el contenido, como se ve en pantalla', async () => {
    render(
      <Dialog open>
        <DialogContent title="Ajustes">
          <button type="button">Guardar</button>
        </DialogContent>
      </Dialog>,
    );

    await screen.findByRole('dialog', { name: 'Ajustes' });

    const close = screen.getByRole('button', { name: 'Cerrar el diálogo' });
    const save = screen.getByRole('button', { name: 'Guardar' });

    // El cierre se ve arriba a la derecha: también llega antes con Tab.
    expect(
      close.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('Drawer', () => {
  const sides: readonly DrawerSide[] = ['left', 'right', 'bottom'];

  for (const side of sides) {
    it(`abre por el lado ${side} y cierra con Escape`, async () => {
      render(
        <Drawer>
          <DrawerTrigger asChild>
            <Button>Abrir panel</Button>
          </DrawerTrigger>
          <DrawerContent side={side} title={`Panel ${side}`}>
            <p>Navegación</p>
          </DrawerContent>
        </Drawer>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Abrir panel' }));

      const panel = await screen.findByRole('dialog', {
        name: `Panel ${side}`,
      });

      expect(panel.getAttribute('data-slot')).toBe('drawer-content');
      expect(panel.getAttribute('data-side')).toBe(side);
      expect(panel.className).toContain('shadow-dialog');

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });
  }

  it('ofrece un cierre propio con nombre accesible', async () => {
    render(
      <Drawer>
        <DrawerTrigger asChild>
          <Button>Abrir panel</Button>
        </DrawerTrigger>
        <DrawerContent title="Más opciones">
          <p>Navegación</p>
        </DrawerContent>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir panel' }));
    await screen.findByRole('dialog', { name: 'Más opciones' });

    expect(
      screen.getByRole('button', { name: 'Cerrar el panel' }),
    ).toBeTruthy();
  });

  it('tabula el cierre antes que el contenido', async () => {
    render(
      <Drawer open>
        <DrawerContent title="Más opciones">
          <button type="button">Licencia</button>
        </DrawerContent>
      </Drawer>,
    );

    await screen.findByRole('dialog', { name: 'Más opciones' });

    const close = screen.getByRole('button', { name: 'Cerrar el panel' });
    const link = screen.getByRole('button', { name: 'Licencia' });

    expect(
      close.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('reserva el área segura cuando entra por abajo', async () => {
    render(
      <Drawer open>
        <DrawerContent side="bottom" title="Más opciones">
          <p>Navegación</p>
        </DrawerContent>
      </Drawer>,
    );

    const panel = await screen.findByRole('dialog', {
      name: 'Más opciones',
    });

    expect(panel.className).toContain(
      'pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
    );
  });
});

describe('Tooltip', () => {
  it('describe el disparador sin sustituir su etiqueta accesible', async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" aria-label="Buscar en el mundo">
              <Search aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Buscar en el mundo</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Buscar en el mundo' });

    expect(trigger.getAttribute('aria-label')).toBe('Buscar en el mundo');

    fireEvent.focus(trigger);

    const tooltip = await screen.findByRole('tooltip');

    expect(tooltip.textContent).toContain('Buscar en el mundo');
    await waitFor(() => {
      expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
    });
  });
});
