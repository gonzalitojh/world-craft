/**
 * `db:ping` — comprueba que el proyecto de Supabase de desarrollo responde y
 * que la simulación de sesión de usuario funciona.
 *
 * Verifica, sin modificar datos:
 * 1. La conexión con `DIRECT_URL` (pooler de sesión).
 * 2. Que se puede cambiar al rol `authenticated`.
 * 3. Que `auth.uid()` devuelve el claim `sub` inyectado.
 *
 * Es la puerta de entrada antes de aplicar migraciones o ejecutar RLS.
 */
import {
  closeConnection,
  connectDirect,
  printDetail,
  printFail,
  printOk,
  printTitle,
  redactUrl,
  runScript,
} from './lib.mjs';

const PROBE_USER_ID = '00000000-0000-4000-8000-000000000000';

await runScript('db:ping', async () => {
  const { sql, url } = connectDirect();
  let failures = 0;

  printTitle('Conexión a PostgreSQL');
  printDetail(`Destino: ${redactUrl(url)}`);

  try {
    const [server] = await sql`
      select version() as version, current_user as role
    `;

    printOk(`Conectado como ${server.role}`);
    printDetail(server.version);

    try {
      const [probe] = await sql.begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select set_config('request.jwt.claim.sub', ${PROBE_USER_ID}, true)`;
        await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;

        return tx`select auth.uid()::text as uid, current_user as role`;
      });

      if (probe.role === 'authenticated') {
        printOk('El cambio al rol authenticated funciona');
      } else {
        failures += 1;
        printFail(`El rol activo es ${probe.role}, no authenticated`);
      }

      if (probe.uid === PROBE_USER_ID) {
        printOk('auth.uid() devuelve el claim sub inyectado');
      } else {
        failures += 1;
        printFail(`auth.uid() devolvió ${probe.uid ?? 'null'}`);
      }
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      printFail(`No se pudo simular la sesión de usuario: ${message}`);
      printDetail(
        'Comprueba que el proyecto es Supabase (roles anon/authenticated) y que DIRECT_URL apunta al pooler de sesión.',
      );
    }

    if (failures > 0) {
      process.exitCode = 1;
    } else {
      printDetail(
        'Todo listo para aplicar migraciones y ejecutar las pruebas de RLS.',
      );
    }
  } finally {
    await closeConnection(sql);
  }
});
