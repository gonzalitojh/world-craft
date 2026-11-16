/**
 * `db:reset` — deja el proyecto de desarrollo vacío. **Destructivo.**
 *
 * Elimina los esquemas `public`, `app` y `drizzle` (tablas, políticas,
 * funciones y registro de migraciones) y recrea `public`. No aplica
 * migraciones ni seed: el siguiente paso es `pnpm db:migrate` y `pnpm db:seed`.
 *
 * Protecciones:
 * - `NODE_ENV=production` lo bloquea.
 * - Exige `CONFIRM_DB_RESET=world-craft-dev:<ref>` atado al host del proyecto,
 *   para que la confirmación no valga para otro destino.
 * - Solo imprime el destino con la contraseña oculta.
 */
import {
  assertNotProduction,
  closeConnection,
  connectDirect,
  printDetail,
  printOk,
  printTitle,
  readDirectUrl,
  redactUrl,
  runScript,
} from './lib.mjs';

/**
 * Referencia estable del destino: el sufijo del usuario (`postgres.<ref>`), el
 * subdominio de `db.<ref>.supabase.co` o el host local. Así la confirmación
 * cambia si se apunta a otro proyecto.
 */
function targetRef(value) {
  const url = new URL(value);
  const user = decodeURIComponent(url.username);

  if (user.includes('.')) {
    const ref = user.split('.').pop();
    if (ref) {
      return ref;
    }
  }

  const labels = url.hostname.split('.');
  if (labels.length >= 4 && labels[2] === 'supabase' && labels[3] === 'co') {
    return labels[1] ?? url.hostname;
  }

  return url.hostname;
}

await runScript('db:reset', async () => {
  assertNotProduction();

  const url = readDirectUrl();
  const confirmation = `world-craft-dev:${targetRef(url)}`;

  if (process.env.CONFIRM_DB_RESET !== confirmation) {
    throw new Error(
      `Reset cancelado. Ejecuta CONFIRM_DB_RESET=${confirmation} pnpm db:reset contra ${redactUrl(url)}.`,
    );
  }

  const { sql } = connectDirect();

  printTitle('Reset del proyecto de desarrollo');
  printDetail(`Destino: ${redactUrl(url)}`);
  printDetail(
    'Se eliminarán los esquemas public, app y drizzle (destructivo).',
  );

  try {
    // Primero el registro de migraciones para que un fallo a mitad no deje
    // migraciones marcadas como aplicadas sobre un esquema vacío.
    await sql`drop schema if exists drizzle cascade`;
    await sql`drop schema if exists app cascade`;
    await sql`drop schema if exists public cascade`;
    await sql`create schema public`;

    // En PostgreSQL 15+ el esquema `public` pertenece a `pg_database_owner`.
    // Se restaura cuando el rol existe para no cambiar el propietario por el
    // rol que ejecuta las migraciones.
    const [databaseOwner] = await sql`
      select exists (
        select 1 from pg_roles where rolname = 'pg_database_owner'
      ) as exists
    `;

    if (databaseOwner.exists) {
      await sql`alter schema public owner to pg_database_owner`;
    }

    // En Supabase el rol `authenticated` ya existe; en un PostgreSQL local sin
    // Supabase se omite para no fallar antes de llegar a las migraciones.
    const [authenticated] = await sql`
      select exists (
        select 1 from pg_roles where rolname = 'authenticated'
      ) as exists
    `;

    if (authenticated.exists) {
      await sql`grant usage on schema public to authenticated`;
    }

    printOk(
      'Esquemas public, app y drizzle eliminados; public recreado y vacío',
    );
    printDetail('Siguiente paso: pnpm db:migrate y después pnpm db:seed.');
  } finally {
    await closeConnection(sql);
  }
});
