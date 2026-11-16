-- Rollback de 0005_rls_game_and_activity.sql
--
-- Pensado para desarrollo: en producción se corrige con una migración nueva.

drop policy if exists game_content_packs_select_member on public.game_content_packs;
drop policy if exists game_content_packs_insert_world_editor on public.game_content_packs;
drop policy if exists game_content_packs_update_world_editor on public.game_content_packs;
drop policy if exists game_content_packs_delete_world_editor on public.game_content_packs;
alter table public.game_content_packs disable row level security;

drop policy if exists game_tables_select_member on public.game_tables;
drop policy if exists game_tables_insert_world_editor on public.game_tables;
drop policy if exists game_tables_update_world_editor on public.game_tables;
drop policy if exists game_tables_delete_world_editor on public.game_tables;
alter table public.game_tables disable row level security;

drop policy if exists game_table_entries_select_member on public.game_table_entries;
drop policy if exists game_table_entries_insert_world_editor on public.game_table_entries;
drop policy if exists game_table_entries_update_world_editor on public.game_table_entries;
drop policy if exists game_table_entries_delete_world_editor on public.game_table_entries;
alter table public.game_table_entries disable row level security;

drop policy if exists game_sessions_select_own on public.game_sessions;
drop policy if exists game_sessions_insert_own on public.game_sessions;
drop policy if exists game_sessions_delete_own on public.game_sessions;
alter table public.game_sessions disable row level security;

drop policy if exists activity_log_select_editor on public.activity_log;
drop policy if exists activity_log_insert_editor on public.activity_log;
alter table public.activity_log disable row level security;
