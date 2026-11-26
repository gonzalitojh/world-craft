import { describe, expect, it } from 'vitest';

import {
  createLibraryManifest,
  parseLibraryManifest,
  parseLibraryManifestJson,
  serializeLibraryManifest,
  verifyLibraryFileSet,
  type CreateLibraryManifestInput,
} from '@/main/data/library/manifest';
import type { TransferCounts } from '@/shared/contracts/transfer';

const COUNTS: TransferCounts = {
  entities: 2,
  entityTypes: 1,
  relationTypes: 1,
  tags: 2,
  relations: 3,
  versions: 2,
  assets: 5,
};

const HASH = 'a'.repeat(64);

function input(
  overrides: Partial<CreateLibraryManifestInput> = {},
): CreateLibraryManifestInput {
  return {
    schemaVersion: 8,
    appVersion: '0.1.0',
    exportedAt: '2026-11-25T12:00:00.000Z',
    database: { size: 1024, sha256: HASH, schemaVersion: 8 },
    settings: { size: 256, sha256: HASH },
    worlds: [
      {
        slug: 'cronica-de-las-mareas',
        name: 'Crónica de las Mareas',
        size: 2048,
        sha256: HASH,
        counts: COUNTS,
        warnings: [{ code: 'missing-tag', count: 1 }],
      },
    ],
    counts: COUNTS,
    warnings: [{ code: 'missing-tag', count: 1 }],
    ...overrides,
  };
}

describe('manifiesto de la biblioteca', () => {
  it('construye rutas canónicas y serializa', () => {
    const manifest = createLibraryManifest(input());

    expect(manifest.database).toEqual({
      path: 'database/world-craft.sqlite',
      size: 1024,
      sha256: HASH,
      integrity: 'ok',
      schemaVersion: 8,
    });
    expect(manifest.settings).toEqual({
      path: 'settings.json',
      size: 256,
      sha256: HASH,
    });
    expect(manifest.worlds[0]).toMatchObject({
      path: 'worlds/cronica-de-las-mareas.zip',
      slug: 'cronica-de-las-mareas',
      counts: COUNTS,
    });
    expect(
      parseLibraryManifestJson(serializeLibraryManifest(manifest)),
    ).toEqual(manifest);
  });

  it('rechaza recuentos incoherentes, rutas duplicadas o hashes inválidos', () => {
    for (const invalid of [
      input({ counts: { ...COUNTS, entities: 99 } }),
      input({
        worlds: [input().worlds[0]!, { ...input().worlds[0]!, name: 'Otra' }],
      }),
      input({
        worlds: [{ ...input().worlds[0]!, slug: 'Otra-Mal' }],
      }),
      input({ database: { size: 1, sha256: 'abc', schemaVersion: 8 } }),
      input({ settings: { size: 0, sha256: HASH } }),
      input({ database: { size: 1, sha256: HASH, schemaVersion: 9 } }),
    ]) {
      expect(() => createLibraryManifest(invalid)).toThrowError(
        expect.objectContaining({ code: 'DATA_LIBRARY_MANIFEST_INVALID' }),
      );
    }
  });

  it('exige integridad ok y una versión de esquema positiva', () => {
    expect(() =>
      parseLibraryManifest({
        ...createLibraryManifest(input()),
        database: {
          ...createLibraryManifest(input()).database,
          integrity: 'failed',
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_MANIFEST_INVALID' }),
    );
    expect(() =>
      parseLibraryManifest({
        ...createLibraryManifest(input()),
        schemaVersion: 0,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_MANIFEST_INVALID' }),
    );
  });

  it('verifica el conjunto exacto de archivos y sus tamaños', () => {
    const manifest = createLibraryManifest(input());
    const actual = new Map<string, number>([
      ['settings.json', 256],
      ['database/world-craft.sqlite', 1024],
      ['worlds/cronica-de-las-mareas.zip', 2048],
    ]);

    expect(() => verifyLibraryFileSet(manifest, actual)).not.toThrow();

    expect(() =>
      verifyLibraryFileSet(manifest, new Map([...actual, ['sobra.txt', 1]])),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_VERIFY_FAILED' }),
    );
    expect(() =>
      verifyLibraryFileSet(
        manifest,
        new Map([...actual].filter(([key]) => key !== 'settings.json')),
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_VERIFY_FAILED' }),
    );
    expect(() =>
      verifyLibraryFileSet(
        manifest,
        new Map(
          [...actual].map(([key, size]) => [
            key,
            key === 'settings.json' ? 1 : size,
          ]),
        ),
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_VERIFY_FAILED' }),
    );
  });
});
