-- Rollback de referencia de la migración 0006_search.
-- No se ejecuta automáticamente: la vía segura es restaurar la copia previa.
-- Solo toca los objetos del índice de búsqueda y el registro de la migración.
-- Los mundos, su actividad, los tipos, las fichas, las etiquetas, las
-- relaciones y los assets no se tocan. El índice es reconstruible, pero se
-- pierde hasta que se vuelva a aplicar la migración.
DROP TRIGGER IF EXISTS `relation_types_search_au`;
DROP TRIGGER IF EXISTS `tags_search_au`;
DROP TRIGGER IF EXISTS `entity_tags_search_ad`;
DROP TRIGGER IF EXISTS `entity_tags_search_ai`;
DROP TRIGGER IF EXISTS `relations_search_ad`;
DROP TRIGGER IF EXISTS `relations_search_au`;
DROP TRIGGER IF EXISTS `relations_search_ai`;
DROP TRIGGER IF EXISTS `entities_search_relations_au`;
DROP TRIGGER IF EXISTS `entities_search_ad`;
DROP TRIGGER IF EXISTS `entities_search_au`;
DROP TRIGGER IF EXISTS `entities_search_ai`;
DROP TRIGGER IF EXISTS `worlds_search_deleted_au`;
DROP TRIGGER IF EXISTS `worlds_search_au`;
DROP TRIGGER IF EXISTS `worlds_search_ai`;
DROP TRIGGER IF EXISTS `search_documents_au`;
DROP TRIGGER IF EXISTS `search_documents_ad`;
DROP TRIGGER IF EXISTS `search_documents_ai`;
DROP VIEW IF EXISTS `search_relation_documents`;
DROP VIEW IF EXISTS `search_entity_documents`;
DROP VIEW IF EXISTS `search_world_documents`;
DROP TABLE IF EXISTS `search_vocabulary`;
DROP TABLE IF EXISTS `search_fts`;
DROP TABLE IF EXISTS `search_documents`;
DELETE FROM `schema_migrations` WHERE `id` = '0006_search';
PRAGMA user_version = 6;
