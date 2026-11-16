-- Rollback de 0000_extensions_and_schemas.sql
--
-- **No lo aplica Drizzle Kit**: es documentación revisable. Se ejecuta a mano,
-- con copia de seguridad previa, y solo en un proyecto de desarrollo.
--
-- La extensión `pg_trgm` **no se elimina**: puede estar en uso por otros
-- objetos del proyecto y volver a crearla es barato. Si se quiere retirar del
-- todo, hay que hacerlo después de borrar los índices trigram (`0001`).

drop schema if exists app cascade;
