-- Rollback de referencia de 0009_assets_world_fk.
--
-- No se ejecuta automáticamente: el runner solo aplica migraciones hacia
-- delante y la vía segura es restaurar la copia previa a la migración. Este
-- archivo se conserva para recuperación manual y para probar el ciclo completo
-- sobre una base temporal.
--
-- Deshace la FK de `assets`, devuelve a `assets` las filas en cuarentena
-- (`world-missing` y `world-purged`) y restaura las referencias visibles
-- auditadas. No toca ningún archivo de `assets/`.

PRAGMA foreign_keys = OFF;--> statement-breakpoint

CREATE TABLE `assets_prev` (
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
	CONSTRAINT "assets_kind_check" CHECK("kind" in ('image', 'map', 'document', 'other')),
	CONSTRAINT "assets_size_check" CHECK("size" >= 0),
	CONSTRAINT "assets_hash_check" CHECK(length("hash") = 64 AND "hash" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
INSERT INTO `assets_prev` (
	`id`, `world_id`, `kind`, `relative_path`, `mime`, `size`, `width`,
	`height`, `alt`, `hash`, `created_at`
)
SELECT
	`id`, `world_id`, `kind`, `relative_path`, `mime`, `size`, `width`,
	`height`, `alt`, `hash`, `created_at`
FROM `assets`;
--> statement-breakpoint
INSERT INTO `assets_prev` (
	`id`, `world_id`, `kind`, `relative_path`, `mime`, `size`, `width`,
	`height`, `alt`, `hash`, `created_at`
)
SELECT
	`id`, `world_id`, `kind`, `relative_path`, `mime`, `size`, `width`,
	`height`, `alt`, `hash`, `created_at`
FROM `assets_quarantine`;
--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `assets_prev` RENAME TO `assets`;--> statement-breakpoint
CREATE INDEX `assets_world_idx` ON `assets` (`world_id`);--> statement-breakpoint
CREATE INDEX `assets_hash_idx` ON `assets` (`hash`);--> statement-breakpoint

-- Restaura solo referencias cuyo asset y fila destino siguen existiendo. Si la
-- purga posterior eliminó el asset o la ficha, el vínculo se queda en NULL.
UPDATE `worlds`
SET `cover_asset_id` = (
	SELECT `r`.`asset_id`
	FROM `assets_quarantine_references` `r`
	WHERE `r`.`table_name` = 'worlds'
		AND `r`.`row_id` = `worlds`.`id`
		AND `r`.`column_name` = 'cover_asset_id'
		AND EXISTS (SELECT 1 FROM `assets` `a` WHERE `a`.`id` = `r`.`asset_id`)
	LIMIT 1
)
WHERE EXISTS (
	SELECT 1
	FROM `assets_quarantine_references` `r`
	WHERE `r`.`table_name` = 'worlds'
		AND `r`.`row_id` = `worlds`.`id`
		AND `r`.`column_name` = 'cover_asset_id'
		AND EXISTS (SELECT 1 FROM `assets` `a` WHERE `a`.`id` = `r`.`asset_id`)
);--> statement-breakpoint
UPDATE `entities`
SET `image_asset_id` = (
	SELECT `r`.`asset_id`
	FROM `assets_quarantine_references` `r`
	WHERE `r`.`table_name` = 'entities'
		AND `r`.`row_id` = `entities`.`id`
		AND `r`.`column_name` = 'image_asset_id'
		AND EXISTS (SELECT 1 FROM `assets` `a` WHERE `a`.`id` = `r`.`asset_id`)
	LIMIT 1
)
WHERE EXISTS (
	SELECT 1
	FROM `assets_quarantine_references` `r`
	WHERE `r`.`table_name` = 'entities'
		AND `r`.`row_id` = `entities`.`id`
		AND `r`.`column_name` = 'image_asset_id'
		AND EXISTS (SELECT 1 FROM `assets` `a` WHERE `a`.`id` = `r`.`asset_id`)
);--> statement-breakpoint
INSERT OR IGNORE INTO `entity_gallery` (`entity_id`, `asset_id`, `position`)
SELECT `r`.`row_id`, `r`.`asset_id`, coalesce(`r`.`position`, 0)
FROM `assets_quarantine_references` `r`
WHERE `r`.`table_name` = 'entity_gallery'
	AND `r`.`column_name` = 'asset_id'
	AND EXISTS (SELECT 1 FROM `entities` `e` WHERE `e`.`id` = `r`.`row_id`)
	AND EXISTS (SELECT 1 FROM `assets` `a` WHERE `a`.`id` = `r`.`asset_id`);--> statement-breakpoint

DROP INDEX IF EXISTS `worlds_cover_asset_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `entities_image_asset_idx`;--> statement-breakpoint
DROP TABLE IF EXISTS `assets_quarantine_references`;--> statement-breakpoint
DROP TABLE IF EXISTS `assets_quarantine`;--> statement-breakpoint
DELETE FROM `schema_migrations` WHERE `id` = '0009_assets_world_fk';--> statement-breakpoint
PRAGMA user_version = 9;--> statement-breakpoint
PRAGMA foreign_keys = ON;
