/**
 * Conexión **privilegiada** a PostgreSQL con `postgres` + Drizzle.
 *
 * `getPrivilegedDb()` se conecta con la cadena de la aplicación
 * (`DATABASE_URL`, pooler transaccional) usando el rol propietario de las
 * tablas, que en Supabase tiene `bypassrls`. Su uso queda restringido a
 * migraciones, seed, scripts administrativos y tareas de servidor que necesiten
 * ver todos los mundos (healthcheck, exportación, backups).
 *
 * **Nunca** se usa para consultas de datos de usuario: para eso existe
 * `withUserSession` (`session.ts`), que activa el rol `authenticated` con los
 * claims del usuario y deja que la RLS decida.
 *
 * El módulo es perezoso a propósito: importarlo no lee el entorno ni abre
 * conexiones, así que `next build` y la CI funcionan sin credenciales.
 */
import 'server-only';

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { readDatabaseUrl } from './env';
import * as schema from './schema';
import { sslFor } from './ssl';

/** Tipo de la base de datos con el esquema completo. */
export type Database = PostgresJsDatabase<typeof schema>;

/** Conexión viva: el cliente de `postgres` y la instancia de Drizzle. */
interface PrivilegedConnection {
  client: postgres.Sql;
  db: Database;
}

let connection: PrivilegedConnection | undefined;

/**
 * Devuelve la conexión privilegiada, creándola en la primera llamada.
 *
 * `prepare: false` es obligatorio con el pooler transaccional de Supabase
 * (PgBouncer en modo transacción no admite sentencias preparadas con nombre) y
 * `max: 1` evita agotar el pool en un entorno serverless donde cada instancia
 * atiende una petición a la vez.
 */
export function getPrivilegedDb(): Database {
  if (!connection) {
    const url = readDatabaseUrl();
    const client = postgres(url, {
      prepare: false,
      max: 1,
      ssl: sslFor(url),
      onnotice: () => undefined,
    });

    connection = {
      client,
      db: drizzle(client, { schema, casing: 'snake_case' }),
    };
  }

  return connection.db;
}

/**
 * Cierra la conexión abierta, si existe.
 *
 * Lo usan los scripts y los tests para que el proceso termine sin temporizadores
 * pendientes.
 */
export async function closePrivilegedDb(): Promise<void> {
  if (!connection) {
    return;
  }

  const { client } = connection;
  connection = undefined;
  await client.end({ timeout: 5 });
}
