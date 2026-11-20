/**
 * Handlers IPC de los tipos de entidad.
 *
 * El router valida la forma con Zod; aquí se traducen los errores de dominio a
 * `INVALID_INPUT` y se delega en el servicio. Ningún mensaje, ruta ni valor de
 * la base sale al renderer (ADR 0004).
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { EntityTypesService } from '../../entity-types/service';
import { EntityTypeInputError } from '../../entity-types/errors';
import { IpcInputError } from '../errors';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  entityTypeCreatePayloadSchema,
  entityTypeDuplicatePayloadSchema,
  entityTypeRemovePayloadSchema,
  entityTypeUpdatePayloadSchema,
  entityTypesListPayloadSchema,
  type EntityTypeCreatePayload,
  type EntityTypeDuplicatePayload,
  type EntityTypeRemovePayload,
  type EntityTypeUpdatePayload,
  type EntityTypesListPayload,
} from '../schemas/entity-types';

/** Canales que atiende este módulo. */
export type EntityTypesIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.entityTypesList
  | typeof IPC_CHANNELS.entityTypesCreate
  | typeof IPC_CHANNELS.entityTypesUpdate
  | typeof IPC_CHANNELS.entityTypesDuplicate
  | typeof IPC_CHANNELS.entityTypesRemove
>;

function runEntityTypeOperation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof EntityTypeInputError) {
      throw new IpcInputError();
    }

    throw error;
  }
}

/** Construye los handlers de los canales de tipos de entidad. */
export function createEntityTypeIpcHandlers(
  service: EntityTypesService,
): EntityTypesIpcHandlers {
  return {
    [IPC_CHANNELS.entityTypesList]: defineIpcHandler<EntityTypesListPayload>({
      schema: entityTypesListPayloadSchema,
      handle: (payload) => service.list(payload.worldId),
    }),

    [IPC_CHANNELS.entityTypesCreate]: defineIpcHandler<EntityTypeCreatePayload>(
      {
        schema: entityTypeCreatePayloadSchema,
        handle: (payload) =>
          runEntityTypeOperation(() => service.create(payload)),
      },
    ),

    [IPC_CHANNELS.entityTypesUpdate]: defineIpcHandler<EntityTypeUpdatePayload>(
      {
        schema: entityTypeUpdatePayloadSchema,
        handle: (payload) =>
          runEntityTypeOperation(() => service.update(payload)),
      },
    ),

    [IPC_CHANNELS.entityTypesDuplicate]:
      defineIpcHandler<EntityTypeDuplicatePayload>({
        schema: entityTypeDuplicatePayloadSchema,
        handle: (payload) =>
          runEntityTypeOperation(() => service.duplicate(payload)),
      }),

    [IPC_CHANNELS.entityTypesRemove]: defineIpcHandler<EntityTypeRemovePayload>(
      {
        schema: entityTypeRemovePayloadSchema,
        handle: (payload) =>
          runEntityTypeOperation(() => service.remove(payload)),
      },
    ),
  };
}
