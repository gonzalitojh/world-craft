/**
 * Handlers IPC de relaciones y de sus tipos.
 *
 * El router valida la forma con Zod; aquí se traducen los errores de dominio a
 * `INVALID_INPUT` y se delega en el servicio. Ningún mensaje, ruta ni valor de
 * la base sale al renderer (ADR 0004).
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type {
  RelationCreateInput,
  RelationTypeCreateInput,
  RelationTypeUpdateInput,
  RelationUpdateInput,
} from '../../../shared/contracts/relations';
import type { RelationsService } from '../../relations/service';
import { RelationInputError } from '../../relations/errors';
import { IpcInputError } from '../errors';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  relationCreatePayloadSchema,
  relationRemovePayloadSchema,
  relationTypeCreatePayloadSchema,
  relationTypeRemovePayloadSchema,
  relationTypesListPayloadSchema,
  relationTypeUpdatePayloadSchema,
  relationUpdatePayloadSchema,
  relationsListPayloadSchema,
  type RelationCreatePayload,
  type RelationRemovePayload,
  type RelationTypeCreatePayload,
  type RelationTypeRemovePayload,
  type RelationTypesListPayload,
  type RelationTypeUpdatePayload,
  type RelationUpdatePayload,
  type RelationsListPayload,
} from '../schemas/relations';

/** Canales que atiende este módulo. */
export type RelationsIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.relationTypesList
  | typeof IPC_CHANNELS.relationTypesCreate
  | typeof IPC_CHANNELS.relationTypesUpdate
  | typeof IPC_CHANNELS.relationTypesRemove
  | typeof IPC_CHANNELS.relationsList
  | typeof IPC_CHANNELS.relationsCreate
  | typeof IPC_CHANNELS.relationsUpdate
  | typeof IPC_CHANNELS.relationsRemove
>;

function runRelationOperation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof RelationInputError) {
      throw new IpcInputError();
    }

    throw error;
  }
}

/** Construye los handlers de los canales de relaciones. */
export function createRelationIpcHandlers(
  service: RelationsService,
): RelationsIpcHandlers {
  return {
    [IPC_CHANNELS.relationTypesList]:
      defineIpcHandler<RelationTypesListPayload>({
        schema: relationTypesListPayloadSchema,
        handle: (payload) =>
          runRelationOperation(() => service.listTypes(payload.worldId)),
      }),

    [IPC_CHANNELS.relationTypesCreate]:
      defineIpcHandler<RelationTypeCreatePayload>({
        schema: relationTypeCreatePayloadSchema,
        handle: (payload) =>
          runRelationOperation(() =>
            service.createType(payload as RelationTypeCreateInput),
          ),
      }),

    [IPC_CHANNELS.relationTypesUpdate]:
      defineIpcHandler<RelationTypeUpdatePayload>({
        schema: relationTypeUpdatePayloadSchema,
        handle: (payload) =>
          runRelationOperation(() =>
            service.updateType(payload as RelationTypeUpdateInput),
          ),
      }),

    [IPC_CHANNELS.relationTypesRemove]:
      defineIpcHandler<RelationTypeRemovePayload>({
        schema: relationTypeRemovePayloadSchema,
        handle: (payload) =>
          runRelationOperation(() => service.removeType(payload)),
      }),

    [IPC_CHANNELS.relationsList]: defineIpcHandler<RelationsListPayload>({
      schema: relationsListPayloadSchema,
      handle: (payload) => runRelationOperation(() => service.list(payload)),
    }),

    [IPC_CHANNELS.relationsCreate]: defineIpcHandler<RelationCreatePayload>({
      schema: relationCreatePayloadSchema,
      handle: (payload) =>
        runRelationOperation(() =>
          service.create(payload as RelationCreateInput),
        ),
    }),

    [IPC_CHANNELS.relationsUpdate]: defineIpcHandler<RelationUpdatePayload>({
      schema: relationUpdatePayloadSchema,
      handle: (payload) =>
        runRelationOperation(() =>
          service.update(payload as RelationUpdateInput),
        ),
    }),

    [IPC_CHANNELS.relationsRemove]: defineIpcHandler<RelationRemovePayload>({
      schema: relationRemovePayloadSchema,
      handle: (payload) => runRelationOperation(() => service.remove(payload)),
    }),
  };
}
