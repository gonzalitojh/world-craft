-- 0005 — RLS del juego creativo y del registro de actividad.
--
-- El contenido del sistema (`world_id` nulo) es legible por cualquier usuario
-- autenticado y no lo puede escribir un cliente. Las tablas y packs de un mundo
-- siguen la regla editor/owner. Las sesiones son privadas incluso dentro del
-- mundo y `activity_log` es append-only.

-- ---------------------------------------------------------------------------
-- Packs de contenido
-- ---------------------------------------------------------------------------

alter table public.game_content_packs enable row level security;

create policy game_content_packs_select_member on public.game_content_packs
  for select to authenticated
  using (world_id is null or app.is_world_member(world_id));

create policy game_content_packs_insert_world_editor on public.game_content_packs
  for insert to authenticated
  with check (world_id is not null and app.can_edit_world(world_id));

create policy game_content_packs_update_world_editor on public.game_content_packs
  for update to authenticated
  using (world_id is not null and app.can_edit_world(world_id))
  with check (world_id is not null and app.can_edit_world(world_id));

create policy game_content_packs_delete_world_editor on public.game_content_packs
  for delete to authenticated
  using (world_id is not null and app.can_edit_world(world_id));

-- ---------------------------------------------------------------------------
-- Tablas del juego
-- ---------------------------------------------------------------------------

alter table public.game_tables enable row level security;

create policy game_tables_select_member on public.game_tables
  for select to authenticated
  using (world_id is null or app.is_world_member(world_id));

-- Una tabla del sistema no se puede escribir desde el cliente: la condición
-- `world_id is not null` lo impide aunque llegue un privilegio por error.
create policy game_tables_insert_world_editor on public.game_tables
  for insert to authenticated
  with check (
    world_id is not null
    and app.can_edit_world(world_id)
    and is_editable
  );

create policy game_tables_update_world_editor on public.game_tables
  for update to authenticated
  using (
    world_id is not null
    and app.can_edit_world(world_id)
    and is_editable
  )
  with check (
    world_id is not null
    and app.can_edit_world(world_id)
    and is_editable
  );

create policy game_tables_delete_world_editor on public.game_tables
  for delete to authenticated
  using (
    world_id is not null
    and app.can_edit_world(world_id)
    and is_editable
  );

-- ---------------------------------------------------------------------------
-- Entradas de tabla
-- ---------------------------------------------------------------------------

alter table public.game_table_entries enable row level security;

-- Las entradas no llevan `world_id`: heredan el ámbito de su tabla. Si la tabla
-- es global, la entrada es legible por cualquier usuario autenticado.
create policy game_table_entries_select_member on public.game_table_entries
  for select to authenticated
  using (
    app.game_table_world_id(table_id) is null
    or app.is_world_member(app.game_table_world_id(table_id))
  );

create policy game_table_entries_insert_world_editor on public.game_table_entries
  for insert to authenticated
  with check (app.can_edit_world(app.game_table_world_id(table_id)));

create policy game_table_entries_update_world_editor on public.game_table_entries
  for update to authenticated
  using (app.can_edit_world(app.game_table_world_id(table_id)))
  with check (app.can_edit_world(app.game_table_world_id(table_id)));

create policy game_table_entries_delete_world_editor on public.game_table_entries
  for delete to authenticated
  using (app.can_edit_world(app.game_table_world_id(table_id)));

-- ---------------------------------------------------------------------------
-- Sesiones de juego
-- ---------------------------------------------------------------------------

alter table public.game_sessions enable row level security;

-- Cada usuario ve solo sus tiradas mientras siga siendo miembro del mundo: el
-- `owner` del mundo no ve las ajenas.
create policy game_sessions_select_own on public.game_sessions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and app.is_world_member(world_id)
  );

create policy game_sessions_insert_own on public.game_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and app.is_world_member(world_id)
  );

create policy game_sessions_delete_own on public.game_sessions
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and app.is_world_member(world_id)
  );

-- Sin política de UPDATE: una tirada no se reescribe.

-- ---------------------------------------------------------------------------
-- Registro de actividad
-- ---------------------------------------------------------------------------

alter table public.activity_log enable row level security;

create policy activity_log_select_editor on public.activity_log
  for select to authenticated
  using (app.can_edit_world(world_id));

create policy activity_log_insert_editor on public.activity_log
  for insert to authenticated
  with check (
    app.can_edit_world(world_id)
    and user_id = (select auth.uid())
  );

-- Sin UPDATE ni DELETE: append-only.
