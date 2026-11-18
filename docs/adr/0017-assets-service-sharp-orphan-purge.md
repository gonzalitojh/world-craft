# ADR 0017 — Servicio de assets locales: sharp, miniatura y purga recuperable

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-19
- **Issue:** #66
- **Decisiones del registro:** D-022
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0005, ADR 0012, ADR 0016

## Contexto

El ADR 0005 fija el «qué» de los assets locales: archivos bajo `userData`,
rutas relativas en SQLite, protocolo propio `wc-asset://`, imágenes
re-codificadas a WebP con miniatura y purga de huérfanos solo con confirmación.
La issue #66 implementa ese diseño en M0 y obliga a decidir lo que el ADR 0005
no concreta: la dependencia de imagen y sus licencias, el orden entre archivo y
fila, la forma real de la tabla `assets`, la miniatura derivada, los límites y
el procedimiento de purga recuperable.

## Decisión

1. **Servicio puro en `src/main/assets/`.** Importación, metadatos, huérfanos,
   purga, validación de rutas y protocolo viven en módulos sin Electron. La
   composición con `protocol`, `userData` y la conexión compartida está en
   `composition.ts`; así el servicio se prueba sin arrancar Electron.
2. **sharp 0.35.5 como dependencia de ejecución.** Se elige sharp por su
   decodificador libvips y sus binarios precompilados para Windows sin scripts
   de instalación. Se externaliza en `electron.vite.config.ts` junto a
   `better-sqlite3`, `drizzle-orm` y `@img/*`; `pnpm verify:native` comprueba
   que carga y genera un WebP en Node y Electron. Licencias: sharp Apache-2.0,
   `@img/sharp-*` Apache-2.0 AND LGPL-3.0-or-later y libvips LGPL-3.0-or-later,
   documentadas en `THIRD-PARTY-NOTICES.md` y en el propio repositorio. #68 debe
   desempaquetar sharp del asar e incluir los textos completos de las licencias
   en el instalador.
3. **Importación validada por contenido.** El formato se decide por magic bytes
   (PNG, JPEG, WebP, GIF y AVIF); SVG, BMP, TIFF y cualquier otro contenido se
   rechazan antes de decodificar. Los límites son 25 MB por archivo, 8192 px por
   lado y 24 Mpx totales, comprobados antes de leer y otra vez sobre las
   dimensiones reales tras orientar EXIF. La imagen se convierte a sRGB, se
   re-codifica a WebP calidad 90 y genera una miniatura de 320 px de lado como
   máximo, calidad 80 y sin metadatos. El SHA-256 se calcula sobre el WebP
   publicado, no sobre el original.
4. **Orden archivo → fila con compensación.** El WebP y la miniatura se
   escriben en `assets/.tmp/<assetId>/` y se publican con `rename` en
   `assets/worlds/<worldId>/<assetId>.webp` y `…/<assetId>.thumb.webp`; después
   se inserta la fila. Si el `INSERT` falla, se borran los archivos publicados y
   la carpeta temporal. Se prefiere este orden a insertar primero porque una
   fila sin archivo es un fallo visible en cada lectura, mientras que un archivo
   sin fila se clasifica como huérfano y la purga lo puede recuperar.
5. **Tabla `assets` con restricciones reales.** `id`, `world_id`, `kind`,
   `relative_path`, `mime`, `size`, `width`, `height`, `alt`, `hash` y
   `created_at`, con `CHECK` de `kind` (`image`, `map`, `document`, `other`),
   `size >= 0` y `hash` de 64 caracteres hexadecimales, e índices
   `assets_world_idx (world_id)` y `assets_hash_idx (hash)`. En M0 solo se
   importa `kind = 'image'`. La clave foránea `world_id → worlds(id)` se difiere
   a M1 porque `worlds` todavía no existe: esa migración reconstruirá la tabla
   con `ON DELETE RESTRICT` y pondrá en cuarentena las filas sin mundo antes de
   añadir la restricción.
