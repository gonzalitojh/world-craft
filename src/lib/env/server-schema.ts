/**
 * Esquema de las variables de entorno **solo de servidor**.
 *
 * Importa este módulo únicamente desde `server.ts` (que marca `server-only`) o
 * desde tests. Nunca desde componentes cliente: expondría nombres de secretos
 * y permitiría leerlos en el navegador.
 *
 * Todavía no hay servicios conectados (Supabase llega con M0-08, issue #9, y
 * R2 con M0-10, issue #40), así que las claves son opcionales. Cuando exista
 * código que las consuma se endurecerán con `superRefine` o con un esquema
 * específico por entorno.
 */
import { z } from 'zod';

import {
  emptyAsUndefined,
  optionalText,
  optionalUrl,
  publicEnvSchema,
} from './public-schema';

/** Esquema completo: variables públicas validadas + variables de servidor. */
export const serverEnvSchema = publicEnvSchema.extend({
  NODE_ENV: z.preprocess(
    emptyAsUndefined,
    z.enum(['development', 'test', 'production']).default('development'),
  ),
  // Dominio de la preview o del despliegue que Vercel inyecta en el servidor.
  VERCEL_URL: optionalText,
  // Commit desplegado. También lo inyecta Vercel (rama, preview y producción);
  // nunca se rellena a mano. Lo muestra `/health`.
  VERCEL_GIT_COMMIT_SHA: optionalText,
  // Supabase (M0-08, issue #9) y Supabase Auth (M1-01, issue #11).
  SUPABASE_URL: optionalUrl,
  SUPABASE_ANON_KEY: optionalText,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  DATABASE_URL: optionalUrl,
  // Cloudflare R2 (M0-10, issue #40).
  R2_ACCOUNT_ID: optionalText,
  R2_ACCESS_KEY_ID: optionalText,
  R2_SECRET_ACCESS_KEY: optionalText,
  R2_BUCKET_NAME: optionalText,
  R2_ENDPOINT: optionalUrl,
});

/** Variables de servidor ya validadas y con sus valores por defecto aplicados. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Valida las variables de entorno de servidor a partir de una fuente.
 *
 * Es una función pura: el único origen de datos es `source`. Lanza `ZodError`
 * si algún valor no cumple el esquema.
 */
export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse(source);
}
