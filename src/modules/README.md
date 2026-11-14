# Módulos de dominio

Cada carpeta de `src/modules/` agrupa un dominio del producto y su lógica de
negocio: `worlds` (mundos y membresías), `entities` (fichas y relaciones),
`maps`, `graph`, `manuscript` y `search`. Dentro de cada módulo, el código se
ordena en tres capas solo cuando el dominio tiene reglas reales:

- **dominio:** tipos, validadores con Zod y funciones puras (por ejemplo, el
  conteo de palabras o las reglas de un rol).
- **aplicación:** casos de uso que orquestan dominio, persistencia y permisos.
- **infraestructura:** acceso a Supabase, R2 o servicios externos.

Las capas no se crean por adelantado: aparecen cuando una regla lo justifica
(DDD pragmático, `AGENTS.md`). Los componentes de presentación viven en
`src/components/` y no contienen lógica de negocio.

El scaffold (M0-06, issue #7) deja la carpeta preparada sin módulos todavía: el
primero llega con el CRUD de mundos (M1-02).
