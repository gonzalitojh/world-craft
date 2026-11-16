/**
 * Comprueba que el proyecto tiene el esquema aprobado: tablas, enums,
 * extensiones, búsqueda y migraciones registradas.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { closeClient, first, getClient } from './helpers/client';

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

const ENUMS = [
  'content_status',
  'game_table_category',
  'invitation_role',
  'manuscript_kind',
  'theme_preference',
  'world_role',
  'world_status',
];

const journal = JSON.parse(
  readFileSync(resolve('drizzle/meta/_journal.json'), 'utf8'),
) as { entries: { tag: string }[] };

afterAll(async () => {
  await closeClient();
});

describe('esquema aplicado', () => {
  it('tiene las 24 tablas de public', async () => {
    const rows = await getClient()<{ name: string }[]>`
      select table_name as name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `;

    expect(rows.map((row) => row.name)).toEqual(TABLES);
  });

  it('tiene los siete enums', async () => {
    const rows = await getClient()<{ name: string }[]>`
      select t.typname as name
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typtype = 'e'
      order by t.typname
    `;

    expect(rows.map((row) => row.name)).toEqual(ENUMS);
  });

  it('registra las siete migraciones del journal', async () => {
    const row = first(
      await getClient()<{ count: number }[]>`
        select count(*)::int as count from drizzle.__drizzle_migrations
      `,
    );

    expect(row.count).toBe(journal.entries.length);
  });

  it('instala pg_trgm en el esquema extensions', async () => {
    const row = first(
      await getClient()<{ schema: string }[]>`
        select n.nspname as schema
        from pg_extension e
        join pg_namespace n on n.oid = e.extnamespace
        where e.extname = 'pg_trgm'
      `,
    );

    expect(row.schema).toBe('extensions');
  });

  it('entities.search_vector es un tsvector generado', async () => {
    const row = first(
      await getClient()<{ type: string; generated: string }[]>`
        select data_type as type, is_generated as generated
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'entities'
          and column_name = 'search_vector'
      `,
    );

    expect(row.type).toBe('tsvector');
    expect(row.generated).toBe('ALWAYS');
  });

  it('mantiene los índices GIN de búsqueda', async () => {
    const rows = await getClient()<{ name: string }[]>`
      select indexname as name
      from pg_indexes
      where schemaname = 'public' and tablename = 'entities'
    `;
    const names = rows.map((row) => row.name);

    expect(names).toContain('entities_search_vector_idx');
    expect(names).toContain('entities_name_trgm_idx');
    expect(names).toContain('entities_aliases_trgm_idx');
  });

  it('todas las tablas tienen RLS activa', async () => {
    const rows = await getClient()<{ name: string }[]>`
      select c.relname as name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `;

    expect(rows).toEqual([]);
  });
});
