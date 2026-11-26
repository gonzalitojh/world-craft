import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';

import { createDataService } from '@/main/data/service';
import type { DataCounts } from '@/main/data/counts';
import type { DataOrphanSummary } from '@/main/data/orphans';
import type { DataUsage } from '@/main/data/usage';
import { resolveDataPaths } from '@/main/db/paths';

const counts: DataCounts = {
  worlds: { active: 2, archived: 1, trash: 1 },
  entities: 4,
  assets: 3,
  backups: 2,
};

const usage: DataUsage = {
  totalBytes: 100,
  totalEntries: 5,
  partial: false,
  categories: {
    database: { bytes: 50, entries: 1, partial: false },
    assets: { bytes: 25, entries: 2, partial: false },
    backups: { bytes: 25, entries: 2, partial: false },
    logs: { bytes: 0, entries: 0, partial: false },
    temporary: { bytes: 0, entries: 0, partial: false },
  },
};

const orphanSummary: DataOrphanSummary = {
  purgeableFiles: 1,
  unreferencedFiles: 1,
  orphanThumbnails: 0,
  temporaryFiles: 0,
  missingFiles: 0,
  unexpectedEntries: 0,
  suspiciousLinks: 0,
  recoverableBytes: 12,
};

function createOptions(overrides: Record<string, unknown> = {}) {
  return {
    paths: resolveDataPaths(join(tmpdir(), 'world-craft-data-service')),
    sqlite: null as never,
    assets: { listAll: () => [] },
    openPath: async () => {},
    countReader: () => counts,
    usageReader: async () => usage,
    folderOpener: async () => ({ opened: true as const }),
    orphanPlanner: () => orphanSummary,
    orphanPurger: async () => ({
      purgedFiles: 1,
      purgedBytes: 12,
      backupCreated: true,
    }),
    ...overrides,
  };
}

