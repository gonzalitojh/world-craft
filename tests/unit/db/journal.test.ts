import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { computeSqlChecksum } from '@/main/db/checksum';
import { DatabaseError } from '@/main/db/errors';
import { loadMigrations } from '@/main/db/journal';

const temporaryDirectories: string[] = [];

async function createMigrationsDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-journal-'));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, 'meta'), { recursive: true });

  return directory;
}

async function writeJournal(
  directory: string,
  entries: readonly Record<string, unknown>[],
): Promise<void> {
  await writeFile(
    join(directory, 'meta', '_journal.json'),
    JSON.stringify({ version: '7', dialect: 'sqlite', entries }),
    'utf8',
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('journal de migraciones', () => {
  it('carga el SQL y calcula su checksum normalizado', async () => {
    const directory = await createMigrationsDirectory();
    const sql = 'CREATE TABLE a (id TEXT);\r\n';

    await writeJournal(directory, [
      {
        idx: 0,
        version: '6',
        when: 1_760_000_000_000,
        tag: '0000_init',
        breakpoints: true,
      },
    ]);
    await writeFile(join(directory, '0000_init.sql'), sql, 'utf8');

    const migrations = loadMigrations(directory);

    expect(migrations).toHaveLength(1);
    expect(migrations[0]?.tag).toBe('0000_init');
    expect(migrations[0]?.checksum).toBe(computeSqlChecksum(sql));
  });

  it('rechaza un journal ausente o inválido', async () => {
    const directory = await createMigrationsDirectory();

    expect(() => loadMigrations(directory)).toThrow(DatabaseError);

    await writeFile(join(directory, 'meta', '_journal.json'), '{}', 'utf8');

    expect(() => loadMigrations(directory)).toThrow(DatabaseError);
  });

  it('rechaza etiquetas con rutas o secuencias con huecos', async () => {
    const directory = await createMigrationsDirectory();

    await writeJournal(directory, [
      {
        idx: 0,
        version: '6',
        when: 1,
        tag: '../evil',
      },
    ]);

    expect(() => loadMigrations(directory)).toThrow(DatabaseError);

    await writeJournal(directory, [
      { idx: 0, version: '6', when: 1, tag: '0000_init' },
      { idx: 2, version: '6', when: 2, tag: '0002_later' },
    ]);

    expect(() => loadMigrations(directory)).toThrow(DatabaseError);
  });

  it('rechaza una migración sin archivo SQL o vacía', async () => {
    const directory = await createMigrationsDirectory();

    await writeJournal(directory, [
      { idx: 0, version: '6', when: 1, tag: '0000_init' },
    ]);

    expect(() => loadMigrations(directory)).toThrow(DatabaseError);

    await writeFile(join(directory, '0000_init.sql'), '   \n', 'utf8');

    expect(() => loadMigrations(directory)).toThrow(DatabaseError);
  });
});
