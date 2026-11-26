import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  isRestorableManifest,
  normalizeBackupManifest,
  tryReadBackupManifest,
  writeBackupManifest,
  type BackupManifest,
} from '@/main/backup/manifest';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-manifest-'));
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

const v2Manifest = {
  formatVersion: 2,
  reason: 'daily',
  createdAt: '2026-11-19T10:00:00.000Z',
  databaseFile: 'world-craft.sqlite',
  schemaVersion: 2,
  sizeBytes: 4096,
  sha256: 'a'.repeat(64),
  integrity: 'ok',
  assetsIncluded: false,
};

describe('manifiesto de copia', () => {
  it('acepta un manifiesto v2 válido', () => {
    expect(normalizeBackupManifest(v2Manifest)).toEqual(v2Manifest);
  });

  it('acepta el motivo pre-purge sin cambiar el formato v2', () => {
    const manifest = { ...v2Manifest, reason: 'pre-purge' };

    expect(normalizeBackupManifest(manifest)).toEqual(manifest);
    // Un manifiesto anterior con otro motivo del enum sigue siendo válido.
    expect(normalizeBackupManifest(v2Manifest)).toEqual(v2Manifest);
  });

  it('acepta pre-delete en v2 y mantiene la lectura de v2 antiguos', () => {
    const manifest = { ...v2Manifest, reason: 'pre-delete' };

    expect(normalizeBackupManifest(manifest)).toEqual(manifest);
    expect(normalizeBackupManifest(v2Manifest)).toEqual(v2Manifest);
  });

  it('normaliza un manifiesto v1 como copia íntegra y sin assets', () => {
    const manifest = normalizeBackupManifest({
      formatVersion: 1,
      reason: 'pre-migration',
      createdAt: '2026-11-19T10:00:00.000Z',
      databaseFile: 'world-craft.sqlite',
      schemaVersion: 1,
      sizeBytes: 4096,
      sha256: 'b'.repeat(64),
    });

    expect(manifest).toMatchObject({
      formatVersion: 1,
      reason: 'pre-migration',
      schemaVersion: 1,
      integrity: 'ok',
      assetsIncluded: false,
    });
  });

  it('rechaza motivos, versiones, hashes y campos desconocidos', () => {
    expect(
      normalizeBackupManifest({ ...v2Manifest, reason: 'manual' }),
    ).toBeNull();
    expect(
      normalizeBackupManifest({ ...v2Manifest, formatVersion: 3 }),
    ).toBeNull();
    expect(
      normalizeBackupManifest({ ...v2Manifest, sha256: 'abc' }),
    ).toBeNull();
    expect(
      normalizeBackupManifest({ ...v2Manifest, integrity: 'maybe' }),
    ).toBeNull();
    expect(normalizeBackupManifest({ ...v2Manifest, extra: true })).toBeNull();
    expect(
      normalizeBackupManifest({ ...v2Manifest, assetsIncluded: true }),
    ).toBeNull();
  });

  it('solo ofrece restaurar copias con integridad ok y versión conocida', () => {
    const manifest = normalizeBackupManifest(v2Manifest) as BackupManifest;

    expect(isRestorableManifest(manifest)).toBe(true);
    expect(isRestorableManifest({ ...manifest, integrity: 'failed' })).toBe(
      false,
    );
    expect(isRestorableManifest({ ...manifest, schemaVersion: null })).toBe(
      false,
    );
    expect(isRestorableManifest({ ...manifest, reason: 'pre-delete' })).toBe(
      false,
    );
  });

  it('escribe sin sobrescribir y vuelve a leer el manifiesto', async () => {
    const directory = await createTemporaryDirectory();
    const manifest = normalizeBackupManifest(v2Manifest) as BackupManifest;

    const manifestFile = await writeBackupManifest(directory, manifest);

    expect(await tryReadBackupManifest(directory)).toEqual(v2Manifest);
    await expect(writeBackupManifest(directory, manifest)).rejects.toThrow();

    const raw = JSON.parse(await readFile(manifestFile, 'utf8')) as unknown;
    expect(raw).toEqual(v2Manifest);
  });

  it('devuelve null si falta el manifiesto o no es JSON', async () => {
    const directory = await createTemporaryDirectory();

    expect(await tryReadBackupManifest(directory)).toBeNull();

    await writeFile(join(directory, 'manifest.json'), 'no-json', 'utf8');
    expect(await tryReadBackupManifest(directory)).toBeNull();
  });
});