6. **Protocolo `wc-asset://` con gramática cerrada.** Solo
   `wc-asset://asset/<uuidv7>` y `wc-asset://thumb/<uuidv7>`. El ID es la única
   entrada: la ruta relativa sale de SQLite y debe coincidir con el ID y el
   mundo de la fila. Se admite únicamente `worlds/<uuid>/<uuid>.webp` y
   `…/<uuid>.thumb.webp`; se rechazan `..`, rutas absolutas, UNC, NUL, barra
   invertida, mayúsculas y UUID que no sean v7. La contención se comprueba con
   `lstat` sin seguir enlaces y `realpath` para detectar junctions de Windows.
   Se sirve solo `image/webp` con `nosniff`, `Content-Length`,
   `Cache-Control: private, max-age=31536000, immutable` y
   `Content-Security-Policy: default-src 'none'`. Códigos estables: 400, 403,
   404, 413, 415 y 500. El esquema se registra como `standard`, `secure` y
   `stream`, con `bypassCSP:false`, antes de `app.whenReady`; el handler se
   instala solo si el arranque de la base termina en `ready` y no se registra en
   modo seguro.
7. **Miniatura derivada, no registrada.** La tabla guarda solo el archivo
   principal; el protocolo deriva `.thumb.webp` desde `relative_path`. Evita
   filas duplicadas, referencias cruzadas y una purga con dos ciclos de vida.
8. **Purga recuperable.** `planOrphanCleanup` es de solo lectura y clasifica
   `unreferencedFiles`, `orphanThumbnails`, `missingFiles`, `temporaryFiles`,
   `unexpectedEntries` y `suspiciousLinks` sin seguir enlaces. `purgeOrphans`
   exige el token `purge-orphans`, se serializa con la importación en un mutex,
   recalcula el plan dentro del turno, revalida cada padre y archivo antes de
   copiar y antes de borrar, copia a `backups/orphans/<timestamp>/assets/`,
   verifica tamaño y SHA-256, escribe un manifiesto con
   `recovery: "restore-files-from-this-backup"` y solo entonces borra. Nunca
   toca archivos referenciados, entradas inesperadas ni enlaces.
9. **Sin deduplicación ni IPC en M0.** Dos importaciones del mismo contenido son
   dos filas con IDs distintos y dos pares de archivos. No hay canal IPC nuevo:
   la UI de subida y galería llega con las fichas (M1), y con ella el contrato
   `assets:import`, `assets:list` y `assets:purgeOrphans` con confirmación
   explícita. Los residuales de seguridad de la sección siguiente deben cerrarse
   antes de exponer esos canales.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Guardar el original y servirlo sin re-codificar | El MIME, el tamaño y los metadatos quedarían fuera de control; la miniatura y el límite por píxeles no se podrían garantizar. |
| Detectar el formato por extensión o por `Content-Type` declarado | Trivial de falsificar; se decidió por magic bytes y rechazo de SVG. |
| Guardar la miniatura como fila propia de `assets` | Duplica metadatos, complica las referencias y obliga a una purga con dos ciclos de vida; se deriva del archivo principal. |
| Insertar la fila antes de publicar los archivos | Deja filas apuntando a archivos inexistentes hasta que falle la escritura; el orden archivo → fila con compensación deja un huérfano recuperable en el peor caso. |
| sharp frente a Jimp o un binario externo de ImageMagick | sharp ofrece libvips precompilado, buen rendimiento y licencias permisivas/LGPL compatibles; las alternativas o son más lentas o exigen binarios y scripts de instalación adicionales. |
| Copiar huérfanos solo con una lista y borrar sin verificar | Una purga interrumpida sería irreversible; se exige copia con SHA-256 y manifiesto antes del primer borrado. |
| Añadir la FK `world_id` en `0001_assets` | `worlds` no existe todavía; la FK se difiere a la migración de M1 con reconstrucción y cuarentena. |
| Deduplicar por hash desde M0 | Complica el borrado, la cuarentena y la purga cuando dos fichas comparten el mismo archivo; se revisa en M1 con el resto del dominio. |

## Consecuencias

### Positivas

- El renderer solo ve `wc-asset://` con un ID; nunca rutas absolutas ni
  `file://`.
- Todos los archivos servidos son WebP acotados, orientados y sin metadatos
  EXIF/GPS.
- La importación no deja filas sin archivo y la purga no deja borrados
  irrecuperables.
- El servicio se prueba sin Electron y sin la UI, lo que permite cerrar la
  seguridad de rutas antes de M1.
- El coste sigue siendo 0 €/mes y el producto funciona sin conexión.

### Negativas y riesgos

- La re-codificación consume CPU en importaciones grandes y el WebP pierde el
  original; el archivo servido no es una copia del que eligió el usuario.
- sharp añade un binario nativo grande al paquete y una obligación de avisos y
  licencias que #68 debe completar.
- Quedan ventanas TOCTOU de escritura y de lectura que no se cierran del todo
  sin handles de directorio y borrado relativo al handle.
