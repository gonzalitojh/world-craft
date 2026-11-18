/**
 * Cliente de datos que comparte el proceso principal.
 *
 * Expone la conexión de better-sqlite3 (para migraciones, copias y pragmas) y
 * la instancia de Drizzle ORM tipada con el esquema. Las futuras consultas de
 * dominio usan `orm`; el SQL directo queda reservado a infraestructura.
 */
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';

import type { SqliteDatabase } from './connection';
import * as schema from './schema';

/** ORM tipado con el esquema local. */
export type WorldCraftDatabase = BetterSQLite3Database<typeof schema>;

/** Conexión única del proceso principal. */
export interface DatabaseClient {
  readonly sqlite: SqliteDatabase;
  readonly orm: WorldCraftDatabase;
}

/** Crea el cliente de datos sobre una conexión ya configurada. */
export function createDatabaseClient(sqlite: SqliteDatabase): DatabaseClient {
  return {
    sqlite,
    orm: drizzle(sqlite, { schema }),
  };
}
