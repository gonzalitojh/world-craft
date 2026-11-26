/**
 * Servicio de datos de sustitución para el modo seguro.
 *
 * Ninguna lectura o mutación toca la base. `openFolder` sigue disponible si las
 * rutas de `userData` se pudieron resolver y el sistema puede abrir la carpeta:
 * es una acción de consulta que no escribe datos.
 */
import type {
  DataDeleteCounts,
  DataDeleteResult,
  DataFolder,
  DataLibraryResult,
  DataOpenFolderResult,
  DataOrphanPurgeResult,
  DataOrphanSummary,
  DataUsage,
} from '../../shared/contracts/data';
import type { DataPaths } from '../db/paths';
import type { DataCounts } from '../../shared/contracts/data';
import { DataError } from './errors';
import { openDataFolder } from './folders';
import type { DataService } from './service';

export interface UnavailableDataOptions {
  readonly paths?: DataPaths | null;
  readonly openPath?: (path: string) => Promise<void | string>;
}

const EMPTY_DELETE_COUNTS: DataDeleteCounts = {
  databaseFiles: 0,
  assetFiles: 0,
  logEntries: 0,
  temporaryEntries: 0,
  backupDirectories: 0,
};

/** Crea el servicio inerte para modo seguro. */
export function createUnavailableDataService(
  options: UnavailableDataOptions = {},
): DataService {
  const unavailable = (): never => {
    throw new DataError('DATA_UNAVAILABLE');
  };

  return {
    summary(): DataCounts {
      return unavailable();
    },

    async usage(): Promise<DataUsage> {
      return unavailable();
    },

    async openFolder(folder: DataFolder): Promise<DataOpenFolderResult> {
      if (
        options.paths === undefined ||
        options.paths === null ||
        options.openPath === undefined
      ) {
        return unavailable();
      }

      return openDataFolder({
        paths: options.paths,
        folder,
        openPath: options.openPath,
      });
    },

    planOrphans(): DataOrphanSummary {
      return unavailable();
    },

    async purgeOrphans(): Promise<DataOrphanPurgeResult> {
      return unavailable();
    },

    exportAll(): Promise<DataLibraryResult> {
      return Promise.resolve({ status: 'failed', code: 'DATA_UNAVAILABLE' });
    },

    deleteAll(): Promise<DataDeleteResult> {
      return Promise.resolve({
        status: 'failed',
        code: 'DATA_UNAVAILABLE',
        restartRequired: false,
        counts: EMPTY_DELETE_COUNTS,
        remaining: [],
      });
    },
  };
}
