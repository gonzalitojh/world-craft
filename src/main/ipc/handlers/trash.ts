/**
 * Handlers IPC de la papelera.
 *
 * El router valida la forma con Zod. Los fallos de negocio viajan como
 * `restored:false` o `purged:false` con un motivo estable; aquí no se lanzan ni
 * se filtran detalles internos (ADR 0004).
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { TrashService } from '../../trash/service';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  trashEmptyPayloadSchema,
  trashListPayloadSchema,
  trashPurgePayloadSchema,
  trashRestorePayloadSchema,
  type TrashEmptyPayload,
  type TrashListPayload,
  type TrashPurgePayload,
  type TrashRestorePayload,
} from '../schemas/trash';

/** Canales que atiende este módulo. */
export type TrashIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.trashList
  | typeof IPC_CHANNELS.trashRestore
  | typeof IPC_CHANNELS.trashPurge
  | typeof IPC_CHANNELS.trashEmpty
>;

/** Construye los handlers de los canales de la papelera. */
export function createTrashIpcHandlers(
  service: TrashService,
): TrashIpcHandlers {
  return {
    [IPC_CHANNELS.trashList]: defineIpcHandler<TrashListPayload>({
      schema: trashListPayloadSchema,
      handle: (payload) => service.list(payload),
    }),

    [IPC_CHANNELS.trashRestore]: defineIpcHandler<TrashRestorePayload>({
      schema: trashRestorePayloadSchema,
      handle: (payload) => service.restore(payload),
    }),

    [IPC_CHANNELS.trashPurge]: defineIpcHandler<TrashPurgePayload>({
      schema: trashPurgePayloadSchema,
      handle: (payload) => service.purge(payload),
    }),

    [IPC_CHANNELS.trashEmpty]: defineIpcHandler<TrashEmptyPayload>({
      schema: trashEmptyPayloadSchema,
      handle: (payload) => service.empty(payload),
    }),
  };
}
