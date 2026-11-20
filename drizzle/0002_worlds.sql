CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text,
	`description` text,
	`cover_asset_id` text,
	`genres` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`language` text DEFAULT 'es' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`cover_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "worlds_status_check" CHECK("worlds"."status" in ('active', 'archived')),
	CONSTRAINT "worlds_language_check" CHECK("worlds"."language" in ('es', 'en', 'it')),
	CONSTRAINT "worlds_slug_check" CHECK(length("worlds"."slug") between 1 and 80 AND "worlds"."slug" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "worlds_name_check" CHECK(length("worlds"."name") between 1 and 120),
	CONSTRAINT "worlds_genres_check" CHECK(json_valid("worlds"."genres") AND json_type("worlds"."genres") = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worlds_slug_uq` ON `worlds` (`slug`);--> statement-breakpoint
CREATE INDEX `worlds_status_idx` ON `worlds` (`status`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `worlds_deleted_updated_idx` ON `worlds` (`deleted_at`,"updated_at" desc);--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`diff` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_log_world_created_idx` ON `activity_log` (`world_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `activity_log_created_idx` ON `activity_log` ("created_at" desc);
