/**
 * Composición Electron de la recuperación desde copia.
 *
 * Conecta el diálogo nativo, la verificación pura y la restauración con las
 * rutas ya resueltas. La lógica de decisión vive en `safe-mode-prompt.ts`; aquí
 * solo se seleccionan carpetas, se valida su contención en `backups/` y se
 * reinicia la aplicación tras una restauración correcta.
 */
import { app, dialog } from 'electron';

import {
  findLatestRestorableBackup,
  inspectRestorableBackup,
  resolveRestoreDirectory,
  restoreBackup,
  type RestorableBackup,
  type RestoreResult,
} from './backup/restore';
import { createStartupLogger } from './db/logger';
import { readTargetSchemaVersion } from './db/migrations';
import type { DataPaths } from './db/paths';
import { messages } from './messages/es';
import type { SafeModeRecoveryPorts } from './safe-mode-prompt';

export interface SafeModeRecoveryOptions {
  readonly paths: DataPaths;
  readonly migrationsDir: string;
  readonly now?: () => number;
}

/** Construye los puertos de recuperación con las rutas ya validadas. */
export function createSafeModeRecovery(
  options: SafeModeRecoveryOptions,
): SafeModeRecoveryPorts {
  const now = options.now ?? Date.now;
  const directories = [
    options.paths.dailyBackupsDir,
    options.paths.weeklyBackupsDir,
    options.paths.monthlyBackupsDir,
    options.paths.preMigrationBackupsDir,
  ];

  return {
    findLatestBackup: () =>
      findLatestRestorableBackup({
        directories,
        targetSchemaVersion: readTargetSchemaVersion(options.migrationsDir),
      }),

    chooseBackupDirectory: async () => {
      const result = await dialog.showOpenDialog({
        title: messages.safeMode.restore.chooseTitle,
        defaultPath: options.paths.backupsDir,
        properties: ['openDirectory'],
      });

      const candidate = result.filePaths[0];

      if (result.canceled || candidate === undefined) {
        return null;
      }

      // `resolveRestoreDirectory` aplica `realpath` + `relative` y lanza
      // `DB_RESTORE_INVALID` si la carpeta se sale de `backups/`.
      return resolveRestoreDirectory({
        backupsDir: options.paths.backupsDir,
        candidate,
      });
    },

    inspectBackup: async (directory): Promise<RestorableBackup | null> => {
      const selection = await inspectRestorableBackup({
        directory,
        targetSchemaVersion: readTargetSchemaVersion(options.migrationsDir),
      });

      return selection.ok ? selection.backup : null;
    },

    restoreBackup: async (directory): Promise<RestoreResult> => {
      const logger = createStartupLogger(options.paths.startupLogFile, now);
      const result = await restoreBackup({
        backupDirectory: directory,
        dataDir: options.paths.dataDir,
        databaseFile: options.paths.databaseFile,
        preRestoreDir: options.paths.preRestoreBackupsDir,
        targetSchemaVersion: readTargetSchemaVersion(options.migrationsDir),
        timestamp: now(),
      });

      if (result.ok) {
        logger.log({
          event: 'backup.restore',
          outcome: 'restored',
          schemaVersion: result.manifest.schemaVersion,
        });
      } else {
        logger.log({
          event: 'backup.restore',
          outcome: 'failed',
          code: result.code,
          reason: result.reason,
        });
      }

      return result;
    },

    relaunch: () => {
      app.relaunch();
      app.exit(0);
    },
  };
}
