/**
 * Esquemas Zod de los canales de datos.
 *
 * Las lecturas y la exportación no llevan payload; el borrado y la purga exigen
 * tokens literales para que el router rechace cualquier variante antes de
 * llamar al dominio.
 */
import { z } from 'zod';

import {
  DATA_DELETE_ALL_CONFIRMATION,
  DATA_FOLDERS,
  DATA_ORPHAN_PURGE_CONFIRMATION,
} from '../../../shared/contracts/data';

/** Payload vacío de lecturas y exportación. */
export const dataEmptyPayloadSchema = z.strictObject({});

/** Payload de `data:openFolder`. */
export const dataOpenFolderPayloadSchema = z.strictObject({
  folder: z.enum(DATA_FOLDERS),
});

/** Payload de `data:purgeOrphans`. */
export const dataPurgeOrphansPayloadSchema = z.strictObject({
  confirmation: z.literal(DATA_ORPHAN_PURGE_CONFIRMATION),
});

/** Payload de `data:deleteAll`. */
export const dataDeleteAllPayloadSchema = z.strictObject({
  confirmation: z.literal(DATA_DELETE_ALL_CONFIRMATION),
  keepBackups: z.boolean(),
});

export type DataEmptyPayload = z.infer<typeof dataEmptyPayloadSchema>;
export type DataOpenFolderPayload = z.infer<
  typeof dataOpenFolderPayloadSchema
>;
export type DataPurgeOrphansPayload = z.infer<
  typeof dataPurgeOrphansPayloadSchema
>;
export type DataDeleteAllPayload = z.infer<typeof dataDeleteAllPayloadSchema>;
