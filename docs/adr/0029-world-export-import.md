# ADR 0029 — Exportación e importación de mundos

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-25
- **Fecha del documento:** 2026-11-25
- **Issue:** #78 (`M1-07`), dentro del hito M1
- **Decisiones del registro:** D-052
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0012, ADR 0016, ADR 0017, ADR 0019, ADR 0020, ADR 0021,
  ADR 0022, ADR 0023, ADR 0028
- **Consumidores previstos:** cuarentena de assets y FK `assets.world_id`
  (#116), mapas (M2), manuscritos y escenas (M3), Ajustes → Datos (#79) y M5
- **QA y seguridad:** PASS de `qa-reviewer` (2026-11-25) y PASS de
  `security-champion` sin hallazgos HIGH (2026-11-25; los MEDIUM se cerraron
  antes de documentar)

## Contexto

World Craft guarda todo el contenido en el equipo de la persona usuaria. Las
copias automáticas protegen la base SQLite, pero **no incluyen los assets**: si
se pierde la carpeta de datos, las imágenes no se recuperan desde una copia. La
issue M1-07 (#78) pedía una vía de **portabilidad y recuperación fuera de la
aplicación**: llevar un mundo completo a otra instalación y poder inspeccionarlo
sin World Craft. El formato debía ser abierto, versionado y describible.

La importación introduce además un **archivo no confiable**. Un ZIP puede traer
rutas peligrosas, enlaces, entradas cifradas, nombres reservados de Windows,
duplicados, un número abusivo de archivos, contenido que miente sobre su tamaño
o un `world.json` manipulado. La operación no puede dejar filas a medias ni
tocar los mundos existentes, y debe funcionar sin red y sin servicios externos.

El contexto técnico fija varias restricciones:

1. **No hay migración disponible para #78.** El esquema ya tiene todo lo que
   necesita el formato: `user_version` sigue en **8**.
2. **Los tipos del sistema son implícitos.** Los 18 tipos de entidad y los 18 de
   relación se siembran con la migración; solo viajan los personalizados.
3. **La papelera es lógica.** Un mundo, una ficha o un tipo con `deleted_at` no
   debe viajar, y el índice FTS5 es reconstruible y tampoco se exporta.
4. **Los assets son del mundo.** Se referencian por portada, imagen principal y
   galería. Exportar un mundo sin sus imágenes produciría un paquete incoherente.
5. **Los ZIP pueden ser grandes.** D4 admite hasta 8 GiB comprimidos y 16 GiB
   descomprimidos: no se puede cargar el archivo entero en memoria.

El usuario aprobó el plan de `task-architect` (2026-11-25) con las decisiones
D1–D11. D4 se aprobó con el doble de los límites propuestos; el resto se mantuvo
según las recomendaciones.

## Decisión

1. **Formato ZIP abierto y versionado, siempre con assets.** El archivo es un
   ZIP con exactamente tres formas de entrada:
   - `manifest.json`: identificador del formato (`world-craft-world`),
     `formatVersion: 1`, `schemaVersion` igual a `user_version` en el momento de
     exportar (hoy 8), versión de la aplicación, fecha, `assetsIncluded: true`,
     mundo de origen, recuentos, avisos y la lista de archivos con tamaño y
     SHA-256.
   - `world.json`: contenido vivo del mundo.
   - `assets/<uuidv7>.webp`: cada imagen referenciada, ya en el WebP canónico de
     la aplicación.

   El manifiesto es la única fuente de verdad sobre los archivos y sus checksums.
   No hay entradas de directorio, miniaturas, archivos desconocidos ni
   mayúsculas. **La importación rechaza con `TRANSFER_FORMAT_UNSUPPORTED` un
   manifiesto cuyo `schemaVersion` supere el `user_version` que entiende la
   aplicación instalada.** La comprobación ocurre después de validar el
   manifiesto y antes de leer `world.json` o extraer assets; los esquemas iguales
   o anteriores se aceptan y su contenido se valida con Zod estricto. La versión
   instalada se propaga del proceso principal al worker en la solicitud de
   importación. El formato v1 incluye `world`, `entityTypes`
   (`entity-types.v1`), `relationTypes` (`relation-types.v1`), `tags`, `assets`,
   `entities` con `versions`, `gallery`, `imageAssetId`, `attributes` y
   `tagNames`, `relations` y `coverAssetId`. **No incluye** papelera, contenido
   purgado, `activity_log`, FTS5, preferencias de aplicación, miniaturas, assets
   no referenciados, IDs internos de tipos del sistema, `description_text`,
   `relative_path`, fechas de borrado o archivo, rutas del sistema ni bloques de
   mapas, manuscritos, escenas o juego que aún no existen.

2. **Solo contenido vivo de mundos vivos, con las versiones de las fichas
   exportadas.** La instantánea se lee en una transacción diferida y filtra
   `deleted_at IS NULL` en mundos, fichas y tipos personalizados; las relaciones
   exigen ambos extremos vivos; los assets salen de las referencias vivas
   (portada, imagen principal y galería). Las versiones de las fichas
   exportadas viajan completas. Un mundo archivado puede exportarse, pero su
   estado de archivo no forma parte del formato: al importar queda activo.

3. **La importación crea siempre un mundo nuevo.** Nunca fusiona, actualiza ni
   sobrescribe un mundo existente. Todos los IDs internos se regeneran con
   UUIDv7 —mundo, tipos, etiquetas, assets, fichas, versiones, relaciones y la
   fila de actividad— y todas las referencias se remapean. El `slug` global del
   mundo se resuelve con sufijo `-2`, `-3`… hasta `-9999` si ya existe en
   cualquier estado (activo, archivado o en papelera); el resultado indica
   `slugAdjusted`. Los tipos del sistema se resuelven por clave y no se
   duplican; los personalizados se insertan. El mundo importado queda **activo**,
   con `settings` vacío y fecha de importación; los tipos personalizados y de
   relación usan la fecha de importación, mientras las fichas, etiquetas,
   versiones, assets y relaciones conservan sus fechas originales. La actividad
   registra `world.imported` con los recuentos y el total de avisos.

4. **`yauzl@^3.4.0` para leer y `yazl@^3.3.1` para escribir.** Ambas son MIT,
   pequeñas y con mantenimiento; `yauzl` permite recorrer el índice central,
   validar tamaños y leer por streaming sin cargar el ZIP en memoria, y `yazl`
   escribe por streaming y no recomprime los WebP. La integridad se comprueba
   con SHA-256 de los bytes descomprimidos; el CRC del contenedor no se usa como
   garantía. Se declaran como dependencias de ejecución, se externalizan del
   bundle y se incluyen sus licencias y las de `pend` (dependencia de `yauzl`) y
   `buffer-crc32` (dependencia de `yazl`) en `THIRD-PARTY-NOTICES.md` y
   `licenses/`. Se descartan `fflate` (API de bajo nivel: obligaría a implementar
   el índice, los CRC y la política de entradas), `jszip` (trabaja en memoria y
   no sirve para los límites D4) y `adm-zip` (síncrono y en memoria, sin
   validación estricta de entradas y con menor actividad).

5. **ZIP, JSON y assets en un `utilityProcess`; SQLite en el proceso
   principal.** Electron arranca `out/main/transfer-worker.cjs` con
   `utilityProcess.fork` y una ruta fija. El worker no importa Electron, usa
   `process.parentPort` y valida cada mensaje con Zod estricto; no hace `eval`,
   no abre `child_process`, no usa la red y no escribe en SQLite (la exportación
   abre la base en solo lectura). La transacción de importación, el renombrado
   del directorio de assets y la comprobación final siguen en el proceso
   principal, que es el único que escribe. Hay **una sola operación activa**;
   una segunda solicitud recibe `TRANSFER_BUSY`. El progreso llega por el evento
   `transfer:event`, fuera de la allowlist de `invoke`; `saving` no es
   cancelable porque la transacción o la publicación ya están en curso.

6. **Staging, transacción única y publicación.** La importación prepara todo en
   `imports/.tmp/<operationId>`: índice, manifiesto, `world.json`, assets
   extraídos y `plan.json`. Los assets procesados se mueven a
   `assets/.tmp/<operationId>/<worldId>`. El proceso principal vuelve a validar
   el plan y los assets, abre **una transacción**, inserta las filas en orden de
   claves foráneas, renombra el directorio de assets a
   `assets/worlds/<worldId>` **antes del commit** y confirma. Un fallo revierte
   SQLite y elimina el directorio publicado; una cancelación antes de `saving`
   limpia el staging completo. La limpieza al arrancar vacía
   `imports/.tmp`, `exports/.tmp` y `assets/.tmp`; nunca toca
   `assets/worlds`.

7. **Límites D4, comprobados antes y durante la extracción.** ZIP de 8 GiB,
   16 GiB descomprimidos, 10.000 entradas, `world.json` de 256 MiB, manifiesto
   de 16 MiB, 50.000 fichas, 500.000 versiones, 300.000 relaciones, 5.000
   etiquetas, 1.000 tipos de entidad, 1.000 tipos de relación, 8.000 assets y
   140 caracteres de ruta. Se mantienen los límites por registro existentes:
   25 MiB por imagen, 8192 px por lado y 24 Mpx, 200.000 bytes/50.000
   caracteres de descripción, 500 de `alt`, 20 de galería, 12 etiquetas, 10
   alias y 8 géneros. En importación se exige un ratio de compresión máximo de
   **100:1** por entrada; en la verificación de una exportación propia ese ratio
   se desactiva para no rechazar un mundo legítimamente muy comprimible. Antes
   de extraer se comprueba el espacio libre con un margen de 64 MiB y se reserva
   el tamaño declarado más una estimación de miniaturas y del plan; en
   exportación se suma el posible archivo de destino existente.

8. **Saneo con avisos, sin inventar contenido.** Las referencias que pueden
   estar rotas en un paquete manipulado se eliminan y se cuentan por código:
   enlaces `wc-entity://`, atributos `reference`, galería, portada, imagen
   principal, tipos ausentes, etiquetas ausentes, relaciones sin extremo o tipo
   y versiones ilegibles. Los atributos que no encajan en la plantilla se
   descartan; un campo obligatorio ausente no se inventa. Una ficha cuyo tipo
   personalizado no está se descarta, y sus relaciones se descartan también. Un
   origen de versión desconocido se normaliza a `auto`. Los IDs repetidos,
   slugs repetidos, recuentos incoherentes o un checksum incorrecto invalidan el
   paquete entero. Los avisos se agregan por código y nunca incluyen rutas, IDs,
   nombres ni contenido.

9. **Sin copia previa a importar.** La importación solo añade un mundo nuevo y
   ocurre en una transacción; no modifica ningún dato existente. Pedir una copia
   de toda la base antes de cada importación duplicaría el coste y el espacio sin
   proteger nada que la transacción no proteja ya. La copia previa sigue siendo
   obligatoria para las operaciones destructivas (purga, vaciado y migraciones).

10. **Sin migración y sin dependencia de servicios.** `user_version` sigue en
    8; no se toca `drizzle/`. Todo funciona sin conexión: el formato, el worker,
    la validación y la transacción son locales. No hay telemetría ni subida de
    contenido.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| ZIP solo con `world.json` y JSON de assets, sin manifiesto | Sin una lista cerrada de archivos y checksums no se puede verificar el paquete ni detectar un ZIP manipulado. El manifiesto es la única fuente de verdad. |
| Exportación opcional sin assets | Dejaría imágenes rotas al importar y contradice la recuperación completa fuera de la app. D3 aprobó exportar siempre con assets. |
| Importación que fusiona o sobrescribe un mundo existente | Los IDs, slugs, etiquetas y relaciones colisionarían; una fusión parcial es irreversible y exige reglas de conflicto que el MVP no necesita. D2 aprobó siempre mundo nuevo. |
| Copiar los bytes WebP del ZIP sin re-codificar | Un archivo no confiable podría no ser WebP válido o contener metadatos y dimensiones abusivas. La importación detecta el formato por magic bytes y re-codifica con los límites del servicio de assets, regenerando la miniatura. |
| Exportar e importar en el proceso principal | Bloquearía la interfaz y la ventana durante operaciones de minutos. El `utilityProcess` aísla ZIP, JSON y procesado de imágenes; la transacción sigue en el proceso principal. |
| `fflate` | Muy rápido y pequeño, pero su API de ZIP es de bajo nivel: habría que implementar el recorrido del índice, los CRC y la política cerrada de entradas. |
| `jszip` | Carga el ZIP completo en memoria; inviable con 16 GiB descomprimidos. |
| `adm-zip` | Síncrono y en memoria, sin streaming ni validación estricta de nombres; menor actividad de mantenimiento. |
| Importar tipos del sistema en el paquete | Duplicaría filas universales y complicaría la resolución. Se resuelven por clave contra el catálogo sembrado. |
| Exportar la papelera o `activity_log` | La papelera no es contenido vivo y la actividad es un historial local; ambos quedan fuera por D3 y por la regla de #77. |
| Exportar el índice FTS5 | Es reconstruible desde el contenido; los triggers lo repueblan al importar. |
| Guardar las exportaciones en `userData/exports` | El usuario elige el destino con el diálogo nativo; `exports/` solo reserva `.tmp` para temporales y limpieza. |

## Consecuencias

### Positivas

- Un mundo completo —fichas, tipos personalizados, etiquetas, relaciones,
  versiones e imágenes— se puede llevar a otra instalación y recuperar sin la
  nube.
- El ZIP es inspeccionable con herramientas estándar: JSON legible, WebP
  estándar y checksums SHA-256 verificables sin la aplicación.
- Un paquete creado por una versión futura que suba el esquema se rechaza con
  `TRANSFER_FORMAT_UNSUPPORTED` al leer el manifiesto, antes de tocar
  `world.json` o los assets; los esquemas iguales o anteriores se aceptan.
- La importación es aditiva y transaccional: un fallo o una cancelación antes de
  `saving` no deja un mundo parcial ni toca los mundos existentes.
- La política cerrada de entradas, los límites, el ratio de compresión y el
  staging bloquean traversal, ZIP bombs, enlaces y nombres reservados antes de
  escribir.
- El worker mantiene la interfaz fluida y el proceso principal conserva la
  autoridad sobre SQLite.
- No hay migración ni dependencias de pago: `user_version` sigue en 8 y
  `yauzl`/`yazl` son MIT.

### Negativas y riesgos

- **Crash entre el renombrado de assets y el commit.** SQLite revierte la
  transacción, pero el directorio `assets/worlds/<worldId>` puede quedar sin
  mundo. No hay mundo parcial, pero sí assets huérfanos hasta que #116 añada la
  FK `assets.world_id` y la cuarentena.
- **`.partial` junto al destino.** La exportación escribe un archivo temporal
  único (`<destino>.<uuidv7>.partial`) en la misma unidad para que el `rename`
  sea atómico. Un cierre abrupto puede dejarlo junto al destino; no se borra
  automáticamente porque vive en una carpeta elegida por el usuario.
- **ZIP grandes.** Los límites D4 permiten operaciones de varios minutos y un
  uso de disco y memoria considerable (manifiesto, `world.json` y `plan.json`
  se mantienen en memoria acotados por sus límites). La cancelación no es
  instantánea y `saving` no se puede cancelar.
- **Worker sin sandbox adicional.** `utilityProcess` es un proceso Node con la
  ruta fija del bundle; no importa Electron ni usa red, `eval` o
  `child_process`, pero no es un sandbox del sistema operativo. Los mensajes se
  validan con Zod y el proceso principal nunca confía en las rutas que devuelve:
  las comprueba antes de leer o borrar.
- **`writeImportPlan` serializa antes de comprobar el tamaño.** El pico de
  memoria está acotado por el `world.json` ya validado (256 MiB) y el límite de
  `plan.json` (512 MiB); es un residual no bloqueante.
- **El estado de archivo del mundo no viaja.** Un mundo archivado se importa
  como activo; es una decisión de producto, no una pérdida de fichas.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Diálogo de progreso de 40rem como máximo, con contenido largo que envuelve; la operación no bloquea la ventana porque corre en el worker. Probado a 1024, 1280 y 1600 px. |
| Temas (Claro/Oscuro) | Reutiliza `Dialog`, `Button`, `Badge`, `.wc-progress` y tokens existentes; sin tokens nuevos. Contraste AA comprobado en ambos temas. |
| Accesibilidad | Fase con `role="status"` y `aria-live="polite"`, error con `role="alert"`, barra con `role="progressbar"` y `aria-valuetext`; foco inicial en Cancelar o en la fase, retorno al disparador y `Escape` bloqueado durante la operación. `prefers-reduced-motion` detiene la barra indeterminada. |
| Seguridad y privacidad | Política cerrada de rutas, límites antes de extraer, ratio 100:1, checksums, detección por magic bytes, re-codificación, worker sin Electron, canales en allowlist, guardas en el preload y logs sin rutas, IDs, nombres ni contenido. Sin red ni telemetría. |
| Datos y preservación | La importación solo añade y es transaccional; los mundos existentes no se modifican. No hay copia previa porque no hay destrucción. `user_version` sigue en 8. |
| Coste | 0 €/mes: `yauzl` y `yazl` son MIT y no hay servicios. |
| Portabilidad de datos | ZIP abierto con JSON y WebP, inspeccionable sin la app; importable en otra instalación. Las copias automáticas siguen conteniendo solo SQLite. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Dependencias de compresión con mantenimiento escaso | MIT, sin coste | `yauzl` y `yazl` son librerías maduras y pequeñas; se fijan versiones, se externalizan y se revisan en la auditoría de dependencias | ADR 0014 y revisión de #78 |
| ZIP bomb o disco lleno | 8 GiB comprimidos, 16 GiB descomprimidos, ratio 100:1 | Límites antes y durante la extracción, ratio por entrada, preflight de espacio con margen de 64 MiB y cancelación | `docs/persistencia.md` §11 |
| Assets huérfanos tras un cierre abrupto | Sin coste | La importación usa un `worldId` nuevo y nunca reutiliza un directorio; la limpieza no toca `assets/worlds` | #116 |
| Worker como superficie adicional | Sin coste | Ruta fija, sin Electron, red, `eval` ni `child_process`; mensajes Zod y validación de rutas antes de leer o borrar | `docs/arquitectura.md` §5 |
| Formatos futuros | Sin coste | `formatVersion` se rechaza con `TRANSFER_FORMAT_UNSUPPORTED`; un cambio de contenido incrementará el formato | Plan de revisión |

No aplica ningún servicio de pago: el formato, el worker, la validación y la
transacción son locales y usan librerías MIT.

## Plan de revisión

- **#116:** al añadir la FK `assets.world_id` y la cuarentena, revisar el
  renombrado de `assets/.tmp/<operationId>/<worldId>` y la recuperación de un
  directorio huérfano tras un crash.
- **M2 (mapas) y M3 (manuscritos y escenas):** añadir sus bloques exige subir
  `formatVersion` y actualizar el lector, el escritor, el formato documentado y
  las pruebas de round-trip. No se añaden bloques vacíos en v1.
- **#79 (Ajustes → Datos):** decidir si la interfaz ofrece exportar todos los
  mundos o una copia manual con assets; no cambia el formato v1 por sí sola.
- **M5:** revisar los límites D4 con datos reales, la auditoría de dependencias,
  el tamaño del paquete y el comportamiento con ZIP muy grandes.
- **Cualquier cambio de `schemaVersion` que altere el contenido:** nuevo
  `formatVersion` y ADR que superseda este, sin editar el formato v1 aceptado.

## Referencias

- Issue: #78
- Issues relacionadas: #66 (assets locales), #72–#77 (mundos, tipos, fichas,
  relaciones, búsqueda, papelera y versiones) y #116 (FK de assets y cuarentena)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), M1-07
- [`docs/formato-de-exportacion.md`](../formato-de-exportacion.md)
- [`docs/persistencia.md`](../persistencia.md), sección 8
- [`docs/arquitectura.md`](../arquitectura.md), sección 2.17
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), sección
  3.20
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-052
- [`docs/continuidad.md`](../continuidad.md), sección 3.4
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), sección 4.15
- `yauzl` 3.4.0 y `yazl` 3.3.1, MIT; consultados en el registro npm el
  2026-11-25.
