import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createManifest,
  EMPTY_TRANSFER_COUNTS,
} from '@/main/transfer/format/manifest';
import { parseWorldTransfer } from '@/main/transfer/format/world';
import {
  createImportPlan,
  readImportPlan,
  writeImportPlan,
  type ImportPlan,
} from '@/main/transfer/import/plan';
import type { StagedImport } from '@/main/transfer/import/staging';

const WORLD_ID = '018f1000-0000-7000-8000-000000000001';
const MISSING_TYPE_ENTITY_ID = '018f1000-0000-7000-8000-000000000401';
const VALID_ENTITY_ID = '018f1000-0000-7000-8000-000000000402';

function staged(overrides: {
  readonly entities: readonly Record<string, unknown>[];
  readonly relations?: readonly Record<string, unknown>[];
  readonly slug?: string;
}): StagedImport {
  const world = parseWorldTransfer({
    format: 'world-craft-world',
    formatVersion: 1,
    world: {
      name: 'Mundo',
      slug: overrides.slug ?? 'mundo',
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
    entities: overrides.entities,
    relations: overrides.relations ?? [],
    coverAssetId: null,
  });
  const manifest = createManifest({
    schemaVersion: 8,
    appVersion: '0.1.0',
    exportedAt: '2026-11-25T10:00:00.000Z',
    world: { sourceId: WORLD_ID, name: 'Mundo', slug: world.world.slug },
    counts: EMPTY_TRANSFER_COUNTS,
    files: [{ path: 'world.json', size: 1, sha256: 'a'.repeat(64) }],
    warnings: [],
  });

  return {
    operationId: '018f1000-0000-7000-8000-000000000900',
    stagingDir: 'C:\\tmp\\import',
    assetsDir: 'C:\\tmp\\import\\assets',
    manifest,
    world,
    assets: [],
    totalAssetBytes: 0,
  };
}

function entity(id: string, typeKey: string, name: string, slug: string) {
  return {
    id,
    typeKey,
    name,
    slug,
    aliases: [],
    summary: null,
    description: null,
    attributes: {},
    status: 'active',
    isFavorite: false,
    imageAssetId: null,
    gallery: [],
    tagNames: [],
    createdAt: 1,
    updatedAt: 2,
    versions: [],
  };
}

describe('plan de importación', () => {
  it('rechaza un plan sobredimensionado antes de leerlo o escribirlo', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'world-craft-plan-'));
    const file = join(directory, 'plan.json');

    try {
      await writeFile(file, JSON.stringify({ contenido: 'x'.repeat(100) }));

      await expect(readImportPlan(file, 10)).rejects.toMatchObject({
        code: 'TRANSFER_LIMIT_EXCEEDED',
      });
      await expect(
        writeImportPlan(directory, {} as ImportPlan, 2),
      ).rejects.toMatchObject({ code: 'TRANSFER_LIMIT_EXCEEDED' });

      expect((await stat(file)).size).toBeGreaterThan(10);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('descarta fichas con tipo ausente y sus relaciones con aviso', () => {
    const plan = createImportPlan({
      staged: staged({
        entities: [
          entity(MISSING_TYPE_ENTITY_ID, 'missing-type', 'Rota', 'rota'),
          entity(VALID_ENTITY_ID, 'character', 'Aria', 'aria'),
        ],
        relations: [
          {
            sourceId: VALID_ENTITY_ID,
            targetId: MISSING_TYPE_ENTITY_ID,
            typeKey: 'related-to',
            label: null,
            inverseLabel: null,
            notes: null,
            strength: 1,
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
      existingSlugs: new Set(['mundo']),
    });

    expect(plan.entities).toHaveLength(1);
    expect(plan.entities[0]?.name).toBe('Aria');
    expect(plan.entities[0]?.id).not.toBe(VALID_ENTITY_ID);
    expect(plan.relations).toHaveLength(0);
    expect(plan.world.slug).toBe('mundo-2');
    expect(plan.slugAdjusted).toBe(true);
    expect(plan.warnings).toEqual([
      { code: 'missing-entity-type', count: 1 },
      { code: 'broken-relation-endpoint', count: 1 },
    ]);
  });

  it('sanea un origen de versión desconocido a auto', () => {
    const plan = createImportPlan({
      staged: staged({
        entities: [
          {
            ...entity(VALID_ENTITY_ID, 'character', 'Aria', 'aria'),
            versions: [
              {
                description: null,
                label: null,
                origin: 'future',
                createdAt: 1,
              },
            ],
          },
        ],
      }),
      existingSlugs: new Set(),
    });

    expect(plan.versions).toHaveLength(1);
    expect(plan.slugAdjusted).toBe(false);
    expect(plan.versions[0]?.origin).toBe('auto');
    expect(plan.warnings).toEqual([
      { code: 'unknown-version-origin', count: 1 },
    ]);
    expect(plan.counts.versions).toBe(1);
  });
});
