CREATE TABLE `relation_types` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`inverse_name` text NOT NULL,
	`color` text NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "relation_types_is_system_check" CHECK("relation_types"."is_system" in (0, 1)),
	CONSTRAINT "relation_types_world_check" CHECK(("relation_types"."world_id" is null and "relation_types"."is_system" = 1) or ("relation_types"."world_id" is not null and "relation_types"."is_system" = 0)),
	CONSTRAINT "relation_types_key_check" CHECK(length("relation_types"."key") between 1 and 60 AND "relation_types"."key" NOT GLOB '*[^a-z0-9-]*' AND "relation_types"."key" GLOB '[a-z0-9]*' AND "relation_types"."key" GLOB '*[a-z0-9]' AND "relation_types"."key" NOT GLOB '*--*'),
	CONSTRAINT "relation_types_name_check" CHECK(length("relation_types"."name") between 1 and 80),
	CONSTRAINT "relation_types_inverse_name_check" CHECK(length("relation_types"."inverse_name") between 1 and 80),
	CONSTRAINT "relation_types_color_check" CHECK("relation_types"."color" in ('moss', 'ochre', 'danger', 'prussian'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relation_types_world_key_uq` ON `relation_types` (`world_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `relation_types_system_key_uq` ON `relation_types` (`key`) WHERE "relation_types"."world_id" is null;--> statement-breakpoint
CREATE INDEX `relation_types_world_idx` ON `relation_types` (`world_id`,`name`);--> statement-breakpoint
CREATE TABLE `relations` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`type_id` text NOT NULL,
	`label` text,
	`inverse_label` text,
	`notes` text,
	`strength` integer DEFAULT 1 NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`type_id`) REFERENCES `relation_types`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "relations_self_check" CHECK("relations"."source_id" <> "relations"."target_id"),
	CONSTRAINT "relations_strength_check" CHECK("relations"."strength" between 1 and 5),
	CONSTRAINT "relations_label_check" CHECK("relations"."label" is null or length("relations"."label") between 1 and 80),
	CONSTRAINT "relations_inverse_label_check" CHECK("relations"."inverse_label" is null or length("relations"."inverse_label") between 1 and 80),
	CONSTRAINT "relations_notes_check" CHECK("relations"."notes" is null or length("relations"."notes") <= 2000),
	CONSTRAINT "relations_metadata_check" CHECK(json_valid("relations"."metadata") AND json_type("relations"."metadata") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relations_unique` ON `relations` (`world_id`,`source_id`,`target_id`,`type_id`);--> statement-breakpoint
CREATE INDEX `relations_world_source_idx` ON `relations` (`world_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `relations_world_target_idx` ON `relations` (`world_id`,`target_id`);--> statement-breakpoint
CREATE INDEX `relations_type_idx` ON `relations` (`type_id`);--> statement-breakpoint
INSERT INTO `relation_types` (`id`, `world_id`, `key`, `name`, `inverse_name`, `color`, `is_system`, `created_at`, `updated_at`) VALUES
('018f0000-0000-7000-8000-000000000101', NULL, 'related-to', 'Relacionado con', 'Relacionado con', 'moss', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000102', NULL, 'ally-of', 'Aliado de', 'Tiene como aliado a', 'moss', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000103', NULL, 'enemy-of', 'Enemigo de', 'Tiene como enemigo a', 'danger', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000104', NULL, 'parent-of', 'Progenitor de', 'Hijo de', 'ochre', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000105', NULL, 'sibling-of', 'Hermano de', 'Hermano de', 'ochre', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000106', NULL, 'spouse-of', 'Cónyuge de', 'Cónyuge de', 'danger', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000107', NULL, 'member-of', 'Miembro de', 'Tiene como miembro a', 'prussian', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000108', NULL, 'leads', 'Dirige', 'Está dirigido por', 'prussian', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000109', NULL, 'located-in', 'Ubicado en', 'Contiene', 'prussian', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000110', NULL, 'part-of', 'Parte de', 'Incluye', 'moss', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000111', NULL, 'owns', 'Posee', 'Pertenece a', 'ochre', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000112', NULL, 'created', 'Creó', 'Fue creado por', 'ochre', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000113', NULL, 'participated-in', 'Participó en', 'Tuvo como participante a', 'danger', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000114', NULL, 'worships', 'Adora a', 'Recibe culto de', 'ochre', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000115', NULL, 'caused', 'Causó', 'Fue causado por', 'danger', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000116', NULL, 'protects', 'Protege a', 'Está protegido por', 'moss', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000117', NULL, 'serves', 'Sirve a', 'Tiene al servicio a', 'prussian', 1, 1795132800000, 1795132800000),
('018f0000-0000-7000-8000-000000000118', NULL, 'knows', 'Conoce a', 'Es conocido por', 'moss', 1, 1795132800000, 1795132800000);