import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactElement } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorldCard } from '@/renderer/components/worlds/world-card';
import { WorldDuplicateDialog } from '@/renderer/components/worlds/world-duplicate-dialog';
import { WorldFormDialog } from '@/renderer/components/worlds/world-form-dialog';
import { WorldPage } from '@/renderer/pages/world-page';
import { WorldsPage } from '@/renderer/pages/worlds-page';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type { EntitySummary } from '@/shared/contracts/entities';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';
import { plainTextToRichTextDocument } from '@/shared/entities/description';
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
    description: plainTextToRichTextDocument('Descripción del mundo.'),
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

const baseActions = {
  onOpen: noop,
  onEdit: noop,
  onDuplicate: noop,
  onArchiveToggle: noop,
  onDelete: noop,
};

describe('tarjeta de mundo', () => {
  it('muestra una sola acción de apertura y guarda el resto en el menú', async () => {
    const user = userEvent.setup();
    const world = makeWorld();
    const actions = {
      onOpen: vi.fn(),
      onEdit: vi.fn(),
      onDuplicate: vi.fn(),
      onArchiveToggle: vi.fn(),
      onDelete: vi.fn(),
    };

    renderWithI18n(
      <WorldCard world={world} actions={actions} now={BASE_TIME} />,
    );

    expect(
      screen.getByRole('heading', { level: 3, name: world.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(world.summary ?? '')).toBeInTheDocument();
    expect(screen.getByText('Fantasía')).toBeInTheDocument();

    // Una única acción visible de apertura más el disparador del menú.
    const open = screen.getByRole('button', {
      name: messages.worlds.card.openNamed(world.name),
    });
    expect(open).toHaveTextContent(messages.worlds.card.open);
    expect(
      screen.getByRole('button', {
        name: messages.worlds.card.actionsNamed(world.name),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: messages.worlds.card.delete }),
    ).not.toBeInTheDocument();

    fireEvent.click(open);
    expect(actions.onOpen).toHaveBeenCalledWith(world);

    await user.click(
      screen.getByRole('button', {
        name: messages.worlds.card.actionsNamed(world.name),
      }),
    );

    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual([
      messages.worlds.card.edit,
      messages.worlds.card.duplicate,
      messages.worlds.card.archive,
      messages.worlds.card.delete,
    ]);

    await user.click(
      screen.getByRole('menuitem', { name: messages.worlds.card.duplicate }),
    );
    expect(actions.onDuplicate).toHaveBeenCalledWith(world);
  });

  it('recorre el menú con teclado y devuelve el foco al cerrar', async () => {
    const user = userEvent.setup();
    const world = makeWorld();
    const actions = {
      onOpen: noop,
      onEdit: vi.fn(),
      onDuplicate: noop,
      onArchiveToggle: noop,
      onDelete: noop,
    };

    renderWithI18n(<WorldCard world={world} actions={actions} />);

    const trigger = screen.getByRole('button', {
      name: messages.worlds.card.actionsNamed(world.name),
    });

    trigger.focus();
    await user.keyboard('{ArrowDown}');

    expect(
      screen.getByRole('menuitem', { name: messages.worlds.card.edit }),
    ).toHaveFocus();

    await user.keyboard('{End}');
    expect(
      screen.getByRole('menuitem', { name: messages.worlds.card.delete }),
    ).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('cambia Archivar por Restaurar en un mundo archivado', async () => {
    const user = userEvent.setup();
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
      screen.getByText(messages.worlds.status.archived),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: messages.worlds.card.actionsNamed(world.name),
      }),
    );

    await user.click(
      screen.getByRole('menuitem', { name: messages.worlds.card.restore }),
    );

    expect(actions.onArchiveToggle).toHaveBeenCalledWith(world);
  });

  it('dibuja una marca procedural determinista cuando no hay portada', () => {
    const world = makeWorld({ coverAssetId: null });

    renderWithI18n(<WorldCard world={world} actions={baseActions} />);

    const mark = document.querySelector('.wc-world-mark');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveAttribute('data-motif');
    expect(mark).toHaveAttribute('data-tone');

    // Nunca la inicial gigante como sustituto de portada.
    expect(mark?.textContent).toBe('');
  });

  it('usa la miniatura de la portada cuando existe', () => {
    const world = makeWorld({ coverAssetId: 'asset-1' });

    renderWithI18n(<WorldCard world={world} actions={baseActions} />);

    const image = document.querySelector('.wc-world-mark__image');
    expect(image).toHaveAttribute('alt', '');
    expect(image?.getAttribute('src')).toContain('wc-asset://thumb/asset-1');
  });

  it('pinta la fecha relativa en un time con fecha completa accesible', () => {
    const world = makeWorld();
    const now = world.updatedAt + 5 * 60_000;

    renderWithI18n(<WorldCard world={world} actions={baseActions} now={now} />);

    const time = screen.getByText(
      messages.worlds.card.relativeUpdated('hace 5 minutos'),
    );

    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute(
      'dateTime',
      new Date(world.updatedAt).toISOString(),
    );
    expect(time).toHaveAttribute('title');
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
  const listEntities = vi.fn();

  function makeEntityList(count: number): readonly EntitySummary[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `entity-${index}`,
    })) as unknown as readonly EntitySummary[];
  }

  beforeEach(() => {
    listEntities.mockReset();
    listEntities.mockResolvedValue({ ok: true, data: [] });
    Object.defineProperty(window, 'worldCraft', {
      configurable: true,
      value: {
        entities: { list: listEntities },
      } as unknown as WorldCraftApi,
    });
  });

  function renderPage(
    overrides: Partial<ComponentProps<typeof WorldPage>> = {},
  ) {
    const world = makeWorld();

    return renderWithI18n(
      <WorldPage
        world={world}
        state="ready"
        activity={[makeActivity(world, 'world.created')]}
        activityState="ready"
        onBack={noop}
        onRetry={noop}
        onRetryActivity={noop}
        onOpenEntities={noop}
        {...overrides}
      />,
    );
  }

  it('organiza el mundo en módulos y solo Fichas navega', () => {
    const onOpenEntities = vi.fn();

    renderPage({ onOpenEntities });

    const modules = messages.worlds.detail.modules;
    const nav = screen.getByRole('navigation', { name: modules.label });

    // «Resumen» es la sección actual: enfocable, señalada y sin acción.
    expect(
      within(nav).getByRole('button', { name: modules.summary }),
    ).toHaveAttribute('aria-current', 'page');

    // «Fichas» es el único módulo implementado y conserva su recuento.
    const entities = within(nav).getByRole('button', {
      name: new RegExp(`^${modules.entities}`),
    });

    fireEvent.click(entities);
    expect(onOpenEntities).toHaveBeenCalledTimes(1);

    // Los previstos son texto estático con insignia, no botones.
    for (const label of [modules.maps, modules.manuscript, modules.graph]) {
      expect(within(nav).queryByRole('button', { name: label })).toBeNull();
    }

    expect(within(nav).getAllByText(modules.planned)).toHaveLength(3);
    expect(screen.getByText(modules.plannedNote)).toBeInTheDocument();
  });

  it('no repite el nombre ni las acciones de la barra superior', () => {
    const world = makeWorld();

    renderPage({ world });

    // El único título con el nombre es el h1 de la barra, fuera de la página.
    expect(
      screen.queryByRole('heading', { level: 2, name: world.name }),
    ).toBeNull();

    // Las acciones secundarias viven en el menú «⋯» de la barra superior.
    for (const action of [
      messages.worlds.card.edit,
      messages.worlds.card.duplicate,
      messages.worlds.card.archive,
      messages.worlds.card.delete,
    ]) {
      expect(screen.queryByRole('button', { name: action })).toBeNull();
    }

    // Marca decorativa procedural en lugar de la inicial gigante.
    const mark = document.querySelector('.wc-world-header .wc-world-mark');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveAttribute('data-motif');
    expect(mark).toHaveAttribute('data-tone');
    expect(mark?.textContent).toBe('');
    expect(document.querySelector('.wc-world-hero__initial')).toBeNull();
  });

  it('jerarquiza Resumen, Preparación y Actividad', () => {
    const world = makeWorld();

    renderPage({ world });

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.worlds.detail.summaryTitle,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.worlds.detail.progressTitle,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.worlds.detail.activityTitle,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: messages.worlds.detail.metadataTitle,
      }),
    ).toBeVisible();

    // Descripción y datos del mundo.
    expect(
      screen.getByText('Descripción del mundo.'),
    ).toBeInTheDocument();
    expect(screen.getByText(world.slug)).toBeInTheDocument();
    expect(screen.getAllByRole('term')).toHaveLength(4);
    expect(screen.getAllByRole('definition')).toHaveLength(4);

    // El progreso conserva su semántica y el mundo de prueba está completo.
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    expect(
      screen.getByText(messages.worlds.detail.progressValue(3, 3)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.worlds.activity.actions.created),
    ).toBeInTheDocument();
  });

  it('muestra el recuento de fichas cuando la lectura termina bien', async () => {
    listEntities.mockResolvedValue({ ok: true, data: makeEntityList(2) });

    renderPage();

    expect(
      await screen.findByText(messages.entities.list.count(2)),
    ).toBeInTheDocument();
    expect(listEntities).toHaveBeenCalledWith({
      worldId: expect.any(String),
      filter: { limit: 200 },
    });
  });

  it('avisa del tope del recuento sin inventar un total', async () => {
    listEntities.mockResolvedValue({ ok: true, data: makeEntityList(200) });

    renderPage();

    expect(
      await screen.findByText(messages.entities.list.countAtLeast(200)),
    ).toBeInTheDocument();
  });

  it('omite el recuento si la lectura falla y deja la página usable', async () => {
    listEntities.mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });

    renderPage();

    await waitFor(() => {
      expect(listEntities).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/fichas?$/)).toBeNull();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.worlds.detail.summaryTitle,
      }),
    ).toBeVisible();
  });

  it('sigue montando la página si el puente de fichas no existe', async () => {
    Object.defineProperty(window, 'worldCraft', {
      configurable: true,
      value: undefined,
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: messages.worlds.detail.summaryTitle,
        }),
      ).toBeVisible();
    });
    expect(screen.queryByText(/fichas?$/)).toBeNull();
  });

  it('muestra el estado de carga sin cabecera ni navegación', () => {
    renderPage({ world: null, state: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent(
      messages.worlds.detail.loading,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('muestra el estado de error con reintento y vuelta', () => {
    renderPage({ world: null, state: 'error' });

    const alert = screen.getByRole('alert');

    expect(alert).toHaveTextContent(messages.worlds.detail.errorTitle);
    expect(
      screen.getByRole('button', { name: messages.worlds.dashboard.retry }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.worlds.detail.errorBack }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('formatea el recuento de palabras con Intl y anuncia su etiqueta', () => {
    const words = Array.from({ length: 1_000 }, () => 'palabra').join(' ');
    const world = makeWorld({
      description: plainTextToRichTextDocument(words),
    });

    renderPage({ world });

    expect(screen.getByText('1.000 palabras')).toBeInTheDocument();
    expect(
      screen.getByText(messages.worlds.detail.descriptionWordsLabel),
    ).toHaveClass('wc-visually-hidden');
  });

  it('pinta contenido largo sin truncar la descripción ni los géneros', () => {
    const description = 'Crónica de mareas y cartógrafos. '
      .repeat(122)
      .slice(0, 4000);
    const genres = Array.from(
      { length: 8 },
      (_, index) => `Género ${index + 1} de nombre largo`,
    );
    const world = makeWorld({
      description: plainTextToRichTextDocument(description),
      genres,
    });

    expect(description).toHaveLength(4000);

    renderPage({ world });

    expect(screen.getByText(description)).toBeInTheDocument();

    const genreList = screen.getByRole('list', {
      name: messages.worlds.form.genresLabel,
    });
    expect(within(genreList).getAllByRole('listitem')).toHaveLength(8);
  });

  it('señala el resumen y la descripción ausentes sin ocultar los nodos', () => {
    const world = makeWorld({ summary: null, description: null });

    renderPage({ world });

    expect(screen.getByText(messages.worlds.detail.noSummary)).toHaveClass(
      'wc-world-header__summary--empty',
    );
    expect(screen.getByText(messages.worlds.detail.noDescription)).toHaveClass(
      'wc-world-description--empty',
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
