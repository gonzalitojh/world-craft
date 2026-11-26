import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataSettings } from '@/renderer/components/settings/data-settings';
import { SettingsAnnouncerProvider } from '@/renderer/components/settings/settings-announcer';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type {
  DataCounts,
  DataDeleteResult,
  DataLibraryResult,
  DataOrphanPurgeResult,
  DataOrphanSummary,
  DataUsage,
} from '@/shared/contracts/data';
import type {
  WorldCraftApi,
  WorldCraftDataApi,
} from '@/shared/contracts/world-craft-api';

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

const counts: DataCounts = {
  worlds: { active: 2, archived: 1, trash: 1 },
  entities: 8,
  assets: 7,
  backups: 5,
};

const usage: DataUsage = {
  totalBytes: 2048,
  totalEntries: 10,
  partial: false,
  categories: {
    database: { bytes: 1024, entries: 1, partial: false },
    assets: { bytes: 1024, entries: 2, partial: false },
    backups: { bytes: 0, entries: 0, partial: false },
    logs: { bytes: 0, entries: 0, partial: false },
    temporary: { bytes: 0, entries: 0, partial: false },
  },
};

const orphanSummary: DataOrphanSummary = {
  purgeableFiles: 2,
  unreferencedFiles: 1,
  orphanThumbnails: 1,
  temporaryFiles: 0,
  missingFiles: 0,
  unexpectedEntries: 0,
  suspiciousLinks: 0,
  recoverableBytes: 2048,
};

const libraryResult: DataLibraryResult = {
  status: 'completed',
  fileName: 'biblioteca.zip',
  size: 2048,
  worlds: 2,
  counts: {
    entities: 8,
    entityTypes: 2,
    relationTypes: 1,
    tags: 3,
    relations: 1,
    versions: 0,
    assets: 7,
  },
  warnings: [],
};

const deleteCounts = {
  databaseFiles: 2,
  assetFiles: 7,
  logEntries: 1,
  temporaryEntries: 1,
  backupDirectories: 2,
};

const deletedResult: DataDeleteResult = {
  status: 'deleted',
  restartRequired: true,
  counts: deleteCounts,
  remaining: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

function createApi(
  overrides: Partial<WorldCraftDataApi> = {},
): WorldCraftDataApi {
  return {
    getSummary: vi.fn(async () => ({
      ok: true as const,
      data: { status: 'completed' as const, data: counts },
    })),
    getUsage: vi.fn(async () => ({
      ok: true as const,
      data: { status: 'completed' as const, data: usage },
    })),
    openFolder: vi.fn(async () => ({
      ok: true as const,
      data: { status: 'completed' as const, data: { opened: true as const } },
    })),
    exportAll: vi.fn(async () => ({
      ok: true as const,
      data: libraryResult,
    })),
    deleteAll: vi.fn(async () => ({
      ok: true as const,
      data: deletedResult,
    })),
    planOrphans: vi.fn(async () => ({
      ok: true as const,
      data: { status: 'completed' as const, data: orphanSummary },
    })),
    purgeOrphans: vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'completed' as const,
        data: {
          purgedFiles: 2,
          purgedBytes: 2048,
          backupCreated: true,
        } satisfies DataOrphanPurgeResult,
      },
    })),
    ...overrides,
  };
}

function installApi(api: WorldCraftDataApi): void {
  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: { data: api } satisfies Partial<WorldCraftApi>,
  });
}

function renderData(onNotify = vi.fn()) {
  return render(
    <I18nProvider locale="es">
      <SettingsAnnouncerProvider>
        <DataSettings onNotify={onNotify} />
      </SettingsAnnouncerProvider>
    </I18nProvider>,
  );
}

function dataSection(): HTMLElement {
  const element = document.getElementById('datos');

  if (element === null) {
    throw new Error('Falta la sección de datos');
  }

  return element;
}

