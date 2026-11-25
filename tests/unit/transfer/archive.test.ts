import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  extractArchiveEntry,
  hashArchiveEntry,
  readArchiveEntry,
  readArchiveIndex,
} from '@/main/transfer/archive/reader';
import { createArchiveWriter } from '@/main/transfer/archive/writer';
import { TransferError } from '@/main/transfer/errors';

const ASSET_ID = '018f1000-0000-7000-8000-000000000301';
const DIRECTORIES: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-archive-'));
  DIRECTORIES.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    DIRECTORIES.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true, maxRetries: 3 }),
    ),
  );
});

async function buildArchive(directory: string): Promise<string> {
  const file = join(directory, 'mundo.zip');
  const writer = createArchiveWriter(file);

  writer.addBuffer('manifest.json', Buffer.from('{"format":"x"}'));
  writer.addBuffer('world.json', Buffer.from('{"format":"x"}'));
  writer.addBuffer(`assets/${ASSET_ID}.webp`, Buffer.from('webp-data'), {
    compress: false,
  });
  await writer.finalize();

  return file;
}

describe('lector y escritor de ZIP', () => {
  it('escribe y lee un paquete válido con checksums', async () => {
    const directory = await temporaryDirectory();
    const file = await buildArchive(directory);
    const index = await readArchiveIndex(file);

    expect(index.entries.map((entry) => entry.path)).toEqual([
      'manifest.json',
      'world.json',
      `assets/${ASSET_ID}.webp`,
    ]);
    expect(index.entries[2]?.parsed.kind).toBe('asset');

    const manifest = await readArchiveEntry(file, 'manifest.json', 1024);
    expect(manifest.toString('utf8')).toBe('{"format":"x"}');

    const hash = await hashArchiveEntry(file, `assets/${ASSET_ID}.webp`, 1024);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const extracted = join(directory, 'asset.webp');
    const result = await extractArchiveEntry(
      file,
      `assets/${ASSET_ID}.webp`,
      extracted,
      1024,
    );
    expect(result.size).toBe(Buffer.byteLength('webp-data'));
    expect((await readFile(extracted)).toString('utf8')).toBe('webp-data');
  });

  it('rechaza rutas no permitidas al escribir', async () => {
    const directory = await temporaryDirectory();
    const writer = createArchiveWriter(join(directory, 'malo.zip'));

    expect(() => writer.addBuffer('../evil', Buffer.from('x'))).toThrow(
      TransferError,
    );
    await writer.abort();
  });

  it('respeta límites de entradas y de tamaño de entrada', async () => {
    const directory = await temporaryDirectory();
    const file = await buildArchive(directory);

    await expect(
      readArchiveIndex(file, { maxEntries: 2 }),
    ).rejects.toMatchObject({ code: 'TRANSFER_LIMIT_EXCEEDED' });
    await expect(
      readArchiveEntry(file, 'manifest.json', 2),
    ).rejects.toMatchObject({ code: 'TRANSFER_LIMIT_EXCEEDED' });
    await expect(
      readArchiveIndex(file, { maxUncompressedBytes: 5 }),
    ).rejects.toMatchObject({ code: 'TRANSFER_LIMIT_EXCEEDED' });
    await expect(
      readArchiveIndex(file, { maxAssetBytes: 2 }),
    ).rejects.toMatchObject({ code: 'TRANSFER_LIMIT_EXCEEDED' });
  });

  it('rechaza ratios de compresión abusivos', async () => {
    const directory = await temporaryDirectory();
    const file = join(directory, 'ratio.zip');
    const writer = createArchiveWriter(file);

    writer.addBuffer('manifest.json', Buffer.from('{}'));
    writer.addBuffer('world.json', Buffer.from('{}'));
    writer.addBuffer(`assets/${ASSET_ID}.webp`, Buffer.alloc(1024 * 1024, 0), {
      compress: true,
    });
    await writer.finalize();

    await expect(
      readArchiveIndex(file, { maxCompressionRatio: 10 }),
    ).rejects.toMatchObject({ code: 'TRANSFER_LIMIT_EXCEEDED' });
    await expect(
      readArchiveEntry(file, `assets/${ASSET_ID}.webp`, 2 * 1024 * 1024),
    ).rejects.toMatchObject({ code: 'TRANSFER_LIMIT_EXCEEDED' });
  });

  it('cancela antes de finalizar y elimina el archivo', async () => {
    const directory = await temporaryDirectory();
    const file = join(directory, 'cancelado.zip');
    const controller = new AbortController();
    const writer = createArchiveWriter(file, controller.signal);

    writer.addBuffer('manifest.json', Buffer.from('{}'));
    controller.abort();

    await expect(writer.finalize()).rejects.toMatchObject({
      code: 'TRANSFER_CANCELLED',
    });
    await expect(stat(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('no borra un destino que ya existía al escribir o extraer', async () => {
    const directory = await temporaryDirectory();
    const source = await buildArchive(directory);
    const existing = join(directory, 'existente.zip');

    await writeFile(existing, 'dato del usuario', 'utf8');

    const writer = createArchiveWriter(existing);

    writer.addBuffer('manifest.json', Buffer.from('{}'));
    await expect(writer.finalize()).rejects.toBeInstanceOf(TransferError);
    expect((await readFile(existing)).toString('utf8')).toBe(
      'dato del usuario',
    );

    const extracted = join(directory, 'existente.webp');

    await writeFile(extracted, 'dato del usuario', 'utf8');
    await expect(
      extractArchiveEntry(source, `assets/${ASSET_ID}.webp`, extracted, 1024),
    ).rejects.toBeInstanceOf(TransferError);
    expect((await readFile(extracted)).toString('utf8')).toBe(
      'dato del usuario',
    );
  });

  it('normaliza un archivo inexistente o que no es ZIP', async () => {
    const directory = await temporaryDirectory();

    await expect(
      readArchiveIndex(join(directory, 'no-existe.zip')),
    ).rejects.toMatchObject({ code: 'TRANSFER_SOURCE_NOT_FOUND' });
    await expect(
      readArchiveIndex(join(directory, 'mundo.zip')),
    ).rejects.toBeInstanceOf(TransferError);
  });
});
