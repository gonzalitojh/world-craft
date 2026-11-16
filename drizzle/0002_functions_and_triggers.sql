-- 0002 — Integridad con el esquema `auth`, funciones de apoyo y triggers.
--
-- Contenido:
-- 1. Claves foráneas que Drizzle Kit no puede declarar (esquema `auth` de
--    Supabase y el ciclo `worlds` ↔ `assets`).
-- 2. Funciones `app.*`: helpers de rol y de resolución de mundo, y la
--    transferencia atómica de propiedad.
-- 3. Funciones de trigger de integridad y su instalación.
--
-- Todas las funciones del esquema `app` son `security definer` con
-- `search_path = ''` y nombres cualificados. Se ejecutan con los privilegios de
-- su propietario (el rol que aplica las migraciones) y por eso pueden leer
-- `world_members` sin recursión de políticas y escribir en tablas protegidas.
-- Los privilegios de ejecución se conceden en 0006_grants.sql.

-- ---------------------------------------------------------------------------
-- 1. Claves foráneas fuera del alcance de Drizzle Kit
-- ---------------------------------------------------------------------------

-- `profiles.id` es el mismo identificador que `auth.users.id`. Drizzle no
-- gestiona el esquema `auth`, así que la referencia se declara aquí.
alter table public.profiles
  add constraint profiles_id_auth_users_id_fk
  foreign key (id) references auth.users (id) on delete cascade;

