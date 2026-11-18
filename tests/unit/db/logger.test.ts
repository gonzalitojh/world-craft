import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createStartupLogger } from '@/main/db/logger';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-log-'));
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

describe('log de arranque', () => {
  it('escribe una línea JSON por evento, sin campos libres', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'startup.log');
    const logger = createStartupLogger(file, () => 1_760_000_000_000);

    logger.log({
      event: 'database.startup',
      outcome: 'ready',
      schemaVersion: 1,
      appliedMigrations: 1,
      newDatabase: true,
      backupCreated: false,
      integrity: 'ok',
    });
    logger.log({
      event: 'database.startup',
      outcome: 'safe-mode',
      code: 'DB_INTEGRITY_FAILED',
      schemaVersion: 1,
      integrity: 'failed',
    });

    const lines = (await readFile(file, 'utf8')).trim().split('\n');

    expect(lines).toHaveLength(2);

    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      timestamp: new Date(1_760_000_000_000).toISOString(),
      event: 'database.startup',
      outcome: 'ready',
      schemaVersion: 1,
      integrity: 'ok',
    });
    expect(JSON.parse(lines[1] ?? '{}')).toMatchObject({
      outcome: 'safe-mode',
      code: 'DB_INTEGRITY_FAILED',
      integrity: 'failed',
    });
  });

  it('rota a startup.log.1 al superar el límite y reemplaza el anterior', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'startup.log');
    const rotatedFile = `${file}.1`;
    const original = 'x'.repeat(120);

    await writeFile(file, original, 'utf8');
    await writeFile(rotatedFile, 'anterior', 'utf8');

    const logger = createStartupLogger(file, () => 1_760_000_000_000, {
      maxBytes: 50,
    });

    logger.log({
      event: 'database.startup',
      outcome: 'ready',
      schemaVersion: 1,
      appliedMigrations: 1,
      newDatabase: true,
      backupCreated: false,
      integrity: 'ok',
    });

    expect(await readFile(rotatedFile, 'utf8')).toBe(original);

    const lines = (await readFile(file, 'utf8')).trim().split('\n');

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      event: 'database.startup',
      outcome: 'ready',
    });
  });

  it('no lanza si el archivo de log no se puede escribir', async () => {
    const directory = await createTemporaryDirectory();
    const logger = createStartupLogger(
      join(directory, 'carpeta-inexistente', 'startup.log'),
    );

    expect(() =>
      logger.log({
        event: 'database.startup',
        outcome: 'safe-mode',
        code: 'DB_OPEN_FAILED',
        schemaVersion: null,
        integrity: 'unknown',
      }),
    ).not.toThrow();
  });
});
