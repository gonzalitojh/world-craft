CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`type_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`summary` text,
	`description` text,
	`description_text` text,
	`image_asset_id` text,
	`attributes` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_favorite` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`type_id`) REFERENCES `entity_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`image_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "entities_status_check" CHECK("entities"."status" in ('active', 'draft', 'archived')),
	CONSTRAINT "entities_favorite_check" CHECK("entities"."is_favorite" in (0, 1)),
	CONSTRAINT "entities_name_check" CHECK(length("entities"."name") between 1 and 120),
	CONSTRAINT "entities_slug_check" CHECK(length("entities"."slug") between 1 and 80 AND "entities"."slug" NOT GLOB '*[^a-z0-9-]*' AND "entities"."slug" GLOB '[a-z0-9]*' AND "entities"."slug" GLOB '*[a-z0-9]' AND "entities"."slug" NOT GLOB '*--*'),
	CONSTRAINT "entities_aliases_check" CHECK(json_valid("entities"."aliases") AND json_type("entities"."aliases") = 'array'),
	CONSTRAINT "entities_attributes_check" CHECK(json_valid("entities"."attributes") AND json_type("entities"."attributes") = 'object'),
	CONSTRAINT "entities_description_check" CHECK("entities"."description" is null OR (json_valid("entities"."description") AND json_type("entities"."description") = 'object'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entities_world_slug_uq` ON `entities` (`world_id`,`slug`);--> statement-breakpoint
CREATE INDEX `entities_world_type_idx` ON `entities` (`world_id`,`type_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `entities_name_idx` ON `entities` (`world_id`,`name`);--> statement-breakpoint
CREATE INDEX `entities_favorite_idx` ON `entities` (`world_id`,`is_favorite`);--> statement-breakpoint
CREATE TABLE `entity_gallery` (
	`entity_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`entity_id`, `asset_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "entity_gallery_position_check" CHECK("entity_gallery"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_gallery_position_uq` ON `entity_gallery` (`entity_id`,`position`);--> statement-breakpoint
CREATE INDEX `entity_gallery_asset_idx` ON `entity_gallery` (`asset_id`);--> statement-breakpoint
CREATE TABLE `entity_tags` (
	`entity_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`entity_id`, `tag_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_tags_tag_idx` ON `entity_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tags_name_check" CHECK(length("tags"."name") between 1 and 40),
	CONSTRAINT "tags_color_check" CHECK("tags"."color" in ('moss', 'ochre', 'danger', 'prussian'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_world_name_uq` ON `tags` (`world_id`,`name`);--> statement-breakpoint
CREATE INDEX `tags_world_idx` ON `tags` (`world_id`,`name`);