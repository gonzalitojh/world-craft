-- 0004 — RLS del contenido: taxonomías, fichas, relaciones, etiquetas, assets,
-- mapas y manuscritos.
--
-- Convención:
-- - **Miembro** (cualquier rol) lee.
-- - **Editor u owner** escribe (crea, actualiza y borra).
-- - Las tablas hijas resuelven el mundo con las funciones `app.*_world_id`.
-- - El borrado es lógico (`deleted_at`) en fichas, mapas y escenas: las filas
--   borradas siguen visibles para quien puede editarlas (papelera) y
--   desaparecen para los `viewer`.

-- ---------------------------------------------------------------------------
-- Tipos de entidad y de relación (sistema o de un mundo)
-- ---------------------------------------------------------------------------

alter table public.entity_types enable row level security;

create policy entity_types_select_member on public.entity_types
  for select to authenticated
  using (world_id is null or app.is_world_member(world_id));

create policy entity_types_insert_world_editor on public.entity_types
  for insert to authenticated
  with check (world_id is not null and app.can_edit_world(world_id));

create policy entity_types_update_world_editor on public.entity_types
  for update to authenticated
  using (world_id is not null and app.can_edit_world(world_id))
  with check (world_id is not null and app.can_edit_world(world_id));

create policy entity_types_delete_world_editor on public.entity_types
  for delete to authenticated
  using (world_id is not null and app.can_edit_world(world_id));

alter table public.relation_types enable row level security;

create policy relation_types_select_member on public.relation_types
  for select to authenticated
  using (world_id is null or app.is_world_member(world_id));

create policy relation_types_insert_world_editor on public.relation_types
  for insert to authenticated
  with check (world_id is not null and app.can_edit_world(world_id));

create policy relation_types_update_world_editor on public.relation_types
  for update to authenticated
  using (world_id is not null and app.can_edit_world(world_id))
  with check (world_id is not null and app.can_edit_world(world_id));

create policy relation_types_delete_world_editor on public.relation_types
  for delete to authenticated
  using (world_id is not null and app.can_edit_world(world_id));

-- ---------------------------------------------------------------------------
-- Fichas y relaciones
-- ---------------------------------------------------------------------------

alter table public.entities enable row level security;

create policy entities_select_member on public.entities
  for select to authenticated
  using (
    app.is_world_member(world_id)
    and (deleted_at is null or app.can_edit_world(world_id))
  );

create policy entities_insert_editor on public.entities
  for insert to authenticated
  with check (app.can_edit_world(world_id));

create policy entities_update_editor on public.entities
  for update to authenticated
  using (app.can_edit_world(world_id))
  with check (app.can_edit_world(world_id));

-- Borrado físico reservado al servidor (exportación/purga): el cliente marca
-- `deleted_at`. Aun así la política existe para que un editor pueda vaciar la
-- papelera cuando el flujo lo permita.
create policy entities_delete_editor on public.entities
  for delete to authenticated
  using (app.can_edit_world(world_id));

alter table public.relations enable row level security;

create policy relations_select_member on public.relations
  for select to authenticated
  using (app.is_world_member(world_id));

create policy relations_insert_editor on public.relations
  for insert to authenticated
  with check (app.can_edit_world(world_id));

create policy relations_update_editor on public.relations
  for update to authenticated
  using (app.can_edit_world(world_id))
  with check (app.can_edit_world(world_id));

create policy relations_delete_editor on public.relations
  for delete to authenticated
  using (app.can_edit_world(world_id));

-- ---------------------------------------------------------------------------
-- Etiquetas
-- ---------------------------------------------------------------------------

alter table public.tags enable row level security;

create policy tags_select_member on public.tags
  for select to authenticated
  using (app.is_world_member(world_id));

create policy tags_insert_editor on public.tags
  for insert to authenticated
  with check (app.can_edit_world(world_id));

create policy tags_update_editor on public.tags
  for update to authenticated
  using (app.can_edit_world(world_id))
  with check (app.can_edit_world(world_id));

create policy tags_delete_editor on public.tags
  for delete to authenticated
  using (app.can_edit_world(world_id));

alter table public.entity_tags enable row level security;

create policy entity_tags_select_member on public.entity_tags
  for select to authenticated
  using (app.is_world_member(app.entity_world_id(entity_id)));

create policy entity_tags_insert_editor on public.entity_tags
  for insert to authenticated
  with check (app.can_edit_world(app.entity_world_id(entity_id)));

create policy entity_tags_delete_editor on public.entity_tags
  for delete to authenticated
  using (app.can_edit_world(app.entity_world_id(entity_id)));

-- Sin política de UPDATE: la relación N:M se crea y se borra, no se modifica.

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------

alter table public.assets enable row level security;

create policy assets_select_member on public.assets
  for select to authenticated
  using (app.is_world_member(world_id));

-- El cargador queda registrado y el prefijo de la clave se comprueba en la
-- política y en la restricción `check` de la tabla. Los metadatos (bucket,
-- mime, size, width, height) los fija el servidor al subir (M0-10).
create policy assets_insert_editor on public.assets
  for insert to authenticated
  with check (
    app.can_edit_world(world_id)
    and uploader_id = (select auth.uid())
    and path like 'world/' || world_id::text || '/%'
  );

