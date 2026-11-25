import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { App } from '@/renderer/App';
import { WorldTransferDialog } from '@/renderer/components/transfer/world-transfer-dialog';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type { TransferDialogState } from '@/renderer/transfer/state';
import type {
  TransferExportResult,
  TransferImportResult,
} from '@/shared/contracts/transfer';
import { createIdleUpdateSnapshot } from '@/shared/contracts/updates';
import {
  createDefaultUiPreferences,
  type UiPreferences,
} from '@/shared/contracts/preferences';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';
import type { WorldDetail, WorldSummary } from '@/shared/contracts/worlds';

const COUNTS = {
  entities: 2,
  entityTypes: 1,
  relationTypes: 1,
  tags: 2,
  relations: 3,
  versions: 2,
  assets: 5,
};

const EXPORTED: TransferExportResult = {
  worldId: '01900000-0000-7000-8000-000000000001',
  worldName: 'Crónica de las Mareas',
  fileName: 'cronica-de-las-mareas.zip',
  size: 1536,
  counts: COUNTS,
  warnings: [],
};

const IMPORTED: TransferImportResult = {
  worldId: '01900000-0000-7000-8000-000000000002',
  worldName: 'Crónica de las Mareas',
  slug: 'cronica-de-las-mareas-2',
  slugAdjusted: true,
  counts: COUNTS,
  warnings: [{ code: 'missing-tag', count: 2 }],
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

function renderDialog(
  state: TransferDialogState,
  overrides: Partial<{
    onClose: () => void;
    onCancel: () => void;
    onRetry: () => void;
    onOpenWorld: (worldId: string) => void;
  }> = {},
) {
  const handlers = {
    onClose: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onOpenWorld: vi.fn(),
    ...overrides,
  };

  return {
    ...renderWithI18n(
      <WorldTransferDialog
        state={state}
        onClose={handlers.onClose}
        onCancel={handlers.onCancel}
        onRetry={handlers.onRetry}
        onOpenWorld={handlers.onOpenWorld}
      />,
    ),
    handlers,
  };
}

function runningState(
  overrides: Partial<Extract<TransferDialogState, { status: 'running' }>> = {},
): Extract<TransferDialogState, { status: 'running' }> {
  return {
    status: 'running',
    operation: 'export',
    operationId: '018f1000-0000-7000-8000-000000000003',
    worldName: 'Crónica de las Mareas',
    phase: 'packaging',
    completed: 1,
    total: 2,
    unit: 'files',
    cancelable: true,
    cancelError: false,
    ...overrides,
  };
}

function makeWorld(overrides: Partial<WorldDetail> = {}): WorldDetail {
  return {
    id: '01900000-0000-7000-8000-000000000001',
    name: 'Crónica de las Mareas',
    slug: 'cronica-de-las-mareas',
    summary: 'Un archipiélago que cambia con la marea.',
    description: 'Descripción.',
    genres: ['Fantasía'],
    language: 'es',
    status: 'active',
    coverAssetId: null,
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_001_000,
    archivedAt: null,
    ...overrides,
  };
}

function idlePreferences(): UiPreferences {
  return createDefaultUiPreferences();
}

describe('diálogo de transferencia', () => {
  it('muestra el progreso, la barra y el botón de cancelar', async () => {
    const user = userEvent.setup();
    const { handlers } = renderDialog(runningState());

    expect(
      screen.getByRole('heading', { name: messages.transfer.titles.exporting }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.status.running),
    ).toBeInTheDocument();
    expect(screen.getByText('Crónica de las Mareas')).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.phases.packaging),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.phaseDetails.packaging),
    ).toBeInTheDocument();
    expect(screen.getByText('1 de 2 archivos')).toBeInTheDocument();

    const progress = screen.getByRole('progressbar', {
      name: messages.transfer.progress.exportLabel,
    });

    expect(progress).toHaveAttribute('aria-valuetext', '1 de 2 archivos');
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '2');
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(progress.querySelector('.wc-progress__bar')).toHaveStyle({
      width: '50%',
    });

    const cancel = screen.getByRole('button', {
      name: messages.transfer.actions.cancel,
    });

    expect(cancel).toHaveFocus();
    await user.click(cancel);
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('muestra una barra indeterminada y bloquea el cierre si no es cancelable', () => {
    renderDialog(
      runningState({
        phase: 'saving',
        completed: 0,
        total: null,
        unit: 'steps',
        cancelable: false,
      }),
    );

    expect(
      screen.queryByRole('button', { name: messages.transfer.actions.cancel }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.progress.lockedHint),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole('progressbar', {
          name: messages.transfer.progress.exportLabel,
        })
        .closest('.wc-progress'),
    ).toHaveClass('wc-progress--indeterminate');
  });

  it('muestra el estado cancelando con el botón ocupado', () => {
    const { container } = renderDialog({
      status: 'cancelling',
      operation: 'import',
      operationId: '018f1000-0000-7000-8000-000000000004',
      worldName: null,
      phase: 'reading',
      completed: 2,
      total: null,
      unit: 'steps',
    });

    expect(
      screen.getByRole('heading', { name: messages.transfer.titles.importing }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.status.cancelling),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.progress.cancelling.import),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: messages.transfer.actions.cancelling,
      }),
    ).toBeDisabled();
    expect(container.querySelector('.wc-progress--indeterminate')).toBeTruthy();
  });

  it('resume una exportación completada', () => {
    renderDialog({ status: 'exported', result: EXPORTED });

    expect(
      screen.getByRole('heading', { name: messages.transfer.titles.exported }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.status.success),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.summary.exported(EXPORTED.worldName)),
    ).toBeInTheDocument();
    expect(screen.getByText(EXPORTED.fileName)).toBeInTheDocument();
    expect(screen.getByText('1,5 kB')).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.summary.countsExport),
    ).toBeInTheDocument();
  });

  it('resume una importación con avisos y slug ajustado', async () => {
    const user = userEvent.setup();
    const { handlers } = renderDialog({ status: 'imported', result: IMPORTED });

    expect(
      screen.getByRole('heading', { name: messages.transfer.titles.imported }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.status.successWithWarnings),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.summary.slugAdjusted(IMPORTED.slug)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.transfer.summary.warnings['missing-tag'].other.replace(
          '{count}',
          '2',
        ),
      ),
    ).toBeInTheDocument();

    const open = screen.getByRole('button', {
      name: messages.transfer.actions.openWorld,
    });

    expect(open).toHaveFocus();
    await user.click(open);
    expect(handlers.onOpenWorld).toHaveBeenCalledWith(IMPORTED.worldId);
  });

  it('muestra el error con su código y ofrece reintentar', async () => {
    const user = userEvent.setup();
    const { handlers } = renderDialog({
      status: 'failed',
      operation: 'import',
      worldName: null,
      code: 'TRANSFER_CHECKSUM_MISMATCH',
      retrying: false,
    });

    expect(
      screen.getByRole('heading', {
        name: messages.transfer.titles.importFailed,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.transfer.errors.codes.TRANSFER_CHECKSUM_MISMATCH,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.transfer.errors.reassuranceImport),
    ).toBeInTheDocument();

    const retry = screen.getByRole('button', {
      name: messages.transfer.actions.retry,
    });

    expect(retry).toHaveFocus();
    await user.click(retry);
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it('mueve el foco al cambiar de fase o al terminar', () => {
    const { rerender } = renderDialog(runningState());

    expect(
      screen.getByRole('button', { name: messages.transfer.actions.cancel }),
    ).toHaveFocus();

    const update = (state: TransferDialogState): void => {
      rerender(
        <I18nProvider locale="es">
          <WorldTransferDialog
            state={state}
            onClose={vi.fn()}
            onCancel={vi.fn()}
            onRetry={vi.fn()}
            onOpenWorld={vi.fn()}
          />
        </I18nProvider>,
      );
    };

    update({ status: 'exported', result: EXPORTED });
    expect(
      screen
        .getAllByRole('button', {
          name: messages.components.dialog.close,
        })
        .at(-1),
    ).toHaveFocus();

    update({ status: 'imported', result: IMPORTED });
    expect(
      screen.getByRole('button', { name: messages.transfer.actions.openWorld }),
    ).toHaveFocus();

    update({
      status: 'failed',
      operation: 'import',
      worldName: null,
      code: 'TRANSFER_CHECKSUM_MISMATCH',
      retrying: false,
    });
    expect(
      screen.getByRole('button', { name: messages.transfer.actions.retry }),
    ).toHaveFocus();

    update(
      runningState({
        phase: 'saving',
        completed: 0,
        total: null,
        unit: 'steps',
        cancelable: false,
      }),
    );
    expect(screen.getByText(messages.transfer.phases.saving)).toHaveFocus();
  });

  it('no ofrece reintentar los fallos que no se recuperan', () => {
    renderDialog({
      status: 'failed',
      operation: 'import',
      worldName: null,
      code: 'TRANSFER_FORMAT_UNSUPPORTED',
      retrying: false,
    });

    expect(
      screen.queryByRole('button', { name: messages.transfer.actions.retry }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('button', {
          name: messages.components.dialog.close,
        })
        .at(-1),
    ).toHaveFocus();
  });

  it('muestra el error de formato no compatible y no lo confunde con manifiesto inválido', () => {
    renderDialog({
      status: 'failed',
      operation: 'import',
      worldName: null,
      code: 'TRANSFER_FORMAT_UNSUPPORTED',
      retrying: false,
    });

    expect(
      screen.getByText(
        messages.transfer.errors.codes.TRANSFER_FORMAT_UNSUPPORTED,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        messages.transfer.errors.codes.TRANSFER_MANIFEST_INVALID,
      ),
    ).not.toBeInTheDocument();
  });

  it('mantiene los textos largos completos y sin truncarlos', () => {
    const longName = 'A'.repeat(120);
    const longSlug = `cronica-de-las-mareas-${'x'.repeat(60)}`;
    const longFileName = `${'b'.repeat(180)}.zip`;
    const bigCounts = {
      entities: 500_000,
      entityTypes: 500_000,
      relationTypes: 500_000,
      tags: 500_000,
      relations: 500_000,
      versions: 500_000,
      assets: 500_000,
    };
    const warnings = [
      { code: 'missing-entity-type' as const, count: 500_000 },
      { code: 'missing-relation-type' as const, count: 500_000 },
      { code: 'unknown-version-origin' as const, count: 500_000 },
    ];

    const imported = renderDialog({
      status: 'imported',
      result: {
        ...IMPORTED,
        worldName: longName,
        slug: longSlug,
        slugAdjusted: true,
        counts: bigCounts,
        warnings,
      },
    });

    expect(
      screen.getByText(
        messages.transfer.summary.importedWithWarnings(longName),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(longSlug)).toBeInTheDocument();
    expect(screen.getAllByText('500.000')).toHaveLength(7);
    expect(
      screen.getByText(
        messages.transfer.summary.warnings['missing-entity-type'].other.replace(
          '{count}',
          '500.000',
        ),
      ),
    ).toBeInTheDocument();
    imported.unmount();

    renderDialog({
      status: 'exported',
      result: {
        ...EXPORTED,
        worldName: longName,
        fileName: longFileName,
        counts: bigCounts,
      },
    });

    expect(screen.getByText(longFileName)).toBeInTheDocument();
  });

  it('no tiene violaciones críticas de axe en progreso, éxito y error', async () => {
    // jsdom no calcula layout ni contraste: aquí se revisan estructura y ARIA.
    // El E2E audita el diálogo real con `color-contrast` activo en éxito,
    // éxito con avisos y error, en Claro y Oscuro.
    for (const theme of ['light', 'dark'] as const) {
      document.documentElement.dataset.theme = theme;

      const progress = renderDialog(runningState());
      const progressResults = await axe.run(progress.container, {
        rules: { 'color-contrast': { enabled: false } },
      });

      expect(
        progressResults.violations.filter(
          (violation) => violation.impact === 'critical',
        ),
      ).toEqual([]);
      progress.unmount();

      const success = renderDialog({
        status: 'imported',
        result: {
          ...IMPORTED,
          warnings: [
            { code: 'missing-tag', count: 2 },
            { code: 'unknown-version-origin', count: 1 },
          ],
        },
      });
      const successResults = await axe.run(success.container, {
        rules: { 'color-contrast': { enabled: false } },
      });

      expect(
        successResults.violations.filter(
          (violation) => violation.impact === 'critical',
        ),
      ).toEqual([]);
      success.unmount();

      const failed = renderDialog({
        status: 'failed',
        operation: 'export',
        worldName: 'Crónica de las Mareas',
        code: 'TRANSFER_INTERNAL',
        retrying: false,
      });
      const failedResults = await axe.run(failed.container, {
        rules: { 'color-contrast': { enabled: false } },
      });

      expect(
        failedResults.violations.filter(
          (violation) => violation.impact === 'critical',
        ),
      ).toEqual([]);
      failed.unmount();
    }
  });
});

function installApi(options: {
  readonly worlds: readonly WorldSummary[];
  readonly detail?: WorldDetail;
  readonly importWorld?: () => Promise<unknown>;
  readonly exportWorld?: () => Promise<unknown>;
}): {
  readonly api: WorldCraftApi;
  readonly importWorld: ReturnType<typeof vi.fn>;
  readonly exportWorld: ReturnType<typeof vi.fn>;
} {
  const detail = options.detail ?? makeWorld();
  const importWorld = vi.fn(
    options.importWorld ??
      (() => Promise.resolve({ ok: true, data: { status: 'cancelled' } })),
  );
  const exportWorld = vi.fn(
    options.exportWorld ??
      (() => Promise.resolve({ ok: true, data: { status: 'cancelled' } })),
  );
  const api = {
    appInfo: { name: 'World Craft', version: '0.1.0' },
    shell: { openExternal: vi.fn() },
    updates: {
      getState: vi.fn(async () => ({
        ok: true,
        data: createIdleUpdateSnapshot('0.1.0'),
      })),
      onStateChanged: vi.fn(() => () => {}),
    },
    preferences: {
      update: vi.fn(async (patch: unknown) => ({ ok: true, data: patch })),
      reset: vi.fn(async () => ({ ok: true, data: idlePreferences() })),
    },
    worlds: {
      list: vi.fn(async () => ({ ok: true, data: options.worlds })),
      get: vi.fn(async () => ({ ok: true, data: detail })),
      listActivity: vi.fn(async () => ({ ok: true, data: [] })),
    },
    entities: {
      get: vi.fn(async () => ({ ok: true, data: null })),
    },
    transfer: {
      exportWorld,
      importWorld,
      cancel: vi.fn(async () => ({
        ok: true,
        data: { cancelled: false },
      })),
      onEvent: vi.fn(() => () => {}),
    },
  } as unknown as WorldCraftApi;

  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: api,
  });

  return { api, importWorld, exportWorld };
}

function renderApp() {
  return renderWithI18n(<App initialPreferences={idlePreferences()} />);
}

describe('acciones de transferencia en la aplicación', () => {
  it('con cero mundos ofrece importar aunque no haya fichas', async () => {
    const { importWorld } = installApi({ worlds: [] });
    const user = userEvent.setup();

    renderApp();

    await screen.findByText(messages.home.emptyTitle);
    await user.click(
      screen.getByRole('button', { name: messages.shell.viewMenuLabel }),
    );

    expect(
      screen.getByRole('menuitem', {
        name: messages.transfer.actions.import,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', {
        name: messages.shell.quickCreate,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('menuitem', {
        name: messages.transfer.actions.import,
      }),
    );
    expect(importWorld).toHaveBeenCalledTimes(1);
  });

  it('con mundos ofrece crear ficha e importar', async () => {
    const world = makeWorld();
    installApi({ worlds: [world] });
    const user = userEvent.setup();

    renderApp();

    await screen.findByRole('heading', { level: 3, name: world.name });
    await user.click(
      screen.getByRole('button', { name: messages.shell.viewMenuLabel }),
    );

    expect(
      screen.getByRole('menuitem', { name: messages.shell.quickCreate }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: messages.transfer.actions.import }),
    ).toBeInTheDocument();
  });

  it('en la vista de mundo ofrece exportar antes de archivar', async () => {
    const world = makeWorld();
    const { api, exportWorld } = installApi({ worlds: [world] });
    const user = userEvent.setup();

    renderApp();
    await screen.findByRole('heading', { level: 3, name: world.name });
    await user.click(
      screen.getByRole('button', {
        name: messages.worlds.card.openNamed(world.name),
      }),
    );
    await waitFor(() => expect(api.worlds.get).toHaveBeenCalledWith(world.id));

    await user.click(
      screen.getByRole('button', { name: messages.shell.viewMenuLabel }),
    );

    const exportItem = screen.getByRole('menuitem', {
      name: messages.transfer.actions.export,
    });
    const archiveItem = screen.getByRole('menuitem', {
      name: messages.worlds.card.archive,
    });

    expect(exportItem.compareDocumentPosition(archiveItem)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await user.click(exportItem);
    expect(exportWorld).toHaveBeenCalledWith(world.id);
  });

  it('renderiza el diálogo en ambos temas sin cambiar su estructura', () => {
    for (const theme of ['light', 'dark'] as const) {
      document.documentElement.dataset.theme = theme;
      const { unmount } = renderDialog({
        status: 'exported',
        result: EXPORTED,
      });

      expect(
        screen.getByRole('heading', {
          name: messages.transfer.titles.exported,
        }),
      ).toBeInTheDocument();
      expect(document.querySelector('dialog.wc-transfer')).toBeInTheDocument();
      unmount();
    }
  });
});
