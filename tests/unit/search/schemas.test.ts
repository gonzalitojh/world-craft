import { describe, expect, it } from 'vitest';

import {
  searchQueryPayloadSchema,
  searchRebuildPayloadSchema,
  searchSuggestionsPayloadSchema,
} from '@/main/ipc/schemas/search';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const TYPE_ID = '01900000-0000-7000-8000-000000000002';

describe('esquemas IPC de búsqueda', () => {
  it('acepta una consulta con filtros combinados', () => {
    const parsed = searchQueryPayloadSchema.parse({
      query: '  gandalf  ',
      filters: {
        worldId: WORLD_ID,
        kind: 'entity',
        entityTypeId: TYPE_ID,
        tagId: TYPE_ID,
        status: 'draft',
      },
      limit: 30,
      offset: 0,
    });

    expect(parsed.query).toBe('gandalf');
    expect(parsed.filters?.status).toBe('draft');
  });

  it('rechaza consultas vacías, demasiado largas, tipos desconocidos y propiedades extra', () => {
    const filters = { worldId: WORLD_ID };

    expect(searchQueryPayloadSchema.safeParse({ query: '   ' }).success).toBe(
      false,
    );
    expect(
      searchQueryPayloadSchema.safeParse({ query: 'a'.repeat(201) }).success,
    ).toBe(false);
    expect(
      searchQueryPayloadSchema.safeParse({
        query: 'mara',
        filters: { kind: 'map' },
      }).success,
    ).toBe(false);
    expect(
      searchQueryPayloadSchema.safeParse({
        query: 'mara',
        filters,
        extra: true,
      }).success,
    ).toBe(false);
    expect(
      searchQueryPayloadSchema.safeParse({ query: 'mara', limit: 101 }).success,
    ).toBe(false);
    expect(
      searchQueryPayloadSchema.safeParse({ query: 'mara', offset: -1 }).success,
    ).toBe(false);
  });

  it('valida las sugerencias y la reconstrucción', () => {
    expect(searchSuggestionsPayloadSchema.parse({})).toEqual({});
    expect(searchSuggestionsPayloadSchema.parse({ worldId: WORLD_ID })).toEqual(
      { worldId: WORLD_ID },
    );
    expect(
      searchSuggestionsPayloadSchema.safeParse({ worldId: 'no-uuid' }).success,
    ).toBe(false);
    expect(searchRebuildPayloadSchema.parse({})).toEqual({});
    expect(searchRebuildPayloadSchema.safeParse({ force: true }).success).toBe(
      false,
    );
  });
});