describe('servicio de datos', () => {
  it('delega el resumen, el uso, las carpetas y los huérfanos', async () => {
    const folderOpener = vi.fn(async () => ({ opened: true as const }));
    const service = createDataService(createOptions({ folderOpener }));

    expect(service.summary()).toEqual(counts);
    await expect(service.usage()).resolves.toEqual(usage);
    await expect(service.openFolder('backups')).resolves.toEqual({
      opened: true,
    });
    expect(folderOpener).toHaveBeenCalledWith('backups');
    expect(service.planOrphans()).toEqual(orphanSummary);
  });

  it('serializa la purga y rechaza una segunda operación mutua', async () => {
    let release!: (value: {
      purgedFiles: number;
      purgedBytes: number;
      backupCreated: boolean;
    }) => void;
    const pending = new Promise<{
      purgedFiles: number;
      purgedBytes: number;
      backupCreated: boolean;
    }>((resolve) => {
      release = resolve;
    });
    const orphanPurger = vi.fn(() => pending);
    const service = createDataService(createOptions({ orphanPurger }));

    const first = service.purgeOrphans('purge-orphans');

    await expect(service.purgeOrphans('purge-orphans')).rejects.toMatchObject({
      code: 'DATA_BUSY',
    });

    // Las lecturas no esperan a la operación mutua.
    expect(service.summary()).toEqual(counts);
    expect(service.planOrphans()).toEqual(orphanSummary);

    release({ purgedFiles: 1, purgedBytes: 12, backupCreated: true });
    await expect(first).resolves.toEqual({
      purgedFiles: 1,
      purgedBytes: 12,
      backupCreated: true,
    });

    await expect(service.purgeOrphans('purge-orphans')).resolves.toEqual({
      purgedFiles: 1,
      purgedBytes: 12,
      backupCreated: true,
    });
    expect(orphanPurger).toHaveBeenCalledTimes(2);
  });

  it('serializa exportAll y deleteAll en el mismo mutex', async () => {
    let release!: (value: {
      status: 'completed';
      fileName: string;
      size: number;
      worlds: number;
      counts: {
        entities: number;
        entityTypes: number;
        relationTypes: number;
        tags: number;
        relations: number;
        versions: number;
        assets: number;
      };
      warnings: [];
    }) => void;
    const pending = new Promise<{
      status: 'completed';
      fileName: string;
      size: number;
      worlds: number;
      counts: {
        entities: number;
        entityTypes: number;
        relationTypes: number;
        tags: number;
        relations: number;
        versions: number;
        assets: number;
      };
      warnings: [];
    }>((resolve) => {
      release = resolve;
    });
    const libraryExporter = vi.fn(() => pending);
    const service = createDataService(createOptions({ libraryExporter }));

    const first = service.exportAll();

    await expect(service.purgeOrphans('purge-orphans')).rejects.toMatchObject({
      code: 'DATA_BUSY',
    });
    await expect(
      service.deleteAll({ keepBackups: false }),
    ).rejects.toMatchObject({ code: 'DATA_BUSY' });

    release({
      status: 'completed',
      fileName: 'biblioteca.zip',
      size: 10,
      worlds: 0,
      counts: {
        entities: 0,
        entityTypes: 0,
        relationTypes: 0,
        tags: 0,
        relations: 0,
        versions: 0,
        assets: 0,
      },
      warnings: [],
    });

    await expect(first).resolves.toMatchObject({
      status: 'completed',
      fileName: 'biblioteca.zip',
    });
    expect(libraryExporter).toHaveBeenCalledWith();
  });

  it('rechaza deleteAll si hay una transferencia y delega cuando no', async () => {
    const deleter = vi.fn(async () => ({
      status: 'deleted' as const,
      restartRequired: true as const,
      counts: {
        databaseFiles: 1,
        assetFiles: 1,
        logEntries: 1,
        temporaryEntries: 1,
        backupDirectories: 1,
      },
      remaining: [] as const,
    }));
    const busy = createDataService(
      createOptions({ deleter, isTransferBusy: () => true }),
    );

    await expect(busy.deleteAll({ keepBackups: false })).rejects.toMatchObject({
      code: 'DATA_BUSY',
    });
    expect(deleter).not.toHaveBeenCalled();

    const available = createDataService(
      createOptions({ deleter, isTransferBusy: () => false }),
    );

    await expect(
      available.deleteAll({ keepBackups: true }),
    ).resolves.toMatchObject({ status: 'deleted' });
    expect(deleter).toHaveBeenCalledWith({ keepBackups: true });
  });

  it('rechaza exportAll si hay una transferencia y no publica archivo', async () => {
    const libraryExporter = vi.fn(async () => ({
      status: 'cancelled' as const,
    }));
    const busy = createDataService(
      createOptions({ libraryExporter, isTransferBusy: () => true }),
    );

    await expect(busy.exportAll()).rejects.toMatchObject({ code: 'DATA_BUSY' });
    expect(libraryExporter).not.toHaveBeenCalled();

    const available = createDataService(
      createOptions({ libraryExporter, isTransferBusy: () => false }),
    );

    await expect(available.exportAll()).resolves.toEqual({
      status: 'cancelled',
    });
    expect(libraryExporter).toHaveBeenCalledTimes(1);
  });

  it('libera el turno aunque la purga falle', async () => {
    const orphanPurger = vi
      .fn()
      .mockRejectedValueOnce(new Error('fallo simulado'))
      .mockResolvedValueOnce({
        purgedFiles: 0,
        purgedBytes: 0,
        backupCreated: false,
      });
    const service = createDataService(createOptions({ orphanPurger }));

    await expect(service.purgeOrphans('purge-orphans')).rejects.toThrow(
      'fallo simulado',
    );
    await expect(service.purgeOrphans('purge-orphans')).resolves.toEqual({
      purgedFiles: 0,
      purgedBytes: 0,
      backupCreated: false,
    });
  });
});
