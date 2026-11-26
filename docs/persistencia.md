# Persistencia local de World Craft

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio); actualizado el
> 26/11/2026 con la descripción enriquecida del mundo (#114). La base local, las migraciones, el modo
> seguro, el servicio de assets con `wc-asset://`, las copias automáticas, la
> rotación, la restauración desde el diálogo de modo seguro, el instalador por
> usuario y la actualización manual están implementados en M0-04 (#64), M0-06
> (#66), M0-07 (#67) y M0-08 (#68). Los mundos y su actividad, en M1-01 (#72);
> los tipos de entidad con sus plantillas, en M1-02 (#73); las fichas con
> imágenes, etiquetas y galería, en M1-03 (#74); las relaciones tipadas con
> backlinks, en M1-04 (#75); la búsqueda global con FTS5 y la paleta de
> comandos, en M1-05 (#76); la papelera, el historial de versiones y la copia
> `pre-purge`, en M1-06 (#77); la exportación e importación de un mundo
> completo, en M1-07 (#78); la pantalla de Ajustes y la gestión de datos, en
> M1-08 (#79); y la descripción enriquecida del mundo, con la migración `0008`,
> en #114. La release pública con actualización real llega en M5. Las secciones
> distinguen lo implementado de lo previsto.
> **Ámbito:** ubicación de datos, SQLite, assets, migraciones, copias,
> exportación/importación y recuperación.
> **Decisiones:** ADR 0002 (SQLite), ADR 0005 y ADR 0017 (assets locales),
> ADR 0012 (copias y recuperación), ADR 0016 (migraciones y modo seguro),
> ADR 0019 (mundos del MVP), ADR 0020 (tipos de entidad y campos
> personalizados), ADR 0023 (búsqueda global FTS5), ADR 0028 (papelera,
> versiones y copia previa a la purga) y ADR 0029 (exportación e importación de
> mundos).

## 1. Principio

World Craft guarda todos los datos en el equipo del usuario. No hay base de
datos remota, cuentas, telemetría ni subida de contenido. Actualizar,
reinstalar o desinstalar la aplicación **no puede borrar** la base de datos,
los assets ni las copias.

El proceso principal ejecuta `app.setName(APP_NAME)` **antes** de llamar a
`app.getPath('userData')`, de modo que la carpeta de datos es la del nombre de
producto y no la del identificador de Electron. En Windows, con el nombre
`World Craft`, la ruta habitual es:

```text
%APPDATA%\World Craft\
```

La carpeta de instalación (`%LOCALAPPDATA%\Programs\World Craft`) contiene solo
binarios y recursos. El instalador y el desinstalador no tocan `userData`.

## 2. Estructura en disco

```text
%APPDATA%\World Craft\
  ├─ data\
  │   ├─ world-craft.sqlite
  │   ├─ world-craft.sqlite-wal
  │   ├─ world-craft.sqlite-shm
  │   ├─ .restore.lock              (durante una restauración; obsoleto tras un cierre)
  │   └─ .restore.pending           (marcador durable de restauración)
  ├─ assets\
  │   ├─ worlds\
  │   │   └─ <worldId>\
  │   │       ├─ <assetId>.webp
  │   │       └─ <assetId>.thumb.webp
  │   └─ .tmp\               (assets de importación en curso; se limpian)
  │       └─ <operationId>\
  │           └─ <worldId>\
  ├─ backups\
  │   ├─ daily\                 (implementado, M0-07)
  │   │   └─ <timestamp>\
  │   │       ├─ world-craft.sqlite
  │   │       └─ manifest.json
  │   ├─ weekly\                (implementado, M0-07)
  │   ├─ monthly\               (implementado, M0-07)
  │   ├─ orphans\
  │   │   └─ <timestamp>\
  │   │       ├─ assets\        (huérfanos purgados, con su ruta relativa)
  │   │       └─ manifest.json
  │   ├─ pre-delete\            (implementado, M1-08; recuperación manual)
  │   │   └─ <timestamp>\
  │   │       ├─ world-craft.sqlite
  │   │       ├─ manifest.json
  │   │       ├─ assets\        (copia verificada del árbol de imágenes)
  │   │       ├─ assets-manifest.json
  │   │       └─ recovery.json
  │   ├─ pre-migration\
  │   │   └─ <timestamp>\
  │   │       ├─ world-craft.sqlite
  │   │       └─ manifest.json
  │   ├─ pre-purge\              (implementado, M1-06; copia previa a purgar)
  │   │   └─ <timestamp>\
  │   │       ├─ world-craft.sqlite
  │   │       └─ manifest.json
  │   └─ pre-restore\           (implementado, M0-07; recuperación manual)
  │       └─ <timestamp>[-rollback|-restore-tmp]\
  │           ├─ world-craft.sqlite
  │           ├─ world-craft.sqlite-wal      (si existía)
  │           ├─ world-craft.sqlite-shm      (si existía)
  │           ├─ world-craft.sqlite-journal  (si existía)
  │           └─ manifest.json
  ├─ imports\
  │   └─ .tmp\                  (staging de importación; se limpia al arrancar)
  │       └─ <operationId>\
  │           ├─ assets\        (assets extraídos y procesados)
  │           └─ plan.json      (plan con IDs nuevos y remapeo)
  ├─ exports\
  │   └─ .tmp\                  (staging de exportación de mundo y biblioteca; se limpia)
  ├─ logs\
  │   ├─ startup.log
  │   ├─ startup.log.1
  │   ├─ assets.log
  │   ├─ assets.log.1
  │   ├─ updates.log
  │   ├─ updates.log.1
  │   ├─ transfer.log
  │   └─ transfer.log.1
  └─ .updaterId                 (opcional; electron-updater, sin datos del usuario)
```

Mientras hay una restauración en curso —o si el proceso anterior murió a mitad—
pueden existir en `data/` un `world-craft.sqlite.rollback*` con la base anterior,
un `world-craft.sqlite.restore.tmp*` con la copia en preparación, o ambos. El
arranque los detecta y **no crea una base vacía** (sección 7).

| Ruta | Contenido | Se puede borrar a mano |
|---|---|---|
| `data/world-craft.sqlite` | Base de datos principal | No sin copia y con la app cerrada |
| `data/*-wal`, `data/*-shm` | Ficheros auxiliares de SQLite | Se consolidan al cerrar; no borrar sueltos |
| `data/.restore.lock`, `data/.restore.pending` | Restauración en curso o interrumpida | Solo si la app está cerrada y no hay restauración activa (sección 7.4) |
| `data/*.rollback*`, `data/*.restore.tmp*` | Restos de una restauración interrumpida | No: se preservan y la app entra en modo seguro |
| `assets/worlds/<worldId>/` | WebP de cada mundo y su miniatura `.thumb.webp` (implementado) | Solo desde la app o con exportación previa |
| `assets/.tmp/` | Assets procesados de una importación en curso, en `<operationId>/<worldId>/`; se limpian al arrancar | Sí, con la app cerrada; nunca contiene assets publicados |
| `backups/orphans/<timestamp>/` | Copia verificable de huérfanos purgados | Solo tras comprobar que no hace falta recuperar |
| `backups/pre-migration/` | Copia y manifiesto previos a una migración; se conservan 5 (implementado) | Solo si no hay una actualización pendiente |
| `backups/pre-purge/` | Copia y manifiesto previos a una purga definitiva; se conservan 10 válidas (implementado, M1-06) | Solo tras comprobar que no hace falta recuperar lo purgado |
| `backups/pre-delete/` | Copia previa al borrado total: base v2, `assets/`, `assets-manifest.json` y `recovery.json` (implementado, M1-08). No se poda y no se ofrece en la restauración guiada | Solo tras comprobar que no hace falta recuperar el contenido borrado |
| `backups/daily`, `weekly`, `monthly` | Copias automáticas con manifiesto (implementado, M0-07) | Las antiguas, desde la app; no borrar las recientes |
| `backups/pre-restore/` | Base anterior y sus auxiliares antes de restaurar (implementado, M0-07) | Solo tras comprobar que la restauración fue correcta; no se poda sola |
| `imports/.tmp/<operationId>/` | Staging de una importación: `assets/` y `plan.json`; se limpia al arrancar y al terminar o cancelar (implementado, M1-07) | Solo con la app cerrada; no contiene el mundo publicado |
| `exports/.tmp/` | Staging de la exportación de un mundo y de la biblioteca total; se limpia al arrancar y al terminar o cancelar (implementado, M1-07 y M1-08). La exportación se publica en el destino que elige el usuario, no aquí | Sí, con la app cerrada; no guarda exportaciones del usuario |
| `logs/startup.log` | Arranque y copias en JSONL, rotado a 256 KiB | Sí; no contiene contenido del usuario |
| `logs/assets.log` | Eventos de assets en JSONL, rotado a 256 KiB | Sí; sin rutas, IDs ni contenido |
| `logs/updates.log` | Eventos del actualizador en JSONL, rotado a 256 KiB (M0-08) | Sí; sin URLs, rutas, versiones ni contenido |
| `logs/transfer.log` | Eventos de exportación e importación en JSONL, rotado a 256 KiB (M1-07) | Sí; sin rutas, IDs, nombres ni contenido |
| `.updaterId` | Identificador opcional de electron-updater para staging; no se usa con GitHub | Sí, con la app cerrada; no contiene datos del usuario |

La app ofrece desde Ajustes → Datos «Abrir datos», «Abrir imágenes», «Abrir
copias», «Abrir registros» y, en el grupo de temporales, «Abrir importaciones» y
«Abrir exportaciones». Esas acciones abren el explorador de Windows sin exponer
rutas al renderer. El diálogo de modo seguro ya permite abrir la carpeta de
copias (o `userData` si aún no existe) y el log de arranque se escribe sin
interfaz. Las preferencias de ventana, tema, densidad, tamaño e idioma se guardan
en la tabla `app_settings`; no se crea `config.json`.

## 3. SQLite

### 3.1 Motor y configuración

- **better-sqlite3 13.2.0** en el proceso principal; ninguna consulta desde el
  renderer. Usa Node-API 10 y un prebuild que carga en Node y Electron, por lo
  que no necesita `electron-rebuild`; `pnpm verify:native` lo comprueba en ambos
  runtimes. El SQLite incluido es 3.54.1 con FTS5.
- Base en `userData/data/world-craft.sqlite`.
- **WAL** (`PRAGMA journal_mode = WAL`) para lecturas concurrentes y menos
  bloqueos.
- `PRAGMA synchronous = NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000`.
- `PRAGMA integrity_check` al arrancar, antes de activar WAL y después de
  migrar; si falla, modo seguro sin escritura.
- `PRAGMA user_version` es el **número de migraciones aplicadas** (con
  `0000_init`, `0001_assets`, `0002_worlds`, `0003_entity_types`,
  `0004_entities`, `0005_relations`, `0006_search`, `0007_trash_versions` y
  `0008_world_description`, vale 9), no el prefijo de la etiqueta. La tabla
  `schema_migrations` conserva el detalle y se contrasta con él.
- Timestamps en milisegundos UTC; la interfaz muestra la zona local.
- IDs UUIDv7 generados en el proceso principal (`src/main/db/ids.ts`) con
  contador para mantener el orden dentro del mismo milisegundo. Tras M1-06
  existen las tablas del sistema, `assets`, `worlds`, `activity_log`,
  `entity_types`, `entities`, `tags`, `entity_tags`, `entity_gallery`,
  `relation_types`, `relations`, `search_documents` y `entity_versions`; el resto
  de tablas de contenido llega en M2, M3 y M4 con sus issues.

### 3.2 Acceso

El proceso principal abre una única conexión de escritura y la comparte entre
los casos de uso a través de `src/main/persistence.ts`; el renderer no tiene
acceso a SQLite ni a los archivos. El arranque se ejecuta antes de crear la
ventana: detectar restos de restauración, abrir sin WAL, comprobar integridad,
leer el estado, copiar si hay migraciones pendientes, activar WAL, migrar en una
transacción y volver a comprobar. Si el resultado es `ready`, el programador crea
las copias automáticas que falten antes de crear la ventana. El cierre es
idempotente en `before-quit`.

Las operaciones largas de **exportación e importación** se ejecutan en un
**utility process** (`out/main/transfer-worker.cjs`) para no bloquear la
interfaz: allí viven el ZIP, la validación de JSON, los checksums y el procesado
de imágenes. La **transacción SQLite de importación** y el renombrado del
directorio de assets siguen en el proceso principal, que es el único que
escribe. Las copias automáticas, la copia pre-migración y la restauración se
ejecutan en el proceso principal durante el arranque o en el diálogo de modo
seguro, antes de que exista una ventana con la que competir. En M0 no se copia
al cerrar.

### 3.3 Búsqueda

**Implementado en M1-05 (#76).** FTS5 está disponible en el binario de
better-sqlite3 y `pnpm verify:native` lo comprueba en Node y Electron. La
migración `0006_search` crea `search_documents`, la tabla virtual
`search_fts(title, body, keywords)` con tokenizador `unicode61`, sin diacríticos
y prefijos 2/3/4, el vocabulario `search_vocabulary` (`fts5vocab`) y las vistas y
triggers que mantienen el índice al crear, editar, borrar o restaurar mundos,
fichas, relaciones, etiquetas y tipos de relación. La consulta usa `MATCH` con
prefijos, `bm25`, `highlight` y `snippet`; si no hay coincidencia exacta, prueba
términos parecidos del propio vocabulario con una distancia de edición acotada.
La reconstrucción sanea FTS5, elimina documentos obsoletos y vuelve a poblar el
índice desde las vistas, sin tocar el contenido del usuario. FTS5 es una
dependencia del binario, no un servicio externo; si un binario futuro no lo
incluyera, la aplicación lo detectaría en las pruebas nativas y no se publicaría
esa versión. El detalle está en el [ADR 0023](adr/0023-global-search-fts5-command-palette.md).

### 3.4 Preferencias de interfaz (implementado, #132 y #79)

Las preferencias de interfaz viven en `app_settings`, la tabla creada en
`0000_init`, con **una fila por clave** y el prefijo reservado `ui.`. **No hay
migración nueva** ni se toca ninguna tabla de dominio. El detalle de la decisión
está en el [ADR 0027](adr/0027-ui-preferences-persistence.md); Ajustes (#79) las
consume y añade densidad y tamaño de texto sin almacenamiento paralelo
([ADR 0030](adr/0030-settings-data-and-full-deletion.md)).

| Clave | Valor JSON | Defecto |
|---|---|---|
| `ui.theme` | `"light"` o `"dark"` | `"light"` |
| `ui.density` | `"comfortable"` o `"compact"` | `"comfortable"` |
| `ui.font-scale` | `"small"`, `"normal"` o `"large"` | `"normal"` |
| `ui.rail-collapsed` | `true` o `false` | `false` (expandido) |
| `ui.entity-view` | `{ propertiesOpen, propertiesWidth, sections: { description, attributes, relations, resources } }`; ancho entero de 280 a 360 | `propertiesOpen: true`, ancho `320`, solo `description` abierta |
| `ui.last-view` | `"home"`, `"worlds"`, `"search"`, `"world"`, `"entities"`, `"entity"` o `"settings"` | `"home"` |
| `ui.recent-location` | `{ kind: "world", worldId }` o `{ kind: "entity", worldId, entityId, entityName }` con UUIDv7 y nombre de 1 a 120 caracteres o `null` | Ausente |

- **Lectura tolerante.** Se leen las filas `ui.*` y cada clave se parsea por
  separado; un JSON roto o un valor fuera de rango cae a su defecto sin contagiar
  al resto. Leer **no crea filas, no repara y no reescribe**. Las claves `ui.*`
  desconocidas se ignoran para permitir evolución futura.
- **Escritura transaccional.** El servicio fusiona el parche, compara con lo
  almacenado y escribe solo las claves cuyo JSON cambia, actualizando
  `updated_at`; todas las escrituras y borrados se agrupan en una transacción de
  better-sqlite3. La primera escritura de una clave crea su fila.
- **Borrado explícito.** `recentLocation: null` **borra la fila**
  `ui.recent-location`; nunca se guarda el literal `null`.
- **Reset por prefijo.** `reset` ejecuta un `DELETE` con `GLOB 'ui.*'`, sensible a
  mayúsculas, y devuelve los valores por defecto. Solo afecta al espacio `ui.*`:
  no borra claves no-UI de `app_settings`, mundos, fichas, imágenes, relaciones,
  copias ni `schema_migrations`. Ajustes lo ofrece en **Restablecer
  preferencias**, con confirmación; **Restablecer apariencia** usa `update` con
  los tres valores de apariencia y no `reset`.
- **Modo seguro.** Sin base, la lectura devuelve los defectos, la escritura falla
  de forma estable y el tema validado se sigue aplicando al cromo de la ventana
  durante la sesión.
- **Copias y exportación.** Al vivir en la misma base, las copias automáticas
  incluyen las preferencias y una restauración las recupera. La exportación de un
  mundo **no** las incluye: son preferencias de aplicación, no del mundo.

## 4. Assets

**Implementado en M0-06 (#66).** El servicio es puro en `src/main/assets/`; la
composición con Electron está en `composition.ts` y el protocolo en
`protocol.ts`. Desde M1-03 (#74) hay IPC (`assets:list` y `assets:import`) y la
galería de fichas importa con el diálogo nativo y muestra miniaturas; la purga
de huérfanos sigue sin canal ni interfaz.

### 4.1 Archivos y metadatos

- Los archivos viven en `assets/worlds/<worldId>/<assetId>.webp` y su miniatura
  en `assets/worlds/<worldId>/<assetId>.thumb.webp`.
- La base guarda solo la **ruta relativa** del archivo principal, el MIME real,
  el tamaño, las dimensiones, el `alt` y el SHA-256. La miniatura se deriva de la
  ruta y no tiene fila propia.
- Tabla `assets` (migración `0001_assets`): `id`, `world_id`, `kind`,
  `relative_path`, `mime`, `size`, `width`, `height`, `alt`, `hash` y
  `created_at`, con `CHECK` de `kind` (`image`, `map`, `document`, `other`),
  `size >= 0` y `hash` hexadecimal de 64 caracteres, e índices
  `assets_world_idx` y `assets_hash_idx`. En M0 solo se importa `kind = 'image'`.
- `world_id` **no tiene clave foránea todavía**: `worlds` ya existe desde
  `0002_worlds`, pero la reconstrucción de `assets` con `worlds(id) ON DELETE
  RESTRICT` y la cuarentena de filas sin mundo se abordan en la issue M1-11
  (#116). Mientras tanto, la integridad se comprueba en el servicio.

### 4.2 Importación

1. Se comprueba el tamaño del origen (25 MB) antes de leerlo.
2. El formato se decide por **magic bytes**: PNG, JPEG, WebP, GIF y AVIF. SVG,
   BMP, TIFF y cualquier contenido no admitido se rechazan.
3. Se limitan 8192 px por lado y 24 Mpx totales, ya con la orientación EXIF
   aplicada.
4. Se convierte a sRGB y se re-codifica a WebP calidad 90, sin metadatos; la
   miniatura se genera a 320 px de lado máximo y calidad 80.
5. El SHA-256 se calcula sobre el WebP publicado.
6. Los dos archivos se escriben en `assets/.tmp/<assetId>/` y se publican con
   `rename`; nunca se sobrescribe un archivo existente. Después se inserta la
   fila; si el `INSERT` falla, se borran los archivos y la carpeta temporal.
7. No hay deduplicación en M0: el mismo contenido importado dos veces produce
   dos filas y dos pares de archivos.

### 4.3 Protocolo `wc-asset://`

- El renderer usa `wc-asset://asset/<uuidv7>` o `wc-asset://thumb/<uuidv7>`.
  La gramática es cerrada y no admite query, hash, puerto, userinfo, segmentos
  extra, mayúsculas ni UUID que no sean v7.
- El ID es la única entrada: la ruta relativa sale de SQLite y debe coincidir
  con el ID y el mundo de la fila. Se admite solo
  `worlds/<uuid>/<uuid>.webp` y `…/<uuid>.thumb.webp`; se rechazan `..`, rutas
  absolutas, UNC, NUL, barra invertida y enlaces.
- La contención se comprueba con `lstat` sin seguir enlaces y `realpath` para
  detectar junctions de Windows.
- Solo se sirve `image/webp`, con `X-Content-Type-Options: nosniff`,
  `Content-Length`, `Cache-Control: private, max-age=31536000, immutable` y
  `Content-Security-Policy: default-src 'none'`.
- Códigos: 400 (URL inválida), 403 (ruta fuera de `assets/`, enlace o mundo que
  no coincide), 404 (fila o archivo ausente), 413 (demasiado grande), 415 (MIME
  no admitido) y 500 (fallo interno).
- El esquema se registra como `standard`, `secure` y `stream`, con
  `bypassCSP:false`, antes de `app.whenReady`. El handler se instala solo si el
  arranque de la base termina en `ready`; en modo seguro no se registra y no hay
  vía de lectura.
- Los logs de assets (`logs/assets.log`, JSONL rotado a 256 KiB) registran
  códigos, estados y contadores, sin rutas, IDs de asset ni de mundo.

### 4.4 Huérfanos y purga

- `planOrphanCleanup` es de **solo lectura** y clasifica `unreferencedFiles`,
  `orphanThumbnails`, `missingFiles`, `temporaryFiles`, `unexpectedEntries` y
  `suspiciousLinks`. No sigue enlaces ni recorre anclas enlazadas.
- `purgeOrphans` exige el token exacto `purge-orphans`, se serializa con la
  importación en un mutex y recalcula el plan dentro del turno. Revalida cada
  directorio padre y cada archivo antes de copiar y antes de borrar.
- Antes del primer borrado copia a `backups/orphans/<timestamp>/assets/`,
  verifica tamaño y SHA-256 y escribe `manifest.json` con
  `recovery: "restore-files-from-this-backup"`. Si la copia o su verificación
  fallan, aborta sin tocar los originales.
- Nunca borra archivos referenciados, entradas inesperadas ni enlaces. Un fallo
  de borrado se normaliza a `ASSET_STORAGE_FAILED` y queda registrado; lo ya
  copiado se restaura desde la carpeta de la copia.
- **La purga de la papelera no borra assets (M1-06, #77).** Al purgar una ficha o
  un mundo, las filas de `assets` y sus archivos permanecen: los assets son del
  mundo y pueden estar compartidos por contenido vivo. Las filas de un mundo
  purgado quedan **huérfanas a propósito** hasta que #116 añada
  `assets.world_id → worlds(id) ON DELETE RESTRICT` y la cuarentena de huérfanos.
  Hasta entonces no hay limpieza guiada de esos archivos y no se deben borrar a
  mano sin una copia. La purga sí deja una copia de la base en
  `backups/pre-purge/`.

### 4.5 Dependencia de imagen y residuales

- `sharp@^0.35.5` (Apache-2.0; `@img/sharp-*` Apache-2.0 AND LGPL-3.0-or-later;
  libvips LGPL-3.0-or-later) está externalizado en `electron.vite.config.ts`
  junto a `better-sqlite3` y verificado en Node y Electron con
  `pnpm verify:native`. `THIRD-PARTY-NOTICES.md` recoge las licencias; #68
  desempaquetó sharp del asar e incluyó los textos completos en `licenses/`
  (seis desde #74, con Tiptap/ProseMirror).
- Residuales aceptados y documentados en el
  [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md): ventanas TOCTOU de
  escritura temporal y de lectura, raíces creadas antes de validar su
  contención, `backups/orphans` sin validar como directorio real, ausencia de
  symlinks de archivo en las pruebas de Windows sin modo desarrollador. Los
  avisos de terceros y el desempaquetado quedaron completados en #68.
- La **exportación e importación** de assets usa rutas relativas y SHA-256; el
  detalle está en la sección 8 y en el
  [formato de exportación](formato-de-exportacion.md).

> El diseño original está en el [ADR 0005](adr/0005-local-assets-custom-protocol.md)
> y el detalle de implementación en el
> [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md).

### 4.6 Exportación e importación de assets (#78)

- **Exportación:** cada asset referenciado por la portada, la imagen principal o
  la galería viaja como `assets/<uuidv7>.webp` dentro del ZIP. Antes de
  escribirlo se comprueba que la fila es `kind = 'image'`, que el MIME es
  `image/webp` y que el tamaño y el SHA-256 del archivo coinciden con la base.
  Si un asset falta o no verifica, la exportación falla con
  `TRANSFER_ASSET_INVALID` y no publica el ZIP. **No se exportan miniaturas**:
  se regeneran al importar.
- **Importación:** el asset se extrae al staging, se comprueba su tamaño y
  SHA-256 contra el manifiesto y se detecta el formato por **magic bytes**. Solo
  se acepta WebP; después se re-codifica con los límites del servicio
  (25 MiB, 8192 px y 24 Mpx), se calcula el SHA-256 del WebP canónico y se
  genera la miniatura de 320 px. El par de archivos se publica en
  `assets/.tmp/<operationId>/<worldId>/` y, dentro de la transacción, se renombra
  a `assets/worlds/<worldId>/` antes del commit. La fila de `assets` se inserta
  con el nuevo `worldId`, el nuevo `assetId`, la ruta relativa canónica y
  `kind = 'image'`.
- El nombre dentro del ZIP es el UUIDv7 del asset de origen; la importación
  genera IDs nuevos y reconstruye `relative_path`, por lo que un paquete no
  puede imponer una ruta en disco.

## 5. Migraciones

- Versionadas y revisadas; nunca se edita una migración ya aplicada.
- Se generan con `pnpm db:generate` y se validan con `pnpm db:check`. La
  aplicación **no** usa `drizzle-kit migrate` ni `drizzle-kit push`: un runner
  propio lee el journal de Drizzle validado con Zod y aplica el lote pendiente
  dentro de una única transacción.
- Antes de migrar una base existente se crea una copia online verificable en
  `backups/pre-migration/<timestamp>/`, con manifiesto v2, SHA-256 e
  `integrity_check` en solo lectura. Si la copia falla, no se migra. Una base
  nueva no crea copia porque no hay datos que preservar. Se conservan las **5
  copias pre-migración válidas más recientes**; la poda llegó con M0-07 y cierra
  la deuda del [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md).
- La versión del esquema se guarda en `PRAGMA user_version` como **número de
  migraciones aplicadas** y en la tabla `schema_migrations`, con checksum
  SHA-256 del SQL normalizado. Con `0000_init`, `0001_assets`, `0002_worlds`,
  `0003_entity_types`, `0004_entities`, `0005_relations`, `0006_search`,
  `0007_trash_versions` y `0008_world_description`, vale 9.
- `0001_assets` es aditiva: crea la tabla `assets` con sus `CHECK` e índices y no
  toca `app_settings` ni las tablas del sistema. Su rollback de referencia está
  en `drizzle/rollback/0001_assets.down.sql`; las pruebas cubren la actualización
  desde `0000` y el rollback de ambas migraciones.
- `0002_worlds` también es aditiva: crea `worlds` y `activity_log`, conserva
  `assets` y `app_settings` y deja `user_version` 3. Su rollback está en
  `drizzle/rollback/0002_worlds.down.sql` y debe ejecutarse antes del de
  `0001_assets` porque `worlds.cover_asset_id` referencia `assets`.
- `0003_entity_types` es aditiva: crea `entity_types`, siembra los 18 tipos del
  sistema con IDs estables y deja `user_version` 4. Su rollback está en
  `drizzle/rollback/0003_entity_types.down.sql` y debe ejecutarse antes del de
  `0002_worlds` porque `entity_types.world_id` referencia `worlds`. Conserva
  mundos y actividad; la prueba de preservación migra una base en `0002` con
  datos.
- `0004_entities` es aditiva: crea `entities`, `tags`, `entity_tags` y
  `entity_gallery`, conserva mundos, actividad, tipos y assets y deja
  `user_version` 5. Su rollback está en
  `drizzle/rollback/0004_entities.down.sql` y debe ejecutarse antes del de
  `0003_entity_types` porque las fichas referencian los tipos. La prueba de
  preservación migra una base en `0003` con un mundo y un tipo personalizado.
- `0005_relations` es aditiva: crea `relation_types` y `relations`, siembra los
  18 tipos de relación del sistema, conserva mundos, actividad, tipos, fichas y
  assets y deja `user_version` 6. Su rollback está en
  `drizzle/rollback/0005_relations.down.sql` y debe ejecutarse antes de los de
  `0004` y `0003` porque las aristas referencian fichas y tipos. La prueba de
  preservación migra una base en `0004` con un mundo, un tipo y una ficha.
- `0006_search` es aditiva: crea `search_documents`, `search_fts`,
  `search_vocabulary`, las vistas por tipo y los triggers de sincronización,
  repuebla el índice desde los datos existentes y deja `user_version` 7. Su
  rollback está en `drizzle/rollback/0006_search.down.sql` y debe ejecutarse antes
  de los de `0005`, `0004` y `0003`. El índice es reconstruible y no se exporta:
  la prueba de preservación migra una base en `0005` con mundos, fichas,
  etiquetas y relaciones y comprueba que el contenido sigue intacto y buscable.
- `0007_trash_versions` es aditiva: crea `entity_versions` con FK en cascada a
  `entities(id)`, añade los índices `entity_versions_entity_created_idx`,
  `entities_deleted_idx` y `entity_types_deleted_idx`, conserva todos los datos y
  los assets, y deja `user_version` 8. Su rollback está en
  `drizzle/rollback/0007_trash_versions.down.sql` y solo elimina la tabla, los
  dos índices de papelera y la fila de `schema_migrations`; el historial de
  versiones se pierde y la copia previa lo conserva. La prueba de preservación
  migra una base en `0006` con mundo, tipo personalizado, fichas, etiquetas,
  galería, relaciones y búsqueda.
- `0008_world_description` cambia la forma de un campo con datos y deja
  `user_version` 9. Añade `worlds.description_text`, convierte la descripción
  plana de cada mundo en un documento de ProseMirror párrafo a párrafo
  (normalizando `CRLF`/`CR`, tabuladores y espacios, y descartando líneas vacías o
  de solo espacios), rellena el texto plano, recrea `search_world_documents`
  sobre `description_text`, repuebla `search_documents` y reconstruye FTS5. No
  añade `CHECK` JSON a `worlds` para no reconstruir la tabla raíz; la forma se
  valida con Zod, la validación de dominio y el esquema cerrado del editor. Su
  rollback está en `drizzle/rollback/0008_world_description.down.sql`: degrada el
  documento a texto plano, retira la columna, restaura la vista y los triggers de
  `0006` y deja `user_version` 8; se pierden formato y enlaces, no el texto. La
  prueba de preservación migra una base en `0007` con textos planos variados
  (`CRLF`, `CR`, líneas vacías, solo espacios, orden no alfabético y más de 2.000
  líneas).
- Si una migración falla, se revierte el lote, se conserva la copia y la app
  arranca en **modo seguro** sin conexión de escritura. El aviso permite
  **restaurar una copia**, abrir la carpeta de copias, continuar en modo seguro o
  salir. Una restauración desde modo seguro reaplica las migraciones pendientes
  al relanzar, con una copia pre-migración nueva si la copia restaurada está
  desactualizada.
- Si el arranque encuentra `.rollback*`, `.restore.tmp*` o `.restore.pending`,
  sospecha una restauración interrumpida y entra en modo seguro con
  `DB_RESTORE_INTERRUPTED`; no abre ni crea la base (sección 7).
- Una base con tablas propias y sin `schema_migrations` se rechaza: no se adopta
  como propia.
- Cada migración incluye una prueba sobre una base temporal y una prueba de
  preservación de datos.
- El detalle está en [`docs/base-de-datos/migraciones.md`](base-de-datos/migraciones.md).

## 6. Copias de seguridad

**Implementado en M0-07 (#67)** para las copias automáticas, pre-migración y
pre-restauración, ampliado en M1-06 (#77) con la copia previa a la purga y en
M1-08 (#79) con la copia previa al borrado total. Las copias automáticas
**contienen solo la base SQLite y su manifiesto**: los assets no se incluyen ni
se sustituyen al restaurar. La copia `pre-delete` es la excepción deliberada:
incluye una copia verificada de los assets porque el borrado total también los
elimina.

| Tipo | Cuándo se crea | Retención | Contenido | Estado |
|---|---|---|---|---|
| Diaria | Primer arranque del día local | 7 | SQLite + manifiesto | Implementada (M0-07) |
| Semanal | Primera copia de la semana ISO local | 4 | SQLite + manifiesto | Implementada (M0-07) |
| Mensual | Primera copia del mes local | 12 | SQLite + manifiesto | Implementada (M0-07) |
| Pre-migración | Antes de migrar una base existente | 5 | SQLite + manifiesto | Implementada (M0-04; poda M0-07) |
| Pre-purga | Antes de cada purga individual o vaciado confirmado | 10 | SQLite + manifiesto | Implementada (M1-06) |
| Pre-borrado total | Antes de eliminar todos los datos desde Ajustes | Sin poda | SQLite + manifiesto + assets verificados + `recovery.json` | Implementada (M1-08); recuperación manual |
| Pre-restauración | Antes de reemplazar la base | Sin poda | SQLite + WAL/SHM/journal + manifiesto | Implementada (M0-07); recuperación manual |
| Huérfanos purgados | Antes de cada purga confirmada de assets | La decide el usuario | Archivos + manifiesto con SHA-256 | Implementada (M0-06) |
| Manual | Cuando el usuario lo pide | La decide el usuario | SQLite + assets opcionales | Prevista (M1, Ajustes) |

### 6.1 Programación y buckets

- Las copias automáticas se ejecutan **una vez por arranque**, después de que la
  base quede en `ready` y antes de crear la ventana. **No se copia al cerrar**.
- Cada motivo usa un bucket con la **fecha local** del equipo: día `YYYY-MM-DD`,
  semana ISO `YYYY-Www` (lunes a domingo) y mes `YYYY-MM`.
- Al arrancar se crea el bucket **actual** de cada motivo si le falta una copia
  válida, aunque hayan pasado semanas desde la última. No se generan copias
  retroactivas de cada periodo perdido: se recupera el periodo en curso y se
  conserva lo que ya existiera.
- Un fallo de copia automática se registra y **nunca bloquea el arranque**.
- La rotación solo se ejecuta si se creó alguna copia nueva, o si el arranque
  acaba de crear una copia pre-migración. Si no, se difiere al siguiente arranque
  con copia.
- La copia usa la **API online de SQLite** (`db.backup`) dentro de
  `backups/<motivo>/<timestamp>/`; el archivo se escribe como `.partial`, se
  verifica en solo lectura y se publica con `rename` antes de escribir el
  manifiesto.

### 6.2 Contenido y manifiesto

Cada carpeta de copia contiene `world-craft.sqlite` y `manifest.json`; las de
`pre-restore` pueden incluir además `-wal`, `-shm` y `-journal`, y las de
`pre-delete` añaden `assets/`, `assets-manifest.json` y `recovery.json`. El
manifiesto actual es la **versión 2** y se valida con Zod en modo estricto:

```json
{
  "formatVersion": 2,
  "reason": "daily",
  "createdAt": "2026-11-19T10:00:00.000Z",
  "databaseFile": "world-craft.sqlite",
  "schemaVersion": 2,
  "sizeBytes": 4096,
  "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "integrity": "ok",
  "assetsIncluded": false
}
```

| Campo | Significado |
|---|---|
| `formatVersion` | `2` en las copias nuevas; el lector acepta también `1`. |
| `reason` | `daily`, `weekly`, `monthly`, `pre-migration`, `pre-restore` o `pre-purge`. |
| `createdAt` | Fecha ISO 8601 en UTC. |
| `databaseFile` | Nombre fijo `world-craft.sqlite`. |
| `schemaVersion` | Valor de `PRAGMA user_version`; `null` solo si la base copiada no se pudo leer. |
| `sizeBytes` | Tamaño exacto del archivo copiado. |
| `sha256` | SHA-256 hexadecimal del archivo copiado. |
| `integrity` | `ok`, `failed` o `unknown`; solo `ok` es restaurable desde la app. |
| `assetsIncluded` | Siempre `false`: los assets no viajan en la copia. |

Las copias creadas en M0-04 con la versión 1 (solo pre-migración) se siguen
leyendo y se normalizan como íntegras y sin assets; no se reescriben. La copia
`pre-purge` de #77 añade un valor al enum de `reason` pero mantiene
`formatVersion: 2`: los manifiestos anteriores no contienen ese valor y el lector
actual sigue aceptándolos sin migración ni reescritura (ADR 0028).

### 6.3 Verificación

Una copia solo se considera utilizable si pasa, en este orden:

1. Manifiesto presente, JSON válido y sin campos desconocidos.
2. Archivo presente, regular y con el tamaño declarado.
3. SHA-256 coincidente.
4. `integrity` declarada como `ok`.
5. `PRAGMA integrity_check` correcto en una conexión de solo lectura.
6. `PRAGMA user_version` igual a la versión del manifiesto y **no superior** a
   la que entiende la versión instalada de la app.

La verificación nunca modifica la copia. Una copia **corrupta o inválida no se
ofrece para restaurar, no cuenta para la retención y no se borra
automáticamente**: queda en su carpeta para diagnóstico o recuperación manual.
Un fallo `version-ahead` rechaza una copia creada por una versión más reciente
antes de abrir su contenido.

### 6.4 Rotación

| Motivo | Copias válidas que se conservan |
|---|---|
| Diaria | 7 |
| Semanal | 4 |
| Mensual | 12 |
| Pre-migración | 5 |
| Pre-purga | 10 |
| Pre-restauración | No se poda |

- Las copias corruptas no cuentan y no se borran.
- Nunca se borra la copia válida más reciente global ni la última copia válida
  de un motivo, aunque la retención sea 0.
- Cada candidata se **vuelve a verificar** justo antes de borrarla; si dejó de
  verificar, se conserva y se cuenta como omitida.
- Un fallo de borrado se contabiliza y no interrumpe la rotación.
- Si una carpeta de motivo no se puede listar, ese motivo no se poda en esa
  pasada.
- Las copias `pre-purge` creadas durante una sesión se podan en la **siguiente
  rotación de arranque**, no en el momento de la purga: la más reciente siempre
  se conserva.

### 6.5 Ubicación y copias manuales

- Ubicación por defecto: `backups/`. Las copias son locales y **no se suben a
  ningún servicio**.
- La copia manual (base + assets opcionales) y la elección de una carpeta
  externa desde Ajustes → Datos siguen **previstas**. Ajustes ya permite
  **Exportar todos los datos** (biblioteca abierta), que no es una copia
  restaurable desde la app.
- Las copias **pre-restauración** no se ofrecen para restaurar desde la app y no
  se podan. Se conservan para recuperación manual (sección 7.4).
- La copia **`pre-delete`** se crea antes del borrado total, incluye la base y
  una copia verificada de los assets, **no se poda** y **no se ofrece** en la
  restauración guiada. Su recuperación es manual (sección 8.4).
- Las copias **`pre-purge`** se crean antes de eliminar contenido de la papelera,
  se verifican con el mismo criterio que el resto y se conservan las 10 válidas
  más recientes. Son la red de recuperación de una purga: no hay un botón
  «deshacer», pero la copia se puede elegir en el diálogo de modo seguro o
  copiar a mano con la app cerrada (sección 7.4).
- La copia de huérfanos de una purga vive en `backups/orphans/<timestamp>/` y
  tampoco se poda automáticamente: contiene los archivos y un `manifest.json`
  con `formatVersion`, `reason`, `createdAt`, `recovery` y la lista de archivos
  con tamaño y SHA-256.

## 7. Restauración

**Implementado en M0-07 (#67).** Ajustes → Datos ya existe desde M1-08 (#79),
pero **no restaura copias**: la restauración se ofrece desde el **diálogo nativo
de modo seguro**, que aparece cuando el arranque falla o cuando detecta una
restauración interrumpida. El flujo no abre ninguna conexión de escritura:
verifica en solo lectura y reemplaza archivos. Nunca se ejecuta en segundo plano
ni sin confirmación.

### 7.1 Entrada y elección

1. El arranque entra en modo seguro por integridad, migración, copia previa
   fallida o restos de restauración.
2. El aviso ofrece «Restaurar copia.» además de abrir la carpeta de copias,
   continuar en modo seguro o salir.
3. El usuario elige **la copia válida más reciente** o **una carpeta dentro de
   `backups/`** con el diálogo nativo. La carpeta se resuelve con `realpath` y
   `relative`: se rechazan la raíz de copias, rutas relativas, `..`, NUL,
   archivos, junctions que escapan de `backups/` y cualquier ruta fuera de la
   carpeta de copias.
4. Antes de ofrecer la confirmación se verifica la copia completa (sección 6.3).
   Una copia corrupta, con manifiesto inválido, versión futura o motivo
   `pre-restore` se rechaza con `DB_RESTORE_INVALID` y no se ofrece. Las copias
   `pre-delete` tampoco se ofrecen: solo sustituyen la base y dejarían los
   assets desalineados; su recuperación es manual (sección 8.4).

### 7.2 Confirmación y copia previa

- La confirmación muestra la **fecha de la copia** y la **versión de esquema**,
  avisa de que se guardará una copia recuperable de los datos actuales y de que
  los assets no se sustituyen, y deja «Cancelar» como opción predeterminada.
- Antes de reemplazar nada se crea `backups/pre-restore/<timestamp>/` con una
  **copia en bruto** de la base actual y sus `-wal`, `-shm` y `-journal`, sin
  abrir SQLite (la base puede estar corrupta). El manifiesto admite
  `schemaVersion: null` e `integrity` `failed` o `unknown`.
- Si no existe base actual, no se crea copia de preservación.

### 7.3 Reemplazo, rollback y relanzamiento

1. Se adquiere `data/.restore.lock` con `wx` y el PID; un lock de un proceso
   muerto es obsoleto. Se escribe `data/.restore.pending` antes de tocar la base,
   los restos o la copia pre-restauración.
2. La copia elegida se copia a `world-craft.sqlite.restore.tmp` y se **vuelve a
   verificar** (tamaño, SHA-256, integridad y versión) para evitar que cambie
   entre la selección y el reemplazo.
3. La base viva y sus `-wal`, `-shm` y `-journal` se renombran a `.rollback*`.
   Después, el temporal se renombra a `world-craft.sqlite` y se verifica ya en su
   sitio.
4. Si algo falla, se restaura la base anterior desde `.rollback*`. Si el
   rollback también falla, se devuelve `DB_RESTORE_ROLLBACK_FAILED`, no se borra
   nada y el arranque siguiente detecta los restos.
5. Si todo va bien, se limpian `.rollback*` y el marcador, y la aplicación se
   **relanza**. Al arrancar se aplican las migraciones pendientes con su copia
   pre-migración.
6. Cualquier fallo devuelve al aviso de modo seguro con un código estable; nunca
   deja la app a medias ni escribe en la base en segundo plano.

### 7.4 Restauración interrumpida y recuperación manual

- Si el proceso muere durante el reemplazo, quedan `.rollback*`,
  `.restore.tmp*` o `.restore.pending`. El arranque detecta cualquiera de ellos
  y entra en modo seguro con `DB_RESTORE_INTERRUPTED` **sin abrir ni crear la
  base**.
- Una restauración posterior **preserva** esos restos en
  `backups/pre-restore/<timestamp>-rollback/` o `…-restore-tmp/` en lugar de
  borrarlos.
- Las copias pre-restauración no se ofrecen en el diálogo. Si hay que recuperar
  una a mano, con la aplicación cerrada se copia su `world-craft.sqlite` (y, si
  existen, sus `-wal`, `-shm` y `-journal`) sobre `data/`, se retiran los restos
  `.rollback*`, `.restore.tmp*` y `.restore.pending` y se vuelve a abrir la app.
- Si un lock queda bloqueado por un PID reutilizado o ilegible, se puede cerrar
  la app y borrar `data/.restore.lock` a mano; no se pierde ningún dato.

### 7.5 Límites conocidos

- **Instancia única resuelta en #68:** `requestSingleInstanceLock()` se adquiere
  antes de abrir la base, de modo que dos procesos ya no pueden solapar una
  restauración. Queda el caso de un `.restore.lock` obsoleto o ilegible, que se
  puede borrar a mano con la app cerrada.
- En M0 la restauración solo se ofrece cuando el arranque entra en modo seguro;
  Ajustes existe desde M1-08 pero **no ofrece restaurar** con la base sana. La
  restauración guiada desde Ajustes sigue prevista.
- Una base de **0 bytes** se considera nueva; con restos de restauración, en
  cambio, siempre se entra en modo seguro.
- Una base válida con restos `.rollback*` o con el marcador también obliga a
  modo seguro hasta que se restaura o se limpia a mano.
- Si la limpieza de `.rollback*` falla tras una restauración correcta, el
  siguiente arranque puede volver a modo seguro.
- La durabilidad del marcador y de la copia previa protege frente a un **cierre
  del proceso**, no frente a un corte de energía en el instante exacto del
  reemplazo (no hay `fsync`).
- El inventario de copias y la rotación listan las carpetas sin `realpath` ni
  comprobación de contención; la carpeta elegida en el diálogo sí se valida.
  Endurecerlos y añadir una prueba de junction queda para antes de M1.
- Los assets existentes **no se sustituyen** al restaurar solo la base; las
  referencias huérfanas y la cuarentena de assets se abordan en #116, igual que
  los assets que quedan tras purgar un mundo en la papelera.

## 8. Exportación e importación

**Implementado en M1-07 (#78), ampliado en M1-08 (#79) y evolucionado en #114.**
El formato está versionado y documentado en
[`docs/formato-de-exportacion.md`](formato-de-exportacion.md); las decisiones
están en el [ADR 0029](adr/0029-world-export-import.md), el
[ADR 0030](adr/0030-settings-data-and-full-deletion.md) y el
[ADR 0031](adr/0031-descripcion-enriquecida-del-mundo-y-formato-v2.md). La
migración `0008_world_description` deja `user_version` en **9**, y el formato de
mundo pasa a **v2** con lectura de v1.

### 8.1 Exportación de un mundo

La acción **Exportar mundo…** vive en el menú del mundo y abre el diálogo nativo
de guardado. El destino lo elige el usuario; el nombre propuesto se sanea para
Windows y termina en `.zip`. La exportación no se guarda en una carpeta
`exports/` de la aplicación.

El archivo es un ZIP con:

- `manifest.json`: `format: "world-craft-world"`, `formatVersion: 2`,
  `schemaVersion` igual a `user_version` (9), `appVersion`, `exportedAt`,
  `assetsIncluded: true`, mundo de origen, recuentos, avisos y `files` con
  `path`, `size` y `sha256`. El manifiesto no se lista a sí mismo.
- `world.json`: mundo con su **descripción como documento de ProseMirror o
  `null`**, tipos personalizados (`entity-types.v1`), tipos de relación
  personalizados (`relation-types.v1`), etiquetas, metadatos de assets, fichas
  vivas con sus versiones, galería, imagen principal, atributos y etiquetas,
  relaciones y portada. `description_text` no viaja: se recalcula al importar.
- `assets/<uuidv7>.webp`: las imágenes referenciadas, ya en WebP canónico.

Al exportar, los enlaces `wc-entity://` del mundo se remapean con el mapa de IDs;
los que no se resuelven se quitan conservando el texto y se cuentan como
`broken-entity-link`.

**Solo viaja contenido vivo de mundos vivos:** fichas, tipos, etiquetas y
relaciones con `deleted_at IS NULL`, y un mundo que no esté en la papelera. Las
versiones de las fichas exportadas se incluyen completas; las de fichas en
papelera no existen en la instantánea. **La papelera, lo purgado, `activity_log`,
el índice FTS5, las preferencias y las miniaturas no se exportan.** Tampoco hay
bloques de mapas, manuscritos, escenas o juego, porque aún no están
implementados. Esta regla no se duplica en la interfaz más allá del aviso del
diálogo (ADR 0028).

La exportación se ejecuta en el utility process con una conexión SQLite de solo
lectura. El orden del contenido es determinista; cada asset se verifica contra
su tamaño y SHA-256 en la base; el ZIP se escribe en un `.partial` único junto al
destino, se vuelve a leer para comprobar manifiesto, `world.json` y checksums de
los assets, y solo entonces se publica con `rename`. Si algo falla, el `.partial`
se elimina y el archivo de destino anterior queda intacto. El progreso y la
cancelación llegan por eventos; la fase `saving` no se puede cancelar.

### 8.2 Importación de un mundo

La acción **Importar mundo…** está en Inicio y Mundos y abre el selector nativo
de archivos. La importación **siempre crea un mundo nuevo**: nunca fusiona ni
sobrescribe un mundo existente.

1. **Preparación en el worker.** Se valida el índice del ZIP, se lee el
   manifiesto y se rechaza con `TRANSFER_FORMAT_UNSUPPORTED` si su
   `schemaVersion` supera el `user_version` instalado, antes de leer
   `world.json`. Después se comprueba el tamaño y el SHA-256 de `world.json`
   antes de parsearlo y se valida el contenido con Zod estricto. Un paquete
   `formatVersion: 1` se acepta: su descripción plana se convierte a documento
   párrafo a párrafo antes de validarse con el esquema del mundo. Un
   `formatVersion` mayor que 2 se rechaza con `TRANSFER_FORMAT_UNSUPPORTED` antes
   del parse estricto. Solo se admiten
   `manifest.json`, `world.json` y `assets/<uuidv7>.webp`; se rechazan rutas
   absolutas, `..`, UNC, separadores `\`, ADS (`:`), nombres reservados de
   Windows, mayúsculas, directorios, enlaces, cifrado, duplicados y entradas de
   más. Los límites y el ratio de compresión se comprueban antes de extraer y
   otra vez durante la extracción.
2. **Staging.** `imports/.tmp/<operationId>/` guarda los assets extraídos, el
   `world.json` validado y `plan.json`. Los assets se procesan con los límites
   del servicio (magic bytes WebP, 25 MiB, 8192 px y 24 Mpx), se re-codifican y
   se les genera la miniatura. El plan genera un UUIDv7 nuevo para cada fila y
   remapea todas las referencias. Los assets procesados se mueven a
   `assets/.tmp/<operationId>/<worldId>/`.
3. **Publicación transaccional.** El proceso principal vuelve a validar las
   rutas del worker y el plan, comprueba los assets y el espacio libre, y abre
   una única transacción. Inserta las filas en este orden: `worlds`,
   `entity_types`, `relation_types`, `tags`, `assets`, `entities`,
   `entity_tags`, `entity_gallery`, `entity_versions` y `relations`. Después,
   **antes del commit**, renombra el directorio de assets a
   `assets/worlds/<worldId>`, actualiza `worlds.cover_asset_id` y registra la
   actividad `world.imported`. Si el commit o el renombrado fallan, SQLite
   revierte y el directorio publicado se elimina.
4. **Cancelación y limpieza.** Cancelar antes de `saving` aborta la lectura, la
   extracción o la preparación y limpia el staging. Durante `saving` la
   operación no se puede cancelar: la transacción y el renombrado deben terminar
   juntos. Al arrancar se vacían `imports/.tmp`, `exports/.tmp` y `assets/.tmp`;
   nunca se toca `assets/worlds`.

**No se crea una copia previa a la importación.** La operación solo añade un
mundo nuevo y es transaccional; los mundos, fichas, imágenes, relaciones, copias
y `schema_migrations` existentes no se modifican. La copia previa sigue siendo
obligatoria para migraciones, purgas y vaciados.

**Conflictos y saneo.** El slug global del mundo se conserva si está libre; si
no, se prueba `-2`, `-3`… hasta `-9999`. El resultado indica `slugAdjusted`. Los
tipos del sistema se resuelven por clave y los personalizados se insertan. Las
referencias rotas se eliminan con avisos agregados (enlaces `wc-entity://`,
campos `reference`, galería, portada, imagen principal, tipos y etiquetas
ausentes, relaciones sin extremo o tipo y versiones ilegibles). Un atributo que
no encaja se descarta; un campo obligatorio ausente no se inventa. Una ficha sin
tipo personalizado se descarta y sus relaciones también.

**Fechas y estado.** El mundo importado queda **activo**, con `settings` vacío y
`cover_asset_id` resuelto al final. El mundo, los tipos personalizados y los
tipos de relación usan la fecha de importación; las fichas, etiquetas, versiones,
assets y relaciones conservan sus fechas originales. La actividad registra
`world.imported` con los recuentos y el total de avisos. Los triggers de búsqueda
indexan el contenido importado sin una reconstrucción aparte.

### 8.3 Formato, compatibilidad y límites

- **Checksums:** cada `sha256` es el SHA-256 de los bytes descomprimidos. El
  lector comprueba tamaño y hash de `world.json` y de cada asset. El CRC del
  contenedor no se usa como garantía; la comprobación fuerte es el SHA-256.
- **Formato y esquema futuros:** `formatVersion` superior a 2 se rechaza con
  `TRANSFER_FORMAT_UNSUPPORTED`; v1 se acepta y su descripción plana se convierte
  a párrafos. Un `schemaVersion` superior al `user_version`
  instalado también se rechaza con `TRANSFER_FORMAT_UNSUPPORTED`, después de leer
  el manifiesto y antes de leer `world.json` o extraer assets; los esquemas
  iguales o anteriores se aceptan y el contenido se valida con Zod. La versión
  instalada se propaga del proceso principal al worker. Un cambio de esquema que
  altere el contenido exigirá además un `formatVersion` nuevo.
- **Límites D4:** 8 GiB de ZIP, 16 GiB descomprimidos, 10.000 entradas, 256 MiB
  de `world.json`, 16 MiB de manifiesto, 50.000 fichas, 500.000 versiones,
  300.000 relaciones, 5.000 etiquetas, 1.000 tipos de entidad, 1.000 tipos de
  relación, 8.000 assets y 140 caracteres de ruta. Se mantienen los límites por
  registro (25 MiB/imagen, 8192 px/24 Mpx, 200.000 caracteres de JSON y 50.000 de
  texto plano en la descripción de una ficha, 200.000 de JSON y 4.000 de texto
  plano en la del mundo, 500 de `alt`, 20 de galería, 12 etiquetas, 10 alias y 8
  géneros).
- **Ratio de compresión:** 100:1 por entrada solo al importar. La verificación de
  una exportación propia lo desactiva para no rechazar un mundo legítimamente
  muy comprimible.
- **Espacio:** antes de extraer se comprueba el espacio libre con un margen de
  64 MiB y una reserva por miniaturas y por `plan.json`; en exportación se suma
  el tamaño del destino existente. Un fallo devuelve `TRANSFER_NO_SPACE` sin
  dejar un mundo parcial.
- **Modo seguro:** sin base, el coordinador de sustitución devuelve
  `TRANSFER_UNAVAILABLE` y no abre diálogos ni escribe. La función no está
  disponible en ese estado.

### 8.4 Eliminación total

Ajustes → Datos → **Eliminar todos los datos** exige escribir la frase exacta
**ELIMINAR TODO** y envía el token `delete-all-data`; la interfaz solo puede
enviar `keepBackups`, que está desmarcado por defecto. La operación, implementada
en M1-08 (#79), sigue este orden:

1. **Copia previa obligatoria.** Crea `backups/pre-delete/<timestamp>/` con una
   copia online de la base en manifiesto v2 (`reason: 'pre-delete'`), verifica
   tamaño, SHA-256, `integrity_check` y `user_version`, copia el árbol de
   `assets/` sin seguir enlaces y lo verifica con `assets-manifest.json`, y
   escribe `recovery.json` con instrucciones, tamaños y hashes. Si algo falla, no
   se borra nada y el resultado es `failed`.
2. **Validación y cierre.** Se validan las raíces (`data`, `assets`, temporales,
   `logs`, `backups` y `pre-delete`) con `lstat`/`realpath` dentro de `userData`;
   un enlace, junction o escape devuelve `DATA_DELETE_ROOT_INVALID`. Se comprueba
   que no haya una transferencia activa y se cierra la persistencia.
3. **Borrado ordenado.** Temporales (`imports/.tmp`, `exports/.tmp`,
   `assets/.tmp`), base (`data/`), assets, logs y, si no se conservan, las
   copias. La copia `pre-delete` se conserva siempre. `userData`, sus entradas
   desconocidas, `.updaterId` y la instalación **no se tocan**.
4. **Verificación y reinicio.** La comprobación final sobre disco produce
   `deleted` o `partial` con las categorías restantes. Como la base ya está
   cerrada, cualquier resultado exige reiniciar; la composición lanza
   `app.relaunch()` y `app.exit(0)` a los 750 ms.

La copia `pre-delete` **no se ofrece en la restauración guiada**: esa ruta solo
sustituye SQLite y dejaría los assets desalineados. Se recupera a mano: cerrar la
aplicación, copiar `world-craft.sqlite` a `data/`, copiar la carpeta `assets`
junto a `data`, comprobar `assets-manifest.json` y seguir `recovery.json`. El
manual lo explica paso a paso en la sección 12.7.

### 8.5 Biblioteca total (`world-craft-library` v1)

«Exportar todos los datos» (M1-08, #79) genera un ZIP abierto independiente de
las copias automáticas:

```text
manifest.json
settings.json
database/world-craft.sqlite
worlds/<slug>.zip
```

- Cada `worlds/<slug>.zip` es un paquete `world-craft-world` v1 de #78, con el
  contenido vivo del mundo y sus imágenes.
- `settings.json` guarda tema, densidad, tamaño de texto, rail y memoria de la
  vista de ficha; **no** guarda `lastView` ni `recentLocation`.
- `database/world-craft.sqlite` es una **copia completa** de la base obtenida con
  `sqlite.backup` y verificada. Incluye papelera, actividad y preferencias,
  también `lastView` y `recentLocation`.
- El manifiesto lista cada entrada con tamaño y SHA-256, más recuentos y avisos
  agregados. La exportación es todo-o-nada: staging en `exports/.tmp`, `.partial`
  junto al destino, comprobación de espacio, relectura y `rename`; un fallo no
  publica nada y conserva el destino anterior.

La importación sigue siendo **mundo a mundo** con `transfer:importWorld`; no se
importa la biblioteca completa ni se restaura su base desde la aplicación. El
detalle del formato está en
[`docs/formato-de-exportacion.md`](formato-de-exportacion.md), sección 12.

## 9. Preservación en actualizaciones y desinstalación

**Implementado en M0-08 (#68).** El instalador y el actualizador nunca escriben
en la carpeta de datos del usuario.

- El instalador NSIS es por usuario y escribe en
  `%LOCALAPPDATA%\Programs\World Craft`, sin administrador ni UAC, y no toca
  `%APPDATA%\World Craft`. La versión 0.1.0 se generó en local y se probó con
  `scripts/verify-install.ps1`.
- El desinstalador elimina binarios y accesos directos; conserva `userData` y lo
  indica antes de borrar los binarios. `deleteAppDataOnUninstall:false` está fijado de forma
  explícita y el aviso solo se muestra en modo interactivo.
- Cada arranque comprueba la integridad y la versión del esquema; si hay
  migraciones pendientes en una base existente, crea la copia previa y las
  aplica. Si termina en `ready`, crea además las copias automáticas que falten.
  Esto funciona desde M0-07.
- Una restauración desde el diálogo de modo seguro sustituye solo la base; los
  assets existentes quedan intactos. Las copias automáticas incluyen solo SQLite,
  no assets.
- La actualización es manual, consentida y cancelable: se comprueba desde el
  botón «Actualizaciones», se descarga solo con permiso, se puede cancelar y solo
  se instala desde `downloaded` con reinicio consentido. La app no se actualiza
  sola ni al cerrar.
- La prueba de integración
  `tests/integration/packaging/preservation.test.ts` usa un `userData` temporal
  con base, `app_settings`, un asset y una copia pre-migración, aplica una
  migración de fixture y simula reinstalación y borrado de la carpeta de
  instalación. La prueba real de instalación, actualización 0.1.0→0.1.1 y
  desinstalación conservó **194 archivos** de `userData`, incluidas las copias
  diarias creadas por los arranques de prueba, y dejó el registro solo en HKCU.
- El paquete incluye `out/`, `package.json`, `LICENSE`,
  `THIRD-PARTY-NOTICES.md` y `licenses/`, con `better-sqlite3` y `sharp`
  desempaquetados del asar y podados a win32-x64. `pnpm verify:package` comprueba
  el asar, los binarios, las licencias, el icono, la versión y los manifiestos;
  `pnpm verify:native` comprueba los módulos en Node y Electron.
- Residual: la actualización real contra una release pública de GitHub se prueba
  en M5. En M0-08 no hay release publicada y el instalador sigue sin firma
  (ADR 0015).

## 10. Logs y diagnóstico

- El arranque escribe `logs/startup.log` en JSONL, con eventos tipados y
  rotación a 256 KiB (`startup.log.1`). No incluye SQL, filas, rutas ni contenido
  del usuario; solo códigos, versiones y contadores.
- El programador de copias registra `backup.schedule` con el resultado (creadas,
  fallidas y podadas) y la restauración registra `backup.restore` con el
  desenlace y el código. Ninguno incluye rutas, nombres de carpeta, tamaños,
  SHA-256, identificadores ni contenido.
- El servicio de assets escribe `logs/assets.log` con el mismo formato y
  rotación: eventos `asset.import`, `asset.request`, `asset.orphans` y
  `asset.paths`, con códigos, estados y contadores, sin rutas ni IDs.
- El actualizador escribe `logs/updates.log` con el mismo formato y rotación:
  `update.composition`, `update.check`, `update.download`, `update.install` y
  `update.command`, con resultado y motivo estables, sin URLs, rutas, versiones
  ni contenido. La caché de descargas de electron-updater vive fuera de
  `userData`, en `%LOCALAPPDATA%`, y no se incluye en las copias.
- La exportación e importación escriben `logs/transfer.log` en JSONL con
  rotación a 256 KiB: `transfer.operation` (operación, fase, resultado, código y
  número de avisos) y `transfer.cleanup` (resultado y entradas eliminadas). No
  incluye rutas, IDs, nombres de mundo, contenido ni mensajes internos. Un fallo
  al escribir el log no interrumpe la operación.
- Ajustes → Datos define el evento `data.operation` para exportación y borrado
  con solo operación, resultado y código. **En esta entrega no se conecta un
  sumidero nuevo**: no se crea `logs/data.log`, de modo que ni siquiera esos
  campos se escriben. El contrato prohíbe expresamente rutas, IDs, nombres,
  tamaños y contenido.
- Si el log no se puede escribir, el arranque continúa: el diagnóstico nunca
  impide abrir la aplicación.
- Los logs generales de la app, con nivel configurable, y la exportación de un
  diagnóstico local (versión, sistema, estado de la base y últimas líneas)
  siguen previstos. No habrá envío automático de diagnósticos.

## 11. Límites y rendimiento

- Tamaño recomendado de base: hasta 1 GB sin ajustes especiales; por encima, se
  revisan índices y archivo.
- Assets: 25 MB por archivo, 8192 px por lado y 24 Mpx totales, comprobados
  antes de decodificar y sobre el resultado. En M0 no hay límite por mundo ni
  deduplicación; se revisarán con la UI de M1.
- Listas paginadas por cursor; virtualización en tablas largas.
- **Exportación e importación:** límites D4 en la sección 8.3 y en el
  [formato](formato-de-exportacion.md). La importación exige ratio 100:1 por
  entrada y comprueba el espacio libre con un margen de 64 MiB; la exportación
  reserva el tamaño de salida más el destino existente. Una operación a la vez y
  una sola cancelación antes de `saving`. Los ZIP grandes pueden tardar varios
  minutos; la interfaz muestra fase, recuento y avisos, y bloquea el cierre del
  diálogo mientras la operación no es cancelable.
- Las copias automáticas y la restauración se ejecutan en el proceso principal
  durante el arranque o en el diálogo de modo seguro, antes de la ventana. Una
  base muy grande puede alargar el arranque. La exportación y la importación ya
  usan el utility process; las copias y su posible worker se valorarán en M5.
- **Uso de disco de Ajustes:** se detiene a las 100 000 entradas o a los 4
  segundos y marca el resultado como parcial; no bloquea la ventana ni sigue
  enlaces. La biblioteca total se ejecuta en el proceso principal reutilizando el
  escritor de #78, calcula el espacio libre antes de publicar y no se cancela
  desde la interfaz. El borrado total copia la base y los assets antes de borrar:
  necesita espacio libre suficiente para esa copia y no se puede interrumpir sin
  dejar un resultado `partial`.
- Un arranque con migraciones pendientes puede ejecutar hasta **tres
  `integrity_check`** (base viva antes de migrar, copia pre-migración y base viva
  después); cada copia verificada añade sus propias comprobaciones en solo
  lectura.
- La copia pre-restauración no se poda y las copias corruptas no se borran
  automáticamente; el espacio en disco puede crecer si se repiten restauraciones
  o hay copias dañadas. Las `pre-purge` sí rotan, a 10 válidas.
- Una purga con contenido grande crea una copia completa de la base antes de
  borrar: necesita espacio libre equivalente al tamaño de la base y no es
  instantánea. La interfaz deshabilita las acciones y muestra un estado de espera
  mientras se crea la copia.
- Tras purgar un mundo, sus filas de `assets` y sus archivos quedan huérfanos
  hasta #116 (sección 4.4). `VACUUM` tras una purga grande no forma parte de #77:
  llegará como acción confirmada de Ajustes.
- `VACUUM` solo tras borrados grandes y con confirmación; nunca en cada
  arranque.

## 12. Qué no hace World Craft

- No sincroniza entre equipos.
- No usa la nube para copias.
- No cifra la base por defecto; la protección es la cuenta de Windows y los
  permisos de la carpeta. El cifrado opcional se valorará en el backlog.
- No escribe en la carpeta de instalación ni en `Program Files`.
- No requiere Docker, Supabase, Vercel ni ningún servicio externo.

## 13. Documentos relacionados

- [Arquitectura](arquitectura.md)
- [Esquema de base de datos](base-de-datos/esquema.md)
- [Migraciones](base-de-datos/migraciones.md)
- [Continuidad y recuperación](continuidad.md)
- [Formato de exportación](formato-de-exportacion.md)
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [ADR 0002](adr/0002-sqlite-better-sqlite3-drizzle-fts5.md)
- [ADR 0005](adr/0005-local-assets-custom-protocol.md)
- [ADR 0012](adr/0012-backup-restore-recovery.md)
- [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md)
- [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md)
- [ADR 0027](adr/0027-ui-preferences-persistence.md)
- [ADR 0028](adr/0028-trash-versions-and-pre-purge-backup.md)
- [ADR 0029](adr/0029-world-export-import.md)
- [ADR 0030](adr/0030-settings-data-and-full-deletion.md)
