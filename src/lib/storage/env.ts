/**
 * Validación **estricta y perezosa** de las variables de almacenamiento.
 *
 * Por qué perezosa: `next build`, la CI y las pruebas unitarias no tienen
 * credenciales de Cloudflare R2. Si este módulo validara al importarse, el
 * build fallaría en cualquier entorno sin bucket. El error aparece cuando
 * alguien intenta crear el adaptador, con un mensaje que dice exactamente qué
 * variable falta.
 *
 * Por qué sin `server-only`: este archivo lo importan los tests y los scripts
 * de operación. Los secretos no viven aquí, solo se leen de `process.env`; el
 * marcado `server-only` está en `server.ts`, que es el único punto de entrada
 * de la aplicación.
 *
 * Reglas aprobadas en M0-10 (issue #40):
 * - `STORAGE_DRIVER` elige `local` o `r2`; si falta, se autodetecta.
 * - En producción el driver local está prohibido y R2 es obligatorio: se falla
 *   cerrado con `StorageError('unavailable')`, nunca se cae a disco.
 * - Ninguna variable de R2 es pública ni se incrusta en el bundle del cliente.
 */
import { z } from 'zod';

import { emptyAsUndefined } from '@/lib/env/public-schema';

import { StorageError } from './types';

/** Drivers admitidos por la aplicación. */
export const STORAGE_DRIVERS = ['local', 'r2'] as const;

/** Nombre de driver de almacenamiento. */
export type StorageDriverName = (typeof STORAGE_DRIVERS)[number];

/** Directorio por defecto del adaptador local (ignorado por git). */
export const DEFAULT_STORAGE_LOCAL_DIR = '.local/storage';

/** Nombre por defecto del archivo del secreto HMAC local. */
export const DEFAULT_STORAGE_LOCAL_SECRET_FILE = '.local/storage-secret';

/**
 * Nombre de bucket de R2/S3.
 *
 * Cloudflare exige 3-63 caracteres, minúsculas, dígitos y guiones, empezando y
 * terminando por letra o dígito. Validarlo evita construir un endpoint con un
 * valor inyectado.
 */
const bucketName = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
    'debe tener entre 3 y 63 caracteres en minúsculas, dígitos o guiones',
  );

/** Identificador de cuenta de R2: 32 caracteres hexadecimales. */
const accountId = z
  .string()
  .regex(
    /^[a-f0-9]{32}$/i,
    'debe ser el identificador de cuenta de 32 caracteres hexadecimales',
  );

/** Identificador de clave de R2: opaco y sin espacios. */
const opaqueCredential = z
  .string()
  .regex(
    /^[A-Za-z0-9+/=_-]{16,128}$/,
    'no parece una credencial válida (16-128 caracteres sin espacios)',
  );

/** URL del endpoint S3 de R2. */
const httpsUrl = z.url({ protocol: /^https?$/ });

/**
 * Esquema de entorno de almacenamiento.
 *
 * Ninguna clave es obligatoria a nivel de esquema: la obligatoriedad se aplica
 * en `resolveStorageEnv` y `assertR2Configured` para no romper el build. Las
 * cadenas vacías se tratan como ausentes, igual que en el resto de `src/lib/env`.
 */
export const storageEnvSchema = z
  .object({
    NODE_ENV: z.preprocess(
      emptyAsUndefined,
      z.enum(['development', 'test', 'production']).default('development'),
    ),
    /**
     * Entorno de despliegue de Vercel. En una preview `NODE_ENV` es
     * `production`, así que este valor decide si el self-check puede existir.
     */
    VERCEL_ENV: z.preprocess(
      emptyAsUndefined,
      z.enum(['production', 'preview', 'development']).optional(),
    ),
    STORAGE_DRIVER: z.preprocess(
      emptyAsUndefined,
      z.enum(STORAGE_DRIVERS).optional(),
    ),
    R2_ACCOUNT_ID: z.preprocess(emptyAsUndefined, accountId.optional()),
    R2_ACCESS_KEY_ID: z.preprocess(
      emptyAsUndefined,
      opaqueCredential.optional(),
    ),
    R2_SECRET_ACCESS_KEY: z.preprocess(
      emptyAsUndefined,
      opaqueCredential.optional(),
    ),
    R2_BUCKET_NAME: z.preprocess(emptyAsUndefined, bucketName.optional()),
    R2_ENDPOINT: z.preprocess(emptyAsUndefined, httpsUrl.optional()),
    STORAGE_LOCAL_DIR: z.preprocess(
      emptyAsUndefined,
      z.string().min(1).max(512).optional(),
    ),
    /**
     * Origen con el que se firman las URLs del adaptador local. Por defecto,
     * `http://localhost:3000`; se cambia si el servidor de desarrollo usa otro
     * puerto u host.
     */
    STORAGE_LOCAL_BASE_URL: z.preprocess(emptyAsUndefined, httpsUrl.optional()),
    STORAGE_LOCAL_SECRET: z.preprocess(
      emptyAsUndefined,
      z.string().min(16).max(256).optional(),
    ),
    STORAGE_SMOKE_TOKEN: z.preprocess(
      emptyAsUndefined,
      z.string().min(16).max(256).optional(),
    ),
  })
  .strict();

