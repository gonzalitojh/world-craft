/**
 * Lectura y validación del journal de migraciones de Drizzle.
 *
 * Drizzle Kit escribe `drizzle/meta/_journal.json` y un `.sql` por entrada. El
 * runner propio no confía en esos archivos: valida el journal con Zod, exige
 * una secuencia sin huecos y calcula el checksum del SQL de cada migración.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { computeSqlChecksum } from './checksum';
import { DatabaseError } from './errors';

/** Etiqueta válida: cuatro dígitos, nombre en snake_case y sin rutas. */
const MIGRATION_TAG_PATTERN = /^\d{4}_[a-z0-9]+(?:_[a-z0-9]+)*$/;

export const migrationJournalEntrySchema = z
  .object({
    idx: z.number().int().nonnegative(),
    version: z.string().min(1),
    when: z.number().int().nonnegative(),
    tag: z.string().regex(MIGRATION_TAG_PATTERN),
    breakpoints: z.boolean().optional(),
  })
  .strict();

export const migrationJournalSchema = z
  .object({
    version: z.string().min(1),
    dialect: z.literal('sqlite'),
    entries: z.array(migrationJournalEntrySchema).min(1),
  })
  .strict();

export type MigrationJournalEntry = z.infer<typeof migrationJournalEntrySchema>;

/** Migración cargada desde disco, con su checksum normalizado. */
export interface LoadedMigration {
  readonly idx: number;
  readonly tag: string;
  readonly checksum: string;
  readonly sql: string;
}

/**
 * Carga el journal y el SQL de todas las migraciones.
 *
 * Lanza `DB_MIGRATION_FAILED` si falta el journal, su formato no es válido, la
 * secuencia tiene huecos o falta el archivo SQL de una entrada.
 */
export function loadMigrations(migrationsDir: string): LoadedMigration[] {
  const journal = readJournal(migrationsDir);

  journal.entries.forEach((entry, index) => {
    const expectedPrefix = String(index).padStart(4, '0');

    if (entry.idx !== index || !entry.tag.startsWith(`${expectedPrefix}_`)) {
      throw new DatabaseError('DB_MIGRATION_FAILED');
    }
  });

  const tags = new Set(journal.entries.map((entry) => entry.tag));

  if (tags.size !== journal.entries.length) {
    throw new DatabaseError('DB_MIGRATION_FAILED');
  }

  return journal.entries.map((entry) => {
    const sql = readMigrationSql(migrationsDir, entry.tag);

    return {
      idx: entry.idx,
      tag: entry.tag,
      checksum: computeSqlChecksum(sql),
      sql,
    };
  });
}

function readJournal(
  migrationsDir: string,
): z.infer<typeof migrationJournalSchema> {
  const journalFile = join(migrationsDir, 'meta', '_journal.json');

  let rawJournal: unknown;

  try {
    rawJournal = JSON.parse(readFileSync(journalFile, 'utf8')) as unknown;
  } catch (error) {
    throw new DatabaseError('DB_MIGRATION_FAILED', { cause: error });
  }

  const parsed = migrationJournalSchema.safeParse(rawJournal);

  if (!parsed.success) {
    throw new DatabaseError('DB_MIGRATION_FAILED', { cause: parsed.error });
  }

  return parsed.data;
}

function readMigrationSql(migrationsDir: string, tag: string): string {
  let sql: string;

  try {
    sql = readFileSync(join(migrationsDir, `${tag}.sql`), 'utf8');
  } catch (error) {
    throw new DatabaseError('DB_MIGRATION_FAILED', { cause: error });
  }

  if (sql.trim().length === 0) {
    throw new DatabaseError('DB_MIGRATION_FAILED');
  }

  return sql;
}
