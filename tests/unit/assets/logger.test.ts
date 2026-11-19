import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createAssetLogger } from '@/main/assets/logger';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-assets-log-'));
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

describe('log de assets', () => {
  it('escribe una línea JSON por evento con marca de tiempo', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'assets.log');
    const logger = createAssetLogger(file, () => 1_760_000_000_000);

    logger.log({ event: 'asset.import', outcome: 'created' });
    logger.log({
      event: 'asset.request',
      outcome: 'rejected',
      status: 404,
      code: 'ASSET_NOT_FOUND',
    });

    const lines = (await readFile(file, 'utf8')).trim().split('\n');

    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0] as string) as Record<string, unknown>;
    const second = JSON.parse(lines[1] as string) as Record<string, unknown>;

    expect(first).toEqual({
      timestamp: new Date(1_760_000_000_000).toISOString(),
      event: 'asset.import',
      outcome: 'created',
    });
    expect(second).toMatchObject({
      event: 'asset.request',
      outcome: 'rejected',
      status: 404,
      code: 'ASSET_NOT_FOUND',
    });
  });

  it('rota a .1 al superar el límite', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'assets.log');
    const logger = createAssetLogger(file, () => 1_760_000_000_000, {
      maxBytes: 120,
    });

    for (let index = 0; index < 12; index += 1) {
      logger.log({ event: 'asset.import', outcome: 'created' });
    }

    const rotated = (await readFile(`${file}.1`, 'utf8')).trim().split('\n');
    const current = (await readFile(file, 'utf8')).trim().split('\n');

    expect(rotated.length).toBeGreaterThan(0);
    expect(current.length).toBeGreaterThan(0);

    for (const line of [...rotated, ...current]) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    // Solo se conserva un archivo rotado: la comprobación relevante es que la
    // rotación ocurre y que el archivo vivo no crece sin control.
    expect((await stat(file)).size).toBeLessThanOrEqual(120 + 84);
  });

  it('no lanza si el destino no se puede escribir', async () => {
    const directory = await createTemporaryDirectory();
    // La carpeta intermedia no existe: la escritura falla y el logger la ignora.
    const logger = createAssetLogger(join(directory, 'carpeta', 'assets.log'));

    expect(() =>
      logger.log({ event: 'asset.import', outcome: 'created' }),
    ).not.toThrow();
  });
});
