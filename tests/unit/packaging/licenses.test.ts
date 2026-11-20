import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LICENSES_DIR = join(process.cwd(), 'resources', 'licenses');

describe('licencias empaquetadas', () => {
  it('incluye los textos completos de sharp, su binario y electron-updater', async () => {
    const files = (await readdir(LICENSES_DIR)).sort();

    expect(files).toEqual([
      'electron-updater-LICENSE.txt',
      'gpl-3.0.txt',
      'img-sharp-win32-LICENSE.txt',
      'libvips-LICENSE.txt',
      'sharp-LICENSE.txt',
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
  });
});
