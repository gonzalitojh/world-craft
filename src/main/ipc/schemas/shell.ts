/**
 * Esquemas Zod de los canales del proceso principal.
 *
 * Zod solo se importa desde `src/main`: el renderer y el preload compilan los
 * contratos puros de `src/shared`, así que la dependencia no se empaqueta en el
 * renderer (ADR 0004).
 */
import { z } from 'zod';

import { MAX_EXTERNAL_URL_LENGTH } from '../../security/external-links';

/**
 * Payload de `shell:openExternal`.
 *
 * Solo comprueba la forma: el esquema y la política de destinos se validan en
 * `resolveExternalUrl`. Se rechazan propiedades extra para no arrastrar datos
 * que no se usan.
 */
export const shellOpenExternalPayloadSchema = z.strictObject({
  url: z.string().min(1).max(MAX_EXTERNAL_URL_LENGTH),
});

export type ShellOpenExternalPayload = z.infer<
  typeof shellOpenExternalPayloadSchema
>;
