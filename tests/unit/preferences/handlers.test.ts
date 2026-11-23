import { describe, expect, it, vi } from 'vitest';

import { IpcInputError } from '@/main/ipc/errors';
import { createPreferencesIpcHandlers } from '@/main/ipc/handlers/preferences';
import { PreferencesInputError } from '@/main/preferences/errors';
import type { PreferencesService } from '@/main/preferences/service';
import { IPC_CHANNELS } from '@/shared/contracts/channels';
import {
  createDefaultUiPreferences,
  type UiPreferences,
} from '@/shared/contracts/preferences';

const selected: UiPreferences = {
  ...createDefaultUiPreferences(),
  theme: 'dark',
  railCollapsed: true,
};

function createService(overrides: Partial<PreferencesService> = {}): PreferencesService {
  return {
    get: () => selected,
    update: () => selected,
    reset: () => createDefaultUiPreferences(),
    ...overrides,
  };
}

describe('handlers IPC de preferencias', () => {
  it('delega get, update y reset en el servicio', async () => {
    const get = vi.fn(() => selected);
    const update = vi.fn(() => selected);
    const reset = vi.fn(() => createDefaultUiPreferences());
    const handlers = createPreferencesIpcHandlers(
      createService({ get, update, reset }),
    );

    expect(handlers[IPC_CHANNELS.preferencesGet].handle({})).toEqual(selected);
    expect(get).toHaveBeenCalledTimes(1);

    expect(
      handlers[IPC_CHANNELS.preferencesUpdate].handle({ theme: 'dark' }),
    ).toEqual(selected);
    expect(update).toHaveBeenCalledWith({ theme: 'dark' });

    expect(handlers[IPC_CHANNELS.preferencesReset].handle({})).toEqual(
      createDefaultUiPreferences(),
    );
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('traduce un rechazo de dominio a IpcInputError', async () => {
    const handlers = createPreferencesIpcHandlers(
      createService({
        update: () => {
          throw new PreferencesInputError();
        },
      }),
    );

    expect(() =>
      handlers[IPC_CHANNELS.preferencesUpdate].handle({ theme: 'dark' }),
    ).toThrow(IpcInputError);
  });

  it('no filtra una excepción interna y la deja propagar al router', async () => {
    const handlers = createPreferencesIpcHandlers(
      createService({
        reset: () => {
          throw new Error('C:\\datos\\db.sqlite abc1234');
        },
      }),
    );

    expect(() =>
      handlers[IPC_CHANNELS.preferencesReset].handle({}),
    ).toThrow('db.sqlite');
  });

  it('exige un objeto vacío estricto y un parche con al menos una clave', () => {
    const handlers = createPreferencesIpcHandlers(createService());

    expect(
      handlers[IPC_CHANNELS.preferencesGet].schema.safeParse({}).success,
    ).toBe(true);
    expect(
      handlers[IPC_CHANNELS.preferencesGet].schema.safeParse({ extra: true })
        .success,
    ).toBe(false);
    expect(
      handlers[IPC_CHANNELS.preferencesUpdate].schema.safeParse({}).success,
    ).toBe(false);
    expect(
      handlers[IPC_CHANNELS.preferencesUpdate].schema.safeParse({
        theme: 'sepia',
      }).success,
    ).toBe(false);
    expect(
      handlers[IPC_CHANNELS.preferencesUpdate].schema.safeParse({
        theme: 'dark',
      }).success,
    ).toBe(true);
  });
});
