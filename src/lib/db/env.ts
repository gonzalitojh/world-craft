/**
 * Validación **estricta y perezosa** de las cadenas de conexión a PostgreSQL.
 *
 * Por qué perezosa: el build, la CI y las pruebas unitarias no tienen base de
 * datos. Si este módulo validara al importarse, `next build` fallaría en
 * cualquier entorno sin credenciales. El error aparece cuando alguien intenta
 * conectarse, con un mensaje que dice exactamente qué variable falta.
 *
 * Por qué dos cadenas:
 * - `DATABASE_URL` es la del **pooler transaccional** (puerto 6543), la que usa
 *   la aplicación en serverless.
 * - `DIRECT_URL` es la del **pooler de sesión** (puerto 5432), la que usan las
 *   migraciones, el seed, el reset y las pruebas de RLS.
 *
 * Este módulo lo importan `client.ts` y los scripts de `scripts/db/`. No lleva
 * `server-only` para poder probarlo; los secretos no viven aquí, solo se leen.
 */
import { z } from 'zod';

import { emptyAsUndefined } from '@/lib/env/public-schema';

/** Prefijo aceptado para una cadena de conexión de PostgreSQL. */
const POSTGRES_PROTOCOL = /^postgres(ql)?:\/\/\S+$/;

/**
 * Cadena de conexión de PostgreSQL.
 *
 * Zod valida el formato, no la alcanzabilidad: comprobar que el host responde
 * es trabajo de `pnpm db:ping`.
 */
const postgresConnectionString = z.preprocess(
  emptyAsUndefined,
  z
    .string()
    .refine((value) => POSTGRES_PROTOCOL.test(value), {
      message:
        'debe empezar por postgres:// o postgresql:// y no contener espacios',
    })
    .optional(),
);

/**
 * Esquema de entorno de base de datos.
 *
 * Ninguna de las dos claves es obligatoria a nivel de esquema: `DATABASE_URL` lo
 * es para el runtime y `DIRECT_URL` para el tooling. La obligatoriedad se aplica
 * en `readDatabaseUrl` y `readDirectUrl` para no romper el build ni la CI.
 */
export const databaseEnvSchema = z.object({
  DATABASE_URL: postgresConnectionString,
  DIRECT_URL: postgresConnectionString,
});

/** Variables de base de datos ya validadas. */
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

/** Error de configuración de base de datos, con un mensaje en español. */
export class DatabaseEnvError extends Error {
  /** Variable de entorno implicada. */
  readonly variable: 'DATABASE_URL' | 'DIRECT_URL';

  constructor(variable: 'DATABASE_URL' | 'DIRECT_URL', message: string) {
    super(message);
    this.name = 'DatabaseEnvError';
    this.variable = variable;
  }
}

/** Valida un subconjunto del entorno sin lanzar por variables ausentes. */
export function parseDatabaseEnv(
  source: Record<string, string | undefined> = process.env,
): DatabaseEnv {
  return databaseEnvSchema.parse({
    DATABASE_URL: source.DATABASE_URL,
    DIRECT_URL: source.DIRECT_URL,
  });
}

/** Extrae una variable obligatoria con un error legible. */
function readRequiredUrl(
  variable: 'DATABASE_URL' | 'DIRECT_URL',
  source: Record<string, string | undefined>,
): string {
  const { success, data, error } = databaseEnvSchema.shape[variable].safeParse(
    source[variable],
  );

  if (!success) {
    throw new DatabaseEnvError(
      variable,
      `${variable} no es válida: ${
        error.issues[0]?.message ?? 'valor no reconocido'
      }`,
    );
  }

  if (data === undefined) {
    throw new DatabaseEnvError(
      variable,
      `Falta ${variable}. Copia .env.example a .env.local y pega la cadena de conexión del proyecto de Supabase.`,
    );
  }

  return data;
}

/**
 * Cadena de conexión de la aplicación (pooler transaccional).
 *
 * Lanza `DatabaseEnvError` si falta o es inválida.
 */
export function readDatabaseUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  return readRequiredUrl('DATABASE_URL', source);
}

/**
 * Cadena de conexión del tooling (pooler de sesión).
 *
 * Lanza `DatabaseEnvError` si falta o es inválida.
 */
export function readDirectUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  return readRequiredUrl('DIRECT_URL', source);
}
