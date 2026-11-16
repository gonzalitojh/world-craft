import { describe, expect, it } from 'vitest';

import {
  assertWorldAssetKey,
  buildWorldAssetKey,
  isWorldAssetKey,
  StorageError,
  WORLD_ASSET_EXTENSIONS,
} from '@/lib/storage';

const WORLD_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_WORLD_ID = '22222222-2222-4222-8222-222222222222';
const ASSET_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ASSET_ID = '44444444-4444-4444-8444-444444444444';

const VALID_KEY = `world/${WORLD_ID}/${ASSET_ID}.png`;

/** Comprueba el código de un `StorageError` lanzado por `fn`. */
function expectStorageError(fn: () => void, code: StorageError['code']): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).code).toBe(code);
    return;
  }

  throw new Error(`Se esperaba un StorageError con código ${code}`);
}

describe('buildWorldAssetKey', () => {
  it('construye la clave canónica del mundo', () => {
    expect(buildWorldAssetKey(WORLD_ID, ASSET_ID, 'png')).toBe(VALID_KEY);
  });

  it('normaliza mayúsculas y el punto de la extensión', () => {
    expect(buildWorldAssetKey(WORLD_ID, ASSET_ID, '.PNG')).toBe(VALID_KEY);
  });

  it('acepta todas las extensiones permitidas', () => {
    for (const extension of WORLD_ASSET_EXTENSIONS) {
      expect(buildWorldAssetKey(WORLD_ID, ASSET_ID, extension)).toBe(
        `world/${WORLD_ID}/${ASSET_ID}.${extension}`,
      );
    }
  });

  it('rechaza un mundo que no es UUID', () => {
    expectStorageError(
      () => buildWorldAssetKey('world-1', ASSET_ID, 'png'),
      'invalid_key',
    );
  });

  it('rechaza un asset que no es UUID', () => {
    expectStorageError(
      () => buildWorldAssetKey(WORLD_ID, 'asset-1', 'png'),
      'invalid_key',
    );
  });

  it('rechaza una extensión no permitida', () => {
    expectStorageError(
      () => buildWorldAssetKey(WORLD_ID, ASSET_ID, 'exe'),
      'invalid_key',
    );
  });

  it('genera claves que el propio validador acepta', () => {
    expect(isWorldAssetKey(VALID_KEY)).toBe(true);
    expect(isWorldAssetKey(VALID_KEY, WORLD_ID)).toBe(true);
    expect(isWorldAssetKey(VALID_KEY, OTHER_WORLD_ID)).toBe(false);
  });
});

describe('isWorldAssetKey', () => {
  it('acepta una clave válida con otro asset', () => {
    expect(isWorldAssetKey(`world/${WORLD_ID}/${OTHER_ASSET_ID}.webp`)).toBe(
      true,
    );
  });

  it('rechaza una ruta con traversal', () => {
    expect(isWorldAssetKey(`world/${WORLD_ID}/../${ASSET_ID}.png`)).toBe(false);
    expect(isWorldAssetKey(`world/${WORLD_ID}/${ASSET_ID}.png/../x`)).toBe(
      false,
    );
  });

  it('rechaza rutas absolutas y barras invertidas', () => {
    expect(isWorldAssetKey(`/world/${WORLD_ID}/${ASSET_ID}.png`)).toBe(false);
    expect(isWorldAssetKey(`world\\${WORLD_ID}\\${ASSET_ID}.png`)).toBe(false);
  });

  it('rechaza dobles barras', () => {
    expect(isWorldAssetKey(`world//${WORLD_ID}/${ASSET_ID}.png`)).toBe(false);
    expect(isWorldAssetKey(`world/${WORLD_ID}//${ASSET_ID}.png`)).toBe(false);
  });

  it('rechaza UUID inválidos', () => {
    expect(isWorldAssetKey(`world/not-a-uuid/${ASSET_ID}.png`)).toBe(false);
    expect(isWorldAssetKey(`world/${WORLD_ID}/not-a-uuid.png`)).toBe(false);
  });

  it('rechaza extensiones no permitidas', () => {
    expect(isWorldAssetKey(`world/${WORLD_ID}/${ASSET_ID}.exe`)).toBe(false);
    expect(isWorldAssetKey(`world/${WORLD_ID}/${ASSET_ID}`)).toBe(false);
  });

  it('rechaza un prefijo que no sea world', () => {
    expect(isWorldAssetKey(`assets/${WORLD_ID}/${ASSET_ID}.png`)).toBe(false);
  });

  it('rechaza claves vacías o demasiado largas', () => {
    expect(isWorldAssetKey('')).toBe(false);
    expect(isWorldAssetKey(`world/${WORLD_ID}/${'a'.repeat(600)}.png`)).toBe(
      false,
    );
  });
});

describe('assertWorldAssetKey', () => {
  it('devuelve la clave cuando es válida', () => {
    expect(assertWorldAssetKey(VALID_KEY)).toBe(VALID_KEY);
    expect(assertWorldAssetKey(VALID_KEY, WORLD_ID)).toBe(VALID_KEY);
  });

  it('rechaza una clave de otro mundo', () => {
    expectStorageError(
      () => assertWorldAssetKey(VALID_KEY, OTHER_WORLD_ID),
      'invalid_key',
    );
  });

  it('rechaza una clave que no es de un mundo', () => {
    expectStorageError(() => assertWorldAssetKey('avatar.png'), 'invalid_key');
  });
});
