import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
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
const ALTAR_ID = '01900000-0000-7000-8000-000000000004';
const TYPE_ID = '018f0000-0000-7000-8000-000000000109';
const MENTOR_TYPE_ID = '018f0000-0000-7000-8000-000000000110';
const RELATION_ID = '01900000-0000-7000-8000-000000000005';
const BACKLINK_ID = '01900000-0000-7000-8000-000000000006';
const MENTOR_RELATION_ID = '01900000-0000-7000-8000-000000000007';

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

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider locale="es">{ui}</I18nProvider>);
}

const locatedType: RelationType = {
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

const mentorType: RelationType = {
  id: MENTOR_TYPE_ID,
  worldId: null,
  key: 'related-with',
  name: 'Relacionado con',
  inverseName: 'Relacionado con',
  color: 'moss',
  isSystem: true,
  createdAt: BASE_TIME,
  updatedAt: BASE_TIME,
};

const mara: EntitySummary = {
  id: MARA_ID,
  worldId: WORLD_ID,
  typeId: '01900000-0000-7000-8000-000000000008',
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
  typeKey: locatedType.key,
  typeName: locatedType.name,
  typeInverseName: locatedType.inverseName,
  typeColor: locatedType.color,
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

const backlink: RelationEdge = {
  ...edge,
  id: BACKLINK_ID,
  notes: null,
  source: {
    id: ALTAR_ID,
    name: 'Altar de sal',
    typeKey: 'place',
    typeName: 'Lugar',
    typeIcon: 'map-pin',
    typeColor: 'danger',
  },
  target: {
    id: MARA_ID,
    name: 'Mara Viento',
    typeKey: 'character',
    typeName: 'Personaje',
    typeIcon: 'user-round',
    typeColor: 'moss',
  },
};

const mentorEdge: RelationEdge = {
  ...edge,
  id: MENTOR_RELATION_ID,
  typeId: MENTOR_TYPE_ID,
  typeKey: mentorType.key,
  typeName: mentorType.name,
  typeInverseName: mentorType.inverseName,
  typeColor: mentorType.color,
  label: 'Aliada desde la infancia',
  inverseLabel: 'Aliada de',
  notes: null,
};

const DEFAULT_PROPS = {
  entityId: MARA_ID,
  relations: [edge] as readonly RelationEdge[],
  state: 'ready' as const,
  pending: false,
  editingRelationId: null as string | null,
  onEdit: () => undefined,
  onRemove: async () => true,
  onOpenEntity: () => undefined,
  onRetry: () => undefined,
};

function renderPanel(
  overrides: Partial<typeof DEFAULT_PROPS> = {},
  extra?: ReactElement,
) {
  const props = {
    ...DEFAULT_PROPS,
    onEdit: vi.fn(),
    onRemove: vi.fn(async () => true),
    onOpenEntity: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  const ui = (
    <>
      {extra}
      <EntityRelationsPanel {...props} />
    </>
  );
  const view = renderWithI18n(ui);

  return {
    ...view,
    props,
    rerenderPanel: (
      next: Partial<typeof DEFAULT_PROPS> = {},
      nextExtra?: ReactElement,
    ) => {
      const nextProps = { ...props, ...next };
      view.rerender(
        <I18nProvider locale="es">
          {nextExtra ?? extra}
          <EntityRelationsPanel {...nextProps} />
        </I18nProvider>,
      );
      return nextProps;
    },
  };
}

function relationMenu(relationId: string): HTMLElement {
  const item = document.querySelector<HTMLElement>(
    `li[data-relation-id="${relationId}"]`,
  );

  if (item === null) {
    throw new Error(`No existe la entrada ${relationId}`);
  }

  return within(item).getByRole('button', {
    name: /^Acciones de la relación/,
  });
}

interface RetryController {
  complete: (state: 'ready' | 'error') => void;
}

/**
 * Arnés del reintento: reproduce la actualización real del padre, que pasa a
 * `loading` en el mismo evento que el panel cambia su intención de foco.
 */
function RetryPanelHarness({
  controller,
  relations,
}: {
  readonly controller: RetryController;
  readonly relations: readonly RelationEdge[];
}) {
  const [state, setState] = useState<'error' | 'loading' | 'ready'>('error');

  controller.complete = (next) => {
    setState(next);
  };

  return (
    <EntityRelationsPanel
      entityId={MARA_ID}
      relations={state === 'ready' ? relations : []}
      state={state}
      pending={false}
      onRetry={() => {
        setState('loading');
      }}
      onEdit={() => undefined}
      onRemove={async () => true}
      onOpenEntity={() => undefined}
    />
  );
}

/** Controla `requestAnimationFrame` para simular una recarga que termina antes del frame. */
function manualAnimationFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const raf = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      const id = nextId;
      nextId += 1;
      queue.set(id, callback);
      return id;
    });
  const cancel = vi
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((id) => {
      queue.delete(id);
    });

  return {
    flush: () => {
      const pending = [...queue.values()];
      queue.clear();

      for (const callback of pending) {
        callback(0);
      }
    },
    restore: () => {
      raf.mockRestore();
      cancel.mockRestore();
    },
  };
}

