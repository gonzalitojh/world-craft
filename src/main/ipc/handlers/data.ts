/**
 * Handlers IPC de datos y mantenimiento.
 *
 * Los códigos `DATA_*` son fallos de dominio: viajan como `ok: true` con
 * `{status: 'failed', code}` para que el renderer pueda traducirlos. Solo una
 * entrada inválida (Zod) o un error desconocido se convierte en un `IpcResult`
 * negativo. Nunca se devuelven mensajes, causas, rutas, hashes ni nombres.
 */
import { IPC_CHANNELS } from '../../../shared/contracts/channels';
import type {
  DataCounts,
  DataDeleteCounts,
  DataDeleteRequest,
  DataDeleteResult,
  DataLibraryResult,
  DataOpenFolderResult,
  DataOrphanPurgeResult,
  DataOrphanSummary,
  DataResult,
  DataUsage,
} from '../../../shared/contracts/data';
import type { DataService } from '../../data/service';
import { DataError } from '../../data/errors';
import type { IpcHandlers } from '../registry';
import { defineIpcHandler } from '../registry';
import {
  dataDeleteAllPayloadSchema,
  dataEmptyPayloadSchema,
  dataOpenFolderPayloadSchema,
  dataPurgeOrphansPayloadSchema,
  type DataDeleteAllPayload,
  type DataEmptyPayload,
  type DataOpenFolderPayload,
  type DataPurgeOrphansPayload,
} from '../schemas/data';

/** Canales que atiende este módulo. */
export type DataIpcHandlers = Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.dataGetSummary
  | typeof IPC_CHANNELS.dataGetUsage
  | typeof IPC_CHANNELS.dataOpenFolder
  | typeof IPC_CHANNELS.dataExportAll
  | typeof IPC_CHANNELS.dataDeleteAll
  | typeof IPC_CHANNELS.dataPlanOrphans
  | typeof IPC_CHANNELS.dataPurgeOrphans
>;

const EMPTY_DELETE_COUNTS: DataDeleteCounts = {
  databaseFiles: 0,
  assetFiles: 0,
  logEntries: 0,
  temporaryEntries: 0,
  backupDirectories: 0,
};

/** Construye los handlers a partir del servicio de datos. */
export function createDataIpcHandlers(service: DataService): DataIpcHandlers {
  return {
    [IPC_CHANNELS.dataGetSummary]: defineIpcHandler<DataEmptyPayload>({
      schema: dataEmptyPayloadSchema,
      handle: () => runDataResult<DataCounts>(() => service.summary()),
    }),

    [IPC_CHANNELS.dataGetUsage]: defineIpcHandler<DataEmptyPayload>({
      schema: dataEmptyPayloadSchema,
      handle: () => runDataResult<DataUsage>(() => service.usage()),
    }),

    [IPC_CHANNELS.dataOpenFolder]: defineIpcHandler<DataOpenFolderPayload>({
      schema: dataOpenFolderPayloadSchema,
      handle: (payload) =>
        runDataResult<DataOpenFolderResult>(() =>
          service.openFolder(payload.folder),
        ),
    }),

    [IPC_CHANNELS.dataExportAll]: defineIpcHandler<DataEmptyPayload>({
      schema: dataEmptyPayloadSchema,
      handle: () => runLibraryResult(() => service.exportAll()),
    }),

    [IPC_CHANNELS.dataDeleteAll]: defineIpcHandler<DataDeleteAllPayload>({
      schema: dataDeleteAllPayloadSchema,
      handle: (payload) =>
        runDeleteResult(() => service.deleteAll(toDeleteRequest(payload))),
    }),

    [IPC_CHANNELS.dataPlanOrphans]: defineIpcHandler<DataEmptyPayload>({
      schema: dataEmptyPayloadSchema,
      handle: () =>
        runDataResult<DataOrphanSummary>(() => service.planOrphans()),
    }),

    [IPC_CHANNELS.dataPurgeOrphans]: defineIpcHandler<DataPurgeOrphansPayload>({
      schema: dataPurgeOrphansPayloadSchema,
      handle: (payload) =>
        runDataResult<DataOrphanPurgeResult>(() =>
          service.purgeOrphans(payload.confirmation),
        ),
    }),
  };
}

function toDeleteRequest(payload: DataDeleteAllPayload): DataDeleteRequest {
  return { keepBackups: payload.keepBackups };
}

async function runDataResult<T>(
  operation: () => T | Promise<T>,
): Promise<DataResult<T>> {
  try {
    return { status: 'completed', data: await operation() };
  } catch (error) {
    if (error instanceof DataError) {
      return { status: 'failed', code: error.code };
    }

    throw error;
  }
}

async function runLibraryResult(
  operation: () => Promise<DataLibraryResult>,
): Promise<DataLibraryResult> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DataError) {
      return { status: 'failed', code: error.code };
    }

    throw error;
  }
}

async function runDeleteResult(
  operation: () => Promise<DataDeleteResult>,
): Promise<DataDeleteResult> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DataError) {
      return {
        status: 'failed',
        code: error.code,
        restartRequired: false,
        counts: EMPTY_DELETE_COUNTS,
        remaining: [],
      };
    }

    throw error;
  }
}
