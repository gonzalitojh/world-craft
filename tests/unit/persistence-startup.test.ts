import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseClient } from '@/main/db/client';
import { resolveDataPaths, type DataPaths } from '@/main/db/paths';
import type { DatabaseStartupResult } from '@/main/db/startup';

const mocks = vi.hoisted(() => ({
  getPath: vi.fn(),
  initializeDatabase: vi.fn(),
  showSafeModeDialog: vi.fn(),
  closeDatabase: vi.fn(),
  runScheduledBackups: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: mocks.getPath },
}));

vi.mock('@/main/db/startup', () => ({
  initializeDatabase: mocks.initializeDatabase,
}));

vi.mock('@/main/safe-mode-dialog', () => ({
  showSafeModeDialog: mocks.showSafeModeDialog,
}));

vi.mock('@/main/db/connection', () => ({
  closeDatabase: mocks.closeDatabase,
}));

vi.mock('@/main/backup/scheduler', () => ({
  runScheduledBackups: mocks.runScheduledBackups,
}));

vi.mock('@/main/db/migrations', () => ({
  readTargetSchemaVersion: () => 2,
}));

import { app } from 'electron';

import type { BackupResult } from '@/main/backup/create';
import { runScheduledBackups } from '@/main/backup/scheduler';
import { closeDatabase } from '@/main/db/connection';
import { initializeDatabase } from '@/main/db/startup';
import {
  closePersistence,
  getDatabase,
  initializePersistence,
} from '@/main/persistence';
import { showSafeModeDialog } from '@/main/safe-mode-dialog';

const userDataDir = join(tmpdir(), 'world-craft-persistence-user-data');
const migrationsDir = join(tmpdir(), 'world-craft-persistence-migrations');

function createClient(): DatabaseClient {
  return { sqlite: {}, orm: {} } as unknown as DatabaseClient;
}

function createReadyResult(client: DatabaseClient): DatabaseStartupResult {
  return {
    status: 'ready',
    client,
    paths: resolveDataPaths(join(tmpdir(), 'world-craft-persistence-paths')),
    schemaVersion: 1,
    appliedMigrations: 1,
    newDatabase: true,
    backup: null,
  };
}

function createSafeResult(
  paths: DataPaths | null = null,
): DatabaseStartupResult {
  return {
    status: 'safe-mode',
    code: 'DB_OPEN_FAILED',
    schemaVersion: null,
    backup: null,
    paths,
  };
}