describe('panel de relaciones', () => {
  it('pinta dirección, grupo, contador y etiqueta recíproca', () => {
    renderPanel();

    expect(
      screen.getByRole('heading', {
        level: 4,
        name: messages.entities.relations.outgoingTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 5, name: 'Ubicado en' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.entities.relations.groupInverse('Contiene')),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(messages.entities.relations.groupCount(1)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Vive aquí desde niña.')).toBeVisible();
  });

  it('muestra el backlink con su etiqueta inversa y navega al origen', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ relations: [backlink] });

    expect(
      screen.getByRole('heading', {
        level: 4,
        name: messages.entities.relations.incomingTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 5, name: 'Contiene' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Backlink')).toBeInTheDocument();
    expect(
      screen.getByText(messages.entities.relations.groupForward('Ubicado en')),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.relations.openEntityNamed('Altar de sal'),
      }),
    );
    expect(props.onOpenEntity).toHaveBeenCalledWith(ALTAR_ID);
  });

  it('abre la contraparte saliente con su nombre accesible', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.relations.openEntityNamed('Puerto Sal'),
      }),
    );
    expect(props.onOpenEntity).toHaveBeenCalledWith(PUERTO_ID);
    expect(screen.getByText('Saliente')).toBeInTheDocument();
  });

  it('muestra la etiqueta sobrescrita, el tipo y no repite un tipo simétrico', () => {
    const symmetric: RelationEdge = {
      ...edge,
      id: 'symmetric',
      typeId: MENTOR_TYPE_ID,
      typeKey: mentorType.key,
      typeName: mentorType.name,
      typeInverseName: mentorType.inverseName,
      typeColor: mentorType.color,
      label: null,
      inverseLabel: null,
    };

    renderPanel({ relations: [mentorEdge, symmetric] });

    expect(
      screen.getByRole('heading', {
        level: 5,
        name: 'Aliada desde la infancia',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.entities.relations.groupType('Relacionado con'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.entities.relations.groupInverse('Aliada de')),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        messages.entities.relations.groupInverse('Relacionado con'),
      ),
    ).toBeNull();
  });

  it('no usa tabla ni roles de tabla y no menciona el grafo', () => {
    const { container } = renderPanel({
      relations: [edge, backlink, mentorEdge],
    });
    const root = container.querySelector('.wc-relations');

    expect(root?.querySelector('table')).toBeNull();
    expect(root?.querySelector('[role="table"]')).toBeNull();
    expect(root?.querySelector('[role="row"]')).toBeNull();
    expect(root?.querySelector('[role="grid"]')).toBeNull();
    expect(root?.querySelector('[role="cell"]')).toBeNull();
    expect(root?.textContent ?? '').not.toMatch(/grafo/i);
    expect(
      within(root as HTMLElement).queryByRole('button', { name: /grafo/i }),
    ).toBeNull();
    expect(
      within(root as HTMLElement).queryByRole('link', { name: /grafo/i }),
    ).toBeNull();
  });

  it('conserva en el DOM un nombre de 200+ caracteres sin truncarlo', () => {
    const longName = 'N'.repeat(220);
    const longEdge: RelationEdge = {
      ...edge,
      id: 'long',
      target: { ...edge.target, name: longName },
    };
    const { container } = renderPanel({ relations: [longEdge] });
    const name = container.querySelector('.wc-relation-item__name');

    expect(name?.textContent).toBe(longName);
    expect(name?.getAttribute('title')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: messages.entities.relations.openEntityNamed(longName),
      }),
    ).toBeInTheDocument();
  });

  it('abre el menú con teclado, recorre sus ítems y devuelve el foco', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderPanel({ onEdit });

    const trigger = relationMenu(RELATION_ID);
    trigger.focus();
    await user.keyboard('{Enter}');

    const edit = screen.getByRole('menuitem', {
      name: messages.entities.relations.editMenuItem,
    });
    const remove = screen.getByRole('menuitem', {
      name: messages.entities.relations.removeMenuItem,
    });

    expect(edit).toBeInTheDocument();
    expect(remove).toBeInTheDocument();
    expect(edit).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(remove).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('menuitem', {
        name: messages.entities.relations.editMenuItem,
      }),
    ).toBeNull();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.editMenuItem,
      }),
    );
    expect(onEdit).toHaveBeenCalledWith(edge);
  });

  it('deshabilita los ítems del menú con pending y mantiene el disparador enfocable', async () => {
    const user = userEvent.setup();
    renderPanel({ pending: true });

    const trigger = relationMenu(RELATION_ID);
    expect(trigger).not.toBeDisabled();

    await user.click(trigger);
    expect(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.editMenuItem,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.removeMenuItem,
      }),
    ).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });
});

