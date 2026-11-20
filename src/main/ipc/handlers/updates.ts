/**
 * Handlers de los canales de actualizaciones.
 *
 * No reciben datos del renderer más allá de un objeto vacío validado con Zod.
 * Cada orden devuelve el snapshot del servicio; el servicio decide si la
 * transición es válida y nunca expone mensajes internos.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { IpcHandlers } from '../registry';
import { defineIpcHandler } from '../registry';
import {
  updateCommandSchema,
  type UpdateCommandPayload,
} from '../schemas/updates';
import type { UpdatesService } from '../../updates/service';

/** Subconjunto del mapa IPC que atiende el actualizador. */
export type UpdateIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.updatesGetState
  | typeof IPC_CHANNELS.updatesCheck
  | typeof IPC_CHANNELS.updatesCancel
  | typeof IPC_CHANNELS.updatesDownload
  | typeof IPC_CHANNELS.updatesInstall
>;

/** Construye los handlers a partir del servicio compuesto. */
export function createUpdateIpcHandlers(
  service: UpdatesService,
): UpdateIpcHandlers {
  const command = (
    action: () => unknown,
  ): ReturnType<typeof defineIpcHandler<UpdateCommandPayload>> =>
    defineIpcHandler<UpdateCommandPayload>({
      schema: updateCommandSchema,
      handle: () => action(),
    });

  return {
    [IPC_CHANNELS.updatesGetState]: command(() => service.getState()),
    [IPC_CHANNELS.updatesCheck]: command(() => service.check()),
    [IPC_CHANNELS.updatesCancel]: command(() => service.cancel()),
    [IPC_CHANNELS.updatesDownload]: command(() => service.download()),
    [IPC_CHANNELS.updatesInstall]: command(() => service.install()),
  };
}
