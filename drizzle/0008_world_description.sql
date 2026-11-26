ALTER TABLE `worlds` ADD `description_text` text;--> statement-breakpoint

-- La descripción pasa de texto plano a un documento ProseMirror validado y su
-- texto plano derivado. No se añade un CHECK a `worlds`: SQLite exigiría
-- reconstruir la tabla raíz, referenciada por assets, activity_log,
-- entity_types, entities, tags, relations, search_documents y sus triggers. La
-- forma se valida con Zod en el IPC, el esquema cerrado del editor y el
-- servicio; el texto plano se recalcula siempre en el proceso principal.

-- Una descripción compuesta solo por espacios es una descripción vacía.
UPDATE `worlds`
SET `description` = NULL
WHERE `description` IS NOT NULL AND trim(`description`) = '';--> statement-breakpoint

-- Convierte cada línea no vacía en un párrafo. La tabla temporal evita
-- concatenar cadenas para construir el JSON: `json_object` y
-- `json_group_array(... ORDER BY ...)` escapan comillas y barras. Requiere
-- SQLite >= 3.44, garantizado por better-sqlite3 13.x (3.54 en este equipo).
CREATE TEMP TABLE `world_description_paragraphs` AS
WITH RECURSIVE
source AS (
	SELECT
		`id`,
		replace(
			replace(
				replace(`description`, char(13) || char(10), char(10)),
				char(13),
				char(10)
			),
			char(9),
			' '
		) AS `text`
	FROM `worlds`
	WHERE `description` IS NOT NULL
),
collapsed AS (
	SELECT `id`, `text` FROM source
	UNION ALL
	SELECT `id`, replace(`text`, '  ', ' ') FROM collapsed
	WHERE instr(`text`, '  ') > 0
),
final_text AS (
	-- El sentinel final garantiza que el último párrafo también se cierre.
	SELECT `id`, `text` || char(10) AS `text`
	FROM collapsed
	WHERE instr(`text`, '  ') = 0
),
split AS (
	SELECT `id`, 1 AS `start_at`, `text` FROM final_text
	UNION ALL
	SELECT
		`id`,
		instr(substr(`text`, `start_at`), char(10)) + `start_at`,
		`text`
	FROM split
	WHERE instr(substr(`text`, `start_at`), char(10)) > 0
)
SELECT
	`id`,
	`start_at` AS `ordinal`,
	trim(
		substr(
			`text`,
			`start_at`,
			instr(substr(`text`, `start_at`), char(10)) - 1
		)
	) AS `body`
FROM split
WHERE instr(substr(`text`, `start_at`), char(10)) > 0
	AND length(
		trim(
			substr(
				`text`,
				`start_at`,
				instr(substr(`text`, `start_at`), char(10)) - 1
			)
		)
	) > 0;--> statement-breakpoint

-- Un texto que solo contenía saltos o espacios queda vacío tras la conversión.
UPDATE `worlds`
SET `description` = NULL,
	`description_text` = NULL
WHERE `description` IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM `world_description_paragraphs` `p`
		WHERE `p`.`id` = `worlds`.`id`
	);--> statement-breakpoint

UPDATE `worlds`
SET `description` = (
		SELECT json_object(
			'type', 'doc',
			'content', json_group_array(
				json_object(
					'type', 'paragraph',
					'content', json_array(
						json_object('type', 'text', 'text', `p`.`body`)
					)
				)
				ORDER BY `p`.`ordinal`
			)
		)
		FROM `world_description_paragraphs` `p`
		WHERE `p`.`id` = `worlds`.`id`
	),
	`description_text` = (
		SELECT group_concat(`p`.`body`, char(10) ORDER BY `p`.`ordinal`)
		FROM `world_description_paragraphs` `p`
		WHERE `p`.`id` = `worlds`.`id`
	)
WHERE `description` IS NOT NULL
	AND EXISTS (
		SELECT 1
		FROM `world_description_paragraphs` `p`
		WHERE `p`.`id` = `worlds`.`id`
	);--> statement-breakpoint

DROP TABLE `world_description_paragraphs`;--> statement-breakpoint

-- La vista de búsqueda del mundo indexa solo el texto plano, nunca el JSON.
DROP VIEW `search_world_documents`;--> statement-breakpoint
CREATE VIEW `search_world_documents` AS
SELECT
	'world:' || `w`.`id` AS `id`,
	'world' AS `kind`,
	`w`.`id` AS `source_id`,
	NULL AS `context_id`,
	NULL AS `related_id`,
	`w`.`id` AS `world_id`,
	`w`.`name` AS `title`,
	coalesce(`w`.`summary`, '') || char(10) || coalesce(`w`.`description_text`, '') AS `body`,
	coalesce(`w`.`genres`, '') AS `keywords`,
	NULL AS `entity_type_id`,
	`w`.`status` AS `status`,
	0 AS `is_favorite`,
	`w`.`created_at` AS `created_at`,
	`w`.`updated_at` AS `updated_at`
FROM `worlds` `w`
WHERE `w`.`deleted_at` IS NULL;--> statement-breakpoint

-- Repuebla los documentos de mundo ya migrados; el resto de tipos no cambia.
DELETE FROM `search_documents` WHERE `kind` = 'world';--> statement-breakpoint
INSERT OR REPLACE INTO `search_documents` (`id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`)
SELECT `id`, `kind`, `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`, `keywords`, `entity_type_id`, `status`, `is_favorite`, `created_at`, `updated_at`
FROM `search_world_documents`;--> statement-breakpoint

-- El índice FTS se reconstruye al final: nunca queda sirviendo JSON intermedio.
INSERT INTO `search_fts` (`search_fts`) VALUES ('rebuild');
