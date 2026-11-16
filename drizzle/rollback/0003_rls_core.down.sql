-- Rollback de 0003_rls_core.sql
--
-- Desactivar la RLS deja las tablas accesibles a quien tenga privilegios de
-- tabla. En desarrollo sirve para volver al estado anterior; en producción no se
-- usa: se corrige con una migración hacia delante.

-- Perfiles
drop policy if exists profiles_select_self_or_shared on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
alter table public.profiles disable row level security;

-- Allowlist
alter table public.allowed_emails disable row level security;

-- Mundos
drop policy if exists worlds_select_member on public.worlds;
drop policy if exists worlds_insert_own on public.worlds;
drop policy if exists worlds_update_owner on public.worlds;
alter table public.worlds disable row level security;

-- Miembros
drop policy if exists world_members_select_member on public.world_members;
drop policy if exists world_members_insert_owner on public.world_members;
drop policy if exists world_members_update_owner on public.world_members;
drop policy if exists world_members_delete_owner on public.world_members;
alter table public.world_members disable row level security;

-- Invitaciones
drop policy if exists world_invitations_select_owner on public.world_invitations;
drop policy if exists world_invitations_insert_owner on public.world_invitations;
drop policy if exists world_invitations_update_owner on public.world_invitations;
drop policy if exists world_invitations_delete_owner on public.world_invitations;
alter table public.world_invitations disable row level security;
