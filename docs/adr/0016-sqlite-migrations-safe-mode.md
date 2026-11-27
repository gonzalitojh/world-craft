# ADR 0016 — SQLite, migraciones propias y modo seguro

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-19
- **Issue:** #64
- **Decisiones del registro:** D-040
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0012

## Contexto

El ADR 0002 fijó SQLite, better-sqlite3, Drizzle y FTS5, pero no cómo se abre la
base, cómo se aplican las migraciones, cómo se protege una base existente ni qué
ocurre cuando el arranque falla. La issue #64 (M0-04) tenía que convertir esa
decisión en infraestructura ejecutable sin instalar todavía la aplicación y sin
arriesgar datos futuros.

Las restricciones eran: módulo nativo dentro de Electron, migraciones
versionadas que nunca se editan una vez aplicadas, copia verificable antes de
tocar una base con datos, funcionamiento offline y ningún detalle técnico del
usuario en los avisos o los logs. Además, la restauración guiada y la interfaz
de copias pertenecen a M0-07, así que el arranque debía ser seguro por sí solo.

## Decisión

1. **Módulo nativo sin `electron-rebuild`.** Se fija `better-sqlite3` 13.2.0,
   que usa Node-API 10. El mismo prebuild carga en Node 22.23.5 y en Electron
   45.3.4, con SQLite 3.54.1 y FTS5. `pnpm verify:native` comprueba ambos
   runtimes; `electron-rebuild` queda solo como contingencia si una versión
   futura deja de ser compatible con Node-API.
2. **Ubicación y conexión.** `app.setName(APP_NAME)` se ejecuta antes de
   `app.getPath('userData')` para que la carpeta de datos sea
   `%APPDATA%\World Craft`. La base vive en `userData/data/world-craft.sqlite`;
   hay una única conexión de escritura en el proceso principal, con WAL,
   `synchronous = NORMAL`, `foreign_keys = ON` y `busy_timeout = 5000`. El cierre
   es idempotente y se engancha a `before-quit`.
3. **Orden de arranque.** Abrir sin WAL → `PRAGMA integrity_check` → leer
   `PRAGMA user_version` y `schema_migrations` → copia previa si la base ya
   existía y hay migraciones pendientes → activar WAL y `synchronous` → aplicar
   el lote en una transacción → `integrity_check` posterior → `ready` o modo
   seguro. Ante un fallo se cierra la conexión y no se escribe nada más.
4. **Runner propio de migraciones.** No se usa `drizzle-kit migrate` ni
   `drizzle-kit push`. Un runner en `src/main/db/` lee el journal de Drizzle
   validado con Zod, exige una secuencia sin huecos, calcula el SHA-256 del SQL
   normalizado (BOM y finales de línea) y aplica el lote pendiente dentro de una
   única transacción. Cada aplicación inserta su fila en `schema_migrations` y
   actualiza `PRAGMA user_version`.
5. **`user_version` es el número de migraciones aplicadas.** Con `0000_init`
   vale 1; no es el prefijo ni el índice de la etiqueta. Esta regla evita
   confundir la versión del esquema con el nombre del archivo.
6. **Copia previa verificable.** Antes de migrar una base existente se crea
   `backups/pre-migration/<timestamp>/` con la API online de better-sqlite3, un
   `manifest.json` (formato, motivo, fecha, archivo, versión de esquema, tamaño y
   SHA-256) y una comprobación de integridad y versión en solo lectura. Si la
   copia falla, no se migra. Una base nueva no crea copia porque no hay datos que
   preservar; la decisión queda documentada y probada.
7. **Rechazo de bases ajenas.** Si la base tiene tablas propias pero no
   `schema_migrations`, no se adopta ni se le aplica la migración inicial: se
   devuelve `DB_MIGRATION_FAILED` y se entra en modo seguro.
8. **Modo seguro sin escritura.** Los fallos se comunican con códigos estables
   (`DB_OPEN_FAILED`, `DB_INTEGRITY_FAILED`, `DB_VERSION_AHEAD`,
   `DB_MIGRATION_CHECKSUM_MISMATCH`, `DB_BACKUP_FAILED`, `DB_MIGRATION_FAILED`).
   No se conserva ninguna conexión de escritura. Se escribe un log JSONL en
   `userData/logs/startup.log`, con rotación a 256 KiB y sin SQL, filas, rutas ni
   contenido del usuario, y se muestra un diálogo nativo con «Abrir carpeta de
   copias», «Continuar en modo seguro» y «Salir». La restauración guiada, la
   retención de copias y su interfaz llegan con M0-07.
