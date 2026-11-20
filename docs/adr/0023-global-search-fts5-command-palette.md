# ADR 0023 — Búsqueda global FTS5 y paleta de comandos

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-20
- **Fecha del documento:** 2026-11-20
- **Issue:** #76
- **Decisiones del registro:** D-046
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0006, ADR 0009, ADR 0010, ADR 0011, ADR 0016, ADR 0019, ADR 0020, ADR 0021, ADR 0022

## Contexto

M1-05 (#76) necesitaba encontrar cualquier contenido de la biblioteca sin
conexión y ofrecer una paleta de comandos para navegar y actuar desde el
teclado. La issue fijaba FTS5, prefijos, tolerancia razonable a errores, filtros
por mundo, tipo, etiqueta y estado, resaltado, recientes, favoritos,
reconstrucción del índice y menos de 150 ms con 10.000 fichas. Quedaban abiertas
varias decisiones:

1. Qué se indexa y cómo se mantiene sincronizado con las tablas de contenido.
2. Cómo representar documentos de distinto tipo en una sola búsqueda.
3. Cómo ofrecer tolerancia a errores sin un servicio externo ni un índice extra.
4. Cómo filtrar y resaltar sin transportar HTML al renderer.
5. Cómo se reconstruye el índice y qué pasa con las tablas que aún no existen.
6. Cómo evitar que el atajo `Ctrl+K` interfiera con campos de texto y diálogos.

## Decisión

1. **Migración `0006_search` aditiva.** Crea `search_documents` con `kind`,
   `source_id`, `context_id`, `related_id`, `world_id`, `title`, `body`,
   `keywords`, `entity_type_id`, `status`, `is_favorite` y marcas de tiempo. La
   clave única es `(kind, source_id)` y `world_id` tiene clave foránea con
   cascada. `user_version` pasa a 7 y el rollback de referencia elimina solo los
   objetos del índice. No se edita ninguna migración anterior.
2. **`search_documents` es un índice reconstruible, no la fuente de verdad.**
   Cada fila resume un documento. La tabla virtual `search_fts` indexa `title`,
   `body` y `keywords` con `unicode61`, `remove_diacritics 2` y prefijos 2, 3 y
   4. `search_vocabulary` (`fts5vocab`) expone el vocabulario para la expansión
   aproximada.
3. **Vistas y triggers por tipo.** `search_world_documents`,
   `search_entity_documents` y `search_relation_documents` definen qué texto y
   metadatos produce cada tipo. Los triggers de `worlds`, `entities`, `relations`,
   `relation_types`, `entity_tags` y `tags` insertan, actualizan o borran el
   documento; los triggers de `search_documents` mantienen `search_fts`. Borrar
   una ficha o una relación, restaurarla, cambiar el estado o cambiar sus
   etiquetas se refleja sin ejecutar SQL desde la interfaz.
4. **Se indexa lo que existe.** Mundos, fichas y relaciones entran en el índice.
   Los tipos `map`, `manuscript` y `scene` quedan reservados en el `CHECK` para
   las migraciones de M2 (mapas) y M3 (manuscritos y escenas); no se crean
   tablas ni documentos vacíos que no existan.
5. **Los documentos de relación indexan etiquetas y notas, no los nombres de las
   fichas.** Los personajes y lugares ya tienen su propio documento; incluir sus
   nombres en la arista obligaría a cascadas al renombrar. La relación conserva
   `context_id` (ficha de origen) para abrir el resultado en su contexto.
6. **Prefijos y tolerancia acotada.** La consulta se normaliza, se divide en
   tokens, se entrecomilla y se convierte en prefijos unidos por `AND`. Si no hay
   coincidencias exactas, se buscan términos del vocabulario con la misma inicial
   y distancia de Levenshtein 1 (2 en palabras largas), se amplía el `MATCH` con
   alternativas y se avisa en la interfaz. No hay servicio externo, ni índice
   difuso adicional, ni corrección que cambie la consulta del usuario.
7. **Resaltado seguro.** `highlight` y `snippet` devuelven texto con marcadores
   de control, nunca HTML. El renderer los divide y crea nodos de React; no se usa
   `dangerouslySetInnerHTML`.
8. **Filtros combinables en SQL.** Mundo, tipo de documento, tipo de ficha,
   etiqueta y estado se aplican con parámetros enlazados. El tipo de ficha y la
   etiqueta solo afectan a documentos de ficha. El `COUNT` usa el mismo `WHERE`
   que la lista para que el total sea coherente.
9. **Recientes y favoritos sin historial nuevo.** El estado vacío muestra los
   documentos ordenados por `updated_at` y las fichas con `is_favorite = 1`. No
   se guarda un historial de búsquedas ni de visitas.
10. **Reconstrucción explícita.** `search:rebuild` sanea FTS5, elimina de
    `search_documents` los documentos que ya no existen en las vistas, los
    repuebla desde ellas y reconstruye el índice, todo en una transacción. No
    toca mundos, fichas ni relaciones. Se ofrece desde la paleta hasta que
    exista la pantalla de Ajustes → Datos.
11. **Paleta de comandos accesible.** `Ctrl+K` abre un diálogo modal con patrón
    combobox/listbox: el foco permanece en el campo, `aria-activedescendant`
    apunta a la opción activa y las flechas, Inicio, Fin, Enter y Escape se
    gestionan en el campo. El atajo se ignora dentro de `input`, `textarea`,
    `select` o contenido editable y con un diálogo abierto. La paleta reúne
    comandos de navegación, creación, tema y reconstrucción, además de resultados
    rápidos; «Ver todos» abre la página de búsqueda con la consulta.
12. **Frontera de confianza intacta.** `search:query`, `search:suggestions` y
    `search:rebuild` están en la allowlist, usan Zod estricto, límites de consulta
    y `LIMIT` acotado. El preload comprueba la forma con guardas y el renderer
    nunca recibe objetos de SQLite ni HTML.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Buscar con `LIKE` o `instr` sobre cada tabla | No escala a 10.000 fichas con cuerpo largo ni ofrece ranking, prefijos y resaltado; FTS5 ya está en el binario. |
| Indexar también mapas, manuscritos y escenas ahora | Sus tablas no existen; crear documentos sin fuente sería código muerto y datos inventados. |
| Un documento de relación con los nombres de las fichas | Obliga a actualizar todas las aristas al renombrar una ficha y multiplica triggers; las fichas ya se encuentran por su nombre. |
| Tolerancia a errores con `trigram` o un índice difuso aparte | Añade otra tabla y espacio sin resolver mejor los errores de una letra; el vocabulario de FTS5 es suficiente y acotado. |
| Corrección automática de la consulta | Cambiar lo que el usuario escribe sin avisar oculta el error; se muestran resultados aproximados y se explica. |
| Devolver HTML con `<mark>` desde el proceso principal | Inyectaría contenido no confiable en el renderer; los marcadores de control son datos planos. |
| Historial de búsquedas y visitas | Añade datos personales y una tabla que la issue no pide; recientes y favoritos ya cubren el acceso rápido. |
| Atajo global sin comprobar el foco | `Ctrl+K` dentro del editor o de un formulario secuestraría el atajo del texto; se ignora en campos editables y diálogos. |
| Abrir una PR o una vista web para buscar | Rompe el requisito local-first y offline; todo ocurre en el proceso principal. |

## Consecuencias

### Positivas

- La búsqueda responde en milisegundos con 10.000 fichas en el equipo de
  referencia y no depende de la red.
- El índice se actualiza solo al crear, editar, borrar o restaurar, y se puede
  reconstruir sin perder datos.
- Los filtros combinables cubren mundo, tipo, etiqueta y estado.
- La paleta concentra navegación, creación y acciones con teclado completo.
- El resaltado es seguro por construcción y no abre una vía de inyección.
- La migración es aditiva y deja preparado el índice para mapas, manuscritos y
  escenas.

### Negativas y riesgos

- Los triggers añaden trabajo a cada escritura de ficha; es aceptable para el
  volumen del MVP y la optimización fina llega con M5-02.
- La tolerancia a errores cubre la misma inicial y distancias cortas; un error
  en la primera letra o una palabra muy distinta no se corrige.
- Los documentos de relación no encuentran una relación por el nombre de sus
  fichas; se encuentra la ficha y desde ella se ven sus relaciones.
- La reconstrucción sanea FTS5, elimina documentos obsoletos, repuebla el índice
  desde las vistas y lo reconstruye en una transacción; con un índice muy grande
  puede tardar y la interfaz debe seguir siendo cancelable o mostrar progreso en
  una versión posterior.
- La papelera y la purga de #77 deberán confirmar que el índice no conserva
  documentos de contenido eliminado definitivamente.
- El estado vacío muestra recientes y favoritos sin paginar; con muchos datos
  puede necesitar un límite configurable en Ajustes.

### Impacto transversal

- **Ventana:** la búsqueda y la paleta se comprueban a 1024, 1280 y 1600 px sin
  scroll horizontal; los resultados largos usan `overflow-wrap`.
- **Temas:** resaltado, metadatos, insignias y paleta usan roles semánticos y se
  revisan en Claro y Oscuro con contraste AA.
- **Accesibilidad:** combobox/listbox, `aria-live` para el recuento, foco visible,
  navegación por flechas y axe sin errores críticos ni graves.
- **Seguridad:** canales en allowlist, Zod estricto, sin Node en el renderer, sin
  HTML y sin contenido remoto.
- **Datos:** el índice no se exporta; se reconstruye desde las tablas de
  contenido. La migración crea copia previa y tiene rollback de referencia.
- **Coste:** FTS5 y `better-sqlite3` ya forman parte del stack; no se añaden
  servicios ni dependencias de pago.
- **Offline:** buscar, filtrar, abrir resultados y reconstruir funciona sin red.

## Referencias

- Issue #76 y [plan de desarrollo](../plan-desarrollo.md), sección 2.1.7.
- [Esquema](../base-de-datos/esquema.md) y
  [migraciones](../base-de-datos/migraciones.md).
- [Manual de usuario](../manual-de-usuario.md), sección 10.
- ADR 0002 (SQLite y FTS5) y ADR 0004 (IPC tipado).
