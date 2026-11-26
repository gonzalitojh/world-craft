/**
 * Composición Electron del servicio de datos.
 *
 * Es la única pieza de datos que conoce el diálogo nativo, el reinicio y el
 * ciclo de vida de Electron. El dominio (`delete-all`, `library`, etc.) sigue
 * siendo puro. La ruta elegida por el usuario se queda aquí; el renderer solo
 * recibe el resultado.
 */
import { app } from 'electron';

import type { AssetRepository } from '../assets/store';
import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import type { DataPaths } from '../db/paths';
import type { PreferencesService } from '../preferences/service';
import type { TransferCoordinator } from '../transfer/coordinator';
import type { UpdatesComposition } from '../updates/composition';
import type { WorldsService } from '../worlds/service';
import {
  DATA_DELETE_ALL_CONFIRMATION,
  type DataDeleteRequest,
  type DataErrorCode,
} from '../../shared/contracts/data';
import { deleteAll } from './delete-all';
import { showLibraryExportDialog } from './dialogs';
import { exportAll as exportLibrary } from './library/service';
import { createDataService, type DataService } from './service';

/** Margen para que la respuesta IPC llegue antes del reinicio. */
export const DATA_RESTART_DELAY_MS = 750;

/** Logger mínimo de datos; nunca recibe rutas, hashes ni nombres. */
export interface DataCompositionLogger {
  log(entry: {
    readonly event: 'data.operation';
    readonly operation: 'export' | 'delete';
    readonly outcome: 'completed' | 'cancelled' | 'failed' | 'partial';
    readonly code?: DataErrorCode;
  }): void;
}

export interface DataCompositionOptions {
  readonly database: WorldCraftDatabase;
  readonly sqlite: SqliteDatabase;
  readonly paths: DataPaths;
  readonly assets: Pick<AssetRepository, 'listAll'>;
  readonly preferences: Pick<PreferencesService, 'get'>;
  readonly worlds: Pick<WorldsService, 'list'>;
  readonly transfer: Pick<TransferCoordinator, 'isBusy' | 'dispose'>;
  readonly updates: Pick<UpdatesComposition, 'dispose'> | null;
  readonly closePersistence: () => void;
  readonly openPath: (path: string) => Promise<void | string>;
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly showExportDialog?: () => Promise<string | null>;
  readonly now?: () => number;
  readonly logger?: DataCompositionLogger;
}

/** Crea el servicio normal con diálogo y reinicio programado. */
export function createDataComposition(
  options: DataCompositionOptions,
): DataService {
  const now = options.now ?? Date.now;
  const showExportDialog =
    options.showExportDialog ?? (() => showLibraryExportDialog({ now }));
  let restartScheduled = false;

  const log = (entry: Parameters<DataCompositionLogger['log']>[0]): void => {
    try {
      options.logger?.log(entry);
    } catch {
      // Un logger no debe romper una operación de datos.
    }
  };

  const requestRestart = (): void => {
    if (restartScheduled) {
      return;
    }

    restartScheduled = true;

    const timer = setTimeout(() => {
      try {
        options.transfer.dispose();
      } catch {
        // La transferencia ya pudo terminar o no existir.
      }

      try {
        options.updates?.dispose();
      } catch {
        // El actualizador no debe impedir el reinicio.
      }

      options.closePersistence();
      app.relaunch();
      app.exit(0);
    }, DATA_RESTART_DELAY_MS);

    // En el proceso principal no debe mantener vivo el event loop si algo más
    // falla antes de los 750 ms.
    timer.unref?.();
  };

  return createDataService({
    paths: options.paths,
    sqlite: options.sqlite,
    assets: options.assets,
    openPath: options.openPath,
    now,
    isTransferBusy: () => options.transfer.isBusy(),
    libraryExporter: async () => {
      const destinationFile = await showExportDialog();

      if (destinationFile === null) {
        log({
          event: 'data.operation',
          operation: 'export',
          outcome: 'cancelled',
        });
        return { status: 'cancelled' };
      }

      // La transferencia pudo empezar mientras el diálogo estaba abierto.
      if (options.transfer.isBusy()) {
        log({
          event: 'data.operation',
          operation: 'export',
          outcome: 'failed',
          code: 'DATA_BUSY',
        });
        return { status: 'failed', code: 'DATA_BUSY' };
      }

      const result = await exportLibrary({
        database: options.database,
        sqlite: options.sqlite,
        exportsTempDir: options.paths.exportsTempDir,
        assetsDir: options.paths.assetsDir,
        destinationFile,
        appVersion: options.appVersion,
        schemaVersion: options.schemaVersion,
        worlds: options.worlds,
        preferences: options.preferences,
        now,
      });

      log({
        event: 'data.operation',
        operation: 'export',
        outcome: result.status === 'completed' ? 'completed' : 'failed',
        ...(result.status === 'failed' ? { code: result.code } : {}),
      });

      return result;
    },
    deleter: async (input: DataDeleteRequest) => {
      const result = await deleteAll({
        paths: options.paths,
        database: options.sqlite,
        schemaVersion: options.schemaVersion,
        confirmation: DATA_DELETE_ALL_CONFIRMATION,
        keepBackups: input.keepBackups,
        isTransferBusy: () => options.transfer.isBusy(),
        closePersistence: options.closePersistence,
        now,
      });

      log({
        event: 'data.operation',
        operation: 'delete',
        outcome:
          result.status === 'deleted'
            ? 'completed'
            : result.status === 'partial'
              ? 'partial'
              : 'failed',
        ...(result.status === 'failed' ? { code: result.code } : {}),
      });

      if (result.status !== 'failed' && result.restartRequired) {
        requestRestart();
      }

      return result;
    },
  });
}
