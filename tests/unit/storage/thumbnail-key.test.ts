import { describe, expect, it } from 'vitest';

import { assertWorldAssetKey, isWorldAssetKey } from '@/lib/storage';
import { buildThumbnailKey, thumbnailUuid } from '@/lib/storage/thumbnail-key';

const WORLD_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_WORLD_ID = '22222222-2222-4222-8222-222222222222';
const ASSET_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ASSET_ID = '44444444-4444-4444-8444-444444444444';

describe('thumbnailUuid', () => {
  it('es determinista para el mismo asset', () => {
    expect(thumbnailUuid(ASSET_ID)).toBe(thumbnailUuid(ASSET_ID));
  });

  it('genera un UUID versión 5 con variante RFC 4122', () => {
    const uuid = thumbnailUuid(ASSET_ID);

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('no coincide con el id del asset ni entre assets distintos', () => {
    expect(thumbnailUuid(ASSET_ID)).not.toBe(ASSET_ID);
    expect(thumbnailUuid(ASSET_ID)).not.toBe(thumbnailUuid(OTHER_ASSET_ID));
  });

  it('rechaza un identificador que no es UUID', () => {
    expect(() => thumbnailUuid('asset-1')).toThrow(/UUID/);
  });
});

describe('buildThumbnailKey', () => {
  it('construye una clave canónica del mismo mundo', () => {
    const key = buildThumbnailKey(WORLD_ID, ASSET_ID);

    expect(key).toBe(`world/${WORLD_ID}/${thumbnailUuid(ASSET_ID)}.webp`);
    expect(isWorldAssetKey(key, WORLD_ID)).toBe(true);
    expect(assertWorldAssetKey(key, WORLD_ID)).toBe(key);
  });

  it('no genera la misma clave que el asset original', () => {
    expect(buildThumbnailKey(WORLD_ID, ASSET_ID)).not.toContain(ASSET_ID);
  });

  it('es estable entre llamadas y cambia con el mundo', () => {
    expect(buildThumbnailKey(WORLD_ID, ASSET_ID)).toBe(
      buildThumbnailKey(WORLD_ID, ASSET_ID),
    );
    expect(buildThumbnailKey(WORLD_ID, ASSET_ID)).not.toBe(
      buildThumbnailKey(OTHER_WORLD_ID, ASSET_ID),
    );
  });
});
