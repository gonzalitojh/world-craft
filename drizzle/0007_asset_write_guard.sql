-- 0007 — Guarda de escritura de assets.
--
-- La RLS de `assets` comprueba el mundo, el cargador y el prefijo de la ruta,
-- pero deja que el cliente elija `bucket`, `mime`, `size`, `width` y `height`.
-- Esos metadatos los fija el servidor tras procesar la imagen con sharp; si un
-- `authenticated` los falsifica, la aplicación podría servir un MIME engañoso o
-- apuntar a un objeto que no existe.
--
-- Esta migración añade un trigger `before insert` que exige el contexto de
-- servidor (`app.asset_write = 'on'` y `app.asset_bucket`) y valida los valores
-- contra los límites del pipeline. El servicio los fija dentro de
-- `withUserSession`; PostgREST no permite fijar GUCs, así que un cliente de la
-- Data API no puede saltarse la guarda.
--
-- La guarda **no** afecta a las migraciones, al seed ni a los scripts: solo se
-- activa cuando el rol efectivo es `authenticated`. Las fixtures privilegiadas
-- siguen pudiendo crear filas sin contexto.
--
-- Límites replicados (si cambian, hace falta una migración nueva):
-- - 10 MiB = 10485760 bytes.
-- - 16..4096 px de lado en el WebP almacenado.
-- - MIME único `image/webp` y extensión `.webp`.

create or replace function app.guard_asset_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- `current_user` dentro de una función security definer es el propietario;
  -- el rol efectivo de la petición queda en el GUC `role` (SET [LOCAL] ROLE).
  v_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
  v_bucket text := current_setting('app.asset_bucket', true);
begin
  if v_role <> 'authenticated' then
    return new;
  end if;

  if current_setting('app.asset_write', true) is distinct from 'on' then
    raise exception 'la escritura de assets requiere el contexto del servidor'
      using errcode = '42501';
  end if;

  if v_bucket is null or new.bucket is distinct from v_bucket then
    raise exception 'bucket de asset no autorizado'
      using errcode = '42501';
  end if;

  if new.mime <> 'image/webp' then
    raise exception 'mime de asset no permitido: %', new.mime
      using errcode = '23514';
  end if;

  if new.size < 1 or new.size > 10485760 then
    raise exception 'tamaño de asset fuera de rango: %', new.size
      using errcode = '23514';
  end if;

  if new.width is null or new.width < 16 or new.width > 4096 then
    raise exception 'ancho de asset fuera de rango: %', new.width
      using errcode = '23514';
  end if;

  if new.height is null or new.height < 16 or new.height > 4096 then
    raise exception 'alto de asset fuera de rango: %', new.height
      using errcode = '23514';
  end if;

  if new.path !~ '^world/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$' then
    raise exception 'ruta de asset no canónica: %', new.path
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function app.guard_asset_insert() is
  'Impide que authenticated falsifique los metadatos de un asset sin el contexto del servidor.';

create trigger guard_asset_insert
  before insert on public.assets
  for each row execute function app.guard_asset_insert();

-- La función es de trigger: no se concede EXECUTE a ningún rol de cliente.
