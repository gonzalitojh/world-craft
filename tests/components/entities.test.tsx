import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { EntityCard } from '@/renderer/components/entities/entity-card';
import { EntityCreateDialog } from '@/renderer/components/entities/entity-create-dialog';
import { EntityQuickCreateDialog } from '@/renderer/components/entities/entity-quick-create-dialog';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import { EntitiesPage } from '@/renderer/pages/entities-page';
import type { EntitySummary } from '@/shared/contracts/entities';
import type { EntityTypeSummary } from '@/shared/contracts/entity-types';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';
import type { WorldDetail, WorldSummary } from '@/shared/contracts/worlds';

const BASE_TIME = 1_760_000_000_000;

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

const world: WorldSummary = {
  id: '01900000-0000-7000-8000-000000000001',
  name: 'Las Mareas Grises',
  slug: 'las-mareas-grises',
  summary: null,
  genres: [],
  language: 'es',
  status: 'active',
  coverAssetId: null,
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
  archivedAt: null,
};

const type: EntityTypeSummary = {
  id: '01900000-0000-7000-8000-000000000002',
  worldId: null,
  key: 'character',
  name: 'Personaje',
  icon: 'user-round',
  color: 'moss',
  isSystem: true,
  fields: [],
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const entity: EntitySummary = {
  id: '01900000-0000-7000-8000-000000000003',
  worldId: world.id,
  typeId: type.id,
  typeKey: type.key,
  typeName: type.name,
  typeIcon: type.icon,
  typeColor: type.color,
  name: 'Mara Viento',
  slug: 'mara-viento',
  aliases: ['La Cartógrafa'],
  summary: 'Exploradora de las mareas.',
  imageAssetId: null,
  isFavorite: true,
  status: 'active',
  tags: [
    {
      id: '01900000-0000-7000-8000-000000000004',
      worldId: world.id,
      name: 'Norte',
      color: 'ochre',
      createdAt: BASE_TIME,
    },
  ],
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

describe('tarjeta de ficha', () => {
  it('muestra nombre, tipo, resumen, etiqueta y favorito', () => {
    const onOpen = vi.fn();
    const onToggleFavorite = vi.fn();

    renderWithI18n(
      <EntityCard
        entity={entity}
        onOpen={onOpen}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    expect(screen.getByText('Mara Viento')).toBeInTheDocument();
    expect(screen.getByText('Personaje')).toBeInTheDocument();
    expect(screen.getByText('Exploradora de las mareas.')).toBeInTheDocument();
    expect(screen.getByText('Norte')).toBeInTheDocument();

    const favorite = screen.getByRole('button', {
      name: messages.entities.card.unfavoriteNamed('Mara Viento'),
    });
    expect(favorite).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Abrir la ficha/ }));
    expect(onOpen).toHaveBeenCalledWith(entity);

    fireEvent.click(favorite);
    expect(onToggleFavorite).toHaveBeenCalledWith(entity);
  });
});

describe('diálogo de creación de ficha', () => {
  it('envía tipo, nombre y resumen y exige un nombre', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => true);

    renderWithI18n(
      <EntityCreateDialog
        open
        worldId={world.id}
        types={[type]}
        pending={false}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: messages.entities.create.submit }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(messages.components.form.requiredField),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Nombre/), 'Mara Viento');
    await user.type(
      screen.getByLabelText(messages.entities.create.summaryLabel),
      'Exploradora',
    );
    await user.click(
      screen.getByRole('button', { name: messages.entities.create.submit }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        worldId: world.id,
        typeId: type.id,
        name: 'Mara Viento',
        summary: 'Exploradora',
      });
    });
  });
});

describe('página de fichas', () => {
  const worldDetail: WorldDetail = {
    ...world,
    description: null,
  };

  function renderPage() {
    Object.defineProperty(window, 'worldCraft', {
      configurable: true,
      value: {
        entities: { list: async () => ({ ok: true, data: [] }) },
        entityTypes: { list: async () => ({ ok: true, data: [type] }) },
        tags: { list: async () => ({ ok: true, data: [] }) },
      } satisfies Partial<WorldCraftApi>,
    });

    return renderWithI18n(
      <EntitiesPage
        world={worldDetail}
        onBack={() => {}}
        onOpenEntity={() => {}}
        onNotify={() => {}}
      />,
    );
  }

  it('sin filtros deja una sola primaria, la del estado vacío', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    // Se espera al estado vacío: antes de pintarse, la cabecera aún muestra su
    // botón y la prueba de una sola primaria sería vacía.
    await screen.findByRole('heading', {
      level: 2,
      name: messages.entities.list.emptyTitle,
    });

    const header = container.querySelector<HTMLElement>('.wc-page__header');
    const empty = container.querySelector<HTMLElement>('.wc-empty');

    expect(header).not.toBeNull();
    expect(empty).not.toBeNull();
    expect(
      container.querySelectorAll(
        '.wc-page__header .wc-button--primary, .wc-empty .wc-button--primary',
      ),
    ).toHaveLength(1);
    expect(
      header?.querySelectorAll('.wc-button--primary') ?? [],
    ).toHaveLength(0);
    expect(
      empty?.querySelectorAll('.wc-button--primary') ?? [],
    ).toHaveLength(1);
    expect(empty?.textContent).toContain(messages.entities.list.create);

    // El menú de la cabecera sigue disponible.
    await user.click(
      screen.getByRole('button', { name: messages.entities.list.menuLabel }),
    );

    expect(
      screen.getByRole('menuitem', {
        name: messages.entities.list.manageTypes,
      }),
    ).toBeInTheDocument();
  });

  it('con filtros activos conserva la primaria en la cabecera y el vacío usa secundaria', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.type(
      screen.getByLabelText(messages.entities.list.searchLabel),
      'zzz',
    );

    await screen.findByRole('heading', {
      level: 2,
      name: messages.entities.list.emptyFilterTitle,
    });

    const header = container.querySelector<HTMLElement>('.wc-page__header');
    const empty = container.querySelector<HTMLElement>('.wc-empty');

    expect(header).not.toBeNull();
    expect(empty).not.toBeNull();
    expect(
      header?.querySelectorAll('.wc-button--primary') ?? [],
    ).toHaveLength(1);
    expect(header?.textContent).toContain(messages.entities.list.create);
    expect(
      empty?.querySelectorAll('.wc-button--primary') ?? [],
    ).toHaveLength(0);

    const clear = empty?.querySelector<HTMLButtonElement>('.wc-button--secondary');

    expect(clear).toHaveTextContent(messages.entities.list.clearFilters);
  });
});

describe('creación rápida de ficha', () => {
  it('elige mundo y tipo y envía el nombre', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => true);
    const onWorldChange = vi.fn();

    renderWithI18n(
      <EntityQuickCreateDialog
        open
        worlds={[world]}
        defaultWorldId={world.id}
        pending={false}
        types={[type]}
        typesLoading={false}
        onWorldChange={onWorldChange}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/Nombre/), 'Mara');
    await user.click(
      screen.getByRole('button', { name: messages.entities.quick.submit }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        worldId: world.id,
        typeId: type.id,
        name: 'Mara',
      });
    });
  });
});
