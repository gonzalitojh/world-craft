/**
 * Esquemas Zod de los canales de la papelera.
 *
 * La forma se valida aquí y las reglas de dominio (padre vivo, tipo
 * disponible, copia previa) en el servicio. Se rechazan propiedades extra y
 * las acciones destructivas exigen el literal de confirmación exacto.
 */
import { z } from 'zod';

import {
  TRASH_EMPTY_CONFIRMATION,
  TRASH_GROUPS,
  TRASH_KINDS,
  TRASH_PAGE_LIMIT_MAX,
  TRASH_PURGE_CONFIRMATION,
  TRASH_CURSOR_PATTERN,
} from '../../../shared/contracts/trash';
import { UUID_V7_PATTERN } from '../../db/ids';

const idSchema = z.string().regex(UUID_V7_PATTERN);

/** Payload de `trash:list`. */
export const trashListPayloadSchema = z.strictObject({
  group: z.enum(TRASH_GROUPS),
  cursor: z.string().regex(TRASH_CURSOR_PATTERN).optional(),
  limit: z.number().int().min(1).max(TRASH_PAGE_LIMIT_MAX).optional(),
});

/** Payload de `trash:restore`. */
export const trashRestorePayloadSchema = z.strictObject({
  kind: z.enum(TRASH_KINDS),
  id: idSchema,
});

/** Payload de `trash:purge`. */
export const trashPurgePayloadSchema = z.strictObject({
  kind: z.enum(TRASH_KINDS),
  id: idSchema,
  confirm: z.literal(TRASH_PURGE_CONFIRMATION),
});

/** Payload de `trash:empty`. */
export const trashEmptyPayloadSchema = z.strictObject({
  confirm: z.literal(TRASH_EMPTY_CONFIRMATION),
});

export type TrashListPayload = z.infer<typeof trashListPayloadSchema>;
export type TrashRestorePayload = z.infer<typeof trashRestorePayloadSchema>;
export type TrashPurgePayload = z.infer<typeof trashPurgePayloadSchema>;
export type TrashEmptyPayload = z.infer<typeof trashEmptyPayloadSchema>;