describe('borrado de relación', () => {
  it('abre un diálogo modal con Cancelar enfocado y Escape no borra', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn(async () => true);
    renderPanel({ onRemove });

    const trigger = relationMenu(RELATION_ID);

    await user.click(trigger);
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.removeMenuItem,
      }),
    );

    const dialog = document.querySelector<HTMLDialogElement>('dialog');

    expect(dialog).not.toBeNull();
    expect(dialog?.open).toBe(true);
    await waitFor(() =>
      expect(
        within(dialog as HTMLElement).getByRole('button', {
          name: messages.entities.relations.cancel,
        }),
      ).toHaveFocus(),
    );

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('confirma el borrado y muestra loading mientras está pendiente', async () => {
    const user = userEvent.setup();
    let resolveRemove: (value: boolean) => void = () => undefined;
    const pendingRemove = new Promise<boolean>((resolve) => {
      resolveRemove = resolve;
    });
    const onRemove = vi.fn(() => pendingRemove);
    const { rerenderPanel } = renderPanel({ onRemove });

    await user.click(relationMenu(RELATION_ID));
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.removeMenuItem,
      }),
    );

    const dialog = document.querySelector<HTMLDialogElement>('dialog');
    const submit = within(dialog as HTMLElement).getByRole('button', {
      name: messages.entities.relations.removeSubmit,
    });

    await user.click(submit);
    expect(onRemove).toHaveBeenCalledWith(edge);

    rerenderPanel({ pending: true });

    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
    expect(
      within(dialog as HTMLElement).getByRole('button', {
        name: messages.entities.relations.cancel,
      }),
    ).toBeDisabled();

    // El diálogo bloquea Escape y el botón de cierre mientras espera (C2).
    await user.keyboard('{Escape}');
    expect(document.querySelector('dialog')).toBe(dialog);
    expect(
      document.querySelector<HTMLButtonElement>('.wc-dialog__header button'),
    ).toBeDisabled();

    resolveRemove(true);
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull());
  });

  it('mantiene el diálogo abierto y enfoca el botón si el borrado falla', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn(async () => false);
    renderPanel({ onRemove });

    await user.click(relationMenu(RELATION_ID));
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.removeMenuItem,
      }),
    );

    const dialog = document.querySelector<HTMLDialogElement>('dialog');
    const submit = within(dialog as HTMLElement).getByRole('button', {
      name: messages.entities.relations.removeSubmit,
    });

    await user.click(submit);

    await waitFor(() =>
      expect(
        within(dialog as HTMLElement).getByRole('alert'),
      ).toHaveTextContent(messages.entities.relations.deleteError),
    );
    expect(document.querySelector('dialog')).toBe(dialog);
    await waitFor(() => expect(submit).toHaveFocus());
  });

  it('tras borrar enfoca la siguiente entrada o el botón de alta', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn(async () => true);
    const addButton = (
      <button id="wc-entity-add-relation" type="button">
        {messages.entities.relations.add}
      </button>
    );
    const { rerenderPanel } = renderPanel(
      { relations: [edge, backlink], onRemove },
      addButton,
    );

    await user.click(relationMenu(RELATION_ID));
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.removeMenuItem,
      }),
    );
    await user.click(
      within(document.querySelector('dialog') as HTMLElement).getByRole(
        'button',
        { name: messages.entities.relations.removeSubmit },
      ),
    );

    rerenderPanel({ relations: [backlink] });

    await waitFor(() => expect(relationMenu(BACKLINK_ID)).toHaveFocus());

    // Al borrar la última relación, el foco cae en «Añadir relación».
    await user.click(relationMenu(BACKLINK_ID));
    await user.click(
      screen.getByRole('menuitem', {
        name: messages.entities.relations.removeMenuItem,
      }),
    );
    await user.click(
      within(document.querySelector('dialog') as HTMLElement).getByRole(
        'button',
        { name: messages.entities.relations.removeSubmit },
      ),
    );

    rerenderPanel({ relations: [] });

    await waitFor(() =>
      expect(document.getElementById('wc-entity-add-relation')).toHaveFocus(),
    );
  });

  it('al guardar un cambio de grupo enfoca el «⋯» de la misma relación', async () => {
    const { rerenderPanel } = renderPanel({
      relations: [mentorEdge],
      editingRelationId: MENTOR_RELATION_ID,
    });

    rerenderPanel({
      relations: [mentorEdge, edge],
      editingRelationId: null,
    });

    await waitFor(() => expect(relationMenu(MENTOR_RELATION_ID)).toHaveFocus());
  });
});

