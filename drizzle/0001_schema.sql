CREATE TYPE "public"."content_status" AS ENUM('draft', 'in_progress', 'done', 'archived');--> statement-breakpoint
CREATE TYPE "public"."game_table_category" AS ENUM('container', 'subgenre', 'trigger', 'trope', 'custom');--> statement-breakpoint
CREATE TYPE "public"."invitation_role" AS ENUM('editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."manuscript_kind" AS ENUM('novel', 'novella', 'short', 'saga');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."world_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."world_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "allowed_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"invited_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_emails_email_lower_check" CHECK ("allowed_emails"."email" = lower("allowed_emails"."email")),
	CONSTRAINT "allowed_emails_email_shape_check" CHECK (length("allowed_emails"."email") > 3 and position('@' in "allowed_emails"."email") > 1)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"theme" "theme_preference" DEFAULT 'system' NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_locale_check" CHECK ("profiles"."locale" in ('es', 'en', 'it'))
);
--> statement-breakpoint
CREATE TABLE "world_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "invitation_role" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_invitations_email_lower_check" CHECK ("world_invitations"."email" = lower("world_invitations"."email")),
	CONSTRAINT "world_invitations_token_hash_format_check" CHECK ("world_invitations"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "world_invitations_expires_at_check" CHECK ("world_invitations"."expires_at" > "world_invitations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "world_members" (
	"world_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "world_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_members_pkey" PRIMARY KEY("world_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cover_asset_id" uuid,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "world_status" DEFAULT 'draft' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worlds_name_length_check" CHECK (char_length("worlds"."name") between 1 and 160),
	CONSTRAINT "worlds_slug_format_check" CHECK ("worlds"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "entity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_types_is_system_check" CHECK ("entity_types"."is_system" = ("entity_types"."world_id" is null))
);
--> statement-breakpoint
CREATE TABLE "relation_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"inverse_name" text NOT NULL,
	"color" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relation_types_is_system_check" CHECK ("relation_types"."is_system" = ("relation_types"."world_id" is null))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_format_check" CHECK ("tags"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"uploader_id" uuid,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_size_check" CHECK ("assets"."size" >= 0),
	CONSTRAINT "assets_path_world_prefix_check" CHECK ("assets"."path" like 'world/' || "assets"."world_id"::text || '/%')
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description_text" text DEFAULT '' NOT NULL,
	"image_asset_id" uuid,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('spanish'::pg_catalog.regconfig, coalesce("name", '')), 'A') || setweight(to_tsvector('spanish'::pg_catalog.regconfig, coalesce("summary", '')), 'B') || setweight(to_tsvector('spanish'::pg_catalog.regconfig, coalesce("description_text", '')), 'C') || setweight(to_tsvector('spanish'::pg_catalog.regconfig, app.immutable_array_to_string(coalesce("aliases", '{}'::text[]), ' ')), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "entities_slug_format_check" CHECK ("entities"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "entities_name_length_check" CHECK (char_length("entities"."name") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "entity_tags" (
	"entity_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_tags_pkey" PRIMARY KEY("entity_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"label" text,
	"inverse_label" text,
	"notes" text,
	"strength" smallint DEFAULT 3 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relations_no_self_reference_check" CHECK ("relations"."source_id" <> "relations"."target_id"),
	CONSTRAINT "relations_strength_range_check" CHECK ("relations"."strength" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "map_entity_links" (
	"map_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"feature_id" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "map_entity_links_pkey" PRIMARY KEY("map_id","entity_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"document" jsonb DEFAULT '{"type": "FeatureCollection", "features": []}'::jsonb NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bounds" jsonb,
	"thumbnail_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" numeric(12, 3) DEFAULT '1000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" numeric(12, 3) DEFAULT '1000' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuscripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "manuscript_kind" NOT NULL,
	"synopsis" text DEFAULT '' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"target_words" integer,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manuscripts_target_words_check" CHECK ("manuscripts"."target_words" is null or "manuscripts"."target_words" > 0)
);
--> statement-breakpoint
CREATE TABLE "scene_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"label" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_versions_word_count_check" CHECK ("scene_versions"."word_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" numeric(12, 3) DEFAULT '1000' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"pov_entity_id" uuid,
	"location_entity_id" uuid,
	"story_date" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "scenes_word_count_check" CHECK ("scenes"."word_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_content_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid,
	"name" text NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"author" text,
	"license" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seed" text NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_table_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"text" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_table_entries_weight_check" CHECK ("game_table_entries"."weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid,
	"pack_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"category" "game_table_category" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_editable" boolean DEFAULT true NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_tables_is_system_check" CHECK ("game_tables"."is_system" = ("game_tables"."world_id" is null))
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"world_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_log_action_check" CHECK (length("activity_log"."action") between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD CONSTRAINT "allowed_emails_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_invitations" ADD CONSTRAINT "world_invitations_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_invitations" ADD CONSTRAINT "world_invitations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_members" ADD CONSTRAINT "world_members_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_members" ADD CONSTRAINT "world_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_types" ADD CONSTRAINT "entity_types_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation_types" ADD CONSTRAINT "relation_types_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploader_id_profiles_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_type_id_entity_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."entity_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_image_asset_id_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_id_entities_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_id_entities_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_type_id_relation_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."relation_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_entity_links" ADD CONSTRAINT "map_entity_links_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_entity_links" ADD CONSTRAINT "map_entity_links_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_thumbnail_asset_id_assets_id_fk" FOREIGN KEY ("thumbnail_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_versions" ADD CONSTRAINT "scene_versions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_pov_entity_id_entities_id_fk" FOREIGN KEY ("pov_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_location_entity_id_entities_id_fk" FOREIGN KEY ("location_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_content_packs" ADD CONSTRAINT "game_content_packs_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_content_packs" ADD CONSTRAINT "game_content_packs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_table_entries" ADD CONSTRAINT "game_table_entries_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_pack_id_game_content_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."game_content_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_updated_at_idx" ON "profiles" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "world_invitations_token_hash_key" ON "world_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "world_invitations_world_id_email_pending_key" ON "world_invitations" USING btree ("world_id","email") WHERE "world_invitations"."accepted_at" is null;--> statement-breakpoint
CREATE INDEX "world_invitations_world_id_idx" ON "world_invitations" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "world_invitations_email_idx" ON "world_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "world_invitations_world_id_expires_at_idx" ON "world_invitations" USING btree ("world_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "world_members_one_owner_key" ON "world_members" USING btree ("world_id") WHERE "world_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "world_members_user_id_idx" ON "world_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "worlds_owner_id_slug_key" ON "worlds" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE INDEX "worlds_owner_id_idx" ON "worlds" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "worlds_owner_id_updated_at_idx" ON "worlds" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "entity_types_system_key_key" ON "entity_types" USING btree ("key") WHERE "entity_types"."world_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_types_world_id_key_key" ON "entity_types" USING btree ("world_id","key") WHERE "entity_types"."world_id" is not null;--> statement-breakpoint
CREATE INDEX "entity_types_world_id_idx" ON "entity_types" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relation_types_system_key_key" ON "relation_types" USING btree ("key") WHERE "relation_types"."world_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "relation_types_world_id_key_key" ON "relation_types" USING btree ("world_id","key") WHERE "relation_types"."world_id" is not null;--> statement-breakpoint
CREATE INDEX "relation_types_world_id_idx" ON "relation_types" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_world_id_slug_key" ON "tags" USING btree ("world_id","slug");--> statement-breakpoint
CREATE INDEX "tags_world_id_idx" ON "tags" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_world_id_path_key" ON "assets" USING btree ("world_id","path");--> statement-breakpoint
CREATE INDEX "assets_world_id_idx" ON "assets" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "assets_world_id_created_at_idx" ON "assets" USING btree ("world_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "entities_world_id_slug_key" ON "entities" USING btree ("world_id","slug") WHERE "entities"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "entities_world_id_idx" ON "entities" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "entities_world_id_type_id_idx" ON "entities" USING btree ("world_id","type_id");--> statement-breakpoint
CREATE INDEX "entities_world_id_updated_at_idx" ON "entities" USING btree ("world_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entities_search_vector_idx" ON "entities" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "entities_name_trgm_idx" ON "entities" USING gin ("name" extensions.gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "entities_aliases_trgm_idx" ON "entities" USING gin (app.immutable_array_to_string("aliases", ' ') extensions.gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "entity_tags_tag_id_idx" ON "entity_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relations_world_id_source_id_target_id_type_id_key" ON "relations" USING btree ("world_id","source_id","target_id","type_id");--> statement-breakpoint
CREATE INDEX "relations_world_id_idx" ON "relations" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "relations_source_id_idx" ON "relations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "relations_target_id_idx" ON "relations" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "relations_type_id_idx" ON "relations" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "map_entity_links_entity_id_idx" ON "map_entity_links" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "map_entity_links_map_id_feature_id_idx" ON "map_entity_links" USING btree ("map_id","feature_id");--> statement-breakpoint
CREATE INDEX "maps_world_id_idx" ON "maps" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "maps_world_id_updated_at_idx" ON "maps" USING btree ("world_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "maps_world_id_live_idx" ON "maps" USING btree ("world_id") WHERE "maps"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "books_manuscript_id_idx" ON "books" USING btree ("manuscript_id");--> statement-breakpoint
CREATE INDEX "books_manuscript_id_position_idx" ON "books" USING btree ("manuscript_id","position");--> statement-breakpoint
CREATE INDEX "chapters_book_id_idx" ON "chapters" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "chapters_book_id_position_idx" ON "chapters" USING btree ("book_id","position");--> statement-breakpoint
CREATE INDEX "manuscripts_world_id_idx" ON "manuscripts" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "manuscripts_world_id_updated_at_idx" ON "manuscripts" USING btree ("world_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scene_versions_scene_id_created_at_idx" ON "scene_versions" USING btree ("scene_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scenes_chapter_id_idx" ON "scenes" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "scenes_chapter_id_position_idx" ON "scenes" USING btree ("chapter_id","position");--> statement-breakpoint
CREATE INDEX "scenes_chapter_id_live_idx" ON "scenes" USING btree ("chapter_id") WHERE "scenes"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "game_content_packs_system_name_key" ON "game_content_packs" USING btree ("name") WHERE "game_content_packs"."world_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "game_content_packs_world_id_name_key" ON "game_content_packs" USING btree ("world_id","name") WHERE "game_content_packs"."world_id" is not null;--> statement-breakpoint
CREATE INDEX "game_content_packs_world_id_idx" ON "game_content_packs" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "game_sessions_world_id_user_id_idx" ON "game_sessions" USING btree ("world_id","user_id");--> statement-breakpoint
CREATE INDEX "game_sessions_user_id_idx" ON "game_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_table_entries_table_id_idx" ON "game_table_entries" USING btree ("table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_tables_system_key_key" ON "game_tables" USING btree ("key") WHERE "game_tables"."world_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "game_tables_world_id_key_key" ON "game_tables" USING btree ("world_id","key") WHERE "game_tables"."world_id" is not null;--> statement-breakpoint
CREATE INDEX "game_tables_world_id_idx" ON "game_tables" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "game_tables_pack_id_idx" ON "game_tables" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "activity_log_world_id_created_at_idx" ON "activity_log" USING btree ("world_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_log_world_id_idx" ON "activity_log" USING btree ("world_id");