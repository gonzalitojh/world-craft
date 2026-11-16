# Operación de la base de datos

> **Estado:** vigente desde el 15/11/2026 (issue
> [#9](https://github.com/gonzalitojh/world-craft/issues/9), M0-08).
> **Ámbito:** arranque, migraciones, seed, verificación, reset, copias de
> seguridad y runbook de incidencias.
> **Modelo de datos:** [`esquema.md`](esquema.md).
> **Decisión asociada:** [ADR 0019](../adr/0019-database-schema-migrations-and-rls.md).

Este documento explica cómo se opera PostgreSQL de World Craft: qué comando se
ejecuta, qué toca y qué se hace cuando algo falla. No contiene credenciales ni
valores reales.

## 1. Requisitos

- Un proyecto **Supabase Free** de desarrollo. El de producción lo crea el
  propietario cuando haya versión estable.
- Las variables de `.env.local` (nunca versionado). `.env.example` es la
  plantilla.
- No hacen falta Docker ni Supabase CLI: las migraciones se aplican con Drizzle
  Kit contra el proyecto.

| Variable | Secreto | La usa |
|---|---|---|
| `SUPABASE_URL` | No | Futuro cliente de Auth (M1-01). |
| `SUPABASE_ANON_KEY` | No (público por diseño) | Futuro cliente de Auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | Solo servidor. |
| `DATABASE_URL` | **Sí** | Runtime de la aplicación: pooler transaccional (6543). |
| `DIRECT_URL` | **Sí** | Migraciones, seed, reset, `db:verify`, `db:ping` y `test:db`: pooler de sesión (5432). |

## 2. Las dos cadenas de conexión

Supabase ofrece dos rutas al mismo PostgreSQL y **no son intercambiables**:

| Cadena | Puerto | Modo | Uso en el proyecto |
|---|---|---|---|
| `DATABASE_URL` | 6543 | Pooler transaccional (PgBouncer) | `getPrivilegedDb()` en el runtime serverless. Exige `prepare: false`. |
| `DIRECT_URL` | 5432 | Pooler de sesión | Todo el tooling: `drizzle-kit migrate`, seed, reset, verificación y pruebas de RLS. |

Por qué:

- El pooler transaccional no mantiene estado de sesión entre sentencias, así que
  no admite sentencias preparadas con nombre (`prepare: false`) ni un
  `set local role` que dure varias consultas.
- Las migraciones y las pruebas de RLS necesitan una sesión estable. El pooler de
  sesión también resuelve el problema de redes sin IPv6, porque la conexión
  directa de Supabase solo ofrece IPv6 en algunos proyectos.

`src/lib/db/client.ts` y `src/lib/db/session.ts` leen el entorno de forma
**perezosa**: importar el módulo no abre conexión ni valida variables, así que
`next build` y la CI funcionan sin credenciales. El error aparece al conectar,
con un mensaje que dice qué variable falta.

## 3. Comandos

| Comando | Qué hace | ¿Necesita credenciales? |
|---|---|---|
| `pnpm db:ping` | Comprueba conexión, cambio al rol `authenticated` y `auth.uid()`. No modifica nada. | Sí (`DIRECT_URL`). |
| `pnpm db:generate` | Genera una migración a partir del diff del esquema Drizzle. | No. |
| `pnpm db:migrate` | Aplica las migraciones pendientes del journal. | Sí (`DIRECT_URL`). |
| `pnpm db:seed` | Upsert idempotente del catálogo del sistema. | Sí (`DIRECT_URL`). |
| `pnpm db:verify` | Comprueba tablas, enums, `pg_trgm`, FTS, RLS, grants y seed. No modifica nada. | Sí (`DIRECT_URL`). |
| `pnpm db:reset` | **Destructivo.** Borra los esquemas `public`, `app` y `drizzle` y recrea `public`. No migra ni siembra. | Sí (`DIRECT_URL`) y `CONFIRM_DB_RESET=world-craft-dev:<ref>`. |
| `pnpm db:check` | Valida journal y snapshots de Drizzle Kit. | No. |
| `pnpm test:db` | Pruebas de integración y RLS contra la base real. | Sí (`DIRECT_URL`). |

Todos los scripts de `scripts/db/`:

- cargan `.env.local` (o `.env`) sin sobrescribir el entorno del proceso;
- los que escriben (`db:reset` y `db:seed`) se niegan a ejecutarse con
  `NODE_ENV=production`;
- imprimen la cadena de conexión con la contraseña oculta (`redactUrl`);
- terminan con código 1 si una comprobación falla.

## 4. Arranque desde cero

```bash
# 1. Variables locales
cp .env.example .env.local        # PowerShell: Copy-Item .env.example .env.local

# 2. Que el proyecto responda y la sesión de usuario se pueda simular
pnpm db:ping

# 3. Cadena de migraciones (7)
pnpm db:migrate

# 4. Catálogo del sistema
pnpm db:seed

# 5. Comprobación del modelo aplicado
pnpm db:verify

# 6. Aislamiento real por mundo
pnpm test:db
```

Este es el criterio de «aplica desde cero»: `db:reset` + `db:migrate` + `db:seed`
+ `db:verify` + `test:db` sobre el proyecto limpio. La salida se anota en el task
file de la issue que lo ejecute.

## 5. Migraciones

La cadena es **lineal y única** en `drizzle/`:

| Migración | Origen | Contenido |
|---|---|---|
| `0000_extensions_and_schemas.sql` | Custom | `pg_trgm` en `extensions`, esquema `app` cerrado. |
| `0001_schema.sql` | `drizzle-kit generate` | Enums, 24 tablas, claves, `check`, índices y `search_vector`. |
| `0002_functions_and_triggers.sql` | Custom | FKs hacia `auth.users` y el ciclo de `assets`, funciones `app.*`, triggers. |
| `0003_rls_core.sql` | Custom | RLS de perfiles, allowlist, mundos, miembros e invitaciones. |
| `0004_rls_content.sql` | Custom | RLS de taxonomías, fichas, relaciones, etiquetas, assets, mapas y manuscritos. |
| `0005_rls_game_and_activity.sql` | Custom | RLS de juego y actividad. |
| `0006_grants.sql` | Custom | Cierre por defecto, privilegios por tabla y columna, recarga de la Data API. |

`0000` va antes que `0001` porque `entities` usa `extensions.gin_trgm_ops` y las
políticas llaman a funciones de `app`.

### 5.1 Cambiar el modelo

1. Edita `src/lib/db/schema/`.
2. `pnpm db:generate` para el diff y `pnpm db:check` para validarlo.
3. Revisa el SQL generado. Lo que Drizzle no modela (políticas, triggers,
   funciones, privilegios, FKs externas) va en una migración `--custom` nueva,
   nunca dentro de una ya aplicada.
4. Añade el rollback a `drizzle/rollback/`.
5. Aplica con `pnpm db:migrate` y verifica con `pnpm db:verify` y `pnpm test:db`.
6. Si cambia el modelo de datos, revisa exportación/importación y este
   documento.

### 5.2 Reglas

- **Nunca se edita una migración aplicada.** Se corrige con otra hacia delante.
- **`drizzle-kit push` está prohibido.** No versiona, no es reversible y borra
  objetos que el esquema Drizzle no conoce (políticas, triggers, funciones,
  privilegios). Si alguien lo ejecuta por error: no continúes, compara con el
  journal, restaura desde backup si hace falta y documenta la incidencia.
- El journal (`drizzle/meta/_journal.json`) es la fuente del orden. Un hueco o un
  duplicado rompe `db:verify`.
- Los rollbacks de `drizzle/rollback/` están **documentados, no automatizados**:
  ninguna herramienta los aplica.

## 6. Seed

`pnpm db:seed` inserta el catálogo del sistema (12 tipos de entidad y 15 de
relación) con `insert … on conflict (key) where world_id is null do update`.

- **Idempotente:** dos ejecuciones dejan los mismos conteos y no duplican filas.
- **No borra:** si un tipo desaparece del JSON, la fila se conserva hasta que una
  migración decida su retirada, para no romper referencias.
- El JSON se valida en `src/lib/db/seed/catalog.ts` (claves únicas, iconos
  permitidos, `world_id: null`, `is_system: true`, sin correos) y otra vez en el
  script antes de tocar la base.
- El catálogo de juego del sistema llega con M4-04.

## 7. Reset del proyecto de desarrollo

El script imprime el token exacto si la confirmación no coincide. Se ata al
proyecto para que no valga copiarlo de otro destino:

```powershell
$env:CONFIRM_DB_RESET = 'world-craft-dev:<ref>'; pnpm db:reset; Remove-Item Env:CONFIRM_DB_RESET
```

`<ref>` es la referencia del proyecto Supabase (el sufijo de `postgres.<ref>` o
el subdominio de `db.<ref>.supabase.co`); en un PostgreSQL local es el host.

### 7.1 Qué hace

1. Elimina el esquema `drizzle` (registro de migraciones) **antes** que `app` y
   `public`, para que un fallo a mitad no deje migraciones marcadas como
   aplicadas sobre un esquema vacío.
2. Elimina `app` y `public` en cascada y recrea `public`.
3. Restaura el propietario `pg_database_owner` (PostgreSQL 15+) y, si el rol
   `authenticated` existe, su `usage`.
4. **No** aplica migraciones ni seed: el siguiente paso es `pnpm db:migrate` y
   `pnpm db:seed`.

### 7.2 Protecciones

- `NODE_ENV=production` lo bloquea.
- Exige `CONFIRM_DB_RESET=world-craft-dev:<ref>` atado al host del proyecto.
- Solo imprime el host con la contraseña oculta.
- No existe un reset «silencioso»: nunca se ejecuta como parte de `db:migrate`.

## 8. Pruebas de integración y RLS

`pnpm test:db` usa `vitest.db.config.ts`, que:

- incluye solo `tests/db/**/*.test.ts`;
- ejecuta los archivos **en serie** (`fileParallelism: false`) para que dos suites
  no compitan por los mismos fixtures;
- falla si falta `DIRECT_URL` en lugar de omitir las pruebas: una suite de RLS que
  se salta en silencio no demuestra nada.

Cómo se simula un usuario (`tests/db/helpers/session.ts`):

```sql
set local role authenticated;
select set_config('request.jwt.claim.sub', '<uuid-del-usuario>', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
```

- Todo ocurre dentro de una transacción que **siempre** se revierte con un
  centinela, así que las pruebas no dejan datos.
- Los fixtures base (usuarios, mundos, membresías, fichas, mapas, manuscrito
  completo) se crean antes, con la conexión privilegiada.
- Los usuarios de prueba se insertan en `auth.users` con correos
  `test-*@world-craft.invalid`; no se envía ningún correo ni se usa la Admin API.
- Las suites cubren owner, editor, viewer y usuario ajeno, el aislamiento entre
  mundos, los triggers de propiedad y la matriz de privilegios.

`pnpm test:db` **no** se ejecuta en CI: no hay credenciales de Supabase en
GitHub Actions y añadirlas exige un ADR.

## 9. Copias de seguridad y restauración

Supabase Free no ofrece copias automáticas. Mientras M5-06 no aporte el flujo
completo, la copia se hace a mano:

```bash
# Copia lógica completa (esquema public y datos)
pg_dump "$DIRECT_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file=world-craft-$(date +%Y%m%d).dump

# Comprobación de que la copia se puede leer
pg_restore --list world-craft-20260101.dump | head
```

- Guarda la copia **fuera** del repositorio y cifrada si contiene datos reales.
- Los binarios no están en la base: un mundo completo necesita exportación JSON +
  assets de R2 (M5).
- Cadencia provisional: antes de cada cambio destructivo y una vez por semana.
- La contraseña nunca se escribe en el comando ni en el historial: usa la
  variable de entorno.

### 9.1 Restauración

1. Detén las escrituras (mantenimiento o preview apagada).
2. Crea un proyecto limpio o vacía el actual con `pnpm db:reset`.
3. Si el volcado incluye el esquema: `pg_restore --no-owner --no-privileges`.
   Si solo incluye datos: aplica primero `pnpm db:migrate`.
4. Ejecuta `pnpm db:verify` y `pnpm test:db`.
5. Revisa que los privilegios siguen cerrados: el `pg_restore` puede reintroducir
   `grant` antiguos. Si `db:verify` detecta privilegios de más, aplica
   `0006_grants.sql` otra vez (es idempotente) y vuelve a verificar.
6. Anota la incidencia y el resultado en el task file.

## 10. Límites del plan Free y seguimiento

| Recurso | Límite | Efecto | Mitigación |
|---|---|---|---|
| Tamaño de base de datos | 500 MB | Se acerca el bloqueo de escrituras | Assets en R2, texto y metadatos, purga de papelera, revisión mensual. |
| Pausa por inactividad | ~1 semana | El proyecto no responde | Keep-alive real y monitor (M0-11, issue [#41](https://github.com/gonzalitojh/world-craft/issues/41)). |
| Copias automáticas | Ninguna | Pérdida total ante un fallo | `pg_dump` manual y exportación de mundo (ADR 0013, M5-06). |
| Conexiones del pooler | Limitadas | Errores de conexión bajo carga | `max: 1` por instancia y `prepare: false`. |

Se revisa el consumo al 70 % de cualquier cuota. Si se supera, se decide entre
optimizar o migrar de proveedor; migrar exige un ADR nuevo.

## 11. Runbook

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `Falta DIRECT_URL` | `.env.local` incompleto | Copia `.env.example`, pega la cadena del pooler de sesión y repite. |
| `DIRECT_URL debe empezar por postgres://` | Cadena con espacios o comillas | Revisa el valor; no incluyas comillas ni saltos de línea. |
| `Los scripts de base de datos no se ejecutan con NODE_ENV=production` | Entorno de producción exportado | Desactiva `NODE_ENV` en la sesión; estos scripts son solo de desarrollo. |
| Error de certificado TLS | Red que intercepta o `sslmode` ausente | Usa la cadena con `sslmode=require` del panel de Supabase. |
| `getaddrinfo ENOTFOUND` o timeouts | Conexión directa IPv6 no disponible | Usa el pooler de sesión (`DIRECT_URL`, puerto 5432). |
| `El rol activo es …, no authenticated` en `db:ping` | Proyecto sin roles de Supabase o sin permiso de cambio de rol | Comprueba que es un proyecto Supabase y que la cadena es la del pooler de sesión. |
| `42501 permission denied` al leer una tabla | Falta un `grant`, no una política | Comprueba `0006_grants.sql`; una tabla nueva nace cerrada y hay que concederla. |
| `42501` al escribir una fila | `with check` de la política o privilegio de columna | Revisa la matriz de RLS de [`esquema.md`](esquema.md) §8. |
| Cero filas donde debería haber datos | Política de lectura (`using`) o `auth.uid()` nulo | Verifica que la sesión fija el claim `sub`; sin sesión no se ve nada. |
| `db:verify` acusa migraciones distintas | Journal y `drizzle.__drizzle_migrations` no coinciden | No apliques nada a mano: compara el journal, restaura o vuelve a migrar desde cero en desarrollo. |
| `db:verify` acusa tablas o políticas | Base a medio migrar o `push` accidental | `pnpm db:reset` y vuelve a aplicar la cadena. |
| El seed duplica o falla | Índice parcial renombrado o catálogo inválido | Ejecuta `pnpm test` (valida el catálogo) y revisa los índices únicos parciales. |
| `db:reset` cancela | Falta la confirmación o no coincide con el proyecto | Copia el token `CONFIRM_DB_RESET=world-craft-dev:<ref>` que imprime el propio script solo para el proyecto de desarrollo. |
| El proyecto no responde en frío | Pausa por inactividad | Restáuralo desde el panel de Supabase y ejecuta `pnpm db:ping`. |

## 12. Producción

- El proyecto de producción lo crea el propietario; el repositorio no contiene
  credenciales suyas.
- Las migraciones se aplican **solo** con `pnpm db:migrate` contra la cadena de
  producción y tras un backup verificado. Los scripts que borran (`db:reset`) se
  niegan a ejecutarse con `NODE_ENV=production`.
- En producción no se revierte con SQL: se restaura el backup más reciente o se
  escribe una migración que corrija hacia delante.
- El esquema `app` **no** se expone en la Data API y `anon` no tiene privilegios.
  Si el panel de Supabase se reconfigura, compruébalo antes de dar por buena una
  versión.
- El runtime usa `DATABASE_URL` (pooler transaccional) con `prepare: false` y
  `max: 1`.

## 13. Seguridad operativa

- Prohibido pegar credenciales en issues, capturas, logs o documentación. Los
  mensajes de los scripts redactan la contraseña; no la añadas tú.
- `SUPABASE_SERVICE_ROLE_KEY` y las cadenas de conexión solo viven en variables
  de entorno del servidor.
- La conexión privilegiada (`getPrivilegedDb`) se usa para migraciones, seed,
  scripts administrativos y tareas de servidor que necesiten ver todos los
  mundos. Las consultas de datos de usuario pasan siempre por
  `withUserSession`, que activa la RLS.
- Si se detecta una fuga: detente, no publiques, rota la credencial y documenta
  el incidente (regla 12 de [`AGENTS.md`](../../AGENTS.md)).

## 14. Enlaces

- [`esquema.md`](esquema.md): modelo, RLS y privilegios.
- [`drizzle/rollback/README.md`](../../drizzle/rollback/README.md): rollback por
  migración.
- [`docs/adr/0019-database-schema-migrations-and-rls.md`](../adr/0019-database-schema-migrations-and-rls.md):
  decisiones y alternativas.
- [`docs/adr/0013-free-tier-continuity.md`](../adr/0013-free-tier-continuity.md):
  continuidad de los planes gratuitos.
