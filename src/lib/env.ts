/**
 * AVISO: este módulo mezcla claves públicas y secretos de servidor
 * (`SUPABASE_SERVICE_ROLE_KEY`, `R2_SECRET_ACCESS_KEY`).
 *
 * NO debe importarse desde componentes cliente ni desde código que se envíe al
 * navegador: expondría secretos en el bundle. Solo servidor (Server Components,
 * Server Actions, route handlers y scripts). En M0-06 (issue #7) se separará en
 * un esquema público y otro de servidor, o se marcará `server-only`.
 */
import { z } from 'zod';

/**
 * Convierte una cadena vacía o solo con espacios en `undefined`.
 *
 * Los archivos `.env` suelen declarar la clave sin valor (`SUPABASE_URL=`) y
 * eso debe tratarse como «ausente», no como un valor inválido.
 */
const emptyAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Variable de texto opcional que trata la cadena vacía como ausente. */
const optionalText = z.preprocess(
  emptyAsUndefined,
  z.string().min(1).optional(),
);

/** Variable de URL opcional que trata la cadena vacía como ausente. */
const optionalUrl = z.preprocess(emptyAsUndefined, z.url().optional());

/**
 * Esquema de variables de entorno de World Craft.
 *
 * Todavía no hay servicios conectados (M0-06, issue #7, trae el scaffold de
 * Next.js), así que las claves de Supabase y R2 son opcionales. Cuando exista
 * código que las consuma se endurecerán con `superRefine` o con un esquema
 * específico por entorno.
 */
export const envSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyAsUndefined,
    z.enum(['development', 'test', 'production']).default('development'),
  ),
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

/** Variables de entorno ya validadas y con sus valores por defecto aplicados. */
export type Env = z.infer<typeof envSchema>;

/**
 * Valida las variables de entorno a partir de una fuente.
 *
 * Es una función pura: el único origen de datos es `source`. Lanza `ZodError`
 * si algún valor no cumple el esquema.
 */
export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  return envSchema.parse(source);
}
