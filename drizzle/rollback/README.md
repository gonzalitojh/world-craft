# Rollback de las migraciones

Drizzle Kit **no genera migraciones `down`** y `drizzle-kit migrate` solo aplica
hacia delante. Esta carpeta guarda el SQL de reversión documentado de cada
migración para que una emergencia no se improvise.

## Reglas

1. **Ninguna migración aplicada se edita.** Un cambio se hace con una migración
   nueva. El rollback de esta carpeta tampoco se ejecuta automáticamente.
2. **En producción no se revierte con SQL.** Se restaura el backup más reciente
   ([`docs/base-de-datos/operacion.md`](../../docs/base-de-datos/operacion.md)) o
   se escribe una migración que corrija el problema hacia delante.
3. **En desarrollo se prefiere `pnpm db:reset`**, que borra los esquemas
   `public`, `app` y `drizzle` y recrea `public`. Después hay que ejecutar
   `pnpm db:migrate` y `pnpm db:seed`. Es destructivo y exige
   `CONFIRM_DB_RESET=world-craft-dev:<ref>` atado al host del proyecto.
4. El rollback de `0006_grants` **no reabre** el esquema con los privilegios por
   defecto de Supabase: dejaría `public` accesible a `anon` y `authenticated`.
5. Antes de un rollback destructivo: copia con `pg_dump`, comprobación de que la
   copia se puede leer y aviso en el task file de la incidencia.

## Índice

| Migración | Rollback | Efecto |
|---|---|---|
| `0000_extensions_and_schemas` | `0000_extensions_and_schemas.down.sql` | Elimina el esquema `app`; conserva `pg_trgm`. |
| `0001_schema` | `0001_schema.down.sql` | **Destructivo**: borra las 24 tablas y los enums. |
| `0002_functions_and_triggers` | `0002_functions_and_triggers.down.sql` | Elimina triggers, funciones y las dos claves foráneas externas. |
| `0003_rls_core` | `0003_rls_core.down.sql` | Elimina políticas y desactiva la RLS del núcleo. |
| `0004_rls_content` | `0004_rls_content.down.sql` | Igual para el contenido. |
| `0005_rls_game_and_activity` | `0005_rls_game_and_activity.down.sql` | Igual para juego y actividad. |
| `0006_grants` | `0006_grants.down.sql` | Solo documenta; no hay sentencias ejecutables. |

## Comprobación

`tests/unit/db/migrations-journal.test.ts` verifica que el journal referencia
archivos existentes, que no hay huecos ni duplicados y que cada migración tiene
su archivo de rollback.
