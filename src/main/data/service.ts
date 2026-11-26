/**
 * Servicio de datos de la aplicación (#79).
 *
 * Orquesta el resumen, la medición de uso, la apertura de carpetas, la gestión
 * de huérfanos, la exportación total y el borrado completo. Las lecturas no
 * bloquean; solo una operación mutua puede estar en curso y la segunda recibe
 * `DATA_BUSY`. La exportación y el borrado comprueban además que no haya una
 * transferencia activa.
 *
 * Este módulo no conoce Electron: `openPath` y todas las operaciones pesadas se
 * inyectan para probarlo con carpetas y bases temporales.
 */
import type { DataDeleteRequest } from '../../shared/contracts/data';
import type { AssetRepository } from '../assets/store';
import type { SqliteDatabase } from '../db/connection';
import type { DataPaths } from '../db/paths';
import { readDataCounts, type DataCounts } from './counts';
import { isDataFolder, type DataFolder } from './constants';
import { DataError } from './errors';
import { openDataFolder, type DataOpenFolderResult } from './folders';
import {
  planDataOrphans,
  purgeDataOrphans,
  type DataOrphanPurgeResult,
  type DataOrphanSummary,
} from './orphans';
import type { DataDeleteResult } from './delete-all';
import type { LibraryExportResult } from './library/service';
import { measureDataUsage, type DataUsage } from './usage';

/** Operaciones expuestas al proceso principal. */
export interface DataService {
  summary(): DataCounts;
  usage(): Promise<DataUsage>;
  openFolder(folder: DataFolder): Promise<DataOpenFolderResult>;
  planOrphans(): DataOrphanSummary;
  purgeOrphans(confirmation: string): Promise<DataOrphanPurgeResult>;
  exportAll(): Promise<LibraryExportResult>;
  deleteAll(input: DataDeleteRequest): Promise<DataDeleteResult>;
}

/** Dependencias del servicio; las operaciones se pueden sustituir en pruebas. */
export interface DataServiceOptions {
  readonly paths: DataPaths;
  readonly sqlite: SqliteDatabase;
  readonly assets: Pick<AssetRepository, 'listAll'>;
  readonly openPath: (path: string) => Promise<void | string>;
  readonly now?: () => number;
  readonly countReader?: () => DataCounts;
  readonly usageReader?: () => Promise<DataUsage>;
  readonly folderOpener?: (folder: DataFolder) => Promise<DataOpenFolderResult>;
  readonly orphanPlanner?: () => DataOrphanSummary;
  readonly orphanPurger?: (
    confirmation: string,
  ) => Promise<DataOrphanPurgeResult>;
  /** Exportación total ya compuesta con mundos, preferencias y destino. */
  readonly libraryExporter?: () => Promise<LibraryExportResult>;
  /** Borrado total ya compuesto con persistencia, copia y puerto de reinicio. */
  readonly deleter?: (input: DataDeleteRequest) => Promise<DataDeleteResult>;
  /** Consulta el coordinador de transferencias antes de cerrar la base. */
  readonly isTransferBusy?: () => boolean;
}

/** Crea el servicio sobre las rutas y la base compartidas. */
export function createDataService(options: DataServiceOptions): DataService {
  const { paths } = options;
  const countReader =
    options.countReader ??
    (() =>
      readDataCounts({
        sqlite: options.sqlite,
        backupDirectories: [
          paths.dailyBackupsDir,
          paths.weeklyBackupsDir,
          paths.monthlyBackupsDir,
          paths.preMigrationBackupsDir,
          paths.preRestoreBackupsDir,
          paths.prePurgeBackupsDir,
          paths.preDeleteBackupsDir,
          paths.orphanBackupsDir,
        ],
      }));
  const usageReader =
    options.usageReader ??
    (() =>
      measureDataUsage({
        paths,
        ...(options.now === undefined ? {} : { now: options.now }),
      }));
  const folderOpener =
    options.folderOpener ??
    ((folder: DataFolder) =>
      openDataFolder({
        paths,
        folder,
        openPath: options.openPath,
      }));
  const orphanPlanner =
    options.orphanPlanner ??
    (() =>
      planDataOrphans({
        assetsDir: paths.assetsDir,
        records: options.assets.listAll(),
      }));
  const orphanPurger =
    options.orphanPurger ??
    ((confirmation: string) =>
      purgeDataOrphans(
        {
          userDataDir: paths.userDataDir,
          assetsDir: paths.assetsDir,
          orphanBackupsDir: paths.orphanBackupsDir,
          records: options.assets.listAll(),
          ...(options.now === undefined ? {} : { now: options.now }),
        },
        { confirmation },
      ));

  let busy = false;

  const withMutation = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (busy) {
      throw new DataError('DATA_BUSY');
    }

    busy = true;

    try {
      return await operation();
    } finally {
      busy = false;
    }
  };

  return {
    summary() {
      return countReader();
    },

    usage() {
      return usageReader();
    },

    openFolder(folder) {
      if (!isDataFolder(folder)) {
        throw new DataError('DATA_FOLDER_INVALID');
      }

      return folderOpener(folder);
    },

    planOrphans() {
      return orphanPlanner();
    },

    purgeOrphans(confirmation) {
      return withMutation(() => orphanPurger(confirmation));
    },

    exportAll() {
      return withMutation(() => {
        if (options.isTransferBusy?.() === true) {
          throw new DataError('DATA_BUSY');
        }

        if (options.libraryExporter === undefined) {
          throw new DataError('DATA_UNAVAILABLE');
        }

        return options.libraryExporter();
      });
    },

    deleteAll(input) {
      return withMutation(() => {
        if (options.isTransferBusy?.() === true) {
          throw new DataError('DATA_BUSY');
        }

        if (options.deleter === undefined) {
          throw new DataError('DATA_UNAVAILABLE');
        }

        return options.deleter(input);
      });
    },
  };
}
