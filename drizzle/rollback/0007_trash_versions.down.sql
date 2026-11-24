-- Rollback de referencia de la migración 0007_trash_versions.
-- No se ejecuta automáticamente: la vía segura es restaurar la copia previa.
-- Solo toca la tabla de versiones, los dos índices de papelera y el registro
-- de la migración. Mundos, actividad, tipos, fichas, etiquetas, galerías,
-- relaciones, assets y búsqueda no se tocan. El historial de versiones se
-- pierde al ejecutarlo; la copia previa lo conserva.
DROP INDEX IF EXISTS `entity_types_deleted_idx`;
DROP INDEX IF EXISTS `entities_deleted_idx`;
DROP TABLE IF EXISTS `entity_versions`;
DELETE FROM `schema_migrations` WHERE `id` = '0007_trash_versions';
PRAGMA user_version = 7;
