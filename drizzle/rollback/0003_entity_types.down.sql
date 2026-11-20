-- Rollback de referencia de la migración 0003_entity_types.
-- No se ejecuta automáticamente: la vía segura es restaurar la copia previa.
-- Solo toca el esquema y el registro de la migración. Los tipos personalizados
-- se pierden si se ejecuta sobre datos reales; los mundos y su actividad no se
-- tocan. La restauración de la copia previa es obligatoria antes de usarlo en
-- producción.
DROP INDEX IF EXISTS `entity_types_world_idx`;
DROP INDEX IF EXISTS `entity_types_system_key_uq`;
DROP INDEX IF EXISTS `entity_types_world_key_uq`;
DROP TABLE IF EXISTS `entity_types`;
DELETE FROM `schema_migrations` WHERE `id` = '0003_entity_types';
PRAGMA user_version = 3;
