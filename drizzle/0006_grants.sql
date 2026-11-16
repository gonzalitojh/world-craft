-- 0006 — Privilegios mínimos y cierre por defecto.
--
-- Supabase concede privilegios amplios a `anon` y `authenticated` en el esquema
-- `public`. Aquí se retiran todos y se conceden por tabla y operación según la
-- matriz de RLS aprobada. El objetivo es **fail-closed**: una tabla nueva nace
-- cerrada y obliga a concederla a mano.
--
-- Los privilegios de columna (`update (columna)`) son la segunda mitad del
-- control: la RLS decide qué filas se pueden tocar y el privilegio decide qué
-- columnas. Así `worlds.owner_id` y `assets.path` no se pueden reescribir desde
-- el cliente aunque la política lo permita.

-- ---------------------------------------------------------------------------
-- 1. Cierre por defecto
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- `anon` no necesita ni el esquema: la aplicación es privada y sin contenido
-- público (ADR 0011). En PostgreSQL 15+ `PUBLIC` conserva `USAGE` sobre
-- `public`, así que se revoca también a `PUBLIC` y se concede explícitamente a
-- los roles que sí lo necesitan; de lo contrario `anon` lo heredaría.
revoke usage on schema public from public, anon;
grant usage on schema public to authenticated, service_role, authenticator;

-- ---------------------------------------------------------------------------
-- 2. Funciones del esquema `app`
-- ---------------------------------------------------------------------------

revoke all on all functions in schema app from public, anon;
grant usage on schema app to service_role;

-- Helpers usados en políticas y en los módulos de datos.
grant execute on function app.immutable_array_to_string(text[], text) to authenticated, service_role;
grant execute on function app.world_role(uuid) to authenticated;
grant execute on function app.is_world_member(uuid) to authenticated;
grant execute on function app.can_edit_world(uuid) to authenticated;
grant execute on function app.is_world_owner(uuid) to authenticated;
grant execute on function app.shares_world_with(uuid) to authenticated;
grant execute on function app.entity_world_id(uuid) to authenticated;
grant execute on function app.tag_world_id(uuid) to authenticated;
grant execute on function app.map_world_id(uuid) to authenticated;
grant execute on function app.manuscript_world_id(uuid) to authenticated;
grant execute on function app.book_world_id(uuid) to authenticated;
grant execute on function app.chapter_world_id(uuid) to authenticated;
grant execute on function app.scene_world_id(uuid) to authenticated;
grant execute on function app.game_table_world_id(uuid) to authenticated;

-- Operación expuesta: transferir la propiedad de un mundo.
grant execute on function app.transfer_world_ownership(uuid, uuid) to authenticated;

-- Los trigger functions no se invocan a mano y no se conceden.

-- ---------------------------------------------------------------------------
-- 3. Privilegios por tabla y operación
-- ---------------------------------------------------------------------------

-- Perfiles: lectura propia y de compañeros, alta propia y edición propia.
grant select, insert, update on public.profiles to authenticated;

-- Allowlist: **sin privilegios**. Solo el servidor administrativo.

-- Mundos: lectura para miembros; `insert` para crear los propios y `update` por
-- columnas para que `owner_id` no se pueda reescribir.
grant select, insert on public.worlds to authenticated;
grant update (
  name,
  slug,
  summary,
  description,
  cover_asset_id,
  genres,
  status,
  settings,
  archived_at,
  updated_at
) on public.worlds to authenticated;

-- Membresías e invitaciones: gestión del propietario (la RLS lo limita).
grant select, insert, update, delete on public.world_members to authenticated;
grant select, insert, update, delete on public.world_invitations to authenticated;

-- Taxonomías, fichas y relaciones.
grant select, insert, update, delete on public.entity_types to authenticated;
grant select, insert, update, delete on public.relation_types to authenticated;
grant select, insert, update, delete on public.entities to authenticated;
grant select, insert, update, delete on public.relations to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, delete on public.entity_tags to authenticated;

-- Assets: los metadatos los fija la subida; el cliente solo edita `alt`.
grant select, insert, delete on public.assets to authenticated;
grant update (alt) on public.assets to authenticated;

-- Mapas y vínculos.
grant select, insert, update, delete on public.maps to authenticated;
grant select, insert, update, delete on public.map_entity_links to authenticated;

-- Manuscritos y jerarquía de escritura.
grant select, insert, update, delete on public.manuscripts to authenticated;
grant select, insert, update, delete on public.books to authenticated;
grant select, insert, update, delete on public.chapters to authenticated;
grant select, insert, update, delete on public.scenes to authenticated;

-- Versiones de escena: append-only.
grant select, insert on public.scene_versions to authenticated;

-- Juego creativo.
grant select, insert, update, delete on public.game_content_packs to authenticated;
grant select, insert, update, delete on public.game_tables to authenticated;
grant select, insert, update, delete on public.game_table_entries to authenticated;
grant select, insert, delete on public.game_sessions to authenticated;

-- Actividad: append-only.
grant select, insert on public.activity_log to authenticated;
grant usage on sequence public.activity_log_id_seq to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Recarga del esquema en la Data API
-- ---------------------------------------------------------------------------

-- PostgREST cachea el esquema; sin esto, los privilegios nuevos tardan en
-- aplicarse a las peticiones.
notify pgrst, 'reload schema';
