# Persistencia local de World Craft

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio).
> **Ámbito:** ubicación de datos, SQLite, assets, migraciones, copias,
> exportación/importación y recuperación.
> **Decisiones:** ADR 0002 (SQLite), ADR 0005 (assets locales), ADR 0012
> (copias y recuperación).

## 1. Principio

World Craft guarda todos los datos en el equipo del usuario. No hay base de
datos remota, cuentas, telemetría ni subida de contenido. Actualizar,
reinstalar o desinstalar la aplicación **no puede borrar** la base de datos,
los assets ni las copias.

La carpeta de datos vive en `app.getPath('userData')`, fuera de la carpeta de
instalación. En Windows, con el nombre de producto `World Craft`, la ruta
habitual es:

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
  │   └─ worlds\<worldId>\<assetId>.<ext>
  ├─ backups\
  │   ├─ daily\
  │   ├─ weekly\
  │   ├─ monthly\
  │   └─ pre-migration\
  ├─ exports\
  ├─ logs\
  └─ config.json
```

| Ruta | Contenido | Se puede borrar a mano |
|---|---|---|
| `data/world-craft.sqlite` | Base de datos principal | No sin copia y con la app cerrada |
| `data/*-wal`, `data/*-shm` | Ficheros auxiliares de SQLite | Se consolidan al cerrar; no borrar sueltos |
| `assets/worlds/<worldId>/` | Imágenes y archivos de cada mundo | Solo desde la app o con exportación previa |
| `backups/` | Copias verificables | Las antiguas, desde la app o el explorador |
| `exports/` | Exportaciones ZIP/JSON generadas por el usuario | Sí |
| `logs/` | Logs locales rotativos, sin contenido por defecto | Sí |
| `config.json` | Ventana, tema, idioma y preferencias | Se regenera con valores por defecto |

La app ofrece desde Ajustes «Abrir carpeta de datos», «Abrir copias» y «Abrir
logs». Esas acciones abren el explorador de Windows; no exponen rutas al
renderer.

## 3. SQLite

### 3.1 Motor y configuración

- **better-sqlite3** en el proceso principal; ninguna consulta desde el
  renderer.
- **WAL** (`PRAGMA journal_mode = WAL`) para lecturas concurrentes y menos
  bloqueos.
- `PRAGMA synchronous = NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000`.
- `PRAGMA integrity_check` al arrancar; si falla, modo seguro y restauración
  guiada.
- Timestamps en milisegundos UTC; la interfaz muestra la zona local.
- IDs UUIDv7 generados en el proceso principal.

### 3.2 Acceso

El proceso principal abre una única conexión y la comparte entre los casos de
uso. Las operaciones largas (exportación, importación y copias) se ejecutan en
un **utility process** para no bloquear la interfaz. Las migraciones se
ejecutan al arrancar, antes de mostrar datos, dentro de una transacción y con
copia previa.

### 3.3 Búsqueda

FTS5 con tokenizador `unicode61`, prefijos y una tabla virtual
`search_fts(title, body)` sincronizada por triggers sobre `search_documents`.
La aplicación reconstruye los documentos cuando cambia una entidad, un mapa,
una escena o una tabla de juego. Si FTS5 no está disponible en el binario de
SQLite empaquetado, la app degrada a búsqueda `LIKE` y lo registra; el binario
de better-sqlite3 se compila con FTS5 habilitado.

## 4. Assets

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
- Se ejecutan en una transacción y con una copia previa en
  `backups/pre-migration/`.
- La versión del esquema se guarda en `PRAGMA user_version` y en la tabla
  `schema_migrations`.
- Si una migración falla, se revierte la transacción, se conserva la copia y la
  app arranca en **modo seguro**: no escribe, permite exportar y restaurar.
- Cada migración incluye una prueba sobre una base temporal y una prueba de
  preservación de datos.
- El detalle está en [`docs/base-de-datos/migraciones.md`](base-de-datos/migraciones.md).

## 6. Copias de seguridad

| Tipo | Frecuencia | Retención | Contenido |
|---|---|---|---|
| Diaria | Una al día, al cerrar o al arrancar | 7 | SQLite + manifiesto |
| Semanal | Una a la semana | 4 | SQLite + manifiesto |
| Mensual | Una al mes | 12 | SQLite + manifiesto |
| Pre-migración | Antes de cada migración | Hasta la siguiente migración estable | SQLite |
| Manual | Cuando el usuario lo pide | La decide el usuario | SQLite + assets opcionales |

- Formato: carpeta o ZIP con `world-craft.sqlite`, un `manifest.json` (versión
  de esquema, fecha, tamaño y SHA-256) y, si se elige «copia completa», los
  assets.
- Verificación: se abre la copia en una conexión de solo lectura y se ejecuta
  `PRAGMA integrity_check`; si falla, la copia se marca como no válida.
- Rotación: se eliminan las copias más antiguas del grupo correspondiente, no
  las pre-migración ni las manuales.
- Ubicación por defecto: `backups/`. El usuario puede elegir otra carpeta,
  incluida una unidad externa, desde Ajustes.
- Las copias son locales; no se suben a ningún servicio.

## 7. Restauración

1. El usuario elige una copia desde Ajustes → Copias.
2. La app verifica el manifiesto y la integridad antes de ofrecer restaurar.
3. Antes de reemplazar nada, crea una copia de seguridad de la base actual en
   `backups/pre-restore/`.
4. Cierra la conexión, sustituye la base y reabre; si el reemplazo falla,
   restaura la base anterior y muestra el error.
5. Tras restaurar, ejecuta las migraciones pendientes con copia previa.
6. Los assets no se sustituyen salvo que la copia sea completa y el usuario lo
   confirme; las referencias huérfanas se listan en el informe.

La restauración exige confirmación explícita y nunca se hace en segundo plano.

## 8. Exportación e importación

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

- El instalador NSIS escribe en `%LOCALAPPDATA%\Programs\World Craft` y no toca
  `%APPDATA%\World Craft`.
- El desinstalador elimina binarios y accesos directos; conserva `userData` y
  lo indica al terminar.
- La primera ejecución tras una actualización comprueba la versión del esquema,
  crea copia si hay migraciones y las aplica.
- Una prueba automatizada instala/actualiza/desinstala en un entorno temporal y
  verifica que la base y los assets siguen intactos.

## 10. Logs y diagnóstico

- Logs rotativos en `logs/`, con nivel configurable.
- Por defecto no incluyen contenido del usuario, rutas completas ni datos
  personales; los errores usan códigos estables.
- El usuario puede exportar un diagnóstico local (versión, sistema, estado de
  la base, últimas líneas de log) y revisarlo antes de compartirlo.
- No hay envío automático de diagnósticos.

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
