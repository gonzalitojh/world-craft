-- 0003 — RLS del núcleo: perfiles, allowlist, mundos, miembros e invitaciones.
--
-- Reglas generales de todas las políticas:
-- - `to authenticated`: `anon` no llega nunca a una tabla de `public`.
-- - `(select auth.uid())` en lugar de `auth.uid()` para que PostgreSQL evalúe
--   el claim una sola vez por consulta (initPlan).
-- - `auth.uid()` nulo no satisface ninguna condición: sin sesión no se ve nada.
-- - Las escrituras denegadas por `with check` o por falta de privilegio lanzan
--   `42501`; las lecturas denegadas por `using` devuelven cero filas.

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Cada usuario ve su perfil y el de sus compañeros de mundo. `settings` no debe
-- contener datos sensibles: lo comparten los miembros del mundo.
create policy profiles_select_self_or_shared on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or app.shares_world_with(id)
  );

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Sin política de DELETE: la cuenta se elimina con un flujo de servidor que
-- exporta los datos antes (regla 7 de `AGENTS.md`).

-- ---------------------------------------------------------------------------
-- Allowlist
-- ---------------------------------------------------------------------------

-- RLS activa y **cero políticas**: nadie con `authenticated` puede leer ni
-- escribir. Además no hay privilegios de tabla (0006), así que el error es
-- `42501` antes de llegar a la política. Solo el servidor administrativo
-- (`postgres` o `service_role`) la gestiona. Así la allowlist no se puede
-- enumerar desde el cliente.
alter table public.allowed_emails enable row level security;

comment on table public.allowed_emails is
  'Allowlist de acceso a la aplicación. Sin políticas RLS: solo el servidor.';

-- ---------------------------------------------------------------------------
-- Mundos
-- ---------------------------------------------------------------------------

alter table public.worlds enable row level security;

-- Un miembro ve su mundo. La condición `owner_id = auth.uid()` cubre el instante
-- de la creación: el trigger `on_world_created` materializa la membresía en la
-- misma transacción, pero `insert ... returning` evalúa la política antes.
create policy worlds_select_member on public.worlds
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or app.is_world_member(id)
  );

-- Cualquier usuario autorizado crea sus propios mundos y es su propietario. No
-- puede crear un mundo a nombre de otra persona.
create policy worlds_insert_own on public.worlds
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- Solo el propietario actualiza el mundo (nombre, resumen, estado, portada…).
-- `owner_id` queda fuera de los privilegios de columna: se cambia solo con
-- `app.transfer_world_ownership`.
create policy worlds_update_owner on public.worlds
  for update to authenticated
  using (app.is_world_owner(id))
  with check (app.is_world_owner(id));

-- Sin política de DELETE: borrar un mundo exige exportación y copia previas
-- (M5). Se usa `archived_at`.

-- ---------------------------------------------------------------------------
-- Miembros
-- ---------------------------------------------------------------------------

alter table public.world_members enable row level security;

-- Todos los miembros ven la lista de miembros: hace falta para el grafo, los
-- avatares y la gestión de roles.
create policy world_members_select_member on public.world_members
  for select to authenticated
  using (app.is_world_member(world_id));

create policy world_members_insert_owner on public.world_members
  for insert to authenticated
  with check (app.is_world_owner(world_id));

create policy world_members_update_owner on public.world_members
  for update to authenticated
  using (app.is_world_owner(world_id))
  with check (app.is_world_owner(world_id));

create policy world_members_delete_owner on public.world_members
  for delete to authenticated
  using (app.is_world_owner(world_id));

-- Los triggers `protect_world_owner` y `assert_owner_membership` impiden que el
-- propietario se elimine o degrade sin transferir y que exista un segundo owner.

-- ---------------------------------------------------------------------------
-- Invitaciones
-- ---------------------------------------------------------------------------

alter table public.world_invitations enable row level security;

-- Solo el propietario ve las invitaciones de su mundo. `token_hash` es un hash
-- SHA-256: no permite aceptar la invitación.
create policy world_invitations_select_owner on public.world_invitations
  for select to authenticated
  using (app.is_world_owner(world_id));

create policy world_invitations_insert_owner on public.world_invitations
  for insert to authenticated
  with check (app.is_world_owner(world_id));

create policy world_invitations_update_owner on public.world_invitations
  for update to authenticated
  using (app.is_world_owner(world_id))
  with check (app.is_world_owner(world_id));

create policy world_invitations_delete_owner on public.world_invitations
  for delete to authenticated
  using (app.is_world_owner(world_id));
