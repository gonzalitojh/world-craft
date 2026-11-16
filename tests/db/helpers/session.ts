/**
 * Sesión de usuario para las pruebas de RLS.
 *
 * Cada llamada abre una transacción, cambia al rol `authenticated`, inyecta el
 * claim `sub` que lee `auth.uid()` y **siempre revierte** al terminar. Así las
 * pruebas no dejan filas de usuario y pueden ejecutarse en cualquier orden.
 *
 * Los fixtures que deben sobrevivir entre varias llamadas (usuarios, mundos,
 * contenido) se crean antes con la conexión privilegiada.
 */
import type { TransactionSql } from 'postgres';

import { getClient } from './client';

/** Marca el final de la transacción de usuario para forzar el rollback. */
const ROLLBACK = Symbol('rollback');

/**
 * Ejecuta `fn` como el usuario indicado y revierte la transacción.
 *
 * Comprueba que `set local role` y `auth.uid()` funcionan antes de ceder el
 * control: un fallo de configuración no debe parecer un fallo de política.
 */
export async function asUser<T>(
  userId: string,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  const sql = getClient();
  let result: T | undefined;

  try {
    await sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;

      const [session] = await tx<{ uid: string | null; role: string }[]>`
        select auth.uid()::text as uid, current_user as role
      `;

      if (session?.uid !== userId) {
        throw new Error(
          `auth.uid() devolvió ${session?.uid ?? 'null'}; revisa la simulación de sesión`,
        );
      }

      result = await fn(tx);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) {
      throw error;
    }
  }

  return result as T;
}

/** Comprueba si un error es de PostgreSQL con el código indicado. */
export function hasPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * Exige que una operación falle por falta de privilegios o de política.
 *
 * PostgreSQL devuelve `42501` (insufficient_privilege) cuando falta el grant.
 * Una política `using` que no deja ver filas no lanza: devuelve 0 filas, y eso
 * se comprueba con una lectura normal.
 */
export async function expectPermissionDenied(
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (hasPgCode(error, '42501')) {
      return;
    }

    throw error;
  }

  throw new Error(
    'Se esperaba un error de permisos (42501) y la operación pasó',
  );
}

/** Exige una violación de restricción `check`. */
export async function expectCheckViolation(
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (hasPgCode(error, '23514')) {
      return;
    }

    throw error;
  }

  throw new Error('Se esperaba una violación de check (23514)');
}

/** Exige una violación de unicidad. */
export async function expectUniqueViolation(
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (hasPgCode(error, '23505')) {
      return;
    }

    throw error;
  }

  throw new Error('Se esperaba una violación de unicidad (23505)');
}
