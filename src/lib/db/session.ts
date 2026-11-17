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

/** Opciones de la sesión de usuario. */
export interface UserSessionOptions {
  /**
   * GUCs transaccionales que el servicio fija para las guardas de escritura.
   *
   * Se aplican con `set_config(..., true)` dentro de la misma transacción, de
   * modo que desaparecen al cerrarla. Solo se admiten nombres de variable, no
   * valores: el llamador decide qué contexto declara.
   */
  settings?: Readonly<Record<string, string>>;
}

/** Nombre de GUC admitido: solo el espacio `app.` reservado al servidor. */
const SETTING_NAME_PATTERN = /^app\.[a-z0-9_]{1,55}$/;

/**
 * Comprueba si un nombre de GUC pertenece al espacio `app.` del servidor.
 *
 * Se excluyen `role`, `request.jwt.claim.*` y cualquier variable que pudiera
 * alterar el rol o los claims de la sesión desde un llamador mal usado.
 */
export function isUserSessionSettingName(name: string): boolean {
  return SETTING_NAME_PATTERN.test(name);
}

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
  options: UserSessionOptions = {},
): Promise<T> {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error('withUserSession espera un UUID de usuario válido');
  }

  const settings = Object.entries(options.settings ?? {});

  for (const [name] of settings) {
    if (!isUserSessionSettingName(name)) {
      throw new Error(`Nombre de GUC no válido: ${name}`);
    }
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

      for (const [name, value] of settings) {
        await tx`select set_config(${name}, ${value}, true)`;
      }

      // Drizzle 0.45 lee `options.parsers` y `options.serializers` del cliente
      // para registrar sus parsers de fechas, pero `postgres@4` no expone
      // `options` en el cliente de transacción (`tx`). Envolvemos la
      // transacción con las tres operaciones que Drizzle usa (`unsafe`,
      // `begin` y `savepoint`) y las opciones del cliente raíz, de modo que
      // las consultas sigan ejecutándose dentro del ámbito transaccional con
      // el rol y los claims ya fijados.
      const drizzleClient = {
        options: client.options,
        unsafe: tx.unsafe.bind(tx),
        begin: tx.begin.bind(tx),
        savepoint: tx.savepoint.bind(tx),
      };

      return fn(
        drizzle(drizzleClient as unknown as Sql, {
          schema,
          casing: 'snake_case',
        }),
      );
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}
