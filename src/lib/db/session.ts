/**
 * Sesión de usuario sobre PostgreSQL: el único camino admitido para consultar
 * datos de usuario con Drizzle.
 *
 * `withUserSession` abre una transacción, cambia al rol `authenticated` y fija
 * los claims que Supabase usa en `auth.uid()`. A partir de ahí **la RLS decide**
 * qué filas se ven y se tocan; el código de la aplicación no necesita repetir
 * filtros por mundo (aunque las Server Actions sí vuelven a comprobar el rol,
 * regla 2 del plan).
 *
 * Requisitos del diseño:
 * - `set local`: el cambio de rol y los claims se deshacen al cerrar la
 *   transacción, también en el pooler transaccional.
 * - `DIRECT_URL`: las conexiones de sesión son las que la documentación de
 *   Supabase recomienda para operaciones que necesitan estado; el runtime de
 *   M1 podrá usar el pooler transaccional sin cambiar la firma.
 * - El `userId` lo aporta la capa de autenticación (M1-01) tras validar la
 *   cookie de sesión. Aquí no se valida la identidad: se asume que quien llama
 *   ya la validó.
 */
import 'server-only';

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import { readDirectUrl } from './env';
import * as schema from './schema';
import { sslFor } from './ssl';

/** Base de datos con la sesión de un usuario: la RLS ya está activa. */
export type UserDatabase = PostgresJsDatabase<typeof schema>;

/** Identificador con el que se firma la sesión. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ejecuta `fn` dentro de una transacción con el rol `authenticated` y el claim
 * `sub` del usuario indicado.
 *
 * El callback recibe una instancia de Drizzle ligada a la transacción: todas sus
 * consultas ven la sesión del usuario. Si `fn` lanza, la transacción se revierte.
 */
export async function withUserSession<T>(
  userId: string,
  fn: (db: UserDatabase) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error('withUserSession espera un UUID de usuario válido');
  }

  const url = readDirectUrl();
  const client = postgres(url, {
    prepare: false,
    max: 1,
    ssl: sslFor(url),
    onnotice: () => undefined,
  });

  try {
    return await client.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;

      // `postgres@4` y `drizzle-orm` no comparten todavía el tipo de la
      // transacción; el runtime es el mismo cliente y Drizzle acepta `Sql`.
      return fn(
        drizzle(tx as unknown as Sql, { schema, casing: 'snake_case' }),
      );
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}
