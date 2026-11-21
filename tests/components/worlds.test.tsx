import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { WorldCard } from '@/renderer/components/worlds/world-card';
import { WorldDuplicateDialog } from '@/renderer/components/worlds/world-duplicate-dialog';
import { WorldFormDialog } from '@/renderer/components/worlds/world-form-dialog';
import { WorldPage } from '@/renderer/pages/world-page';
import { WorldsPage } from '@/renderer/pages/worlds-page';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type {
  WorldActivityEntry,
  WorldDetail,
  WorldSummary,
} from '@/shared/contracts/worlds';

const BASE_TIME = 1_760_000_000_000;

beforeAll(() => {
  // jsdom no implementa el modo modal de <dialog>; se sustituye por una
  // implementación mínima que refleja `open` para que el diálogo se monte.
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

function makeWorld(overrides: Partial<WorldDetail> = {}): WorldDetail {
  return {
    id: '01900000-0000-7000-8000-000000000001',
    name: 'Las Mareas Grises',
    slug: 'las-mareas-grises',
    summary: 'Una historia de mareas y cartógrafos.',
    description: 'Descripción del mundo.',
    genres: ['Fantasía', 'Aventura'],
    language: 'es',
    status: 'active',
    coverAssetId: null,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME + 86_400_000,
    archivedAt: null,
    ...overrides,
  };
}

function makeActivity(
  world: WorldSummary,
  action: WorldActivityEntry['action'],
  id = '01900000-0000-7000-8000-000000000099',
): WorldActivityEntry {
  return {
    id,
    worldId: world.id,
    worldName: world.name,
    action,
    entityType: 'world',
    entityId: world.id,
    createdAt: BASE_TIME + 1_000,
  };
}

const noop = (): void => {};

describe('tarjeta de mundo', () => {
  it('muestra nombre, resumen, géneros y acciones con el nombre del mundo', () => {
    const world = makeWorld();
    const actions = {
      onOpen: vi.fn(),
      onEdit: vi.fn(),
      onDuplicate: vi.fn(),
      onArchiveToggle: vi.fn(),
      onDelete: vi.fn(),
    };

    renderWithI18n(<WorldCard world={world} actions={actions} />);

    expect(
      screen.getByRole('heading', { level: 3, name: world.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(world.summary ?? '')).toBeInTheDocument();
    expect(screen.getByText('Fantasía')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: messages.worlds.card.duplicateNamed(world.name),
      }),
    );
    expect(actions.onDuplicate).toHaveBeenCalledWith(world);
  });

  it('cambia Archivar por Restaurar en un mundo archivado', () => {
    const world = makeWorld({
      name: 'Mundo guardado',
      status: 'archived',
      archivedAt: BASE_TIME,
    });
    const actions = {
      onOpen: noop,
      onEdit: noop,
      onDuplicate: noop,
      onArchiveToggle: vi.fn(),
      onDelete: noop,
    };

    renderWithI18n(<WorldCard world={world} actions={actions} />);

    expect(
      screen.getByRole('button', {
        name: messages.worlds.card.restoreNamed(world.name),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.worlds.status.archived),
    ).toBeInTheDocument();
  });
});

describe('formulario de mundo', () => {
  it('valida el nombre obligatorio y no envía', () => {
    const onSubmit = vi.fn(async () => true);

    renderWithI18n(
      <WorldFormDialog
        open
        mode="create"
        pending={false}
        onClose={noop}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: messages.worlds.form.submitCreate }),
    );

    expect(
      screen.getByText(messages.worlds.form.nameRequired),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía los campos normalizados al crear', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => true);

    renderWithI18n(
      <WorldFormDialog
        open
        mode="create"
        pending={false}
        onClose={noop}
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(messages.worlds.form.nameLabel, { exact: false }),
      'Las Mareas Grises',
    );
    await user.type(
      screen.getByLabelText(messages.worlds.form.summaryLabel),
      'Una historia de mareas',
    );
    await user.type(
      screen.getByLabelText(messages.worlds.form.genresLabel),
      'Fantasía, Aventura',
    );

    fireEvent.click(
      screen.getByRole('button', { name: messages.worlds.form.submitCreate }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Las Mareas Grises',
        slug: undefined,
        summary: 'Una historia de mareas',
        description: null,
        genres: ['Fantasía', 'Aventura'],
        language: 'es',
      });
    });
  });

  it('rechaza más de ocho géneros', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => true);

    renderWithI18n(
      <WorldFormDialog
        open
        mode="create"
        pending={false}
        onClose={noop}
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(messages.worlds.form.nameLabel, { exact: false }),
      'Géneros',
    );
    await user.type(
      screen.getByLabelText(messages.worlds.form.genresLabel),
      'a, b, c, d, e, f, g, h, i',
    );

    fireEvent.click(
      screen.getByRole('button', { name: messages.worlds.form.submitCreate }),
    );

    expect(
      screen.getByText(messages.worlds.form.genresInvalid),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('precarga los datos en modo edición y envía el id', async () => {
    const world = makeWorld();
    const onSubmit = vi.fn(async () => true);

    renderWithI18n(
      <WorldFormDialog
        open
        mode="edit"
        world={world}
        pending={false}
        onClose={noop}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByLabelText(messages.worlds.form.nameLabel, { exact: false }),
    ).toHaveValue(world.name);
    expect(screen.getByLabelText(messages.worlds.form.slugLabel)).toHaveValue(
      world.slug,
    );

    fireEvent.click(
      screen.getByRole('button', { name: messages.worlds.form.submitEdit }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ id: world.id, name: world.name }),
      );
    });
  });
});

