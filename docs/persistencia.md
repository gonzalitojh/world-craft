# Persistencia local de World Craft

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio). La base local,
> las migraciones y el modo seguro están implementados en M0-04 (#64); la
> restauración guiada, la retención de copias y su interfaz llegan con M0-07, y
> el instalador con #68. Las secciones distinguen lo implementado de lo previsto.
> **Ámbito:** ubicación de datos, SQLite, assets, migraciones, copias,
> exportación/importación y recuperación.
> **Decisiones:** ADR 0002 (SQLite), ADR 0005 (assets locales), ADR 0012
> (copias y recuperación) y ADR 0016 (migraciones y modo seguro).

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
  ├─ assets\                    (previsto, #66)
  │   └─ worlds\<worldId>\<assetId>.<ext>
  ├─ backups\
  │   ├─ daily\                 (previsto, M0-07)
  │   ├─ weekly\                (previsto, M0-07)
  │   ├─ monthly\               (previsto, M0-07)
  │   └─ pre-migration\
  │       └─ <timestamp>\
  │           ├─ world-craft.sqlite
  │           └─ manifest.json
  ├─ exports\                   (previsto, M1)
  └─ logs\
      ├─ startup.log
      └─ startup.log.1
```

| Ruta | Contenido | Se puede borrar a mano |
|---|---|---|
| `data/world-craft.sqlite` | Base de datos principal | No sin copia y con la app cerrada |
| `data/*-wal`, `data/*-shm` | Ficheros auxiliares de SQLite | Se consolidan al cerrar; no borrar sueltos |
| `assets/worlds/<worldId>/` | Imágenes y archivos de cada mundo (previsto) | Solo desde la app o con exportación previa |
| `backups/pre-migration/` | Copia y manifiesto previos a una migración (implementado) | Solo si no hay una actualización pendiente |
| `backups/daily`, `weekly`, `monthly` | Copias automáticas (previstas, M0-07) | Las antiguas, desde la app |
| `exports/` | Exportaciones ZIP/JSON generadas por el usuario (previsto) | Sí |
| `logs/startup.log` | Arranque en JSONL, rotado a 256 KiB | Sí; no contiene contenido del usuario |

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
  `0000_init`, vale 1), no el prefijo de la etiqueta. La tabla
  `schema_migrations` conserva el detalle y se contrasta con él.
- Timestamps en milisegundos UTC; la interfaz muestra la zona local.
- IDs UUIDv7 generados en el proceso principal (las tablas de dominio llegan en
  M1; las tablas del sistema usan claves de texto).

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

**Previsto para #66.** El diseño es:

- Ruta relativa guardada en la base de datos:
  `worlds/<worldId>/<assetId>.<ext>`.
- Nunca se guardan rutas absolutas.
- El renderer carga con `wc-asset://asset/<assetId>`; el protocolo resuelve el
  asset en la base, comprueba que la ruta resuelta sigue dentro de `assets/` y
  sirve el archivo con su MIME.
- Imágenes: se validan por contenido real (no solo extensión), se re-codifican
  a WebP y se genera una miniatura. Los originales grandes no se cargan en
  listas.
- Límites por archivo y por mundo configurables; se rechazan archivos que
  superen el límite antes de copiarlos.
- Al borrar un mundo se mueve su carpeta a una cuarentena recuperable; la
  purga definitiva exige confirmación y deja constancia en el log.

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
  SHA-256 del SQL normalizado.
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
- #68 debe desempaquetar `better-sqlite3` del asar y garantizar que las
  dependencias de producción y `drizzle/` viajan en el paquete. La
  externalización y la copia de migraciones ya se comprueban con
  `pnpm verify:build`.

## 10. Logs y diagnóstico

- El arranque escribe `logs/startup.log` en JSONL, con eventos tipados y
  rotación a 256 KiB (`startup.log.1`). No incluye SQL, filas, rutas ni contenido
  del usuario; solo códigos, versiones y contadores.
- Si el log no se puede escribir, el arranque continúa: el diagnóstico nunca
  impide abrir la aplicación.
- Los logs generales de la app, con nivel configurable, y la exportación de un
  diagnóstico local (versión, sistema, estado de la base y últimas líneas)
  llegarán con M0-07/M5. No habrá envío automático de diagnósticos.

## 11. Límites y rendimiento

- Tamaño recomendado de base: hasta 1 GB sin ajustes especiales; por encima, se
  revisan índices y archivo.
- Assets: límite por archivo (por defecto 25 MB) y por mundo (configurable).
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