-- La portada de un mundo es un asset del propio mundo. La referencia no se
-- declara en el esquema Drizzle para no crear un ciclo de módulos entre
-- `worlds.ts` y `assets.ts`; se añade aquí con el mismo efecto.
alter table public.worlds
  add constraint worlds_cover_asset_id_assets_id_fk
  foreign key (cover_asset_id) references public.assets (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Helpers de rol y de resolución de mundo
-- ---------------------------------------------------------------------------

-- Rol del usuario actual en un mundo; `null` si no es miembro.
create or replace function app.world_role(p_world_id uuid)
returns public.world_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.world_members as m
  where m.world_id = p_world_id
    and m.user_id = auth.uid()
$$;

-- ¿El usuario actual es miembro del mundo (con cualquier rol)?
create or replace function app.is_world_member(p_world_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.world_role(p_world_id) is not null
$$;

-- ¿Puede editar contenido del mundo? (`owner` o `editor`)
create or replace function app.can_edit_world(p_world_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.world_role(p_world_id) in ('owner', 'editor')
$$;

-- ¿Es el propietario del mundo?
create or replace function app.is_world_owner(p_world_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.world_role(p_world_id) = 'owner'
$$;

-- ¿El usuario actual comparte algún mundo con `p_user_id`? Sirve para que un
-- miembro vea el perfil de sus compañeros y solo de ellos.
create or replace function app.shares_world_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.world_members as me
    join public.world_members as other on other.world_id = me.world_id
    where me.user_id = auth.uid()
      and other.user_id = p_user_id
  )
$$;

-- Resolución del mundo de cada tabla hija. Las tablas de primer nivel llevan
-- `world_id` directo; estas funciones recorren la cadena del padre para que las
-- hijas no dupliquen la columna.
create or replace function app.entity_world_id(p_entity_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.world_id from public.entities as e where e.id = p_entity_id
$$;

create or replace function app.tag_world_id(p_tag_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.world_id from public.tags as t where t.id = p_tag_id
$$;

create or replace function app.map_world_id(p_map_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.world_id from public.maps as m where m.id = p_map_id
$$;

create or replace function app.manuscript_world_id(p_manuscript_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.world_id
  from public.manuscripts as m
  where m.id = p_manuscript_id
$$;

create or replace function app.book_world_id(p_book_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.world_id
  from public.books as b
  join public.manuscripts as m on m.id = b.manuscript_id
  where b.id = p_book_id
$$;

create or replace function app.chapter_world_id(p_chapter_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.world_id
  from public.chapters as c
  join public.books as b on b.id = c.book_id
  join public.manuscripts as m on m.id = b.manuscript_id
  where c.id = p_chapter_id
$$;

create or replace function app.scene_world_id(p_scene_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.world_id
  from public.scenes as s
  join public.chapters as c on c.id = s.chapter_id
  join public.books as b on b.id = c.book_id
  join public.manuscripts as m on m.id = b.manuscript_id
  where s.id = p_scene_id
$$;

-- Mundo de una tabla del juego; `null` si es contenido global del sistema.
create or replace function app.game_table_world_id(p_table_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.world_id from public.game_tables as t where t.id = p_table_id
$$;

-- Transferencia atómica de la propiedad de un mundo.
--
-- Solo el `owner` actual puede invocarla y el nuevo propietario debe ser ya
-- miembro. El orden importa: primero cambia `worlds.owner_id` (fuente de
-- verdad) y después ajusta las membresías, de modo que los triggers de
-- protección nunca ven un estado intermedio incoherente.
create or replace function app.transfer_world_ownership(
  p_world_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_owner uuid;
begin
  if v_caller is null then
    raise exception 'transfer_world_ownership requiere una sesión autenticada'
      using errcode = '28000';
  end if;

  select w.owner_id
    into v_owner
    from public.worlds as w
   where w.id = p_world_id
     for update;

  if v_owner is null then
    raise exception 'el mundo % no existe', p_world_id
      using errcode = 'P0002';
  end if;

  if v_owner <> v_caller then
    raise exception 'solo el propietario actual puede transferir el mundo'
      using errcode = '42501';
  end if;

  if p_new_owner_id = v_owner then
    return;
  end if;

  if not exists (
    select 1
      from public.world_members as m
     where m.world_id = p_world_id
       and m.user_id = p_new_owner_id
  ) then
    raise exception 'el nuevo propietario debe ser miembro del mundo'
      using errcode = '23514';
  end if;

  update public.worlds
     set owner_id = p_new_owner_id,
         updated_at = now()
   where id = p_world_id;

  update public.world_members
     set role = 'editor',
         updated_at = now()
   where world_id = p_world_id
     and user_id = v_owner;

  update public.world_members
     set role = 'owner',
         updated_at = now()
   where world_id = p_world_id
     and user_id = p_new_owner_id;

  insert into public.activity_log (world_id, user_id, action, entity_type, entity_id, diff)
  values (
    p_world_id,
    v_caller,
    'world.ownership_transferred',
    'world',
    p_world_id,
    jsonb_build_object('previous_owner_id', v_owner, 'new_owner_id', p_new_owner_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Funciones de trigger
-- ---------------------------------------------------------------------------

-- Mantiene `updated_at` en cada actualización.
create or replace function app.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Crea la membresía `owner` del creador al insertar un mundo. Así el mundo
-- nunca existe sin propietario materializado y la RLS funciona desde la
-- primera lectura.
create or replace function app.on_world_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.world_members (world_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (world_id, user_id) do update set role = 'owner';

  return new;
end;
$$;

-- Impide eliminar o degradar al propietario canónico sin transferir antes.
create or replace function app.protect_world_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select w.owner_id into v_owner from public.worlds as w where w.id = old.world_id;

  if old.role = 'owner' and old.user_id = v_owner then
    if tg_op = 'DELETE' then
      raise exception 'no se puede eliminar al propietario del mundo sin transferir la propiedad'
        using errcode = '23514';
    end if;

    if new.role <> 'owner' or new.user_id <> old.user_id then
      raise exception 'no se puede degradar al propietario del mundo sin transferir la propiedad'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

-- Solo puede existir el rol `owner` para el `worlds.owner_id` vigente.
create or replace function app.assert_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.role = 'owner' then
    select w.owner_id into v_owner from public.worlds as w where w.id = new.world_id;

    if v_owner is distinct from new.user_id then
      raise exception 'solo el propietario del mundo puede tener rol owner'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Impide mover una fila de un mundo a otro en cualquier tabla con `world_id`.
create or replace function app.prevent_world_id_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (to_jsonb(new) -> 'world_id') is distinct from (to_jsonb(old) -> 'world_id') then
    raise exception 'no se puede mover una fila a otro mundo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- El tipo de una ficha debe ser del sistema o del mismo mundo.
create or replace function app.assert_entity_type_world()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type_world uuid;
begin
  select t.world_id into v_type_world from public.entity_types as t where t.id = new.type_id;

  if v_type_world is not null and v_type_world <> new.world_id then
    raise exception 'el tipo de entidad pertenece a otro mundo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Origen, destino y tipo de una relación deben pertenecer al mismo mundo (o
-- ser un tipo del sistema).
create or replace function app.assert_relation_worlds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_world uuid;
  v_target_world uuid;
  v_type_world uuid;
begin
  select e.world_id into v_source_world from public.entities as e where e.id = new.source_id;
  select e.world_id into v_target_world from public.entities as e where e.id = new.target_id;
  select t.world_id into v_type_world from public.relation_types as t where t.id = new.type_id;

  if v_source_world is distinct from new.world_id or v_target_world is distinct from new.world_id then
    raise exception 'los extremos de la relación pertenecen a otro mundo'
      using errcode = '23514';
  end if;

  if v_type_world is not null and v_type_world <> new.world_id then
    raise exception 'el tipo de relación pertenece a otro mundo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Etiqueta y entidad deben ser del mismo mundo.
create or replace function app.assert_entity_tag_world()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_world uuid;
  v_tag_world uuid;
begin
  select e.world_id into v_entity_world from public.entities as e where e.id = new.entity_id;
  select t.world_id into v_tag_world from public.tags as t where t.id = new.tag_id;

  if v_entity_world is distinct from v_tag_world then
    raise exception 'la etiqueta pertenece a otro mundo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Mapa y entidad enlazada deben ser del mismo mundo.
create or replace function app.assert_map_link_world()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_map_world uuid;
  v_entity_world uuid;
begin
  select m.world_id into v_map_world from public.maps as m where m.id = new.map_id;
  select e.world_id into v_entity_world from public.entities as e where e.id = new.entity_id;

  if v_map_world is distinct from v_entity_world then
    raise exception 'la entidad enlazada pertenece a otro mundo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- POV y lugar de una escena deben ser del mundo del manuscrito, que se resuelve
-- por capítulo → libro → manuscrito (la escena aún no es visible en `BEFORE`).
create or replace function app.assert_scene_entities_world()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scene_world uuid;
  v_entity_world uuid;
begin
  select m.world_id
    into v_scene_world
    from public.chapters as c
    join public.books as b on b.id = c.book_id
    join public.manuscripts as m on m.id = b.manuscript_id
   where c.id = new.chapter_id;

  if new.pov_entity_id is not null then
    select e.world_id into v_entity_world from public.entities as e where e.id = new.pov_entity_id;

    if v_entity_world is distinct from v_scene_world then
      raise exception 'el POV de la escena pertenece a otro mundo'
        using errcode = '23514';
    end if;
  end if;

  if new.location_entity_id is not null then
    select e.world_id into v_entity_world from public.entities as e where e.id = new.location_entity_id;

    if v_entity_world is distinct from v_scene_world then
      raise exception 'el lugar de la escena pertenece a otro mundo'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Las entradas heredan el ámbito de su tabla: la RLS restringe las tablas de
-- mundo a sus miembros y este trigger impide que un cliente escriba en tablas
-- de contenido fijo (`is_editable = false`). El servidor y las migraciones
-- siguen pudiendo mantener el contenido del sistema.
create or replace function app.assert_game_entry_world()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_editable boolean;
begin
  select t.is_editable into v_is_editable from public.game_tables as t where t.id = new.table_id;

  if v_is_editable is false and auth.uid() is not null then
    raise exception 'la tabla de juego es de solo lectura'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Instalación de los triggers
-- ---------------------------------------------------------------------------

-- `updated_at` automático.
create trigger set_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.worlds
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.world_members
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.entity_types
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.relation_types
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.tags
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.entities
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.relations
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.maps
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.manuscripts
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.books
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.chapters
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.scenes
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.game_tables
  for each row execute function app.set_updated_at();

-- Propiedad del mundo.
create trigger on_world_created after insert on public.worlds
  for each row execute function app.on_world_created();
create trigger protect_world_owner before update or delete on public.world_members
  for each row execute function app.protect_world_owner();
create trigger assert_owner_membership before insert or update on public.world_members
  for each row execute function app.assert_owner_membership();

-- Inmovilidad del mundo en las tablas de primer nivel.
create trigger prevent_world_id_change before update on public.world_members
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.world_invitations
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.entity_types
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.relations
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.tags
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.entities
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.assets
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.maps
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.manuscripts
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.game_content_packs
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.game_tables
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.game_sessions
  for each row execute function app.prevent_world_id_change();
create trigger prevent_world_id_change before update on public.activity_log
  for each row execute function app.prevent_world_id_change();

-- Coherencia entre mundos.
create trigger assert_entity_type_world before insert or update on public.entities
  for each row execute function app.assert_entity_type_world();
create trigger assert_relation_worlds before insert or update on public.relations
  for each row execute function app.assert_relation_worlds();
create trigger assert_entity_tag_world before insert or update on public.entity_tags
  for each row execute function app.assert_entity_tag_world();
create trigger assert_map_link_world before insert or update on public.map_entity_links
  for each row execute function app.assert_map_link_world();
create trigger assert_scene_entities_world before insert or update on public.scenes
  for each row execute function app.assert_scene_entities_world();
create trigger assert_game_entry_world before insert or update on public.game_table_entries
  for each row execute function app.assert_game_entry_world();
