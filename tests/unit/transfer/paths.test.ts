import { describe, expect, it } from 'vitest';

import {
  buildTransferAssetPath,
  isWindowsReservedName,
  parseTransferEntryPath,
} from '@/main/transfer/format/paths';
import { TransferError } from '@/main/transfer/errors';

const ASSET_ID = '018f1000-0000-7000-8000-000000000301';

describe('política de rutas del ZIP', () => {
  it('acepta las tres formas canónicas', () => {
    expect(parseTransferEntryPath('manifest.json')).toEqual({
      kind: 'manifest',
      path: 'manifest.json',
      assetId: null,
    });
    expect(parseTransferEntryPath('world.json')).toEqual({
      kind: 'world',
      path: 'world.json',
      assetId: null,
    });
    expect(parseTransferEntryPath(`assets/${ASSET_ID}.webp`)).toEqual({
      kind: 'asset',
      path: `assets/${ASSET_ID}.webp`,
      assetId: ASSET_ID,
    });
    expect(buildTransferAssetPath(ASSET_ID)).toBe(`assets/${ASSET_ID}.webp`);
  });

  it.each([
    '../manifest.json',
    'assets/../world.json',
    'assets/./x.webp',
    '/etc/passwd',
    'C:/Windows/x.webp',
    '\\\\servidor\\share\\x.webp',
    'assets\\x.webp',
    'assets/x.webp:stream',
    'Assets/x.webp',
    'assets/X.webp',
    'assets/018F1000-0000-7000-8000-000000000301.webp',
    'assets/',
    'assets',
    'assets/018f1000-0000-7000-8000-000000000301.png',
    'assets/not-a-uuid.webp',
    'assets/CON.webp',
    'assets/nul.webp',
    'assets/018f1000-0000-7000-8000-000000000301.webp/extra',
    '',
    'manifest.json\n',
  ])('rechaza %s', (path) => {
    expect(() => parseTransferEntryPath(path)).toThrow(TransferError);
  });

  it('detecta nombres reservados sin distinguir mayúsculas', () => {
    expect(isWindowsReservedName('CON')).toBe(true);
    expect(isWindowsReservedName('con.txt')).toBe(true);
    expect(isWindowsReservedName('COM7')).toBe(true);
    expect(isWindowsReservedName('LPT9.log')).toBe(true);
    expect(isWindowsReservedName('contenido.txt')).toBe(false);
    expect(isWindowsReservedName('mapa')).toBe(false);
  });

  it('rechaza valores que no son cadenas', () => {
    for (const value of [null, 42, {}, []]) {
      expect(() => parseTransferEntryPath(value)).toThrow(TransferError);
    }
  });
});
