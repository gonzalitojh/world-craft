import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createUpdateLogger } from '@/main/updates/logger';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-updates-log-'));
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

describe('log del actualizador', () => {
  it('escribe eventos tipados sin URLs, rutas ni mensajes', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'updates.log');
    const logger = createUpdateLogger(file, () => 1_760_000_000_000);

    logger.log({ event: 'update.check', outcome: 'started' });
    logger.log({
      event: 'update.composition',
      outcome: 'disabled',
      reason: 'not-configured',
    });

    const text = await readFile(file, 'utf8');
    const lines = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(lines).toEqual([
      {
        timestamp: new Date(1_760_000_000_000).toISOString(),
        event: 'update.check',
        outcome: 'started',
      },
      {
        timestamp: new Date(1_760_000_000_000).toISOString(),
        event: 'update.composition',
        outcome: 'disabled',
        reason: 'not-configured',
      },
    ]);
    expect(text).not.toContain('https://');
    expect(text).not.toMatch(/[A-Za-z]:\\/);
  });

  it('no lanza si el destino no se puede escribir', async () => {
    const directory = await createTemporaryDirectory();
    const logger = createUpdateLogger(
      join(directory, 'carpeta', 'updates.log'),
    );

    expect(() =>
      logger.log({ event: 'update.check', outcome: 'started' }),
    ).not.toThrow();
  });
});
