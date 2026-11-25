/**
 * Protocolo entre el proceso principal y el utility process de transferencia.
 *
 * Todos los mensajes se validan con Zod estricto. Los mensajes del proceso
 * principal al worker pueden contener rutas absolutas y el ID de operación;
 * los eventos y resultados que se reenvían al renderer no. El resultado de una
 * importación es un archivo de plan dentro de la carpeta temporal, no un
 * payload gigante por IPC.
 *
 * El worker no importa Electron: usa `process.parentPort`, que Electron
 * inyecta en el utility process.
 */
import { isAbsolute } from 'node:path';

import { z } from 'zod';

import {
  TRANSFER_PHASES,
  TRANSFER_WARNING_CODES,
  TRANSFER_OPERATIONS,
  TRANSFER_ERROR_CODES,
  isTransferFileName,
} from '../../shared/contracts/transfer';
import { UUID_V7_PATTERN } from '../db/ids';
import { TRANSFER_PROTOCOL_VERSION } from './constants';
import { TransferError } from './errors';

const absolutePathSchema = z
  .string()
  .min(1)
  .max(32_767)
  .refine((value) => !value.includes('\0') && isAbsolute(value), {
    message: 'La ruta debe ser absoluta.',
  });

const operationIdSchema = z.string().regex(UUID_V7_PATTERN);

const worldIdSchema = z.string().regex(UUID_V7_PATTERN);

const slugSchema = z.string().min(1).max(80);

/** Recuentos de contenido transferido. */
export const transferCountsSchema = z
  .strictObject({
    entities: z.number().int().min(0),
    entityTypes: z.number().int().min(0),
    relationTypes: z.number().int().min(0),
    tags: z.number().int().min(0),
    relations: z.number().int().min(0),
    versions: z.number().int().min(0),
    assets: z.number().int().min(0),
  })
  .strict();

/** Aviso agregado por contenido saneado. */
export const transferWarningSchema = z
  .strictObject({
    code: z.enum(TRANSFER_WARNING_CODES),
    count: z.number().int().min(0),
  })
  .strict();

/** Evento de progreso reenviable al renderer. */
export const transferEventSchema = z
  .strictObject({
    operation: z.enum(TRANSFER_OPERATIONS),
    phase: z.enum(TRANSFER_PHASES),
    completed: z.number().int().min(0),
    total: z.number().int().min(0).nullable(),
    warnings: z.number().int().min(0),
  })
  .strict();

/** Resultado de exportación reenviable al renderer. */
export const transferExportResultSchema = z
  .strictObject({
    worldId: worldIdSchema,
    worldName: z.string().min(1).max(120),
    fileName: z
      .string()
      .min(1)
      .max(255)
      .refine(isTransferFileName, 'El nombre de archivo no es válido.'),
    size: z.number().int().min(0),
    counts: transferCountsSchema,
    warnings: z.array(transferWarningSchema).max(TRANSFER_WARNING_CODES.length),
  })
  .strict();

/** Resultado de importación reenviable al renderer. */
export const transferImportResultSchema = z
  .strictObject({
    worldId: worldIdSchema,
    worldName: z.string().min(1).max(120),
    slug: slugSchema,
    slugAdjusted: z.boolean(),
    counts: transferCountsSchema,
    warnings: z.array(transferWarningSchema).max(TRANSFER_WARNING_CODES.length),
  })
  .strict();

/** Solicitud de exportación al worker. */
export const exportWorkerRequestSchema = z
  .strictObject({
    type: z.literal('export'),
    protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
    operationId: operationIdSchema,
    worldId: worldIdSchema,
    databaseFile: absolutePathSchema,
    destinationFile: absolutePathSchema,
    assetsDir: absolutePathSchema,
    appVersion: z.string().min(1).max(40),
    schemaVersion: z.number().int().min(1),
    now: z.number().int().min(0),
  })
  .strict();

/** Solicitud de importación al worker. */
export const importWorkerRequestSchema = z
  .strictObject({
    type: z.literal('import'),
    protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
    operationId: operationIdSchema,
    archiveFile: absolutePathSchema,
    importsDir: absolutePathSchema,
    assetsDir: absolutePathSchema,
    assetsTempDir: absolutePathSchema,
    schemaVersion: z.number().int().min(1),
    existingSlugs: z.array(slugSchema).max(100_000),
    now: z.number().int().min(0),
  })
  .strict();

