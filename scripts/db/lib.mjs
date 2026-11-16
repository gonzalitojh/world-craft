/**
 * Utilidades compartidas por los scripts `db:*`.
 *
 * Los scripts hablan con PostgreSQL a través del **pooler de sesión**
 * (`DIRECT_URL`): las migraciones, el seed, el reset y las comprobaciones
 * necesitan estado de sesión, y el pooler transaccional no lo garantiza.
 *
 * Reglas de seguridad de este módulo:
 * - Nunca se imprime la cadena de conexión completa ni la contraseña.
 * - Los scripts que escriben (`reset` y `seed`) se niegan a ejecutarse con
 *   `NODE_ENV=production`.
 * - El reset exige `CONFIRM_DB_RESET=world-craft-dev:<ref>`, atado al host.
 *
 * Se ejecutan con `node`, no con Vitest, así que no importan TypeScript.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import postgres from 'postgres';

const POSTGRES_PROTOCOL = /^postgres(ql)?:\/\/\S+$/;

const ENV_FILES = ['.env.local', '.env'];

/**
 * Carga `.env.local` (o `.env`) si existe, sin sobrescribir el entorno del
 * proceso. Devuelve el archivo cargado o `null`.
 */
export function loadEnv() {
  for (const file of ENV_FILES) {
    const path = resolve(process.cwd(), file);

    if (existsSync(path)) {
      process.loadEnvFile(path);
      return file;
    }
  }

  return null;
}

/** Lee una variable obligatoria y falla con un mensaje en español. */
export function readEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Falta ${name}. Copia .env.example a .env.local y pega la cadena de conexión del proyecto de Supabase de desarrollo.`,
    );
  }

  return value;
}

/** Devuelve la cadena de conexión del tooling, validando el protocolo. */
export function readDirectUrl() {
  const url = readEnv('DIRECT_URL');

  if (!POSTGRES_PROTOCOL.test(url)) {
    throw new Error(
      'DIRECT_URL debe empezar por postgres:// o postgresql:// y no contener espacios.',
    );
  }

  return url;
}

/**
 * Oculta la contraseña de una cadena de conexión.
 *
 * Se usa en todos los mensajes y errores para que un log o una captura nunca
 * filtre credenciales.
 */
export function redactUrl(value) {
  try {
    const url = new URL(value);
    url.password = '';
    return url.toString();
  } catch {
    return '(cadena de conexión no válida)';
  }
}

/** SSL obligatorio salvo en un PostgreSQL local sin `sslmode`. */
function sslFor(url) {
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('sslmode=disable')
  ) {
    return false;
  }

  return 'require';
}

/**
 * Abre una conexión de sesión con `DIRECT_URL`.
 *
 * Devuelve el cliente de `postgres` y la URL ya validada; quien llama debe
 * cerrar el cliente con `sql.end({ timeout: 5 })`.
 */
export function connectDirect() {
  const url = readDirectUrl();

  return {
    url,
    sql: postgres(url, {
      max: 1,
      prepare: false,
      ssl: sslFor(url),
      onnotice: () => undefined,
    }),
  };
}

/** Impide ejecutar scripts de base de datos contra producción. */
export function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Los scripts de base de datos no se ejecutan con NODE_ENV=production. Usa el proyecto de desarrollo.',
    );
  }
}

/** Lee el journal de Drizzle Kit. */
export function readJournal() {
  const path = resolve(process.cwd(), 'drizzle/meta/_journal.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Cabecera de sección para la salida de los scripts. */
export function printTitle(title) {
  console.log(`\n${title}`);
  console.log('─'.repeat(Math.max(title.length, 10)));
}

/** Línea de comprobación correcta. */
export function printOk(message) {
  console.log(`  ✓ ${message}`);
}

/** Línea informativa. */
export function printDetail(message) {
  console.log(`  · ${message}`);
}

/** Línea de comprobación fallida. Devuelve `false` para acumular el fallo. */
export function printFail(message) {
  console.error(`  ✖ ${message}`);
  return false;
}

/**
 * Envoltorio común: carga el entorno, ejecuta el script y traduce el error a un
 * mensaje sin credenciales.
 */
export async function runScript(name, fn) {
  loadEnv();

  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✖ ${name} falló: ${message}`);
    process.exitCode = 1;
  }
}

/** Cierra la conexión sin dejar temporizadores pendientes. */
export async function closeConnection(sql) {
  await sql.end({ timeout: 5 });
}
