import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getTableName, type Table } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import * as schema from '@/lib/db/schema';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const drizzleDir = resolve(root, 'drizzle');

const TABLES = [
  'activity_log',
  'allowed_emails',
  'assets',
  'books',
  'chapters',
  'entities',
  'entity_tags',
  'entity_types',
  'game_content_packs',
  'game_sessions',
  'game_table_entries',
  'game_tables',
  'manuscripts',
  'map_entity_links',
  'maps',
  'profiles',
  'relation_types',
  'relations',
  'scene_versions',
  'scenes',
  'tags',
  'world_invitations',
  'world_members',
  'worlds',
];

const MIGRATIONS = [
  '0000_extensions_and_schemas.sql',
  '0001_schema.sql',
  '0002_functions_and_triggers.sql',
  '0003_rls_core.sql',
  '0004_rls_content.sql',
  '0005_rls_game_and_activity.sql',
  '0006_grants.sql',
];

function readMigration(name: string): string {
  return readFileSync(resolve(drizzleDir, name), 'utf8');
}

const schemaSql = readMigration('0001_schema.sql');
const functionsSql = readMigration('0002_functions_and_triggers.sql');
const rlsSql = [
  '0003_rls_core.sql',
  '0004_rls_content.sql',
  '0005_rls_game_and_activity.sql',
].map(readMigration);
const rls = rlsSql.join('\n');
const grantsSql = readMigration('0006_grants.sql');
const allSql = MIGRATIONS.map(readMigration).join('\n');

/** Tablas exportadas por el índice del esquema Drizzle. */
function exportedTableNames(): string[] {
  const names: string[] = [];

  for (const value of Object.values(schema)) {
    try {
      const name = getTableName(value as Table);

      if (typeof name === 'string' && name.length > 0) {
        names.push(name);
      }
    } catch {
      // Los enums y otros objetos exportados no son tablas.
    }
  }

  return names;
}

describe('cobertura del esquema', () => {
  it('exporta exactamente las 24 tablas del plan', () => {
    const exported = exportedTableNames();

    expect(new Set(exported)).toEqual(new Set(TABLES));
    expect(exported).toHaveLength(TABLES.length);
  });

  it('la migración generada crea cada tabla', () => {
    for (const table of TABLES) {
      expect(schemaSql, `falta la tabla ${table}`).toContain(
        `CREATE TABLE "${table}"`,
      );
    }
  });

  it('activa RLS en las 24 tablas', () => {
    for (const table of TABLES) {
      expect(rls).toMatch(
        new RegExp(
          `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
          'i',
        ),
      );
    }
  });

  it('cada tabla tiene al menos una política salvo allowed_emails', () => {
    for (const table of TABLES.filter((name) => name !== 'allowed_emails')) {
      expect(rls, `${table} no tiene políticas`).toMatch(
        new RegExp(
          `create\\s+policy\\s+\\S+\\s+on\\s+public\\.${table}\\b`,
          'i',
        ),
      );
    }
  });

  it('allowed_emails no expone ninguna política', () => {
    expect(rls).not.toMatch(
      /create\s+policy\s+\S+\s+on\s+public\.allowed_emails\b/i,
    );
  });

  it('todas las funciones security definer fijan search_path vacío', () => {
    // El primer bloque es la cabecera del archivo; el resto, cada función.
    const [, ...blocks] = functionsSql.split(
      /create\s+or\s+replace\s+function/i,
    );
    const definerBlocks = blocks.filter((block) =>
      /security\s+definer/i.test(block),
    );

    expect(definerBlocks.length).toBeGreaterThan(0);

    for (const block of definerBlocks) {
      expect(block).toMatch(/set\s+search_path\s*=\s*''/i);
    }
  });

  it('ninguna migración concede privilegios a anon', () => {
    expect(allSql).not.toMatch(/(?:^|\n)\s*grant\b[^;]*\bto\b[^;]*\banon\b/i);
  });

  it('los privilegios de allowed_emails no se conceden nunca', () => {
    expect(grantsSql).not.toMatch(/grant[^;]*\bon\s+public\.allowed_emails\b/i);
  });

  it('0006 cierra los privilegios por defecto y recarga la Data API', () => {
    expect(grantsSql).toMatch(
      /revoke\s+all\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon,\s*authenticated/i,
    );
    expect(grantsSql).toMatch(
      /alter\s+default\s+privileges\s+in\s+schema\s+public\s+revoke\s+all\s+on\s+tables/i,
    );
    expect(grantsSql).toMatch(/notify\s+pgrst,\s*'reload schema'/i);
    expect(grantsSql).toMatch(
      /revoke\s+usage\s+on\s+schema\s+public\s+from\s+public,\s*anon/i,
    );
    expect(grantsSql).toMatch(
      /grant\s+usage\s+on\s+schema\s+public\s+to\s+authenticated,\s*service_role,\s*authenticator/i,
    );
  });

  it('0000 instala pg_trgm en extensions y crea el esquema app', () => {
    const extensions = readMigration('0000_extensions_and_schemas.sql');

    expect(extensions).toMatch(
      /create\s+extension\s+if\s+not\s+exists\s+pg_trgm\s+with\s+schema\s+extensions/i,
    );
    expect(extensions).toMatch(/create\s+schema\s+if\s+not\s+exists\s+app/i);
    expect(extensions).toMatch(
      /create\s+or\s+replace\s+function\s+app\.immutable_array_to_string\(text\[\],\s*text\)[\s\S]*immutable/i,
    );
  });

  it('entities usa FTS en español y tres índices GIN', () => {
    expect(schemaSql).toMatch(/search_vector/);
    expect(schemaSql).toMatch(/to_tsvector\('spanish'/);
    expect(schemaSql).toMatch(
      /"search_vector"\s+"tsvector"\s+GENERATED\s+ALWAYS\s+AS[\s\S]*?app\.immutable_array_to_string/i,
    );
    expect(schemaSql).toMatch(
      /create\s+index\s+"entities_search_vector_idx"[^;]*using\s+gin/i,
    );
    expect(schemaSql).toMatch(
      /create\s+index\s+"entities_name_trgm_idx"[^;]*extensions\.gin_trgm_ops/i,
    );
    expect(schemaSql).toMatch(
      /create\s+index\s+"entities_aliases_trgm_idx"[^;]*app\.immutable_array_to_string\([^;]*extensions\.gin_trgm_ops/i,
    );
  });
});
