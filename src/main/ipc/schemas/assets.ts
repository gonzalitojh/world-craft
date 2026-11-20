/**
 * Esquemas Zod de los canales de assets.
 *
 * El renderer solo elige un mundo y un texto alternativo opcional. La ruta de
 * los archivos la produce el diálogo nativo en el proceso principal y nunca
 * entra en el payload IPC.
 */
import { z } from 'zod';

import { ASSET_ALT_MAX_LENGTH } from '../../assets/constants';
import { UUID_V7_PATTERN } from '../../db/ids';

const worldIdSchema = z.string().regex(UUID_V7_PATTERN);

/** Payload de `assets:list`. */
export const assetsListPayloadSchema = z.strictObject({
  worldId: worldIdSchema,
});

/** Payload de `assets:import`. */
export const assetsImportPayloadSchema = z.strictObject({
  worldId: worldIdSchema,
  alt: z.string().trim().max(ASSET_ALT_MAX_LENGTH).optional(),
});

export type AssetsListPayload = z.infer<typeof assetsListPayloadSchema>;
export type AssetsImportPayload = z.infer<typeof assetsImportPayloadSchema>;
