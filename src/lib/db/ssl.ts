/**
 * Política TLS de las conexiones a PostgreSQL.
 *
 * Supabase exige TLS en todos sus endpoints. Si la cadena no incluye
 * `sslmode=require`, el driver `postgres` podría intentar una conexión sin
 * cifrar; por eso la aplicación lo fuerza salvo en un PostgreSQL local.
 *
 * La misma regla vive en `scripts/db/lib.mjs` para el tooling en JavaScript
 * puro. Si cambia aquí, cambia allí.
 */
export type DatabaseSsl = false | 'require';

/** Devuelve `require` salvo para localhost o una cadena con `sslmode=disable`. */
export function sslFor(url: string): DatabaseSsl {
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('sslmode=disable')
  ) {
    return false;
  }

  return 'require';
}
