# Migraciones de base de datos

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio); actualizado el
> 19/11/2026 con M0-07 (#67): poda de copias pre-migración y restauración desde
> el diálogo de modo seguro.
> **Ámbito:** creación, aplicación, verificación y reversión de migraciones
> SQLite. El esquema vigente está en [`esquema.md`](esquema.md).

## 1. Principios

1. **Nunca se edita una migración aplicada.** Un cambio se corrige con una
   migración nueva; si cambia el SQL, el checksum lo detecta.
2. **Copia previa en bases existentes.** Antes de migrar una base con datos se
   crea una copia verificable en `backups/pre-migration/`. Una base nueva no
   necesita copia porque no hay nada que preservar.
3. **Transacción por lote.** Todas las migraciones pendientes se aplican en una
   única transacción; si una falla, la base queda como estaba.
4. **Prueba sobre base temporal.** Ninguna migración se publica sin probarla
   contra una base temporal realista.
5. **Preservación de datos.** Toda migración que toque datos existentes incluye
   una prueba que compara filas antes y después.
6. **Modo seguro.** Si una migración falla o la integridad falla, la app arranca
   sin conexión de escritura y ofrece restaurar una copia desde el diálogo
   nativo (implementado en M0-07).

## 2. Herramientas

- **Drizzle Kit** genera y revisa el SQL a partir del esquema TypeScript de
  `src/main/db/schema/`: `pnpm db:generate` escribe en `drizzle/` y
  `pnpm db:check` valida el journal y las instantáneas. No se usa
  `drizzle-kit migrate` ni `drizzle-kit push` contra la base del usuario.
- **Runner propio** en `src/main/db/journal.ts` y `src/main/db/migrations.ts`:
  lee `drizzle/meta/_journal.json`, lo valida con Zod, exige una secuencia sin
  huecos, calcula el checksum y aplica el lote pendiente en una transacción.
- **better-sqlite3** ejecuta la migración en el proceso principal y crea la
  copia online previa cuando la base ya existe.
- **Vitest** prueba el journal, los checksums, la copia y las migraciones sobre
  archivos temporales; la integración usa una base real en `os.tmpdir()`.
- La tabla `schema_migrations` guarda cada etiqueta con su fecha y checksum;
  `PRAGMA user_version` guarda el **número de migraciones aplicadas**. El runner
  contrasta ambos valores.

Todo esto está implementado en M0-04 (#64) y cubierto por las pruebas. La
migración `0001_assets` (M0-06, #66) es la primera migración de dominio: crea la
tabla `assets` y su rollback de referencia. El resto de tablas de dominio llega
en M1 con migraciones `0002` y siguientes.

## 3. Flujo de una migración

### 3.1 Crear

1. Cambiar el esquema Drizzle en `src/main/db/schema/`.
2. Generar la migración con `pnpm db:generate`.
3. Revisar el SQL: tipos, `NOT NULL`, defaults, claves foráneas, índices y
   triggers.
4. Añadir el rollback documentado en `drizzle/rollback/` si la migración es
   destructiva o cambia tipos. Es SQL de referencia: no se ejecuta solo.
5. Actualizar [`esquema.md`](esquema.md) y este documento.
6. Añadir la prueba de migración y la de preservación.
7. Ejecutar `pnpm db:check` y las pruebas.

### 3.2 Revisar

Checklist obligatoria:

- [ ] El SQL es idempotente o está protegido por la versión.
- [ ] No hay `DROP` sin copia ni sin plan de recuperación.
- [ ] Las columnas nuevas son `NULL` o tienen default.
- [ ] Los índices nuevos no duplican uno existente.
- [ ] Las claves foráneas no dejan huérfanos.
- [ ] Los triggers de búsqueda y `updated_at` siguen coherentes.
- [ ] El rollback está documentado o se justifica por qué no aplica.
- [ ] La prueba de preservación compara datos antes y después.

### 3.3 Aplicar al arrancar

El proceso principal resuelve `userData` (con `app.setName(APP_NAME)` previo) y
ejecuta el arranque **antes de crear la ventana**:

```text
1. Calcular rutas, crear carpetas y abrir el log de arranque.
2. Detectar restos de restauración (.rollback*, .restore.tmp*, .restore.pending).
   - Si hay restos o el lock pertenece a un proceso vivo: DB_RESTORE_INTERRUPTED.
   - No se abre ni se crea ninguna base en ese estado.
3. Abrir SQLite sin WAL (solo busy_timeout y foreign_keys).
4. Ejecutar PRAGMA integrity_check. Si falla: DB_INTEGRITY_FAILED.
5. Leer PRAGMA user_version y leer schema_migrations.
   - Si hay tablas propias sin schema_migrations: DB_MIGRATION_FAILED.
   - Si la versión es superior al journal: DB_VERSION_AHEAD.
   - Si una migración aplicada cambió: DB_MIGRATION_CHECKSUM_MISMATCH.
   - Si user_version y las filas no cuadran: DB_MIGRATION_FAILED.
6. Si la base ya existía y hay pendientes:
   a. Copia online en backups/pre-migration/<timestamp>/.
   b. Verificar manifiesto, tamaño, SHA-256, integridad y versión en solo
      lectura. Si falla: DB_BACKUP_FAILED y no se migra.
7. Activar WAL y synchronous = NORMAL.
8. Si hay pendientes, abrir una transacción:
   a. Ejecutar el SQL de cada migración en orden.
   b. Insertar su fila en schema_migrations.
   c. Fijar user_version al número total de migraciones.
   d. Commit. Si algo falla, SQLite revierte el lote completo.
9. Ejecutar integrity_check posterior.
10. Volver a inspeccionar el estado y devolver ready, o modo seguro.
11. Si es ready, crear las copias automáticas del periodo en curso y podar las
    sobrantes (7 diarias, 4 semanales, 12 mensuales y 5 pre-migración) antes de
    crear la ventana. Un fallo de copia no bloquea el arranque.
```

La poda conserva las **5 copias pre-migración válidas más recientes**; se
ejecuta al arrancar y no borra la más reciente ni las copias corruptas.

Una base nueva (archivo inexistente o vacío) no crea copia previa: no hay datos
que preservar. La decisión está documentada y cubierta por una prueba.

La ventana no se crea hasta que termina la comprobación y la migración; en
M0-04 no hay pantalla de progreso, porque la migración inicial es inmediata. Si
el arranque falla, se cierra la conexión y se muestra el aviso de modo seguro
(sección 3.5).

### 3.4 Revertir

- **Reversión automática:** solo la transacción fallida; SQLite deshace el lote
  completo y `user_version` no cambia.
- **Reversión manual:** restaurar una copia pre-migración desde el diálogo de
  modo seguro (implementado en M0-07). La app verifica la copia, guarda la base
  actual en `backups/pre-restore/` y relanza; al arrancar se aplican las
  migraciones pendientes con una copia previa nueva. Se conservan las 5 copias
  pre-migración válidas más recientes.
- **Rollback de esquema:** los archivos de `drizzle/rollback/` son documentación
  y SQL de referencia; no se ejecutan automáticamente. La vía segura es
  restaurar la copia.
- Nunca se hace downgrade de la app con una base migrada sin copia: la app
  detecta una versión de esquema superior y se niega a escribir.
- Ninguna migración aplicada se edita: si cambia su SQL, el checksum no coincide
  y el arranque pasa a modo seguro.

### 3.5 Modo seguro

Los fallos de arranque usan códigos estables y no propagan SQL ni rutas:

| Código | Cuándo |
|---|---|
| `DB_OPEN_FAILED` | No se puede abrir o crear la base, las carpetas o una conexión. |
| `DB_INTEGRITY_FAILED` | `integrity_check` falla antes o después de migrar. |
| `DB_VERSION_AHEAD` | La base pertenece a una versión más reciente de la app. |
| `DB_MIGRATION_CHECKSUM_MISMATCH` | Una migración ya aplicada cambió. |
| `DB_BACKUP_FAILED` | No se pudo crear o verificar la copia previa. |
| `DB_MIGRATION_FAILED` | El lote no se pudo aplicar, el estado no cuadra o la base es ajena. |
| `DB_RESTORE_INVALID` | La copia elegida no supera la verificación; no se modifica nada. |
| `DB_RESTORE_FAILED` | Falló el reemplazo y se devolvió la base anterior a su sitio. |
| `DB_RESTORE_INTERRUPTED` | Hay restos de una restauración en curso o interrumpida. |
| `DB_RESTORE_ROLLBACK_FAILED` | Falló la restauración y no se pudo devolver la base anterior. |

En modo seguro no queda ninguna conexión de escritura. Se escribe una línea
JSONL en `logs/startup.log` (rotación a 256 KiB, sin SQL, filas, rutas ni
contenido) y se muestra un diálogo nativo con «Restaurar copia.», «Abrir carpeta
de copias», «Continuar en modo seguro» y «Salir». La interfaz de copias de
Ajustes llega en M1.

## 4. Convenciones de nombres

```text
drizzle/
  0000_init.sql
  0001_assets.sql
  meta/
    _journal.json
  rollback/
    0000_init.down.sql
    0001_assets.down.sql
```

- Cuatro dígitos, secuencia sin huecos y etiqueta en `snake_case` e inglés.
- Una migración por cambio coherente; no mezclar dominios no relacionados.
- El journal y las instantáneas de `drizzle/meta/` se versionan.
- `0000_init` crea solo las tablas del sistema y `0001_assets` la tabla
  `assets`. Las siguientes (`0002` en adelante) son previstas para M1 y no se
  reservan nombres de antemano.

## 5. Pruebas

| Prueba | Qué comprueba | Estado |
|---|---|---|
| `journal` | Journal válido, secuencia sin huecos, etiquetas sin traversal y checksum normalizado. | Implementada (unitaria) |
| `migrations` | Una base vacía llega a la última versión sin errores y es idempotente al reabrir. | Implementada (integración) |
| `upgrade-0001` | Una base en `0000` migra a `0001_assets` conservando `app_settings` y creando `assets`, con `user_version` 2. | Implementada (integración) |
| `preservation` | Los datos existentes siguen ahí tras migrar y tras un fallo. | Implementada (integración) |
| `backup` | Copia previa con manifiesto, tamaño, SHA-256 e integridad; fallo de copia no migra. | Implementada (integración) |
| `integrity` | `PRAGMA integrity_check` detecta corrupción y el arranque no escribe. | Implementada (integración) |
| `foreign-db` | Una base con tablas propias sin `schema_migrations` se rechaza. | Implementada (integración) |
| `version-ahead` | Una base de versión superior no se migra ni se escribe. | Implementada (integración) |
| `rollback` | El SQL de referencia de `rollback/` es válido sobre una base temporal; `0001_assets` deja `user_version` 1 y `0000_init` la deja en 0. | Implementada (integración) |
| `safe-mode` | Una migración rota deja la app en modo seguro y conserva la copia. | Implementada (integración) |
| `backup-schedule` | Copias diaria, semanal y mensual al arrancar, sin duplicar el bucket, y rotación 7/4/12/5 sin podar pre-restore. | Implementada (unitaria e integración) |
| `backup-restore` | Restauración verificada con copia pre-restore, rechazo de copia corrupta o futura, rollback y assets intactos. | Implementada (integración) |
| `restore-interrupted` | Lock, `.restore.pending`, restos preservados y arranque sin base vacía tras un fallo. | Implementada (unitaria e integración) |

Las pruebas usan archivos temporales en `os.tmpdir()`, nunca la base del
usuario. `pnpm test:unit` y `pnpm test:integration` se ejecutan en la CI sin
datos reales ni credenciales. `pnpm db:check` valida el journal y las
instantáneas antes del build.

## 6. Datos iniciales

- El catálogo del sistema (tipos de entidad, tipos de relación y tablas de
  juego) se guarda como JSON versionado y se inserta con un seed idempotente.
- El seed no sobrescribe personalizaciones del usuario.
- Las tablas del sistema se marcan `is_system = 1`; el usuario puede
  duplicarlas, no editarlas.
- El contenido de ejemplo de un mundo se crea solo si el usuario lo pide.

## 7. Operación y diagnóstico

- El arranque registra en `logs/startup.log` (JSONL, rotación a 256 KiB) si la
  base era nueva, cuántas migraciones se aplicaron, la versión resultante, si
  se creó copia, el resultado de `backup.schedule` y, si hubo restauración, el
  de `backup.restore`. No registra SQL, filas, rutas ni contenido.
- La pantalla Ajustes → Datos (prevista) mostrará la versión de esquema, el
  número de migraciones aplicadas, el tamaño de la base y el estado de
  integridad.
- Ajustes → Datos → «Verificar base» (previsto) ejecutará `integrity_check` y
  `foreign_key_check` y mostrará un informe.
- Ajustes → Datos → «Reconstruir búsqueda» (previsto) ejecutará el rebuild de
  FTS5.
- Ajustes → Datos → «Compactar base» (previsto) ejecutará `VACUUM` con
  confirmación y copia previa.
- Los errores de migración usan los códigos de la sección 3.5 y no muestran SQL
  interno.

## 8. Empaquetado y CI

- `better-sqlite3`, `drizzle-orm` y `sharp` (con `@img/*`) se externalizan del
  bundle de `main`.
- `drizzle/` se copia a `out/main/drizzle` en cada build; el runner lo lee desde
  `__dirname/drizzle` en desarrollo y en la versión instalada.
- `pnpm verify:build` comprueba que existen el journal y las migraciones, que la
  secuencia es válida y que las dependencias nativas no se han empaquetado.
- La CI ejecuta `pnpm db:check` antes de `pnpm build`.
- #68 debe desempaquetar `better-sqlite3` y `sharp` del asar y garantizar que las
  dependencias de producción, `THIRD-PARTY-NOTICES.md` y las migraciones viajan
  en el paquete.
- `pnpm verify:native` comprueba better-sqlite3 y sharp en Node y Electron; hoy
  se ejecuta a mano y debe añadirse a la CI antes de #68.

## 9. Qué no se hace

- No se usa `drizzle-kit push` ni `drizzle-kit migrate` contra la base del
  usuario.
- No se usa `copyFile` para la copia previa: se usa la API online de SQLite.
- No se ejecutan migraciones desde el renderer.
- No se descargan migraciones de Internet.
- No se comparte la base entre equipos ni se sincroniza.
- No se edita una migración ya publicada; se crea otra.
- No se ejecuta el SQL de `drizzle/rollback/` automáticamente.

## 10. Documentos relacionados

- [Esquema](esquema.md)
- [Persistencia](../persistencia.md)
- [Continuidad](../continuidad.md)
- [Plan de pruebas](../calidad/plan-de-pruebas.md)
- [ADR 0002](../adr/0002-sqlite-better-sqlite3-drizzle-fts5.md)
- [ADR 0012](../adr/0012-backup-restore-recovery.md)
- [ADR 0016](../adr/0016-sqlite-migrations-safe-mode.md)
- [ADR 0017](../adr/0017-assets-service-sharp-orphan-purge.md)