create policy assets_update_editor on public.assets
  for update to authenticated
  using (app.can_edit_world(world_id))
  with check (app.can_edit_world(world_id));

create policy assets_delete_editor on public.assets
  for delete to authenticated
  using (app.can_edit_world(world_id));

-- ---------------------------------------------------------------------------
-- Mapas
-- ---------------------------------------------------------------------------

alter table public.maps enable row level security;

create policy maps_select_member on public.maps
  for select to authenticated
  using (
    app.is_world_member(world_id)
    and (deleted_at is null or app.can_edit_world(world_id))
  );

create policy maps_insert_editor on public.maps
  for insert to authenticated
  with check (app.can_edit_world(world_id));

create policy maps_update_editor on public.maps
  for update to authenticated
  using (app.can_edit_world(world_id))
  with check (app.can_edit_world(world_id));

create policy maps_delete_editor on public.maps
  for delete to authenticated
  using (app.can_edit_world(world_id));

alter table public.map_entity_links enable row level security;

create policy map_entity_links_select_member on public.map_entity_links
  for select to authenticated
  using (app.is_world_member(app.map_world_id(map_id)));

create policy map_entity_links_insert_editor on public.map_entity_links
  for insert to authenticated
  with check (app.can_edit_world(app.map_world_id(map_id)));

create policy map_entity_links_update_editor on public.map_entity_links
  for update to authenticated
  using (app.can_edit_world(app.map_world_id(map_id)))
  with check (app.can_edit_world(app.map_world_id(map_id)));

create policy map_entity_links_delete_editor on public.map_entity_links
  for delete to authenticated
  using (app.can_edit_world(app.map_world_id(map_id)));

-- ---------------------------------------------------------------------------
-- Manuscritos
-- ---------------------------------------------------------------------------

alter table public.manuscripts enable row level security;

create policy manuscripts_select_member on public.manuscripts
  for select to authenticated
  using (app.is_world_member(world_id));

create policy manuscripts_insert_editor on public.manuscripts
  for insert to authenticated
  with check (app.can_edit_world(world_id));

create policy manuscripts_update_editor on public.manuscripts
  for update to authenticated
  using (app.can_edit_world(world_id))
  with check (app.can_edit_world(world_id));

create policy manuscripts_delete_editor on public.manuscripts
  for delete to authenticated
  using (app.can_edit_world(world_id));

alter table public.books enable row level security;

create policy books_select_member on public.books
  for select to authenticated
  using (app.is_world_member(app.book_world_id(id)));

create policy books_insert_editor on public.books
  for insert to authenticated
  with check (app.can_edit_world(app.manuscript_world_id(manuscript_id)));

create policy books_update_editor on public.books
  for update to authenticated
  using (app.can_edit_world(app.book_world_id(id)))
  with check (app.can_edit_world(app.manuscript_world_id(manuscript_id)));

create policy books_delete_editor on public.books
  for delete to authenticated
  using (app.can_edit_world(app.book_world_id(id)));

alter table public.chapters enable row level security;

create policy chapters_select_member on public.chapters
  for select to authenticated
  using (app.is_world_member(app.chapter_world_id(id)));

create policy chapters_insert_editor on public.chapters
  for insert to authenticated
  with check (app.can_edit_world(app.book_world_id(book_id)));

create policy chapters_update_editor on public.chapters
  for update to authenticated
  using (app.can_edit_world(app.chapter_world_id(id)))
  with check (app.can_edit_world(app.book_world_id(book_id)));

create policy chapters_delete_editor on public.chapters
  for delete to authenticated
  using (app.can_edit_world(app.chapter_world_id(id)));

-- Las escenas resuelven el mundo por el capítulo (que ya existe) y no por su
-- propio `id`: en un INSERT la fila aún no es visible.
alter table public.scenes enable row level security;

create policy scenes_select_member on public.scenes
  for select to authenticated
  using (
    app.is_world_member(app.chapter_world_id(chapter_id))
    and (deleted_at is null or app.can_edit_world(app.chapter_world_id(chapter_id)))
  );

create policy scenes_insert_editor on public.scenes
  for insert to authenticated
  with check (app.can_edit_world(app.chapter_world_id(chapter_id)));

create policy scenes_update_editor on public.scenes
  for update to authenticated
  using (app.can_edit_world(app.chapter_world_id(chapter_id)))
  with check (app.can_edit_world(app.chapter_world_id(chapter_id)));

create policy scenes_delete_editor on public.scenes
  for delete to authenticated
  using (app.can_edit_world(app.chapter_world_id(chapter_id)));

-- Versiones de escena: solo lectura y creación para editores. Nunca se
-- actualizan ni se borran desde el cliente.
alter table public.scene_versions enable row level security;

create policy scene_versions_select_editor on public.scene_versions
  for select to authenticated
  using (app.can_edit_world(app.scene_world_id(scene_id)));

create policy scene_versions_insert_editor on public.scene_versions
  for insert to authenticated
  with check (
    app.can_edit_world(app.scene_world_id(scene_id))
    and created_by = (select auth.uid())
  );
