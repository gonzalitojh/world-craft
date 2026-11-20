-- Rollback de referencia de la migración 0004_entities.
-- No se ejecuta automáticamente: la vía segura es restaurar la copia previa.
-- Solo toca las tablas nuevas y el registro de la migración. Los mundos, su
-- actividad, los tipos de entidad y los assets no se tocan. Las fichas,
-- etiquetas y galerías se pierden si se ejecuta sobre datos reales; la
-- restauración de la copia previa es obligatoria antes de usarlo en producción.
DROP INDEX IF EXISTS `entity_tags_tag_idx`;
DROP TABLE IF EXISTS `entity_tags`;
DROP INDEX IF EXISTS `entity_gallery_asset_idx`;
DROP INDEX IF EXISTS `entity_gallery_position_uq`;
DROP TABLE IF EXISTS `entity_gallery`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `entities`;
DELETE FROM `schema_migrations` WHERE `id` = '0004_entities';
PRAGMA user_version = 4;
