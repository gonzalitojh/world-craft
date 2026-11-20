# Persistencia local de World Craft

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio); actualizado el
> 20/11/2026 con M0-08. La base local, las migraciones, el modo seguro, el
> servicio de assets con `wc-asset://`, las copias automáticas, la rotación, la
> restauración desde el diálogo de modo seguro, el instalador por usuario y la
> actualización manual están implementados en M0-04 (#64), M0-06 (#66), M0-07
> (#67) y M0-08 (#68). La interfaz de copias de Ajustes llega en M1 y la release
> pública con actualización real, en M5. Las secciones distinguen lo
> implementado de lo previsto.
> **Ámbito:** ubicación de datos, SQLite, assets, migraciones, copias,
> exportación/importación y recuperación.
> **Decisiones:** ADR 0002 (SQLite), ADR 0005 y ADR 0017 (assets locales),
> ADR 0012 (copias y recuperación) y ADR 0016 (migraciones y modo seguro).

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
  │   └─ .tmp\               (escrituras en curso, se limpian)
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
  │   ├─ pre-migration\
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
  ├─ exports\                   (previsto, M1)
  ├─ logs\
  │   ├─ startup.log
  │   ├─ startup.log.1
  │   ├─ assets.log
  │   ├─ assets.log.1
  │   ├─ updates.log
  │   └─ updates.log.1
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
| `assets/.tmp/` | Restos de importaciones en curso (se limpian) | Sí, con la app cerrada; la purga los clasifica |
| `backups/orphans/<timestamp>/` | Copia verificable de huérfanos purgados | Solo tras comprobar que no hace falta recuperar |
| `backups/pre-migration/` | Copia y manifiesto previos a una migración; se conservan 5 (implementado) | Solo si no hay una actualización pendiente |
| `backups/daily`, `weekly`, `monthly` | Copias automáticas con manifiesto (implementado, M0-07) | Las antiguas, desde la app; no borrar las recientes |
| `backups/pre-restore/` | Base anterior y sus auxiliares antes de restaurar (implementado, M0-07) | Solo tras comprobar que la restauración fue correcta; no se poda sola |
| `exports/` | Exportaciones ZIP/JSON generadas por el usuario (previsto) | Sí |
| `logs/startup.log` | Arranque y copias en JSONL, rotado a 256 KiB | Sí; no contiene contenido del usuario |
| `logs/assets.log` | Eventos de assets en JSONL, rotado a 256 KiB | Sí; sin rutas, IDs ni contenido |
| `logs/updates.log` | Eventos del actualizador en JSONL, rotado a 256 KiB (M0-08) | Sí; sin URLs, rutas, versiones ni contenido |
| `.updaterId` | Identificador opcional de electron-updater para staging; no se usa con GitHub | Sí, con la app cerrada; no contiene datos del usuario |

La app ofrecerá desde Ajustes «Abrir carpeta de datos», «Abrir copias» y «Abrir
logs». Esas acciones abrirán el explorador de Windows sin exponer rutas al
renderer. En M0 el diálogo de modo seguro ya permite abrir la carpeta de copias
(o `userData` si aún no existe) y el log de arranque se escribe sin interfaz. Las
preferencias de ventana, tema e idioma se guardarán en la tabla `app_settings`;
no se crea `config.json`.

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
  `0000_init` y `0001_assets`, vale 2), no el prefijo de la etiqueta. La tabla
  `schema_migrations` conserva el detalle y se contrasta con él.
- Timestamps en milisegundos UTC; la interfaz muestra la zona local.
- IDs UUIDv7 generados en el proceso principal (`src/main/db/ids.ts`) con
  contador para mantener el orden dentro del mismo milisegundo. En M0 existen
  las tablas del sistema y `assets`; las tablas de dominio llegan en M1.

### 3.2 Acceso

El proceso principal abre una única conexión de escritura y la comparte entre
los casos de uso a través de `src/main/persistence.ts`; el renderer no tiene
acceso a SQLite ni a los archivos. El arranque se ejecuta antes de crear la
ventana: detectar restos de restauración, abrir sin WAL, comprobar integridad,
leer el estado, copiar si hay migraciones pendientes, activar WAL, migrar en una
transacción y volver a comprobar. Si el resultado es `ready`, el programador crea
las copias automáticas que falten antes de crear la ventana. El cierre es
idempotente en `before-quit`.

Las operaciones largas de **exportación e importación** se ejecutarán en un
**utility process** para no bloquear la interfaz; todavía no está implementado.
Las copias automáticas, la copia pre-migración y la restauración se ejecutan en
el proceso principal durante el arranque o en el diálogo de modo seguro, antes
de que exista una ventana con la que competir. En M0 no se copia al cerrar.

### 3.3 Búsqueda

FTS5 está disponible en el binario de better-sqlite3 y `pnpm verify:native` lo
comprueba en Node y Electron. El esquema de búsqueda (tokenizador `unicode61`,
tabla virtual `search_fts(title, body)` y triggers sobre `search_documents`)
llega con las tablas de dominio de M1. La aplicación reconstruirá los documentos
cuando cambie una entidad, un mapa, una escena o una tabla de juego. Si FTS5 no
estuviera disponible en un binario futuro, la app degradará a búsqueda `LIKE` y
lo registrará.

## 4. Assets

**Implementado en M0-06 (#66).** El servicio es puro en `src/main/assets/`; la
composición con Electron está en `composition.ts` y el protocolo en
`protocol.ts`. En M0 no hay IPC ni interfaz: la subida y la galería llegan con
las fichas (M1).

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
- `world_id` **no tiene clave foránea en M0** porque `worlds` llega en M1. Esa
  migración reconstruirá la tabla con `worlds(id) ON DELETE RESTRICT` y pondrá
  en cuarentena las filas sin mundo. Mientras tanto, la integridad se comprueba
  en el servicio.

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

### 4.5 Dependencia de imagen y residuales

- `sharp@^0.35.5` (Apache-2.0; `@img/sharp-*` Apache-2.0 AND LGPL-3.0-or-later;
  libvips LGPL-3.0-or-later) está externalizado en `electron.vite.config.ts`
  junto a `better-sqlite3` y verificado en Node y Electron con
  `pnpm verify:native`. `THIRD-PARTY-NOTICES.md` recoge las licencias; #68
  desempaquetó sharp del asar e incluyó los 5 textos completos en `licenses/`.
- Residuales aceptados y documentados en el
  [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md): ventanas TOCTOU de
  escritura temporal y de lectura, raíces creadas antes de validar su
  contención, `backups/orphans` sin validar como directorio real, ausencia de
  symlinks de archivo en las pruebas de Windows sin modo desarrollador. Los
  avisos de terceros y el desempaquetado quedaron completados en #68.
- La **exportación e importación** de assets con rutas relativas y checksums
  siguen previstas para M1 (sección 8).

> El diseño original está en el [ADR 0005](adr/0005-local-assets-custom-protocol.md)
> y el detalle de implementación en el
> [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md).

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
  SHA-256 del SQL normalizado. Con `0000_init` y `0001_assets`, vale 2.
- `0001_assets` es aditiva: crea la tabla `assets` con sus `CHECK` e índices y no
  toca `app_settings` ni las tablas del sistema. Su rollback de referencia está
  en `drizzle/rollback/0001_assets.down.sql`; las pruebas cubren la actualización
  desde `0000` y el rollback de ambas migraciones.
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
pre-restauración. Las copias **contienen solo la base SQLite y su manifiesto**:
los assets no se incluyen ni se sustituyen al restaurar.

| Tipo | Cuándo se crea | Retención | Contenido | Estado |
|---|---|---|---|---|
| Diaria | Primer arranque del día local | 7 | SQLite + manifiesto | Implementada (M0-07) |
| Semanal | Primera copia de la semana ISO local | 4 | SQLite + manifiesto | Implementada (M0-07) |
| Mensual | Primera copia del mes local | 12 | SQLite + manifiesto | Implementada (M0-07) |
| Pre-migración | Antes de migrar una base existente | 5 | SQLite + manifiesto | Implementada (M0-04; poda M0-07) |
| Pre-restauración | Antes de reemplazar la base | Sin poda | SQLite + WAL/SHM/journal + manifiesto | Implementada (M0-07); recuperación manual |
| Huérfanos purgados | Antes de cada purga confirmada | La decide el usuario | Archivos + manifiesto con SHA-256 | Implementada (M0-06) |
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
`pre-restore` pueden incluir además `-wal`, `-shm` y `-journal`. El manifiesto
actual es la **versión 2** y se valida con Zod en modo estricto:

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
| `reason` | `daily`, `weekly`, `monthly`, `pre-migration` o `pre-restore`. |
| `createdAt` | Fecha ISO 8601 en UTC. |
| `databaseFile` | Nombre fijo `world-craft.sqlite`. |
| `schemaVersion` | Valor de `PRAGMA user_version`; `null` solo si la base copiada no se pudo leer. |
| `sizeBytes` | Tamaño exacto del archivo copiado. |
| `sha256` | SHA-256 hexadecimal del archivo copiado. |
| `integrity` | `ok`, `failed` o `unknown`; solo `ok` es restaurable desde la app. |
| `assetsIncluded` | Siempre `false`: los assets no viajan en la copia. |

Las copias creadas en M0-04 con la versión 1 (solo pre-migración) se siguen
leyendo y se normalizan como íntegras y sin assets; no se reescriben.

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
| Pre-restauración | No se poda |

- Las copias corruptas no cuentan y no se borran.
- Nunca se borra la copia válida más reciente global ni la última copia válida
  de un motivo, aunque la retención sea 0.
- Cada candidata se **vuelve a verificar** justo antes de borrarla; si dejó de
  verificar, se conserva y se cuenta como omitida.
- Un fallo de borrado se contabiliza y no interrumpe la rotación.
- Si una carpeta de motivo no se puede listar, ese motivo no se poda en esa
  pasada.

### 6.5 Ubicación y copias manuales

- Ubicación por defecto: `backups/`. Las copias son locales y **no se suben a
  ningún servicio**.
- La copia manual (base + assets opcionales) y la elección de una carpeta
  externa desde Ajustes → Datos (sección Copias) siguen **previstas para M1**.
- Las copias **pre-restauración** no se ofrecen para restaurar desde la app y no
  se podan. Se conservan para recuperación manual (sección 7.4).
- La copia de huérfanos de una purga vive en `backups/orphans/<timestamp>/` y
  tampoco se poda automáticamente: contiene los archivos y un `manifest.json`
  con `formatVersion`, `reason`, `createdAt`, `recovery` y la lista de archivos
  con tamaño y SHA-256.

## 7. Restauración

**Implementado en M0-07 (#67).** En M0 no existe la pantalla Ajustes → Datos
(llega en M1): la restauración se ofrece desde el **diálogo nativo de modo
seguro**, que aparece cuando el arranque falla o cuando detecta una restauración
interrumpida. El flujo no abre ninguna conexión de escritura: verifica en solo
lectura y reemplaza archivos. Nunca se ejecuta en segundo plano ni sin
confirmación.

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
   `pre-restore` se rechaza con `DB_RESTORE_INVALID` y no se ofrece.

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
  no hay una acción para restaurar con la base sana hasta la pantalla de Ajustes
  de M1.
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
  referencias huérfanas se gestionarán en M1.

## 8. Exportación e importación

**Previsto para M1.** El formato es:

### 8.1 Exportación de un mundo

Un ZIP con:

- `world.json`: mundo, tipos, entidades, relaciones, etiquetas, mapas, grafo,
  manuscritos, escenas, tablas de juego y ajustes del mundo.
- `assets/`: archivos referenciados con rutas relativas.
- `manifest.json`: versión del formato, versión de esquema, fecha y checksums.

El formato es abierto y legible. La exportación se puede hacer completa o sin
assets.

### 8.2 Importación

- Se valida el ZIP y cada JSON con Zod.
- Límites de tamaño, número de archivos y profundidad.
- Se rechazan rutas absolutas, `..`, enlaces simbólicos y nombres reservados de
  Windows.
- Se importa en una carpeta temporal y se publica en una transacción; si algo
  falla, no queda nada a medias.
- Los IDs se regeneran si hay colisión; el informe indica qué se renombró.
- La importación nunca sobrescribe un mundo existente sin confirmación.

### 8.3 Eliminación total

Ajustes → Datos → «Eliminar todos los datos» exige escribir una confirmación,
crea una última copia recuperable y borra la base, los assets y las copias
según la elección del usuario. La app se reinicia en estado inicial.

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
- Si el log no se puede escribir, el arranque continúa: el diagnóstico nunca
  impide abrir la aplicación.
- Los logs generales de la app, con nivel configurable, y la exportación de un
  diagnóstico local (versión, sistema, estado de la base y últimas líneas)
  llegarán con M1/M5. No habrá envío automático de diagnósticos.

## 11. Límites y rendimiento

- Tamaño recomendado de base: hasta 1 GB sin ajustes especiales; por encima, se
  revisan índices y archivo.
- Assets: 25 MB por archivo, 8192 px por lado y 24 Mpx totales, comprobados
  antes de decodificar y sobre el resultado. En M0 no hay límite por mundo ni
  deduplicación; se revisarán con la UI de M1.
- Listas paginadas por cursor; virtualización en tablas largas.
- Las copias automáticas y la restauración se ejecutan en el proceso principal
  durante el arranque o en el diálogo de modo seguro, antes de la ventana. Una
  base muy grande puede alargar el arranque; el utility process para copias y
  exportaciones se valorará en M5.
- Un arranque con migraciones pendientes puede ejecutar hasta **tres
  `integrity_check`** (base viva antes de migrar, copia pre-migración y base viva
  después); cada copia verificada añade sus propias comprobaciones en solo
  lectura.
- La copia pre-restauración no se poda y las copias corruptas no se borran
  automáticamente; el espacio en disco puede crecer si se repiten restauraciones
  o hay copias dañadas.
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
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [ADR 0002](adr/0002-sqlite-better-sqlite3-drizzle-fts5.md)
- [ADR 0005](adr/0005-local-assets-custom-protocol.md)
- [ADR 0012](adr/0012-backup-restore-recovery.md)
- [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md)
- [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md)
