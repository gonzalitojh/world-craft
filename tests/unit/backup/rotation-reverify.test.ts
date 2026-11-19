import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listBackups: vi.fn(),
  inspectBackup: vi.fn(),
}));

vi.mock('@/main/backup/inventory', () => ({
  listBackups: mocks.listBackups,
  selectValidBackups: (entries: Array<{ verification: { ok: boolean } }>) =>
    entries.filter((entry) => entry.verification.ok),
}));

vi.mock('@/main/backup/verify', () => ({
  inspectBackup: mocks.inspectBackup,
}));

import { rotateBackups } from '@/main/backup/rotation';

function validEntry(directory: string, createdAt: string) {
  const manifest = {
    formatVersion: 2,
    reason: 'daily',
    createdAt,
    databaseFile: 'world-craft.sqlite',
    schemaVersion: 2,
    sizeBytes: 1,
    sha256: 'a'.repeat(64),
    integrity: 'ok',
    assetsIncluded: false,
  };

  return { directory, manifest, verification: { ok: true, manifest } };
}

const directories = {
  daily: 'C:/backups/daily',
  weekly: 'C:/backups/weekly',
  monthly: 'C:/backups/monthly',
  preMigration: 'C:/backups/pre-migration',
};

describe('rotación con reverificación fallida', () => {
  it('conserva y contabiliza como omitida la copia que deja de verificar', async () => {
    mocks.listBackups.mockImplementation(async (directory: string) =>
      directory === directories.daily
        ? [
            validEntry('C:/backups/daily/nueva', '2026-11-19T10:00:00.000Z'),
            validEntry('C:/backups/daily/vieja', '2026-11-18T10:00:00.000Z'),
          ]
        : [],
    );
    mocks.inspectBackup.mockResolvedValue({
      ok: false,
      reason: 'integrity',
    });

    const result = await rotateBackups({
      directories,
      retention: { daily: 1, weekly: 4, monthly: 12, preMigration: 5 },
      targetSchemaVersion: 2,
    });

    expect(result).toEqual({
      removed: 0,
      kept: 2,
      corrupt: 0,
      skipped: 1,
      failed: 0,
    });
    expect(mocks.inspectBackup).toHaveBeenCalledTimes(1);
    expect(mocks.inspectBackup).toHaveBeenCalledWith('C:/backups/daily/vieja', {
      targetSchemaVersion: 2,
    });
  });
});
