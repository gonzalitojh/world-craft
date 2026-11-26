# Formato de exportación de un mundo

> **Estado:** implementado en #78 (M1-07) para el formato
> `world-craft-world` **versión 1** y en #79 (M1-08) para la biblioteca
> `world-craft-library` **versión 1**. La exportación y la importación de mundos
> usan el mismo contrato; el detalle de las decisiones está en el
> [ADR 0029](adr/0029-world-export-import.md) (D-052) y en el
> [ADR 0030](adr/0030-settings-data-and-full-deletion.md) (D-053) del
> [registro](registro-decisiones.md).
> **Ámbito:** estructura del ZIP de mundo y de la biblioteca total, campos de
> `manifest.json`, `world.json` y `settings.json`, checksums, compatibilidad,
> exclusiones y política de importación.

## 1. Qué es

Un archivo de mundo es un **ZIP abierto y legible** que contiene un mundo
completo: sus fichas, tipos personalizados, etiquetas, relaciones, versiones de
la descripción e imágenes. Se puede inspeccionar con cualquier herramienta de
ZIP y con un editor de texto; no hace falta World Craft para leer los JSON.

La exportación incluye **siempre los assets**. La importación **siempre crea un
mundo nuevo** y nunca modifica los mundos existentes.

Además del archivo de un mundo, Ajustes → Datos ofrece **Exportar todos los
datos**, que genera una **biblioteca** `world-craft-library` v1: un ZIP con un
paquete de mundo por cada mundo vivo, un `settings.json` y una copia completa de
SQLite. Se documenta en la sección 11 de este archivo.

## 2. Estructura del ZIP

El ZIP contiene exactamente estas entradas, sin directorios, sin miniaturas y
sin archivos desconocidos:

```text
manifest.json
world.json
assets/<uuidv7>.webp
assets/<uuidv7>.webp
...
```

| Entrada | Obligatoria | Contenido |
|---|---|---|
| `manifest.json` | Sí, exactamente una | Identidad del formato, versión, mundo de origen, recuentos, avisos y lista de archivos con tamaño y SHA-256. |
| `world.json` | Sí, exactamente una | Mundo, tipos, etiquetas, assets, fichas con versiones y relaciones. |
| `assets/<uuidv7>.webp` | Una por asset referenciado | Imagen canónica en WebP. El nombre es el UUIDv7 del asset y la extensión es siempre `.webp`. |

### 2.1 Política de nombres

La importación aplica una lista blanca cerrada. Se rechaza el ZIP completo
(`TRANSFER_ENTRY_REJECTED`) si una entrada:

- tiene una ruta distinta de `manifest.json`, `world.json` o
  `assets/<uuidv7>.webp`;
