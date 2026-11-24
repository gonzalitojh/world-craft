# ADR 0028 — Papelera, versiones de contenido y copia previa a la purga

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-24
- **Fecha del documento:** 2026-11-24
- **Issue:** #77 (`M1-06`), dentro del hito M1
- **Decisiones del registro:** D-051
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0012, ADR 0016, ADR 0017, ADR 0019, ADR 0020, ADR 0021, ADR 0022, ADR 0023, ADR 0027
- **Consumidores previstos:** exportación de un mundo (#78), FK `assets.world_id` y
  cuarentena de huérfanos (#116), mapas (M2) y manuscritos y escenas (M3)
- **QA y seguridad:** PASS de `qa-reviewer` (2026-11-24) y PASS de
  `security-champion` sin hallazgos HIGH ni MEDIUM (2026-11-24)

## Contexto

Desde #72 a #76 el contenido se borra de forma lógica (`deleted_at`) y las
vistas, la búsqueda y las mutaciones ya excluyen lo borrado, pero **no existía
una forma visible de recuperarlo**. Los textos de la interfaz prometían una
papelera «cuando esté disponible» y las copias de seguridad eran la única red de
recuperación documentada. El usuario tenía que poder ver lo borrado, restaurarlo
a su sitio y decidir cuándo eliminarlo de verdad.

La issue #77 exigía además un historial de versiones para la descripción de las
fichas: el autoguardado de 700 ms impedía guardar una versión por escritura, pero
también hacía fácil destruir un texto largo sin vuelta atrás.

El contexto técnico imponía cuatro restricciones:

1. **`activity_log` no tiene `ON DELETE CASCADE`.** Su clave foránea a `worlds`
   con `no action` bloquearía el borrado físico de un mundo si se intentara el
   orden natural (mundo primero).
2. **`assets` no tiene clave foránea a `worlds`.** La reconstrucción de la tabla,
   la cuarentena de huérfanos y la FK llegan con #116; #77 no puede añadirlas sin
   duplicar esa issue.
3. **El manifiesto de copia v2 es un contrato cerrado** con Zod estricto y una
   lista de motivos. Cualquier motivo nuevo debe seguir siendo legible por las
   copias existentes y por el lector actual.
4. **Los assets son del mundo, no de la ficha.** Un mismo archivo puede estar en
   la ficha, en su galería y en otra ficha; borrarlo al purgar una ficha
   destruiría contenido vivo.

El usuario aprobó las ocho recomendaciones del plan (D1–D8): se purgan también
los mundos, la copia previa usa el motivo `pre-purge` sin subir el formato, los
assets no se borran, las automáticas se limitan a 20 con retención de 90 días y
las manuales a 50 sin caducidad.

## Decisión

1. **Papelera global con tres grupos y una sola vista.** `trash:list` pagina por
   cursor opaco `${deletedAt}:${id}` con orden `deleted_at DESC, id DESC` (50 por
   defecto, máximo 200) y devuelve mundos, fichas y tipos personalizados con su
   mundo y tipo de origen, la fecha de borrado y si el mundo de origen está en
   papelera. Los tipos del sistema nunca aparecen. La papelera es una vista del
   rail —**Inicio · Mundos · Papelera**—, no una pantalla por mundo.
2. **Restaurar devuelve a su contexto original con motivos explícitos.**
   `not-found`, `already-restored`, `world-in-trash` y `type-unavailable` viajan
   como resultado, no como excepción. Un mundo se restaura y sus fichas y tipos
   que no estaban borrados reaparecen con él; **no se restauran en cascada** los
   que ya estaban en papelera. La restauración es un `UPDATE ... WHERE deleted_at
   IS NOT NULL` en transacción, idempotente y sin carreras entre ventanas.
3. **La purga es física, ordenada, transaccional y siempre precedida de copia.**
   Si el usuario confirma `delete-forever` o `empty-trash`, se crea primero
   `backups/pre-purge/<timestamp>/` y se verifica (tamaño, SHA-256,
   `integrity_check` y `user_version`); si falla, **no se borra nada** y se
   devuelve `backup-failed`. El borrado ocurre después en una transacción
   síncrona y en este orden:
   - **Ficha:** relaciones, versiones, etiquetas y galería; después la ficha. Los
     documentos de búsqueda los limpia el trigger existente.
   - **Tipo personalizado:** se rechaza con `type-in-use` si queda cualquier
     ficha, viva o en papelera; si no, se elimina la fila.
   - **Mundo:** `activity_log` **primero** (su FK sin cascada bloquearía el
     resto), después relaciones, galería, etiquetas, versiones, fichas, tipos del
     mundo, etiquetas del mundo y el mundo.
   Una única cola serializa purgas y vaciado para que no se solapen dos copias ni
   dos borrados; la copia se hace fuera de la transacción porque el borrado
   posterior es síncrono.
4. **Copia `pre-purge` dentro del manifiesto v2, sin subir el formato.**
   `pre-purge` se añade al enum `BACKUP_REASONS` y a la carpeta
   `backups/pre-purge`. Los manifiestos existentes no contienen ese valor, así
   que el lector actual los sigue aceptando y **no se reescribe ninguna copia**.
   La rotación conserva las **10 copias válidas más recientes**, nunca borra la
   más reciente ni las corruptas, y se ejecuta con el resto de la rotación al
   arrancar. No se soporta downgrade: una versión anterior no lee un motivo que
   no conoce, y eso ya era cierto para cualquier evolución del manifiesto.
5. **Tabla `entity_versions` y migración `0007` aditiva.** Migración
   `0007_trash_versions`: tabla `entity_versions` (`id`, `entity_id` con FK
   `ON DELETE CASCADE`, `description` JSON nullable, `description_text`, `label`,
   `origin` en `auto|manual|restore`, `created_at`), índices
   `entity_versions_entity_created_idx`, `entities_deleted_idx` y
   `entity_types_deleted_idx`, y `user_version` 8. Rollback de referencia en
   `drizzle/rollback/0007_trash_versions.down.sql`. No se edita ninguna migración
   aplicada.
6. **Política de versiones.** Una automática guarda el **estado saliente** solo
   si la descripción cambia de verdad y la última versión automática está fuera
   de la ventana de **5 minutos**; se conservan **20 por ficha** con retención de
   **90 días**, sin podar nunca la más reciente. Las **manuales** llevan etiqueta
   obligatoria de 1 a 120 caracteres y su tope es **50**, sin caducidad.
   Restaurar una versión inserta antes una copia `origin: 'restore'` del estado
   actual, que **nunca se poda**: restaurar no destruye contenido. La interfaz
   solo recibe metadatos y una vista previa de texto de 2 000 caracteres, nunca
   el JSON histórico completo. Una ficha en papelera no muestra ni genera
   versiones; purgarla las borra en cascada.
7. **Una sola regla de búsqueda y exportación.** Las vistas normales, la búsqueda
   y los canales existentes ya filtran por `deleted_at` y por mundo vivo; el
   renderer no duplica la condición. #78 exportará solo lo que cumpla
   `deleted_at IS NULL` y cuyo mundo esté vivo, incluirá las versiones de las
   fichas exportadas y omitirá las de fichas en papelera; lo purgado ya no existe.
8. **Los assets no se borran en #77.** Ni una fila de `assets` ni un archivo. Las
   filas de un mundo purgado quedan huérfanas a propósito y #116 añadirá la FK
   `assets.world_id` y la cuarentena antes de activar la restricción.
9. **Reutilización en M2 y M3.** Mapas y escenas reutilizan el patrón
   `deleted_at` + papelera + purga con copia; las versiones de escena usarán su
   propia tabla (`scene_versions`) porque su contenido no es una descripción de
   ficha. No se generaliza `entity_versions` a un `content_versions` polimórfico
   hasta que exista una segunda forma real de contenido versionado.
10. **La sección Historial de la ficha no se persiste.** Es un despliegue local
    cerrado por defecto. Añadir `history` a `ENTITY_SECTION_IDS` invalidaría el
    guard de claves exactas de `ui.entity-view` y reiniciaría en silencio el panel
    guardado de los usuarios actuales (ADR 0027).

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Solo restaurar mundos y aplazar su purga a #116 | «Vaciar la papelera» nunca podría completarse y #116 no purga: solo añade la FK y la cuarentena. La papelera quedaría permanentemente incompleta. |
| Reutilizar `pre-restore` como motivo de la copia previa a la purga | Mezcla dos semánticas y rompe la restauración, que rechaza ese motivo a propósito. Además confundiría la recuperación manual de una restauración fallida. |
| Subir el manifiesto a `formatVersion: 3` para añadir el motivo | Rompe lectores anteriores y obliga a tocar verificación, restauración y rotación. Añadir un valor al enum mantiene el formato y las copias existentes. |
| No podar nunca las copias `pre-purge` | Es más seguro, pero una base grande con vaciados repetidos puede llenar el disco. La rotación a 10 conserva la más reciente y no borra las corruptas. |
| Borrar también los assets al purgar | Destruye archivos compartidos por el mundo y choca con #116, que debe ponerlos en cuarentena con su propia copia. Viola la regla de no perder datos del usuario. |
| Versión por cada autoguardado o por sesión de edición | El autoguardado cada 700 ms generaría cientos de filas; una versión por sesión pierde trabajo si la app se cierra. La ventana de 5 minutos sobre el estado saliente da granularidad útil sin ruido. |
| Permitir consultar y restaurar el historial de fichas en papelera | Más UI y estados para un caso sin valor claro: primero se restaura la ficha y después se consulta su historial. |
| Etiqueta opcional en las versiones manuales | Sin etiqueta, las manuales se confunden con las automáticas y pierden su función de punto de referencia. |
| Persistir la sección Historial en `ui.entity-view` | El guard de claves exactas reiniciaría el estado guardado de panel, ancho y secciones de todos los usuarios actuales. |
| Purga con `DELETE FROM worlds` y confiar en las cascadas | `activity_log` no tiene cascada y bloquearía el borrado; además el orden quedaría implícito y difícil de probar. |
| Dejar el historial sin límite y sin retención | El autoguardado llenaría la base; la combinación 20/90 días + 50 manuales acota el coste sin perder puntos de referencia. |

## Consecuencias

### Positivas

- Lo borrado ya no se pierde: se ve, se restaura a su mundo y tipo originales y
  se puede eliminar de verdad cuando el usuario lo decide.
- La purga es segura por construcción: copia verificable obligatoria, orden
  explícito de borrado y transacción. Un fallo de copia no borra nada.
- El historial da una salida al autoguardado agresivo sin penalizar cada
  pulsación: 20 automáticas agrupadas y 50 manuales con etiqueta.
- Restaurar una versión nunca destruye el estado actual: se conserva como
  `origin: 'restore'` y no se poda.
- La migración `0007` es aditiva y preserva todos los datos; los índices de
  papelera usan el plan de consulta.
- M2 y M3 reutilizan el patrón de papelera y purga sin reimplementar reglas.
- No hay dependencias nuevas, servicios de pago ni red: el coste sigue en 0 €/mes.

### Negativas y riesgos

- **Assets huérfanos tras purgar un mundo.** Es deliberado: no se borran filas ni
  archivos hasta #116. Ocupan disco y la interfaz no puede ofrecer todavía una
  limpieza guiada.
- **La copia previa puede tardar en bases grandes.** Se hace fuera de la
  transacción y la interfaz muestra un estado de espera; aun así, la purga no es
  instantánea.
- **La copia `pre-purge` no tiene un botón de «deshacer».** Hoy se recupera desde
  el aviso de modo seguro o copiando el archivo a mano con la app cerrada; el
  acceso guiado llegará con Ajustes.
- **No hay downgrade de la app.** Una versión anterior al manifiesto con
  `pre-purge` no debería leer esas copias; el formato no cambia, pero el motivo
  nuevo no existía antes.
- **La restauración de un mundo no restaura en cascada** sus fichas o tipos
  previamente en papelera. Es una decisión explícita que hay que explicar en la
  interfaz y el manual.
- **Los 50 manuales son un tope duro de creación**: al alcanzarlo, el usuario
  debe conservar su historial por otra vía (exportación en #78) antes de seguir.
- **El vaciado omite tipos con fichas** y los cuenta en `skipped`; no es un
  borrado total silencioso.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Escritorio | Nueva vista Papelera en el rail y sección Historial dentro de la ficha, probadas a 1024, 1280 y 1600 px sin scroll horizontal de página. |
| Temas (Claro/Oscuro) | Acciones destructivas con tokens `danger`, diálogos con casilla obligatoria y avisos; contraste AA en ambos modos y sin elementos invisibles. |
| Accesibilidad | Tres secciones con `h2`, listas semánticas, `aria-live` para resultados y recuentos, foco devuelto tras restaurar o purgar y `prefers-reduced-motion` respetado. |
| Seguridad y privacidad | 7 canales nuevos en allowlist, Zod estricto, literales de confirmación, guardas en el preload y servicios `unavailable` en modo seguro. Sin contenido remoto, sin rutas internas expuestas y sin acceso del renderer a Node o SQLite. |
| Datos y preservación | Migración aditiva `0007` con `user_version` 8, rollback de referencia y prueba de preservación desde `0006`. La purga exige copia y transacción; los assets siguen intactos. |
| Exportación (#78) | Se exporta solo contenido vivo en mundos vivos e incluye las versiones de las fichas exportadas; la papelera nunca se exporta y lo purgado ya no existe. |
| Coste | 0 €/mes: sin dependencias nuevas, servicios externos, telemetría ni red. |
| Portabilidad | Las versiones y la papelera viven en la misma base; una copia o restauración las recupera. Los assets no viajan en las copias. |

## Riesgos y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| `activity_log` bloquea el borrado de un mundo | Purga imposible | Borrado explícito de la actividad primero, con prueba de integración dedicada | #77 |
| Purga lenta por copiar una base grande | Segundos o minutos | Copia fuera de la transacción, estado «Creando la copia…» y cola que impide solapar purgas | #77 |
| Copias `pre-purge` sin límite | Disco | Rotación a 10 válidas; nunca se borra la más reciente ni las corruptas | #77 |
| Restaurar un mundo con fichas en papelera | Confusión del usuario | No se restaura en cascada; se explica el orden y cada elemento se restaura por separado | #77 |
| Cientos de versiones por autoguardado | Base y rendimiento | Ventana de 5 min, comparación real de contenido y poda 20/90 días con pruebas de política | #77 |
| Pérdida de contenido al purgar | Pérdida grave | Copia verificable obligatoria, si falla no se borra, transacción y assets intactos | #77, #116 |
| Manifiesto v2 rechazado por una versión antigua | Copia ilegible | No se soporta downgrade; el formato no cambia y se documenta | #77 |
| Cursor de papelera con empates de milisegundo | Filas repetidas o perdidas | Orden y cursor compuestos `(deleted_at, id)` con prueba de páginas encadenadas | #77 |
| Regresión del panel por añadir una sección persistida | Estado del usuario | El historial no se persiste | #132, #77 |
| Assets huérfanos tras purgar un mundo | Disco | Aceptado por diseño; #116 pone en cuarentena y añade la FK | #116 |

No hay riesgos de free tier: la decisión no añade servicios, cuentas ni
dependencias de pago.

## Plan de revisión

- Se revisa cuando #116 añada la FK `assets.world_id` y la cuarentena: habrá que
  decidir si la purga de un mundo mueve sus assets a la cuarentena y si el orden
  de borrado cambia.
- Se revisa cuando #78 implemente la exportación: la regla de «solo vivo» y la
  inclusión de versiones no deben redecidirse en la interfaz.
- Se revisa cuando M2 (mapas) y M3 (escenas) reutilicen el patrón: si aparece una
  segunda forma de contenido versionado, se valorará una tabla común en un ADR
  nuevo que superseda a este.
- Se revisa si se añade «deshacer purga» desde Ajustes o una pantalla de copias
  con restauración guiada, o si cambia la retención 10/20/90/50.
- Cualquier cambio del manifiesto a `formatVersion: 3`, de los motivos de copia o
  del esquema de `entity_versions` exige un ADR nuevo.

## Referencias

- Issue: #77
- Issues relacionadas: #72, #73, #74, #75, #76, #78, #116, #132
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), §4.1, §4.2,
  §4.3, §4.14 y §5
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md), §2, §4
  y §5
- [`docs/persistencia.md`](../persistencia.md), §2, §4.4, §5, §6 y §8
- [`docs/continuidad.md`](../continuidad.md), §6
- [`docs/manual-de-usuario.md`](../manual-de-usuario.md), §3.1, §5.8, §5.9 y §6
- [`docs/arquitectura.md`](../arquitectura.md), §2.16, §3.4 y §4
- [`docs/adr/0012-backup-restore-recovery.md`](0012-backup-restore-recovery.md)
- [`docs/adr/0016-sqlite-migrations-safe-mode.md`](0016-sqlite-migrations-safe-mode.md)
- [`docs/adr/0017-assets-service-sharp-orphan-purge.md`](0017-assets-service-sharp-orphan-purge.md)
- [`docs/adr/0021-entities-crud-gallery-tags-editor.md`](0021-entities-crud-gallery-tags-editor.md)
- [`docs/adr/0027-ui-preferences-persistence.md`](0027-ui-preferences-persistence.md)
