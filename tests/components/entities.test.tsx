import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { EntityCard } from '@/renderer/components/entities/entity-card';
import { EntityCreateDialog } from '@/renderer/components/entities/entity-create-dialog';
import { EntityQuickCreateDialog } from '@/renderer/components/entities/entity-quick-create-dialog';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type { EntitySummary } from '@/shared/contracts/entities';
import type { EntityTypeSummary } from '@/shared/contracts/entity-types';
import type { WorldSummary } from '@/shared/contracts/worlds';

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
