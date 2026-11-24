/**
 * Handlers IPC del historial de versiones.
 *
 * El router valida la forma con Zod. Los fallos de dominio (`not-found`,
 * `unchanged`, `manual-limit`) se devuelven como resultado tipado; un fallo
 * real de la base queda como `INTERNAL_ERROR` sin filtrar detalles.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { VersionsService } from '../../versions/service';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  versionCreatePayloadSchema,
  versionListPayloadSchema,
  versionRestorePayloadSchema,
  type VersionCreatePayload,
  type VersionListPayload,
  type VersionRestorePayload,
} from '../schemas/versions';

/** Canales que atiende este módulo. */
export type VersionsIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.versionsList
  | typeof IPC_CHANNELS.versionsCreate
  | typeof IPC_CHANNELS.versionsRestore
>;

/** Construye los handlers de los canales del historial de versiones. */
export function createVersionsIpcHandlers(
  service: VersionsService,
): VersionsIpcHandlers {
  return {
    [IPC_CHANNELS.versionsList]: defineIpcHandler<VersionListPayload>({
      schema: versionListPayloadSchema,
      handle: (payload) => service.list(payload),
    }),

    [IPC_CHANNELS.versionsCreate]: defineIpcHandler<VersionCreatePayload>({
      schema: versionCreatePayloadSchema,
      handle: (payload) => service.create(payload),
    }),

    [IPC_CHANNELS.versionsRestore]: defineIpcHandler<VersionRestorePayload>({
      schema: versionRestorePayloadSchema,
      handle: (payload) => service.restore(payload),
    }),
  };
}
