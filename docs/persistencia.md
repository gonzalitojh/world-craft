# Persistencia local de World Craft

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio). La base local,
> las migraciones, el modo seguro y el servicio de assets con `wc-asset://`
> están implementados en M0-04 (#64) y M0-06 (#66); la restauración guiada, la
> retención de copias y su interfaz llegan con M0-07, y el instalador con #68.
> Las secciones distinguen lo implementado de lo previsto.
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
  │   └─ world-craft.sqlite-shm
  ├─ assets\
  │   ├─ worlds\
  │   │   └─ <worldId>\
  │   │       ├─ <assetId>.webp
  │   │       └─ <assetId>.thumb.webp
  │   └─ .tmp\               (escrituras en curso, se limpian)
  ├─ backups\
  │   ├─ daily\                 (previsto, M0-07)
  │   ├─ weekly\                (previsto, M0-07)
  │   ├─ monthly\               (previsto, M0-07)
  │   ├─ orphans\
  │   │   └─ <timestamp>\
  │   │       ├─ assets\        (huérfanos purgados, con su ruta relativa)
  │   │       └─ manifest.json
  │   └─ pre-migration\
  │       └─ <timestamp>\
  │           ├─ world-craft.sqlite
  │           └─ manifest.json
  ├─ exports\                   (previsto, M1)
  └─ logs\
      ├─ startup.log
      ├─ startup.log.1
      ├─ assets.log
      └─ assets.log.1
```

| Ruta | Contenido | Se puede borrar a mano |
|---|---|---|
| `data/world-craft.sqlite` | Base de datos principal | No sin copia y con la app cerrada |
| `data/*-wal`, `data/*-shm` | Ficheros auxiliares de SQLite | Se consolidan al cerrar; no borrar sueltos |
| `assets/worlds/<worldId>/` | WebP de cada mundo y su miniatura `.thumb.webp` (implementado) | Solo desde la app o con exportación previa |
| `assets/.tmp/` | Restos de importaciones en curso (se limpian) | Sí, con la app cerrada; la purga los clasifica |
| `backups/orphans/<timestamp>/` | Copia verificable de huérfanos purgados | Solo tras comprobar que no hace falta recuperar |
| `backups/pre-migration/` | Copia y manifiesto previos a una migración (implementado) | Solo si no hay una actualización pendiente |
| `backups/daily`, `weekly`, `monthly` | Copias automáticas (previstas, M0-07) | Las antiguas, desde la app |
| `exports/` | Exportaciones ZIP/JSON generadas por el usuario (previsto) | Sí |
| `logs/startup.log` | Arranque en JSONL, rotado a 256 KiB | Sí; no contiene contenido del usuario |
| `logs/assets.log` | Eventos de assets en JSONL, rotado a 256 KiB | Sí; sin rutas, IDs ni contenido |

La app ofrecerá desde Ajustes «Abrir carpeta de datos», «Abrir copias» y «Abrir
logs». Esas acciones abrirán el explorador de Windows sin exponer rutas al
renderer. En M0-04 el diálogo de modo seguro ya permite abrir la carpeta de
copias (o `userData` si aún no existe) y el log de arranque se escribe sin
interfaz. Las preferencias de ventana, tema e idioma se guardarán en la tabla
`app_settings`; no se crea `config.json`.

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
ventana: abrir sin WAL, comprobar integridad, leer el estado, copiar si hace
falta, activar WAL, migrar en una transacción y volver a comprobar. El cierre es
idempotente en `before-quit`.

Las operaciones largas (exportación, importación y copias automáticas) se
ejecutarán en un **utility process** para no bloquear la interfaz; todavía no
está implementado. La copia previa a migraciones usa la API online de SQLite y
se ejecuta durante el arranque, antes de abrir la ventana.

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
  `pnpm verify:native`. `THIRD-PARTY-NOTICES.md` recoge las licencias; #68 debe
  desempaquetar sharp del asar e incluir los textos completos.
- Residuales aceptados y documentados en el
  [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md): ventanas TOCTOU de
  escritura temporal y de lectura, raíces creadas antes de validar su
  contención, `backups/orphans` sin validar como directorio real, ausencia de
  symlinks de archivo en las pruebas de Windows sin modo desarrollador y avisos
  de terceros incompletos hasta #68.
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
  `backups/pre-migration/<timestamp>/`, con manifiesto, SHA-256 e
  `integrity_check` en solo lectura. Si la copia falla, no se migra. Una base
  nueva no crea copia porque no hay datos que preservar.
- La versión del esquema se guarda en `PRAGMA user_version` como **número de
  migraciones aplicadas** y en la tabla `schema_migrations`, con checksum
  SHA-256 del SQL normalizado. Con `0000_init` y `0001_assets`, vale 2.
- `0001_assets` es aditiva: crea la tabla `assets` con sus `CHECK` e índices y no
  toca `app_settings` ni las tablas del sistema. Su rollback de referencia está
  en `drizzle/rollback/0001_assets.down.sql`; las pruebas cubren la actualización
  desde `0000` y el rollback de ambas migraciones.
- Si una migración falla, se revierte el lote, se conserva la copia y la app
  arranca en **modo seguro** sin conexión de escritura. La restauración guiada
  llega con M0-07; hoy el aviso permite abrir la carpeta de copias, continuar en
  modo seguro o salir.
- Una base con tablas propias y sin `schema_migrations` se rechaza: no se adopta
  como propia.
- Cada migración incluye una prueba sobre una base temporal y una prueba de
  preservación de datos.
- El detalle está en [`docs/base-de-datos/migraciones.md`](base-de-datos/migraciones.md).

## 6. Copias de seguridad

| Tipo | Frecuencia | Retención | Contenido | Estado |
|---|---|---|---|---|
| Pre-migración | Antes de migrar una base existente | Sin poda todavía | SQLite + manifiesto | Implementada (M0-04) |
| Huérfanos purgados | Antes de cada purga confirmada | La decide el usuario | Archivos + manifiesto con SHA-256 | Implementada (M0-06) |
| Diaria | Una al día, al cerrar o al arrancar | 7 | SQLite + manifiesto | Prevista (M0-07) |
| Semanal | Una a la semana | 4 | SQLite + manifiesto | Prevista (M0-07) |
| Mensual | Una al mes | 12 | SQLite + manifiesto | Prevista (M0-07) |
| Manual | Cuando el usuario lo pide | La decide el usuario | SQLite + assets opcionales | Prevista (M0-07) |

- La copia pre-migración se crea con la API online de SQLite dentro de
  `backups/pre-migration/<timestamp>/`; incluye `world-craft.sqlite` y un
  `manifest.json` con `formatVersion`, `reason`, `createdAt`,
  `databaseFile`, `schemaVersion`, `sizeBytes` y `sha256`. Se verifica con una
  conexión de solo lectura que ejecuta `PRAGMA integrity_check` y comprueba la
  versión de esquema; si falla, no se migra.
- Las copias automáticas diaria, semanal y mensual, la rotación y la copia
  manual llegarán con M0-07. Mientras tanto, las copias pre-migración no se
  podan.
- La copia de huérfanos de una purga vive en `backups/orphans/<timestamp>/` y
  no se poda automáticamente: contiene los archivos y un `manifest.json` con
  `formatVersion`, `reason`, `createdAt`, `recovery` y la lista de archivos con
  tamaño y SHA-256.
- Verificación de una copia: manifiesto válido, tamaño y SHA-256 coincidentes,
  `integrity_check` correcto y versión de esquema esperada.
- Ubicación por defecto: `backups/`. El usuario podrá elegir otra carpeta,
  incluida una unidad externa, desde Ajustes.
- Las copias son locales; no se suben a ningún servicio.

## 7. Restauración

**Prevista para M0-07.** Todavía no hay interfaz de copias ni restauración
guiada. El flujo previsto es:

1. El usuario elige una copia desde Ajustes → Copias.
2. La app verifica el manifiesto y la integridad antes de ofrecer restaurar.
3. Antes de reemplazar nada, crea una copia de seguridad de la base actual en
   `backups/pre-restore/`.
4. Cierra la conexión, sustituye la base y reabre; si el reemplazo falla,
   restaura la base anterior y muestra el error.
5. Tras restaurar, ejecuta las migraciones pendientes con copia previa.
6. Los assets no se sustituyen salvo que la copia sea completa y el usuario lo
   confirme; las referencias huérfanas se listan en el informe.

La restauración exigirá confirmación explícita y nunca se hará en segundo plano.
En M0-04 el modo seguro solo permite abrir la carpeta de copias, continuar sin
escritura o salir; la copia pre-migración ya está creada y verificada. Las
pruebas de integración comprueban que una copia se puede restaurar manualmente
con la app cerrada y que la migración vuelve a aplicarse sin perder datos.

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

- El instalador NSIS escribirá en `%LOCALAPPDATA%\Programs\World Craft` y no
  tocará `%APPDATA%\World Craft`. El instalador llega con #68; todavía no existe.
- El desinstalador eliminará binarios y accesos directos; conservará `userData`
  y lo indicará al terminar.
- Cada arranque comprueba la integridad y la versión del esquema; si hay
  migraciones pendientes en una base existente, crea la copia previa y las
  aplica. Esto ya funciona en M0-04.
- Una prueba automatizada instalará, actualizará y desinstalará en un entorno
  temporal y verificará que la base y los assets siguen intactos. Llega con #68.
- #68 debe desempaquetar `better-sqlite3` y `sharp` del asar y garantizar que las
  dependencias de producción, `THIRD-PARTY-NOTICES.md` y `drizzle/` viajan en el
  paquete. La externalización y la copia de migraciones ya se comprueban con
  `pnpm verify:build`; `pnpm verify:native` comprueba sharp en Node y Electron.

## 10. Logs y diagnóstico

- El arranque escribe `logs/startup.log` en JSONL, con eventos tipados y
  rotación a 256 KiB (`startup.log.1`). No incluye SQL, filas, rutas ni contenido
  del usuario; solo códigos, versiones y contadores.
- El servicio de assets escribe `logs/assets.log` con el mismo formato y
  rotación: eventos `asset.import`, `asset.request`, `asset.orphans` y
  `asset.paths`, con códigos, estados y contadores, sin rutas ni IDs.
- Si el log no se puede escribir, el arranque continúa: el diagnóstico nunca
  impide abrir la aplicación.
- Los logs generales de la app, con nivel configurable, y la exportación de un
  diagnóstico local (versión, sistema, estado de la base y últimas líneas)
  llegarán con M0-07/M5. No habrá envío automático de diagnósticos.

## 11. Límites y rendimiento

- Tamaño recomendado de base: hasta 1 GB sin ajustes especiales; por encima, se
  revisan índices y archivo.
- Assets: 25 MB por archivo, 8192 px por lado y 24 Mpx totales, comprobados
  antes de decodificar y sobre el resultado. En M0 no hay límite por mundo ni
  deduplicación; se revisarán con la UI de M1.
- Listas paginadas por cursor; virtualización en tablas largas.
- Copias y exportaciones en utility process.
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
