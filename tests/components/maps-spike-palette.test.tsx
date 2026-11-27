import { describe, expect, it } from 'vitest';

import {
  SPIKE_PALETTE_FALLBACK,
  SPIKE_PALETTE_TOKENS,
  readSpikePalette,
  resolveSpikePalette,
} from '@/renderer/maps-spike/palette';

describe('paleta del laboratorio de mapas', () => {
  it('resuelve los alias con un lector inyectable', () => {
    const values: Record<string, string> = {
      [SPIKE_PALETTE_TOKENS.mapBg]: '#101010',
      [SPIKE_PALETTE_TOKENS.mapFrame]: '#111111',
      [SPIKE_PALETTE_TOKENS.region]: '#202020',
      [SPIKE_PALETTE_TOKENS.regionFill]: '#303030',
      [SPIKE_PALETTE_TOKENS.regionStroke]: '#404040',
      [SPIKE_PALETTE_TOKENS.path]: '#505050',
      [SPIKE_PALETTE_TOKENS.place]: '#606060',
      [SPIKE_PALETTE_TOKENS.placeStroke]: '#707070',
      [SPIKE_PALETTE_TOKENS.selection]: '#808080',
      [SPIKE_PALETTE_TOKENS.guide]: '#909090',
      [SPIKE_PALETTE_TOKENS.vertex]: '#a0a0a0',
      [SPIKE_PALETTE_TOKENS.vertexStroke]: '#b0b0b0',
    };
    const palette = resolveSpikePalette((token) => values[token] ?? '');

    expect(palette).toEqual({
      mapBg: '#101010',
      mapFrame: '#111111',
      region: '#202020',
      regionFill: '#303030',
      regionStroke: '#404040',
      path: '#505050',
      place: '#606060',
      placeStroke: '#707070',
      selection: '#808080',
      guide: '#909090',
      vertex: '#a0a0a0',
      vertexStroke: '#b0b0b0',
    });
  });

  it('usa las reservas documentadas si falta un token', () => {
    expect(resolveSpikePalette(() => '')).toEqual(SPIKE_PALETTE_FALLBACK);
    expect(
      resolveSpikePalette((token) =>
        token === SPIKE_PALETTE_TOKENS.path ? '  ' : '',
      ),
    ).toEqual(SPIKE_PALETTE_FALLBACK);
  });

  it('lee la paleta del documento sin lanzar', () => {
    const root = document.createElement('div');
    root.style.setProperty('--spike-map-bg', '#123456');
    document.body.append(root);

    const palette = readSpikePalette(root);

    expect(palette.mapBg).toBe('#123456');
    expect(palette.path).toBe(SPIKE_PALETTE_FALLBACK.path);

    root.remove();
  });
});
