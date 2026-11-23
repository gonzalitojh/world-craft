import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  Card,
  Checkbox,
  Dialog,
  DisclosureSection,
  EmptyState,
  IconButton,
  Menu,
  Panel,
  Radio,
  RadioGroup,
  Skeleton,
  SkeletonText,
  ToastRegion,
} from '../../src/renderer/components';
import { I18nProvider } from '../../src/renderer/i18n/provider';

function TestIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h12" />
    </svg>
  );
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});

describe('IconButton', () => {
  it('expone el nombre accesible, la variante y el tamaño', () => {
    render(
      <IconButton
        label="Editar ficha"
        icon={<TestIcon />}
        variant="secondary"
        size="sm"
      />,
    );

    const button = screen.getByRole('button', { name: 'Editar ficha' });

    expect(button).toHaveClass(
      'wc-icon-button',
      'wc-icon-button--secondary',
      'wc-icon-button--sm',
    );
    expect(button).toHaveAttribute('type', 'button');
  });

  it('muestra el tooltip con el foco, lo describe y lo oculta con Escape', async () => {
    const user = userEvent.setup();

    render(
      <IconButton
        label="Editar ficha"
        tooltip="Abre la ficha en modo edición."
        icon={<TestIcon />}
      />,
    );

    const button = screen.getByRole('button', { name: 'Editar ficha' });

    await user.tab();

    expect(button).toHaveFocus();

    const tooltip = screen.getByRole('tooltip');

    expect(tooltip).toHaveTextContent('Abre la ficha en modo edición.');
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('anuncia el estado pulsado como conmutador', () => {
    render(<IconButton label="Fijar" pressed icon={<TestIcon />} />);

    expect(screen.getByRole('button', { name: 'Fijar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('en carga se bloquea, anuncia aria-busy y oculta el indicador', () => {
    const { container } = render(
      <IconButton label="Guardando" loading icon={<TestIcon />} />,
    );

    const button = screen.getByRole('button', { name: 'Guardando' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.wc-icon-button__spinner')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});

describe('DisclosureSection', () => {
  function renderDisclosure(
    overrides: Partial<{
      open: boolean;
      onToggle: (open: boolean) => void;
      withActions: boolean;
    }> = {},
  ) {
    const onToggle = overrides.onToggle ?? vi.fn();

    render(
      <DisclosureSection
        id="wc-entity-section-description"
        title="Descripción"
        open={overrides.open ?? true}
        onToggle={onToggle}
        meta="124 palabras"
        actions={
          overrides.withActions === false ? undefined : (
            <button type="button">Editar descripción</button>
          )
        }
      >
        <p>Contenido del documento.</p>
      </DisclosureSection>,
    );

    return { onToggle };
  }

  it('usa section nombrada, h3 > button y acciones fuera del plegado', () => {
    renderDisclosure();

    const region = screen.getByRole('region', { name: /Descripción/ });
    const heading = within(region).getByRole('heading', {
      level: 3,
      name: /Descripción/,
    });
    const toggle = within(heading).getByRole('button', {
      name: /Descripción/,
    });
    const action = within(region).getByRole('button', {
      name: 'Editar descripción',
    });

    expect(region).toHaveAttribute('id', 'wc-entity-section-description');
    expect(region).toHaveAttribute('data-section', 'description');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute(
      'aria-controls',
      'wc-entity-section-description-body',
    );
    expect(action.closest('button')).toBe(action);
    expect(toggle).not.toContainElement(action);
    expect(within(region).getByText('124 palabras')).toBeInTheDocument();
    expect(within(region).getByText('Contenido del documento.')).toBeVisible();
  });

  it('pliega con clic, Enter y espacio sin ocultar el contenido del DOM', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderDisclosure();

    const toggle = screen.getByRole('button', { name: /Descripción/ });

    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);

    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(3);
  });

  it('mantiene el cuerpo montado pero oculto y no accesible al cerrar', () => {
    renderDisclosure({ open: false });

    const toggle = screen.getByRole('button', { name: /Descripción/ });
    const body = document.getElementById('wc-entity-section-description-body');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body).not.toBeNull();
    expect(body).toHaveAttribute('hidden');
    expect(
      screen.getByText('Contenido del documento.', { exact: false }),
    ).not.toBeVisible();
  });

  it('la acción de la cabecera no pliega la sección', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderDisclosure();

    await user.click(
      screen.getByRole('button', { name: 'Editar descripción' }),
    );

    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('Menu', () => {
  function renderMenu(
    overrides: Partial<{
      edit: () => void;
      duplicate: () => void;
      remove: () => void;
      disabled: () => void;
    }> = {},
  ) {
    const handlers = {
      edit: overrides.edit ?? vi.fn(),
      duplicate: overrides.duplicate ?? vi.fn(),
      remove: overrides.remove ?? vi.fn(),
      disabled: overrides.disabled ?? vi.fn(),
    };

    render(
      <Menu
        label="Acciones de la ficha"
        items={[
          {
            id: 'edit',
            label: 'Editar ficha',
            onSelect: handlers.edit,
          },
          {
            id: 'duplicate',
            label: 'Duplicar ficha',
            onSelect: handlers.duplicate,
          },
          {
            id: 'archive',
            label: 'Archivar ficha',
            disabled: true,
            onSelect: handlers.disabled,
          },
          {
            id: 'delete',
            label: 'Mover a la papelera',
            tone: 'danger',
            onSelect: handlers.remove,
          },
        ]}
      />,
    );

    return handlers;
  }

  it('abre con clic, anuncia el estado y enfoca el primer ítem', async () => {
    const user = userEvent.setup();

    renderMenu();

    const trigger = screen.getByRole('button', {
      name: 'Acciones de la ficha',
    });

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Editar ficha' }),
    ).toHaveFocus();
  });

  it('abre con Enter y con Espacio además de con clic', async () => {
    const user = userEvent.setup();

    renderMenu();

    const trigger = screen.getByRole('button', {
      name: 'Acciones de la ficha',
    });

    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();

    await user.keyboard(' ');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('mueve el foco con flechas, Inicio y Fin saltando deshabilitados', async () => {
    const user = userEvent.setup();

    renderMenu();
    await user.click(
      screen.getByRole('button', { name: 'Acciones de la ficha' }),
    );

    await user.keyboard('{ArrowDown}');
    expect(
      screen.getByRole('menuitem', { name: 'Duplicar ficha' }),
    ).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(
      screen.getByRole('menuitem', { name: 'Mover a la papelera' }),
    ).toHaveFocus();

    await user.keyboard('{Home}');
    expect(
      screen.getByRole('menuitem', { name: 'Editar ficha' }),
    ).toHaveFocus();

    await user.keyboard('{End}');
    expect(
      screen.getByRole('menuitem', { name: 'Mover a la papelera' }),
    ).toHaveFocus();
  });

  it('cierra con Escape y devuelve el foco al disparador', async () => {
    const user = userEvent.setup();

    renderMenu();

    const trigger = screen.getByRole('button', {
      name: 'Acciones de la ficha',
    });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('cierra con Tab y con un clic fuera', async () => {
    const user = userEvent.setup();

    renderMenu();

    const trigger = screen.getByRole('button', {
      name: 'Acciones de la ficha',
    });

    await user.click(trigger);
    await user.keyboard('{Tab}');

    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(trigger);
    await user.click(document.body);

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('cierra con PageDown cuando el menú no necesita scroll interno', async () => {
    const user = userEvent.setup();

    renderMenu();

    const trigger = screen.getByRole('button', {
      name: 'Acciones de la ficha',
    });

    await user.click(trigger);
    await user.keyboard('{PageDown}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('devuelve el foco al disparador antes de ejecutar la acción', async () => {
    const user = userEvent.setup();
    const focusedAtSelect: Array<string | null> = [];

    render(
      <Menu
        label="Acciones de la ficha"
        items={[
          {
            id: 'edit',
            label: 'Editar ficha',
            onSelect: () => {
              focusedAtSelect.push(
                document.activeElement?.getAttribute('aria-label') ?? null,
              );
            },
          },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'Acciones de la ficha',
    });

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Editar ficha' }));

    expect(focusedAtSelect).toEqual(['Acciones de la ficha']);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('no ejecuta un ítem deshabilitado ni usa su acción destructiva para el resto', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu();

    await user.click(
      screen.getByRole('button', { name: 'Acciones de la ficha' }),
    );

    const disabled = screen.getByRole('menuitem', { name: 'Archivar ficha' });

    expect(disabled).toBeDisabled();

    await user.click(disabled);

    expect(handlers.disabled).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('menuitem', { name: 'Mover a la papelera' }),
    );

    expect(handlers.remove).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Checkbox', () => {
  it('asocia etiqueta, ayuda y error y conmuta con ratón y teclado', async () => {
    const user = userEvent.setup();

    render(
      <Checkbox
        label="Mostrar la ficha en el mapa"
        hint="La marca usa el color del tipo."
        error="Debes aceptar los pactos antes de publicar."
      />,
    );

    const checkbox = screen.getByRole('checkbox', {
      name: 'Mostrar la ficha en el mapa',
    });
    const describedBy = checkbox
      .getAttribute('aria-describedby')
      ?.split(' ')
      ?.map((id) => document.getElementById(id)?.textContent);

    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(describedBy).toEqual([
      'La marca usa el color del tipo.',
      'Debes aceptar los pactos antes de publicar.',
    ]);

    await user.click(screen.getByText('Mostrar la ficha en el mapa'));
    expect(checkbox).toBeChecked();

    checkbox.focus();
    await user.keyboard(' ');
    expect(checkbox).not.toBeChecked();
  });

  it('respeta el estado deshabilitado', () => {
    render(<Checkbox label="No disponible" disabled />);

    expect(
      screen.getByRole('checkbox', { name: 'No disponible' }),
    ).toBeDisabled();
  });
});

describe('RadioGroup y Radio', () => {
  it('usa fieldset y legend, comparte nombre y asocia el error al grupo', () => {
    render(
      <RadioGroup
        legend="Tono de la crónica"
        hint="Ajusta el ejemplo de escritura."
        error="Elige un tono para la crónica."
      >
        <Radio label="Épico" value="epic" />
        <Radio label="Íntimo" value="intimate" />
      </RadioGroup>,
    );

    const group = screen.getByRole('group', { name: 'Tono de la crónica' });

    expect(group.tagName).toBe('FIELDSET');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-describedby');

    const radios = screen.getAllByRole('radio');

    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAttribute(
      'name',
      radios[1]?.getAttribute('name') ?? '',
    );
    expect(radios[0]?.getAttribute('name')).toBeTruthy();
  });

  it('selecciona una opción con ratón y teclado', async () => {
    const user = userEvent.setup();

    render(
      <RadioGroup legend="Tono de la crónica">
        <Radio label="Épico" value="epic" />
        <Radio label="Íntimo" value="intimate" />
      </RadioGroup>,
    );

    const epic = screen.getByRole('radio', { name: 'Épico' });
    const intimate = screen.getByRole('radio', { name: 'Íntimo' });

    await user.click(intimate);
    expect(intimate).toBeChecked();
    expect(epic).not.toBeChecked();

    epic.focus();
    await user.keyboard(' ');
    expect(epic).toBeChecked();
  });
});

describe('Panel', () => {
  it('usa una sección etiquetada con encabezado real, acciones y pie', () => {
    render(
      <Panel
        title="Propiedades de la ficha"
        description="Datos que acompañan al documento."
        headingLevel={3}
        actions={<button type="button">Acción</button>}
        footer={<span>Pie del panel</span>}
      >
        <p>Contenido del panel.</p>
      </Panel>,
    );

    const region = screen.getByRole('region', {
      name: 'Propiedades de la ficha',
    });

    expect(
      within(region).getByRole('heading', {
        level: 3,
        name: 'Propiedades de la ficha',
      }),
    ).toBeInTheDocument();
    expect(
      within(region).getByText('Datos que acompañan al documento.'),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole('button', { name: 'Acción' }),
    ).toBeInTheDocument();
    expect(within(region).getByText('Pie del panel')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('es decorativo y SkeletonText respeta el número de líneas', () => {
    const { container } = render(
      <>
        <Skeleton />
        <Skeleton variant="circle" />
        <SkeletonText lines={4} />
      </>,
    );

    const blocks = container.querySelectorAll('.wc-skeleton');

    expect(blocks).toHaveLength(6);

    for (const block of blocks) {
      expect(block).toHaveAttribute('aria-hidden', 'true');
    }

    expect(container.querySelector('.wc-skeleton--circle')).not.toBeNull();
    expect(container.querySelector('.wc-skeleton--last')).not.toBeNull();
  });
});

describe('Card', () => {
  it('usa el título como encabezado configurable y renderiza sus acciones', () => {
    render(
      <Card
        title="Ficha de ejemplo"
        headingLevel={3}
        actions={<button type="button">Más acciones</button>}
      >
        <p>Contenido largo que debe seguir en el árbol accesible.</p>
      </Card>,
    );

    const article = screen.getByRole('article', { name: 'Ficha de ejemplo' });

    expect(
      within(article).getByRole('heading', {
        level: 3,
        name: 'Ficha de ejemplo',
      }),
    ).toBeInTheDocument();
    expect(
      within(article).getByRole('button', { name: 'Más acciones' }),
    ).toBeInTheDocument();
    expect(
      within(article).getByText(
        'Contenido largo que debe seguir en el árbol accesible.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  it('se etiqueta con su título, cierra con el botón y devuelve el foco', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const renderDialog = (open: boolean) => (
      <I18nProvider locale="es">
        <button type="button">Origen</button>
        <Dialog open={open} onClose={onClose} title="Mover a la papelera">
          <p>La ficha se puede restaurar.</p>
        </Dialog>
      </I18nProvider>
    );

    const { rerender } = render(renderDialog(false));

    const origin = screen.getByRole('button', { name: 'Origen' });

    origin.focus();
    expect(origin).toHaveFocus();

    rerender(renderDialog(true));

    const dialog = screen.getByRole('dialog', {
      name: 'Mover a la papelera',
    });

    expect(dialog).toHaveAttribute('open');
    expect(
      within(dialog).getByRole('heading', { name: 'Mover a la papelera' }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledOnce();

    rerender(renderDialog(false));

    expect(origin).toHaveFocus();
  });

  it('bloquea Escape y el botón de cierre cuando no es descartable', () => {
    const onClose = vi.fn();

    render(
      <I18nProvider locale="es">
        <Dialog
          open
          onClose={onClose}
          title="Guardando la relación"
          dismissible={false}
        >
          <p>Espera a que termine la petición.</p>
        </Dialog>
      </I18nProvider>,
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Guardando la relación',
    });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(
      within(dialog).getByRole('button', { name: 'Cerrar' }),
    ).toBeDisabled();
  });
});

describe('EmptyState', () => {
  it('admite un encabezado de nivel 4 dentro de una sección h3', () => {
    render(
      <EmptyState
        headingLevel={4}
        title="Todavía no hay relaciones"
        description="Añade una relación desde la cabecera de la sección."
      />,
    );

    const region = screen.getByRole('region', {
      name: 'Todavía no hay relaciones',
    });

    expect(
      within(region).getByRole('heading', {
        level: 4,
        name: 'Todavía no hay relaciones',
      }),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        'Añade una relación desde la cabecera de la sección.',
      ),
    ).toBeInTheDocument();
  });
});

describe('ToastRegion', () => {
  it('anuncia el tono en texto oculto y permite cerrar a mano', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <I18nProvider locale="es">
        <ToastRegion
          toasts={[
            {
              id: 'toast-1',
              tone: 'success',
              message: 'Copia de seguridad creada.',
            },
          ]}
          onDismiss={onDismiss}
        />
      </I18nProvider>,
    );

    const region = screen.getByRole('status');

    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Éxito');
    expect(region).toHaveTextContent('Copia de seguridad creada.');

    await user.click(
      within(region).getByRole('button', { name: /^Cerrar aviso/ }),
    );

    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });
});
