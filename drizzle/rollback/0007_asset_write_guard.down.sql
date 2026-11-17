-- Rollback de 0007 — Guarda de escritura de assets.
--
-- Elimina el trigger y la función. No toca datos: cualquier fila creada con el
-- contexto del servidor sigue siendo válida sin la guarda.

drop trigger if exists guard_asset_insert on public.assets;

drop function if exists app.guard_asset_insert();
