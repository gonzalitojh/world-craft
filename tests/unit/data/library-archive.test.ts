import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { readLibraryArchiveIndex } from '@/main/data/library/archive';
import { parseLibraryEntryPath } from '@/main/data/library/paths';
import { createArchiveWriter } from '@/main/transfer/archive/writer';
import { buildRawZip } from '../../integration/helpers/zip';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('índice de la biblioteca', () => {
  it('rechaza entradas duplicadas ignorando mayúsculas', async () => {
    const root = await mkdtemp(join(tmpdir(), 'world-craft-library-index-'));
    temporaryDirectories.push(root);
    const file = join(root, 'duplicada.zip');
    const data = Buffer.from('{}', 'utf8');

    await writeFile(
      file,
      buildRawZip([
        { name: 'manifest.json', data },
        { name: 'manifest.json', data },
      ]),
    );

    await expect(readLibraryArchiveIndex(file)).rejects.toMatchObject({
      code: 'DATA_LIBRARY_ENTRY_INVALID',
    });
  });

  it('el escritor usa la lista blanca de la biblioteca', async () => {
    const root = await mkdtemp(join(tmpdir(), 'world-craft-library-writer-'));
    temporaryDirectories.push(root);
    const file = join(root, 'salida.zip');
    const writer = createArchiveWriter(file, undefined, {
      parsePath: parseLibraryEntryPath,
    });

    expect(() =>
      writer.addBuffer('world.json', Buffer.from('{}', 'utf8')),
    ).toThrowError(
      expect.objectContaining({ code: 'DATA_LIBRARY_ENTRY_INVALID' }),
    );
    await writer.abort();

    const validFile = join(root, 'valida.zip');
    const valid = createArchiveWriter(validFile, undefined, {
      parsePath: parseLibraryEntryPath,
    });

    valid.addBuffer('settings.json', Buffer.from('{}', 'utf8'));
    await valid.finalize();

    await expect(readLibraryArchiveIndex(validFile)).resolves.toMatchObject({
      entries: [
        expect.objectContaining({
          path: 'settings.json',
          parsed: expect.objectContaining({ kind: 'settings' }),
        }),
      ],
    });
  });
});
