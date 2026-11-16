/**
 * `db:verify` — comprueba que el proyecto aplicado coincide con el modelo.
 *
 * No modifica nada. Verifica:
 * 1. El journal de Drizzle frente a `drizzle.__drizzle_migrations`.
 * 2. Las 24 tablas, los 7 enums, `pg_trgm` y la columna FTS con sus índices.
 * 3. RLS activa en todas las tablas y al menos una política por tabla.
 * 4. `anon` sin privilegios; `authenticated` con la matriz mínima aprobada.
 * 5. El seed del sistema con 12 tipos de entidad y 15 de relación.
 *
 * Devuelve código de salida 1 si alguna comprobación falla.
 */
import {
  closeConnection,
  connectDirect,
  printDetail,
  printFail,
  printOk,
  printTitle,
  redactUrl,
  readJournal,
  runScript,
} from './lib.mjs';

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

const ENTITIES_FTS_INDEXES = [
  'entities_aliases_trgm_idx',
  'entities_name_trgm_idx',
  'entities_search_vector_idx',
];

/** Compara dos listas y lanza con las diferencias. */
function assertSameSet(actual, expected, label) {
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label}: faltan [${missing.join(', ') || '—'}]; sobran [${extra.join(', ') || '—'}]`,
    );
  }

  return `${actual.length} ${label}`;
}

/** Exige que una lista esté vacía. */
function assertEmpty(rows, message) {
  if (rows.length > 0) {
    throw new Error(`${message}: ${rows.map((row) => row.name).join(', ')}`);
  }
}

await runScript('db:verify', async () => {
  const { sql, url } = connectDirect();
  const journal = readJournal();
  let failures = 0;

  printTitle('Verificación del modelo de datos');
  printDetail(`Destino: ${redactUrl(url)}`);

  /**
   * Ejecuta una comprobación y traduce el resultado a la salida del script.
   * La función devuelve un detalle legible o lanza un error.
   */
  async function check(label, fn) {
    try {
      const detail = await fn();
      printOk(detail ? `${label} — ${detail}` : label);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      printFail(`${label}: ${message}`);
    }
  }

  try {
    await check('Migraciones aplicadas', async () => {
      try {
        const [row] = await sql`
          select count(*)::int as count from drizzle.__drizzle_migrations
        `;

        if (row.count !== journal.entries.length) {
          throw new Error(
            `hay ${row.count} registradas y el journal tiene ${journal.entries.length}`,
          );
        }

        return `${row.count} de ${journal.entries.length}`;
      } catch (error) {
        if (error?.code === '42P01') {
          throw new Error(
            'no existe drizzle.__drizzle_migrations; aplica pnpm db:migrate',
            { cause: error },
          );
        }
        throw error;
      }
    });

    await check('Tablas de public', async () => {
      const rows = await sql`
        select table_name as name
        from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name
      `;
      return assertSameSet(
        rows.map((row) => row.name),
        TABLES,
        'tablas',
      );
    });

    await check('Enums', async () => {
      const rows = await sql`
        select t.typname as name
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'
        order by t.typname
      `;
      return assertSameSet(
        rows.map((row) => row.name),
        ENUMS,
        'enums',
      );
    });

    await check('Extensión pg_trgm', async () => {
      const rows = await sql`
        select n.nspname as schema
        from pg_extension e
        join pg_namespace n on n.oid = e.extnamespace
        where e.extname = 'pg_trgm'
      `;

      if (rows.length === 0) {
        throw new Error('no está instalada');
      }

      if (rows[0].schema !== 'extensions') {
        throw new Error(
          `está en el esquema ${rows[0].schema}, se esperaba extensions`,
        );
      }

      return 'instalada en extensions';
    });

    await check('Búsqueda de entidades', async () => {
      const [column] = await sql`
        select data_type as type
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'entities'
          and column_name = 'search_vector'
      `;

      if (column?.type !== 'tsvector') {
        throw new Error('entities.search_vector no es tsvector');
      }

      const rows = await sql`
        select indexname as name
        from pg_indexes
        where schemaname = 'public' and tablename = 'entities'
      `;

      assertSameSet(
        rows
          .map((row) => row.name)
          .filter((name) => ENTITIES_FTS_INDEXES.includes(name)),
        ENTITIES_FTS_INDEXES,
        'índices GIN',
      );

      return 'search_vector + 3 índices GIN';
    });

    await check('RLS activa', async () => {
      const rows = await sql`
        select c.relname as name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      `;
      assertEmpty(rows, 'tablas sin RLS');
      return `${TABLES.length} tablas`;
    });

    await check('Políticas', async () => {
      const rows = await sql`
        select tablename as name, count(*)::int as count
        from pg_policies
        where schemaname = 'public'
        group by tablename
      `;
      const covered = new Map(rows.map((row) => [row.name, row.count]));
      const missing = TABLES.filter(
        (table) => table !== 'allowed_emails' && !covered.has(table),
      );

      if (missing.length > 0) {
        throw new Error(`sin políticas: ${missing.join(', ')}`);
      }

      return `${covered.size} tablas con políticas`;
    });

    await check('Privilegios de anon', async () => {
      const rows = await sql`
        select table_name as name
        from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public'
      `;
      assertEmpty(rows, 'tablas con privilegios para anon');

      const [schema] = await sql`
        select has_schema_privilege('anon', 'public', 'usage') as has
      `;

      if (schema.has) {
        throw new Error('anon conserva usage sobre el esquema public');
      }

      return 'sin privilegios';
    });

    await check('Privilegios de authenticated', async () => {
      const [matrix] = await sql`
        select
          has_table_privilege('authenticated', 'public.allowed_emails', 'select') as allowed_emails_select,
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
      `;

      const expected = {
        allowed_emails_select: false,
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
      };

      const wrong = Object.entries(expected).filter(
        ([key, value]) => matrix[key] !== value,
      );

      if (wrong.length > 0) {
        throw new Error(
          wrong.map(([key, value]) => `${key} debería ser ${value}`).join('; '),
        );
      }

      return 'matriz mínima correcta';
    });

    await check('Funciones security definer', async () => {
      const rows = await sql`
        select p.proname as name
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app'
          and (
            not p.prosecdef
            or p.proconfig is null
            or not (p.proconfig::text like '%search_path=%')
          )
      `;
      assertEmpty(rows, 'funciones sin security definer o sin search_path');
      return 'todas con security definer y search_path';
    });

    await check('Seed del sistema', async () => {
      const [entityTypes] = await sql`
        select count(*)::int as count
        from public.entity_types
        where world_id is null and is_system
      `;
      const [relationTypes] = await sql`
        select count(*)::int as count
        from public.relation_types
        where world_id is null and is_system
      `;

      if (entityTypes.count !== 12) {
        throw new Error(
          `hay ${entityTypes.count} tipos de entidad, se esperaban 12`,
        );
      }

      if (relationTypes.count !== 15) {
        throw new Error(
          `hay ${relationTypes.count} tipos de relación, se esperaban 15`,
        );
      }

      return '12 tipos de entidad + 15 de relación';
    });
  } finally {
    await closeConnection(sql);
  }

  if (failures > 0) {
    console.error(
      `\n${failures} comprobación(es) fallida(s). Corrige el esquema o vuelve a aplicar las migraciones.`,
    );
    process.exitCode = 1;
  } else {
    console.log('\nModelo de datos verificado.');
  }
});
