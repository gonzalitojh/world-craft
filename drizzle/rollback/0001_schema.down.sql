-- Rollback de 0001_schema.sql
--
-- **Destructivo.** Borra todas las tablas y enums del modelo. Drizzle Kit no lo
-- aplica automáticamente: se ejecuta a mano, con copia de seguridad y solo en un
-- proyecto de desarrollo. En producción se restaura desde el backup, no se
-- revierte con este archivo.
--
-- El orden es el inverso de las dependencias (primero las hijas).

drop table if exists public.activity_log cascade;
drop table if exists public.game_table_entries cascade;
drop table if exists public.game_tables cascade;
drop table if exists public.game_sessions cascade;
drop table if exists public.game_content_packs cascade;
drop table if exists public.scene_versions cascade;
drop table if exists public.scenes cascade;
drop table if exists public.chapters cascade;
drop table if exists public.books cascade;
drop table if exists public.manuscripts cascade;
drop table if exists public.map_entity_links cascade;
drop table if exists public.maps cascade;
drop table if exists public.entity_tags cascade;
drop table if exists public.relations cascade;
drop table if exists public.entities cascade;
drop table if exists public.assets cascade;
drop table if exists public.tags cascade;
drop table if exists public.relation_types cascade;
drop table if exists public.entity_types cascade;
drop table if exists public.world_invitations cascade;
drop table if exists public.world_members cascade;
drop table if exists public.worlds cascade;
drop table if exists public.allowed_emails cascade;
drop table if exists public.profiles cascade;

drop type if exists public.content_status;
drop type if exists public.game_table_category;
drop type if exists public.invitation_role;
drop type if exists public.manuscript_kind;
drop type if exists public.theme_preference;
drop type if exists public.world_role;
drop type if exists public.world_status;
