import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import { TrashPage } from '@/renderer/pages/trash-page';
import type {
  TrashGroup,
  TrashItem,
  TrashPage as TrashPageData,
} from '@/shared/contracts/trash';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';
const TYPE_ID = '01900000-0000-7000-8000-000000000003';
const BASE_TIME = 1_760_000_000_000;

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

const worldItem: TrashItem = {
  kind: 'world',
  id: WORLD_ID,
  name: 'Las Mareas Grises',
  deletedAt: BASE_TIME,
};

const entityItem: TrashItem = {
  kind: 'entity',
  id: ENTITY_ID,
  name: 'Mara Viento',
  worldId: WORLD_ID,
  worldName: 'Las Mareas Grises',
  typeName: 'Personaje',
  worldDeletedAt: null,
  deletedAt: BASE_TIME,
};

interface Store {
  worlds: readonly TrashItem[];
  entities: readonly TrashItem[];
  entityTypes: readonly TrashItem[];
}

function page(items: readonly TrashItem[]): TrashPageData {
  return { items, nextCursor: null };
}

function createApi(initial?: Partial<Store>) {
  const store: Store = {
    worlds: initial?.worlds ?? [],
    entities: initial?.entities ?? [],
    entityTypes: initial?.entityTypes ?? [],
  };

  const list = vi.fn(
    async ({
      group,
    }: {
      readonly group: TrashGroup;
    }): Promise<
      | { ok: true; data: TrashPageData }
      | { ok: false; error: { code: 'INTERNAL_ERROR' } }
    > => ({ ok: true as const, data: page(store[group]) }),
  );
  const restore = vi.fn(async ({ id }: { readonly id: string }) => {
    if (id === ENTITY_ID) {
      store.entities = [];
    }
    if (id === WORLD_ID) {
      store.worlds = [];
    }
    if (id === TYPE_ID) {
      store.entityTypes = [];
    }
    return { ok: true as const, data: { restored: true as const } };
  });
  const purge = vi.fn(async ({ id }: { readonly id: string }) => {
    if (id === ENTITY_ID) {
      store.entities = [];
    }
    if (id === WORLD_ID) {
      store.worlds = [];
    }
    if (id === TYPE_ID) {
      store.entityTypes = [];
    }
    return { ok: true as const, data: { purged: true as const } };
  });
  const empty = vi.fn(async () => ({
    ok: true as const,
    data: {
      backup: 'created' as const,
      purged: { worlds: 1, entities: 1, entityTypes: 0 },
      skipped: 0,
    },
  }));

  const api = {
    trash: { list, restore, purge, empty },
  } as unknown as WorldCraftApi;

  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: api,
  });

  return { list, restore, purge, empty };
}

function renderPage(initial?: Partial<Store>) {
  const api = createApi(initial);
  const onNotify = vi.fn();
  const onLibraryChanged = vi.fn(async () => {});

  const view = render(
    <I18nProvider locale="es">
      <TrashPage onNotify={onNotify} onLibraryChanged={onLibraryChanged} />
    </I18nProvider>,
  );

  return { ...api, ...view, onNotify, onLibraryChanged };
}

