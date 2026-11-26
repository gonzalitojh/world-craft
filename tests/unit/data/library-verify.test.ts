import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { verifyLibraryArchive } from '@/main/data/library/verify';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('verificación de la biblioteca', () => {
  it('traduce un ZIP malformado a un error de verificación', async () => {
    const root = await mkdtemp(join(tmpdir(), 'world-craft-library-bad-'));
    temporaryDirectories.push(root);
    const file = join(root, 'biblioteca.zip');
    const database = join(root, 'world-craft.sqlite');

    await writeFile(file, 'esto no es un zip', 'utf8');
    await writeFile(database, 'tampoco es una base', 'utf8');

    await expect(
      verifyLibraryArchive({
        file,
        stagedDatabaseFile: database,
        stagedWorldFiles: new Map(),
      }),
    ).rejects.toMatchObject({ code: 'DATA_LIBRARY_VERIFY_FAILED' });
  });
});
