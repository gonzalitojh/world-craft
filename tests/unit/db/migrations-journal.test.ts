import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const root = fileURLToPath(new URL('../../../', import.meta.url));
const drizzleDir = resolve(root, 'drizzle');
const journalPath = resolve(drizzleDir, 'meta/_journal.json');

function readJournal(): Journal {
  return JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
}

describe('journal de migraciones', () => {
  it('declara PostgreSQL y siete migraciones', () => {
    const journal = readJournal();

    expect(journal.dialect).toBe('postgresql');
    expect(journal.entries).toHaveLength(7);
  });

  it('numera las entradas de forma contigua desde cero', () => {
    const { entries } = readJournal();

    expect(entries.map((entry) => entry.idx)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('ordena las entradas por fecha creciente', () => {
    const { entries } = readJournal();

    for (let index = 1; index < entries.length; index += 1) {
      expect(entries[index]!.when).toBeGreaterThan(entries[index - 1]!.when);
    }
  });

  it('cada entrada apunta a un archivo SQL existente y no vacío', () => {
    for (const entry of readJournal().entries) {
      const file = resolve(drizzleDir, `${entry.tag}.sql`);

      expect(existsSync(file), `falta ${entry.tag}.sql`).toBe(true);
      expect(
        statSync(file).size,
        `${entry.tag}.sql está vacío`,
      ).toBeGreaterThan(0);
    }
  });

  it('cada migración tiene un rollback documentado', () => {
    for (const entry of readJournal().entries) {
      const rollback = resolve(drizzleDir, 'rollback', `${entry.tag}.down.sql`);

      expect(existsSync(rollback), `falta el rollback de ${entry.tag}`).toBe(
        true,
      );
    }
  });

  it('el rollback de cada migración no está vacío', () => {
    for (const entry of readJournal().entries) {
      const rollback = resolve(drizzleDir, 'rollback', `${entry.tag}.down.sql`);

      expect(statSync(rollback).size).toBeGreaterThan(0);
    }
  });

  it('no hay archivos SQL fuera del journal', () => {
    const journalTags = new Set(
      readJournal().entries.map((entry) => `${entry.tag}.sql`),
    );
    const sqlFiles = [
      '0000_extensions_and_schemas.sql',
      '0001_schema.sql',
      '0002_functions_and_triggers.sql',
      '0003_rls_core.sql',
      '0004_rls_content.sql',
      '0005_rls_game_and_activity.sql',
      '0006_grants.sql',
    ];

    for (const file of sqlFiles) {
      expect(journalTags).toContain(file);
    }
  });
});