function createPreMigrationBackupResult(): BackupResult {
  return {
    directory: 'C:/datos/backups/pre-migration/1',
    databaseFile: 'C:/datos/backups/pre-migration/1/world-craft.sqlite',
    manifestFile: 'C:/datos/backups/pre-migration/1/manifest.json',
    manifest: {
      formatVersion: 2,
      reason: 'pre-migration',
      createdAt: '2026-11-19T10:00:00.000Z',
      databaseFile: 'world-craft.sqlite',
      schemaVersion: 1,
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
      integrity: 'ok',
      assetsIncluded: false,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(app.getPath).mockReturnValue(userDataDir);
  vi.mocked(showSafeModeDialog).mockResolvedValue('continue');
  vi.mocked(runScheduledBackups).mockResolvedValue({
    created: [],
    failed: [],
    rotation: {
      removed: 0,
      kept: 0,
      corrupt: 0,
      skipped: 0,
      failed: 0,
    },
  });
});

afterEach(() => {
  closePersistence();
});

describe('composición del arranque de persistencia', () => {
  it('devuelve ready y conserva la conexión compartida', async () => {
    const client = createClient();
    vi.mocked(initializeDatabase).mockResolvedValue(createReadyResult(client));

    await expect(initializePersistence({ migrationsDir })).resolves.toEqual({
      status: 'ready',
    });

    expect(getDatabase()).toBe(client);
    expect(showSafeModeDialog).not.toHaveBeenCalled();
    expect(initializeDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ userDataDir, migrationsDir }),
    );
  });

  it('cachea el arranque y no abre dos conexiones', async () => {
    vi.mocked(initializeDatabase).mockResolvedValue(
      createReadyResult(createClient()),
    );

    const first = initializePersistence({ migrationsDir });
    const second = initializePersistence({ migrationsDir });

    expect(first).toBe(second);
    await first;
    expect(initializeDatabase).toHaveBeenCalledTimes(1);
  });

  it('programa las copias automáticas con las rutas resueltas antes de ready', async () => {
    const client = createClient();
    const paths = resolveDataPaths(
      join(tmpdir(), 'world-craft-persistence-scheduled'),
    );
    vi.mocked(initializeDatabase).mockResolvedValue({
      ...createReadyResult(client),
      paths,
    });

    await expect(initializePersistence({ migrationsDir })).resolves.toEqual({
      status: 'ready',
    });

    expect(runScheduledBackups).toHaveBeenCalledWith(
      expect.objectContaining({
        database: client.sqlite,
        directories: {
          daily: paths.dailyBackupsDir,
          weekly: paths.weeklyBackupsDir,
          monthly: paths.monthlyBackupsDir,
          preMigration: paths.preMigrationBackupsDir,
          prePurge: paths.prePurgeBackupsDir,
        },
        timestamp: expect.any(Number),
        targetSchemaVersion: expect.any(Number),
        forceRotation: false,
        logger: expect.objectContaining({ log: expect.any(Function) }),
      }),
    );
  });

  it('fuerza la rotación si el arranque creó una copia pre-migración', async () => {
    const client = createClient();
    vi.mocked(initializeDatabase).mockResolvedValue({
      ...createReadyResult(client),
      backup: createPreMigrationBackupResult(),
    });

    await expect(initializePersistence({ migrationsDir })).resolves.toEqual({
      status: 'ready',
    });

    expect(runScheduledBackups).toHaveBeenCalledWith(
      expect.objectContaining({ forceRotation: true }),
    );
  });

  it('un fallo del programador no impide el estado ready', async () => {
    const client = createClient();
    vi.mocked(initializeDatabase).mockResolvedValue(createReadyResult(client));
    vi.mocked(runScheduledBackups).mockRejectedValue(new Error('sin espacio'));

    await expect(initializePersistence({ migrationsDir })).resolves.toEqual({
      status: 'ready',
    });

    expect(getDatabase()).toBe(client);
  });

  it('no expone conexión en modo seguro y propaga continue', async () => {
    const safePaths = resolveDataPaths(
      join(tmpdir(), 'world-craft-persistence-safe'),
    );
    vi.mocked(initializeDatabase).mockResolvedValue(
      createSafeResult(safePaths),
    );
    vi.mocked(showSafeModeDialog).mockResolvedValue('continue');

    await expect(initializePersistence({ migrationsDir })).resolves.toEqual({
      status: 'safe-mode',
      code: 'DB_OPEN_FAILED',
      decision: 'continue',
    });

    expect(() => getDatabase()).toThrow(
      'La base de datos no está disponible en modo seguro.',
    );
    expect(showSafeModeDialog).toHaveBeenCalledWith('DB_OPEN_FAILED', {
      paths: safePaths,
      migrationsDir,
      userDataDirectory: userDataDir,
      now: expect.any(Function),
    });
    expect(closeDatabase).not.toHaveBeenCalled();
    expect(runScheduledBackups).not.toHaveBeenCalled();
  });

  it('propaga exit sin dejar una vía de escritura', async () => {
    vi.mocked(initializeDatabase).mockResolvedValue(createSafeResult());
    vi.mocked(showSafeModeDialog).mockResolvedValue('exit');

    await expect(initializePersistence({ migrationsDir })).resolves.toEqual({
      status: 'safe-mode',
      code: 'DB_OPEN_FAILED',
      decision: 'exit',
    });

    expect(showSafeModeDialog).toHaveBeenCalledWith('DB_OPEN_FAILED', {
      paths: null,
      migrationsDir,
      userDataDirectory: userDataDir,
      now: expect.any(Function),
    });
    expect(() => getDatabase()).toThrow();
    expect(closeDatabase).not.toHaveBeenCalled();
  });

  it('cierra de forma idempotente', async () => {
    const client = createClient();
    vi.mocked(initializeDatabase).mockResolvedValue(createReadyResult(client));

    await initializePersistence({ migrationsDir });

    closePersistence();
    closePersistence();

    expect(closeDatabase).toHaveBeenCalledTimes(1);
    expect(closeDatabase).toHaveBeenCalledWith(client.sqlite);
    expect(() => getDatabase()).toThrow();
  });
});
