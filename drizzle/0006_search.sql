CREATE TABLE `search_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`context_id` text,
	`related_id` text,
	`world_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`entity_type_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_favorite` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "search_documents_kind_check" CHECK("search_documents"."kind" in ('world', 'entity', 'relation', 'map', 'manuscript', 'scene')),
	CONSTRAINT "search_documents_status_check" CHECK("search_documents"."status" in ('active', 'draft', 'archived')),
	CONSTRAINT "search_documents_favorite_check" CHECK("search_documents"."is_favorite" in (0, 1)),
	CONSTRAINT "search_documents_title_check" CHECK(length("search_documents"."title") between 1 and 300)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_documents_kind_source_uq` ON `search_documents` (`kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `search_documents_world_kind_idx` ON `search_documents` (`world_id`,`kind`,`updated_at`);--> statement-breakpoint
CREATE INDEX `search_documents_world_updated_idx` ON `search_documents` (`world_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `search_documents_type_idx` ON `search_documents` (`entity_type_id`);--> statement-breakpoint
CREATE INDEX `search_documents_favorite_idx` ON `search_documents` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `search_documents_context_idx` ON `search_documents` (`kind`,`context_id`);--> statement-breakpoint
CREATE INDEX `search_documents_related_idx` ON `search_documents` (`kind`,`related_id`);--> statement-breakpoint
CREATE VIRTUAL TABLE `search_fts` USING fts5(
	`title`,
	`body`,
	`keywords`,
	content='search_documents',
	content_rowid='rowid',
	tokenize='unicode61 remove_diacritics 2',
	prefix='2 3 4'
);--> statement-breakpoint
CREATE VIRTUAL TABLE `search_vocabulary` USING fts5vocab(`search_fts`, 'row');--> statement-breakpoint
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
CREATE VIEW `search_entity_documents` AS
SELECT
	'entity:' || `e`.`id` AS `id`,
	'entity' AS `kind`,
	`e`.`id` AS `source_id`,
	NULL AS `context_id`,
	NULL AS `related_id`,
	`e`.`world_id` AS `world_id`,
	`e`.`name` AS `title`,
	coalesce(`e`.`summary`, '') || char(10) || coalesce(`e`.`description_text`, '') AS `body`,
	coalesce(`e`.`aliases`, '') || ' ' || coalesce((
		SELECT group_concat(`t`.`name`, ' ')
		FROM `entity_tags` `et`
		JOIN `tags` `t` ON `t`.`id` = `et`.`tag_id`
		WHERE `et`.`entity_id` = `e`.`id`
	), '') AS `keywords`,
	`e`.`type_id` AS `entity_type_id`,
	`e`.`status` AS `status`,
	`e`.`is_favorite` AS `is_favorite`,
	`e`.`created_at` AS `created_at`,
	`e`.`updated_at` AS `updated_at`
FROM `entities` `e`
JOIN `worlds` `w` ON `w`.`id` = `e`.`world_id`
WHERE `e`.`deleted_at` IS NULL AND `w`.`deleted_at` IS NULL;--> statement-breakpoint
CREATE VIEW `search_relation_documents` AS
SELECT
	'relation:' || `r`.`id` AS `id`,
	'relation' AS `kind`,
	`r`.`id` AS `source_id`,
	`r`.`source_id` AS `context_id`,
	`r`.`target_id` AS `related_id`,
	`r`.`world_id` AS `world_id`,
	coalesce(`r`.`label`, `rt`.`name`) || ' — ' || coalesce(`r`.`inverse_label`, `rt`.`inverse_name`) AS `title`,
	coalesce(`r`.`notes`, '') AS `body`,
	`rt`.`name` || ' ' || `rt`.`inverse_name` AS `keywords`,
	NULL AS `entity_type_id`,
	'active' AS `status`,
	0 AS `is_favorite`,
	`r`.`created_at` AS `created_at`,
	`r`.`updated_at` AS `updated_at`
FROM `relations` `r`
JOIN `relation_types` `rt` ON `rt`.`id` = `r`.`type_id`
JOIN `entities` `s` ON `s`.`id` = `r`.`source_id`
JOIN `entities` `t` ON `t`.`id` = `r`.`target_id`
JOIN `worlds` `w` ON `w`.`id` = `r`.`world_id`
WHERE `s`.`deleted_at` IS NULL
	AND `t`.`deleted_at` IS NULL
	AND `w`.`deleted_at` IS NULL;--> statement-breakpoint
CREATE TRIGGER `search_documents_ai` AFTER INSERT ON `search_documents` BEGIN
	INSERT INTO `search_fts` (`rowid`, `title`, `body`, `keywords`)
	VALUES (new.`rowid`, new.`title`, new.`body`, new.`keywords`);
END;--> statement-breakpoint
CREATE TRIGGER `search_documents_ad` AFTER DELETE ON `search_documents` BEGIN
	INSERT INTO `search_fts` (`search_fts`, `rowid`, `title`, `body`, `keywords`)
	VALUES ('delete', old.`rowid`, old.`title`, old.`body`, old.`keywords`);
END;--> statement-breakpoint
CREATE TRIGGER `search_documents_au` AFTER UPDATE ON `search_documents` BEGIN
	INSERT INTO `search_fts` (`search_fts`, `rowid`, `title`, `body`, `keywords`)
	VALUES ('delete', old.`rowid`, old.`title`, old.`body`, old.`keywords`);
	INSERT INTO `search_fts` (`rowid`, `title`, `body`, `keywords`)
	VALUES (new.`rowid`, new.`title`, new.`body`, new.`keywords`);
END;--> statement-breakpoint
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
CREATE TRIGGER `entities_search_ai` AFTER INSERT ON `entities` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'entity' AND `source_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_entity_documents` WHERE `source_id` = new.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `entities_search_au` AFTER UPDATE ON `entities` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'entity' AND `source_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_entity_documents` WHERE `source_id` = new.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `entities_search_ad` AFTER DELETE ON `entities` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'entity' AND `source_id` = old.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `entities_search_relations_au` AFTER UPDATE OF `deleted_at` ON `entities`
WHEN old.`deleted_at` IS NOT new.`deleted_at`
BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'relation' AND (`context_id` = new.`id` OR `related_id` = new.`id`);
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_relation_documents` WHERE `context_id` = new.`id` OR `related_id` = new.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `entity_tags_search_ai` AFTER INSERT ON `entity_tags` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'entity' AND `source_id` = new.`entity_id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_entity_documents` WHERE `source_id` = new.`entity_id`;
END;--> statement-breakpoint
CREATE TRIGGER `entity_tags_search_ad` AFTER DELETE ON `entity_tags` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'entity' AND `source_id` = old.`entity_id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_entity_documents` WHERE `source_id` = old.`entity_id`;
END;--> statement-breakpoint
CREATE TRIGGER `tags_search_au` AFTER UPDATE ON `tags` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'entity' AND `source_id` IN (SELECT `entity_id` FROM `entity_tags` WHERE `tag_id` = new.`id`);
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_entity_documents` WHERE `source_id` IN (SELECT `entity_id` FROM `entity_tags` WHERE `tag_id` = new.`id`);
END;--> statement-breakpoint
CREATE TRIGGER `relations_search_ai` AFTER INSERT ON `relations` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'relation' AND `source_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_relation_documents` WHERE `source_id` = new.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `relations_search_au` AFTER UPDATE ON `relations` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'relation' AND `source_id` = new.`id`;
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_relation_documents` WHERE `source_id` = new.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `relations_search_ad` AFTER DELETE ON `relations` BEGIN
	DELETE FROM `search_documents` WHERE `kind` = 'relation' AND `source_id` = old.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `relation_types_search_au` AFTER UPDATE ON `relation_types` BEGIN
	DELETE FROM `search_documents`
	WHERE `kind` = 'relation'
		AND `source_id` IN (SELECT `id` FROM `relations` WHERE `type_id` = new.`id`);
	INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
	SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
	FROM `search_relation_documents`
	WHERE `source_id` IN (SELECT `id` FROM `relations` WHERE `type_id` = new.`id`);
END;--> statement-breakpoint
INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
FROM `search_world_documents`;--> statement-breakpoint
INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
FROM `search_entity_documents`;--> statement-breakpoint
INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
FROM `search_relation_documents`;--> statement-breakpoint
INSERT INTO `search_fts` (`search_fts`) VALUES ('rebuild');