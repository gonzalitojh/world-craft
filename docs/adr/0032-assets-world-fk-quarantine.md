# ADR 0032 — Integridad de assets: FK a mundos, cuarentena y purga sin huérfanos

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-27
- **Fecha del documento:** 2026-11-27
- **Issue:** #116 (`M1-11`), dentro del hito M1
- **Decisiones del registro:** D-056
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0005, ADR 0016, ADR 0017, ADR 0019, ADR 0028, ADR 0029,
  ADR 0030, ADR 0031
- **QA y seguridad:** PASS de `qa-reviewer` (2026-11-27) y PASS de
  `security-champion` sin hallazgos HIGH (2026-11-27)

## Contexto

Desde `0001_assets` (#66), `assets.world_id` no tenía clave foránea porque
`worlds` todavía no existía. `0002_worlds` (#72) creó la tabla raíz y
`worlds.cover_asset_id` con `ON DELETE RESTRICT`, pero dejó la relación inversa
sin restricción. #77 (ADR 0028) purgaba mundos y fichas sin tocar `assets`, así que
cada mundo purgado dejaba filas de assets sin mundo y archivos que ya no
aparecían en ninguna vista. La integridad se mantenía en el servicio, no en
SQLite.

La issue #116 tenía que cerrar esa deuda sin perder datos: reconstruir `assets`
con `world_id → worlds(id) ON DELETE RESTRICT`, conservar todas las filas y
archivos válidos y dejar un registro verificable de los huérfanos. El contexto
técnico imponía cuatro restricciones:

1. **`DROP TABLE assets` con claves foráneas activas es destructivo.** SQLite
   aplicaría `RESTRICT`, `SET NULL` y `CASCADE` de `worlds.cover_asset_id`,
   `entities.image_asset_id` y `entity_gallery.asset_id` al eliminar la tabla
   padre, y borraría o desvincularía datos válidos.
2. **El runner aplica el lote en una transacción y no puede cambiar el pragma
   dentro de ella.** `PRAGMA foreign_keys` no se puede alternar con una
   transacción abierta; hay que desactivarlo antes y restaurarlo siempre.
3. **Los archivos no se pueden borrar ni mover en el arranque.** La regla del
   proyecto es que los datos del usuario nunca se pierden; una migración no
   debe hacer I/O de assets ni dejar un estado a medias.
4. **La purga debía seguir siendo segura.** Un asset es del mundo y puede estar
   compartido por una portada, una imagen de ficha o una galería de otro mundo o
   de una ficha superviviente. Borrarlo o desvincularlo en silencio destruiría
   contenido visible.

El usuario aprobó el plan con las decisiones B1–B5: cuarentena con auditoría de
referencias, rechazo `assets-in-use`, runner con FKs desactivadas y
`foreign_key_check`, aviso condicional en Ajustes y cuarentena al purgar un
mundo. El cambio es local, offline, sin dependencias nuevas y sin canales IPC
nuevos.

## Decisión

1. **Migración `0009_assets_world_fk` con reconstrucción, no edición.** Se crea
   una tabla nueva con las mismas columnas y `CHECK`, la FK
   `world_id → worlds(id) ON UPDATE no action ON DELETE restrict` y los índices
   `assets_world_idx` y `assets_hash_idx`. La migración:
   - crea `assets_quarantine` y `assets_quarantine_references`;
   - mueve a cuarentena, con `reason = 'world-missing'`, las filas cuyo
     `world_id` no existe;
   - audita en `assets_quarantine_references` las referencias visibles a esos
     assets (`worlds.cover_asset_id`, `entities.image_asset_id` y
     `entity_gallery.asset_id` con su `position`) **antes** de limpiarlas;
   - pone a `NULL` la portada y la imagen de ficha afectadas y elimina las filas
     de galería afectadas;
   - copia a la tabla nueva solo las filas cuyo mundo existe, incluidas las de
     mundos en papelera, porque el borrado lógico no rompe la FK;
   - hace `DROP TABLE assets` y `RENAME`, recrea los índices y añade
     `worlds_cover_asset_idx (cover_asset_id)` y
     `entities_image_asset_idx (image_asset_id)`.
   No se edita `0001_assets` y el SQL no contiene ningún `PRAGMA foreign_keys`:
   lo gestiona el runner fuera de la transacción. `user_version` pasa de 9 a
   **10**.

2. **Cuarentena de metadatos, sin archivos y sin UI de restauración.**
   `assets_quarantine` conserva `id`, `world_id`, `kind`, `relative_path`,
   `mime`, `size`, `width`, `height`, `alt`, `hash`, `created_at`, `reason`
   (`world-missing` o `world-purged`) y `quarantined_at`, con los mismos `CHECK`
   de `assets` y dos índices (`world_id, quarantined_at` y `hash`). No tiene FK a
   `worlds` porque precisamente guarda mundos que ya no existen.
   `assets_quarantine_references` guarda `asset_id` con FK en cascada, `table_name`
   (`worlds`, `entities`, `entity_gallery`), `row_id`, `column_name`, `position`
   opcional y `created_at`, con índices por asset y por fila. Los archivos no se
   renombran ni se borran: la ruta relativa original queda en la fila. No se
   ofrece restaurar filas de cuarentena ni limpiarlas en esta entrega.

3. **Runner con claves foráneas desactivadas y comprobación antes del commit.**
   `applyPendingMigrations` exige la conexión con `foreign_keys = ON`, rechaza
   una llamada dentro de una transacción activa, desactiva las FKs **fuera** de
   la transacción del lote, aplica las migraciones, escribe
   `schema_migrations` y `user_version`, ejecuta `PRAGMA foreign_key_check` y
   solo entonces confirma. Cualquier violación revierte el lote completo con
   `DB_MIGRATION_FAILED`. En el `finally` se restaura siempre
   `foreign_keys = ON` y se verifica que quedó activo; si no, el arranque entra
   en modo seguro. La comprobación vive en `checkForeignKeys`
   (`src/main/db/integrity.ts`), normaliza las violaciones y no registra tablas,
   `rowid`, IDs ni filas.

4. **Regla exacta de la purga.** Un asset está en uso si alguna fila que
   sobrevive a la purga lo referencia. Se cuentan `worlds.cover_asset_id`,
   `entities.image_asset_id` y `entity_gallery.asset_id`; una prueba guardián
   compara `pragma_foreign_key_list` y falla si aparece una FK nueva a `assets`
   que la purga no contemple. `purgeWorld`:
   - comprueba las referencias externas antes de crear la copia y vuelve a
     comprobarlas dentro de la transacción;
   - si hay referencias externas, devuelve `assets-in-use` sin tocar nada;
   - limpia la portada del propio mundo, borra actividad, relaciones, galería,
     etiquetas, versiones, fichas, tipos y etiquetas del mundo;
   - mueve sus filas de `assets` a `assets_quarantine` con
     `reason = 'world-purged'` y después las elimina de `assets`;
   - borra el mundo. **Los archivos nunca se borran desde la papelera.**

   El vaciado calcula un **punto fijo** de mundos purgables antes de tocar las
   portadas: una referencia entre dos mundos que también se van a purgar no
   bloquea, pero la de cualquier superviviente sí. Resuelve cadenas y ciclos y
   conserva los mundos bloqueados en `skipped`. Si no se purga nada y
   `skipped > 0`, la interfaz no dice «la papelera ya estaba vacía».

5. **Los huérfanos de archivos siguen el flujo existente.** `planOrphanCleanup`
   solo considera referenciadas las filas de `assets`. Por tanto, los archivos y
   miniaturas de filas en cuarentena aparecen como no referenciados y solo se
   pueden eliminar con la purga de imágenes huérfanas de Ajustes, que exige
   confirmación y una copia verificable en `backups/orphans/`. La cuarentena es
   metadato histórico y no se limpia automáticamente.

6. **Contratos y avisos mínimos, sin IPC nuevo.** `TrashPurgeFailure` añade
   `assets-in-use`; `TrashEmptyResult.skipped` documenta los elementos en uso
   que se conservan. `DataCounts` añade `quarantine: { assets, references }`
   sin rutas, IDs ni nombres. La interfaz reutiliza tres canales existentes
   (`trash:purge`, `trash:empty` y `data:getSummary`) y añade solo:
   - el error de purga individual con `role="alert"` y el diálogo abierto;
   - la matriz de resultados del vaciado (todo, parcial, nada por elementos en
     uso y papelera ya vacía);
   - un aviso pasivo en Ajustes → Datos → Imágenes huérfanas solo cuando
     `quarantine.references > 0`, que habla de «vínculos» y no promete recuperar
     una imagen concreta.

7. **Rollback de referencia y copia como vía segura.** El rollback
   `drizzle/rollback/0009_assets_world_fk.down.sql` deshace la FK, devuelve a
   `assets` las filas en cuarentena (`world-missing` y `world-purged`), restaura
   las referencias auditadas cuando el asset y la fila destino siguen
   existiendo, elimina las tablas e índices nuevos, retira la fila de
   `schema_migrations`, deja `user_version` 9 y reactiva las FKs. No se ejecuta
   automáticamente: la vía soportada es restaurar la copia pre-migración.

8. **Exportación y biblioteca.** El manifiesto de mundo usa `schemaVersion` 10;
   el formato sigue en `world-craft-world` v2 con lectura de v1. Las filas en
   cuarentena no se exportan porque ningún mundo las referencia. La copia
   completa de SQLite de la biblioteca sí incluye las tablas de cuarentena,
   igual que la copia `pre-delete`.

9. **Borrado total.** No hay una limpieza separada de cuarentena: borrar todos
   los datos elimina la base y `assets/`, y la copia `pre-delete` ya incluye
   ambos. La cuarentena no crea una obligación de borrado adicional.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Abortar la migración si hay un asset huérfano referenciado | Deja la app en modo seguro y bloquea la actualización por datos que ya no tienen mundo; la copia previa y la auditoría permiten conservar el máximo de información sin bloquear. |
| Crear un mundo sintético para los huérfanos | Contamina la biblioteca con un mundo que el usuario no creó y oculta el problema en las vistas. |
| Reasignar los huérfanos a otro mundo y mover sus archivos | Exige I/O de archivos durante el arranque, puede fallar a medias y no hay un destino correcto que elegir por el usuario. |
| Limpiar la referencia del otro mundo para permitir la purga | Pérdida visible y silenciosa de una portada o imagen en uso; se prefiere rechazar con `assets-in-use`. |
| Borrar las filas huérfanas en la migración | Pierde metadatos y la única pista para localizar los archivos; contradice la regla de no perder datos. |
| `PRAGMA defer_foreign_keys` o `legacy_alter_table` | Comprobado sobre una base temporal: `defer_foreign_keys` no evita `RESTRICT` y `legacy_alter_table` no impide que SQLite reescriba referencias al renombrar con FKs activas. |
| Hacer `DROP TABLE assets` con las FKs activas | Dispara `RESTRICT`, `SET NULL` y `CASCADE` y destruye datos válidos de portadas, fichas y galería. |
| Mantener `assets.world_id` sin FK y confiar en el servicio | La base seguiría admitiendo huérfanos y la purga no tendría una garantía comprobable. |
| Borrar también los archivos al purgar un mundo | Destruye archivos que pueden estar compartidos y elimina la vía recuperable del flujo de huérfanos. |
| Ofrecer una pantalla para restaurar filas de cuarentena | Exigiría reasignar mundos, mover archivos y resolver conflictos; queda fuera del alcance y no es necesaria para la integridad. |
| Exponer recuentos con IDs, rutas o nombres | El renderer solo necesita números; cualquier detalle interno amplía la superficie y contradice el contrato de datos. |

## Consecuencias

### Positivas

- La base impide que un asset quede sin mundo y que se borre un mundo con
  assets referenciados; el borrado lógico sigue funcionando.
- La migración conserva todas las filas y archivos válidos y deja un registro
  verificable de cada huérfano y de cada vínculo visible retirado.
- La purga nunca elimina un asset en uso y distingue «no había nada» de «se
  conservaron elementos en uso».
- Los archivos de un mundo purgado siguen en el equipo y quedan disponibles
  para el análisis de huérfanos con confirmación y copia.
- El runner no puede dejar las FKs desactivadas ni confirmar un lote con
  huérfanos; cualquier violación revierte y entra en modo seguro.
- La interfaz explica la cuarentena y el rechazo sin mostrar rutas, IDs ni
  nombres internos.
- Sin dependencias nuevas, sin red y sin servicios de pago.

### Negativas y riesgos

- **La cuarentena crece sin límite.** Solo contiene metadatos y no se limpia en
  esta entrega; una base con muchos mundos purgados acumula filas históricas.
- **Los archivos en cuarentena ocupan disco** hasta que el usuario ejecute la
  purga de huérfanas, que exige confirmación y copia.
- **El aviso de Ajustes es histórico y persistente.** Sigue visible aunque el
  usuario ya haya purgado los archivos, porque el texto dice «si todavía está en
  el equipo» y no promete recuperación.
- **`quarantine.references` cuenta vínculos, no imágenes distintas.** Una misma
  imagen referenciada en varios sitios suma varias unidades; el texto habla de
  «vínculos».
- **La migración desvincula referencias visibles.** Es una decisión de producto
  aprobada con auditoría, copia previa, aviso y rollback; el riesgo residual es
  de producto, no de seguridad.
- **El rollback manual devuelve filas `world-purged` a `assets`.** El esquema
  antiguo no tiene FK y puede convivir con mundos ausentes, como antes de
  `0009`; no se soporta downgrade de la aplicación.
- **El runner desactiva FKs durante el lote.** Una migración futura que confíe
  en cascadas dejará huérfanos; `foreign_key_check` los detecta y obliga a
  corregir la migración.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Sin pantallas ni componentes nuevos. El error de purga vive en el diálogo existente, el vaciado añade estados y el aviso de Ajustes es texto pasivo. Comprobado a 1024, 1280 y 1600 px sin scroll horizontal de página. |
| Temas (Claro/Oscuro) | Se reutilizan `--danger`, `--fg`, `--muted`, `--warning` y `--warning-surface`; la única clase nueva es `.wc-settings__notice`, sin colores literales y con contraste AA en ambos temas. |
| Accesibilidad | Error con `role="alert"` sin duplicar `aria-live`, resumen del vaciado con `role="status"`, foco dentro del diálogo y retorno al disparador, aviso sin foco ni parada de tabulación y `prefers-reduced-motion` respetado. |
| Seguridad y privacidad | Sin canales IPC nuevos ni cambios en la allowlist, CSP, protocolo `wc-asset://`, aislamiento o preload. Los resultados solo añaden enums y números; la cuarentena guarda rutas relativas y `alt` que nunca se exponen al renderer. SQL estático y `foreign_key_check` sin detalles en logs. |
| Datos y preservación | Copia pre-migración obligatoria, transacción, reconstrucción con FKs desactivadas y `foreign_key_check`, rollback de referencia y prueba de rollback/reaplicación. Filas y archivos válidos intactos; huérfanos auditados; archivos nunca borrados en migración ni purga. `user_version` 10. |
| Exportación e importación | El formato de mundo sigue en v2 con lectura de v1; `schemaVersion` pasa a 10. Las filas en cuarentena no se exportan; la copia completa de la biblioteca y la de `pre-delete` sí las incluyen. |
| Coste | 0 €/mes: SQLite, Drizzle y Zod ya estaban; no hay servicios, telemetría ni dependencias nuevas. |
| Portabilidad de datos | Todo vive en la base y en `assets/`; una copia o restauración recupera la cuarentena y los archivos siguen en el equipo. Los paquetes de mundo siguen siendo ZIP abiertos sin filas en cuarentena. |

## Riesgos y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Pérdida de datos al reconstruir `assets` | Crítico | Copia pre-migración verificable, FKs fuera de la transacción, `foreign_key_check` antes del commit, prueba columna a columna y rollback probado | #116, migraciones |
| `DROP TABLE` con FKs activas dispara cascadas | Crítico | El runner desactiva FKs fuera de la transacción; el SQL de la migración no toca el pragma | #116, runner |
| Las FKs quedan desactivadas tras migrar | Crítico | Restauración en `finally`, verificación de `foreign_keys = 1` y modo seguro si falla | #116, runner |
| Una migración futura confía en cascadas con FKs off | Alto | `foreign_key_check` antes del commit y contrato documentado en el ADR y en migraciones | Cada migración |
| Pérdida visible de una portada o imagen de ficha | Alto | Auditoría en `assets_quarantine_references`, copia previa, aviso en Ajustes y rollback | #116, manual |
| Purga bloqueada por referencias cruzadas | Medio | `assets-in-use`, reintentos del vaciado y mensaje que explica el motivo | #116, QA |
| La purga de huérfanas borra archivos en cuarentena | Medio | Sigue exigiendo confirmación y copia verificada; el aviso y el manual lo explican | #116, Ajustes |
| Base con violaciones de FK previas | Alto | La migración entra en modo seguro, conserva la copia y no oculta la violación | #116, seguridad |
| Crecimiento indefinido de la cuarentena | Bajo | Solo metadatos; no se borran archivos; se documenta y se revisa con una issue posterior | Docs |
| Sin downgrade soportado | Medio | La vía segura es restaurar la copia; el rollback de esquema es de referencia | Migraciones |

No aplica ningún servicio de pago: la migración, la cuarentena, el runner y la
purga son locales y usan el stack existente.

## Plan de revisión

- **M2 (mapas) y M3 (manuscritos y escenas):** si añaden nuevas FKs a `assets`
  (`maps.thumbnail_asset_id` u otras), ampliar `countExternalAssetReferences`,
  `resolvePurgeableWorlds` y la prueba guardián antes de activar las tablas.
- **Purga de imágenes huérfanas:** revisar el flujo si se añade un cierre del
  aviso de Ajustes, una restauración de cuarentena o una limpieza de sus filas.
- **M5:** comprobar el rendimiento de `foreign_key_check` y de
  `assets_quarantine_references` en bases grandes y con muchas purgas.
- **Cualquier cambio de la regla «un asset está en uso»**, de los motivos de
  cuarentena, de la FK o del contrato del runner exige un ADR nuevo que
  superseda este. No se edita este ADR para cambiar la decisión.

## Referencias

- Issue: #116 — Integridad de assets: clave foránea a mundos y cuarentena.
- Issues relacionadas: #66 (servicio de assets), #72 (mundos), #77 (papelera),
  #78 (exportación e importación), #79 (Ajustes y datos), #114 (formato v2) y
  #115 (portada del mundo).
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md),
  `0009_assets_world_fk`
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), secciones 4.7
  y 4.7.1
- [`docs/persistencia.md`](../persistencia.md), secciones 4.4, 5 y 8
- [`docs/continuidad.md`](../continuidad.md), sección 6
- [`docs/arquitectura.md`](../arquitectura.md), secciones 2.21, 3.1 y 4
- [`docs/formato-de-exportacion.md`](../formato-de-exportacion.md), secciones 3
  y 11
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), sección
  3.21
- [`docs/manual-de-usuario.md`](../manual-de-usuario.md), secciones 6 y 12.5
- [`docs/diseno/assets-cuarentena-issue-116.md`](../diseno/assets-cuarentena-issue-116.md),
  contrato de interfaz aprobado
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-056
- [ADR 0016](0016-sqlite-migrations-safe-mode.md), [ADR 0017](0017-assets-service-sharp-orphan-purge.md),
  [ADR 0028](0028-trash-versions-and-pre-purge-backup.md),
  [ADR 0029](0029-world-export-import.md),
  [ADR 0030](0030-settings-data-and-full-deletion.md) y
  [ADR 0031](0031-descripcion-enriquecida-del-mundo-y-formato-v2.md)
