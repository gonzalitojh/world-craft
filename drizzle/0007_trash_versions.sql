CREATE TABLE `entity_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`description` text,
	`description_text` text,
	`label` text,
	`origin` text DEFAULT 'auto' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "entity_versions_origin_check" CHECK("entity_versions"."origin" in ('auto', 'manual', 'restore')),
	CONSTRAINT "entity_versions_label_check" CHECK("entity_versions"."label" is null or length("entity_versions"."label") between 1 and 120),
	CONSTRAINT "entity_versions_description_check" CHECK("entity_versions"."description" is null or (json_valid("entity_versions"."description") AND json_type("entity_versions"."description") = 'object')),
	CONSTRAINT "entity_versions_text_check" CHECK("entity_versions"."description_text" is null or length("entity_versions"."description_text") <= 50000)
);
--> statement-breakpoint
CREATE INDEX `entity_versions_entity_created_idx` ON `entity_versions` (`entity_id`,"created_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `entities_deleted_idx` ON `entities` (`deleted_at`,`world_id`);--> statement-breakpoint
CREATE INDEX `entity_types_deleted_idx` ON `entity_types` (`deleted_at`,`world_id`);