- contiene `\`, `:`, NUL, una letra de unidad, una ruta absoluta, un segmento
  `.` o `..`, un nombre reservado de Windows (`CON`, `NUL`, `COM1`…) o termina
  en `/`;
- usa mayúsculas (`Assets/…` no es válido);
- es un directorio, un enlace simbólico, una entrada cifrada o una compresión
  no admitida;
- repite otra ruta sin distinguir mayúsculas;
- supera los **140 caracteres** de ruta.

El lector exige exactamente un manifiesto y un `world.json`, y como máximo
8.000 assets. El manifiesto no se incluye a sí mismo en `files`.

## 3. `manifest.json`

Es la única fuente de verdad sobre los archivos del paquete. El esquema Zod es
**estricto**: un campo desconocido, un checksum mal formado, una ruta fuera de
la política o un recuento incoherente invalidan el paquete entero.

### 3.1 Campos

| Campo | Tipo | Regla |
|---|---|---|
| `format` | string | Literal `world-craft-world`. |
| `formatVersion` | number | Literal `1` en esta versión. |
| `schemaVersion` | number | `PRAGMA user_version` de la base de origen (hoy **8**); entero ≥ 1. Si supera el `user_version` instalado, la importación lo rechaza con `TRANSFER_FORMAT_UNSUPPORTED` antes de leer `world.json` o extraer assets. |
| `appVersion` | string | Versión de World Craft que exportó, de 1 a 40 caracteres. |
| `exportedAt` | string | Fecha ISO 8601 en UTC, de 20 a 40 caracteres y parseable. |
| `assetsIncluded` | boolean | Siempre `true` en v1. |
| `world.sourceId` | UUIDv7 | ID del mundo en la instalación de origen. Es informativo: la importación genera uno nuevo. |
| `world.name` | string | Nombre del mundo, 1–120 caracteres; debe coincidir con `world.json`. |
| `world.slug` | string | Slug del mundo, 1–80 caracteres; debe coincidir con `world.json`. |
| `counts` | objeto | `entities`, `entityTypes`, `relationTypes`, `tags`, `relations`, `versions` y `assets`, enteros ≥ 0. Deben coincidir con `world.json`. |
| `files` | array | Uno o más archivos; no incluye el propio manifiesto. |
| `warnings` | array | Avisos agregados del saneado; sin códigos repetidos. Puede estar vacío. |

### 3.2 `files`

Cada elemento tiene **exactamente** tres campos:

| Campo | Tipo | Regla |
|---|---|---|
| `path` | string | `world.json` o `assets/<uuidv7>.webp`; 1–140 caracteres. |
| `size` | number | Bytes descomprimidos, entero ≥ 0. |
| `sha256` | string | 64 caracteres hexadecimales en minúsculas. |

El conjunto real de entradas del ZIP debe coincidir **exactamente** con
`files`: ni archivos de más ni de menos, y con el mismo tamaño declarado. Cada
asset de `world.json` debe tener su archivo en `files`.

Los metadatos de imagen (`assetId`, `kind`, `mime`, `width`, `height`, `alt` y
`createdAt`) **no se duplican en `files`**: viven en el bloque `assets` de
`world.json`, y el manifiesto solo lleva la ruta, el tamaño y el hash de cada
archivo. Los recuentos están en `manifest.counts`, no dentro del bloque `world`.

### 3.3 `warnings`

Cada aviso tiene `code` y `count` (entero ≥ 1). Los códigos son una lista
cerrada:

| Código | Significado |
|---|---|
| `broken-entity-link` | Enlace interno a una ficha que no existe en el paquete. |
| `broken-reference-attribute` | Campo de referencia a una ficha ausente. |
| `broken-gallery-asset` | Imagen de galería que no está en el paquete. |
| `missing-entity-image` | Imagen principal ausente. |
| `missing-world-cover` | Portada del mundo ausente. |
| `missing-entity-type` | Ficha cuyo tipo personalizado no está en el paquete. |
| `missing-relation-type` | Relación con un tipo que no está en el paquete. |
| `missing-tag` | Etiqueta de una ficha que no está en el paquete. |
| `broken-relation-endpoint` | Relación con un extremo ausente. |
| `duplicate-relation` | Relación repetida o autorreferencia. |
| `unknown-version-origin` | Origen de versión desconocido, normalizado a `auto`. |
| `invalid-attribute` | Valor de campo que no encaja en la plantilla. |
| `invalid-version` | Versión con una descripción ilegible. |

Los avisos nunca incluyen rutas, IDs, nombres ni contenido.

### 3.4 Ejemplo ficticio

Ejemplo abreviado y válido de forma. Los checksums son de relleno; un archivo
real debe contener el SHA-256 verdadero de sus bytes descomprimidos.

```json
{
  "format": "world-craft-world",
  "formatVersion": 1,
  "schemaVersion": 8,
  "appVersion": "0.1.0",
  "exportedAt": "2026-11-25T10:00:00.000Z",
  "assetsIncluded": true,
  "world": {
    "sourceId": "0193b4c2-7d1e-7a2b-8c3d-4e5f60718293",
    "name": "Crónica de las Mareas",
    "slug": "cronica-de-las-mareas"
  },
  "counts": {
    "entities": 2,
    "entityTypes": 1,
    "relationTypes": 1,
    "tags": 1,
    "relations": 1,
    "versions": 1,
    "assets": 1
  },
  "files": [
    {
      "path": "world.json",
      "size": 2500,
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    },
    {
      "path": "assets/0193b4c2-7d20-7e4f-a5b6-1728394a5b6c.webp",
      "size": 1024,
      "sha256": "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
    }
  ],
  "warnings": []
}
```

## 4. `world.json`

Contiene únicamente contenido vivo e implementado. El esquema es estricto y
rechaza campos desconocidos. Los recuentos del manifiesto deben coincidir con
este archivo y el nombre y el slug del mundo deben ser los mismos.

### 4.1 Bloques

| Bloque | Contenido |
|---|---|
| `format` / `formatVersion` | Literales `world-craft-world` y `1`. |
| `world` | `name`, `slug`, `summary`, `description`, `genres` (máx. 8), `language` (`es`, `en` o `it`), `createdAt`, `updatedAt`. **No** incluye estado de archivo. |
| `entityTypes` | `{ "version": 1, "types": [...] }` con los tipos **personalizados** (`entity-types.v1`). Los 18 del sistema son implícitos. |
| `relationTypes` | `{ "version": 1, "types": [...] }` con los tipos de relación **personalizados** (`relation-types.v1`). Los 18 del sistema son implícitos. |
| `tags` | Etiquetas del mundo: `name`, `color`, `createdAt`. |
| `assets` | Metadatos de los assets referenciados: `id`, `alt` (hasta 500 caracteres o `null`), `width` y `height` (enteros ≥ 1 o `null`) y `createdAt`. El archivo está en `assets/<id>.webp`. |
| `entities` | Fichas vivas con `id`, `typeKey`, `name`, `slug`, `aliases`, `summary`, `description`, `attributes`, `status`, `isFavorite`, `imageAssetId`, `gallery`, `tagNames`, `createdAt`, `updatedAt` y `versions`. |
| `relations` | Relaciones entre fichas vivas: `sourceId`, `targetId`, `typeKey`, `label`, `inverseLabel`, `notes`, `strength` (1–5), `metadata`, `createdAt`, `updatedAt`. |
| `coverAssetId` | Asset de portada o `null`. |

### 4.2 Tipos personalizados

Un tipo de entidad personalizado tiene `key`, `name`, `icon`, `color` y
`fields`. `color` es uno de `moss`, `ochre`, `danger` o `prussian`; `icon` es
una de las claves del catálogo (`compass`, `crown`, `sparkles`…). Una plantilla
de campos vacía es válida.

Cada campo tiene `key`, `label`, `type` y `required`; según el tipo añade:

| `type` | Campos adicionales |
|---|---|
| `text` | `maxLength` opcional. |
| `number` | `min` y `max` opcionales. |
| `date` | — |
| `select` | `options` con `value` y `label`; al menos una. |
| `reference` | `targetTypeKey` opcional. |

Un tipo personalizado no puede usar una clave del sistema. Una relación
personalizada tiene `key`, `name`, `inverseName` y `color`, y tampoco puede usar
una clave del sistema.

### 4.3 Fichas, versiones y galería

- `status` es `active`, `draft` o `archived`.
- `attributes` es un objeto de valores de texto o número, validado contra la
  plantilla del tipo.
- `description` es un documento de ProseMirror o `null`. La lista de nodos y
  marcas es cerrada: párrafos, títulos 1–3, listas, cita, texto, salto y enlaces
  internos `wc-entity://<uuidv7>`. No hay HTML.
