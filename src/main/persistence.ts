/**
 * Composición Electron de la persistencia local.
 *
 * `src/main/db` y `src/main/backup` no conocen Electron: aquí se resuelve
 * `userData`, se arranca la base, se programan las copias automáticas antes de
 * crear la ventana y se cierra la conexión de forma idempotente en
 * `before-quit`. En modo seguro no se conserva ninguna conexión de escritura y
 * la decisión del usuario se devuelve a `index.ts`.
 */
import { app } from 'electron';
import { join } from 'node:path';

import { runScheduledBackups } from './backup/scheduler';
import type { DatabaseClient } from './db/client';
import { closeDatabase } from './db/connection';
import type { DatabaseErrorCode } from './db/errors';
import { createStartupLogger } from './db/logger';
import { readTargetSchemaVersion } from './db/migrations';
import { initializeDatabase } from './db/startup';
import { showSafeModeDialog } from './safe-mode-dialog';
import type { SafeModeDecision } from './safe-mode-prompt';

/** Resultado de composición que consume el punto de entrada. */
export type PersistenceStartupOutcome =
  | { readonly status: 'ready' }
  | {
      readonly status: 'safe-mode';
      readonly code: DatabaseErrorCode;
      readonly decision: SafeModeDecision;
    };

let client: DatabaseClient | null = null;
let initialization: Promise<PersistenceStartupOutcome> | null = null;

/** Opciones de composición; las pruebas inyectan la carpeta de migraciones. */
export interface PersistenceOptions {
  readonly migrationsDir?: string;
  readonly now?: () => number;
}

/**
 * Arranca la base una sola vez. Un fallo se traduce en modo seguro y en un
 * diálogo nativo; nunca se propaga al renderer.
 */
export function initializePersistence(
  options?: PersistenceOptions,
): Promise<PersistenceStartupOutcome> {
  initialization ??= startPersistence(
    options?.migrationsDir ?? join(__dirname, 'drizzle'),
    options?.now ?? Date.now,
  );

  return initialization;
}

async function startPersistence(
  migrationsDir: string,
  now: () => number,
): Promise<PersistenceStartupOutcome> {
  const userDataDir = app.getPath('userData');
  const result = await initializeDatabase({
    userDataDir,
    migrationsDir,
    now,
  });

  if (result.status === 'ready') {
    client = result.client;

    // Una copia automática fallida o lenta nunca bloquea el arranque ni la
    // creación de la ventana; el propio programador registra el resultado.
    try {
      await runScheduledBackups({
        database: result.client.sqlite,
        directories: {
          daily: result.paths.dailyBackupsDir,
          weekly: result.paths.weeklyBackupsDir,
          monthly: result.paths.monthlyBackupsDir,
          preMigration: result.paths.preMigrationBackupsDir,
        },
        timestamp: now(),
        targetSchemaVersion: readTargetSchemaVersion(migrationsDir),
        forceRotation: result.backup !== null,
        logger: createStartupLogger(result.paths.startupLogFile, now),
      });
    } catch {
      console.error('No se pudieron programar las copias automáticas.');
    }

    return { status: 'ready' };
  }

  const decision = await showSafeModeDialog(result.code, {
    paths: result.paths,
    migrationsDir,
    userDataDirectory: userDataDir,
    now,
  });

  return { status: 'safe-mode', code: result.code, decision };
}

/** Devuelve la conexión compartida o falla si se arrancó en modo seguro. */
export function getDatabase(): DatabaseClient {
  if (client === null) {
    throw new Error('La base de datos no está disponible en modo seguro.');
  }

  return client;
}

/** Cierra la conexión de escritura. Se puede llamar más de una vez. */
export function closePersistence(): void {
  if (client !== null) {
    closeDatabase(client.sqlite);
    client = null;
  }

  initialization = null;
}
