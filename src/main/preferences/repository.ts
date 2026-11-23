/**
 * Repositorio Drizzle de preferencias sobre `app_settings`.
 *
 * Solo esta capa habla con SQL. Las filas usan una clave por preferencia y el
 * valor se guarda como JSON serializado. `reset` borra exclusivamente el
 * prefijo `ui.`; el resto de claves de `app_settings` y las tablas de dominio
 * quedan intactas.
 */
import { inArray, sql } from 'drizzle-orm';

import type { WorldCraftDatabase } from '../db/client';
import type { SqliteDatabase } from '../db/connection';
import { appSettings } from '../db/schema';
import { UI_PREFERENCE_GLOB_PATTERN } from './keys';

/**
 * Condición estricta del espacio `ui.` (sensible a mayúsculas).
 *
 * `GLOB` evita que `LIKE` case-insensitive borre o lea una clave `UI.*`.
 */
const uiPreferenceKeyCondition =
  sql`${appSettings.key} GLOB ${UI_PREFERENCE_GLOB_PATTERN}`;

/** Operaciones que necesita el servicio de preferencias. */
export interface PreferencesRepository {
  /** Lee las filas `ui.*` como mapa de clave a JSON crudo. */
  readAll(): Map<string, string>;
  /** Inserta o reemplaza una clave con su marca de tiempo. */
  upsert(key: string, value: string, updatedAt: number): void;
  /** Borra claves exactas; sin claves no ejecuta SQL. */
  deleteKeys(keys: readonly string[]): void;
  /** Borra todas las filas del espacio `ui.`. */
  deleteUiKeys(): void;
  /** Agrupa varias escrituras en una transacción de better-sqlite3. */
  transaction<T>(operation: () => T): T;
}

/** Crea el repositorio sobre la conexión compartida del proceso principal. */
export function createPreferencesRepository(
  database: WorldCraftDatabase,
  sqlite: SqliteDatabase,
): PreferencesRepository {
  return {
    readAll() {
      const rows = database
        .select({ key: appSettings.key, value: appSettings.value })
        .from(appSettings)
        .where(uiPreferenceKeyCondition)
        .all();

      return new Map(rows.map((row) => [row.key, row.value]));
    },

    upsert(key, value, updatedAt) {
      database
        .insert(appSettings)
        .values({ key, value, updatedAt })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedAt },
        })
        .run();
    },

    deleteKeys(keys) {
      if (keys.length === 0) {
        return;
      }

      database
        .delete(appSettings)
        .where(inArray(appSettings.key, [...keys]))
        .run();
    },

    deleteUiKeys() {
      database
        .delete(appSettings)
        .where(uiPreferenceKeyCondition)
        .run();
    },

    transaction(operation) {
      // Drizzle usa la misma conexión de better-sqlite3, así que una
      // transacción nativa agrupa todas las escrituras sin otra capa de datos.
      return sqlite.transaction(operation)();
    },
  };
}