- `gallery` es una lista ordenada de `{ "assetId": "<uuidv7>" }`, sin repetir y
  con un máximo de 20.
- `tagNames` contiene nombres de etiqueta del mundo, sin repetir y con un máximo
  de 12.
- `versions` contiene el historial de la descripción: `description`, `label`
  (1–120 o `null`), `origin` (`auto`, `manual` o `restore`) y `createdAt`.
- `aliases` admite hasta 10 valores.

### 4.4 Ejemplo ficticio

El ejemplo es un mundo pequeño completo: dos fichas, un tipo personalizado, un
tipo de relación, una etiqueta, un asset, una versión y una relación.

```json
{
  "format": "world-craft-world",
  "formatVersion": 1,
  "world": {
    "name": "Crónica de las Mareas",
    "slug": "cronica-de-las-mareas",
    "summary": "Un archipiélago de mareas grises.",
    "description": null,
    "genres": ["Fantasía", "Aventura"],
    "language": "es",
    "createdAt": 1760000000000,
    "updatedAt": 1760100000000
  },
  "entityTypes": {
    "version": 1,
    "types": [
      {
        "key": "navegante",
        "name": "Navegante",
        "icon": "compass",
        "color": "prussian",
        "fields": [
          {
            "key": "rango",
            "label": "Rango",
            "type": "text",
            "required": false,
            "maxLength": 80
          }
        ]
      }
    ]
  },
  "relationTypes": {
    "version": 1,
    "types": [
      {
        "key": "mentor-of",
        "name": "Mentor de",
        "inverseName": "Aprendiz de",
        "color": "moss"
      }
    ]
  },
  "tags": [
    {
      "name": "Navegante",
      "color": "moss",
      "createdAt": 1760000000000
    }
  ],
  "assets": [
    {
      "id": "0193b4c2-7d20-7e4f-a5b6-1728394a5b6c",
      "alt": "Retrato de Aria",
      "width": 800,
      "height": 1000,
      "createdAt": 1760000000000
    }
  ],
  "entities": [
    {
      "id": "0193b4c2-7d21-7b3c-8d4e-5f60718293a4",
      "typeKey": "navegante",
      "name": "Aria",
      "slug": "aria",
      "aliases": [],
      "summary": "Capitana del faro.",
      "description": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              { "type": "text", "text": "Capitana del faro de las mareas." }
            ]
          }
        ]
      },
      "attributes": { "rango": "Capitana" },
      "status": "active",
      "isFavorite": true,
      "imageAssetId": "0193b4c2-7d20-7e4f-a5b6-1728394a5b6c",
      "gallery": [
        { "assetId": "0193b4c2-7d20-7e4f-a5b6-1728394a5b6c" }
      ],
      "tagNames": ["Navegante"],
      "createdAt": 1760000000000,
      "updatedAt": 1760100000000,
      "versions": [
        {
          "description": null,
          "label": "Retrato inicial",
          "origin": "manual",
          "createdAt": 1760050000000
        }
      ]
    },
    {
      "id": "0193b4c2-7d22-7c4d-9e5f-60718293a4b5",
      "typeKey": "navegante",
      "name": "Bren",
      "slug": "bren",
      "aliases": [],
      "summary": null,
      "description": null,
      "attributes": { "rango": "Grumete" },
      "status": "draft",
      "isFavorite": false,
      "imageAssetId": null,
      "gallery": [],
      "tagNames": [],
      "createdAt": 1760010000000,
      "updatedAt": 1760010000000,
      "versions": []
    }
  ],
  "relations": [
    {
      "sourceId": "0193b4c2-7d21-7b3c-8d4e-5f60718293a4",
      "targetId": "0193b4c2-7d22-7c4d-9e5f-60718293a4b5",
      "typeKey": "mentor-of",
      "label": null,
      "inverseLabel": null,
      "notes": "Formada en el faro.",
      "strength": 4,
      "metadata": {},
      "createdAt": 1760060000000,
      "updatedAt": 1760060000000
    }
  ],
  "coverAssetId": "0193b4c2-7d20-7e4f-a5b6-1728394a5b6c"
}
```

