# Esquema de base de datos

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio). La migración
> `0000_init` y las tablas `schema_migrations` y `app_settings` están
> implementadas en M0-04 (#64). Las tablas de dominio y FTS5 llegan en M1 con
> sus propias migraciones; hasta entonces figuran como previstas.
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
- Borrado lógico con `deleted_at INTEGER NULL` en contenido; la papelera
  conserva el registro y los assets hasta la purga.
- `world_id` obligatorio en todo el contenido de un mundo, directo o derivado
  mediante claves foráneas.
- `ON DELETE CASCADE` en hijas de contenido; `RESTRICT` en referencias que no
  deben quedar huérfanas.
- Triggers de `updated_at` en las tablas que lo necesitan.

## 2. Diagrama

Modelo objetivo (las tablas de contenido llegan en M1; implementadas hoy solo
`app_settings` y `schema_migrations`):

```text
worlds
  ├─< entity_types
  ├─< entities >─< relations >─ relation_types
  │      ├─< entity_tags >─ tags
  │      └─< assets
  ├─< maps >─< map_entity_links
  ├─< manuscripts >─< books >─< chapters >─< scenes >─< scene_versions
  ├─< game_tables >─< game_table_entries
  ├─< game_sessions
  └─< activity_log

game_content_packs >─ game_tables
app_settings
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
guarda el **número de migraciones aplicadas**: con `0000_init` vale 1, no 0 ni el
prefijo de la etiqueta. El runner contrasta ese valor con
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
| `key` | TEXT | PK | Clave de ajuste (`theme`, `locale`, `window`, `backup`). |
| `value` | TEXT | NOT NULL | JSON validado por la app. |
| `updated_at` | INTEGER | NOT NULL | Última actualización en milisegundos UTC. |

## 4. Mundos y contenido

**Previstas para M1.** Las tablas de esta sección describen el modelo objetivo;
ninguna existe todavía en `0000_init`.

### 4.1 `worlds`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `name` | TEXT | NOT NULL | Nombre visible. |
| `slug` | TEXT | NOT NULL, UNIQUE | Identificador estable. |
| `summary` | TEXT | NULL | Sinopsis breve. |
| `description` | TEXT | NULL | JSON ProseMirror. |
| `cover_asset_id` | TEXT | FK `assets(id)`, NULL | Portada. |
| `genres` | TEXT | NOT NULL DEFAULT `'[]'` | JSON de géneros. |
| `status` | TEXT | NOT NULL DEFAULT `'active'` | `active`, `archived`. |
| `settings` | TEXT | NOT NULL DEFAULT `'{}'` | Preferencias del mundo. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |
| `archived_at` | INTEGER | NULL | Archivo. |
| `deleted_at` | INTEGER | NULL | Papelera. |

Índices: `worlds_slug_uq (slug)`, `worlds_status_idx (status, deleted_at)`.

### 4.2 `entity_types`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | FK `worlds(id)`, NULL | `NULL` = tipo del sistema. |
| `key` | TEXT | NOT NULL | Clave estable (`character`, `place`). |
| `name` | TEXT | NOT NULL | Nombre visible. |
| `icon` | TEXT | NOT NULL | Nombre de icono Lucide. |
| `color` | TEXT | NOT NULL | Token de color validado. |
| `fields` | TEXT | NOT NULL DEFAULT `'[]'` | JSON de campos personalizados. |
| `is_system` | INTEGER | NOT NULL DEFAULT 0 | 1 si es del sistema. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |

Índices: `entity_types_world_key_uq (world_id, key)`,
`entity_types_system_key_uq (key) WHERE world_id IS NULL`.

### 4.3 `entities`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` | Mundo. |
| `type_id` | TEXT | NOT NULL, FK `entity_types(id)` | Tipo. |
| `name` | TEXT | NOT NULL | Nombre. |
| `slug` | TEXT | NOT NULL | Identificador estable por mundo. |
| `aliases` | TEXT | NOT NULL DEFAULT `'[]'` | JSON de alias. |
| `summary` | TEXT | NULL | Resumen corto. |
| `description` | TEXT | NULL | JSON ProseMirror. |
| `description_text` | TEXT | NULL | Texto plano para búsqueda. |
| `image_asset_id` | TEXT | FK `assets(id)`, NULL | Imagen principal. |
| `attributes` | TEXT | NOT NULL DEFAULT `'{}'` | Campos personalizados. |
| `status` | TEXT | NOT NULL DEFAULT `'active'` | `active`, `draft`, `archived`. |
| `is_favorite` | INTEGER | NOT NULL DEFAULT 0 | Favorito. |
| `created_at` | INTEGER | NOT NULL | Creación. |
| `updated_at` | INTEGER | NOT NULL | Actualización. |
| `deleted_at` | INTEGER | NULL | Papelera. |

Índices: `entities_world_slug_uq (world_id, slug)`,
`entities_world_type_idx (world_id, type_id, deleted_at)`,
`entities_name_idx (world_id, name)`,
`entities_favorite_idx (world_id, is_favorite)`.

### 4.4 `relation_types`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | FK `worlds(id)`, NULL | `NULL` = tipo del sistema. |
| `key` | TEXT | NOT NULL | Clave estable. |
| `name` | TEXT | NOT NULL | Nombre directo. |
| `inverse_name` | TEXT | NOT NULL | Nombre inverso. |
| `color` | TEXT | NOT NULL | Token de color. |
| `is_system` | INTEGER | NOT NULL DEFAULT 0 | Tipo del sistema. |

Índices: `relation_types_world_key_uq (world_id, key)`,
`relation_types_system_key_uq (key) WHERE world_id IS NULL`.

### 4.5 `relations`

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

Regla: `source_id <> target_id` con `CHECK`.

### 4.6 `tags` y `entity_tags`

`tags`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` |
| `name` | TEXT | NOT NULL |
| `color` | TEXT | NOT NULL |
| `created_at` | INTEGER | NOT NULL |

Índice: `tags_world_name_uq (world_id, name)`.

`entity_tags`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `entity_id` | TEXT | PK, FK `entities(id)` ON DELETE CASCADE |
| `tag_id` | TEXT | PK, FK `tags(id)` ON DELETE CASCADE |

### 4.7 `assets`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | TEXT | PK | UUIDv7. |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` | Mundo. |
| `kind` | TEXT | NOT NULL | `image`, `map`, `document`, `other`. |
| `relative_path` | TEXT | NOT NULL | Ruta relativa a `assets/`. |
| `mime` | TEXT | NOT NULL | MIME real validado. |
| `size` | INTEGER | NOT NULL | Bytes. |
| `width` | INTEGER | NULL | Ancho en píxeles. |
| `height` | INTEGER | NULL | Alto en píxeles. |
| `alt` | TEXT | NULL | Texto alternativo. |
| `hash` | TEXT | NOT NULL | SHA-256. |
| `created_at` | INTEGER | NOT NULL | Creación. |

Índices: `assets_world_idx (world_id)`, `assets_hash_idx (hash)`.

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

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` |
| `action` | TEXT | NOT NULL |
| `entity_type` | TEXT | NOT NULL |
| `entity_id` | TEXT | NULL |
| `diff` | TEXT | NOT NULL DEFAULT `'{}'` |
| `created_at` | INTEGER | NOT NULL |

Índice: `activity_log_world_created_idx (world_id, created_at DESC)`.

### 4.13 `search_documents` y `search_fts`

`search_documents`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | TEXT | PK |
| `world_id` | TEXT | NOT NULL, FK `worlds(id)` |
| `kind` | TEXT | NOT NULL (`entity`, `map`, `scene`, `game`) |
| `ref_id` | TEXT | NOT NULL |
| `title` | TEXT | NOT NULL |
| `body` | TEXT | NOT NULL DEFAULT `''` |
| `updated_at` | INTEGER | NOT NULL |

Índice único: `search_documents_ref_uq (kind, ref_id)`.

`search_fts` es una tabla virtual FTS5:

```sql
CREATE VIRTUAL TABLE search_fts USING fts5(
  title,
  body,
  content='search_documents',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
```

Triggers `search_documents_ai`, `search_documents_ad` y `search_documents_au`
mantienen el índice. La reconstrucción completa se hace con
`INSERT INTO search_fts(search_fts) VALUES('rebuild')` desde Ajustes → Datos.

## 5. Reglas de integridad

1. Un mundo no se borra físicamente si tiene contenido activo; primero se
   archiva o se mueve a papelera.
2. Un asset referenciado por una entidad, mapa o escena no se purga hasta que
   la referencia desaparece.
3. `entity_types` y `relation_types` del sistema (`world_id IS NULL`) no se
   editan ni se borran desde la app; se pueden duplicar por mundo.
4. Las relaciones no admiten origen igual a destino.
5. Las posiciones (`position`) son `REAL` para insertar entre elementos sin
   reescribir toda la lista.
6. Los textos ricos se guardan como JSON de ProseMirror; `content_text` y
   `description_text` son la versión plana para búsqueda y exportación.
7. Los borrados lógicos no eliminan assets ni versiones; la purga es explícita.
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
- [ADR 0016](../adr/0016-sqlite-migrations-safe-mode.md)
