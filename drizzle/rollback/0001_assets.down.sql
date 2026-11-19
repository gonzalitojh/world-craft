-- Rollback de referencia de la migración 0001_assets.
-- No se ejecuta automáticamente: la vía segura es restaurar la copia previa.
-- Nunca toca los archivos de `assets/`: solo el esquema y el registro de la
-- migración, de modo que `user_version` y `schema_migrations` sigan cuadrando.
DROP INDEX IF EXISTS `assets_hash_idx`;
DROP INDEX IF EXISTS `assets_world_idx`;
DROP TABLE IF EXISTS `assets`;
DELETE FROM `schema_migrations` WHERE `id` = '0001_assets';
PRAGMA user_version = 1;
