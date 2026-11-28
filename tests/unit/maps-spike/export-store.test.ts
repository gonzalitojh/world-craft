import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  SPIKE_EXPORT_MAX_BYTES,
  SPIKE_EXPORT_FILE_NAME_PATTERN,
  type SpikeExportInput,
} from '@/shared/contracts/maps-spike';
import {
  SpikeExportError,
  buildSpikeExportFileName,
  createSpikeExportStore,
  createUnavailableSpikeExportStore,
  isValidSpikeExportInput,
} from '@/main/spike-maps/export-store';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-spike-export-'));
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

function randomFrom(tokens: readonly string[]): (size: number) => Uint8Array {
  let index = 0;

  return (size: number) => {
    const token = tokens[Math.min(index, tokens.length - 1)] ?? '00000000';
    index += 1;

    return Buffer.from(token.padEnd(size * 2, '0').slice(0, size * 2), 'hex');
  };
}

describe('almacén de exportaciones del spike', () => {
  it('genera nombres canónicos y valida la entrada de dominio', () => {
    expect(buildSpikeExportFileName('svg', 'abcdef12')).toBe(
      'wc-m2-01-svg-abcdef12.svg',
    );
    expect(
      SPIKE_EXPORT_FILE_NAME_PATTERN.test(
        buildSpikeExportFileName('markdown', 'abcdef12'),
      ),
    ).toBe(true);
    expect(() => buildSpikeExportFileName('svg', 'ABCDEF12')).toThrow(
      SpikeExportError,
    );

    expect(
      isValidSpikeExportInput({
        kind: 'geojson',
        content: new Uint8Array([1]),
      }),
    ).toBe(true);
    expect(isValidSpikeExportInput({ kind: 'geojson', content: [] })).toBe(
      false,
    );
    expect(
      isValidSpikeExportInput({
        kind: 'pdf',
        content: new Uint8Array([1]),
      }),
    ).toBe(false);
    expect(
      isValidSpikeExportInput({
        kind: 'geojson',
        content: new Uint8Array(SPIKE_EXPORT_MAX_BYTES + 1),
      }),
    ).toBe(false);
  });

  it('escribe solo dentro de userData/data/spike-maps y no devuelve rutas', async () => {
    const userDataDir = await temporaryDirectory();
    const store = createSpikeExportStore({
      userDataDir,
      randomBytes: randomFrom(['abcdef12', '12345678', '90abcdef']),
    });
    const result = await store.saveExport({
      kind: 'svg',
      content: new TextEncoder().encode('<svg />'),
    });

    expect(result).toEqual({
      fileName: 'wc-m2-01-svg-abcdef12.svg',
      bytes: 7,
    });
    expect(JSON.stringify(result)).not.toContain(userDataDir);

    const file = join(userDataDir, 'data', 'spike-maps', result.fileName);
    expect(await readFile(file, 'utf8')).toBe('<svg />');
    expect((await stat(file)).size).toBe(7);
  });

  it('admite todos los tipos y usa la extensión correcta', async () => {
    const userDataDir = await temporaryDirectory();
    const store = createSpikeExportStore({
      userDataDir,
      randomBytes: randomFrom([
        '11111111',
        '22222222',
        '33333333',
        '44444444',
        '55555555',
      ]),
    });
    const kinds = ['svg', 'png', 'geojson', 'json', 'markdown'] as const;
    const results = [];

    for (const kind of kinds) {
      results.push(
        await store.saveExport({
          kind,
          content: new Uint8Array([1, 2, 3]),
        }),
      );
    }

    expect(results.map((result) => result.fileName)).toEqual([
      'wc-m2-01-svg-11111111.svg',
      'wc-m2-01-png-22222222.png',
      'wc-m2-01-geojson-33333333.geojson',
      'wc-m2-01-json-44444444.json',
      'wc-m2-01-markdown-55555555.md',
    ]);

    for (const result of results) {
      expect(
        (
          await stat(join(userDataDir, 'data', 'spike-maps', result.fileName))
        ).isFile(),
      ).toBe(true);
    }
  });

  it('rechaza contenido inválido antes de crear la carpeta', async () => {
    const userDataDir = await temporaryDirectory();
    const store = createSpikeExportStore({ userDataDir });

    for (const input of [
      { kind: 'svg', content: new Uint8Array() },
      { kind: 'pdf', content: new Uint8Array([1]) },
      { kind: 'svg', content: 'texto' },
      null,
    ] as unknown as SpikeExportInput[]) {
      await expect(store.saveExport(input)).rejects.toMatchObject({
        code: 'SPIKE_EXPORT_INVALID_INPUT',
      });
    }

    await expect(
      stat(join(userDataDir, 'data', 'spike-maps')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('no sobrescribe una exportación existente', async () => {
    const userDataDir = await temporaryDirectory();
    const store = createSpikeExportStore({
      userDataDir,
      randomBytes: randomFrom(['aaaaaaaa']),
    });
    const input = { kind: 'json' as const, content: new Uint8Array([1]) };

    await store.saveExport(input);

    await expect(store.saveExport(input)).rejects.toMatchObject({
      code: 'SPIKE_EXPORT_WRITE_FAILED',
    });
  });

  it('rechaza un userData inválido y el almacén inerte no escribe', async () => {
    for (const userDataDir of ['', '   ', 'datos/relativos', `a${'\0'}b`]) {
      expect(() => createSpikeExportStore({ userDataDir })).toThrow(
        SpikeExportError,
      );
    }

    await expect(
      createUnavailableSpikeExportStore().saveExport({
        kind: 'svg',
        content: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ code: 'SPIKE_EXPORT_UNAVAILABLE' });
  });
});
