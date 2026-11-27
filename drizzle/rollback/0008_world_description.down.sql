-- Rollback de referencia de 0008_world_description.
--
-- Degrada el documento a texto plano con `description_text` (pierde formato y
-- enlaces, nunca el texto visible), restaura la vista de 0006 y deja
-- `user_version` en 8. No se ejecuta automáticamente: el runner solo aplica
-- migraciones hacia delante. Se conserva para recuperación manual o una futura
-- migración inversa.

-- Los triggers de búsqueda del mundo resuelven la vista por nombre. Se retiran
-- mientras se reescribe la tabla y se recrean al final con su definición de
-- 0006, de modo que el rollback deje el esquema de 0006 operativo.
DROP TRIGGER IF EXISTS `worlds_search_ai`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `worlds_search_au`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `worlds_search_deleted_au`;--> statement-breakpoint

UPDATE `worlds` SET `description` = `description_text`;--> statement-breakpoint

DROP VIEW `search_world_documents`;--> statement-breakpoint

ALTER TABLE `worlds` DROP COLUMN `description_text`;--> statement-breakpoint

CREATE VIEW `search_world_documents` AS
SELECT
	'world:' || `w`.`id` AS `id`,
	'world' AS `kind`,
	`w`.`id` AS `source_id`,
	NULL AS `context_id`,
	NULL AS `related_id`,
	`w`.`id` AS `world_id`,
	`w`.`name` AS `title`,
	coalesce(`w`.`summary`, '') || char(10) || coalesce(`w`.`description`, '') AS `body`,
	coalesce(`w`.`genres`, '') AS `keywords`,
	NULL AS `entity_type_id`,
	`w`.`status` AS `status`,
	0 AS `is_favorite`,
	`w`.`created_at` AS `created_at`,
	`w`.`updated_at` AS `updated_at`
FROM `worlds` `w`
WHERE `w`.`deleted_at` IS NULL;--> statement-breakpoint

DELETE FROM `search_documents` WHERE `kind` = 'world';--> statement-breakpoint
INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
FROM `search_world_documents`;--> statement-breakpoint

INSERT INTO `search_fts` (`search_fts`) VALUES ('rebuild');--> statement-breakpoint

CREATE TRIGGER `worlds_search_ai` AFTER INSERT ON `worlds` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'world' AND `source_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_world_documents` WHERE `source_id` = new.`id`;
END;--> statement-breakpoint

CREATE TRIGGER `worlds_search_au` AFTER UPDATE ON `worlds` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'world' AND `source_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_world_documents` WHERE `source_id` = new.`id`;
END;--> statement-breakpoint

CREATE TRIGGER `worlds_search_deleted_au` AFTER UPDATE OF `deleted_at` ON `worlds`
WHEN old.`deleted_at` IS NOT new.`deleted_at`
BEGIN
	DELETE FROM `search_documents` WHERE `world_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_world_documents` WHERE `source_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_entity_documents` WHERE `world_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_relation_documents` WHERE `world_id` = new.`id`;
END;--> statement-breakpoint

DELETE FROM `schema_migrations` WHERE `id` = '0008_world_description';--> statement-breakpoint

PRAGMA user_version = 8;
