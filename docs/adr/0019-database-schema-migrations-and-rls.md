# ADR 0019 — Esquema de base de datos, migraciones y RLS

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-15
- **Fecha del documento:** 2026-11-15
- **Issue:** #9
- **Decisiones del registro:** D-017
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0003, ADR 0004, ADR 0011, ADR 0013, ADR 0017

## Contexto

El ADR 0002 fijó PostgreSQL, Drizzle y Zod, y el ADR 0011 el modelo de acceso:
allowlist para la aplicación, membresía y roles por mundo, y mundos propios. El
plan de desarrollo describe 24 tablas, pero no existía el modelo ejecutable: ni
esquema, ni migraciones, ni políticas, ni una forma de comprobar el aislamiento.

Sin ese cierre, cada issue de M1 inventaría tablas, nombres de índices y reglas
de acceso, y el requisito «el `owner` no puede perderse sin transferir» quedaría a
merced de la aplicación. Además hay tres restricciones del entorno: no hay Docker
ni Supabase CLI, no se pueden usar credenciales en la CI y el coste objetivo es
0 €/mes.

Este ADR registra las decisiones del modelo y de su operación, no las detalla
tabla por tabla: el diccionario, la matriz de RLS y los índices viven en
[`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md).

## Decisión

1. **Una cadena única de migraciones.** `drizzle/0000`–`0006` comparten el
   journal de Drizzle Kit: la `0001` la genera `drizzle-kit generate` y el resto
   es SQL custom revisado (`--custom`). Nada de carpetas paralelas ni de
   `supabase/migrations`.
2. **`world_id` directo en las tablas de primer nivel y derivado en las hijas.**
   `worlds`, `world_members`, `world_invitations`, `entity_types`, `entities`,
   `relation_types`, `relations`, `tags`, `assets`, `maps`, `manuscripts`,
   `game_tables`, `game_content_packs`, `game_sessions` y `activity_log` llevan
   `world_id`; `entity_tags`, `map_entity_links`, `books`, `chapters`, `scenes`,
   `scene_versions` y `game_table_entries` lo resuelven con funciones
   `app.*_world_id`.
3. **RLS con funciones `security definer` en un esquema `app` no expuesto.** Las
   funciones de políticas y triggers llevan `set search_path = ''`, nombres
   cualificados y `execute` concedido una a una; el helper
   `app.immutable_array_to_string` es la excepción: es `IMMUTABLE` (lo exige la
   columna generada) y también fija `search_path = ''`. Las políticas usan
   `(select auth.uid())` para evaluar el claim una vez por
   consulta y `(select app.…())` para aprovechar el `initPlan`.
4. **`allowed_emails` es solo del servidor.** RLS activa, **cero políticas**, cero
   privilegios y nada de `execute` sobre `app`: la allowlist no se puede
   enumerar ni desde una sesión válida.
5. **Un único `owner` por mundo, con `worlds.owner_id` como fuente de verdad.**
   Un índice único parcial y dos triggers lo garantizan, y
   `app.transfer_world_ownership` hace la transferencia en una transacción:
   primero `worlds.owner_id`, luego degrada al antiguo owner a `editor` y promueve
   al nuevo. Sin función no se puede transferir; con ella no hay estado
   intermedio.
6. **Privilegios fail-closed.** `0006_grants` revoca todo a `anon` y
   `authenticated`, revoca los privilegios por defecto de tablas, secuencias y
   funciones futuras y concede por tabla y, cuando importa, por columna
   (`worlds` sin `owner_id`, `assets` solo `alt`). Una tabla nueva nace cerrada.
7. **Seed fuera de las migraciones.** El catálogo del sistema (12 tipos de entidad
   y 15 de relación) vive en JSON, se valida con Zod y se aplica con un `upsert`
   idempotente por el índice único parcial de `key` con `world_id is null`.
8. **Dos cadenas de conexión.** `DATABASE_URL` es el pooler transaccional (6543)
   del runtime, con `prepare: false` y `max: 1`; `DIRECT_URL` es el pooler de
   sesión (5432) de migraciones, seed, reset, verificación y pruebas de RLS.
9. **Validación perezosa y estricta del entorno de base de datos.** Importar
   `src/lib/db/env.ts` no valida nada; `readDatabaseUrl` y `readDirectUrl` fallan
   con un mensaje accionable. Así `next build` y la CI funcionan sin credenciales.
10. **Pruebas de RLS contra la base real, no con mocks.** Cuatro identidades
    (owner, editor, viewer y ajeno), transacción revertida con centinela y
    usuarios insertados en `auth.users` desde el proceso de test.
11. **`StorageAdapter` sin implementación de R2.** Se fija el contrato
    (`upload`, `getSignedUrl`, `delete`, `list`), la caducidad máxima de una hora y
    los códigos de error; el bucket y las subidas llegan con M0-10.

Además:

- `drizzle-kit push` queda **prohibido**: el esquema solo se aplica con
  migraciones versionadas y revisadas.
- Cada migración tiene rollback documentado en `drizzle/rollback/`; ninguna
  herramienta lo aplica automáticamente.
- RLS activa en las 24 tablas, incluidas las que no tienen políticas.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| RLS con el DSL de Drizzle | No cubre triggers, privilegios de columna, funciones `security definer` ni `notify pgrst`; en una decisión de seguridad el SQL explícito es más revisable. |
| Migraciones solo SQL, sin Drizzle Kit | Se pierde el diff automático, la comprobación de deriva y los tipos generados; el plan exige Drizzle Kit. |
| Supabase CLI + Docker | No hay Docker ni CLI en el entorno y añadirlos contradice el alcance y el coste. |
| `drizzle-kit push` en desarrollo | No versiona, no es reversible y puede borrar políticas y triggers que el esquema Drizzle no modela. |
| `world_id` duplicado en todas las tablas | Políticas más simples, pero siete columnas redundantes que hay que mantener coherentes con triggers en cada `insert`; el coste se paga igual y la derivación es más corta. |
| Políticas con `auth.uid()` sin `select` | PostgreSQL no lo trata como `initPlan` y evalúa el claim por fila; el coste aparece en las listas. |
| `security invoker` con `grant select` en `world_members` | Permitiría leer membresías ajenas o provocaría recursión de políticas; el `security definer` con `search_path = ''` es más seguro. |
| Semilla dentro de una migración | El catálogo evoluciona; cambiar un nombre obligaría a editar una migración aplicada. |
| Usar la Admin API para crear usuarios de prueba | Exigiría `@supabase/supabase-js`, una clave secreta y HTTP; para probar RLS basta un `sub` válido en `auth.users`. |
| Bucket público de R2 | Rompe la regla de datos privados: todo acceso exige URL firmada de corta duración. |

## Consecuencias

### Positivas

- El modelo es ejecutable y verificable: `db:verify` y `test:db` demuestran el
  aislamiento, no lo suponen.
- La aplicación no repite filtros por mundo: la RLS decide y las Server Actions
  vuelven a comprobar el rol.
- Una tabla nueva no se puede exponer por olvido: nace sin privilegios.
- Los nombres de índices y políticas son estables, así que las pruebas y la
  documentación no dependen de detalles implícitos.
- La búsqueda en español y difusa funciona desde el primer día sobre `entities`.

### Negativas y riesgos

- Dos lenguajes de migración (generada y custom) exigen disciplina: el orden del
  journal es la única garantía.
- Drizzle no modela políticas, triggers, funciones ni privilegios: `db:push` y
  `db:generate` no los reproducen y hay que mantener el SQL a mano.
- Las funciones `security definer` son superficie de ataque: un error en
  `search_path` o un `grant` de más abre la puerta. Se mitiga con
  `search_path = ''`, `revoke all` y una prueba que lo exige.
- `pg_dump` manual no sustituye a copias automáticas; un fallo entre copias se
  pierde (ADR 0013).
- La suite de RLS no corre en CI: sin credenciales, la verificación real depende
  de ejecutarla en local.
- El runtime aún no usa la base de datos; el router de conexiones se probará de
  verdad con M1.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Ninguno: no hay interfaz en esta issue. |
| Temas (Claro/Oscuro) | Ninguno directo. `entity_types.color` queda `null` a propósito para que M1-03 lo resuelva con tokens de tema y no con un hex fijo. |
| Accesibilidad | Ninguno directo. Los mensajes de error de los scripts están en español y no se muestran en la interfaz. |
| Seguridad y privacidad | Alto y positivo: RLS en 24 tablas, `anon` sin privilegios, allowlist solo de servidor, owner único con transferencia atómica y bucket privado por contrato. |
| Coste | 0 €/mes: Supabase Free, sin servicios añadidos. El seed son 27 filas. |
| Portabilidad de datos | Alta: PostgreSQL estándar, migraciones en el repo, catálogo en JSON y exportación prevista en M5. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Tamaño de la base | 500 MB | Los binarios viven en R2; solo texto, JSONB y metadatos; revisión mensual | ADR 0013; M5 |
| Pausa por inactividad | ~1 semana | Keep-alive con consulta real y monitor | M0-11 (issue [#41](https://github.com/gonzalitojh/world-craft/issues/41)) |
| Sin copias automáticas | — | `pg_dump` cifrado, comprobación de lectura y restauración documentada | ADR 0013; M5-06 |
| Conexiones del pooler | Límite de Free | `max: 1` por instancia y `prepare: false` | Revisión al superar el 70 % |
| Proyecto de desarrollo inexistente | Bloquea la verificación real | `db:ping` como puerta de entrada y trabajo en `in_progress` hasta tener credenciales | Issue #9 |

## Plan de revisión

Se revisa si Supabase cambia los límites del plan Free, si una versión de
PostgreSQL deja de soportar `pg_trgm` o las columnas generadas, si el modelo de
roles cambia o si una prueba de RLS detecta una fuga. Cualquier cambio de
proveedor de base de datos exige un ADR nuevo. La autenticación (M1-01) puede
obligar a revisar `worlds_insert_own` y `on_world_created` cuando el `owner_id` se
derive de la sesión en el servidor.

## Referencias

- Issue: [#9](https://github.com/gonzalitojh/world-craft/issues/9)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.3, §3.4 y §7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-017
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md)
- [`docs/base-de-datos/operacion.md`](../base-de-datos/operacion.md)
- [`drizzle/rollback/README.md`](../../drizzle/rollback/README.md)
- [ADR 0002](0002-supabase-postgres-drizzle-zod.md), [ADR 0003](0003-supabase-auth-allowlist-invitations.md),
  [ADR 0004](0004-cloudflare-r2-storage-adapter.md),
  [ADR 0011](0011-allowlist-world-roles-own-worlds.md) y
  [ADR 0013](0013-free-tier-continuity.md)
- Documentación oficial de Supabase (RLS, pooler y roles), Drizzle ORM, Drizzle
  Kit y PostgreSQL 15 (columnas generadas, `pg_trgm`, `security definer`),
  consultada el 15/11/2026.
