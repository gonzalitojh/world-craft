/**
 * Entrada del utility process de transferencia.
 *
 * Electron la carga con `utilityProcess.fork('out/main/transfer-worker.cjs')`.
 * No importa Electron: usa `process.parentPort`, que Electron inyecta en el
 * utility process. Aquí viven el ZIP, la validación del JSON y el procesado de
 * imágenes; la transacción SQLite de importación la ejecuta el proceso
 * principal.
 *
 * Los módulos nativos (better-sqlite3 y sharp) se cargan desde `node_modules`
 * externalizado. La operación `probe` permite comprobar en el build que ambos
 * cargan dentro del utility process.
 */
import Database from 'better-sqlite3';
import sharp from 'sharp';

import type { TransferEvent } from '../../shared/contracts/transfer';
import { createDatabaseClient } from '../db/client';
import { openDatabase } from '../db/connection';
import { TRANSFER_PROTOCOL_VERSION } from './constants';
import { exportWorld } from './export/service';
import { toTransferErrorCode } from './errors';
import { prepareImport } from './import/prepare';
import {
  parseWorkerRequest,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol';

/** Puerto que Electron inyecta en un utility process. */
interface UtilityMessagePort {
  on(event: 'message', listener: (message: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
  start?(): void;
}

interface ActiveOperation {
  readonly operationId: string;
  readonly controller: AbortController;
}

const parentPort = (
  process as NodeJS.Process & { parentPort?: UtilityMessagePort }
).parentPort;

let active: ActiveOperation | null = null;

if (parentPort !== undefined) {
  parentPort.on('message', (message) => {
    void handleMessage(message.data);
  });
  parentPort.start?.();
}

async function handleMessage(value: unknown): Promise<void> {
  let request: WorkerRequest;

  try {
    request = parseWorkerRequest(value);
  } catch {
    const operationId = readOperationId(value);

    if (operationId !== null) {
      send({
        type: 'error',
        protocolVersion: TRANSFER_PROTOCOL_VERSION,
        operationId,
        code: 'TRANSFER_INTERNAL',
      });
    }

    return;
  }

  if (request.type === 'cancel') {
    if (active?.operationId === request.operationId) {
      active.controller.abort();
    }

    return;
  }

  if (request.type === 'probe') {
    probe(request.operationId);
    return;
  }

  if (active !== null) {
    send({
      type: 'error',
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      operationId: request.operationId,
      code: 'TRANSFER_BUSY',
    });
    return;
  }

  const operation: ActiveOperation = {
    operationId: request.operationId,
    controller: new AbortController(),
  };
  active = operation;

  try {
    if (request.type === 'export') {
      await runExport(request, operation);
    } else {
      await runImport(request, operation);
    }
  } finally {
    if (active === operation) {
      active = null;
    }
  }
}

function probe(operationId: string): void {
  try {
    const database = new Database(':memory:');
    const row = database
      .prepare('SELECT sqlite_version() AS version')
      .get() as { readonly version: string };
    database.close();

    send({
      type: 'probe-result',
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      operationId,
      sqliteVersion: row.version,
      vipsVersion: sharp.versions.vips,
    });
  } catch {
    send({
      type: 'error',
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      operationId,
      code: 'TRANSFER_INTERNAL',
    });
  }
}

async function runExport(
  request: Extract<WorkerRequest, { type: 'export' }>,
  operation: ActiveOperation,
): Promise<void> {
  let sqlite: ReturnType<typeof openDatabase> | null = null;

  try {
    sqlite = openDatabase({
      file: request.databaseFile,
      readonly: true,
    });
    const database = createDatabaseClient(sqlite);
    const result = await exportWorld({
      database: database.orm,
      sqlite: database.sqlite,
      assetsDir: request.assetsDir,
      worldId: request.worldId,
      destinationFile: request.destinationFile,
      appVersion: request.appVersion,
      schemaVersion: request.schemaVersion,
      now: () => request.now,
      signal: operation.controller.signal,
      onEvent: (event) => emit(operation.operationId, event),
    });

    send({
      type: 'result',
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      operationId: operation.operationId,
      operation: 'export',
      result: { ...result, warnings: [...result.warnings] },
    });
  } catch (error) {
    sendError(operation.operationId, error, 'TRANSFER_SAVE_FAILED');
  } finally {
    sqlite?.close();
  }
}

async function runImport(
  request: Extract<WorkerRequest, { type: 'import' }>,
  operation: ActiveOperation,
): Promise<void> {
  try {
    const result = await prepareImport({
      operationId: operation.operationId,
      archiveFile: request.archiveFile,
      importsDir: request.importsDir,
      assetsTempDir: request.assetsTempDir,
      schemaVersion: request.schemaVersion,
      existingSlugs: request.existingSlugs,
      now: () => request.now,
      signal: operation.controller.signal,
      onEvent: (event) => emit(operation.operationId, event),
    });

    send({
      type: 'result',
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      operationId: operation.operationId,
      operation: 'import',
      result: { ...result, warnings: [...result.warnings] },
    });
  } catch (error) {
    sendError(operation.operationId, error, 'TRANSFER_SOURCE_UNREADABLE');
  }
}

function emit(operationId: string, event: TransferEvent): void {
  send({
    type: 'event',
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    operationId,
    event,
  });
}

function sendError(
  operationId: string,
  error: unknown,
  fallback: 'TRANSFER_SAVE_FAILED' | 'TRANSFER_SOURCE_UNREADABLE',
): void {
  send({
    type: 'error',
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    operationId,
    code: toTransferErrorCode(error, fallback),
  });
}

function send(response: WorkerResponse): void {
  try {
    parentPort?.postMessage(response);
  } catch {
    // El proceso principal pudo cancelar y cerrar el puerto. No hay nada más
    // que hacer: el worker termina sin filtrar detalles.
  }
}

function readOperationId(value: unknown): string | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('operationId' in value) ||
    typeof value.operationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value.operationId,
    )
  ) {
    return null;
  }

  return value.operationId;
}
