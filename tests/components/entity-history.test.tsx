import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { EntityHistorySection } from '@/renderer/components/entities/entity-history-section';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type {
  EntityVersionSummary,
  VersionCreateResult,
  VersionRestoreResult,
} from '@/shared/contracts/versions';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';
const VERSION_ID = '01900000-0000-7000-8000-000000000003';
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

function version(
  origin: EntityVersionSummary['origin'],
  overrides: Partial<EntityVersionSummary> = {},
): EntityVersionSummary {
  return {
    id: VERSION_ID,
    entityId: ENTITY_ID,
    origin,
    label: origin === 'manual' ? 'Hito del faro' : null,
    createdAt: BASE_TIME,
    descriptionTextPreview: 'La marea baja dejó al descubierto el muelle.',
    ...overrides,
  };
}

function createApi(initial: readonly EntityVersionSummary[] = []) {
  const store = [...initial];
  const list = vi.fn(async () => ({ ok: true as const, data: [...store] }));
  const create = vi.fn(
    async ({
      label,
    }: {
      readonly label: string;
    }): Promise<{ ok: true; data: VersionCreateResult }> => {
      const created = version('manual', {
        id: `${VERSION_ID}-${store.length}`,
        label,
      });
      store.unshift(created);
      return { ok: true, data: { created: true, version: created } };
    },
  );
  const restore = vi.fn(
    async (): Promise<{ ok: true; data: VersionRestoreResult }> => ({
      ok: true,
      data: { restored: true },
    }),
  );
  const api = {
    versions: { list, create, restore },
  } as unknown as WorldCraftApi;

  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: api,
  });

  return { list, create, restore };
}

interface RenderOptions {
  readonly versions?: readonly EntityVersionSummary[];
  readonly descriptionEmpty?: boolean;
}

function renderHistory(options: RenderOptions = {}) {
  const api = createApi(options.versions);
  const onBeforeAction = vi.fn(async () => true);
  const onEntityChanged = vi.fn();
  const onNotify = vi.fn();

  const view = render(
    <I18nProvider locale="es">
      <EntityHistorySection
        worldId={WORLD_ID}
        entityId={ENTITY_ID}
        descriptionEmpty={options.descriptionEmpty ?? false}
        refreshToken={0}
        onBeforeAction={onBeforeAction}
        onEntityChanged={onEntityChanged}
        onNotify={onNotify}
      />
    </I18nProvider>,
  );

  return { ...api, ...view, onBeforeAction, onEntityChanged, onNotify };
}

async function openHistory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Historial/ }));
}

describe('historial de la ficha', () => {
  it('carga al abrir y muestra origen, etiqueta y vista previa', async () => {
    const user = userEvent.setup();
    const { list } = renderHistory({
      versions: [
        version('manual'),
        version('restore', { id: `${VERSION_ID}-r` }),
      ],
    });

    expect(list).not.toHaveBeenCalled();
    await openHistory(user);

    expect(list).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      entityId: ENTITY_ID,
      limit: 200,
    });
    expect(
      await screen.findByText(messages.entities.history.origins.manual),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.entities.history.origins.restore),
    ).toBeInTheDocument();
    expect(screen.getByText('Hito del faro')).toBeInTheDocument();
    expect(
      screen.getAllByText('La marea baja dejó al descubierto el muelle.'),
    ).toHaveLength(2);
  });

  it('guarda una versión manual con etiqueta obligatoria y anuncia éxito', async () => {
    const user = userEvent.setup();
    const { create, onNotify, onBeforeAction } = renderHistory();

    await openHistory(user);
    await waitFor(() => {
      expect(
        screen.getByText(messages.entities.history.empty),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', {
        name: messages.entities.history.save,
      }),
    );

    expect(onBeforeAction).toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText(
      messages.entities.history.saveDialog.label,
      { exact: false },
    );
    const submit = within(dialog).getByRole('button', {
      name: messages.entities.history.saveDialog.submit,
    });

    expect(input).toHaveFocus();
    expect(submit).toBeDisabled();

    await user.type(input, 'Hito del faro');
    await user.click(submit);

    expect(create).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      entityId: ENTITY_ID,
      label: 'Hito del faro',
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        'success',
        messages.entities.history.saveDialog.success,
      );
    });
    expect(await screen.findByText('Hito del faro')).toBeInTheDocument();
  });

  it('restaura una versión y avisa de que la ficha debe recargarse', async () => {
    const user = userEvent.setup();
    const { restore, onEntityChanged, onNotify } = renderHistory({
      versions: [version('manual')],
    });

    await openHistory(user);
    await waitFor(() => {
      expect(screen.getByText('Hito del faro')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', {
        name: /Restaurar la versión «Hito del faro»/,
      }),
    );

    const dialog = screen.getByRole('dialog');
    const preview = within(dialog).getByRole('region', {
      name: messages.entities.history.restoreDialog.previewLabel,
    });

    expect(preview).toHaveTextContent(
      'La marea baja dejó al descubierto el muelle.',
    );
    expect(
      within(dialog).getByRole('button', {
        name: messages.entities.history.restoreDialog.cancel,
      }),
    ).toHaveFocus();

    await user.click(
      within(dialog).getByRole('button', {
        name: messages.entities.history.restoreDialog.submit,
      }),
    );

    expect(restore).toHaveBeenCalledWith({
      worldId: WORLD_ID,
      entityId: ENTITY_ID,
      versionId: VERSION_ID,
    });
    await waitFor(() => {
      expect(onEntityChanged).toHaveBeenCalled();
      expect(onNotify).toHaveBeenCalledWith(
        'success',
        messages.entities.history.restoreDialog.success,
      );
    });
  });

  it('oculta el guardado con descripción vacía o 50 manuales', async () => {
    const user = userEvent.setup();
    const manual = Array.from({ length: 50 }, (_, index) =>
      version('manual', {
        id: `${VERSION_ID}-${index}`,
        label: `Manual ${index}`,
      }),
    );
    const { unmount } = renderHistory({ versions: manual });

    await openHistory(user);
    await waitFor(() => {
      expect(
        screen.getByText(messages.entities.history.manualLimit),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', {
        name: messages.entities.history.save,
      }),
    ).not.toBeInTheDocument();

    unmount();
    renderHistory({ descriptionEmpty: true });

    expect(
      screen.getByText(messages.entities.history.emptyDescription),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: messages.entities.history.save,
      }),
    ).not.toBeInTheDocument();
  });

  it('no tiene violaciones críticas de axe al abrir el historial', async () => {
    const user = userEvent.setup();
    const { container } = renderHistory({ versions: [version('manual')] });

    await openHistory(user);
    await waitFor(() => {
      expect(screen.getByText('Hito del faro')).toBeInTheDocument();
    });

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(
      results.violations.filter((violation) => violation.impact === 'critical'),
    ).toEqual([]);
  });
});
