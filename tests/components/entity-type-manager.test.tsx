import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { EntityTypeManager } from '@/renderer/components/entities/entity-type-manager';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type { EntityTypeSummary } from '@/shared/contracts/entity-types';

const BASE_TIME = 1_760_000_000_000;

const customType: EntityTypeSummary = {
  id: '01900000-0000-7000-8000-000000000010',
  worldId: '01900000-0000-7000-8000-000000000001',
  key: 'lugar-ritual',
  name: 'Lugar ritual',
  icon: 'book-open',
  color: 'moss',
  isSystem: false,
  fields: [],
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

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

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider locale="es">{ui}</I18nProvider>);
}

function stubRemove(deleted: boolean) {
  const remove = vi.fn(async () => ({ ok: true as const, data: { deleted } }));

  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: { entityTypes: { remove } },
  });

  return remove;
}

describe('gestor de tipos · borrado bloqueado (F1)', () => {
  it('muestra el aviso dentro de la confirmación y no cierra el diálogo', async () => {
    const user = userEvent.setup();
    const remove = stubRemove(false);

    renderWithI18n(
      <EntityTypeManager
        open
        worldId={customType.worldId ?? ''}
        types={[customType]}
        onClose={() => {}}
        onChanged={async () => {}}
        onNotify={() => {}}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.types.removeNamed(customType.name),
      }),
    );

    const confirm = screen.getByRole('group');

    expect(confirm).toHaveTextContent(messages.entities.types.removeBody);

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.types.removeSubmit,
      }),
    );

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({
        worldId: customType.worldId,
        id: customType.id,
      });
    });

    const dialog = within(
      screen.getByRole('dialog', {
        name: messages.entities.types.title,
      }),
    );

    // El aviso pertenece a la confirmación que sigue abierta: no depende del
    // toast global, que queda bajo la top layer del showModal().
    const alert = dialog.getByRole('alert');

    expect(alert).toHaveTextContent(messages.entities.types.removeBlocked);
    expect(
      dialog.queryByRole('button', {
        name: messages.entities.types.removeSubmit,
      }),
    ).not.toBeInTheDocument();
    expect(
      dialog.getByRole('button', { name: messages.entities.types.cancel }),
    ).toBeVisible();

    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
  });

  it('limpia el aviso y cierra la confirmación al cancelar', async () => {
    const user = userEvent.setup();
    const remove = stubRemove(false);

    renderWithI18n(
      <EntityTypeManager
        open
        worldId={customType.worldId ?? ''}
        types={[customType]}
        onClose={() => {}}
        onChanged={async () => {}}
        onNotify={() => {}}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.types.removeNamed(customType.name),
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: messages.entities.types.removeSubmit,
      }),
    );

    await screen.findByRole('alert');

    await user.click(
      screen.getByRole('button', { name: messages.entities.types.cancel }),
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('al cerrar con error y reabrir no conserva confirmación ni aviso', async () => {
    const user = userEvent.setup();
    stubRemove(false);

    const props = {
      worldId: customType.worldId ?? '',
      types: [customType],
      onClose: () => {},
      onChanged: async () => {},
      onNotify: () => {},
    } as const;
    const { rerender } = renderWithI18n(<EntityTypeManager open {...props} />);

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.types.removeNamed(customType.name),
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: messages.entities.types.removeSubmit,
      }),
    );
    await screen.findByRole('alert');

    // Cerrar el diálogo con el pie limpia confirmación y error aunque el
    // componente siga montado en la página.
    await user.click(
      screen
        .getAllByRole('button', {
          name: messages.entities.types.close,
        })
        .at(-1) as HTMLElement,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();

    rerender(
      <I18nProvider locale="es">
        <EntityTypeManager open={false} {...props} />
      </I18nProvider>,
    );
    rerender(
      <I18nProvider locale="es">
        <EntityTypeManager open {...props} />
      </I18nProvider>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();

    // Cambiar de tipo también retira la confirmación pendiente.
    await user.click(
      screen.getByRole('button', {
        name: messages.entities.types.removeNamed(customType.name),
      }),
    );

    expect(screen.getByRole('group')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.types.editNamed(customType.name),
      }),
    );

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