9. **Empaquetado.** `better-sqlite3` y `drizzle-orm` se externalizan del bundle
   de `main`; `drizzle/` se copia a `out/main/drizzle` y `pnpm verify:build`
   comprueba el journal, la migración inicial y la externalización. Desempaquetar
   el módulo nativo del asar y empaquetar las dependencias de producción
   se completó en #68.

> **Actualización (M0-07, #67, 19/11/2026).** La poda de copias pre-migración y
> la restauración guiada ya están implementadas. Se conservan las **5 copias
> pre-migración válidas más recientes**, junto con 7 diarias, 4 semanales y 12
> mensuales; las copias corruptas no cuentan y no se borran. El diálogo de modo
> seguro añade «Restaurar copia.»: verifica la copia, guarda una copia
> pre-restauración en bruto, usa `.restore.lock` y `.restore.pending`, reemplaza
> con `.rollback*` y relanza; si falla, vuelve al modo seguro. También detecta
> restauraciones interrumpidas sin crear una base vacía y añade
> `DB_RESTORE_INVALID`, `DB_RESTORE_FAILED`, `DB_RESTORE_INTERRUPTED` y
> `DB_RESTORE_ROLLBACK_FAILED`. La interfaz de Ajustes sigue prevista para M1 y
> el bloqueo de instancia única seguía pendiente antes de #68. El detalle está
> en el [ADR 0012](0012-backup-restore-recovery.md) y en
> [`docs/persistencia.md`](../persistencia.md).

> **Actualización (M0-08, #68, 20/11/2026).** Se cierran las dos deudas de
> empaquetado e instancia: `better-sqlite3` y `sharp` se desempaquetan del asar,
> `npmRebuild` queda desactivado y la poda deja solo los binarios win32-x64; y
> `app.requestSingleInstanceLock()` se adquiere antes de la base, del IPC y de la
> ventana, con `second-instance` enfocando la instancia existente. La base y el
> modo seguro no cambian. El detalle está en el
> [ADR 0018](0018-nsis-packaging-and-update-service.md).
>
> **Implementación (M1-11, #116, 27/11/2026).** El runner amplía el contrato sin
> cambiar la decisión de este ADR: exige `foreign_keys = ON`, rechaza una llamada
> dentro de una transacción activa, desactiva las FKs **fuera** de la transacción
> del lote, ejecuta `PRAGMA foreign_key_check` antes del commit y restaura
> `foreign_keys = ON` en el `finally`, verificando que quedó activo. Cualquier
> violación revierte el lote completo y el arranque entra en modo seguro con
> `DB_MIGRATION_FAILED`. La comprobación vive en `checkForeignKeys`
> (`src/main/db/integrity.ts`) y no registra tablas, `rowid` ni identificadores.
> Esta ampliación es necesaria para reconstruir `assets` con su FK sin que
> `DROP TABLE` dispare `RESTRICT`, `SET NULL` o `CASCADE`. El detalle está en el
> [ADR 0032](0032-assets-world-fk-quarantine.md).

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| `drizzle-kit migrate` o el migrator de Drizzle | No ofrece el orden de comprobación, copia, transacción y modo seguro que exige el proyecto, ni el rechazo explícito de bases ajenas. Se conserva Drizzle Kit para generar y revisar migraciones. |
| `electron-rebuild` en cada instalación | Añade una compilación nativa lenta y frágil en Windows. La comprobación de M0-04 demuestra que el prebuild Node-API 10 sirve en Node y Electron; se mantiene como contingencia. |
| Copiar la base con `copyFile` antes de migrar | Con WAL puede copiar un estado inconsistente. Se usa la API online de SQLite, que produce una copia coherente y después se verifica. |
| Migrar antes de comprobar la integridad | Una base corrupta recibiría escrituras en la cabecera antes de detectar el daño. El orden real comprueba primero, sin WAL. |
| Modo seguro silencioso o cierre automático | El usuario no sabría qué pasó ni dónde están sus copias. El diálogo nativo explica el fallo y permite abrir la carpeta antes de decidir. |
| Guardar la versión solo en `schema_migrations` | Se pierde una comprobación barata de coherencia. Se usan la tabla y `user_version` y se contrastan entre sí. |

## Consecuencias

### Positivas

- La base se crea y migra antes de que exista una ventana que pueda leer datos a
  medias.
- Una migración fallida no deja cambios parciales: la transacción revierte el
  lote completo.
- Una base existente siempre tiene una copia verificable antes de cambiar.
- El modo seguro no conserva ninguna vía de escritura y deja un diagnóstico
  legible sin exponer contenido.
- El mismo binario nativo funciona en desarrollo, pruebas y Electron; el
  arranque es reproducible sin herramientas de compilación adicionales.
- Los códigos estables y el manifiesto prepararon la restauración implementada en
  M0-07; la interfaz de copias llega en M1.

### Negativas y riesgos

- El runner es código propio que hay que mantener y probar con cada cambio de
  formato del journal de Drizzle.
- Cada migración de una base existente deja una carpeta en
  `backups/pre-migration/`; desde M0-07 se conservan las 5 válidas más recientes.
- En M0-04 el diálogo nativo no permitía restaurar: solo abrir la carpeta,
  continuar en modo seguro o salir. Desde M0-07 ofrece restaurar una copia
  verificada con confirmación y copia previa.
- En M0-04 no había `app.requestSingleInstanceLock`; dos instancias podían
  competir por inspeccionar o migrar. SQLite serializa y la transacción revierte.
  La deuda se cerró en #68 (véase la actualización de esta página).
- `@types/better-sqlite3` va por detrás del runtime; es deuda de mantenimiento,
  no un fallo funcional.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | La ventana se crea después de comprobar y migrar; un fallo muestra un diálogo nativo antes de abrirla. |
| Temas (Claro/Oscuro) | No aplica: el aviso es un diálogo nativo y no hay UI de copias todavía. |
| Accesibilidad | El diálogo usa botones y textos del sistema; la UI de copias deberá cumplir AA en M1. |
| Seguridad y privacidad | `src/main/db/` no importa Electron; el renderer no accede a la base; los logs no incluyen SQL, filas ni rutas. |
| Datos y preservación | Copia previa verificable, transacción, integridad antes y después, y rechazo de bases ajenas. |
| Coste | 0 €/mes: SQLite, better-sqlite3, Drizzle y Zod son gratuitos y locales. |
| Portabilidad de datos | Base SQLite estándar y migraciones versionadas; la exportación de mundo llega en M1. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Módulo nativo incompatible con Electron | Cambio de ABI en una versión futura | Node-API 10, versión fijada y `pnpm verify:native`; `electron-rebuild` como contingencia | Empaquetado resuelto en #68; actualizaciones de Electron |
| Corrupción de la base | Fallo de disco o cierre abrupto | `integrity_check` antes de WAL, WAL, copia previa, modo seguro y restauración desde modo seguro (M0-07) | M5 para el aviso de disco |
| Migración con error | SQL inválido o estado manipulado | Lote transaccional, checksum, copia y rechazo de bases ajenas | Cada migración |
| Copias sin retención | Crecimiento de disco | Retención 7/4/12/5 y poda implementadas en M0-07 | #67 |
| Dos instancias a la vez | Condición de carrera al migrar | SQLite serializa y la transacción revierte; bloqueo de instancia implementado | Resuelto en #68 |
| Empaquetado del binario nativo | Asar impide cargar `.node` | Externalización verificada; desempaquetado y poda x64 | Resuelto en #68 |

## Plan de revisión

Se revisó al cerrar M0-07 (restauración guiada y retención de copias), al
implementar #68 (empaquetado, asar e instancia única) y al implementar #116
(FKs desactivadas alrededor del lote y `foreign_key_check` antes del commit); se
revisa al añadir las tablas de dominio de M1 y si Drizzle Kit cambia el formato
del journal. Cualquier cambio de motor, de formato de migración o de estrategia
de copia exige un ADR nuevo.

## Referencias

- Issue: #64 — SQLite local con better-sqlite3, Drizzle y migraciones.
- Issue de implementación de la poda y la restauración: #67 — Copias de
  seguridad, restauración y modo seguro.
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D3–D4 y §5.
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-040.
- [`docs/persistencia.md`](../persistencia.md).
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md).
- [ADR 0032](0032-assets-world-fk-quarantine.md), FK de assets y `foreign_key_check`.
- [ADR 0002](0002-sqlite-better-sqlite3-drizzle-fts5.md), [ADR 0004](0004-electron-security-typed-ipc.md)
  y [ADR 0012](0012-backup-restore-recovery.md).
- Documentación de better-sqlite3, Drizzle y SQLite consultada el 18/11/2026.