describe('diálogo de duplicado', () => {
  it('propone un nombre nuevo y lo envía', async () => {
    const world = makeWorld();
    const onSubmit = vi.fn(async () => true);

    renderWithI18n(
      <WorldDuplicateDialog
        open
        world={world}
        pending={false}
        onClose={noop}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByText(messages.worlds.duplicate.body(world.name)),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(messages.worlds.duplicate.nameLabel, {
        exact: false,
      }),
    ).toHaveValue(messages.worlds.duplicate.defaultName(world.name));

    fireEvent.click(
      screen.getByRole('button', { name: messages.worlds.duplicate.submit }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        messages.worlds.duplicate.defaultName(world.name),
      );
    });
  });
});

describe('página de mundo', () => {
  it('muestra la ficha, el progreso, la actividad y los accesos previstos', () => {
    const world = makeWorld();
    const onOpenEntities = vi.fn();

    renderWithI18n(
      <WorldPage
        world={world}
        state="ready"
        activity={[makeActivity(world, 'world.created')]}
        activityState="ready"
        onBack={noop}
        onRetry={noop}
        onRetryActivity={noop}
        onOpenEntities={onOpenEntities}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: world.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.worlds.detail.progressValue(3, 3)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.worlds.activity.actions.created),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(messages.worlds.detail.quickPlanned),
    ).toHaveLength(3);

    fireEvent.click(
      screen.getByRole('button', { name: messages.entities.list.title }),
    );
    expect(onOpenEntities).toHaveBeenCalled();

    // Las acciones secundarias del mundo viven ahora en el menú «⋯» de la
    // barra superior, que controla `App`; la página no las duplica.
    expect(screen.queryByText(messages.worlds.card.delete)).not.toBeInTheDocument();
  });

  it('muestra el estado de error con reintento y vuelta', () => {
    renderWithI18n(
      <WorldPage
        world={null}
        state="error"
        activity={[]}
        activityState="ready"
        onBack={noop}
        onRetry={noop}
        onRetryActivity={noop}
        onOpenEntities={noop}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      messages.worlds.detail.errorTitle,
    );
  });
});

describe('lista de mundos', () => {
  it('filtra por texto y por estado sin mezclar mundos', async () => {
    const user = userEvent.setup();
    const active = makeWorld();
    const archived = makeWorld({
      id: '01900000-0000-7000-8000-000000000002',
      name: 'Crónica del faro',
      slug: 'cronica-del-faro',
      summary: 'Otra historia',
      status: 'archived',
      archivedAt: BASE_TIME,
    });
    const actions = {
      onOpen: noop,
      onEdit: noop,
      onDuplicate: noop,
      onArchiveToggle: noop,
      onDelete: noop,
    };

    renderWithI18n(
      <WorldsPage
        worlds={[active, archived]}
        state="ready"
        actions={actions}
        onCreate={noop}
        onRetry={noop}
      />,
    );

    expect(screen.getByText('2 mundos')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(messages.worlds.list.searchLabel),
      'faro',
    );

    expect(
      screen.getByRole('heading', { level: 3, name: archived.name }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 3, name: active.name }),
    ).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(messages.worlds.list.searchLabel));
    fireEvent.change(screen.getByLabelText(messages.worlds.list.statusLabel), {
      target: { value: 'archived' },
    });

    expect(
      screen.getByRole('heading', { level: 3, name: archived.name }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 3, name: active.name }),
    ).not.toBeInTheDocument();
  });
});
