import { describe, expect, it } from 'vitest';

import {
  countWorldTransfer,
  parseWorldTransfer,
  parseWorldTransferJson,
  verifyWorldAgainstManifest,
} from '@/main/transfer/format/world';
import { createManifest } from '@/main/transfer/format/manifest';
import { TransferError } from '@/main/transfer/errors';

const ENTITY_ID = '018f1000-0000-7000-8000-000000000401';
const OTHER_ID = '018f1000-0000-7000-8000-000000000402';

interface TestWorld {
  format: string;
  formatVersion: number;
  world: Record<string, unknown>;
  entityTypes: { version: number; types: unknown[] };
  relationTypes: { version: number; types: unknown[] };
  tags: unknown[];
  assets: unknown[];
  entities: Array<Record<string, unknown>>;
  relations: unknown[];
  coverAssetId: string | null;
}

function world(overrides: Partial<TestWorld> = {}): TestWorld {
  return {
    format: 'world-craft-world',
    formatVersion: 2,
    world: {
      name: 'Mundo',
      slug: 'mundo',
      summary: null,
      description: null,
      genres: [],
      language: 'es',
      createdAt: 1,
      updatedAt: 2,
    },
    entityTypes: { version: 1, types: [] },
    relationTypes: { version: 1, types: [] },
    tags: [],
    assets: [],
    entities: [
      {
        id: ENTITY_ID,
        typeKey: 'character',
        name: 'Aria',
        slug: 'aria',
        aliases: [],
        summary: null,
        description: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hola.' }],
            },
          ],
        },
        attributes: { age: 34 },
        status: 'active',
        isFavorite: false,
        imageAssetId: null,
        gallery: [],
        tagNames: [],
        createdAt: 1,
        updatedAt: 2,
        versions: [],
      },
    ],
    relations: [],
    coverAssetId: null,
    ...overrides,
  };
}

describe('world.json', () => {
  it('acepta un mundo mínimo y calcula sus recuentos', () => {
    const parsed = parseWorldTransfer(world());

    expect(parsed.entities).toHaveLength(1);
    expect(countWorldTransfer(parsed)).toEqual({
      entities: 1,
      entityTypes: 0,
      relationTypes: 0,
      tags: 0,
      relations: 0,
      versions: 0,
      assets: 0,
    });
  });

  it('lee la versión 1 y normaliza la descripción del mundo a documento', () => {
    const payload = {
      ...world(),
      formatVersion: 1,
      world: {
        ...world().world,
        description: 'Línea uno\nLínea dos',
      },
    };
    const parsed = parseWorldTransfer(payload);

    expect(parsed.formatVersion).toBe(2);
    expect(parsed.world.description).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Línea uno' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Línea dos' }],
        },
      ],
    });
  });

  it('rechaza campos desconocidos y estados no admitidos', () => {
    expect(() => parseWorldTransfer({ ...world(), extra: 1 })).toThrow(
      TransferError,
    );
    const payload = world();
    payload.entities[0] = { ...payload.entities[0], status: 'published' };
    expect(() => parseWorldTransfer(payload)).toThrow(TransferError);
  });

  it('rechaza IDs y slugs repetidos', () => {
    const payload = world();
    const duplicated = {
      ...payload.entities[0],
      name: 'Otra',
      slug: 'otra',
    };

    expect(() =>
      parseWorldTransfer({
        ...payload,
        entities: [payload.entities[0], duplicated],
      }),
    ).toThrow(TransferError);

    expect(() =>
      parseWorldTransfer({
        ...payload,
        entities: [
          payload.entities[0],
          { ...duplicated, id: OTHER_ID, slug: 'aria' },
        ],
      }),
    ).toThrow(TransferError);
  });

  it('valida la descripción enriquecida', () => {
    const payload = world();
    payload.entities[0] = {
      ...payload.entities[0],
      description: {
        type: 'doc',
        content: [
          {
            type: 'script',
            content: [{ type: 'text', text: 'alert(1)' }],
          },
        ],
      },
    };

    expect(() => parseWorldTransfer(payload)).toThrow(TransferError);
  });

  it('valida atributos, galería y etiquetas', () => {
    const payload = world();
    payload.entities[0] = {
      ...payload.entities[0],
      attributes: { 'clave con espacios': 'x' },
    };
    expect(() => parseWorldTransfer(payload)).toThrow(TransferError);

    const gallery = world();
    gallery.entities[0] = {
      ...gallery.entities[0],
      gallery: [{ assetId: ENTITY_ID }, { assetId: ENTITY_ID }],
    };
    expect(() => parseWorldTransfer(gallery)).toThrow(TransferError);

    const tags = world();
    tags.entities[0] = {
      ...tags.entities[0],
      tagNames: ['Mar', 'mar'],
    };
    expect(() => parseWorldTransfer(tags)).not.toThrow();

    const duplicates = world();
    duplicates.entities[0] = {
      ...duplicates.entities[0],
      tagNames: ['Mar', 'Mar'],
    };
    expect(() => parseWorldTransfer(duplicates)).toThrow(TransferError);
  });

  it('distingue una versión futura del formato', () => {
    const payload = world();
    const code = (run: () => unknown): unknown => {
      try {
        run();
      } catch (error) {
        return (error as { readonly code?: unknown }).code;
      }

      return undefined;
    };

    expect(
      code(() => parseWorldTransfer({ ...payload, formatVersion: 3 })),
    ).toBe('TRANSFER_FORMAT_UNSUPPORTED');
    expect(
      code(() =>
        parseWorldTransferJson(
          JSON.stringify({ ...payload, formatVersion: 3 }),
        ),
      ),
    ).toBe('TRANSFER_FORMAT_UNSUPPORTED');
    expect(code(() => parseWorldTransfer({ ...payload, format: 'otro' }))).toBe(
      'TRANSFER_WORLD_INVALID',
    );
  });

  it('acepta un origen de versión futuro para sanearlo en el plan', () => {
    const payload = world();
    payload.entities[0] = {
      ...payload.entities[0],
      versions: [
        {
          description: null,
          label: null,
          origin: 'future-origin',
          createdAt: 1,
        },
      ],
    };

    expect(() => parseWorldTransfer(payload)).not.toThrow();
  });

  it('cruza el mundo con el manifiesto', () => {
    const parsed = parseWorldTransfer(world());
    const manifest = createManifest({
      schemaVersion: 8,
      appVersion: '0.1.0',
      exportedAt: '2026-11-25T10:00:00.000Z',
      world: {
        sourceId: '018f1000-0000-7000-8000-000000000001',
        name: 'Mundo',
        slug: 'mundo',
      },
      counts: countWorldTransfer(parsed),
      files: [
        {
          path: 'world.json',
          size: 10,
          sha256: 'a'.repeat(64),
        },
      ],
      warnings: [],
    });

    expect(() => verifyWorldAgainstManifest(parsed, manifest)).not.toThrow();
    expect(() =>
      verifyWorldAgainstManifest(parsed, {
        ...manifest,
        world: { ...manifest.world, name: 'Otro' },
      }),
    ).toThrow(TransferError);
  });
});
