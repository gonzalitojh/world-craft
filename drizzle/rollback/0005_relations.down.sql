-- Rollback de referencia de la migración 0005_relations.
-- No se ejecuta automáticamente: la vía segura es restaurar la copia previa.
-- Solo toca las tablas nuevas y el registro de la migración. Los mundos, su
-- actividad, los tipos de entidad, las fichas, las etiquetas y los assets no se
-- tocan. Las relaciones y los tipos personalizados se pierden si se ejecuta
-- sobre datos reales; la restauración de la copia previa es obligatoria antes de
-- usarlo en producción.
DROP INDEX IF EXISTS `relations_type_idx`;
DROP INDEX IF EXISTS `relations_world_target_idx`;
DROP INDEX IF EXISTS `relations_world_source_idx`;
DROP INDEX IF EXISTS `relations_unique`;
DROP TABLE IF EXISTS `relations`;
DROP INDEX IF EXISTS `relation_types_world_idx`;
DROP INDEX IF EXISTS `relation_types_system_key_uq`;
DROP INDEX IF EXISTS `relation_types_world_key_uq`;
DROP TABLE IF EXISTS `relation_types`;
DELETE FROM `schema_migrations` WHERE `id` = '0005_relations';
PRAGMA user_version = 5;
