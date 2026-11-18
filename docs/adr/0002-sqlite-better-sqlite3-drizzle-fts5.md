# ADR 0002 — SQLite + better-sqlite3 + Drizzle + FTS5

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-021
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0002 de la etapa web (Supabase/Postgres) y ADR 0019
- **Relacionados:** ADR 0005, ADR 0012, ADR 0014

## Contexto

La aplicación necesita una base de datos local, transaccional, portable y con
búsqueda de texto completo. Debe funcionar sin servidor, sin Docker y sin
credenciales, y sobrevivir a actualizaciones y copias. El modelo es relacional
(mundos, entidades, relaciones, mapas, escenas, juego) y requiere integridad
referencial.

## Decisión

Usar **SQLite** con:

1. **better-sqlite3** en el proceso principal, con WAL, claves foráneas y
   `busy_timeout`.
2. **Drizzle ORM** para el esquema, las consultas tipadas y las migraciones
   versionadas.
3. **Zod** para validar los datos de entrada y los JSON internos.
4. **FTS5** para búsqueda, con tokenizador `unicode61` y reconstrucción desde la
   app.
5. **Migraciones** en `drizzle/`, aplicadas en transacción y con copia previa.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| `node:sqlite` | API y empaquetado con Electron menos predecibles; better-sqlite3 es más maduro y rápido. |
| libSQL | Añade un componente y no aporta ventajas locales frente a SQLite. |
| JSON/lowdb | Sin integridad referencial, consultas ni búsqueda eficiente. |
| IndexedDB | Almacenamiento de navegador, difícil de copiar y de recuperar. |
| PGlite | Postgres embebido interesante, pero más pesado y con menos madurez en Electron. |
| PostgreSQL remoto | Es la arquitectura web que se abandona: requiere servidor y credenciales. |

## Consecuencias

### Positivas

- Un solo archivo, transaccional y fácil de copiar.
- Búsqueda FTS5 integrada.
- Sin servidor ni credenciales; offline por diseño.
- Migraciones versionadas y reproducibles.
- Drizzle genera SQL legible y tipos precisos.

### Negativas y riesgos

- better-sqlite3 es un módulo nativo: hay que reconstruirlo para Electron y
  empaquetarlo correctamente.
- SQLite no tiene concurrencia multiusuario; no hace falta en una app local.
- Las consultas síncronas deben ejecutarse en el proceso principal y las largas
  en un utility process.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | La ventana espera a la migración; se muestra progreso si tarda. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | Los errores de base se muestran con códigos y acciones. |
| Seguridad y privacidad | Datos locales; sin credenciales ni red. |
| Datos y preservación | Copia previa, transacción, integridad y restauración. |
| Coste | 0 €/mes. |
| Portabilidad de datos | Exportación JSON/ZIP y copia del archivo SQLite. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Módulo nativo en Electron | Rebuild por versión | `electron-rebuild` y CI en Windows | Scaffold M0 |
| Corrupción de SQLite | Fallo de disco o cierre | WAL, integridad, copias y modo seguro | M5 |
| Crecimiento de la base | GB en mundos grandes | Índices, paginación, `VACUUM` con confirmación | M5 |

## Plan de revisión

Se revisa si `node:sqlite` madura y elimina la dependencia nativa, o si el
rendimiento de FTS5 deja de ser suficiente. Cualquier cambio de motor requiere
un ADR nuevo y una migración de datos.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D3–D4 y §3.3
- [`docs/persistencia.md`](../persistencia.md)
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md)
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md)
- Documentación de SQLite, Drizzle y better-sqlite3 consultada el 18/11/2026.