## 5. Checksums

- Cada `sha256` del manifiesto es el SHA-256 de los **bytes descomprimidos** de
  la entrada, no del archivo comprimido.
- La importación comprueba tamaño y SHA-256 de `world.json` antes de parsearlo y
  de cada asset antes de procesarlo. Si no coinciden, falla con
  `TRANSFER_CHECKSUM_MISMATCH` y no toca los datos existentes. El CRC del
  contenedor ZIP no se usa como garantía: la comprobación fuerte es el SHA-256.
  Un archivo truncado o ilegible se rechaza antes de extraer.
- La exportación verifica el ZIP recién escrito: vuelve a leer el manifiesto,
  `world.json` y cada asset, y compara tamaño y SHA-256 antes de publicar el
  archivo con `rename`.

## 6. Inspección sin World Craft

Un ZIP de mundo se puede abrir con el Explorador de Windows o con PowerShell.
Los ejemplos usan rutas ficticias.

```powershell
# 1. Extraer el ZIP en una carpeta de trabajo.
Expand-Archive -LiteralPath 'C:\datos\cronica-de-las-mareas.zip' `
  -DestinationPath 'C:\datos\cronica-inspeccion'

# 2. Leer el manifiesto como objeto.
Get-Content -LiteralPath 'C:\datos\cronica-inspeccion\manifest.json' -Raw |
  ConvertFrom-Json

