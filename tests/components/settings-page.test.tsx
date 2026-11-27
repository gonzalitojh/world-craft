import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import { SettingsPage } from '@/renderer/pages/settings-page';
import { UpdatesProvider } from '@/renderer/updates/use-updates';
import {
  applyUiPreferencesPatch,
  createDefaultUiPreferences,
  type UiPreferences,
  type UiPreferencesPatch,
} from '@/shared/contracts/preferences';
import { createIdleUpdateSnapshot } from '@/shared/contracts/updates';
import type { WorldCraftApi } from '@/shared/contracts/world-craft-api';

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

beforeEach(() => {
  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: {
      appInfo: { version: '0.1.0' },
      updates: {
        getState: async () => ({
          ok: true,
          data: createIdleUpdateSnapshot('0.1.0'),
        }),
        onStateChanged: () => () => {},
      },
      data: {
        getSummary: async () => ({
          ok: true,
          data: {
            status: 'completed',
            data: {
              worlds: { active: 1, archived: 0, trash: 0 },
              entities: 2,
              assets: 3,
              backups: 1,
              quarantine: { assets: 0, references: 0 },
            },
          },
        }),
        getUsage: async () => ({
          ok: true,
          data: {
            status: 'completed',
            data: {
              totalBytes: 10,
              totalEntries: 2,
              partial: false,
              categories: {
                database: { bytes: 10, entries: 2, partial: false },
                assets: { bytes: 0, entries: 0, partial: false },
                backups: { bytes: 0, entries: 0, partial: false },
                logs: { bytes: 0, entries: 0, partial: false },
                temporary: { bytes: 0, entries: 0, partial: false },
              },
            },
          },
        }),
        openFolder: async () => ({
          ok: true,
          data: { status: 'completed', data: { opened: true } },
        }),
        exportAll: async () => ({ ok: true, data: { status: 'cancelled' } }),
        deleteAll: async () => ({
          ok: true,
          data: {
            status: 'deleted',
            restartRequired: true,
            counts: {
              databaseFiles: 0,
              assetFiles: 0,
              logEntries: 0,
              temporaryEntries: 0,
              backupDirectories: 0,
            },
            remaining: [],
          },
        }),
        planOrphans: async () => ({
          ok: true,
          data: {
            status: 'completed',
            data: {
              purgeableFiles: 0,
              unreferencedFiles: 0,
              orphanThumbnails: 0,
              temporaryFiles: 0,
              missingFiles: 0,
              unexpectedEntries: 0,
              suspiciousLinks: 0,
              recoverableBytes: 0,
            },
          },
        }),
        purgeOrphans: async () => ({
          ok: true,
          data: {
            status: 'completed',
            data: {
              purgedFiles: 0,
              purgedBytes: 0,
              backupCreated: false,
            },
          },
        }),
      },
    } satisfies Partial<WorldCraftApi>,
  });
});

interface HarnessProps {
  readonly initial?: UiPreferences;
  readonly onReset: () => void;
  readonly onUpdate?: (patch: UiPreferencesPatch) => void;
}

function Harness({ initial, onReset, onUpdate }: HarnessProps) {
  const [preferences, setPreferences] = useState(
    initial ?? createDefaultUiPreferences(),
  );

  return (
    <I18nProvider locale="es">
      <UpdatesProvider>
        <SettingsPage
          preferences={preferences}
          onUpdate={(patch) => {
            onUpdate?.(patch);
            setPreferences((current) =>
              applyUiPreferencesPatch(current, patch),
            );
          }}
          onReset={onReset}
        />
      </UpdatesProvider>
    </I18nProvider>
  );
}

