/**
 * Handlers IPC de los mundos.
 *
 * El router valida la forma con Zod; aquí se traducen los errores de dominio a
 * `INVALID_INPUT` y se delega en el servicio. Ningún mensaje, ruta ni valor de
 * la base sale al renderer (ADR 0004).
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { WorldsService } from '../../worlds/service';
import { WorldInputError } from '../../worlds/errors';
import { IpcInputError } from '../errors';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  worldCreatePayloadSchema,
  worldDuplicatePayloadSchema,
  worldGetPayloadSchema,
  worldListActivityPayloadSchema,
  worldRemovePayloadSchema,
  worldSetArchivedPayloadSchema,
  worldSetCoverPayloadSchema,
  worldUpdatePayloadSchema,
  worldsListPayloadSchema,
  type WorldCreatePayload,
  type WorldDuplicatePayload,
  type WorldGetPayload,
  type WorldListActivityPayload,
  type WorldRemovePayload,
  type WorldSetArchivedPayload,
  type WorldSetCoverPayload,
  type WorldUpdatePayload,
  type WorldsListPayload,
} from '../schemas/worlds';

/** Canales que atiende este módulo. */
export type WorldsIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.worldsList
  | typeof IPC_CHANNELS.worldsGet
  | typeof IPC_CHANNELS.worldsCreate
  | typeof IPC_CHANNELS.worldsUpdate
  | typeof IPC_CHANNELS.worldsDuplicate
  | typeof IPC_CHANNELS.worldsSetArchived
  | typeof IPC_CHANNELS.worldsSetCover
  | typeof IPC_CHANNELS.worldsRemove
  | typeof IPC_CHANNELS.worldsListActivity
>;

/**
 * Ejecuta una operación de dominio traduciendo el error de validación.
 *
 * El resto de excepciones se propagan y el router las convierte en
 * `INTERNAL_ERROR` sin filtrar detalles.
 */
function runWorldOperation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof WorldInputError) {
      throw new IpcInputError();
    }

    throw error;
  }
}

/** Construye los handlers de los canales de mundos. */
export function createWorldIpcHandlers(
  service: WorldsService,
): WorldsIpcHandlers {
  return {
    [IPC_CHANNELS.worldsList]: defineIpcHandler<WorldsListPayload>({
      schema: worldsListPayloadSchema,
      handle: () => service.list(),
    }),

    [IPC_CHANNELS.worldsGet]: defineIpcHandler<WorldGetPayload>({
      schema: worldGetPayloadSchema,
      handle: (payload) => service.get(payload.id),
    }),

    [IPC_CHANNELS.worldsCreate]: defineIpcHandler<WorldCreatePayload>({
      schema: worldCreatePayloadSchema,
      handle: (payload) => runWorldOperation(() => service.create(payload)),
    }),

    [IPC_CHANNELS.worldsUpdate]: defineIpcHandler<WorldUpdatePayload>({
      schema: worldUpdatePayloadSchema,
      handle: (payload) => runWorldOperation(() => service.update(payload)),
    }),

    [IPC_CHANNELS.worldsDuplicate]: defineIpcHandler<WorldDuplicatePayload>({
      schema: worldDuplicatePayloadSchema,
      handle: (payload) => runWorldOperation(() => service.duplicate(payload)),
    }),

    [IPC_CHANNELS.worldsSetArchived]: defineIpcHandler<WorldSetArchivedPayload>(
      {
        schema: worldSetArchivedPayloadSchema,
        handle: (payload) =>
          runWorldOperation(() => service.setArchived(payload)),
      },
    ),

    [IPC_CHANNELS.worldsSetCover]: defineIpcHandler<WorldSetCoverPayload>({
      schema: worldSetCoverPayloadSchema,
      handle: (payload) => runWorldOperation(() => service.setCover(payload)),
    }),

    [IPC_CHANNELS.worldsRemove]: defineIpcHandler<WorldRemovePayload>({
      schema: worldRemovePayloadSchema,
      handle: (payload) => ({ deleted: service.remove(payload.id) }),
    }),

    [IPC_CHANNELS.worldsListActivity]:
      defineIpcHandler<WorldListActivityPayload>({
        schema: worldListActivityPayloadSchema,
        handle: (payload) => service.listActivity(payload),
      }),
  };
}