# 3. Leer el contenido del mundo como objeto.
Get-Content -LiteralPath 'C:\datos\cronica-inspeccion\world.json' -Raw |
  ConvertFrom-Json

# 4. Calcular el SHA-256 de un archivo descomprimido.
Get-FileHash -Algorithm SHA256 `
  -LiteralPath 'C:\datos\cronica-inspeccion\world.json'
```

Compara el valor de `Get-FileHash` con el `sha256` de `files` para
`world.json`. Repite el cálculo con cada archivo de `assets/`. `Expand-Archive`
no valida checksums: solo sirve para inspeccionar. No ejecutes la aplicación
sobre una carpeta extraída ni muevas archivos a `assets/worlds` a mano.

## 7. Compatibilidad y evolución

- **`formatVersion` superior a 1:** se rechaza con
  `TRANSFER_FORMAT_UNSUPPORTED` antes del parse estricto, para invitar a
  actualizar World Craft.
- **`formatVersion` distinto de 1 pero no futuro** (por ejemplo `0`): el Zod
  estricto lo rechaza como manifiesto o mundo inválido.
- **`schemaVersion` superior al de la aplicación:** se rechaza con
  `TRANSFER_FORMAT_UNSUPPORTED` después de validar el manifiesto y antes de leer
  `world.json` o extraer assets. La versión instalada se compara con la del
  manifiesto; los valores iguales o anteriores se aceptan y su contenido se
  valida con Zod estricto. Un cambio de esquema que altere el contenido exigirá
  además un `formatVersion` nuevo.
- **Campos desconocidos:** se rechazan. No hay campos opcionales fuera de los
  documentados.
- **Bloques futuros:** mapas, manuscritos, escenas y juego no existen en v1 y no
  se aceptan aunque estén vacíos.
- **Un mundo archivado** puede exportarse, pero el formato no guarda su estado:
  al importarlo queda activo.

## 8. Qué se excluye

| Excluido | Motivo |
|---|---|
| Papelera y contenido purgado | Solo viaja contenido vivo de mundos vivos; lo purgado ya no existe. |
| `activity_log` | Historial local de la instalación, no contenido del mundo. |
| Índice FTS5 y `search_documents` | Es reconstruible; los triggers lo repueblan al importar. |
| Preferencias de aplicación (`app_settings`, claves `ui.*`) | Son de la aplicación, no del mundo. |
| Miniaturas `.thumb.webp` | Se regeneran al importar con los límites del servicio de assets. |
| Assets no referenciados | Solo viajan portada, imágenes principales y galería. |
| IDs internos de los tipos del sistema | Los 18 tipos de entidad y los 18 de relación se resuelven por clave. |
| `description_text` | Se recalcula en la importación a partir de la descripción. |
| `relative_path` | La ruta canónica se reconstruye con el nuevo `worldId` y el nuevo `assetId`. |
| Fechas de borrado o archivo (`deleted_at`, `archived_at`) | El paquete solo contiene filas vivas y el mundo importado queda activo. |
| Rutas del sistema y estado de archivo | No se exponen rutas ni estados de la instalación. |
| Mapas, manuscritos, escenas y juego | No están implementados en el MVP; no se añaden bloques vacíos. |
| Preferencias de ventana, tema o idioma | Son de la aplicación y viven en `app_settings`. |