- La FK de `world_id` no existe hasta M1: la integridad referencial de assets se
  garantiza en el servicio, no en SQLite.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Sin UI nueva en M0; el protocolo sirve a `<img>` cuando las fichas lleguen en M1. |
| Temas (Claro/Oscuro) | No aplica: no hay elementos visuales nuevos; los placeholders usarán tokens en M1. |
| Accesibilidad | El servicio conserva `alt` (máximo 500 caracteres) para que la UI lo use como texto alternativo. |
| Seguridad y privacidad | Gramática cerrada, ruta desde SQLite, `lstat`/`realpath`, MIME único, CSP de respuesta, logs sin rutas ni IDs y sin red. |
| Datos y preservación | Archivos fuera de `userData` no se tocan; la purga exige copia verificada y la migración es aditiva. |
| Coste | 0 €/mes: sharp y libvips son open source y no hay servicios ni telemetría. |
| Portabilidad de datos | Rutas relativas y metadatos en SQLite; la exportación con `assets/` sigue prevista para M1. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Servicio de imagen de pago | No aplica: sharp y libvips son open source y locales | Sin cuentas, sin subida y sin cuotas | — |
| Cumplimiento LGPL de libvips | El binario se distribuye sin modificar | `THIRD-PARTY-NOTICES.md`, avisos por paquete y textos completos en el instalador | #68 |
| Tamaño del instalador por el binario nativo | sharp añade binarios de plataforma al paquete | Externalización, `asarUnpack` y verificación en Node y Electron | #68 |
| Dependencia de un prebuild de sharp | Si falta el binario de Windows, la importación falla | `pnpm verify:native` en Node y Electron; contingencia de reconstrucción | #68 y CI |
| Telemetría o red implícita | No aplica: sharp no hace red | Sin claves, sin servicios y sin envío de datos | Revisión de seguridad |

## Riesgos residuales aceptados

Estos límites están documentados y no bloquean M0 porque no hay IPC que los
alcance; deben revisarse al abrir la importación y la purga en M1.

- **Escritura temporal:** entre la validación de `assets/.tmp/<assetId>` y los
  `writeFile`, un atacante local con escritura en `userData` podría sustituir la
  carpeta por una junction. Se revalida antes de cada `rename` y se limpia el
  temporal.
- **Lectura del protocolo:** entre `lstat`/`realpath` y `readFile` el archivo
  podría cambiar; además el contenido servido no se compara con `assets.hash`.
  Solo permite leer archivos del propio usuario y la respuesta va con `nosniff`
  y CSP `default-src 'none'`.
- **Raíces creadas antes de validar:** `ensureDataDirectories` crea `assets/`,
  `worlds/`, `.tmp/` y `backups/orphans/` antes de comprobar que son directorios
  reales; una junction preexistente haría crear carpetas vacías fuera de
  `userData`. No es alcanzable sin IPC en M0.
- **Copia de huérfanos:** `backups/orphans` no se inspecciona con
  `lstat`/`realpath` antes de copiar; debe validarse antes de habilitar
  `assets:purgeOrphans`.
- **Symlinks de archivo en Windows:** las pruebas de symlink se omiten sin modo
  desarrollador (EPERM); las junctions sí se prueban y la lógica es común. La CI
  en Linux o el modo desarrollador deben cubrirlas.
- **Avisos de terceros:** `THIRD-PARTY-NOTICES.md` remite a las licencias de
  `node_modules`; #68 debe incluir los textos completos en el instalador.

## Plan de revisión

Se revisa al abrir la importación y la purga por IPC en M1, con la migración que
reconstruye `assets` para añadir la FK y con la posible deduplicación por hash.
También se reabre si cambia el formato servible, si sharp o libvips cambian de
licencia o de prebuild, y antes de #68 para cerrar el empaquetado y los avisos.
Cualquier cambio de protocolo, formato o límites exige un ADR nuevo.

## Referencias

- Issue: #66
- [`docs/adr/0005-local-assets-custom-protocol.md`](0005-local-assets-custom-protocol.md), decisión original
- [`docs/persistencia.md`](../persistencia.md), assets y copias
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), tabla `assets`
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md), migración `0001_assets`
- [`docs/arquitectura.md`](../arquitectura.md), módulo y protocolo
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), pruebas de assets
- [`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md), licencias de sharp y libvips
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-022
- Documentación de sharp y libvips consultada el 19/11/2026.
