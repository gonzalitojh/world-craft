/**
 * Matriz de privilegios: `anon` cerrado, `allowed_emails` solo servidor y
 * `authenticated` con los permisos mínimos aprobados.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { closeClient, first, getClient } from './helpers/client';

afterAll(async () => {
  await closeClient();
});

describe('privilegios', () => {
  it('anon no tiene privilegios en ninguna tabla de public', async () => {
    const rows = await getClient()<{ name: string }[]>`
      select table_name as name
      from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public'
    `;

    expect(rows).toEqual([]);
  });

  it('anon no puede usar el esquema public', async () => {
    const row = first(
      await getClient()<{ has: boolean }[]>`
        select has_schema_privilege('anon', 'public', 'usage') as has
      `,
    );

    expect(row.has).toBe(false);
  });

  it('authenticated no puede leer ni escribir allowed_emails', async () => {
    const row = first(
      await getClient()<Record<string, boolean>[]>`
        select
          has_table_privilege('authenticated', 'public.allowed_emails', 'select') as can_select,
          has_table_privilege('authenticated', 'public.allowed_emails', 'insert') as can_insert,
          has_table_privilege('authenticated', 'public.allowed_emails', 'update') as can_update,
          has_table_privilege('authenticated', 'public.allowed_emails', 'delete') as can_delete
      `,
    );

    expect(row).toEqual({
      can_select: false,
      can_insert: false,
      can_update: false,
      can_delete: false,
    });
  });

  it('authenticated conserva la matriz mínima', async () => {
    const row = first(
      await getClient()<Record<string, boolean>[]>`
        select
          has_table_privilege('authenticated', 'public.entities', 'select') as entities_select,
          has_table_privilege('authenticated', 'public.entities', 'insert') as entities_insert,
          has_table_privilege('authenticated', 'public.entities', 'update') as entities_update,
          has_table_privilege('authenticated', 'public.entities', 'delete') as entities_delete,
          has_table_privilege('authenticated', 'public.profiles', 'delete') as profiles_delete,
          has_table_privilege('authenticated', 'public.scene_versions', 'update') as scene_versions_update,
          has_table_privilege('authenticated', 'public.activity_log', 'delete') as activity_delete,
          has_table_privilege('authenticated', 'public.game_sessions', 'update') as game_sessions_update,
          has_column_privilege('authenticated', 'public.worlds', 'name', 'update') as worlds_name_update,
          has_column_privilege('authenticated', 'public.worlds', 'owner_id', 'update') as worlds_owner_update,
          has_column_privilege('authenticated', 'public.assets', 'alt', 'update') as assets_alt_update,
          has_column_privilege('authenticated', 'public.assets', 'path', 'update') as assets_path_update,
          has_sequence_privilege('authenticated', 'public.activity_log_id_seq', 'usage') as activity_sequence,
          has_function_privilege('authenticated', 'app.world_role(uuid)', 'execute') as world_role_execute,
          has_function_privilege('anon', 'app.world_role(uuid)', 'execute') as anon_world_role_execute
      `,
    );

    expect(row).toEqual({
      entities_select: true,
      entities_insert: true,
      entities_update: true,
      entities_delete: true,
      profiles_delete: false,
      scene_versions_update: false,
      activity_delete: false,
      game_sessions_update: false,
      worlds_name_update: true,
      worlds_owner_update: false,
      assets_alt_update: true,
      assets_path_update: false,
      activity_sequence: true,
      world_role_execute: true,
      anon_world_role_execute: false,
    });
  });

  it('una tabla nueva nace cerrada para anon y authenticated', async () => {
    const sql = getClient();

    await sql`drop table if exists public.grants_probe`;
    await sql`create table public.grants_probe (id int primary key)`;

    try {
      const row = first(
        await sql<Record<string, boolean>[]>`
          select
            has_table_privilege('anon', 'public.grants_probe', 'select') as anon_select,
            has_table_privilege('authenticated', 'public.grants_probe', 'select') as authenticated_select
        `,
      );

      expect(row).toEqual({
        anon_select: false,
        authenticated_select: false,
      });
    } finally {
      await sql`drop table if exists public.grants_probe`;
    }
  });
});