function section(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Falta la sección ${id}`);
  }

  return element;
}

describe('página de Ajustes', () => {
  it('respeta el orden editorial de las secciones', () => {
    render(<Harness onReset={vi.fn()} />);

    expect(
      [...document.querySelectorAll('.wc-page--settings > section[id]')].map(
        (element) => element.id,
      ),
    ).toEqual([
      'apariencia',
      'idioma',
      'wc-settings-shortcuts',
      'actualizaciones',
      'datos',
      'restablecer',
    ]);
  });

  it('cambia tema, densidad y tamaño desde radios con fieldset y legend', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(<Harness onUpdate={onUpdate} onReset={vi.fn()} />);

    const appearance = section('apariencia');
    const groups = within(appearance).getAllByRole('group');

    expect(groups).toHaveLength(3);
    expect(
      within(appearance).getByRole('group', {
        name: messages.settings.appearance.theme.legend,
      }),
    ).toBeInTheDocument();
    expect(
      within(appearance).getByRole('group', {
        name: messages.settings.appearance.density.legend,
      }),
    ).toBeInTheDocument();
    expect(
      within(appearance).getByRole('group', {
        name: messages.settings.appearance.fontScale.legend,
      }),
    ).toBeInTheDocument();

    await user.click(
      within(appearance).getByRole('radio', {
        name: messages.settings.appearance.theme.dark,
      }),
    );
    await user.click(
      within(appearance).getByRole('radio', {
        name: messages.settings.appearance.density.compact,
      }),
    );
    await user.click(
      within(appearance).getByRole('radio', {
        name: messages.settings.appearance.fontScale.large,
      }),
    );

    expect(
      within(appearance).getByRole('radio', {
        name: messages.settings.appearance.theme.dark,
      }),
    ).toBeChecked();
    expect(
      within(appearance).getByRole('radio', {
        name: messages.settings.appearance.density.compact,
      }),
    ).toBeChecked();
    expect(
      within(appearance).getByRole('radio', {
        name: messages.settings.appearance.fontScale.large,
      }),
    ).toBeChecked();
    expect(onUpdate).toHaveBeenCalledWith({ theme: 'dark' });
    expect(onUpdate).toHaveBeenCalledWith({ density: 'compact' });
    expect(onUpdate).toHaveBeenCalledWith({ fontScale: 'large' });
  });

  it('restablece la apariencia con update, no con reset, y lo anuncia', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onReset = vi.fn();

    render(
      <Harness
        initial={applyUiPreferencesPatch(createDefaultUiPreferences(), {
          theme: 'dark',
          density: 'compact',
          fontScale: 'large',
        })}
        onUpdate={onUpdate}
        onReset={onReset}
      />,
    );

    const appearance = section('apariencia');

    await user.click(
      within(appearance).getByRole('button', {
        name: messages.settings.appearance.reset,
      }),
    );

    expect(onUpdate).toHaveBeenCalledWith({
      theme: 'light',
      density: 'comfortable',
      fontScale: 'normal',
    });
    expect(onReset).not.toHaveBeenCalled();
    expect(
      within(appearance).getByRole('radio', {
        name: messages.settings.appearance.theme.light,
      }),
    ).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent(
      messages.settings.appearance.resetDone,
    );
  });

  it('muestra el idioma como dato informativo, sin selector', () => {
    render(<Harness onReset={vi.fn()} />);

    const language = section('idioma');

    expect(
      within(language).getByText(messages.settings.language.current),
    ).toBeInTheDocument();
    expect(within(language).queryByRole('combobox')).toBeNull();
    expect(within(language).queryByRole('listbox')).toBeNull();
    expect(within(language).queryByRole('button')).toBeNull();
  });

  it('pliega los atajos y los muestra en una tabla de solo lectura', async () => {
    const user = userEvent.setup();

    render(<Harness onReset={vi.fn()} />);

    const shortcuts = section('wc-settings-shortcuts');

    expect(within(shortcuts).queryByRole('table')).toBeNull();

    await user.click(within(shortcuts).getByRole('button'));

    const table = within(shortcuts).getByRole('table');

    expect(
      within(table).getByRole('columnheader', {
        name: messages.settings.shortcuts.columns.action,
      }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('rowheader', {
        name: messages.settings.shortcuts.rows.palette,
      }),
    ).toBeInTheDocument();
    expect(
      within(shortcuts).getByText(messages.settings.shortcuts.editorNote),
    ).toBeInTheDocument();
  });

  it('muestra la versión y el estado de actualizaciones y abre el diálogo', async () => {
    const user = userEvent.setup();

    render(<Harness onReset={vi.fn()} />);

    const updates = section('actualizaciones');

    expect(within(updates).getByText('0.1.0')).toBeInTheDocument();
    expect(
      within(updates).getByText(messages.updates.statuses.idle),
    ).toBeInTheDocument();

    await user.click(
      within(updates).getByRole('button', {
        name: messages.settings.updates.open,
      }),
    );

    expect(
      screen.getByRole('dialog', { name: messages.updates.title }),
    ).toBeInTheDocument();
  });

  it('incluye la sección real de Datos con sus acciones principales', () => {
    render(<Harness onReset={vi.fn()} />);

    const data = section('datos');

    expect(
      within(data).getByRole('button', {
        name: messages.settings.data.export.action,
      }),
    ).toBeInTheDocument();
    expect(
      within(data).getByRole('button', {
        name: messages.settings.data.orphans.analyze,
      }),
    ).toBeInTheDocument();
    expect(
      within(data).getByRole('button', {
        name: messages.settings.data.danger.action,
      }),
    ).toBeInTheDocument();
  });

  it('restablece las preferencias solo tras confirmar en el diálogo', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(<Harness onReset={onReset} />);

    const resetSection = section('restablecer');

    await user.click(
      within(resetSection).getByRole('button', {
        name: messages.settings.resetPreferences.action,
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: messages.settings.resetPreferences.dialogTitle,
    });

    expect(dialog).toHaveTextContent(
      messages.settings.resetPreferences.dialogBody,
    );
    expect(
      within(dialog).getByRole('button', {
        name: messages.settings.resetPreferences.cancel,
      }),
    ).toHaveFocus();

    await user.click(
      within(dialog).getByRole('button', {
        name: messages.settings.resetPreferences.confirm,
      }),
    );

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
