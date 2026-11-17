import { describe, expect, it } from 'vitest';

import { decodeAssetCursor, encodeAssetCursor } from '@/lib/assets/store';

const ASSET_ID = '33333333-3333-4333-8333-333333333333';

describe('cursor de assets', () => {
  it('codifica y decodifica fecha e id', () => {
    const createdAt = new Date('2026-11-16T10:00:00.000Z');
    const decoded = decodeAssetCursor(
      encodeAssetCursor({
        id: ASSET_ID,
        worldId: '11111111-1111-4111-8111-111111111111',
        uploaderId: null,
        bucket: 'world-craft-test',
        path: 'world/x/y.webp',
        mime: 'image/webp',
        size: 1,
        width: 16,
        height: 16,
        alt: '',
        createdAt,
      }),
    );

    expect(decoded).toEqual({ createdAt, id: ASSET_ID });
  });

  it('ignora cursores con id no UUID o formato inválido', () => {
    const encode = (value: string) =>
      Buffer.from(value, 'utf8').toString('base64url');

    expect(
      decodeAssetCursor(encode('2026-11-16T10:00:00.000Z|no-es-un-uuid')),
    ).toBeUndefined();
    expect(decodeAssetCursor(encode('sin-separador'))).toBeUndefined();
    expect(decodeAssetCursor('***')).toBeUndefined();
  });
});