/** Variables de almacenamiento ya validadas. */
export type StorageEnv = z.infer<typeof storageEnvSchema>;

/** Entorno de almacenamiento con los valores por defecto aplicados. */
export type ResolvedStorageEnv = StorageEnv & {
  STORAGE_LOCAL_DIR: string;
};

/** Claves que lee este módulo. El resto de `process.env` se ignora. */
const STORAGE_ENV_KEYS = [
  'NODE_ENV',
  'VERCEL_ENV',
  'STORAGE_DRIVER',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ENDPOINT',
  'STORAGE_LOCAL_DIR',
  'STORAGE_LOCAL_BASE_URL',
  'STORAGE_LOCAL_SECRET',
  'STORAGE_SMOKE_TOKEN',
] as const satisfies readonly (keyof StorageEnv)[];

/** Copia solo las claves de almacenamiento de una fuente de entorno. */
export function pickStorageEnv(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const picked: Record<string, string | undefined> = {};

  for (const key of STORAGE_ENV_KEYS) {
    picked[key] = source[key];
  }

  return picked;
}

/**
 * Valida las variables de almacenamiento a partir de una fuente.
 *
 * Es una función pura: el único origen de datos es `source`. Lanza `ZodError`
 * si algún valor no cumple el esquema.
 */
export function parseStorageEnv(
  source: Record<string, string | undefined> = process.env,
): StorageEnv {
  return storageEnvSchema.parse(pickStorageEnv(source));
}

/**
 * Devuelve el entorno de almacenamiento con los valores por defecto aplicados.
 *
 * No exige credenciales; esa comprobación la hace el driver según el entorno.
 */
export function resolveStorageEnv(
  source: Record<string, string | undefined> = process.env,
): ResolvedStorageEnv {
  const env = parseStorageEnv(source);

  return {
    ...env,
    STORAGE_LOCAL_DIR: env.STORAGE_LOCAL_DIR ?? DEFAULT_STORAGE_LOCAL_DIR,
  };
}

/** Nombre de bucket por defecto del adaptador local. */
export const DEFAULT_STORAGE_BUCKET = 'world-craft-local';

/** Configuración completa de R2, ya validada. */
export interface R2StorageConfig {
  /**
   * Identificador de cuenta. Puede quedar vacío si se configuró
   * `R2_ENDPOINT`: el endpoint ya identifica el servicio y el cliente S3 no
   * usa este valor.
   */
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
}

/**
 * Variables de R2 que faltan o no son válidas.
 *
 * La cuenta solo es obligatoria si no hay `R2_ENDPOINT`; con endpoint explícito
 * basta con las credenciales y el bucket.
 */
export function missingR2Variables(env: StorageEnv): string[] {
  const missing: string[] = [];

  if (env.R2_ACCOUNT_ID === undefined && env.R2_ENDPOINT === undefined) {
    missing.push('R2_ACCOUNT_ID');
  }

  if (env.R2_ACCESS_KEY_ID === undefined) {
    missing.push('R2_ACCESS_KEY_ID');
  }

  if (env.R2_SECRET_ACCESS_KEY === undefined) {
    missing.push('R2_SECRET_ACCESS_KEY');
  }

  if (env.R2_BUCKET_NAME === undefined) {
    missing.push('R2_BUCKET_NAME');
  }

  return missing;
}

/**
 * Devuelve el nombre del bucket con el que se etiquetan los metadatos.
 *
 * En R2 es el bucket configurado; en local, un nombre estable que cumple la
 * misma restricción de formato de la guarda de la migración 0007.
 */
export function resolveStorageBucketName(env: StorageEnv): string {
  return env.R2_BUCKET_NAME ?? DEFAULT_STORAGE_BUCKET;
}

/**
 * Devuelve la configuración de R2 o falla cerrado.
 *
 * `R2_ACCOUNT_ID` y `R2_ENDPOINT` son alternativas: si hay endpoint, la cuenta
 * puede faltar y `accountId` queda vacío. El error es
 * `StorageError('unavailable')`, nunca una excepción de Zod con valores.
 */
export function assertR2Configured(env: StorageEnv): R2StorageConfig {
  const missing = missingR2Variables(env);

  if (missing.length > 0) {
    throw new StorageError(
      'unavailable',
      `Faltan variables de R2: ${missing.join(', ')}.`,
    );
  }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  const bucket = env.R2_BUCKET_NAME;

  if (
    R2_ACCESS_KEY_ID === undefined ||
    R2_SECRET_ACCESS_KEY === undefined ||
    bucket === undefined
  ) {
    // Inalcanzable tras `missingR2Variables`; mantiene el estrechamiento.
    throw new StorageError('unavailable', 'Configuración de R2 incompleta.');
  }

  const endpoint =
    env.R2_ENDPOINT ??
    (R2_ACCOUNT_ID === undefined
      ? undefined
      : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

  if (endpoint === undefined) {
    throw new StorageError(
      'unavailable',
      'Faltan variables de R2: R2_ACCOUNT_ID o R2_ENDPOINT.',
    );
  }

  return {
    accountId: R2_ACCOUNT_ID ?? '',
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket,
    endpoint,
  };
}
