import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LICENSES_DIR = join(process.cwd(), 'resources', 'licenses');
const FONTS_DIR = join(
  process.cwd(),
  'src',
  'renderer',
  'assets',
  'fonts',
  'source-serif-4',
);

describe('licencias empaquetadas', () => {
  it('incluye los textos completos de sharp, su binario y electron-updater', async () => {
    const files = (await readdir(LICENSES_DIR)).sort();

    expect(files).toEqual([
      'buffer-crc32-LICENSE.txt',
      'electron-updater-LICENSE.txt',
      'gpl-3.0.txt',
      'img-sharp-win32-LICENSE.txt',
      'libvips-LICENSE.txt',
      'maplibre-gl-LICENSE.txt',
      'pend-LICENSE.txt',
      'sharp-LICENSE.txt',
      'source-serif-4-OFL.txt',
      'terra-draw-LICENSE.txt',
      'terra-draw-maplibre-gl-adapter-LICENSE.txt',
      'tiptap-LICENSE.txt',
      'yauzl-LICENSE.txt',
      'yazl-LICENSE.txt',
    ]);

    for (const file of files) {
      const contents = await readFile(join(LICENSES_DIR, file), 'utf8');

      expect(contents.length).toBeGreaterThan(500);
      expect(contents).not.toMatch(/placeholder|TODO/i);
    }

    expect(
      await readFile(join(LICENSES_DIR, 'sharp-LICENSE.txt'), 'utf8'),
    ).toContain('Apache License');
    expect(
      await readFile(join(LICENSES_DIR, 'img-sharp-win32-LICENSE.txt'), 'utf8'),
    ).toContain('Apache License');
    expect(
      await readFile(join(LICENSES_DIR, 'libvips-LICENSE.txt'), 'utf8'),
    ).toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    expect(await readFile(join(LICENSES_DIR, 'gpl-3.0.txt'), 'utf8')).toContain(
      'GNU GENERAL PUBLIC LICENSE',
    );
    expect(
      await readFile(
        join(LICENSES_DIR, 'electron-updater-LICENSE.txt'),
        'utf8',
      ),
    ).toContain('MIT');
    expect(
      await readFile(join(LICENSES_DIR, 'tiptap-LICENSE.txt'), 'utf8'),
    ).toContain('MIT License');
    expect(
      await readFile(join(LICENSES_DIR, 'maplibre-gl-LICENSE.txt'), 'utf8'),
    ).toContain('BSD');
    expect(
      await readFile(join(LICENSES_DIR, 'maplibre-gl-LICENSE.txt'), 'utf8'),
    ).toContain('Redistribution and use');

    for (const file of [
      'terra-draw-LICENSE.txt',
      'terra-draw-maplibre-gl-adapter-LICENSE.txt',
    ]) {
      const contents = await readFile(join(LICENSES_DIR, file), 'utf8');

      expect(contents).toContain('Permission is hereby granted');
      expect(contents).toContain('James Milner');
    }

    for (const file of [
      'yauzl-LICENSE.txt',
      'yazl-LICENSE.txt',
      'pend-LICENSE.txt',
      'buffer-crc32-LICENSE.txt',
    ]) {
      expect(await readFile(join(LICENSES_DIR, file), 'utf8')).toContain('MIT');
    }
  });

  it('incluye el texto OFL de Source Serif 4 idéntico al activo', async () => {
    const packaged = join(LICENSES_DIR, 'source-serif-4-OFL.txt');
    const asset = join(
      process.cwd(),
      'src',
      'renderer',
      'assets',
      'fonts',
      'source-serif-4',
      'OFL.txt',
    );
    const contents = await readFile(packaged, 'utf8');

    expect(contents).toContain('SIL OPEN FONT LICENSE');
    expect(contents).toContain(
      'Copyright 2014 The Source Serif 4 Project Authors',
    );

    const [packagedBytes, assetBytes] = await Promise.all([
      readFile(packaged),
      readFile(asset),
    ]);

    expect(packagedBytes.equals(assetBytes)).toBe(true);
  });

  it('fija la integridad SHA-256 de los woff2 empaquetados', async () => {
    const expected = new Map([
      [
        'source-serif-4-regular-latin.woff2',
        '02194DEB92D3975DD30E11A3824A1F1DB32B48C93654E60560CB81CE8E7B5F95',
      ],
      [
        'source-serif-4-semibold-latin.woff2',
        'F2B7E1CF1D277B7608231868135648F8AD8E2B58D8E97CA088BEE15DC357BEE7',
      ],
    ]);

    for (const [file, hash] of expected) {
      const bytes = await readFile(join(FONTS_DIR, file));
      const actual = createHash('sha256')
        .update(bytes)
        .digest('hex')
        .toUpperCase();

      expect(actual, file).toBe(hash);
    }
  });
});