/**
 * La región viva de Ajustes debe quedar vacía cuando el mensaje ya se anuncia
 * por el foco del resultado o del progreso.
 */
function expectAnnouncerEmpty(): void {
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
}

const copy = messages.settings.data;

beforeEach(() => {
  installApi(createApi());
});

describe('sección Datos', () => {
  it('muestra carga y luego el resumen', async () => {
    const summary =
      deferred<Awaited<ReturnType<WorldCraftDataApi['getSummary']>>>();
    const usageResult =
      deferred<Awaited<ReturnType<WorldCraftDataApi['getUsage']>>>();
    installApi(
      createApi({
        getSummary: vi.fn(() => summary.promise),
        getUsage: vi.fn(() => usageResult.promise),
      }),
    );
    const { container } = renderData();

    expect(screen.getAllByText(copy.loading).length).toBeGreaterThan(0);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    await act(async () => {
      summary.resolve({
        ok: true,
        data: { status: 'completed', data: counts },
      });
      usageResult.resolve({
        ok: true,
        data: { status: 'completed', data: usage },
      });
    });

    expect(
      await within(dataSection()).findByText(copy.summary.worldsActive),
    ).toBeInTheDocument();
    expect(within(dataSection()).getByText('8')).toBeInTheDocument();
  });

  it('muestra error de resumen y reintenta', async () => {
    const getSummary = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { status: 'failed', code: 'DATA_COUNTS_FAILED' },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { status: 'completed', data: counts },
      });
    installApi(createApi({ getSummary }));
    const user = userEvent.setup();

    renderData();

    const alert = await within(dataSection()).findByRole('alert');
    expect(alert).toHaveTextContent(copy.errors.codes.DATA_COUNTS_FAILED);

    await user.click(
      within(alert).getByRole('button', {
        name: copy.retry,
      }),
    );

    await waitFor(() => {
      expect(getSummary).toHaveBeenCalledTimes(2);
    });
    expect(
      await within(dataSection()).findByText(copy.summary.worldsActive),
    ).toBeInTheDocument();
  });

  it('muestra el estado no disponible en modo seguro', async () => {
    installApi(
      createApi({
        getSummary: vi.fn(async () => ({
          ok: true as const,
          data: { status: 'failed' as const, code: 'DATA_UNAVAILABLE' },
        })),
        getUsage: vi.fn(async () => ({
          ok: true as const,
          data: { status: 'failed' as const, code: 'DATA_UNAVAILABLE' },
        })),
        planOrphans: vi.fn(async () => ({
          ok: true as const,
          data: { status: 'failed' as const, code: 'DATA_UNAVAILABLE' },
        })),
      }),
    );

    renderData();

    await waitFor(() => {
      expect(
        within(dataSection()).getAllByText(copy.unavailable).length,
      ).toBeGreaterThanOrEqual(2);
    });

    // En modo seguro no se ofrece ninguna operación que vaya a fallar.
    expect(
      screen.getByRole('button', { name: copy.export.action }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: copy.orphans.analyze }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: copy.danger.action }),
    ).toBeDisabled();
  });

  it('abre carpetas por enum y muestra el error de una carpeta', async () => {
    const openFolder = vi.fn(async (folder) =>
      folder === 'assets'
        ? {
            ok: true as const,
            data: {
              status: 'failed' as const,
              code: 'DATA_FOLDER_OPEN_FAILED' as const,
            },
          }
        : {
            ok: true as const,
            data: {
              status: 'completed' as const,
              data: { opened: true as const },
            },
          },
    );
    installApi(createApi({ openFolder }));
    const user = userEvent.setup();

    renderData();

    // Las seis carpetas están en la tabla principal, con su ruta relativa.
    for (const path of [
      'data',
      'assets',
      'backups',
      'logs',
      'imports',
      'exports',
    ]) {
      expect(
        within(dataSection()).getByText(path, { exact: true }),
      ).toBeInTheDocument();
    }
    expect(
      within(dataSection()).queryByRole('button', {
        name: copy.folders.tempTitle,
      }),
    ).toBeNull();

    const groupHeader = dataSection().querySelector('th[scope="rowgroup"]');

    expect(groupHeader).toHaveTextContent(copy.folders.tempTitle);
    expect(dataSection().querySelector('th[scope="colgroup"]')).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    await user.click(
      screen.getByRole('button', {
        name: copy.folders.open.data,
      }),
    );
    expect(openFolder).toHaveBeenCalledWith('data');

    await user.click(
      screen.getByRole('button', {
        name: copy.folders.open.assets,
      }),
    );

    expect(
      await within(dataSection()).findByText(
        copy.errors.codes.DATA_FOLDER_OPEN_FAILED,
      ),
    ).toBeInTheDocument();
  });

  it('muestra uso parcial y vuelve a calcular', async () => {
    const getUsage = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'completed' as const,
        data: { ...usage, partial: true },
      },
    }));
    installApi(createApi({ getUsage }));
    const user = userEvent.setup();

    renderData();

    await waitFor(() => {
      expect(getUsage).toHaveBeenCalledTimes(1);
    });
    await user.click(screen.getByRole('button', { name: /Uso de disco/ }));

    expect(
      within(dataSection()).getByText(copy.usage.partialBadge),
    ).toBeInTheDocument();
    expect(
      within(dataSection()).getByText(copy.usage.partialNote),
    ).toBeInTheDocument();
    expect(
      within(dataSection()).getByRole('columnheader', {
        name: copy.usage.columns.category,
      }),
    ).toBeInTheDocument();

    await user.click(
      within(dataSection()).getByRole('button', {
        name: copy.usage.recalc,
      }),
    );

    await waitFor(() => {
      expect(getUsage).toHaveBeenCalledTimes(2);
    });
  });

  it('no muestra nada si la exportación se cancela y muestra el resultado si termina', async () => {
    const exportAll = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { status: 'cancelled' },
      })
      .mockResolvedValueOnce({ ok: true, data: libraryResult });
    installApi(createApi({ exportAll }));
    const user = userEvent.setup();

    renderData();

    const button = screen.getByRole('button', {
      name: copy.export.action,
    });

    await user.click(button);

    await waitFor(() => {
      expect(exportAll).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(copy.export.resultTitle)).toBeNull();

    await user.click(button);

    const title = await screen.findByRole('heading', {
      name: copy.export.resultTitle,
    });

    expect(title).toHaveFocus();
    expectAnnouncerEmpty();
    expect(screen.getByText('biblioteca.zip')).toBeInTheDocument();
    expect(screen.getByText('2 mundos')).toBeInTheDocument();
  });

  it('bloquea el diálogo de exportación, enfoca el progreso y luego el resultado', async () => {
    const pending =
      deferred<Awaited<ReturnType<WorldCraftDataApi['exportAll']>>>();
    installApi(createApi({ exportAll: vi.fn(() => pending.promise) }));
    const user = userEvent.setup();

    renderData();

    await user.click(screen.getByRole('button', { name: copy.export.action }));

    const dialog = screen.getByRole('dialog', {
      name: copy.export.running,
    });
    const statusLabel = dialog.querySelector<HTMLElement>(
      '.wc-settings__status',
    );

    if (statusLabel === null) {
      throw new Error('Falta el estado de progreso de la exportación.');
    }

    await waitFor(() => {
      expect(statusLabel).toHaveFocus();
    });
    // El foco ya anuncia el progreso: la región viva no repite el texto.
    expectAnnouncerEmpty();
    expect(
      within(dialog).getByRole('button', {
        name: messages.components.dialog.close,
      }),
    ).toBeDisabled();
    expect(
      within(dialog).queryByRole('button', { name: copy.export.action }),
    ).toBeNull();

    await act(async () => {
      pending.resolve({ ok: true, data: libraryResult });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      await screen.findByRole('heading', {
        name: copy.export.resultTitle,
      }),
    ).toHaveFocus();
    expectAnnouncerEmpty();
  });

  it('muestra el error de exportación con su código', async () => {
    installApi(
      createApi({
        exportAll: vi.fn(async () => ({
          ok: true as const,
          data: { status: 'failed' as const, code: 'DATA_LIBRARY_NO_SPACE' },
        })),
      }),
    );
    const user = userEvent.setup();

    renderData();

    const exportButton = screen.getByRole('button', {
      name: copy.export.action,
    });

    await user.click(exportButton);

    const dialog = screen.getByRole('dialog', {
      name: copy.export.errorTitle,
    });

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      copy.errors.codes.DATA_LIBRARY_NO_SPACE,
    );
    // El error se anuncia con role="alert" y no se repite en la región viva.
    expectAnnouncerEmpty();
    await user.click(
      within(dialog).getAllByRole('button', {
        name: messages.components.dialog.close,
      })[1] as HTMLElement,
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(exportButton).toHaveFocus();
  });

  it('analiza y purga huérfanos con confirmación obligatoria', async () => {
    const purgeOrphans = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'completed' as const,
        data: { purgedFiles: 2, purgedBytes: 2048, backupCreated: true },
      },
    }));
    installApi(createApi({ purgeOrphans }));
    const user = userEvent.setup();

    renderData();

    await user.click(
      screen.getByRole('button', { name: copy.orphans.analyze }),
    );

    expect(
      await within(dataSection()).findByText(copy.orphans.rows.purgeable),
    ).toBeInTheDocument();

    await user.click(
      within(dataSection()).getByRole('button', {
        name: copy.orphans.purge,
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: copy.orphans.dialogTitle,
    });
    const confirm = within(dialog).getByRole('button', {
      name: copy.orphans.confirm,
    });

    expect(confirm).toBeDisabled();

    await user.click(
      within(dialog).getByRole('checkbox', {
        name: copy.orphans.confirmLabel,
      }),
    );
    expect(confirm).not.toBeDisabled();

    await user.click(confirm);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(purgeOrphans).toHaveBeenCalledTimes(1);
    expect(
      within(dataSection()).getByRole('heading', {
        name: copy.orphans.resultTitle,
      }),
    ).toBeInTheDocument();
    expectAnnouncerEmpty();
  });

  it('enfoca el progreso de la purga y después el resultado', async () => {
    const pending =
      deferred<Awaited<ReturnType<WorldCraftDataApi['purgeOrphans']>>>();
    installApi(createApi({ purgeOrphans: vi.fn(() => pending.promise) }));
    const user = userEvent.setup();

    renderData();

    await user.click(
      screen.getByRole('button', { name: copy.orphans.analyze }),
    );
    await within(dataSection()).findByText(copy.orphans.rows.purgeable);
    await user.click(
      within(dataSection()).getByRole('button', {
        name: copy.orphans.purge,
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: copy.orphans.dialogTitle,
    });

    await user.click(
      within(dialog).getByRole('checkbox', {
        name: copy.orphans.confirmLabel,
      }),
    );
    await user.click(
      within(dialog).getByRole('button', {
        name: copy.orphans.confirm,
      }),
    );

    const progressLabel = dialog.querySelector<HTMLElement>(
      '.wc-settings__status',
    );

    if (progressLabel === null) {
      throw new Error('Falta el estado de progreso de la purga.');
    }

    await waitFor(() => {
      expect(progressLabel).toHaveFocus();
    });
    expectAnnouncerEmpty();

    await act(async () => {
      pending.resolve({
        ok: true,
        data: {
          status: 'completed',
          data: { purgedFiles: 2, purgedBytes: 2048, backupCreated: true },
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      await within(dataSection()).findByRole('heading', {
        name: copy.orphans.resultTitle,
      }),
    ).toHaveFocus();
    expectAnnouncerEmpty();
  });

  it('mantiene el diálogo de huérfanos con error de copia', async () => {
    installApi(
      createApi({
        purgeOrphans: vi.fn(async () => ({
          ok: true as const,
          data: {
            status: 'failed' as const,
            code: 'DATA_ORPHAN_PURGE_FAILED',
          },
        })),
      }),
    );
    const user = userEvent.setup();

    renderData();

    await user.click(
      screen.getByRole('button', { name: copy.orphans.analyze }),
    );
    await within(dataSection()).findByText(copy.orphans.rows.purgeable);
    await user.click(
      within(dataSection()).getByRole('button', {
        name: copy.orphans.purge,
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: copy.orphans.dialogTitle,
    });

    await user.click(
      within(dialog).getByRole('checkbox', {
        name: copy.orphans.confirmLabel,
      }),
    );
    await user.click(
      within(dialog).getByRole('button', {
        name: copy.orphans.confirm,
      }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      copy.orphans.errorCopy,
    );
    expect(screen.getByRole('dialog')).toBe(dialog);
  });

  it('exige la frase exacta y respeta keepBackups al borrar', async () => {
    const deleteAll = vi.fn(async () => ({
      ok: true as const,
      data: deletedResult,
    }));
    installApi(createApi({ deleteAll }));
    const user = userEvent.setup();

    renderData();

    await user.click(screen.getByRole('button', { name: copy.danger.action }));

    const dialog = screen.getByRole('dialog', {
      name: copy.danger.dialogTitle,
    });
    const confirm = within(dialog).getByRole('button', {
      name: copy.danger.confirm,
    });

    expect(confirm).toBeDisabled();

    const phrase = within(dialog).getByLabelText(copy.danger.phraseLabel);

    await user.type(phrase, 'ELIMINAR');
    expect(confirm).toBeDisabled();
    expect(
      within(dialog).getByText(copy.danger.phraseError),
    ).toBeInTheDocument();

    await user.clear(phrase);
    await user.type(phrase, '  ELIMINAR TODO  ');
    expect(confirm).not.toBeDisabled();

    const keepBackups = within(dialog).getByRole('checkbox', {
      name: copy.danger.keepBackupsLabel,
    });

    expect(keepBackups).not.toBeChecked();
    await user.click(keepBackups);
    await user.click(confirm);

    await waitFor(() => {
      expect(deleteAll).toHaveBeenCalledWith({ keepBackups: true });
    });

    const result = await within(dialog).findByRole('heading', {
      name: copy.danger.doneTitle,
    });

    expect(result).toHaveFocus();
    expectAnnouncerEmpty();
    expect(within(dialog).getByText(copy.danger.doneBody)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: copy.danger.cancel }),
    ).toBeNull();
  });

  it('mantiene el diálogo de borrado con error de copia', async () => {
    installApi(
      createApi({
        deleteAll: vi.fn(async () => ({
          ok: true as const,
          data: {
            status: 'failed' as const,
            code: 'DATA_DELETE_COPY_FAILED',
          },
        })),
      }),
    );
    const user = userEvent.setup();

    renderData();

    await user.click(screen.getByRole('button', { name: copy.danger.action }));
    const dialog = screen.getByRole('dialog', {
      name: copy.danger.dialogTitle,
    });

    await user.type(
      within(dialog).getByLabelText(copy.danger.phraseLabel),
      'ELIMINAR TODO',
    );
    await user.click(
      within(dialog).getByRole('button', { name: copy.danger.confirm }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      copy.danger.error,
    );
    expect(screen.getByRole('dialog')).toBe(dialog);
  });

  it('traduce los errores de borrado que no son de copia', async () => {
    installApi(
      createApi({
        deleteAll: vi.fn(async () => ({
          ok: true as const,
          data: {
            status: 'failed' as const,
            code: 'DATA_DELETE_FAILED',
          },
        })),
      }),
    );
    const user = userEvent.setup();

    renderData();

    await user.click(screen.getByRole('button', { name: copy.danger.action }));
    const dialog = screen.getByRole('dialog', {
      name: copy.danger.dialogTitle,
    });

    await user.type(
      within(dialog).getByLabelText(copy.danger.phraseLabel),
      'ELIMINAR TODO',
    );
    await user.click(
      within(dialog).getByRole('button', { name: copy.danger.confirm }),
    );

    const alert = await within(dialog).findByRole('alert');

    expect(alert).toHaveTextContent(copy.errors.codes.DATA_DELETE_FAILED);
    expect(alert).not.toHaveTextContent(copy.danger.error);
  });

  it('explica un borrado parcial y sus categorías restantes', async () => {
    installApi(
      createApi({
        deleteAll: vi.fn(async () => ({
          ok: true as const,
          data: {
            status: 'partial' as const,
            restartRequired: true,
            counts: deleteCounts,
            remaining: ['logs'] as const,
          },
        })),
      }),
    );
    const user = userEvent.setup();

    renderData();

    await user.click(screen.getByRole('button', { name: copy.danger.action }));
    const dialog = screen.getByRole('dialog', {
      name: copy.danger.dialogTitle,
    });

    await user.type(
      within(dialog).getByLabelText(copy.danger.phraseLabel),
      'ELIMINAR TODO',
    );
    await user.click(
      within(dialog).getByRole('button', { name: copy.danger.confirm }),
    );

    expect(
      await within(dialog).findByRole('heading', {
        name: copy.danger.partialTitle,
      }),
    ).toBeInTheDocument();
    expectAnnouncerEmpty();
    expect(
      within(dialog).getByText(copy.danger.categories.logs),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(copy.danger.partialRestartBody),
    ).toBeInTheDocument();
  });

  it('devuelve el foco al disparador al cancelar diálogos condicionales', async () => {
    const user = userEvent.setup();

    renderData();

    await user.click(
      screen.getByRole('button', { name: copy.orphans.analyze }),
    );
    await within(dataSection()).findByText(copy.orphans.rows.purgeable);

    const purgeButton = within(dataSection()).getByRole('button', {
      name: copy.orphans.purge,
    });

    await user.click(purgeButton);

    const orphansDialog = screen.getByRole('dialog', {
      name: copy.orphans.dialogTitle,
    });

    await user.click(
      within(orphansDialog).getByRole('button', {
        name: copy.orphans.cancel,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(purgeButton).toHaveFocus();

    const dangerButton = screen.getByRole('button', {
      name: copy.danger.action,
    });

    await user.click(dangerButton);

    const deleteDialog = screen.getByRole('dialog', {
      name: copy.danger.dialogTitle,
    });

    await user.click(
      within(deleteDialog).getByRole('button', {
        name: copy.danger.cancel,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(dangerButton).toHaveFocus();
  });

  it('anuncia DATA_BUSY sin reintentar', async () => {
    const onNotify = vi.fn();
    installApi(
      createApi({
        exportAll: vi.fn(async () => ({
          ok: true as const,
          data: { status: 'failed' as const, code: 'DATA_BUSY' },
        })),
      }),
    );
    const user = userEvent.setup();

    renderData(onNotify);

    await user.click(screen.getByRole('button', { name: copy.export.action }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        'error',
        copy.errors.codes.DATA_BUSY,
      );
    });
    expect(screen.getByText(copy.errors.codes.DATA_BUSY)).toBeInTheDocument();
  });

  it('no tiene violaciones críticas de axe con los datos listos', async () => {
    renderData();

    await within(dataSection()).findByText(copy.summary.worldsActive);

    for (const theme of ['light', 'dark'] as const) {
      document.documentElement.dataset.theme = theme;
      const results = await axe.run(dataSection(), {
        rules: { 'color-contrast': { enabled: false } },
      });

      expect(
        results.violations.filter(
          (violation) => violation.impact === 'critical',
        ),
      ).toEqual([]);
    }
  });
});
