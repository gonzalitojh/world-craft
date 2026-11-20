-- Rollback de referencia de la migración 0002_worlds.
-- No se ejecuta automáticamente: la vía segura es restaurar la copia previa.
-- Solo toca el esquema y el registro de la migración. Los mundos y su actividad
-- se pierden si se ejecuta sobre datos reales, de modo que la restauración de la
-- copia previa es obligatoria antes de usarlo en producción.
DROP INDEX IF EXISTS `activity_log_created_idx`;
DROP INDEX IF EXISTS `activity_log_world_created_idx`;
DROP TABLE IF EXISTS `activity_log`;
DROP INDEX IF EXISTS `worlds_deleted_updated_idx`;
DROP INDEX IF EXISTS `worlds_status_idx`;
DROP INDEX IF EXISTS `worlds_slug_uq`;
DROP TABLE IF EXISTS `worlds`;
DELETE FROM `schema_migrations` WHERE `id` = '0002_worlds';
PRAGMA user_version = 2;
