/**
 * Esquemas Zod de los canales del historial de versiones.
 *
 * El mundo y la ficha se validan como UUIDv7 y la etiqueta manual es
 * obligatoria, se recorta y se acota a 120 caracteres. Las reglas de
 * pertenencia, límite y agrupación viven en el servicio.
 */
import { z } from 'zod';

import {
  VERSION_LABEL_MAX_LENGTH,
  VERSION_LIST_LIMIT_MAX,
} from '../../../shared/contracts/versions';
import { UUID_V7_PATTERN } from '../../db/ids';

const idSchema = z.string().regex(UUID_V7_PATTERN);

/** Payload de `versions:list`. */
export const versionListPayloadSchema = z.strictObject({
  worldId: idSchema,
  entityId: idSchema,
  limit: z.number().int().min(1).max(VERSION_LIST_LIMIT_MAX).optional(),
});

/** Payload de `versions:create`. */
export const versionCreatePayloadSchema = z.strictObject({
  worldId: idSchema,
  entityId: idSchema,
  label: z.string().trim().min(1).max(VERSION_LABEL_MAX_LENGTH),
});

/** Payload de `versions:restore`. */
export const versionRestorePayloadSchema = z.strictObject({
  worldId: idSchema,
  entityId: idSchema,
  versionId: idSchema,
});

export type VersionListPayload = z.infer<typeof versionListPayloadSchema>;
export type VersionCreatePayload = z.infer<typeof versionCreatePayloadSchema>;
export type VersionRestorePayload = z.infer<typeof versionRestorePayloadSchema>;
