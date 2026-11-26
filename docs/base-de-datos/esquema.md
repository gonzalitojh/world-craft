# Esquema de base de datos

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio); actualizado el
> 26/11/2026 con #114. La migración
> `0000_init` y las tablas `schema_migrations` y `app_settings` están
> implementadas en M0-04 (#64); la tabla `assets` en `0001_assets` (M0-06, #66);
> `worlds` y `activity_log` en `0002_worlds` (M1-01, #72); `entity_types` en
> `0003_entity_types` (M1-02, #73); `entities`, `tags`, `entity_tags` y
> `entity_gallery` en `0004_entities` (M1-03, #74); `relation_types` y
> `relations` en `0005_relations` (M1-04, #75); el índice de búsqueda
> `search_documents`, `search_fts` y `search_vocabulary` en `0006_search`
> (M1-05, #76); `entity_versions` con los índices de papelera en
> `0007_trash_versions` (M1-06, #77); y `worlds.description_text` con la vista
> de búsqueda sobre texto plano en `0008_world_description` (#114). **La versión
> vigente es 9**: #78 y #79 no cambiaron `user_version` y #114 lo sube al añadir
> la descripción enriquecida. El resto de tablas de contenido llega en M2, M3 y
> M4 con sus propias migraciones; hasta entonces figuran como previstas.
> **Motor:** SQLite 3 con better-sqlite3, Drizzle ORM y FTS5.
> **Ámbito:** diccionario de tablas, columnas, índices, relaciones y reglas de
> integridad. Las migraciones se documentan en
> [`migraciones.md`](migraciones.md).

## 1. Convenciones

- Nombres de tablas y columnas en `snake_case` y en inglés.
- Claves primarias `id TEXT` con UUIDv7 generado en el proceso principal.
- Fechas en milisegundos UTC con `INTEGER` (`created_at`, `updated_at`).
- Booleanos como `INTEGER` 0/1 con `CHECK (col IN (0,1))`.
- JSON como `TEXT` validado con Zod en la aplicación; SQLite no impone el
  esquema interno.
- Borrado lógico con `deleted_at INTEGER NULL` en contenido; la papelera visible
  conserva el registro y sus assets, y la purga definitiva exige copia previa y
  borra en orden sin tocar los archivos de assets. Las versiones de la
  descripción se conservan mientras la fila exista y caen en cascada al purgar
  la ficha.
- `world_id` obligatorio en todo el contenido de un mundo, directo o derivado
  mediante claves foráneas.
- `ON DELETE CASCADE` en hijas de contenido; `RESTRICT` en referencias que no
  deben quedar huérfanas.
- Triggers de `updated_at` en las tablas que lo necesitan.

## 2. Diagrama

Modelo objetivo (implementadas hoy `schema_migrations`, `app_settings`,
`assets`, `worlds`, `activity_log`, `entity_types`, `entities`, `tags`,
`entity_tags`, `entity_gallery`, `relation_types`, `relations`,
`search_documents` y `entity_versions`):

```text
worlds
  ├─< entity_types
  ├─< tags >─< entity_tags >─< entities >─< relations >─ relation_types
  │                                ├─< entity_gallery >─ assets
  │                                ├─< entity_versions      (historial, desde #77)
  │                                └─ image_asset_id ──> assets
  │      └─< assets                 (imagen principal y galería desde #74)
  ├─< maps >─< map_entity_links
  ├─< manuscripts >─< books >─< chapters >─< scenes >─< scene_versions
  ├─< game_tables >─< game_table_entries
  ├─< game_sessions
  └─< activity_log

game_content_packs >─ game_tables
app_settings
assets                      (implementada en 0001; FK a worlds en M1)
schema_migrations
search_documents >─ search_fts (FTS5)
```

## 3. Tablas del sistema

Implementadas en la migración `0000_init.sql`. Su SQL real es:

```sql
CREATE TABLE `app_settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `schema_migrations` (
  `id` text PRIMARY KEY NOT NULL,
  `applied_at` integer NOT NULL,
  `checksum` text NOT NULL
);
```

La migración inicial no crea tablas de dominio ni FTS5. `PRAGMA user_version`
guarda el **número de migraciones aplicadas**: con `0000_init` vale 1, con
`0001_assets` vale 2, con `0002_worlds` vale 3, con `0003_entity_types` vale 4,
con `0004_entities` vale 5, con `0005_relations` vale 6, con `0006_search` vale 7,
con `0007_trash_versions` vale 8 y con `0008_world_description` vale **9**; no es
el prefijo de la etiqueta. El runner contrasta ese valor con
`schema_migrations` y entra en modo seguro si no coinciden.

### 3.1 `schema_migrations`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | Etiqueta de la migración (`0000_init`). |
| `applied_at` | INTEGER | NOT NULL | Momento de aplicación en milisegundos UTC. |
| `checksum` | TEXT | NOT NULL | SHA-256 del SQL normalizado (BOM y finales de línea). |

### 3.2 `app_settings`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `key` | TEXT | PK | Clave de ajuste. Hoy solo se usan las claves `ui.*` de las preferencias de interfaz (#132). |
| `value` | TEXT | NOT NULL | JSON validado por la app. |
| `updated_at` | INTEGER | NOT NULL | Última actualización en milisegundos UTC. |

**Claves `ui.*` implementadas (#132).** No hay migración nueva: la tabla existe
desde `0000_init`. Cada preferencia ocupa una fila y el valor es JSON; la lectura
es tolerante por clave y el reset solo borra el prefijo `ui.` con `GLOB` sensible
a mayúsculas.

| Clave | Formato JSON | Defecto |
|---|---|---|
| `ui.theme` | `"light"` o `"dark"` | `"light"` |
| `ui.rail-collapsed` | booleano | `false` |
| `ui.entity-view` | objeto `{ propertiesOpen: boolean, propertiesWidth: entero 280–360, sections: { description, attributes, relations, resources: boolean } }` | `propertiesOpen: true`, `propertiesWidth: 320`, solo `description` abierta |
| `ui.last-view` | `"home"`, `"worlds"`, `"search"`, `"world"`, `"entities"` o `"entity"` | `"home"` |
| `ui.recent-location` | `{ kind: "world", worldId }` o `{ kind: "entity", worldId, entityId, entityName }`, con UUIDv7; ausente si no hay destino | Ausente |

`recentLocation: null` borra la fila `ui.recent-location`; `ui.entity-view` se
escribe con `updated_at` en cada commit explícito del panel o de las secciones.
Las claves no-UI y las tablas de dominio no se tocan. El detalle está en
[`docs/persistencia.md`](../persistencia.md) §3.4 y en el
[ADR 0027](../adr/0027-ui-preferences-persistence.md).

## 4. Mundos y contenido

**Implementadas:** `worlds` y `activity_log` en `0002_worlds` (M1-01, #72),
`entity_types` en `0003_entity_types` (M1-02, #73), `entities`, `tags`,
`entity_tags` y `entity_gallery` en `0004_entities` (M1-03, #74),
`relation_types` y `relations` en `0005_relations` (M1-04, #75), el índice
`search_documents`, `search_fts` y `search_vocabulary` en `0006_search`
(M1-05, #76), `entity_versions` en `0007_trash_versions` (M1-06, #77),
`worlds.description_text` en `0008_world_description` (#114) y `assets`
en `0001_assets` (M0-06, #66). Las demás tablas de esta sección describen el
modelo objetivo y todavía no existen; llegarán con sus issues de M2, M3 y M4.

### 4.1 `worlds`

Implementada en `0002_worlds` (M1-01, #72). SQL real:

```sql
CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text,
	`description` text,
	`cover_asset_id` text,
	`genres` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`language` text DEFAULT 'es' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`cover_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "worlds_status_check" CHECK("worlds"."status" in ('active', 'archived')),
	CONSTRAINT "worlds_language_check" CHECK("worlds"."language" in ('es', 'en', 'it')),
	CONSTRAINT "worlds_slug_check" CHECK(length("worlds"."slug") between 1 and 80 AND "worlds"."slug" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "worlds_name_check" CHECK(length("worlds"."name") between 1 and 120),
	CONSTRAINT "worlds_genres_check" CHECK(json_valid("worlds"."genres") AND json_type("worlds"."genres") = 'array')
);
```

`worlds.description_text` llega con `0008_world_description` (#114):

```sql
ALTER TABLE `worlds` ADD `description_text` text;
```

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `name` | TEXT | NOT NULL, CHECK 1–120 | Nombre visible. |
| `slug` | TEXT | NOT NULL, UNIQUE | Identificador estable; minúsculas, números y guiones. |
| `summary` | TEXT | NULL | Sinopsis breve de una línea. |
| `description` | TEXT | NULL | Documento de ProseMirror validado con Zod; nunca HTML. Máximo 200.000 caracteres de JSON. |
| `description_text` | TEXT | NULL | Texto plano derivado de `description` para la búsqueda; máximo 4.000 caracteres. Se recalcula en el proceso principal y no se exporta. |
| `cover_asset_id` | TEXT | FK `assets(id)` `RESTRICT`, NULL | Portada; el selector llega con #115. |
| `genres` | TEXT | NOT NULL DEFAULT `'[]'`, CHECK JSON array | Géneros como JSON; máximo 8, validado por la app. |
| `status` | TEXT | NOT NULL DEFAULT `'active'`, CHECK | `active`, `archived`. |
| `language` | TEXT | NOT NULL DEFAULT `'es'`, CHECK | Idioma del contenido: `es`, `en`, `it`. |
| `settings` | TEXT | NOT NULL DEFAULT `'{}'` | Preferencias del mundo; JSON validado. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |
| `archived_at` | INTEGER | NULL | Archivo. |
| `deleted_at` | INTEGER | NULL | Papelera lógica. |

Índices: `worlds_slug_uq (slug)`, `worlds_status_idx (status, deleted_at)` y
`worlds_deleted_updated_idx (deleted_at, updated_at DESC)`.

Reglas de la issue M1-01:

- El `slug` es único en toda la base, también para mundos archivados o en
  papelera; la aplicación añade `-2`, `-3`… si hace falta y nunca reutiliza un
  identificador.
- La portada es una referencia opcional a un asset; la copia de un mundo no
  comparte portada. La galería y su selector llegan con #115.
- El borrado es lógico (`deleted_at`); la papelera visible con restauración y
  purga está implementada en M1-06 (#77). Restaurar un mundo lo devuelve a Inicio
  y Mundos y no restaura en cascada sus fichas o tipos que ya estuvieran en
  papelera. La purga definitiva borra la actividad, las relaciones, la galería,
  las etiquetas, las versiones, las fichas, los tipos y las etiquetas del mundo,
  en ese orden, y nunca los assets (ADR 0028).
- Los géneros y el nombre se validan en el proceso principal además de en la
  interfaz; el `CHECK` de SQLite es la última barrera.
- **Descripción enriquecida (#114).** `description` guarda un documento
  ProseMirror cerrado (párrafos, títulos 1–3, listas, cita, texto, salto y
  enlaces `wc-entity://<uuidv7>`) y `description_text` su texto plano. La vista
  `search_world_documents` compone el cuerpo con `summary` y `description_text`,
  nunca con el JSON. Los enlaces solo admiten fichas vivas del mismo mundo.
- **Sin `CHECK` JSON en `description`.** Añadirlo obligaría a reconstruir la
  tabla raíz, referenciada por `assets`, `activity_log`, `entity_types`,
  `entities`, `tags`, `relations`, `search_documents` y sus triggers. La forma se
  valida con Zod en el IPC, la validación de dominio y el esquema cerrado del
  editor; el texto plano se recalcula siempre.

### 4.2 `entity_types`

Implementada en `0003_entity_types` (M1-02, #73). SQL real:

```sql
CREATE TABLE `entity_types` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`fields` text DEFAULT '[]' NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "entity_types_is_system_check" CHECK("entity_types"."is_system" in (0, 1)),
	CONSTRAINT "entity_types_world_check" CHECK(("entity_types"."world_id" is null and "entity_types"."is_system" = 1) or ("entity_types"."world_id" is not null and "entity_types"."is_system" = 0)),
	CONSTRAINT "entity_types_key_check" CHECK(length("entity_types"."key") between 1 and 60 AND "entity_types"."key" NOT GLOB '*[^a-z0-9-]*' AND "entity_types"."key" GLOB '[a-z0-9]*' AND "entity_types"."key" GLOB '*[a-z0-9]' AND "entity_types"."key" NOT GLOB '*--*'),
	CONSTRAINT "entity_types_name_check" CHECK(length("entity_types"."name") between 1 and 80),
	CONSTRAINT "entity_types_fields_check" CHECK(json_valid("entity_types"."fields") AND json_type("entity_types"."fields") = 'array')
);
```

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. Los 18 tipos del sistema usan IDs fijos y estables. |
| `world_id` | TEXT | FK `worlds(id)` `CASCADE`, NULL | `NULL` = tipo del sistema. |
| `key` | TEXT | NOT NULL | Clave estable (`character`, `place`). |
| `name` | TEXT | NOT NULL, CHECK 1–80 | Nombre visible. |
| `icon` | TEXT | NOT NULL | Nombre de icono Lucide de la lista cerrada. |
| `color` | TEXT | NOT NULL | Token de color (`moss`, `ochre`, `danger`, `prussian`). |
| `fields` | TEXT | NOT NULL DEFAULT `'[]'`, CHECK JSON array | Plantilla de campos validada con Zod. |
| `is_system` | INTEGER | NOT NULL DEFAULT 0, CHECK 0/1 | 1 si es del sistema. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |
| `deleted_at` | INTEGER | NULL | Borrado lógico; la clave queda reservada. |

Índices: `entity_types_world_key_uq (world_id, key)`,
`entity_types_system_key_uq (key) WHERE world_id IS NULL`,
`entity_types_world_idx (world_id, deleted_at, name)` y
`entity_types_deleted_idx (deleted_at, world_id)` (M1-06, #77).

Reglas de la issue M1-02:

- Los 18 tipos del sistema se siembran en la migración con los mismos IDs,
  claves, iconos, colores, plantillas y marcas de tiempo simbólicas
  (`2026-11-20`) que `src/shared/entity-types/catalog.ts`; una prueba de
  integración compara ambas fuentes.
- Los tipos del sistema no se editan ni se borran desde la aplicación. Se pueden
  duplicar en un mundo para ajustar su plantilla.
- Cada tipo personalizado pertenece a un mundo; las listas y mutaciones filtran
  por `world_id`. La clave es única dentro de su mundo y no puede coincidir con
  una del sistema, aunque la misma clave puede repetirse en mundos distintos.
- Borrar un tipo personalizado es un borrado lógico (`deleted_at`). La fila se
  conserva, la clave sigue reservada y la papelera lo muestra con su mundo de
  origen. Restaurarlo exige que el mundo esté vivo (`world-in-trash`) y la purga
  se rechaza con `type-in-use` mientras quede cualquier ficha, viva o en
  papelera. Los tipos del sistema no se borran ni se purgan (ADR 0028).
- La plantilla de campos se guarda como JSON y se valida con Zod. Los valores de
  cada ficha se guardarán en `entities.attributes` con la misma plantilla, sin
  migrar el esquema por cada campo.
- Al duplicar un mundo se copian sus tipos personalizados en la misma
  transacción. El borrado del mundo es lógico y conserva sus tipos hasta la
  purga.
- El formato de transferencia de tipos (`entity-types.v1`) solo incluye los
  tipos personalizados; la exportación completa del mundo lo compone desde
  M1-07 (#78).

### 4.3 `entities`

**Implementada en `0004_entities` (M1-03, #74).**

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` ON DELETE CASCADE | Mundo. |
| `type_id` | TEXT | NOT NULL, FK `entity_types(id)` ON DELETE RESTRICT | Tipo del sistema o personalizado del mundo. |
| `name` | TEXT | NOT NULL, CHECK 1–120 | Nombre. |
| `slug` | TEXT | NOT NULL, CHECK canónico | Identificador estable por mundo. |
| `aliases` | TEXT | NOT NULL DEFAULT `'[]'`, JSON array | Alias; máximo 10. |
| `summary` | TEXT | NULL | Resumen corto (máximo 280). |
| `description` | TEXT | NULL, JSON object | Documento de ProseMirror validado con Zod; nunca HTML. |
| `description_text` | TEXT | NULL | Texto plano derivado para búsqueda. |
| `image_asset_id` | TEXT | FK `assets(id)` ON DELETE SET NULL, NULL | Imagen principal. |
| `attributes` | TEXT | NOT NULL DEFAULT `'{}'`, JSON object | Valores de la plantilla, validados con Zod. |
| `status` | TEXT | NOT NULL DEFAULT `'active'`, CHECK | `active`, `draft` o `archived`. |
| `is_favorite` | INTEGER | NOT NULL DEFAULT 0, CHECK 0/1 | Favorito. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |
| `deleted_at` | INTEGER | NULL | Papelera lógica. |

Índices: `entities_world_slug_uq (world_id, slug)`,
`entities_world_type_idx (world_id, type_id, deleted_at)`,
`entities_name_idx (world_id, name)`,
`entities_favorite_idx (world_id, is_favorite)` y
`entities_deleted_idx (deleted_at, world_id)` (M1-06, #77).

Reglas:

- El tipo no cambia después de crear la ficha; los valores se validan con la
  plantilla del tipo y las referencias deben existir, estar vivas y pertenecer
  al mismo mundo. Si el campo declara `targetTypeKey`, también se comprueba el
  tipo de destino.
- El slug es único por mundo y no se reutiliza mientras la fila exista, incluidas
  las fichas en papelera.
- Borrar es lógico: la fila, sus etiquetas, sus versiones y sus assets se
  conservan hasta la purga. La papelera la muestra con su mundo y tipo de origen;
  restaurarla exige el mundo vivo (`world-in-trash`) y un tipo disponible
  (`type-unavailable`). Al purgarla se borran sus relaciones, versiones,
  etiquetas y galería, y después la ficha; los assets y sus archivos no se tocan
  (#116 los pondrá en cuarentena). Una ficha en papelera no muestra ni genera
  versiones (ADR 0028).
- La descripción sigue la lista cerrada de nodos y marcas de
  `src/shared/entities/description.ts`; el `CHECK` solo comprueba que es un JSON
  de objeto, la garantía de forma es de la aplicación.

### 4.3.1 `entity_gallery`

**Implementada en `0004_entities` (M1-03, #74).** Extiende el esquema objetivo
para conservar el orden de la galería y la relación con `assets`.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `entity_id` | TEXT | PK, FK `entities(id)` ON DELETE CASCADE | Ficha. |
| `asset_id` | TEXT | PK, FK `assets(id)` ON DELETE CASCADE | Imagen del mundo. |
| `position` | INTEGER | NOT NULL, CHECK >= 0 | Orden explícito en la galería. |

Índices: `entity_gallery_position_uq (entity_id, position)`,
`entity_gallery_asset_idx (asset_id)`.

Regla: el servicio comprueba que el asset pertenece al mismo mundo que la ficha
y que es una imagen. La imagen principal se guarda en `entities.image_asset_id`;
la interfaz la añade también a la galería cuando el usuario la elige como
principal, pero el modelo no obliga a que esté allí.

### 4.4 `relation_types`

**Implementada en `0005_relations` (M1-04, #75).**

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | FK `worlds(id)`, NULL | `NULL` = tipo del sistema. |
| `key` | TEXT | NOT NULL | Clave estable. |
| `name` | TEXT | NOT NULL | Nombre directo. |
| `inverse_name` | TEXT | NOT NULL | Nombre inverso. |
| `color` | TEXT | NOT NULL | Token de color. |
| `is_system` | INTEGER | NOT NULL DEFAULT 0 | Tipo del sistema. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |

Índices: `relation_types_world_key_uq (world_id, key)`,
`relation_types_system_key_uq (key) WHERE world_id IS NULL` y
`relation_types_world_idx (world_id, name)`.

Reglas: `world_id` nulo exige `is_system = 1` y viceversa; la clave solo admite
minúsculas, números y guiones simples. Los 18 tipos del sistema se siembran con
IDs UUIDv7 fijos que coinciden con `src/shared/relations/catalog.ts`.

### 4.5 `relations`

**Implementada en `0005_relations` (M1-04, #75).**

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` | Mundo. |
| `source_id` | TEXT | NOT NULL, FK `entities(id)` | Origen. |
| `target_id` | TEXT | NOT NULL, FK `entities(id)` | Destino. |
| `type_id` | TEXT | NOT NULL, FK `relation_types(id)` | Tipo. |
| `label` | TEXT | NULL | Etiqueta directa. |
| `inverse_label` | TEXT | NULL | Etiqueta inversa. |
| `notes` | TEXT | NULL | Notas. |
| `strength` | INTEGER | NOT NULL DEFAULT 1, CHECK 1–5 | Intensidad. |
| `metadata` | TEXT | NOT NULL DEFAULT `'{}'` | Datos extra. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |

Índices: `relations_world_source_idx (world_id, source_id)`,
`relations_world_target_idx (world_id, target_id)`,
`relations_type_idx (type_id)`, `relations_unique (world_id, source_id, target_id, type_id)`.

Regla: `source_id <> target_id` con `CHECK`; `metadata` debe ser un objeto JSON
válido. La etiqueta efectiva es `label ?? name` del tipo y la inversa
`inverse_label ?? inverse_name`; no se guardan dos filas por relación. El origen,
el destino y el tipo se validan en el servicio contra el mismo mundo y contra las
fichas vivas.

### 4.6 `tags` y `entity_tags`

**Implementadas en `0004_entities` (M1-03, #74).**

`tags`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK, UUIDv7. |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` ON DELETE CASCADE. |
| `name` | TEXT | NOT NULL, CHECK 1–40. |
| `color` | TEXT | NOT NULL, CHECK `moss`, `ochre`, `danger` o `prussian`. |
| `created_at` | INTEGER | NOT NULL. |

Índices: `tags_world_name_uq (world_id, name)` y `tags_world_idx (world_id,
name)`. Crear una etiqueta con un nombre existente en el mismo mundo es
idempotente.

`entity_tags`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `entity_id` | TEXT | PK, FK `entities(id)` ON DELETE CASCADE |
| `tag_id` | TEXT | PK, FK `tags(id)` ON DELETE CASCADE |

Índice: `entity_tags_tag_idx (tag_id)`. Las etiquetas y los filtros se aíslan
siempre por `world_id`.

### 4.7 `assets`

**Implementada en `0001_assets` (M0-06, #66).** SQL real:

```sql
CREATE TABLE `assets` (
  `id` text PRIMARY KEY NOT NULL,
  `world_id` text NOT NULL,
  `kind` text NOT NULL,
  `relative_path` text NOT NULL,
  `mime` text NOT NULL,
  `size` integer NOT NULL,
  `width` integer,
  `height` integer,
  `alt` text,
  `hash` text NOT NULL,
  `created_at` integer NOT NULL,
  CONSTRAINT "assets_kind_check" CHECK("assets"."kind" in ('image', 'map', 'document', 'other')),
  CONSTRAINT "assets_size_check" CHECK("assets"."size" >= 0),
  CONSTRAINT "assets_hash_check" CHECK(length("assets"."hash") = 64 AND "assets"."hash" NOT GLOB '*[^0-9a-f]*')
);
```

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | NOT NULL | Mundo; **sin FK en M0**, se añade en M1. |
| `kind` | TEXT | NOT NULL, CHECK | `image`, `map`, `document`, `other`. En M0 solo se inserta `image`. |
| `relative_path` | TEXT | NOT NULL | Ruta relativa a `assets/`; en M0 `worlds/<uuidv7>/<uuidv7>.webp`. |
| `mime` | TEXT | NOT NULL | MIME real; en M0 siempre `image/webp`. |
| `size` | INTEGER | NOT NULL, CHECK >= 0 | Bytes del WebP servido. |
| `width` | INTEGER | NULL | Ancho en píxeles. |
| `height` | INTEGER | NULL | Alto en píxeles. |
| `alt` | TEXT | NULL | Texto alternativo (máximo 500 caracteres). |
| `hash` | TEXT | NOT NULL, CHECK hexadecimal de 64 | SHA-256 del WebP publicado. |
| `created_at` | INTEGER | NOT NULL | Creación en milisegundos UTC. |

Índices: `assets_world_idx (world_id)`, `assets_hash_idx (hash)`.

Reglas:

- La ruta relativa se valida en el servicio y solo admite
  `worlds/<uuidv7>/<uuidv7>.webp` o `…/<uuidv7>.thumb.webp`; la miniatura no
  tiene fila propia y se deriva del archivo principal.
- `hash` cubre el archivo servido, no el original; por eso el índice sirve para
  verificar y para una futura deduplicación, que en M0 no se aplica.
- **FK diferida.** `worlds` ya existe desde `0002_worlds` y `worlds.cover_asset_id`
  referencia `assets(id)` con `RESTRICT`, pero `assets.world_id` sigue sin clave
  foránea. La issue M1-11 (#116) reconstruirá `assets` (tabla nueva, copia,
  `DROP` y `RENAME`) para añadir `world_id → worlds(id) ON DELETE RESTRICT`,
  dejando en cuarentena las filas sin mundo antes de activar la restricción. No
  se edita `0001_assets`.

### 4.8 `maps`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` | Mundo. |
| `name` | TEXT | NOT NULL | Nombre. |
| `description` | TEXT | NULL | Descripción. |
| `document` | TEXT | NOT NULL DEFAULT `'{}'` | JSON de capas y GeoJSON. |
| `style` | TEXT | NOT NULL DEFAULT `'{}'` | Estilo del mapa. |
| `bounds` | TEXT | NULL | JSON de límites. |
| `thumbnail_asset_id` | TEXT | FK `assets(id)`, NULL | Miniatura. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |
| `deleted_at` | INTEGER | NULL | Papelera. |

Índice: `maps_world_idx (world_id, deleted_at)`.

### 4.9 `map_entity_links`

| Columna | Tipo | Restricciones |
|---|---|---|
| `map_id` | TEXT | PK, FK `maps(id)` ON DELETE CASCADE |
| `entity_id` | TEXT | PK, FK `entities(id)` ON DELETE CASCADE |
| `feature_id` | TEXT | NOT NULL |
| `label` | TEXT | NULL |

Índice: `map_entity_links_entity_idx (entity_id)`.

### 4.10 `manuscripts`, `books`, `chapters`, `scenes`, `scene_versions`

`manuscripts`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` |
| `title` | TEXT | NOT NULL |
| `kind` | TEXT | NOT NULL (`novel`, `short`, `other`) |
| `synopsis` | TEXT | NULL |
| `status` | TEXT | NOT NULL DEFAULT `'draft'` |
| `target_words` | INTEGER | NULL |
| `settings` | TEXT | NOT NULL DEFAULT `'{}'` |
| `created_at`, `updated_at` | INTEGER | NOT NULL |
| `deleted_at` | INTEGER | NULL |

`books`: `id` PK, `manuscript_id` FK, `title`, `position REAL`, timestamps.

`chapters`: `id` PK, `book_id` FK, `title`, `position REAL`, `summary`, `status`, timestamps.

`scenes`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK |
| `chapter_id` | TEXT | NOT NULL, FK `chapters(id)` |
| `title` | TEXT | NOT NULL |
| `position` | REAL | NOT NULL |
| `content` | TEXT | NOT NULL DEFAULT `'{}'` (JSON ProseMirror) |
| `content_text` | TEXT | NULL |
| `word_count` | INTEGER | NOT NULL DEFAULT 0 |
| `status` | TEXT | NOT NULL DEFAULT `'draft'` |
| `pov_entity_id` | TEXT | FK `entities(id)`, NULL |
| `location_entity_id` | TEXT | FK `entities(id)`, NULL |
| `story_date` | TEXT | NULL |
| `notes` | TEXT | NULL |
| `created_at`, `updated_at` | INTEGER | NOT NULL |
| `deleted_at` | INTEGER | NULL |

`scene_versions`: `id` PK, `scene_id` FK, `content`, `content_text`,
`word_count`, `label`, `created_at`.

Índices: `scenes_chapter_position_idx (chapter_id, position)`,
`scenes_deleted_idx (deleted_at)`, `scene_versions_scene_idx (scene_id, created_at)`.

### 4.11 Juego

`game_content_packs`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK |
| `name` | TEXT | NOT NULL |
| `version` | TEXT | NOT NULL |
| `description` | TEXT | NULL |
| `author` | TEXT | NULL |
| `license` | TEXT | NOT NULL |
| `metadata` | TEXT | NOT NULL DEFAULT `'{}'` |
| `created_at` | INTEGER | NOT NULL |

`game_tables`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK |
| `world_id` | TEXT | FK `worlds(id)`, NULL |
| `pack_id` | TEXT | FK `game_content_packs(id)`, NULL |
| `key` | TEXT | NOT NULL |
| `name` | TEXT | NOT NULL |
| `category` | TEXT | NOT NULL |
| `description` | TEXT | NULL |
| `is_system` | INTEGER | NOT NULL DEFAULT 0 |
| `is_editable` | INTEGER | NOT NULL DEFAULT 1 |
| `version` | INTEGER | NOT NULL DEFAULT 1 |

Índice: `game_tables_world_key_uq (world_id, key)`,
`game_tables_pack_idx (pack_id)`.

`game_table_entries`: `id` PK, `table_id` FK, `text`, `weight` REAL DEFAULT 1,
`tags` TEXT DEFAULT `'[]'`, `metadata` TEXT DEFAULT `'{}'`.

`game_sessions`: `id` PK, `world_id` FK, `seed` TEXT, `results` TEXT,
`notes` TEXT, `created_at`.

### 4.12 `activity_log`

Implementada en `0002_worlds` (M1-01, #72). SQL real:

```sql
CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`diff` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
```

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` | Mundo de la acción. |
| `action` | TEXT | NOT NULL | `world.created`, `world.updated`, `world.archived`, `world.restored`, `world.duplicated` o `world.deleted`. |
| `entity_type` | TEXT | NOT NULL | `world` en M1-01; fichas, mapas y escenas en sus issues. |
| `entity_id` | TEXT | NULL | Entidad afectada; el mundo en las acciones de mundo. |
| `diff` | TEXT | NOT NULL DEFAULT `'{}'` | JSON con los campos cambiados o el origen de un duplicado. |
| `created_at` | INTEGER | NOT NULL | Momento de la acción. |

Índices: `activity_log_world_created_idx (world_id, created_at DESC)` y
`activity_log_created_idx (created_at DESC)`. Las consultas globales del
dashboard hacen `JOIN` con `worlds` y excluyen los mundos en papelera; las
consultas por mundo filtran por `world_id`, de modo que nunca se mezcla
actividad de dos mundos.

### 4.13 `search_documents`, `search_fts` y `search_vocabulary`

`search_documents` es un índice materializado y reconstruible; nunca es la
fuente de verdad. Cada fila resume un mundo, una ficha o una relación.

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK (`<kind>:<source_id>`) |
| `kind` | TEXT | NOT NULL (`world`, `entity`, `relation`; reserva `map`, `manuscript`, `scene`) |
| `source_id` | TEXT | NOT NULL |
| `context_id` | TEXT | NULL; ficha de origen de una relación |
| `related_id` | TEXT | NULL; ficha de destino de una relación |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` con cascada |
| `title` | TEXT | NOT NULL, 1–300 caracteres |
| `body` | TEXT | NOT NULL DEFAULT `''` |
| `keywords` | TEXT | NOT NULL DEFAULT `''`; alias y etiquetas |
| `entity_type_id` | TEXT | NULL; tipo de la ficha |
| `status` | TEXT | NOT NULL (`active`, `draft`, `archived`) |
| `is_favorite` | INTEGER | NOT NULL DEFAULT 0, 0/1 |
| `created_at` | INTEGER | NOT NULL |
| `updated_at` | INTEGER | NOT NULL |

Índices: único `search_documents_kind_source_uq (kind, source_id)`;
`search_documents_world_kind_idx (world_id, kind, updated_at)`;
`search_documents_world_updated_idx (world_id, updated_at)`;
`search_documents_type_idx (entity_type_id)`; `search_documents_favorite_idx
(is_favorite)`; `search_documents_context_idx (kind, context_id)` y
`search_documents_related_idx (kind, related_id)`.

`search_fts` es una tabla virtual FTS5:

```sql
CREATE VIRTUAL TABLE search_fts USING fts5(
  title,
  body,
  keywords,
  content='search_documents',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3 4'
);
```

`search_vocabulary` usa `fts5vocab(search_fts, 'row')` para la expansión
aproximada de términos. Las vistas `search_world_documents`,
`search_entity_documents` y `search_relation_documents` definen qué texto y
metadatos produce cada tipo; excluyen filas borradas y mundos en papelera. Desde
`0008_world_description`, `search_world_documents` lee
`coalesce(summary, '') || char(10) || coalesce(description_text, '')`:
**el mundo nunca indexa el JSON de su descripción**. Los
triggers de `worlds`, `entities`, `relations`, `relation_types`, `entity_tags` y
`tags` mantienen `search_documents`, y los triggers `search_documents_ai`,
`search_documents_ad` y `search_documents_au` mantienen `search_fts`. La reconstrucción completa sanea
FTS5, elimina los documentos que ya no existen en las vistas, los repuebla desde
ellas y vuelve a reconstruir el índice; se ofrece desde la paleta `Ctrl+K` y más
adelante desde Ajustes → Datos.

### 4.14 `entity_versions`

**Implementada en `0007_trash_versions` (M1-06, #77).** Historial de la
descripción de las fichas. SQL real:

```sql
CREATE TABLE `entity_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`description` text,
	`description_text` text,
	`label` text,
	`origin` text DEFAULT 'auto' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "entity_versions_origin_check" CHECK("entity_versions"."origin" in ('auto', 'manual', 'restore')),
	CONSTRAINT "entity_versions_label_check" CHECK("entity_versions"."label" is null or length("entity_versions"."label") between 1 and 120),
	CONSTRAINT "entity_versions_description_check" CHECK("entity_versions"."description" is null or (json_valid("entity_versions"."description") AND json_type("entity_versions"."description") = 'object')),
	CONSTRAINT "entity_versions_text_check" CHECK("entity_versions"."description_text" is null or length("entity_versions"."description_text") <= 50000)
);
CREATE INDEX `entity_versions_entity_created_idx` ON `entity_versions` (`entity_id`,`created_at` desc,`id` desc);
```

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `entity_id` | TEXT | NOT NULL, FK `entities(id)` **ON DELETE CASCADE** | Ficha dueña de la versión. |
| `description` | TEXT | NULL, CHECK JSON objeto | Documento ProseMirror íntegro; `NULL` = descripción vacía. |
| `description_text` | TEXT | NULL, CHECK ≤ 50 000 | Texto plano para vista previa, búsqueda y exportación. |
| `label` | TEXT | NULL, CHECK 1–120 | Etiqueta obligatoria solo en las manuales. |
| `origin` | TEXT | NOT NULL DEFAULT `'auto'`, CHECK | `auto`, `manual` o `restore`; la interfaz traduce el valor, la base nunca guarda texto localizado. |
| `created_at` | INTEGER | NOT NULL | Inicio de la ráfaga, momento de la manual o de la restauración. |

Índice: `entity_versions_entity_created_idx (entity_id, created_at DESC, id
DESC)` para el historial y la poda.

Reglas (ADR 0028):

- Una **automática** guarda el **estado saliente** solo si la descripción cambia
  de verdad y la última automática está fuera de la ventana de 5 minutos. Una
  descripción saliente vacía no se versiona.
- Se conservan **20 automáticas por ficha** con **retención de 90 días**; la más
  reciente nunca se poda.
- Las **manuales** llevan etiqueta obligatoria y su tope es **50 por ficha**, sin
  caducidad. Al alcanzarlo, no se crea otra (`manual-limit`).
- **Restaurar** una versión inserta antes una copia `origin: 'restore'` del estado
  actual y esta no se poda nunca; después aplica la versión elegida y poda
  automáticas.
- El historial se lista solo para fichas vivas y nunca devuelve el JSON
  histórico completo, solo metadatos y una vista previa de 2 000 caracteres.
- El borrado lógico de la ficha no toca las versiones; la purga las elimina en
  cascada. En modo seguro el servicio está `unavailable`.

### 4.15 Importación de un mundo (#78)

**No hay migración adicional para importar.** La importación usa las tablas
existentes —incluida `description_text`, que se recalcula al escribir el mundo—
en **una única transacción** y respeta las claves foráneas con este orden de
inserción. `user_version` vale **9** desde `0008_world_description`. Antes de
leer `world.json` o extraer assets, rechaza con `TRANSFER_FORMAT_UNSUPPORTED` un
manifiesto cuyo `schemaVersion` supere el `user_version` instalado; los valores
iguales o anteriores se aceptan.

El orden de inserción es:

1. `worlds` (mundo nuevo, `status = 'active'`, `settings = '{}'`, sin portada
   todavía).
2. `entity_types` (solo los personalizados del paquete; los 18 del sistema se
   resuelven por clave y no se duplican).
3. `relation_types` (solo los personalizados; los del sistema por clave).
4. `tags`.
5. `assets` (con `world_id` nuevo, `kind = 'image'`, `mime = 'image/webp'`, ruta
   relativa reconstruida y SHA-256 verificado).
6. `entities`.
7. `entity_tags`.
8. `entity_gallery`.
9. `entity_versions`.
10. `relations`.
11. Renombrar `assets/.tmp/<operationId>/<worldId>` a
    `assets/worlds/<worldId>` **antes del commit**.
12. `UPDATE worlds SET cover_asset_id = …` con la portada remapeada.
13. `activity_log` con `action = 'world.imported'`, `entity_type = 'world'`,
    `entity_id = NULL` y un `diff` con los recuentos y el total de avisos.

Después se confirma la transacción. Si algo falla antes del commit, la
transacción revierte y el directorio publicado se elimina.

> **Assets sin FK a `worlds` hasta #116.** La tabla `assets` conserva su
> `world_id` sin clave foránea (sección 4.7). La importación siempre inserta un
> `world_id` válido del mundo recién creado, pero la base no lo impone todavía;
> la FK y la cuarentena de huérfanos llegan con #116. Un cierre abrupto entre el
> renombrado y el commit puede dejar assets sin mundo, nunca un mundo parcial.

## 5. Reglas de integridad

1. Borrar contenido es lógico (`deleted_at`) y la purga es una acción separada,
   confirmada y precedida de una copia verificable. La purga nunca acepta una
   fila viva y un mundo se elimina en orden explícito, empezando por
   `activity_log`.
2. Un asset referenciado por una entidad, mapa o escena no se purga hasta que
   la referencia desaparece. #77 no borra filas ni archivos de `assets` al
   purgar; los huérfanos y la FK `assets.world_id` llegan con #116.
3. `entity_types` y `relation_types` del sistema (`world_id IS NULL`) no se
   editan ni se borran desde la app; se pueden duplicar por mundo.
4. Las relaciones no admiten origen igual a destino.
5. Las posiciones (`position`) son `REAL` para insertar entre elementos sin
   reescribir toda la lista.
6. Los textos ricos se guardan como JSON de ProseMirror; `content_text` y
   `description_text` son la versión plana para búsqueda y exportación.
7. Los borrados lógicos no eliminan assets ni versiones; la purga es explícita.
   Purgar una ficha borra sus versiones en cascada y purgar un mundo borra el
   historial de sus fichas, mientras los archivos de assets permanecen.
8. Los triggers de `updated_at` se aplican en la aplicación y en SQLite para
   evitar filas con fecha vieja.

## 6. Índices y rendimiento

- Toda consulta de lista filtra por `world_id` y `deleted_at`.
- Búsqueda por nombre con índice; búsqueda de texto completo con FTS5.
- Grafos: se cargan por lotes y se filtran por tipo; no se hace `SELECT *` de
  todas las relaciones de un mundo grande.
- Escenas: se cargan por capítulo y se paginan; el editor no carga el manuscrito
  completo.
- Analítica ligera con `EXPLAIN QUERY PLAN` en las consultas de lista y
  búsqueda antes de cerrar una issue de M1.

## 7. Cambios de esquema

Cualquier cambio de tabla, columna, índice o trigger requiere:

1. Cambiar el esquema Drizzle en `src/main/db/schema/`.
2. Generar una migración nueva con `pnpm db:generate` (nunca editar una
   aplicada).
3. Revisar el SQL y ejecutar `pnpm db:check`.
4. Actualizar este documento y [`migraciones.md`](migraciones.md).
5. Una prueba de preservación de datos sobre una base temporal.
6. Revisión de seguridad si afecta a rutas, assets o importación.
7. Actualizar el manual si el cambio es visible.

## 8. Documentos relacionados

- [Persistencia](../persistencia.md)
- [Migraciones](migraciones.md)
- [Continuidad](../continuidad.md)
- [Arquitectura](../arquitectura.md)
- [ADR 0002](../adr/0002-sqlite-better-sqlite3-drizzle-fts5.md)
- [ADR 0005](../adr/0005-local-assets-custom-protocol.md)
- [ADR 0016](../adr/0016-sqlite-migrations-safe-mode.md)
- [ADR 0017](../adr/0017-assets-service-sharp-orphan-purge.md)
- [ADR 0028](../adr/0028-trash-versions-and-pre-purge-backup.md)
- [ADR 0029](../adr/0029-world-export-import.md)
