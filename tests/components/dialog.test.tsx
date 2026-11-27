import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Button } from '@/renderer/components/button';
import { Dialog } from '@/renderer/components/dialog';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

interface HarnessProps {
  readonly onParentClose: () => void;
  readonly onChildClose: () => void;
}

function NestedDialogsHarness({ onParentClose, onChildClose }: HarnessProps) {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);

  return (
    <Dialog
      open={parentOpen}
      onClose={() => {
        onParentClose();
        setParentOpen(false);
      }}
      title="Diálogo padre"
      actions={
        <Button
          variant="ghost"
          onClick={() => {
            setParentOpen(false);
          }}
        >
          Cerrar padre
        </Button>
      }
    >
      <button
        type="button"
        onClick={() => {
          setChildOpen(true);
        }}
      >
        Abrir hija
      </button>
      <p>Contenido del padre</p>
      <Dialog
        open={childOpen}
        onClose={() => {
          onChildClose();
          setChildOpen(false);
        }}
        title="Diálogo hija"
        actions={
          <Button
            variant="ghost"
            onClick={() => {
              setChildOpen(false);
            }}
          >
            Cerrar hija
          </Button>
        }
      >
        <p>Contenido de la hija</p>
        <button
          type="button"
          onClick={() => {
            setChildOpen(false);
          }}
        >
          Elegir en la hija
        </button>
      </Dialog>
    </Dialog>
  );
}

function renderHarness() {
  const onParentClose = vi.fn();
  const onChildClose = vi.fn();

  render(
    <I18nProvider locale="es">
      <NestedDialogsHarness
        onParentClose={onParentClose}
        onChildClose={onChildClose}
      />
    </I18nProvider>,
  );

  return { onParentClose, onChildClose };
}

function parentDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Diálogo padre' });
}

function childDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Diálogo hija' });
}

async function openChild(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Abrir hija' }));
  expect(childDialog()).toBeVisible();
}

describe('diálogos anidados', () => {
  it('cerrar la hija con la X no cierra el padre y devuelve el foco', async () => {
    const user = userEvent.setup();
    const { onParentClose, onChildClose } = renderHarness();

    await openChild(user);

    const child = childDialog();
    const close = within(child).getAllByRole('button', {
      name: messages.components.dialog.close,
    })[0];

    if (close === undefined) {
      throw new Error('Se esperaba el botón de cerrar de la hija.');
    }

    await user.click(close);
    // Cierre nativo del hijo que React replica hacia el padre.
    fireEvent(child, new Event('close'));

    expect(onChildClose).toHaveBeenCalled();
    expect(onParentClose).not.toHaveBeenCalled();
    expect(parentDialog()).toBeVisible();
    expect(screen.getByRole('button', { name: 'Abrir hija' })).toHaveFocus();
  });

  it('Escape en la hija no cierra el padre', async () => {
    const user = userEvent.setup();
    const { onParentClose, onChildClose } = renderHarness();

    await openChild(user);

    const child = childDialog();

    fireEvent.keyDown(child, { key: 'Escape' });
    // En jsdom el cierre nativo no emite `close`; se replica el evento que en
    // Electron dispara React y que antes alcanzaba al padre.
    fireEvent(child, new Event('close'));

    await waitFor(() => {
      expect(onChildClose).toHaveBeenCalledTimes(1);
    });
    expect(onParentClose).not.toHaveBeenCalled();
    expect(parentDialog()).toBeVisible();
    expect(screen.getByRole('button', { name: 'Abrir hija' })).toHaveFocus();
  });

  it('cerrar la hija por selección no cierra el padre', async () => {
    const user = userEvent.setup();
    const onParentClose = vi.fn();
    render(
      <I18nProvider locale="es">
        <SelectionHarness onParentClose={onParentClose} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir hija' }));

    const child = childDialog();

    await user.click(screen.getByRole('button', { name: 'Elegir en la hija' }));
    fireEvent(child, new Event('close'));

    expect(onParentClose).not.toHaveBeenCalled();
    expect(parentDialog()).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Diálogo hija' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir hija' })).toHaveFocus();
  });

  it('solo el cierre del padre llama a su onClose', () => {
    const { onParentClose } = renderHarness();

    const parent = parentDialog();

    fireEvent(parent, new Event('close'));

    expect(onParentClose).toHaveBeenCalledTimes(1);
  });

  it('conserva el cierre normal con Escape y el foco del disparador', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <I18nProvider locale="es">
        <SingleDialogHarness onClose={onClose} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));

    const dialog = screen.getByRole('dialog', { name: 'Diálogo simple' });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent(dialog, new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Diálogo simple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir diálogo' })).toHaveFocus();
  });

  it('no se cierra con Escape ni con la X si dismissible es false', () => {
    const onClose = vi.fn();

    render(
      <I18nProvider locale="es">
        <Dialog
          open
          onClose={onClose}
          title="Diálogo bloqueado"
          dismissible={false}
        >
          <p>Contenido bloqueado</p>
        </Dialog>
      </I18nProvider>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Diálogo bloqueado' });
    const close = within(dialog).getAllByRole('button', {
      name: messages.components.dialog.close,
    })[0];

    if (close === undefined) {
      throw new Error('Se esperaba el botón de cerrar.');
    }

    expect(close).toBeDisabled();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();
  });
});

function SelectionHarness({
  onParentClose,
}: {
  readonly onParentClose: () => void;
}) {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);

  return (
    <Dialog
      open={parentOpen}
      onClose={() => {
        onParentClose();
        setParentOpen(false);
      }}
      title="Diálogo padre"
    >
      <button type="button" onClick={() => setChildOpen(true)}>
        Abrir hija
      </button>
      <Dialog
        open={childOpen}
        onClose={() => setChildOpen(false)}
        title="Diálogo hija"
      >
        <button type="button" onClick={() => setChildOpen(false)}>
          Elegir en la hija
        </button>
      </Dialog>
    </Dialog>
  );
}

function SingleDialogHarness({ onClose }: { readonly onClose: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir diálogo
      </button>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Diálogo simple"
      >
        <p>Contenido simple</p>
      </Dialog>
    </>
  );
}
