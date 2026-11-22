import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { EntityRelationDialog } from '@/renderer/components/entities/entity-relation-dialog';
import { EntityRelationsPanel } from '@/renderer/components/entities/entity-relations-panel';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type { EntitySummary } from '@/shared/contracts/entities';
import type { RelationEdge, RelationType } from '@/shared/contracts/relations';

const BASE_TIME = 1_760_000_000_000;
const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const MARA_ID = '01900000-0000-7000-8000-000000000002';
const PUERTO_ID = '01900000-0000-7000-8000-000000000003';
const TYPE_ID = '018f0000-0000-7000-8000-000000000109';
const RELATION_ID = '01900000-0000-7000-8000-000000000004';

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

const type: RelationType = {
  id: TYPE_ID,
  worldId: null,
  key: 'located-in',
  name: 'Ubicado en',
  inverseName: 'Contiene',
  color: 'prussian',
  isSystem: true,
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const mara: EntitySummary = {
  id: MARA_ID,
  worldId: WORLD_ID,
  typeId: '01900000-0000-7000-8000-000000000005',
  typeKey: 'character',
  typeName: 'Personaje',
  typeIcon: 'user-round',
  typeColor: 'moss',
  name: 'Mara Viento',
  slug: 'mara-viento',
  aliases: [],
  summary: null,
  imageAssetId: null,
  isFavorite: false,
  status: 'active',
  tags: [],
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const puerto: EntitySummary = {
  ...mara,
  id: PUERTO_ID,
  typeKey: 'city',
  typeName: 'Ciudad',
  typeIcon: 'building-2',
  typeColor: 'ochre',
  name: 'Puerto Sal',
  slug: 'puerto-sal',
};

const edge: RelationEdge = {
  id: RELATION_ID,
  worldId: WORLD_ID,
  typeId: TYPE_ID,
  typeKey: type.key,
  typeName: type.name,
  typeInverseName: type.inverseName,
  typeColor: type.color,
  isSystemType: true,
  label: null,
  inverseLabel: null,
  notes: 'Vive aquí desde niña.',
  strength: 4,
  metadata: {},
  source: {
    id: MARA_ID,
    name: 'Mara Viento',
    typeKey: 'character',
    typeName: 'Personaje',
    typeIcon: 'user-round',
    typeColor: 'moss',
  },
  target: {
    id: PUERTO_ID,
    name: 'Puerto Sal',
    typeKey: 'city',
    typeName: 'Ciudad',
    typeIcon: 'building-2',
    typeColor: 'ochre',
  },
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

function renderPanel(
  overrides: Partial<Parameters<typeof EntityRelationsPanel>[0]> = {},
) {
  const props = {
    entityId: MARA_ID,
    relations: [edge],
    state: 'ready' as const,
    pending: false,
    onEdit: vi.fn(),
    onRemove: vi.fn(async () => true),
    onOpenEntity: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };

  return { ...renderWithI18n(<EntityRelationsPanel {...props} />), props };
}

describe('panel de relaciones', () => {
  it('muestra la etiqueta directa, la inversa y permite navegar', async () => {
    const user = userEvent.setup();
    const { props, unmount } = renderPanel();

    expect(screen.getByText('Ubicado en')).toBeInTheDocument();
    expect(screen.getByText('Vive aquí desde niña.')).toBeInTheDocument();
    expect(
      screen.getByText(messages.entities.relations.outgoingTitle),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Puerto Sal' }));
    expect(props.onOpenEntity).toHaveBeenCalledWith(PUERTO_ID);

    unmount();

    renderPanel({ entityId: PUERTO_ID });
    expect(screen.getAllByText('Contiene').length).toBeGreaterThan(0);
    expect(
      screen.getByText(messages.entities.relations.incomingTitle),
    ).toBeInTheDocument();
  });

  it('mantiene el guía y los estados dentro del contenedor de relaciones', async () => {
    const user = userEvent.setup();
    const { container, props } = renderPanel({
      relations: [],
      state: 'error',
    });

    const root = container.querySelector('.wc-relations');

    expect(root).not.toBeNull();
    expect(root?.children[0]).toHaveClass('wc-page__section-lead');
    expect(root?.children[1]).toHaveClass('wc-alert');
    expect(root?.querySelector('.wc-page__section')).toBeNull();
    expect(screen.getByText(messages.entities.relations.lead)).toBeVisible();
    expect(
      screen.getByText(messages.entities.relations.loadError),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: messages.entities.relations.retry }),
    );
    expect(props.onRetry).toHaveBeenCalled();
  });

  it('abre la edición y elimina con confirmación explícita', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.relations.editNamed('Ubicado en', 'Puerto Sal'),
      }),
    );
    expect(props.onEdit).toHaveBeenCalledWith(edge);

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.relations.removeNamed(
          'Ubicado en',
          'Puerto Sal',
        ),
      }),
    );
    expect(
      screen.getByText(
        messages.entities.relations.removeTitle('Ubicado en', 'Puerto Sal'),
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.relations.removeSubmit,
      }),
    );
    await waitFor(() => expect(props.onRemove).toHaveBeenCalledWith(edge));
  });
});

describe('diálogo de relación', () => {
  it('crea una relación con el destino, la fuerza y las etiquetas', async () => {
    const onSubmit = vi.fn(async () => true);

    renderWithI18n(
      <EntityRelationDialog
        open
        mode="create"
        worldId={WORLD_ID}
        entityId={MARA_ID}
        relation={null}
        types={[type]}
        candidates={[puerto]}
        pending={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByText(messages.entities.relations.createTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.entities.relations.typeHint('Ubicado en', 'Contiene'),
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Ficha de destino/), {
      target: { value: PUERTO_ID },
    });
    fireEvent.change(
      screen.getByLabelText(messages.entities.relations.labelLabel),
      { target: { value: 'Reside en' } },
    );
    fireEvent.change(
      screen.getByLabelText(messages.entities.relations.strengthLabel),
      { target: { value: '5' } },
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: messages.entities.relations.submitCreate,
      }),
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        worldId: WORLD_ID,
        sourceId: MARA_ID,
        targetId: PUERTO_ID,
        typeId: TYPE_ID,
        label: 'Reside en',
        inverseLabel: null,
        notes: null,
        strength: 5,
      }),
    );
  });
});
