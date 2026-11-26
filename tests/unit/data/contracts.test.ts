import { describe, expect, it } from 'vitest';

import {
  isDataCounts,
  isDataDeleteResult,
  isDataLibraryResult,
  isDataOpenFolderResult,
  isDataOrphanPurgeResult,
  isDataOrphanSummary,
  isDataResult,
  isDataUsage,
  type DataCounts,
} from '@/shared/contracts/data';

const counts: DataCounts = {
  worlds: { active: 1, archived: 1, trash: 0 },
  entities: 2,
  assets: 3,
  backups: 4,
};

const usage = {
  totalBytes: 10,
  totalEntries: 2,
  partial: false,
  categories: {
    database: { bytes: 10, entries: 2, partial: false },
    assets: { bytes: 0, entries: 0, partial: false },
    backups: { bytes: 0, entries: 0, partial: false },
    logs: { bytes: 0, entries: 0, partial: false },
    temporary: { bytes: 0, entries: 0, partial: false },
  },
};

const orphan = {
  purgeableFiles: 1,
  unreferencedFiles: 1,
  orphanThumbnails: 0,
  temporaryFiles: 0,
  missingFiles: 0,
  unexpectedEntries: 0,
  suspiciousLinks: 0,
  recoverableBytes: 10,
};

const countsTransfer = {
  entities: 2,
  entityTypes: 1,
  relationTypes: 1,
  tags: 0,
  relations: 0,
  versions: 0,
  assets: 5,
};

describe('contratos compartidos de datos', () => {
  it('acepta las formas completas sin claves extra', () => {
    expect(isDataCounts(counts)).toBe(true);
    expect(isDataUsage(usage)).toBe(true);
    expect(isDataOrphanSummary(orphan)).toBe(true);
    expect(
      isDataOrphanPurgeResult({
        purgedFiles: 2,
        purgedBytes: 20,
        backupCreated: true,
      }),
    ).toBe(true);
    expect(isDataOpenFolderResult({ opened: true })).toBe(true);
    expect(
      isDataResult({ status: 'completed', data: counts }, isDataCounts),
    ).toBe(true);
    expect(isDataResult({ status: 'cancelled' }, isDataCounts)).toBe(true);
    expect(
      isDataResult(
        { status: 'failed', code: 'DATA_BUSY' },
        isDataCounts,
      ),
    ).toBe(true);
  });

  it('rechaza claves extra, negativos y estados incoherentes', () => {
    expect(isDataCounts({ ...counts, extra: true })).toBe(false);
    expect(
      isDataCounts({ ...counts, entities: -1 }),
    ).toBe(false);
    expect(isDataUsage({ ...usage, extra: true })).toBe(false);
    expect(
      isDataUsage({
        ...usage,
        categories: { ...usage.categories, assets: undefined },
      }),
    ).toBe(false);
    expect(isDataOrphanSummary({ ...orphan, recoverableBytes: -1 })).toBe(
      false,
    );
    expect(isDataOpenFolderResult({ opened: false })).toBe(false);
    expect(
      isDataResult({ status: 'failed', code: 'NOPE' }, isDataCounts),
    ).toBe(false);
    expect(
      isDataResult({ status: 'completed', data: { ...counts, extra: 1 } }, isDataCounts),
    ).toBe(false);
  });

  it('valida biblioteca y borrado', () => {
    expect(
      isDataLibraryResult({
        status: 'completed',
        fileName: 'biblioteca.zip',
        size: 10,
        worlds: 0,
        counts: countsTransfer,
        warnings: [],
      }),
    ).toBe(true);
    expect(isDataLibraryResult({ status: 'cancelled' })).toBe(true);
    expect(
      isDataLibraryResult({ status: 'failed', code: 'DATA_BUSY' }),
    ).toBe(true);
    expect(
      isDataLibraryResult({
        status: 'completed',
        fileName: 'biblioteca.zip',
        size: 10,
        worlds: 0,
        counts: countsTransfer,
        warnings: [],
        extra: true,
      }),
    ).toBe(false);
    expect(
      isDataLibraryResult({
        status: 'completed',
        fileName: 'C:\\datos\\biblioteca.zip',
        size: 10,
        worlds: 0,
        counts: countsTransfer,
        warnings: [],
      }),
    ).toBe(false);

    expect(
      isDataDeleteResult({
        status: 'deleted',
        restartRequired: true,
        counts: {
          databaseFiles: 1,
          assetFiles: 1,
          logEntries: 0,
          temporaryEntries: 0,
          backupDirectories: 1,
        },
        remaining: [],
      }),
    ).toBe(true);
    expect(
      isDataDeleteResult({
        status: 'partial',
        restartRequired: true,
        counts: {
          databaseFiles: 0,
          assetFiles: 0,
          logEntries: 0,
          temporaryEntries: 0,
          backupDirectories: 0,
        },
        remaining: ['logs'],
      }),
    ).toBe(true);
    expect(
      isDataDeleteResult({
        status: 'partial',
        restartRequired: true,
        counts: {
          databaseFiles: 0,
          assetFiles: 0,
          logEntries: 0,
          temporaryEntries: 0,
          backupDirectories: 0,
        },
        remaining: ['desconocida'],
      }),
    ).toBe(false);
    expect(
      isDataDeleteResult({
        status: 'failed',
        code: 'DATA_BUSY',
        restartRequired: false,
        counts: {
          databaseFiles: 0,
          assetFiles: 0,
          logEntries: 0,
          temporaryEntries: 0,
          backupDirectories: 0,
        },
        remaining: [],
      }),
    ).toBe(true);
  });
});
