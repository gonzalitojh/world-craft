import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import { UpdatesProvider, useUpdates } from '@/renderer/updates/use-updates';
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

const getState = vi.fn(async () => ({
  ok: true as const,
  data: createIdleUpdateSnapshot('0.1.0'),
}));
const onStateChanged = vi.fn(() => () => {});

beforeEach(() => {
  getState.mockClear();
  onStateChanged.mockClear();
  Object.defineProperty(window, 'worldCraft', {
    configurable: true,
    value: {
      appInfo: { version: '0.1.0' },
      updates: { getState, onStateChanged },
    } satisfies Partial<WorldCraftApi>,
  });
});

function Consumer({ label }: { readonly label: string }) {
  const { snapshot, openDialog } = useUpdates();

  return (
    <button type="button" onClick={openDialog}>
      {label} {snapshot.currentVersion}
    </button>
  );
}

describe('estado compartido de actualizaciones', () => {
  it('una sola suscripción alimenta a varios consumidores', async () => {
    render(
      <I18nProvider locale="es">
        <UpdatesProvider>
          <Consumer label="Barra" />
          <Consumer label="Ajustes" />
        </UpdatesProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(getState).toHaveBeenCalledTimes(1);
    });
    expect(onStateChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Barra 0.1.0' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ajustes 0.1.0' })).toBeVisible();
  });

  it('abre un único diálogo desde cualquiera de los disparadores', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider locale="es">
        <UpdatesProvider>
          <Consumer label="Barra" />
          <Consumer label="Ajustes" />
        </UpdatesProvider>
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Ajustes 0.1.0' }));

    expect(
      screen.getByRole('dialog', { name: messages.updates.title }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
