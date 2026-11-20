# ADR 0019 — Mundos del MVP: CRUD, actividad y borrado lógico

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-20
- **Fecha del documento:** 2026-11-20
- **Issue:** #72
- **Decisiones del registro:** D-042
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0006, ADR 0009, ADR 0010, ADR 0011, ADR 0016

## Contexto

El mundo es la unidad que agrupa fichas, mapas, manuscritos y partidas. M1-01 es
el primer CRUD completo con datos, UI y validación, y fija decisiones que el
resto de M1 va a heredar: modelo de la tabla, unicidad del identificador,
borrado, actividad, portada, idioma y forma de exponer el dominio al renderer.

La issue define el alcance y los criterios, pero no concreta cuatro puntos que
afectan a datos y experiencia:

1. No existe todavía un selector de imágenes, así que la portada no se puede
   elegir desde la interfaz.
2. El editor de texto enriquecido compartido llega con las fichas y el
   manuscrito; la descripción del mundo no debe adelantar un formato que luego
   haya que migrar a ciegas.
3. La papelera visible es M1-06 y `assets` todavía no tiene clave foránea a
   `worlds`.
4. El idioma del contenido no estaba en el esquema objetivo.

## Decisión

1. **`worlds` como raíz con borrado lógico.** La migración `0002_worlds` crea
   `worlds` y `activity_log`. El mundo se archiva (`status` y `archived_at`) o se
   mueve a la papelera (`deleted_at`); no se borra físicamente. La papelera
   visible, la restauración y la purga llegan con M1-06 (#77).
2. **Slug global, estable y único.** `slug` tiene índice único en toda la base,
   incluidas las filas archivadas y en papelera. Si el usuario no lo escribe, se
   genera a partir del nombre; si ya existe, se añade `-2`, `-3`… sin superar 80
   caracteres. Renombrar no cambia el slug salvo que el usuario lo cambie.
3. **Dominio puro separado de IPC.** `src/main/worlds/` contiene normalización,
   slugs, repositorio Drizzle y servicio con reloj e IDs inyectables. Los
   handlers traducen `WorldInputError` a `INVALID_INPUT`; el resto de errores es
   `INTERNAL_ERROR`. El renderer solo ve los tipos de `src/shared/contracts/worlds.ts`
   y el preload valida su forma con guardas.
4. **Actividad con aislamiento explícito.** Cada mutación escribe en
   `activity_log` con `world_id`, acción, entidad y un `diff` JSON. La lista
   global del dashboard hace `JOIN` con `worlds` y excluye mundos en papelera; la
   consulta de un mundo filtra por `world_id`. El renderer muestra siempre el
   nombre del mundo junto a la acción.
5. **Portada diferida sin romper el modelo.** `cover_asset_id` es una FK
   nullable a `assets(id)` con `RESTRICT` y el renderer la muestra con
   `wc-asset://` si existe. El selector y la importación llegan con #115; la
   duplicación no copia la portada porque el asset pertenece al mundo original.
6. **Descripción en texto plano hasta #114.** `description` es `TEXT` y se edita
   con un área de texto. Cuando exista el editor compartido, #114 migrará a JSON
   de ProseMirror con `description_text` y rollback documentado.
7. **Idioma del contenido.** `language` admite `es`, `en` e `it`, con `es` por
   defecto y `CHECK` en SQLite. No es el idioma de la interfaz: el catálogo de
   i18n sigue resolviéndose aparte.
8. **Estado de UI sin router.** `App` mantiene vista, biblioteca, mundo
   seleccionado, diálogos y avisos. Inicio es el dashboard, Mundos la lista y la
   página de un mundo muestra ficha, progreso, actividad y accesos previstos. La
   navegación es por botones con `aria-current`; no se añade una librería de
   rutas para una sola ventana.
9. **Componentes nuevos nativos.** Se añaden `text-area-field` y `select-field`
   sobre los tokens existentes, y componentes de dominio en
   `src/renderer/components/worlds/`. No se añaden dependencias de UI.

## Alternativas consideradas

- **Tabla de miembros o propietario por mundo.** Se descarta: el modelo es de un
  solo usuario local (ADR 0011) y añadir autenticación no aporta nada al MVP.
- **Borrado físico con confirmación.** Se descarta por la regla de preservación
  de datos y porque la papelera de M1-06 necesita el registro lógico.
- **Descripción como JSON de ProseMirror desde el principio.** Se descarta
  adelantar un formato sin editor: obligaría a inventar documentos y a migrarlos
  después. El texto plano es reversible y honesto.
- **Guardar la portada como BLOB en `worlds`.** Se descarta: rompe el protocolo
  `wc-asset://`, la miniatura y la purga recuperable de ADR 0005/0017.
- **Slug generado siempre y no editable.** Se descarta porque la issue incluye el
  campo y las exportaciones necesitan un identificador legible; se mantiene
  editable con validación y sufijo automático.
- **Librería de router en el renderer.** Se descarta por peso y porque el shell
  de una sola ventana ya resuelve la navegación con estado y foco.

## Consecuencias

- El esquema queda preparado para fichas, mapas, manuscritos y juego sin cambiar
  la raíz; cada tabla nueva añadirá su FK a `worlds`.
- La actividad crece con cada acción y de momento se limita a 12 elementos en el
  dashboard. La paginación y los filtros llegarán con búsqueda y papelera.
- Las filas en papelera se conservan hasta M1-06. La lista normal y la actividad
  ya las excluyen, de modo que no aparecen en la interfaz.
- La portada existe en datos pero no se puede elegir hasta #115; el progreso del
  mundo no la cuenta para que un mundo pueda llegar al 100 % sin ella.
- La descripción en texto plano requerirá una migración en #114. El esquema
  documenta el cambio y la copia previa es obligatoria.
- `assets.world_id` sigue sin FK hasta #116; el aislamiento por `world_id` ya se
  aplica en consultas y el protocolo valida la ruta.

## Impacto

- **Ventana:** la rejilla de tarjetas usa `auto-fit` con mínimo de 18 rem y la
  ficha una columna de portada de 10 rem. Los E2E comprueban 1024, 1280 y 1600 px
  con nombre y resumen sin espacios.
- **Temas:** todos los estilos nuevos usan tokens de `semantic.css`. Los dos
  temas se revisan con axe; no hay colores literales.
- **Accesibilidad:** diálogos nativos con foco atrapado y retorno al disparador,
  etiquetas visibles, errores con `aria-invalid`/`aria-describedby`, progreso con
  `role="progressbar"` y avisos con `aria-live`.
- **Seguridad:** canales en allowlist, Zod estricto, sin Node en el renderer,
  guardas en el preload y ningún contenido remoto.
- **Datos:** migración con copia previa, rollback de referencia y prueba de
  preservación; el cierre y la reapertura conservan mundos y actividad.
- **Coste:** 0 €/mes; no se añaden dependencias ni servicios.

## Riesgos

- **Actividad sin límite de retención.** Se mitiga con el límite de consulta y se
  revisará con la papelera y la búsqueda.
- **Slug automático con sufijos largos.** Se mitiga recortando la base y probando
  el límite de 80 caracteres.
- **Migración futura de la descripción.** Se mitiga con copia previa, conversión
  documentada y pruebas de preservación en #114.
- **Portada sin selector durante varias versiones.** Se mitiga mostrando la nota
  en el formulario y marcando la función como prevista en el manual.
