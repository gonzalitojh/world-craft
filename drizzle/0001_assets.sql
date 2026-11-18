CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`kind` text NOT NULL,
	`relative_path` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`alt` text,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "assets_kind_check" CHECK("assets"."kind" in ('image', 'map', 'document', 'other')),
	CONSTRAINT "assets_size_check" CHECK("assets"."size" >= 0),
	CONSTRAINT "assets_hash_check" CHECK(length("assets"."hash") = 64 AND "assets"."hash" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE INDEX `assets_world_idx` ON `assets` (`world_id`);--> statement-breakpoint
CREATE INDEX `assets_hash_idx` ON `assets` (`hash`);