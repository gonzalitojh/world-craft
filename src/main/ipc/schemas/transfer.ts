/**
 * Esquemas Zod de los canales de exportación e importación.
 *
 * Los payloads son mínimos: el renderer solo identifica el mundo que quiere
 * exportar o pide abrir el selector nativo. Las rutas y el `operationId` se
 * quedan siempre en el proceso principal.
 */
import { z } from 'zod';

import { UUID_V7_PATTERN } from '../../db/ids';

/** Payload de `transfer:exportWorld`. */
export const transferExportPayloadSchema = z.strictObject({
  worldId: z.string().regex(UUID_V7_PATTERN),
});

/** Payload de `transfer:importWorld`: objeto vacío estricto. */
export const transferImportPayloadSchema = z.strictObject({});

/** Payload de `transfer:cancel`: objeto vacío estricto. */
export const transferCancelPayloadSchema = z.strictObject({});

export type TransferExportPayload = z.infer<typeof transferExportPayloadSchema>;
export type TransferImportPayload = z.infer<typeof transferImportPayloadSchema>;
export type TransferCancelPayload = z.infer<typeof transferCancelPayloadSchema>;