## 9. Política de importación

1. **Siempre un mundo nuevo.** No se fusiona ni se sobrescribe nada. Los IDs
   internos se regeneran: mundo, tipos personalizados, tipos de relación,
   etiquetas, assets, fichas, versiones, relaciones y la fila de actividad.
2. **Referencias remapeadas.** Enlaces `wc-entity://`, campos `reference`,
   galería, imagen principal, portada y relaciones se reescriben con el mapa de
   IDs. Las etiquetas se resuelven por nombre exacto (las mayúsculas importan) y
   los tipos del sistema por clave.
3. **Slug global.** El slug del mundo se conserva si está libre. Si ya existe en
   cualquier estado, se prueba `-2`, `-3`… hasta `-9999`, recortando la base si
   hace falta para no superar 80 caracteres. El resultado indica
   `slugAdjusted`.
4. **Saneo con avisos.** Una referencia rota se elimina y se cuenta. Una ficha
   sin tipo personalizado se descarta; sus relaciones también. Una relación sin
   extremo, con tipo ausente, autorreferente o duplicada se descarta. Un atributo
   inválido se quita; un campo obligatorio ausente no se inventa.
5. **Fechas y estado.** El mundo, los tipos personalizados y los tipos de
   relación usan la fecha de importación; las fichas, etiquetas, versiones,
   assets y relaciones conservan sus fechas originales. El mundo queda `active` y
   la actividad registra `world.imported`.
6. **Un mundo a la vez.** Solo hay una operación activa. La importación se
   prepara en `imports/.tmp/<operationId>` y los assets en
   `assets/.tmp/<operationId>/<worldId>`; la transacción y el renombrado ocurren
   juntos. Cancelar antes de `saving` limpia todo; durante `saving` ya no se
   puede cancelar.
7. **Sin copia previa.** La operación solo añade y es transaccional. Los mundos,
   fichas, imágenes, relaciones, copias y `schema_migrations` existentes no se
   tocan.

## 10. Límites

| Límite | Valor |
|---|---|
| ZIP comprimido | 8 GiB |
| Contenido descomprimido | 16 GiB |
| Entradas del ZIP | 10.000 |
| `world.json` | 256 MiB |
| `manifest.json` | 16 MiB |
| Fichas | 50.000 |
| Versiones | 500.000 |
| Relaciones | 300.000 |
| Etiquetas | 5.000 |
| Tipos de entidad personalizados | 1.000 |
| Tipos de relación personalizados | 1.000 |
| Assets | 8.000 |
| Longitud de ruta | 140 caracteres |
| Ratio de compresión por entrada (importación) | 100:1 |
| Imagen | 25 MiB, 8192 px por lado, 24 Mpx |
| Descripción | 200.000 bytes / 50.000 caracteres |
| `alt` | 500 caracteres |
| Galería | 20 imágenes |
| Etiquetas por ficha | 12 |
| Alias | 10 |
| Géneros | 8 |

El ratio 100:1 solo se aplica al leer un ZIP ajeno. La verificación de una
exportación propia lo desactiva para no rechazar un mundo legítimamente muy
comprimible.

## 11. Biblioteca total (`world-craft-library` v1)

La acción **Exportar todos los datos** de Ajustes genera un ZIP abierto con todo
el contenido de la aplicación. No es una copia automática: es una biblioteca
portable, inspeccionable sin World Craft y con una copia completa y verificada de
la base de datos. La decisión está en el [ADR 0030](adr/0030-settings-data-and-full-deletion.md).

