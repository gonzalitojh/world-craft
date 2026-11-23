/**
 * Esquemas Zod de los canales de preferencias.
 *
 * `preferences:get` y `preferences:reset` no llevan datos: exigen un objeto
 * vacío estricto. `preferences:update` reutiliza el parche estricto del dominio
 * para que el router y el servicio validen exactamente la misma forma.
 */
import { z } from 'zod';

import { uiPreferencesPatchSchema } from '../../preferences/validation';

/** Payload vacío de `preferences:get` y `preferences:reset`. */
export const preferencesEmptyPayloadSchema = z.strictObject({});

/** Payload de `preferences:update`. */
export const preferencesUpdatePayloadSchema = uiPreferencesPatchSchema;

export type PreferencesEmptyPayload = z.infer<
  typeof preferencesEmptyPayloadSchema
>;
export type PreferencesUpdatePayload = z.infer<
  typeof preferencesUpdatePayloadSchema
>;
