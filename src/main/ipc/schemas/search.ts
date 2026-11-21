/**
 * Esquemas Zod de los canales de búsqueda.
 *
 * La forma se valida aquí, los límites y la semántica en el servicio. Se
 * rechazan propiedades extra. La consulta se recorta y se limita para que un
 * cliente no pueda enviar un `MATCH` desproporcionado.
 */
import { z } from 'zod';

import {
  SEARCH_KINDS,
  SEARCH_LIMIT_MAX,
  SEARCH_OFFSET_MAX,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_STATUSES,
} from '../../../shared/contracts/search';
import { UUID_V7_PATTERN } from '../../db/ids';

const worldIdSchema = z.string().regex(UUID_V7_PATTERN);
const entityIdSchema = z.string().regex(UUID_V7_PATTERN);

const searchFiltersSchema = z
  .strictObject({
    worldId: worldIdSchema.optional(),
    kind: z.enum(SEARCH_KINDS).optional(),
    entityTypeId: entityIdSchema.optional(),
    tagId: entityIdSchema.optional(),
    status: z.enum(SEARCH_STATUSES).optional(),
  })
  .optional();

/** Payload de `search:query`. */
export const searchQueryPayloadSchema = z.strictObject({
  query: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH),
  filters: searchFiltersSchema,
  limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional(),
  offset: z.number().int().min(0).max(SEARCH_OFFSET_MAX).optional(),
});

/** Payload de `search:suggestions`. */
export const searchSuggestionsPayloadSchema = z.strictObject({
  worldId: worldIdSchema.optional(),
});

/** Payload de `search:rebuild`. */
export const searchRebuildPayloadSchema = z.strictObject({});

export type SearchQueryPayload = z.infer<typeof searchQueryPayloadSchema>;
export type SearchSuggestionsPayload = z.infer<
  typeof searchSuggestionsPayloadSchema
>;
export type SearchRebuildPayload = z.infer<typeof searchRebuildPayloadSchema>;
