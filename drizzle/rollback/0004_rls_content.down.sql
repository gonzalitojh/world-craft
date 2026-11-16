-- Rollback de 0004_rls_content.sql
--
-- Igual que en 0003: pensado para desarrollo. Desactivar la RLS sin retirar los
-- privilegios deja las tablas legibles por `authenticated`.

drop policy if exists entity_types_select_member on public.entity_types;
drop policy if exists entity_types_insert_world_editor on public.entity_types;
drop policy if exists entity_types_update_world_editor on public.entity_types;
drop policy if exists entity_types_delete_world_editor on public.entity_types;
alter table public.entity_types disable row level security;

drop policy if exists relation_types_select_member on public.relation_types;
drop policy if exists relation_types_insert_world_editor on public.relation_types;
drop policy if exists relation_types_update_world_editor on public.relation_types;
drop policy if exists relation_types_delete_world_editor on public.relation_types;
alter table public.relation_types disable row level security;

drop policy if exists entities_select_member on public.entities;
drop policy if exists entities_insert_editor on public.entities;
drop policy if exists entities_update_editor on public.entities;
drop policy if exists entities_delete_editor on public.entities;
alter table public.entities disable row level security;

drop policy if exists relations_select_member on public.relations;
drop policy if exists relations_insert_editor on public.relations;
drop policy if exists relations_update_editor on public.relations;
drop policy if exists relations_delete_editor on public.relations;
alter table public.relations disable row level security;

drop policy if exists tags_select_member on public.tags;
drop policy if exists tags_insert_editor on public.tags;
drop policy if exists tags_update_editor on public.tags;
drop policy if exists tags_delete_editor on public.tags;
alter table public.tags disable row level security;

drop policy if exists entity_tags_select_member on public.entity_tags;
drop policy if exists entity_tags_insert_editor on public.entity_tags;
drop policy if exists entity_tags_delete_editor on public.entity_tags;
alter table public.entity_tags disable row level security;

drop policy if exists assets_select_member on public.assets;
drop policy if exists assets_insert_editor on public.assets;
drop policy if exists assets_update_editor on public.assets;
drop policy if exists assets_delete_editor on public.assets;
alter table public.assets disable row level security;

drop policy if exists maps_select_member on public.maps;
drop policy if exists maps_insert_editor on public.maps;
drop policy if exists maps_update_editor on public.maps;
drop policy if exists maps_delete_editor on public.maps;
alter table public.maps disable row level security;

drop policy if exists map_entity_links_select_member on public.map_entity_links;
drop policy if exists map_entity_links_insert_editor on public.map_entity_links;
drop policy if exists map_entity_links_update_editor on public.map_entity_links;
drop policy if exists map_entity_links_delete_editor on public.map_entity_links;
alter table public.map_entity_links disable row level security;

drop policy if exists manuscripts_select_member on public.manuscripts;
drop policy if exists manuscripts_insert_editor on public.manuscripts;
drop policy if exists manuscripts_update_editor on public.manuscripts;
drop policy if exists manuscripts_delete_editor on public.manuscripts;
alter table public.manuscripts disable row level security;

drop policy if exists books_select_member on public.books;
drop policy if exists books_insert_editor on public.books;
drop policy if exists books_update_editor on public.books;
drop policy if exists books_delete_editor on public.books;
alter table public.books disable row level security;

drop policy if exists chapters_select_member on public.chapters;
drop policy if exists chapters_insert_editor on public.chapters;
drop policy if exists chapters_update_editor on public.chapters;
drop policy if exists chapters_delete_editor on public.chapters;
alter table public.chapters disable row level security;

drop policy if exists scenes_select_member on public.scenes;
drop policy if exists scenes_insert_editor on public.scenes;
drop policy if exists scenes_update_editor on public.scenes;
drop policy if exists scenes_delete_editor on public.scenes;
alter table public.scenes disable row level security;

drop policy if exists scene_versions_select_editor on public.scene_versions;
drop policy if exists scene_versions_insert_editor on public.scene_versions;
alter table public.scene_versions disable row level security;
