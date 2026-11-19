import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveRestoreDirectory } from '@/main/backup/restore';
import { DatabaseError } from '@/main/db/errors';

const temporaryDirectories: string[] = [];

async function createRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-restore-path-'));
  temporaryDirectories.push(directory);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('selección segura de la carpeta de copia', () => {
  it('acepta una carpeta real dentro de backups', async () => {
    const root = await createRoot();
    const backupsDir = join(root, 'backups');
    const candidate = join(backupsDir, 'daily', '20261119T100000000Z');

    await mkdir(candidate, { recursive: true });

    expect(resolveRestoreDirectory({ backupsDir, candidate })).toBe(
      await realpath(candidate),
    );
  });

  it('rechaza una carpeta fuera de backups', async () => {
    const root = await createRoot();
    const backupsDir = join(root, 'backups');
    const candidate = join(root, 'otra', 'copia');

    await mkdir(backupsDir, { recursive: true });
    await mkdir(candidate, { recursive: true });

    expect(() => resolveRestoreDirectory({ backupsDir, candidate })).toThrow(
      DatabaseError,
    );
  });

  it('rechaza la propia raíz de copias y un archivo', async () => {
    const root = await createRoot();
    const backupsDir = join(root, 'backups');
    const file = join(backupsDir, 'manifest.json');

    await mkdir(backupsDir, { recursive: true });
    await writeFile(file, 'no es una carpeta', 'utf8');

    expect(() =>
      resolveRestoreDirectory({ backupsDir, candidate: backupsDir }),
    ).toThrow(DatabaseError);
    expect(() =>
      resolveRestoreDirectory({ backupsDir, candidate: 'relativa' }),
    ).toThrow(DatabaseError);
    expect(() =>
      resolveRestoreDirectory({ backupsDir, candidate: file }),
    ).toThrow(DatabaseError);
  });

  it('rechaza una ruta con NUL o inexistente', async () => {
    const root = await createRoot();
    const backupsDir = join(root, 'backups');

    await mkdir(backupsDir, { recursive: true });

    expect(() =>
      resolveRestoreDirectory({
        backupsDir,
        candidate: join(backupsDir, `copia${String.fromCharCode(0)}oculta`),
      }),
    ).toThrow(DatabaseError);
    expect(() =>
      resolveRestoreDirectory({
        backupsDir,
        candidate: join(backupsDir, 'no-existe'),
      }),
    ).toThrow(DatabaseError);
  });
});