describe('estados del panel', () => {
  it('vacío: h4 y explicación, sin secciones de dirección', () => {
    const { container } = renderPanel({ relations: [] });

    expect(
      screen.getByRole('heading', {
        level: 4,
        name: messages.entities.relations.emptyTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.entities.relations.emptyDescription),
    ).toBeVisible();
    expect(container.querySelector('[data-direction]')).toBeNull();
    expect(container.querySelector('table')).toBeNull();
  });

  it('carga: aria-busy en el contenido y role=status fuera de él', () => {
    const { container } = renderPanel({ state: 'loading', relations: [] });
    const content = container.querySelector('.wc-relations__content');
    const status = container.querySelector('[role="status"]');

    expect(content).toHaveAttribute('aria-busy', 'true');
    expect(status).not.toBeNull();
    expect(status?.textContent).toBe(messages.entities.relations.loading);
    expect(status?.closest('[aria-busy="true"]')).toBeNull();

    const skeletons = container.querySelectorAll('.wc-skeleton');

    expect(skeletons).toHaveLength(3);
    for (const skeleton of skeletons) {
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('error: alerta con explicación y reintento con foco gestionado', async () => {
    const user = userEvent.setup();
    const controller: RetryController = { complete: () => undefined };
    const { container } = renderWithI18n(
      <RetryPanelHarness controller={controller} relations={[edge]} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      messages.entities.relations.loadError,
    );
    expect(
      screen.getByText(messages.entities.relations.loadErrorHint),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.relations.retry,
      }),
    );

    await waitFor(() =>
      expect(container.querySelector('.wc-relations__loading')).toHaveFocus(),
    );

    act(() => {
      controller.complete('ready');
    });

    await waitFor(() =>
      expect(
        container.querySelector('.wc-relation-item__target'),
      ).toHaveFocus(),
    );
  });

  it('error: un reintento que vuelve a fallar enfoca «Volver a intentar»', async () => {
    const user = userEvent.setup();
    const controller: RetryController = { complete: () => undefined };
    const frames = manualAnimationFrames();

    try {
      renderWithI18n(
        <RetryPanelHarness controller={controller} relations={[]} />,
      );

      await user.click(
        screen.getByRole('button', {
          name: messages.entities.relations.retry,
        }),
      );

      // La recarga termina antes de que se ejecute el frame que enfocaría la
      // carga: el intento debe pasar a `retry-result` y no quedarse atascado.
      act(() => {
        controller.complete('error');
      });
      act(() => {
        frames.flush();
      });

      await waitFor(() =>
        expect(
          screen.getByRole('button', {
            name: messages.entities.relations.retry,
          }),
        ).toHaveFocus(),
      );
    } finally {
      frames.restore();
    }
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
        types={[locatedType]}
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

  it('bloquea el cierre mientras la petición está en curso', () => {
    const onClose = vi.fn();

    renderWithI18n(
      <EntityRelationDialog
        open
        mode="create"
        worldId={WORLD_ID}
        entityId={MARA_ID}
        relation={null}
        types={[locatedType]}
        candidates={[puerto]}
        pending
        onClose={onClose}
        onSubmit={vi.fn(async () => true)}
      />,
    );

    const dialog = document.querySelector<HTMLDialogElement>('dialog');

    fireEvent.keyDown(dialog as HTMLElement, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(
      document.querySelector<HTMLButtonElement>('.wc-dialog__header button'),
    ).toBeDisabled();
  });
});