describe('página de la papelera', () => {
  it('anuncia la carga y muestra un esqueleto por grupo', () => {
    const never = new Promise<never>(() => {});
    const api = {
      trash: {
        list: vi.fn(() => never),
        restore: vi.fn(),
        purge: vi.fn(),
        empty: vi.fn(),
      },
    } as unknown as WorldCraftApi;

    Object.defineProperty(window, 'worldCraft', {
      configurable: true,
      value: api,
    });

    render(
      <I18nProvider locale="es">
        <TrashPage onNotify={vi.fn()} onLibraryChanged={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByText(messages.trash.loading)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: messages.trash.groups.worlds.title,
      }),
    ).toBeInTheDocument();
  });

  it('muestra el vacío global y el vacío por grupo', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: messages.trash.empty.title,
      }),
    ).toBeInTheDocument();
  });

  it('muestra una sola alerta cuando fallan los tres grupos', async () => {
    const api = {
      trash: {
        list: vi.fn(async () => ({
          ok: false as const,
          error: { code: 'INTERNAL_ERROR' as const },
        })),
        restore: vi.fn(),
        purge: vi.fn(),
        empty: vi.fn(),
      },
    } as unknown as WorldCraftApi;

    Object.defineProperty(window, 'worldCraft', {
      configurable: true,
      value: api,
    });

    render(
      <I18nProvider locale="es">
        <TrashPage onNotify={vi.fn()} onLibraryChanged={vi.fn()} />
      </I18nProvider>,
    );

    expect(
      await screen.findByText(messages.trash.errorTitle),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('restaura una ficha, avisa y mueve el foco al vacío global', async () => {
    const user = userEvent.setup();
    const { restore, onNotify } = renderPage({ entities: [entityItem] });

    await user.click(
      await screen.findByRole('button', {
        name: messages.trash.row.restoreNamed(entityItem.name),
      }),
    );

    expect(restore).toHaveBeenCalledWith({ kind: 'entity', id: ENTITY_ID });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        'success',
        messages.trash.row.restored(entityItem.name),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText(entityItem.name)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('wc-trash-empty-global');
    });
  });

  it('explica el fallo de copia en el diálogo y no cierra', async () => {
    const user = userEvent.setup();
    const { purge } = renderPage({ entities: [entityItem] });
    purge.mockResolvedValueOnce({
      ok: true,
      data: { purged: false, reason: 'backup-failed' },
    } as never);

    await user.click(
      await screen.findByRole('button', {
        name: messages.trash.row.purgeNamed(entityItem.name),
      }),
    );

    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', {
      name: messages.trash.purgeDialog.cancel,
    });

    expect(cancel).toHaveFocus();
    await user.click(
      within(dialog).getByRole('button', {
        name: messages.trash.purgeDialog.submit,
      }),
    );

    expect(
      await within(dialog).findByText(messages.trash.purgeDialog.backupFailed),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBe(dialog);
  });

  it('exige la casilla para vaciar y muestra el resumen final', async () => {
    const user = userEvent.setup();
    const { empty, onLibraryChanged } = renderPage({
      worlds: [worldItem],
      entities: [entityItem],
    });

    await user.click(
      await screen.findByRole('button', {
        name: messages.trash.emptyAction,
      }),
    );

    const dialog = screen.getByRole('dialog');
    const checkbox = within(dialog).getByRole('checkbox', {
      name: messages.trash.emptyDialog.checkbox,
    });
    const submit = within(dialog).getByRole('button', {
      name: messages.trash.emptyDialog.submit,
    });

    expect(checkbox).toHaveFocus();
    expect(submit).toBeDisabled();

    await user.click(checkbox);
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(empty).toHaveBeenCalledWith({ confirm: 'empty-trash' });
    expect(
      await within(dialog).findByText(messages.trash.emptyDialog.summaryLead),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/1 mundo/)).toBeInTheDocument();
    expect(
      within(dialog).queryByText(messages.trash.emptyDialog.lead),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(messages.trash.emptyDialog.copyNote),
    ).not.toBeInTheDocument();
    const close = within(
      dialog.querySelector<HTMLElement>('.wc-dialog__actions') as HTMLElement,
    ).getByRole('button', {
      name: messages.trash.emptyDialog.close,
    });
    await waitFor(() => {
      expect(close).toHaveFocus();
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(onLibraryChanged).toHaveBeenCalled();
  });

  it('no tiene violaciones críticas de axe en el vacío global', async () => {
    const { container } = renderPage();

    await screen.findByText(messages.trash.empty.title);
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(
      results.violations.filter((violation) => violation.impact === 'critical'),
    ).toEqual([]);
  });

  it('no tiene violaciones críticas de axe con la lista llena', async () => {
    const { container } = renderPage({ entities: [entityItem] });

    await screen.findByText(entityItem.name);
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(
      results.violations.filter((violation) => violation.impact === 'critical'),
    ).toEqual([]);
  });

  it('no tiene violaciones críticas de axe en los diálogos de purga y vaciado', async () => {
    const user = userEvent.setup();
    const { container } = renderPage({ entities: [entityItem] });

    await screen.findByText(entityItem.name);

    await user.click(
      screen.getByRole('button', {
        name: messages.trash.row.purgeNamed(entityItem.name),
      }),
    );

    const purgeResults = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(
      purgeResults.violations.filter(
        (violation) => violation.impact === 'critical',
      ),
    ).toEqual([]);

    await user.click(
      screen.getByRole('button', { name: messages.trash.purgeDialog.cancel }),
    );
    await user.click(
      screen.getByRole('button', { name: messages.trash.emptyAction }),
    );

    const emptyResults = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(
      emptyResults.violations.filter(
        (violation) => violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
});
