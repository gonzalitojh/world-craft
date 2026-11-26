import { describe, expect, it } from 'vitest';

import {
  EMPTY_TRANSFER_COUNTS,
  createManifest,
  parseManifest,
  parseManifestJson,
  serializeManifest,
  verifyManifestFileSet,
  type CreateManifestInput,
} from '@/main/transfer/format/manifest';
import { TransferError } from '@/main/transfer/errors';

const ASSET_ID = '018f1000-0000-7000-8000-000000000301';
const SHA = 'a'.repeat(64);

function errorCode(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return (error as { readonly code?: unknown }).code;
  }

  return undefined;
}

function input(
  overrides: Partial<CreateManifestInput> = {},
): CreateManifestInput {
  return {
    schemaVersion: 8,
    appVersion: '0.1.0',
    exportedAt: '2026-11-25T10:00:00.000Z',
    world: {
      sourceId: '018f1000-0000-7000-8000-000000000001',
      name: 'Crónica de las Mareas',
      slug: 'cronica-de-las-mareas',
    },
    counts: { ...EMPTY_TRANSFER_COUNTS, assets: 1 },
    files: [
      { path: 'world.json', size: 10, sha256: SHA },
      { path: `assets/${ASSET_ID}.webp`, size: 20, sha256: SHA },
    ],
    warnings: [],
    ...overrides,
  };
}

describe('manifiesto del mundo', () => {
  it('construye, serializa y vuelve a leer un manifiesto válido', () => {
    const manifest = createManifest(input());
    const text = serializeManifest(manifest);
    const parsed = parseManifestJson(text);

    expect(parsed).toEqual(manifest);
    expect(parsed.format).toBe('world-craft-world');
    expect(parsed.formatVersion).toBe(2);
    expect(parsed.assetsIncluded).toBe(true);
    expect(parsed.counts.assets).toBe(1);
    expect(parseManifest({ ...manifest, formatVersion: 1 }).formatVersion).toBe(
      1,
    );
  });

  it('rechaza campos desconocidos y versiones no soportadas', () => {
    const valid = createManifest(input());

    expect(() => parseManifest({ ...valid, extra: true })).toThrow(
      TransferError,
    );
    expect(errorCode(() => parseManifest({ ...valid, formatVersion: 3 }))).toBe(
      'TRANSFER_FORMAT_UNSUPPORTED',
    );
    expect(
      errorCode(() =>
        parseManifestJson(JSON.stringify({ ...valid, formatVersion: 3 })),
      ),
    ).toBe('TRANSFER_FORMAT_UNSUPPORTED');
    expect(() => parseManifest({ ...valid, format: 'otro' })).toThrow(
      TransferError,
    );
    expect(errorCode(() => parseManifest({ ...valid, format: 'otro' }))).toBe(
      'TRANSFER_MANIFEST_INVALID',
    );
  });

  it('exige recuentos coherentes con los archivos', () => {
    expect(() =>
      createManifest(
        input({ counts: { ...EMPTY_TRANSFER_COUNTS, assets: 2 } }),
      ),
    ).toThrow(TransferError);
    // Un mundo sin assets es válido: solo `world.json`.
    expect(
      createManifest(
        input({
          files: [{ path: 'world.json', size: 10, sha256: SHA }],
          counts: EMPTY_TRANSFER_COUNTS,
        }),
      ).counts.assets,
    ).toBe(0);
  });

  it('no admite que el manifiesto se liste a sí mismo', () => {
    expect(() =>
      createManifest(
        input({
          counts: EMPTY_TRANSFER_COUNTS,
          files: [
            { path: 'world.json', size: 10, sha256: SHA },
            { path: 'manifest.json', size: 10, sha256: SHA },
          ],
        }),
      ),
    ).toThrow(TransferError);
  });

  it('rechaza checksums y rutas no canónicas', () => {
    expect(() =>
      createManifest(
        input({
          files: [
            { path: 'world.json', size: 10, sha256: 'xyz' },
            { path: `assets/${ASSET_ID}.webp`, size: 20, sha256: SHA },
          ],
        }),
      ),
    ).toThrow(TransferError);

    expect(() =>
      createManifest(
        input({
          files: [
            { path: 'world.json', size: 10, sha256: SHA },
            { path: 'assets/../x.webp', size: 20, sha256: SHA },
          ],
        }),
      ),
    ).toThrow(TransferError);
  });

  it('comprueba el conjunto real de archivos y tamaños', () => {
    const manifest = createManifest(input());
    const actual = new Map([
      ['world.json', 10],
      [`assets/${ASSET_ID}.webp`, 20],
    ]);

    expect(() => verifyManifestFileSet(manifest, actual)).not.toThrow();
    expect(() =>
      verifyManifestFileSet(manifest, new Map([['world.json', 10]])),
    ).toThrow(TransferError);
    expect(() =>
      verifyManifestFileSet(
        manifest,
        new Map([
          ['world.json', 11],
          [`assets/${ASSET_ID}.webp`, 20],
        ]),
      ),
    ).toThrow(TransferError);
  });

  it('rechaza JSON inválido y avisos repetidos', () => {
    expect(() => parseManifestJson('{')).toThrow(TransferError);
    expect(() =>
      createManifest(
        input({
          warnings: [
            { code: 'missing-tag', count: 1 },
            { code: 'missing-tag', count: 2 },
          ],
        }),
      ),
    ).toThrow(TransferError);
  });
});
