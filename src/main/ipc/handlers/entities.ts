/**
 * Handlers IPC de fichas y etiquetas.
 *
 * El router valida la forma con Zod; aquí se traducen los errores de dominio a
 * `INVALID_INPUT` y se delega en el servicio. Ningún mensaje, ruta ni valor de
 * la base sale al renderer (ADR 0004).
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type {
  EntityCreateInput,
  EntityUpdateInput,
} from '../../../shared/contracts/entities';
import type { EntitiesService } from '../../entities/service';
import { EntityInputError } from '../../entities/errors';
import { IpcInputError } from '../errors';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  entitiesListPayloadSchema,
  entityCreatePayloadSchema,
  entityGetPayloadSchema,
  entityRemovePayloadSchema,
  entitySetFavoritePayloadSchema,
  entityUpdatePayloadSchema,
  tagCreatePayloadSchema,
  tagsListPayloadSchema,
  type EntitiesListPayload,
  type EntityCreatePayload,
  type EntityGetPayload,
  type EntityRemovePayload,
  type EntitySetFavoritePayload,
  type EntityUpdatePayload,
  type TagCreatePayload,
  type TagsListPayload,
} from '../schemas/entities';

/** Canales que atiende este módulo. */
export type EntitiesIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.entitiesList
  | typeof IPC_CHANNELS.entitiesGet
  | typeof IPC_CHANNELS.entitiesCreate
  | typeof IPC_CHANNELS.entitiesUpdate
  | typeof IPC_CHANNELS.entitiesSetFavorite
  | typeof IPC_CHANNELS.entitiesRemove
  | typeof IPC_CHANNELS.tagsList
  | typeof IPC_CHANNELS.tagsCreate
>;

function runEntityOperation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof EntityInputError) {
      throw new IpcInputError();
    }

    throw error;
  }
}

/** Construye los handlers de los canales de fichas y etiquetas. */
export function createEntityIpcHandlers(
  service: EntitiesService,
): EntitiesIpcHandlers {
  return {
    [IPC_CHANNELS.entitiesList]: defineIpcHandler<EntitiesListPayload>({
      schema: entitiesListPayloadSchema,
      handle: (payload) => runEntityOperation(() => service.list(payload)),
    }),

    [IPC_CHANNELS.entitiesGet]: defineIpcHandler<EntityGetPayload>({
      schema: entityGetPayloadSchema,
      handle: (payload) => runEntityOperation(() => service.get(payload)),
    }),

    [IPC_CHANNELS.entitiesCreate]: defineIpcHandler<EntityCreatePayload>({
      schema: entityCreatePayloadSchema,
      handle: (payload) =>
        runEntityOperation(() => service.create(payload as EntityCreateInput)),
    }),

    [IPC_CHANNELS.entitiesUpdate]: defineIpcHandler<EntityUpdatePayload>({
      schema: entityUpdatePayloadSchema,
      handle: (payload) =>
        runEntityOperation(() => service.update(payload as EntityUpdateInput)),
    }),

    [IPC_CHANNELS.entitiesSetFavorite]:
      defineIpcHandler<EntitySetFavoritePayload>({
        schema: entitySetFavoritePayloadSchema,
        handle: (payload) =>
          runEntityOperation(() => service.setFavorite(payload)),
      }),

    [IPC_CHANNELS.entitiesRemove]: defineIpcHandler<EntityRemovePayload>({
      schema: entityRemovePayloadSchema,
      handle: (payload) => runEntityOperation(() => service.remove(payload)),
    }),

    [IPC_CHANNELS.tagsList]: defineIpcHandler<TagsListPayload>({
      schema: tagsListPayloadSchema,
      handle: (payload) =>
        runEntityOperation(() => service.listTags(payload.worldId)),
    }),

    [IPC_CHANNELS.tagsCreate]: defineIpcHandler<TagCreatePayload>({
      schema: tagCreatePayloadSchema,
      handle: (payload) => runEntityOperation(() => service.createTag(payload)),
    }),
  };
}
