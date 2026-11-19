# ADR 0002 — SQLite + better-sqlite3 + Drizzle + FTS5

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-021
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0002 de la etapa web (Supabase/Postgres) y ADR 0019
- **Relacionados:** ADR 0005, ADR 0012, ADR 0014, ADR 0016

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

> **Precisión de implementación (M0-04, #64, 18/11/2026).** La issue #64 concreta
> esta decisión sin cambiarla: `better-sqlite3` 13.2.0 usa Node-API 10 y su
> prebuild carga tanto en Node 22.23.5 como en Electron 45.3.4, con SQLite 3.54.1
> y FTS5, así que **no hace falta `electron-rebuild`** para esta versión; queda
> solo como contingencia futura. La base se abre en `userData/data` con una
> conexión única, la integridad se comprueba antes de activar WAL y las
> migraciones las aplica un runner propio sobre el journal de Drizzle, con copia
> previa verificable y modo seguro sin escritura. El detalle está en el
> [ADR 0016](0016-sqlite-migrations-safe-mode.md).

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

- better-sqlite3 es un módulo nativo y hay que empaquetarlo correctamente. La
  implementación de M0-04 comprueba que 13.2.0 usa Node-API 10 y un prebuild
  compartido entre Node y Electron, por lo que no requiere `electron-rebuild`;
  esa reconstrucción queda como contingencia si cambia la compatibilidad.
- SQLite no tiene concurrencia multiusuario; no hace falta en una app local.
- Las consultas síncronas deben ejecutarse en el proceso principal y las largas
  en un utility process.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | La ventana espera a la migración; en M0-04 no hay pantalla de progreso porque la inicial es inmediata. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | Los errores de base se muestran con códigos y acciones. |
| Seguridad y privacidad | Datos locales; sin credenciales ni red. |
| Datos y preservación | Copia previa, transacción e integridad; restauración desde modo seguro (M0-07). |
| Coste | 0 €/mes. |
| Portabilidad de datos | Exportación JSON/ZIP y copia del archivo SQLite. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Módulo nativo en Electron | Cambio de ABI por versión | Node-API 10, versión fijada y `pnpm verify:native`; `electron-rebuild` como contingencia | M0-04 (#64) y #68 |
| Corrupción de SQLite | Fallo de disco o cierre | WAL, integridad, copias y modo seguro | M5 |
| Crecimiento de la base | GB en mundos grandes | Índices, paginación, `VACUUM` con confirmación | M5 |

## Plan de revisión

Se revisa si `node:sqlite` madura y elimina la dependencia nativa, o si el
rendimiento de FTS5 deja de ser suficiente. Cualquier cambio de motor requiere
un ADR nuevo y una migración de datos.

## Referencias

- Issue: #64 — implementación de la persistencia local (M0-04).
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D3–D4 y §3.3
- [`docs/persistencia.md`](../persistencia.md)
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md)
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md)
- [ADR 0016](0016-sqlite-migrations-safe-mode.md): runner de migraciones, copia
  previa y modo seguro.
- Documentación de SQLite, Drizzle y better-sqlite3 consultada el 18/11/2026.
