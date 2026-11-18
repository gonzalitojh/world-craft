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

import { app } from 'electron';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(app.getPath).mockReturnValue(userDataDir);
  vi.mocked(showSafeModeDialog).mockResolvedValue('continue');
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
      backupsDirectory: safePaths.preMigrationBackupsDir,
      userDataDirectory: safePaths.userDataDir,
    });
    expect(closeDatabase).not.toHaveBeenCalled();
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
      backupsDirectory: null,
      userDataDirectory: userDataDir,
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
