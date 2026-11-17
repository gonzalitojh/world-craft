/**
 * Comprobación de disponibilidad de World Craft.
 *
 * `/api/health` no se limita a decir que el proceso de Next.js responde: hace
 * una consulta real y barata (`select 1`) contra Supabase con la cadena de la
 * aplicación (`DATABASE_URL`). Así un monitor externo detecta tanto una caída
 * del despliegue como un proyecto de Supabase pausado por inactividad (ADR
 * 0013).
 *
 * No se usa `SUPABASE_SERVICE_ROLE_KEY` ni ninguna clave de servicio: basta con
 * la conexión que ya usa el runtime. La respuesta nunca incluye el mensaje de
 * error, el host, la cadena de conexión ni el rol, para no filtrar detalles de
 * infraestructura a un endpoint público.
 */
import { sql } from 'drizzle-orm';

import { getPrivilegedDb } from '@/lib/db/client';
import { DatabaseEnvError } from '@/lib/db/env';

/** Tiempo máximo que se espera a Supabase antes de dar la comprobación por fallida. */
export const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/** Estado de la base de datos tal como lo ve el healthcheck. */
export type DatabaseStatus = 'available' | 'paused' | 'error';

/** Estado global del despliegue. */
export type HealthStatus = 'ok' | 'degraded';

/** Cuerpo JSON de `/api/health`. */
export type HealthPayload = {
  status: HealthStatus;
  database: DatabaseStatus;
  timestamp: string;
};

/**
 * Códigos de error que indican que la conexión no llegó a establecerse.
 *
 * Un proyecto pausado de Supabase deja de resolver o de aceptar conexiones, así
 * que el síntoma habitual es uno de estos. También puede deberse a una caída de
 * red: el runbook manda confirmar el estado en el panel de Supabase antes de
 * concluir que hay que restaurar.
 */
const UNREACHABLE_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'CONNECT_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
]);

/**
 * Mensajes que Supabase devuelve cuando el proyecto está pausado o su tenant ya
 * no existe en el pooler.
 */
const PAUSED_ERROR_PATTERNS = [
  /tenant or user not found/i,
  /project is paused/i,
  /project.*paused/i,
];

/** Error interno cuando la consulta supera el tiempo máximo. */
class HealthCheckTimeoutError extends Error {
  constructor() {
    super('La comprobación de la base de datos ha superado el tiempo máximo.');
    this.name = 'HealthCheckTimeoutError';
  }
}

/** Recorre la cadena de causas de un error y recoge códigos y mensajes. */
function collectErrorDetails(error: unknown): {
  codes: string[];
  messages: string[];
} {
  const codes: string[] = [];
  const messages: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current !== undefined; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      break;
    }

    const candidate = current as {
      cause?: unknown;
      code?: unknown;
      message?: unknown;
    };

    if (typeof candidate.code === 'string') {
      codes.push(candidate.code);
    }

    if (typeof candidate.message === 'string') {
      messages.push(candidate.message);
    }

    current = candidate.cause;
  }

  return { codes, messages };
}

/**
 * Traduce un fallo de la comprobación a un estado público.
 *
 * - `paused`: no se pudo abrir la conexión (DNS, timeout, rechazo o tenant
 *   ausente). Es el síntoma de un Supabase pausado, aunque una caída de red
 *   produce lo mismo; el runbook indica cómo confirmarlo.
 * - `error`: se llegó al servidor pero la consulta falló (credenciales,
 *   permisos, base inexistente u otro error inesperado).
 */
export function classifyDatabaseFailure(
  error: unknown,
): Exclude<DatabaseStatus, 'available'> {
  if (error instanceof HealthCheckTimeoutError) {
    return 'paused';
  }

  // Una variable ausente o mal formada es un fallo de configuración, no una
  // pausa: el monitor debe avisar, pero restaurar el proyecto no lo arregla.
  if (error instanceof DatabaseEnvError) {
    return 'error';
  }

  const { codes, messages } = collectErrorDetails(error);

  if (codes.some((code) => UNREACHABLE_ERROR_CODES.has(code))) {
    return 'paused';
  }

  if (
    messages.some((message) =>
      PAUSED_ERROR_PATTERNS.some((pattern) => pattern.test(message)),
    )
  ) {
    return 'paused';
  }

  return 'error';
}

/** Ejecuta una promesa con un límite de tiempo. */
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new HealthCheckTimeoutError()),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

/**
 * Consulta barata contra la base de datos de la aplicación.
 *
 * `select 1` no toca tablas, no depende de RLS y cuesta prácticamente nada; es
 * suficiente para demostrar que Supabase acepta conexiones y consultas.
 */
async function runHealthQuery(): Promise<void> {
  const db = getPrivilegedDb();
  await db.execute(sql`select 1`);
}

/**
 * Comprueba la base de datos y devuelve su estado.
 *
 * `query` y `timeoutMs` se inyectan en las pruebas para simular respuestas,
 * errores y timeouts sin abrir conexiones reales.
 */
export async function probeDatabase(
  query: () => Promise<unknown> = runHealthQuery,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
): Promise<DatabaseStatus> {
  try {
    await withTimeout(query(), timeoutMs);
    return 'available';
  } catch (error) {
    return classifyDatabaseFailure(error);
  }
}

/**
 * Construye el cuerpo de `/api/health`.
 *
 * Es una función pura: no consulta nada, solo traduce el estado de la base y la
 * marca de tiempo. La usan la ruta y la página `/health`.
 */
export function buildHealthPayload(
  database: DatabaseStatus,
  now: Date = new Date(),
): HealthPayload {
  return {
    status: database === 'available' ? 'ok' : 'degraded',
    database,
    timestamp: now.toISOString(),
  };
}

/** Código HTTP que corresponde a un estado de base de datos. */
export function healthStatusCode(database: DatabaseStatus): 200 | 503 {
  return database === 'available' ? 200 : 503;
}
