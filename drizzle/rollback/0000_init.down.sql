-- Rollback de referencia de la migración inicial.
-- No se ejecuta automáticamente: la vía segura es restaurar la copia previa.
DROP TABLE IF EXISTS `app_settings`;
DROP TABLE IF EXISTS `schema_migrations`;
PRAGMA user_version = 0;
