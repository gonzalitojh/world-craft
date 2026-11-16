-- Rollback de 0002_functions_and_triggers.sql
--
-- Se ejecuta a mano y después de retirar las políticas que usan las funciones
-- (0003, 0004 y 0005), porque `drop function ... cascade` borraría las políticas
-- sin avisar del efecto.

-- Triggers
drop trigger if exists set_updated_at on public.profiles;
drop trigger if exists set_updated_at on public.worlds;
drop trigger if exists set_updated_at on public.world_members;
drop trigger if exists set_updated_at on public.entity_types;
drop trigger if exists set_updated_at on public.relation_types;
drop trigger if exists set_updated_at on public.tags;
drop trigger if exists set_updated_at on public.entities;
drop trigger if exists set_updated_at on public.relations;
drop trigger if exists set_updated_at on public.maps;
drop trigger if exists set_updated_at on public.manuscripts;
drop trigger if exists set_updated_at on public.books;
drop trigger if exists set_updated_at on public.chapters;
drop trigger if exists set_updated_at on public.scenes;
drop trigger if exists set_updated_at on public.game_tables;

drop trigger if exists on_world_created on public.worlds;
drop trigger if exists protect_world_owner on public.world_members;
drop trigger if exists assert_owner_membership on public.world_members;

drop trigger if exists prevent_world_id_change on public.world_members;
drop trigger if exists prevent_world_id_change on public.world_invitations;
drop trigger if exists prevent_world_id_change on public.entity_types;
drop trigger if exists prevent_world_id_change on public.entities;
drop trigger if exists prevent_world_id_change on public.relations;
drop trigger if exists prevent_world_id_change on public.tags;
drop trigger if exists prevent_world_id_change on public.assets;
drop trigger if exists prevent_world_id_change on public.maps;
drop trigger if exists prevent_world_id_change on public.manuscripts;
drop trigger if exists prevent_world_id_change on public.game_content_packs;
drop trigger if exists prevent_world_id_change on public.game_tables;
drop trigger if exists prevent_world_id_change on public.game_sessions;
drop trigger if exists prevent_world_id_change on public.activity_log;

drop trigger if exists assert_entity_type_world on public.entities;
drop trigger if exists assert_relation_worlds on public.relations;
drop trigger if exists assert_entity_tag_world on public.entity_tags;
drop trigger if exists assert_map_link_world on public.map_entity_links;
drop trigger if exists assert_scene_entities_world on public.scenes;
drop trigger if exists assert_game_entry_world on public.game_table_entries;

-- Funciones de trigger
drop function if exists app.set_updated_at();
drop function if exists app.on_world_created();
drop function if exists app.protect_world_owner();
drop function if exists app.assert_owner_membership();
drop function if exists app.prevent_world_id_change();
drop function if exists app.assert_entity_type_world();
drop function if exists app.assert_relation_worlds();
drop function if exists app.assert_entity_tag_world();
drop function if exists app.assert_map_link_world();
drop function if exists app.assert_scene_entities_world();
drop function if exists app.assert_game_entry_world();

-- Helpers y operación
drop function if exists app.transfer_world_ownership(uuid, uuid);
drop function if exists app.game_table_world_id(uuid);
drop function if exists app.scene_world_id(uuid);
drop function if exists app.chapter_world_id(uuid);
drop function if exists app.book_world_id(uuid);
drop function if exists app.manuscript_world_id(uuid);
drop function if exists app.map_world_id(uuid);
drop function if exists app.tag_world_id(uuid);
drop function if exists app.entity_world_id(uuid);
drop function if exists app.shares_world_with(uuid);
drop function if exists app.is_world_owner(uuid);
drop function if exists app.can_edit_world(uuid);
drop function if exists app.is_world_member(uuid);
drop function if exists app.world_role(uuid);

-- Claves foráneas añadidas en esta migración
alter table if exists public.worlds drop constraint if exists worlds_cover_asset_id_assets_id_fk;
alter table if exists public.profiles drop constraint if exists profiles_id_auth_users_id_fk;
