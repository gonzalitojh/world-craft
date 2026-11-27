-- Migración 0009: integridad de assets con mundos y cuarentena.
--
-- Reconstruye `assets` con `world_id → worlds(id) ON DELETE RESTRICT`, conserva
-- todas las filas y archivos válidos y mueve a `assets_quarantine` las filas
-- cuyo mundo ya no existe. Los archivos no se mueven ni se borran: la ruta
-- relativa original se conserva en la cuarentena.
--
-- Las claves foráneas se desactivan desde el runner, fuera de la transacción,
-- y se comprueban con `PRAGMA foreign_key_check` antes del commit. Este archivo
-- no contiene ningún `PRAGMA foreign_keys`.

CREATE TABLE `assets_quarantine` (
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
	`reason` text NOT NULL,
	`quarantined_at` integer NOT NULL,
	CONSTRAINT "assets_quarantine_kind_check" CHECK("kind" in ('image', 'map', 'document', 'other')),
	CONSTRAINT "assets_quarantine_size_check" CHECK("size" >= 0),
	CONSTRAINT "assets_quarantine_hash_check" CHECK(length("hash") = 64 AND "hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "assets_quarantine_reason_check" CHECK("reason" in ('world-missing', 'world-purged')),
	CONSTRAINT "assets_quarantine_timestamp_check" CHECK("quarantined_at" >= 0)
);
--> statement-breakpoint
CREATE INDEX `assets_quarantine_world_idx` ON `assets_quarantine` (`world_id`,`quarantined_at`);--> statement-breakpoint
CREATE INDEX `assets_quarantine_hash_idx` ON `assets_quarantine` (`hash`);--> statement-breakpoint
CREATE TABLE `assets_quarantine_references` (
	`id` integer PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`column_name` text NOT NULL,
	`position` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets_quarantine`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "assets_quarantine_references_table_check" CHECK("table_name" in ('worlds', 'entities', 'entity_gallery')),
	CONSTRAINT "assets_quarantine_references_position_check" CHECK("position" is null or "position" >= 0)
);
--> statement-breakpoint
CREATE INDEX `assets_quarantine_references_asset_idx` ON `assets_quarantine_references` (`asset_id`);--> statement-breakpoint
CREATE INDEX `assets_quarantine_references_row_idx` ON `assets_quarantine_references` (`table_name`,`row_id`);--> statement-breakpoint

-- Huérfanos de la migración: filas cuyo mundo ya no existe. Se conservan todos
-- los metadatos; el instante se expresa con SQLite para no depender del reloj
-- del proceso ni interpolar valores.
INSERT INTO `assets_quarantine` (
	`id`, `world_id`, `kind`, `relative_path`, `mime`, `size`, `width`,
	`height`, `alt`, `hash`, `created_at`, `reason`, `quarantined_at`
)
SELECT
	`a`.`id`, `a`.`world_id`, `a`.`kind`, `a`.`relative_path`, `a`.`mime`,
	`a`.`size`, `a`.`width`, `a`.`height`, `a`.`alt`, `a`.`hash`,
	`a`.`created_at`, 'world-missing',
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `assets` `a`
WHERE NOT EXISTS (SELECT 1 FROM `worlds` `w` WHERE `w`.`id` = `a`.`world_id`);
--> statement-breakpoint

-- Auditoría de referencias visibles antes de desvincularlas. El rollback de
-- referencia usa estas filas para restaurar portadas, imágenes y galería.
INSERT INTO `assets_quarantine_references` (
	`asset_id`, `table_name`, `row_id`, `column_name`, `position`, `created_at`
)
SELECT
	`w`.`cover_asset_id`, 'worlds', `w`.`id`, 'cover_asset_id', NULL,
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `worlds` `w`
JOIN `assets_quarantine` `q` ON `q`.`id` = `w`.`cover_asset_id`;
--> statement-breakpoint
INSERT INTO `assets_quarantine_references` (
	`asset_id`, `table_name`, `row_id`, `column_name`, `position`, `created_at`
)
SELECT
	`e`.`image_asset_id`, 'entities', `e`.`id`, 'image_asset_id', NULL,
	CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `entities` `e`
JOIN `assets_quarantine` `q` ON `q`.`id` = `e`.`image_asset_id`;
--> statement-breakpoint
INSERT INTO `assets_quarantine_references` (
	`asset_id`, `table_name`, `row_id`, `column_name`, `position`, `created_at`
)
SELECT
	`g`.`asset_id`, 'entity_gallery', `g`.`entity_id`, 'asset_id',
	`g`.`position`, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `entity_gallery` `g`
JOIN `assets_quarantine` `q` ON `q`.`id` = `g`.`asset_id`;
--> statement-breakpoint

UPDATE `worlds`
SET `cover_asset_id` = NULL
WHERE `cover_asset_id` IN (SELECT `id` FROM `assets_quarantine`);--> statement-breakpoint
UPDATE `entities`
SET `image_asset_id` = NULL
WHERE `image_asset_id` IN (SELECT `id` FROM `assets_quarantine`);--> statement-breakpoint
DELETE FROM `entity_gallery`
WHERE `asset_id` IN (SELECT `id` FROM `assets_quarantine`);--> statement-breakpoint

CREATE TABLE `assets_new` (
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
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "assets_kind_check" CHECK("kind" in ('image', 'map', 'document', 'other')),
	CONSTRAINT "assets_size_check" CHECK("size" >= 0),
	CONSTRAINT "assets_hash_check" CHECK(length("hash") = 64 AND "hash" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint

-- Solo sobreviven las filas cuyo mundo existe, incluidas las de mundos en
-- papelera: el borrado lógico no rompe la FK.
INSERT INTO `assets_new` (
	`id`, `world_id`, `kind`, `relative_path`, `mime`, `size`, `width`,
	`height`, `alt`, `hash`, `created_at`
)
SELECT
	`a`.`id`, `a`.`world_id`, `a`.`kind`, `a`.`relative_path`, `a`.`mime`,
	`a`.`size`, `a`.`width`, `a`.`height`, `a`.`alt`, `a`.`hash`,
	`a`.`created_at`
FROM `assets` `a`
WHERE EXISTS (SELECT 1 FROM `worlds` `w` WHERE `w`.`id` = `a`.`world_id`);
--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `assets_new` RENAME TO `assets`;--> statement-breakpoint
CREATE INDEX `assets_world_idx` ON `assets` (`world_id`);--> statement-breakpoint
CREATE INDEX `assets_hash_idx` ON `assets` (`hash`);--> statement-breakpoint
CREATE INDEX `worlds_cover_asset_idx` ON `worlds` (`cover_asset_id`);--> statement-breakpoint
CREATE INDEX `entities_image_asset_idx` ON `entities` (`image_asset_id`);
