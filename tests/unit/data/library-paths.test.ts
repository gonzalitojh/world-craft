import { describe, expect, it } from 'vitest';

import { parseLibraryEntryPath } from '@/main/data/library/paths';

describe('rutas de la biblioteca', () => {
  it('acepta las cuatro entradas canónicas', () => {
    expect(parseLibraryEntryPath('manifest.json')).toEqual({
      kind: 'manifest',
      path: 'manifest.json',
      slug: null,
    });
    expect(parseLibraryEntryPath('settings.json')).toEqual({
      kind: 'settings',
      path: 'settings.json',
      slug: null,
    });
    expect(parseLibraryEntryPath('database/world-craft.sqlite')).toEqual({
      kind: 'database',
      path: 'database/world-craft.sqlite',
      slug: null,
    });
    expect(parseLibraryEntryPath('worlds/cronica-de-las-mareas.zip')).toEqual({
      kind: 'world',
      path: 'worlds/cronica-de-las-mareas.zip',
      slug: 'cronica-de-las-mareas',
    });
  });

  it('rechaza rutas fuera de la lista blanca', () => {
    for (const path of [
      '',
      '/manifest.json',
      'manifest.json/',
      'Manifest.json',
      'settings.json.bak',
      'database/World-Craft.sqlite',
      'database/world-craft.sqlite/',
      'database/otra.sqlite',
      'worlds/foo',
      'worlds/foo.ZIP',
      'worlds/Foo.zip',
      'worlds/foo.zip/',
      'worlds/foo.zip.bak',
      'worlds/foo/bar.zip',
      'worlds/.zip',
      'worlds/-foo.zip',
      'worlds/foo--bar.zip',
      'worlds/foo_bar.zip',
      'worlds/con.zip',
      'worlds/nul.zip',
      'worlds/aux.zip',
      `worlds/${'a'.repeat(81)}.zip`,
      'worlds/foo.zip:extra',
      'worlds\\foo.zip',
      'worlds/foo.zip\0',
      'otra-carpeta/foo.zip',
    ]) {
      expect(() => parseLibraryEntryPath(path), path).toThrowError(
        expect.objectContaining({ code: 'DATA_LIBRARY_ENTRY_INVALID' }),
      );
    }
  });

  it('rechaza tipos que no son texto', () => {
    for (const value of [null, 1, {}, []]) {
      expect(() => parseLibraryEntryPath(value)).toThrowError(
        expect.objectContaining({ code: 'DATA_LIBRARY_ENTRY_INVALID' }),
      );
    }
  });
});
