# Migraciones de base de datos

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio).
> **Ámbito:** creación, aplicación, verificación y reversión de migraciones
> SQLite. El esquema vigente está en [`esquema.md`](esquema.md).

## 1. Principios

1. **Nunca se edita una migración aplicada.** Un cambio se corrige con una
   migración nueva.
2. **Siempre hay copia previa.** Antes de aplicar migraciones se crea una copia
   verificable en `backups/pre-migration/`.
3. **Transacción.** Cada migración se aplica dentro de una transacción; si
   falla, la base queda como estaba.
4. **Prueba sobre base temporal.** Ninguna migración se publica sin probarla
   contra una copia de una base realista.
5. **Preservación de datos.** Toda migración que toque datos existentes incluye
   una prueba que compara filas antes y después.
6. **Modo seguro.** Si una migración falla o la integridad falla, la app arranca
   sin escribir y ofrece restaurar la copia.

## 2. Herramientas

- **Drizzle Kit** genera el SQL de las migraciones a partir del esquema
  TypeScript de `src/main/db/schema/`.
- El SQL generado se revisa a mano; no se acepta SQL opaco ni `drizzle-kit push`
  en producción.
- **better-sqlite3** aplica las migraciones en el proceso principal.
- **Vitest** prueba el esquema y las migraciones sobre archivos temporales.
- La tabla `schema_migrations` y `PRAGMA user_version` registran el estado.

Las rutas `src/main/db/`, `drizzle/` y los scripts de migración se crearán en
la issue de scaffold de M0; hasta entonces este documento describe el contrato.
No se presentan como existentes.

## 3. Flujo de una migración

### 3.1 Crear

1. Cambiar el esquema Drizzle en `src/main/db/schema/`.
2. Generar la migración con Drizzle Kit (comando previsto en `package.json`).
3. Revisar el SQL: tipos, `NOT NULL`, defaults, claves foráneas, índices y
   triggers.
4. Añadir el rollback documentado en `drizzle/rollback/` si la migración es
   destructiva o cambia tipos.
5. Actualizar [`esquema.md`](esquema.md) y este documento.
6. Añadir la prueba de migración y la de preservación.

### 3.2 Revisar

Checklist obligatoria:

- [ ] El SQL es idempotente o está protegido por la versión.
- [ ] No hay `DROP` sin copia ni sin plan de recuperación.
- [ ] Las columnas nuevas son `NULL` o tienen default.
- [ ] Los índices nuevos no duplican uno existente.
- [ ] Las claves foráneas no dejan huérfanos.
- [ ] Los triggers de búsqueda y `updated_at` siguen coherentes.
- [ ] El rollback está documentado o se justifica por qué no aplica.
- [ ] La prueba de preservación compara datos antes y después.

### 3.3 Aplicar al arrancar

```text
1. Abrir SQLite en modo lectura para comprobar integridad.
2. Leer PRAGMA user_version y schema_migrations.
3. Si hay migraciones pendientes:
   a. Crear copia pre-migration y verificarla.
   b. Abrir transacción.
   c. Aplicar en orden, actualizando schema_migrations y user_version.
   d. Commit.
4. Si falla:
   a. Rollback de la transacción.
   b. Conservar la copia.
   c. Arrancar en modo seguro y mostrar el error con código estable.
5. Si no hay pendientes, continuar.
```

La ventana no muestra datos hasta que termina la comprobación y la migración.
Si tarda, se muestra una pantalla de progreso con la fase actual.

### 3.4 Revertir

- **Reversión automática:** solo la transacción fallida; SQLite deshace los
  cambios.
- **Reversión manual:** restaurar la copia pre-migración desde Ajustes →
  Copias. Antes de restaurar se crea una copia `pre-restore` de la base actual.
- **Rollback de esquema:** los archivos de `drizzle/rollback/` son documentación
  y SQL de referencia; no se ejecutan automáticamente en producción. La vía
  segura es restaurar la copia.
- Nunca se hace downgrade de la app con una base migrada sin copia: la app
  detecta una versión de esquema superior y se niega a escribir.

## 4. Convenciones de nombres

```text
drizzle/
  0000_init.sql
  0001_worlds_and_entities.sql
  0002_assets_and_maps.sql
  0003_writing.sql
  0004_game.sql
  0005_search.sql
  meta/
    _journal.json
  rollback/
    0001_worlds_and_entities.down.sql
```

- Cuatro dígitos, secuencia sin huecos.
- Nombre en `snake_case` y en inglés.
- Una migración por cambio coherente; no mezclar dominios no relacionados.
- El journal de Drizzle se versiona.

## 5. Pruebas

| Prueba | Qué comprueba |
|---|---|
| `schema` | Que el esquema Drizzle y el SQL aplicado coinciden. |
| `migrations` | Que una base vacía llega a la última versión sin errores. |
| `preservation` | Que los datos existentes siguen ahí tras migrar. |
| `integrity` | `PRAGMA integrity_check` y claves foráneas. |
| `rollback` | Que el SQL de rollback es válido sobre una base temporal. |
| `safe-mode` | Que una migración rota deja la app en modo seguro y permite restaurar. |

Las pruebas usan archivos temporales en el directorio de pruebas, nunca la base
del usuario. La CI ejecuta las pruebas sin datos reales ni credenciales.

## 6. Datos iniciales

- El catálogo del sistema (tipos de entidad, tipos de relación y tablas de
  juego) se guarda como JSON versionado y se inserta con un seed idempotente.
- El seed no sobrescribe personalizaciones del usuario.
- Las tablas del sistema se marcan `is_system = 1`; el usuario puede
  duplicarlas, no editarlas.
- El contenido de ejemplo de un mundo se crea solo si el usuario lo pide.

## 7. Operación y diagnóstico

- Ajustes → Datos muestra la versión de esquema, el número de migraciones
  aplicadas, el tamaño de la base y el estado de integridad.
- Ajustes → Datos → «Verificar base» ejecuta `integrity_check` y
  `foreign_key_check` y muestra un informe.
- Ajustes → Datos → «Reconstruir búsqueda» ejecuta el rebuild de FTS5.
- Ajustes → Datos → «Compactar base» ejecuta `VACUUM` con confirmación y copia
  previa.
- Los errores de migración usan códigos estables (`DB_MIGRATION_FAILED`,
  `DB_INTEGRITY_FAILED`, `DB_VERSION_AHEAD`) y no muestran SQL interno.

## 8. Qué no se hace

- No se usa `drizzle-kit push` contra la base del usuario.
- No se ejecutan migraciones desde el renderer.
- No se descargan migraciones de Internet.
- No se comparte la base entre equipos ni se sincroniza.
- No se edita una migración ya publicada; se crea otra.

## 9. Documentos relacionados

- [Esquema](esquema.md)
- [Persistencia](../persistencia.md)
- [Continuidad](../continuidad.md)
- [Plan de pruebas](../calidad/plan-de-pruebas.md)
- [ADR 0002](../adr/0002-sqlite-better-sqlite3-drizzle-fts5.md)
- [ADR 0012](../adr/0012-backup-restore-recovery.md)
