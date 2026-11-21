/**
 * Handlers IPC de la búsqueda global.
 *
 * El router valida la forma con Zod; aquí se delega en el servicio. Los
 * resultados ya vienen en el contrato, con el resaltado como texto y sin HTML.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type { SearchService } from '../../search/service';
import { defineIpcHandler, type IpcHandlers } from '../registry';
import {
  searchQueryPayloadSchema,
  searchRebuildPayloadSchema,
  searchSuggestionsPayloadSchema,
  type SearchQueryPayload,
  type SearchSuggestionsPayload,
} from '../schemas/search';

/** Canales que atiende este módulo. */
export type SearchIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.searchQuery
  | typeof IPC_CHANNELS.searchSuggestions
  | typeof IPC_CHANNELS.searchRebuild
>;

/** Construye los handlers de los canales de búsqueda. */
export function createSearchIpcHandlers(
  service: SearchService,
): SearchIpcHandlers {
  return {
    [IPC_CHANNELS.searchQuery]: defineIpcHandler<SearchQueryPayload>({
      schema: searchQueryPayloadSchema,
      handle: (payload) => service.query(payload),
    }),

    [IPC_CHANNELS.searchSuggestions]:
      defineIpcHandler<SearchSuggestionsPayload>({
        schema: searchSuggestionsPayloadSchema,
        handle: (payload) => service.suggestions(payload),
      }),

    [IPC_CHANNELS.searchRebuild]: defineIpcHandler({
      schema: searchRebuildPayloadSchema,
      handle: () => service.rebuild(),
    }),
  };
}