### 11.1 Estructura

```text
manifest.json
settings.json
database/world-craft.sqlite
worlds/<slug>.zip
worlds/<slug>.zip
...
```

| Entrada | Obligatoria | Contenido |
|---|---|---|
| `manifest.json` | Sí, exactamente una | Identidad de la biblioteca, versiones, fecha, metadatos de la base y de `settings.json`, lista de mundos con tamaño y SHA-256, recuentos y avisos agregados. No se lista a sí mismo. |
| `settings.json` | Sí, exactamente una | Preferencias de apariencia y vista de ficha (sección 11.3). |
| `database/world-craft.sqlite` | Sí, exactamente una | Copia completa y verificada de la base SQLite de la aplicación (sección 11.4). |
| `worlds/<slug>.zip` | Una por mundo vivo | Paquete `world-craft-world` v1 de #78, con el contenido vivo del mundo y sus imágenes. |

No hay entradas de directorio, archivos sueltos, miniaturas ni rutas fuera de
esas cuatro formas. La lista blanca es cerrada: se rechazan rutas absolutas, `\`,
`:`, NUL, segmentos `.` o `..`, nombres reservados de Windows, mayúsculas, barras
finales y slugs fuera del patrón canónico. El límite es de **5.000 paquetes de
mundo**, el manifiesto no puede superar **16 MiB** y `settings.json`, **64 KiB**.

### 11.2 `manifest.json`

```json
{
  "format": "world-craft-library",
  "formatVersion": 1,
  "schemaVersion": 8,
  "appVersion": "0.1.0",
  "exportedAt": "2026-11-26T10:00:00.000Z",
  "database": {
    "path": "database/world-craft.sqlite",
    "size": 4096,
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "integrity": "ok",
    "schemaVersion": 8
  },
  "settings": {
    "path": "settings.json",
    "size": 512,
    "sha256": "1111111111111111111111111111111111111111111111111111111111111111"
  },
  "worlds": [
    {
      "slug": "puerto-sal",
      "name": "Puerto Sal",
      "path": "worlds/puerto-sal.zip",
      "size": 20480,
      "sha256": "2222222222222222222222222222222222222222222222222222222222222222",
      "counts": {
        "entities": 3,
        "entityTypes": 1,
        "relationTypes": 0,
        "tags": 2,
        "relations": 1,
        "versions": 4,
        "assets": 6
      },
      "warnings": []
    }
  ],
  "counts": {
    "entities": 3,
    "entityTypes": 1,
    "relationTypes": 0,
    "tags": 2,
    "relations": 1,
    "versions": 4,
    "assets": 6
  },
  "warnings": []
}
```

- **`schemaVersion`** es el `user_version` de la base en el momento de exportar.
  Debe coincidir con `database.schemaVersion`.
- **`database.integrity`** es siempre `"ok"`: la copia se verificó antes de
  publicar.
- **`counts` y `warnings`** de la biblioteca son la suma y la fusión por código
  de los de cada mundo; un desajuste invalida el manifiesto.
- **`worlds[].path`** debe ser `worlds/<slug>.zip` y coincidir con el slug; no se
  admiten rutas repetidas ni slugs repetidos.
- Los avisos usan los mismos códigos que el formato de mundo y no se repiten por
  código dentro de una lista.
- **No hay campos opcionales ni bloques futuros.** Un campo desconocido se
  rechaza.

### 11.3 `settings.json`

```json
{
  "format": "world-craft-library-settings",
  "formatVersion": 1,
  "theme": "light",
  "density": "comfortable",
  "fontScale": "normal",
  "railCollapsed": false,
  "entityView": {
    "propertiesOpen": true,
    "propertiesWidth": 320,
    "sections": {
      "description": true,
      "attributes": false,
      "relations": false,
      "resources": false
    }
  }
}
```

Solo guarda **apariencia y memoria de la vista de ficha**. `lastView` y
`recentLocation` se quedan fuera a propósito porque apuntan a contenido concreto
y no forman parte de una biblioteca portable; la copia de la base sí los incluye.

### 11.4 `database/world-craft.sqlite`

Es una **copia completa** de la base, no un subconjunto de los mundos:

- Se obtiene con la API online de SQLite (`sqlite.backup`) sobre la conexión
  viva, se escribe como archivo temporal, se comprueba con `integrity_check` y
  `user_version`, y solo entonces se renombra a su nombre definitivo.
- Incluye **todo**: mundos, fichas, tipos, etiquetas, relaciones, versiones,
  papelera, actividad, índice de búsqueda y preferencias (`app_settings`,
  incluidos `lastView` y `recentLocation`).
- Los paquetes `worlds/*.zip` **no** incluyen papelera, actividad ni
  preferencias; esas tres cosas solo están en esta copia.
- Se puede abrir con cualquier herramienta SQLite y verificar con el SHA-256 del
  manifiesto.

### 11.5 Verificación

Se aplican dos comprobaciones antes y una después de publicar:

1. Antes de empaquetar, cada paquete de mundo se relee, se valida su
   `manifest.json` interno y se comprueban sus recuentos, avisos y slug.
2. El manifiesto se valida con Zod estricto y se exige que el conjunto real de
   entradas —excepto el propio `manifest.json`— coincida exactamente con los
   tamaños declarados.
3. El ZIP final se relee entero: `settings.json` y la base se verifican por
   tamaño y SHA-256; la base se vuelve a comprobar con `integrity_check` sobre el
   staging; cada mundo se verifica por hash y por los recuentos y avisos de su
   manifiesto interno.

Un fallo en cualquier punto elimina el `.partial` y el staging, no publica nada y
conserva el destino anterior. Si `settings.json` o el manifiesto no son válidos,
el código es `DATA_LIBRARY_SETTINGS_INVALID` o `DATA_LIBRARY_MANIFEST_INVALID`;
una discrepancia de contenido devuelve `DATA_LIBRARY_VERIFY_FAILED`.

### 11.6 Exclusiones

| Excluido | Motivo |
|---|---|
| Copias automáticas de `backups/` | Son locales de la instalación y pueden ser grandes; la copia de la base ya representa el estado actual. |
| Imágenes huérfanas y `backups/orphans` | No están referenciadas por ninguna ficha. |
| Temporales de `imports/.tmp`, `exports/.tmp` y `assets/.tmp` | Son trabajo en curso, no contenido. |
| Registros de `logs/` | Diagnóstico de la instalación, no contenido del usuario. |
| `lastView` y `recentLocation` en `settings.json` | Apuntan a contenido concreto; la base completa sí los conserva. |
| La instalación y `.updaterId` | No son datos del usuario. |

La biblioteca **no** sustituye a una copia de seguridad: es una exportación
portable. Las copias automáticas siguen siendo la red de recuperación de la
instalación.

### 11.7 Importación

**No hay importación de la biblioteca completa.** La importación sigue siendo
**mundo a mundo** con `transfer:importWorld` (sección 9): se abre el paquete
`worlds/<slug>.zip` que se quiera y se crea un mundo nuevo, con IDs regenerados y
sin fusionar ni sobrescribir. La copia `database/world-craft.sqlite` se conserva
como vía de recuperación manual, no como una restauración automática.

## 12. Documentos relacionados

- [ADR 0029](adr/0029-world-export-import.md)
- [ADR 0030](adr/0030-settings-data-and-full-deletion.md)
- [Persistencia](persistencia.md), secciones 8 y 8.5
- [Arquitectura](arquitectura.md), secciones 2.17, 2.18 y 3.6
- [Continuidad](continuidad.md), sección 3.4
- [Esquema de base de datos](base-de-datos/esquema.md), sección 4.15
- [Plan de pruebas](calidad/plan-de-pruebas.md), sección 3.20
- [Manual de usuario](manual-de-usuario.md), secciones 4.6 y 12.5
