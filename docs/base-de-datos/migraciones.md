# Migraciones de base de datos

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio); actualizado el
> 27/11/2026 con #116: reconstrucción de `assets` con FK a `worlds`, cuarentena,
> auditoría de referencias y `user_version` 10.
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
migración `0001_assets` (M0-06, #66) crea la tabla `assets`. La migración
`0002_worlds` (M1-01, #72) crea `worlds` y `activity_log` con sus índices,
`CHECK` y claves foráneas. La migración `0003_entity_types` (M1-02, #73) crea
`entity_types`, siembra los 18 tipos del sistema con IDs estables y deja el
`user_version` en 4. La migración `0004_entities` (M1-03, #74) crea `entities`,
`tags`, `entity_tags` y `entity_gallery`, con FKs a `worlds`, `entity_types` y
`assets`, y deja `user_version` en 5. La migración `0005_relations` (M1-04, #75)
crea `relation_types` y `relations`, siembra los 18 tipos de relación del sistema
y deja `user_version` en 6. La migración `0006_search` (M1-05, #76) crea el
índice de búsqueda con FTS5, sus vistas y triggers, y deja `user_version` en 7.
La migración `0007_trash_versions` (M1-06, #77) crea `entity_versions` con su
índice, añade `entities_deleted_idx` y `entity_types_deleted_idx`, y deja
`user_version` en 8. La migración `0008_world_description` (#114) añade
`worlds.description_text`, convierte la descripción plana de cada mundo en un
documento de ProseMirror párrafo a párrafo y deja `user_version` en 9. La
migración `0009_assets_world_fk` (#116) reconstruye `assets` con
`world_id → worlds(id) ON DELETE RESTRICT`, crea `assets_quarantine` y
`assets_quarantine_references`, audita las referencias a huérfanos, añade
`worlds_cover_asset_idx` y `entities_image_asset_idx` y deja `user_version` en
**10**. El runner desactiva las FKs fuera de la transacción, comprueba
`PRAGMA foreign_key_check` antes del commit y las restaura siempre (sección
3.3). El resto de tablas de contenido llega en M2, M3 y M4 con migraciones
`0010` y siguientes.

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
8. Si hay pendientes, comprobar que `foreign_keys = 1` y desactivarlas **fuera**
   de la transacción.
9. Abrir una transacción:
   a. Ejecutar el SQL de cada migración en orden.
   b. Insertar su fila en schema_migrations.
   c. Fijar user_version al número total de migraciones.
   d. Ejecutar PRAGMA foreign_key_check; si hay cualquier violación, revertir el
      lote completo con DB_MIGRATION_FAILED.
   e. Commit.
10. En un finally, restaurar foreign_keys = ON y verificar que quedó activo; si
    no, entrar en modo seguro.
11. Ejecutar integrity_check posterior.
12. Volver a inspeccionar el estado y devolver ready, o modo seguro.
13. Si es ready, crear las copias automáticas del periodo en curso y podar las
    sobrantes (7 diarias, 4 semanales, 12 mensuales, 5 pre-migración y 10
    pre-purga) antes de crear la ventana. Un fallo de copia no bloquea el
    arranque.
```

Las claves foráneas se desactivan **fuera** de la transacción porque
`PRAGMA foreign_keys` no se puede cambiar dentro de ella. La comprobación previa
al commit es obligatoria: con FKs desactivadas, una migración futura que confíe
en cascadas dejaría huérfanos y el lote se revertiría. `checkForeignKeys`
normaliza las violaciones y no registra tablas, `rowid` ni identificadores.

La poda conserva las **5 copias pre-migración válidas más recientes** y las **10
copias `pre-purge` válidas más recientes** (M1-06, #77); se ejecuta al arrancar y
no borra la más reciente ni las copias corruptas. Las copias pre-restauración
siguen sin poda.

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
  restaurar la copia. El rollback de `0009_assets_world_fk` debe ejecutarse
  fuera de una transacción, desactiva las FKs, devuelve las filas en cuarentena,
  restaura las referencias auditadas y deja `user_version` 9; la migración puede
  reaplicarse después con el runner.
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
  0002_worlds.sql
  0003_entity_types.sql
  0004_entities.sql
  0005_relations.sql
  0006_search.sql
  0007_trash_versions.sql
  0008_world_description.sql
  0009_assets_world_fk.sql
  meta/
    _journal.json
  rollback/
    0000_init.down.sql
    0001_assets.down.sql
    0002_worlds.down.sql
    0003_entity_types.down.sql
    0004_entities.down.sql
    0005_relations.down.sql
    0006_search.down.sql
    0007_trash_versions.down.sql
    0008_world_description.down.sql
    0009_assets_world_fk.down.sql
```

- Cuatro dígitos, secuencia sin huecos y etiqueta en `snake_case` e inglés.
- Una migración por cambio coherente; no mezclar dominios no relacionados.
- El journal y las instantáneas de `drizzle/meta/` se versionan.
- `0000_init` crea solo las tablas del sistema, `0001_assets` la tabla `assets`,
  `0002_worlds` los mundos y su actividad, `0003_entity_types` los tipos de
  entidad con su seed, `0004_entities` las fichas, etiquetas y galería,
  `0005_relations` los tipos de relación y las aristas, `0006_search` el índice
  de búsqueda, `0007_trash_versions` el historial de versiones y los índices de
  papelera, `0008_world_description` la descripción enriquecida del mundo y
  `0009_assets_world_fk` la FK de assets, la cuarentena y los índices de
  referencia. Las siguientes (`0010` en adelante) son previstas para M2, M3 y M4
  y no se reservan nombres de antemano.
- `0002_worlds` crea `worlds` antes que `activity_log` para que la clave foránea
  de la actividad siempre encuentre su tabla. Su rollback deshace primero
  `activity_log`, después `worlds` y deja `user_version` en 2.
- `0003_entity_types` crea `entity_types` y siembra los 18 tipos del sistema en
  la misma migración. El seed usa IDs UUIDv7 fijos y una marca de tiempo
  simbólica (`2026-11-20`) para no mostrar 1970; debe coincidir con
  `src/shared/entity-types/catalog.ts` y una prueba de integración lo comprueba.
  Su rollback elimina la tabla, sus índices y la fila de `schema_migrations`, y
  deja `user_version` en 3. La vía segura sigue siendo restaurar la copia previa.
- `0004_entities` crea `entities`, `tags`, `entity_tags` y `entity_gallery` con
  FKs a `worlds`, `entity_types` y `assets`, checks de estado y JSON, e índices
  por mundo. Su rollback elimina solo esas tablas, sus índices y la fila de
  `schema_migrations`, y deja `user_version` en 4. Debe ejecutarse antes del
  rollback de `0003` porque las fichas referencian `entity_types`.
- `0005_relations` crea `relation_types` y `relations` con FKs a `worlds`,
  `entities` y `relation_types`, checks de autorreferencia, fuerza, etiquetas,
  notas y JSON de metadatos, índices por mundo, origen, destino y tipo, y el seed
  de los 18 tipos de relación del sistema. Su rollback elimina solo esas tablas,
  sus índices y la fila de `schema_migrations`, y deja `user_version` en 5. Debe
  ejecutarse antes de los rollbacks de `0004` y `0003` porque las relaciones
  referencian fichas y tipos.
- `0006_search` crea `search_documents` con FK a `worlds`, `search_fts` con
  `unicode61`, prefijos 2/3/4 y `remove_diacritics`, `search_vocabulary` con
  `fts5vocab`, las vistas `search_world_documents`, `search_entity_documents` y
  `search_relation_documents` y los triggers de sincronización de `worlds`,
  `entities`, `relations`, `relation_types`, `entity_tags` y `tags`. Repuebla el
  índice desde las tablas existentes para que una base migrada sea buscable sin
  reintroducir datos. La reconstrucción completa sanea FTS5, elimina documentos
  obsoletos y vuelve a poblar el índice desde las vistas. Su rollback elimina
  solo esos objetos y la fila de
  `schema_migrations`, y deja `user_version` en 6. Debe ejecutarse antes de los
  rollbacks de `0005`, `0004` y `0003`.
- `0007_trash_versions` es **aditiva**: crea `entity_versions` con FK
  `entity_id → entities(id) ON DELETE CASCADE` y sus `CHECK` de origen, etiqueta,
  JSON y longitud; añade `entity_versions_entity_created_idx`,
  `entities_deleted_idx` y `entity_types_deleted_idx`; no edita tablas ni filas
  existentes y deja `user_version` en 8. Su rollback de referencia elimina la
  tabla, los dos índices de papelera y la fila de `schema_migrations`, y deja
  `user_version` en 7. Solo se pierden las versiones, que la copia previa
  conserva. La prueba de preservación migra una base en `0006` con un mundo, un
  tipo personalizado, fichas, etiquetas, galería, relaciones y búsqueda.
- `0008_world_description` cambia la forma de un campo con datos: añade
  `worlds.description_text` y convierte `worlds.description` de texto plano a un
  documento de ProseMirror. **Qué convierte y cómo:** normaliza `CRLF` y `CR` a
  `LF`, cambia tabuladores por espacios, colapsa espacios repetidos y recorta
  cada línea; cada línea no vacía se convierte en un párrafo con un nodo `text`,
  en el orden original, usando una tabla temporal y las funciones JSON de SQLite
  (`json_object` y `json_group_array(... ORDER BY ordinal)`), que escapan
  comillas y barras. No concatena cadenas para construir el JSON. Un texto que
  solo tenía saltos, tabuladores o espacios queda en `NULL`; `description_text`
  se rellena con `group_concat(body, char(10) ORDER BY ordinal)` y la vista
  `search_world_documents` se recrea para leer ese texto plano en lugar del JSON.
  Después se repuebla `search_documents` para los mundos y se ejecuta
  `INSERT INTO search_fts(search_fts) VALUES ('rebuild')`. **Por qué no hay
  `CHECK` en `worlds`:** SQLite exigiría reconstruir la tabla raíz, referenciada
  por `assets`, `activity_log`, `entity_types`, `entities`, `tags`, `relations`,
  `search_documents` y sus triggers; la forma se valida con Zod en el IPC, la
  validación de dominio y el esquema cerrado del editor, y el texto plano se
  recalcula siempre en el proceso principal. La conversión usa las funciones JSON
  de SQLite y `group_concat` con `ORDER BY`; el binario de better-sqlite3 13.x
  incluye SQLite ≥ 3.44, que es el mínimo que la migración documenta.
  **Rollback de referencia**
  (`drizzle/rollback/0008_world_description.down.sql`): degrada el documento a
  texto plano con `worlds.description_text`, retira los triggers de búsqueda del
  mundo, elimina la columna, restaura la vista y los triggers de `0006`, repuebla
  `search_documents`, reconstruye FTS y deja `user_version` en 8. Se pierde el
  formato y los enlaces, **nunca el texto visible**; la copia previa conserva el
  estado original. La prueba de preservación migra una base en `0007` con mundos
  de texto plano, `CRLF`, `CR`, líneas vacías, solo espacios, orden no
  alfabético, más de 2.000 líneas y un JSON ya migrado.
- `0009_assets_world_fk` **reconstruye** una tabla con datos. Orden exacto:
  1. Crea `assets_quarantine` con los metadatos de `assets` más `reason`
     (`world-missing` o `world-purged`) y `quarantined_at`, sus `CHECK` de
     `kind`, tamaño, hash, motivo y marca, y los índices por mundo/fecha y hash.
  2. Crea `assets_quarantine_references` con FK en cascada a
     `assets_quarantine`, `table_name` cerrado (`worlds`, `entities`,
     `entity_gallery`), `row_id`, `column_name`, `position` y sus dos índices.
  3. Inserta en cuarentena las filas cuyo `world_id` no existe, con
     `reason = 'world-missing'` y `quarantined_at` calculado con
     `strftime('%s','now') * 1000` de SQLite (sin reloj del proceso).
  4. Audita las referencias visibles a esos assets **antes** de limpiarlas:
     portada de mundo, imagen de ficha y galería con su `position`.
  5. Pone a `NULL` `worlds.cover_asset_id` y `entities.image_asset_id` y borra
     las filas de `entity_gallery` afectadas.
  6. Crea `assets_new` con las mismas columnas, `CHECK`, FK
     `world_id → worlds(id) ON UPDATE no action ON DELETE restrict` e índices;
     copia solo las filas cuyo mundo existe, **incluidas las de mundos en
     papelera**.
  7. `DROP TABLE assets`, `ALTER TABLE assets_new RENAME TO assets` y recrea
     `assets_world_idx` y `assets_hash_idx`.
  8. Crea `worlds_cover_asset_idx` y `entities_image_asset_idx`.
  9. El runner desactiva FKs fuera de la transacción y ejecuta
     `PRAGMA foreign_key_check` antes del commit; cualquier violación revierte el
     lote.

  Los archivos no se mueven ni se borran: la cuarentena conserva
  `relative_path`. El SQL no contiene `PRAGMA foreign_keys` y no se edita
  `0001_assets`. `user_version` pasa de 9 a **10**. El rollback de referencia
  (`drizzle/rollback/0009_assets_world_fk.down.sql`) deshace la FK, devuelve a
  `assets` las filas `world-missing` y `world-purged`, restaura las referencias
  auditadas solo si el asset y la fila destino existen, elimina las tablas e
  índices nuevos, retira la fila de `schema_migrations`, deja `user_version` 9 y
  reactiva las FKs. Se ejecuta fuera de una transacción; la vía segura sigue
  siendo restaurar la copia. La prueba migra una base en `0009` con dos mundos,
  portada, imagen de ficha, galería, assets válidos, huérfanos y archivos reales,
  y otra base nueva sin cuarentena; después ejecuta el rollback y reaplica
  `0009`.

## 5. Pruebas

| Prueba | Qué comprueba | Estado |
|---|---|---|
| `journal` | Journal válido, secuencia sin huecos, etiquetas sin traversal y checksum normalizado. | Implementada (unitaria) |
| `migrations` | Una base vacía llega a la última versión sin errores y es idempotente al reabrir. | Implementada (integración) |
| `upgrade-0001` | Una base en `0000` migra a `0001_assets` conservando `app_settings` y creando `assets`, con `user_version` 2. | Implementada (integración) |
| `upgrade-0002` | Una base en `0000` migra al esquema actual conservando `app_settings`, creando `assets`, `worlds`, `activity_log`, `entity_types`, `entities`, `tags`, `entity_tags`, `entity_gallery`, `relation_types`, `relations`, `search_documents`, `entity_versions` y `assets_quarantine`, con `user_version` 10. | Implementada (integración) |
| `upgrade-0003` | Una base en `0002` con mundos y actividad migra a `0003`, `0004` y `0005` sin perder filas y con los 18 tipos del sistema. | Implementada (integración) |
| `upgrade-0004` | Una base en `0003` con mundos y tipos personalizados migra a `0004` y `0005` sin perder filas y crea las tablas de fichas, etiquetas, galería, tipos de relación y relaciones. | Implementada (integración) |
| `upgrade-0005` | Una base en `0004` con mundos, tipos y fichas migra a `0005` sin perder filas, crea `relation_types` y `relations` y siembra los 18 tipos de relación del sistema. | Implementada (integración) |
| `upgrade-0006` | Una base en `0005` con mundos, fichas, etiquetas y relaciones migra a `0006` sin perder filas, crea el índice y lo repuebla desde las vistas. | Implementada (integración) |
| `upgrade-0007` | Una base en `0006` con mundos, tipos, fichas, etiquetas, galería, relaciones y búsqueda migra a `0007` sin perder filas; crea `entity_versions` y los índices de papelera, conserva los assets y deja `user_version` 8. | Implementada (integración) |
| `upgrade-0008` | Una base en `0007` con descripciones planas migra a `0008` conservando el texto y el orden de los párrafos, convierte `CRLF`/`CR`, líneas vacías, solo espacios y más de 2.000 líneas, rellena `description_text`, deja la vista de búsqueda sin JSON y deja `user_version` 9. | Implementada (integración) |
| `assets-world-fk` | Una base en `0008` con dos mundos (uno en papelera), portada, imagen de ficha, galería, assets válidos y huérfanos con archivos reales migra a `0009_assets_world_fk`: conserva las filas válidas columna a columna, mueve los huérfanos a `assets_quarantine` con `world-missing`, audita las referencias exactas antes de desvincularlas, conserva los archivos con su SHA-256, deja `foreign_key_check` vacío y `user_version` 10. Una base nueva aplica `0009` sin cuarentena. | Implementada (integración) |
| `preservation` | Los datos existentes siguen ahí tras migrar y tras un fallo; incluye la descripción y `description_text` de `0008`, y las filas y archivos válidos de `0009`. | Implementada (integración) |
| `backup` | Copia previa con manifiesto, tamaño, SHA-256 e integridad; fallo de copia no migra. | Implementada (integración) |
| `integrity` | `PRAGMA integrity_check` detecta corrupción y el arranque no escribe. | Implementada (integración) |
| `foreign-db` | Una base con tablas propias sin `schema_migrations` se rechaza. | Implementada (integración) |
| `version-ahead` | Una base de versión superior no se migra ni se escribe. | Implementada (integración) |
| `rollback` | El SQL de referencia de `rollback/` es válido sobre una base temporal; `0009_assets_world_fk` deshace la FK, restaura los huérfanos y las referencias auditadas, elimina las tablas e índices nuevos y deja `user_version` 9 y `foreign_keys = 1`; la migración se reaplica con el runner. `0008_world_description` deja `user_version` 8 y convierte el documento a texto plano, `0007_trash_versions` deja `user_version` 7, `0006_search` 6, `0005_relations` 5, `0004_entities` 4, `0003_entity_types` 3, `0002_worlds` 2, `0001_assets` 1 y `0000_init` 0. | Implementada (integración) |
| `runner` | Aplica un lote válido y deja `foreign_keys = 1`; revierte si `foreign_key_check` detecta un huérfano antes del commit; revierte y restaura `foreign_keys` si una migración lanza; rechaza una llamada dentro de una transacción activa; aplica `0009` sobre una base nueva sin cuarentena. | Implementada (integración) |
| `checkForeignKeys` | `checkForeignKeys` devuelve lista vacía sin violaciones, normaliza una violación a `table`/`rowId`/`parent`/`foreignKeyId` y rechaza una fila malformada sin filtrar detalles. | Implementada (unitaria) |
| `quarantine` | `quarantineWorldAssets` mueve las filas del mundo con `reason = 'world-purged'` sin tocar los metadatos y devuelve el recuento; `countQuarantine` devuelve ceros si faltan las tablas. | Implementada (integración) |
| `asset-references` | Solo existen las tres FKs conocidas cuyo padre es `assets`; `countExternalAssetReferences` cuenta referencias externas con varios mundos permitidos y bloquea el mundo correcto. | Implementada (integración) |
| `safe-mode` | Una migración rota deja la app en modo seguro y conserva la copia. | Implementada (integración) |
| `backup-schedule` | Copias diaria, semanal y mensual al arrancar, sin duplicar el bucket, y rotación 7/4/12/5 sin podar pre-restore. | Implementada (unitaria e integración) |
| `backup-prepurge` | La copia previa a la purga escribe manifiestos `pre-purge` verificables, rota a 10 sin borrar la más reciente y no deja una copia parcial si falla la escritura. | Implementada (integración) |
| `trash` | Listado por cursor, restauración, motivos de dominio, purga ordenada, vaciado con contadores y assets intactos; purgar un mundo mueve sus metadatos a cuarentena, rechaza `assets-in-use` y conserva los archivos. | Implementada (unitarias e integración) |
| `versions` | Ventana de 5 min, 20 automáticas/90 días, 50 manuales, origen `restore` protegido y cascade al purgar. | Implementada (unitarias e integración) |
| `backup-restore` | Restauración verificada con copia pre-restore, rechazo de copia corrupta o futura, rollback y assets intactos. | Implementada (integración) |
| `restore-interrupted` | Lock, `.restore.pending`, restos preservados y arranque sin base vacía tras un fallo. | Implementada (unitaria e integración) |

Las pruebas usan archivos temporales en `os.tmpdir()`, nunca la base del
usuario. `pnpm test:unit` y `pnpm test:integration` se ejecutan en la CI sin
datos reales ni credenciales. `pnpm db:check` valida el journal y las
instantáneas antes del build.

## 6. Datos iniciales

- El catálogo del sistema se versiona en código y se siembra en su migración:
  los 18 tipos de entidad están en `src/shared/entity-types/catalog.ts` y en
  `0003_entity_types`. Los tipos de relación y las tablas de juego definirán su
  seed idempotente con sus migraciones.
- El seed no sobrescribe personalizaciones del usuario. Una migración ya
  aplicada no se edita: cualquier cambio de catálogo exige una migración nueva.
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
- Ajustes → Datos → «Reconstruir búsqueda» (previsto en Ajustes) ejecutará el
  rebuild de FTS5; hoy se ofrece desde la paleta `Ctrl+K` de la aplicación.
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
- #68 desempaquetó `better-sqlite3` y `sharp` del asar y garantiza que las
  dependencias de producción, `THIRD-PARTY-NOTICES.md`, `licenses/` y las
  migraciones viajan en el paquete; `pnpm verify:package` lo comprueba.
- `pnpm verify:native` comprueba better-sqlite3 y sharp en Node y Electron; se
  ejecuta en el job `package` de Windows desde #68.

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
- [ADR 0028](../adr/0028-trash-versions-and-pre-purge-backup.md)
- [ADR 0032](../adr/0032-assets-world-fk-quarantine.md)
