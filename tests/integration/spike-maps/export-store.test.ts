import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createSpikeExportStore,
  type SpikeExportStore,
} from '@/main/spike-maps/export-store';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-spike-int-'));
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

function store(userDataDir: string): SpikeExportStore {
  return createSpikeExportStore({
    userDataDir,
    randomBytes: (size) => Buffer.from('abcdef12'.slice(0, size * 2), 'hex'),
  });
}

describe('export-store de integración', () => {
  it('crea la carpeta en el primer guardado y conserva los bytes', async () => {
    const userDataDir = await temporaryDirectory();
    const content = new Uint8Array([0, 1, 2, 255]);
    const result = await store(userDataDir).saveExport({
      kind: 'png',
      content,
    });

    expect(result).toEqual({
      fileName: 'wc-m2-01-png-abcdef12.png',
      bytes: 4,
    });
    expect(
      await readFile(join(userDataDir, 'data', 'spike-maps', result.fileName)),
    ).toEqual(Buffer.from(content));
    expect(
      (await stat(join(userDataDir, 'data', 'spike-maps', result.fileName)))
        .size,
    ).toBe(4);
  });

  it('rechaza una junction en spike-maps y no escribe fuera', async () => {
    const userDataDir = await temporaryDirectory();
    const outside = await temporaryDirectory();
    const dataDir = join(userDataDir, 'data');
    await mkdir(dataDir, { recursive: true });

    try {
      await symlink(
        outside,
        join(dataDir, 'spike-maps'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      // Sin permiso para enlaces, el vector no se puede reproducir en esta
      // máquina; la comprobación léxica y de lstat queda cubierta por el
      // resto de pruebas del store.
      return;
    }

    await expect(
      store(userDataDir).saveExport({
        kind: 'svg',
        content: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ code: 'SPIKE_EXPORT_WRITE_FAILED' });
    expect(await readdir(outside)).toEqual([]);
  });

  it('rechaza una junction en data y no escribe fuera', async () => {
    const userDataDir = await temporaryDirectory();
    const outside = await temporaryDirectory();

    try {
      await symlink(
        outside,
        join(userDataDir, 'data'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      return;
    }

    await expect(
      store(userDataDir).saveExport({
        kind: 'json',
        content: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ code: 'SPIKE_EXPORT_WRITE_FAILED' });
    expect(await readdir(outside)).toEqual([]);
  });

  it('falla de forma controlada si spike-maps es un archivo', async () => {
    const userDataDir = await temporaryDirectory();
    await mkdir(join(userDataDir, 'data'), { recursive: true });
    await writeFile(join(userDataDir, 'data', 'spike-maps'), 'bloqueado');

    await expect(
      store(userDataDir).saveExport({
        kind: 'markdown',
        content: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ code: 'SPIKE_EXPORT_WRITE_FAILED' });
  });
});
