/**
 * Handlers IPC de las preferencias de interfaz.
 *
 * El router valida la forma; aquí se traduce un rechazo de dominio a
 * `INVALID_INPUT` y se delega en el servicio. Cualquier otra excepción se
 * convierte en `INTERNAL_ERROR` sin filtrar valores.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import { PreferencesInputError } from '../../preferences/errors';
import type { PreferencesService } from '../../preferences/service';
import { IpcInputError } from '../errors';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  preferencesEmptyPayloadSchema,
  preferencesUpdatePayloadSchema,
  type PreferencesEmptyPayload,
  type PreferencesUpdatePayload,
} from '../schemas/preferences';

/** Canales que atiende este módulo. */
export type PreferencesIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.preferencesGet
  | typeof IPC_CHANNELS.preferencesUpdate
  | typeof IPC_CHANNELS.preferencesReset
>;

function runPreferencesOperation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PreferencesInputError) {
      throw new IpcInputError();
    }

    throw error;
  }
}

/** Construye los handlers de los canales de preferencias. */
export function createPreferencesIpcHandlers(
  service: PreferencesService,
): PreferencesIpcHandlers {
  return {
    [IPC_CHANNELS.preferencesGet]: defineIpcHandler<PreferencesEmptyPayload>({
      schema: preferencesEmptyPayloadSchema,
      handle: () => service.get(),
    }),

    [IPC_CHANNELS.preferencesUpdate]:
      defineIpcHandler<PreferencesUpdatePayload>({
        schema: preferencesUpdatePayloadSchema,
        handle: (payload) =>
          runPreferencesOperation(() => service.update(payload)),
      }),

    [IPC_CHANNELS.preferencesReset]: defineIpcHandler<PreferencesEmptyPayload>({
      schema: preferencesEmptyPayloadSchema,
      handle: () => runPreferencesOperation(() => service.reset()),
    }),
  };
}
