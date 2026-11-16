-- 0000 — Extensiones y esquemas de apoyo.
--
-- Va antes del esquema generado porque `entities` crea índices trigram con el
-- opclass `extensions.gin_trgm_ops` y las políticas y los triggers llaman a
-- funciones del esquema `app`.
--
-- Reglas:
-- - `app` NO se expone nunca en la Data API (Settings → API → Exposed schemas).
--   Contiene funciones de apoyo: `security definer` para RLS e integridad y
--   helpers puros como el de más abajo.
-- - `anon` no recibe ningún privilegio en `app`.
-- - La extensión `pg_trgm` vive en `extensions`, la convención de Supabase.

create schema if not exists extensions;

create extension if not exists pg_trgm with schema extensions;

create schema if not exists app;

comment on schema app is
  'Funciones de apoyo de World Craft (RLS e integridad). No exponer en la Data API.';

-- `array_to_string` es STABLE (depende de las funciones de salida de los tipos),
-- así que PostgreSQL la rechaza en columnas generadas e índices funcionales, que
-- exigen IMMUTABLE. Este envoltorio fija el comportamiento para `text[]`, donde
-- la conversión es determinista, y se usa en `entities.search_vector` y en
-- `entities_aliases_trgm_idx`.
create or replace function app.immutable_array_to_string(text[], text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select coalesce(pg_catalog.array_to_string($1, $2), '') $$;

comment on function app.immutable_array_to_string(text[], text) is
  'array_to_string(text[], text) marcada IMMUTABLE para generated columns e índices.';

revoke all on function app.immutable_array_to_string(text[], text) from public;

-- El esquema `app` nace cerrado. Los privilegios concretos se conceden en
-- 0006_grants.sql después de crear las funciones.
revoke all on schema app from public;
grant usage on schema app to authenticated;

-- Las funciones nuevas del esquema `app` no deben ser ejecutables por PUBLIC.
alter default privileges in schema app revoke execute on functions from public;
