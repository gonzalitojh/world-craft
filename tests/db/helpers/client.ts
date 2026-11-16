/**
 * Conexión privilegiada de las pruebas de integración.
 *
 * Usa `DIRECT_URL` y el rol propietario de las tablas (en Supabase, `postgres`
 * con `bypassrls`). Solo crea y limpia fixtures; las aserciones de RLS se hacen
 * con `asUser` (`session.ts`).
 */
import postgres, { type Sql } from 'postgres';

import { readDirectUrlForTests, sslForTests } from './env';

let client: Sql | undefined;

/** Cliente privilegiado compartido por toda la suite. */
export function getClient(): Sql {
  if (!client) {
    const url = readDirectUrlForTests();

    client = postgres(url, {
      max: 4,
      prepare: false,
      ssl: sslForTests(url),
      onnotice: () => undefined,
    });
  }

  return client;
}

/** Cierra el cliente al terminar la suite. */
export async function closeClient(): Promise<void> {
  if (!client) {
    return;
  }

  const current = client;
  client = undefined;
  await current.end({ timeout: 5 });
}

/** Devuelve la primera fila o falla con un mensaje útil. */
export function first<T>(rows: readonly T[]): T {
  const [row] = rows;

  if (row === undefined) {
    throw new Error('La consulta no devolvió ninguna fila');
  }

  return row;
}