/** Cancelación de la operación en curso. */
export const cancelWorkerRequestSchema = z
  .strictObject({
    type: z.literal('cancel'),
    protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
    operationId: operationIdSchema,
  })
  .strict();

/** Sonda de arranque del worker: comprueba los módulos nativos. */
export const probeWorkerRequestSchema = z
  .strictObject({
    type: z.literal('probe'),
    protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
    operationId: operationIdSchema,
  })
  .strict();

/** Unión de solicitudes aceptadas por el worker. */
export const workerRequestSchema = z.discriminatedUnion('type', [
  exportWorkerRequestSchema,
  importWorkerRequestSchema,
  cancelWorkerRequestSchema,
  probeWorkerRequestSchema,
]);

/** Resultado interno de una importación preparada por el worker. */
export const preparedImportResultSchema = z
  .strictObject({
    planFile: absolutePathSchema,
    stagingDir: absolutePathSchema,
    assetTempDir: absolutePathSchema,
    worldId: worldIdSchema,
    worldName: z.string().min(1).max(120),
    slug: slugSchema,
    slugAdjusted: z.boolean(),
    counts: transferCountsSchema,
    warnings: z.array(transferWarningSchema).max(TRANSFER_WARNING_CODES.length),
    totalAssetBytes: z.number().int().min(0),
  })
  .strict();

/**
 * Mensaje del worker al proceso principal.
 *
 * Hay dos variantes con `type: 'result'` (exportación e importación), así que
 * se usa una unión normal en lugar de un discriminador por `type`.
 */
export const workerResponseSchema = z.union([
  z
    .strictObject({
      type: z.literal('event'),
      protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
      operationId: operationIdSchema,
      event: transferEventSchema,
    })
    .strict(),
  z
    .strictObject({
      type: z.literal('result'),
      protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
      operationId: operationIdSchema,
      operation: z.literal('export'),
      result: transferExportResultSchema,
    })
    .strict(),
  z
    .strictObject({
      type: z.literal('result'),
      protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
      operationId: operationIdSchema,
      operation: z.literal('import'),
      result: preparedImportResultSchema,
    })
    .strict(),
  z
    .strictObject({
      type: z.literal('error'),
      protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
      operationId: operationIdSchema,
      code: z.enum(TRANSFER_ERROR_CODES),
    })
    .strict(),
  z
    .strictObject({
      type: z.literal('probe-result'),
      protocolVersion: z.literal(TRANSFER_PROTOCOL_VERSION),
      operationId: operationIdSchema,
      sqliteVersion: z.string().min(1).max(40),
      vipsVersion: z.string().min(1).max(40),
    })
    .strict(),
]);

export type ExportWorkerRequest = z.infer<typeof exportWorkerRequestSchema>;
export type ImportWorkerRequest = z.infer<typeof importWorkerRequestSchema>;
export type CancelWorkerRequest = z.infer<typeof cancelWorkerRequestSchema>;
export type ProbeWorkerRequest = z.infer<typeof probeWorkerRequestSchema>;
export type WorkerRequest = z.infer<typeof workerRequestSchema>;
export type WorkerResponse = z.infer<typeof workerResponseSchema>;
export type PreparedImportResult = z.infer<typeof preparedImportResultSchema>;

/** Valida una solicitud al worker. */
export function parseWorkerRequest(value: unknown): WorkerRequest {
  const parsed = workerRequestSchema.safeParse(value);

  if (!parsed.success) {
    throw new TransferError('TRANSFER_INTERNAL', { cause: parsed.error });
  }

  return parsed.data;
}

/** Valida un mensaje del worker. */
export function parseWorkerResponse(value: unknown): WorkerResponse {
  const parsed = workerResponseSchema.safeParse(value);

  if (!parsed.success) {
    throw new TransferError('TRANSFER_INTERNAL', { cause: parsed.error });
  }

  return parsed.data;
}
