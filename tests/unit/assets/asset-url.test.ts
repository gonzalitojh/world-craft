import { describe, expect, it } from 'vitest';

import {
  buildRelativePath,
  parseAssetUrl,
  parseRelativeAssetPath,
  toThumbnailRelativePath,
} from '@/main/assets/paths';
import { createUuidv7Generator } from '@/main/db/ids';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0x42),
});

const ASSET_ID = generator.generate();
const WORLD_ID = generator.generate();

function expectAssetError(callback: () => unknown, code: string): void {
  let caught: unknown;

  try {
    callback();
  } catch (error) {
    caught = error;
  }

  expect(caught).toMatchObject({ code });
}

describe('URL del protocolo wc-asset', () => {
  it('acepta asset y thumb con UUIDv7 en minúsculas', () => {
    expect(parseAssetUrl(`wc-asset://asset/${ASSET_ID}`)).toEqual({
      variant: 'asset',
      assetId: ASSET_ID,
    });
    expect(parseAssetUrl(`wc-asset://thumb/${ASSET_ID}`)).toEqual({
      variant: 'thumb',
      assetId: ASSET_ID,
    });
  });

  it('rechaza query, hash, puerto, userinfo y hosts desconocidos', () => {
    for (const url of [
      `wc-asset://asset/${ASSET_ID}?size=full`,
      `wc-asset://asset/${ASSET_ID}#frag`,
      `wc-asset://asset:8080/${ASSET_ID}`,
      `wc-asset://user:pass@asset/${ASSET_ID}`,
      `wc-asset://files/${ASSET_ID}`,
      `wc-asset://asset@evil/${ASSET_ID}`,
      `wc-asset:///${ASSET_ID}`,
    ]) {
      expectAssetError(() => parseAssetUrl(url), 'ASSET_URL_INVALID');
    }
  });

  it('rechaza segmentos extra, traversal, codificación y mayúsculas', () => {
    for (const url of [
      `wc-asset://asset/${ASSET_ID}/extra`,
      `wc-asset://asset/../${ASSET_ID}`,
      `wc-asset://asset/%2e%2e/${ASSET_ID}`,
      `wc-asset://asset/${ASSET_ID.toUpperCase()}`,
      `WC-ASSET://asset/${ASSET_ID}`,
      `wc-asset://ASSET/${ASSET_ID}`,
      `wc-asset://asset/${ASSET_ID.replaceAll('-', '')}`,
      `wc-asset://asset/`,
      `wc-asset://asset`,
      '',
    ]) {
      expectAssetError(() => parseAssetUrl(url), 'ASSET_URL_INVALID');
    }
  });

  it('rechaza valores que no son cadenas', () => {
    for (const url of [undefined, null, 42, {}, []]) {
      expectAssetError(() => parseAssetUrl(url), 'ASSET_URL_INVALID');
    }
  });
});

describe('rutas relativas de assets', () => {
  it('construye y valida la ruta del archivo y de la miniatura', () => {
    const main = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });
    const thumbnail = buildRelativePath({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'thumb',
    });

    expect(main).toBe(`worlds/${WORLD_ID}/${ASSET_ID}.webp`);
    expect(thumbnail).toBe(`worlds/${WORLD_ID}/${ASSET_ID}.thumb.webp`);
    expect(parseRelativeAssetPath(main)).toEqual({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'asset',
    });
    expect(parseRelativeAssetPath(thumbnail)).toEqual({
      worldId: WORLD_ID,
      assetId: ASSET_ID,
      variant: 'thumb',
    });
    expect(toThumbnailRelativePath(main)).toBe(thumbnail);
  });

  it('rechaza traversal, rutas absolutas, UNC, unidades y NUL', () => {
    for (const relativePath of [
      'worlds/../x.webp',
      `worlds/${WORLD_ID}/../${ASSET_ID}.webp`,
      'worlds/./x.webp',
      `worlds//${ASSET_ID}.webp`,
      `/${ASSET_ID}.webp`,
      `C:/assets/worlds/${WORLD_ID}/${ASSET_ID}.webp`,
      `\\\\servidor\\assets\\${ASSET_ID}.webp`,
      `worlds\\${WORLD_ID}\\${ASSET_ID}.webp`,
      `worlds/${WORLD_ID}/${ASSET_ID}.webp\u0000`,
      '',
    ]) {
      expectAssetError(
        () => parseRelativeAssetPath(relativePath),
        'ASSET_PATH_INVALID',
      );
    }
  });

  it('rechaza nombres, extensiones y UUID que no encajan', () => {
    for (const relativePath of [
      `assets/${WORLD_ID}/${ASSET_ID}.webp`,
      `worlds/${WORLD_ID.toUpperCase()}/${ASSET_ID}.webp`,
      `worlds/${WORLD_ID}/${ASSET_ID.toUpperCase()}.webp`,
      `worlds/${WORLD_ID}/${ASSET_ID}.png`,
      `worlds/${WORLD_ID}/${ASSET_ID}.thumb.png`,
      `worlds/${WORLD_ID}/${ASSET_ID}`,
      `worlds/${WORLD_ID}/${ASSET_ID}.webp.bak`,
      `worlds/${WORLD_ID}/notes.txt`,
      `worlds/${WORLD_ID}/.thumb.webp`,
    ]) {
      expectAssetError(
        () => parseRelativeAssetPath(relativePath),
        'ASSET_PATH_INVALID',
      );
    }
  });

  it('rechaza construir rutas con identificadores inválidos', () => {
    expectAssetError(
      () =>
        buildRelativePath({
          worldId: 'x',
          assetId: ASSET_ID,
          variant: 'asset',
        }),
      'ASSET_PATH_INVALID',
    );
    expectAssetError(
      () =>
        buildRelativePath({
          worldId: WORLD_ID,
          assetId: 'x',
          variant: 'thumb',
        }),
      'ASSET_PATH_INVALID',
    );
    expectAssetError(
      () =>
        toThumbnailRelativePath(`worlds/${WORLD_ID}/${ASSET_ID}.thumb.webp`),
      'ASSET_PATH_INVALID',
    );
  });
});
