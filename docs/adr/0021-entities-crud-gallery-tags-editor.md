# ADR 0021 — Fichas: modelo, galería, etiquetas y editor enriquecido

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-20
- **Fecha del documento:** 2026-11-20
- **Issue:** #74
- **Decisiones del registro:** D-044
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0005, ADR 0006, ADR 0007, ADR 0009, ADR 0010, ADR 0011, ADR 0016, ADR 0017, ADR 0019, ADR 0020

## Contexto

Las fichas son la pantalla central del producto: reúnen personajes, lugares,
organizaciones y cualquier tipo del sistema o personalizado. M1-03 (#74) tenía
que convertir los tipos de #73 en contenido real y resolver varios puntos que
afectan a datos, seguridad y experiencia:

1. La descripción rica necesitaba un formato portable y seguro, sin guardar HTML
   arbitrario ni inventar un editor propio.
2. La galería no estaba en el esquema objetivo y las imágenes deben seguir
   viviendo en `assets` con el protocolo `wc-asset://`.
3. Las etiquetas de color y los favoritos debían filtrarse por mundo.
4. El autoguardado podía perder cambios si se cerraba la vista antes de enviar
   el formulario.
5. La gestión visual de tipos personalizados se había comprometido para esta
   issue, pero no existía ninguna pantalla.

## Decisión

1. **Migración `0004_entities` aditiva.** Crea `entities`, `tags`,
   `entity_tags` y `entity_gallery` con claves foráneas a `worlds`,
   `entity_types` y `assets`, índices por mundo y `CHECK` de estado, favorito,
   slug, JSON y posición. `user_version` pasa a 5 y el rollback de referencia
   elimina solo estas tablas. No se edita ninguna migración anterior.
2. **Ficha con tipo estable y borrado lógico.** Cada ficha pertenece a un mundo
   y a un tipo del sistema o a uno personalizado de ese mundo. El tipo no cambia
   después de crear la ficha: cambiar de plantilla con valores existentes exige
   una estrategia de migración que no forma parte del MVP. El nombre genera un
   slug único por mundo, la fila se conserva con `deleted_at` y la clave del slug
   sigue reservada. La papelera visible y la restauración llegan con #77.
3. **Descripción como JSON de ProseMirror y texto plano.** `description` guarda
   un documento validado con una lista cerrada de nodos (párrafo, títulos 1–3,
   listas, cita, texto y salto) y marcas (negrita, cursiva y enlace).
   `description_text` guarda el texto derivado para búsqueda. No se guarda ni se
   sirve HTML: el renderer nunca usa `dangerouslySetInnerHTML`.
4. **Editor Tiptap 3 con extensiones MIT.** Se añaden `@tiptap/react`,
   `@tiptap/starter-kit`, `@tiptap/extension-link` y `@tiptap/pm`, justificados
   por el ADR 0007. El conjunto se limita a formato básico y a enlaces internos
   con esquema `wc-entity://<uuid>`; no se habilitan enlaces externos, pegado de
   HTML, código ni extensiones de pago.
5. **Galería relacional con posición.** `entity_gallery` guarda
   `(entity_id, asset_id, position)`; el orden es explícito y una imagen solo
   puede pertenecer a la galería de una ficha de su mismo mundo. La imagen
   principal es `entities.image_asset_id`. La galería usa
   `wc-asset://thumb/<id>` y la imagen principal `wc-asset://asset/<id>`.
6. **Assets expuestos con diálogo nativo.** Se añaden `assets:list` y
   `assets:import`. El renderer nunca recibe una ruta: el proceso principal abre
   el diálogo, importa con el servicio de #66 (WebP, miniatura, límites,
   escritura atómica) y devuelve solo metadatos. El asset debe pertenecer al
   mundo de la ficha; si no, se rechaza.
7. **Etiquetas de color por mundo.** `tags` tiene nombre único por mundo y un
   token de la paleta cerrada; `entity_tags` relaciona fichas y etiquetas. Crear
   una etiqueta con un nombre existente es idempotente. Las etiquetas y los
   filtros siempre llevan `world_id`.
8. **Favoritos y filtros en el proceso principal.** `is_favorite` y los filtros
   por tipo, etiqueta, favorito, estado y búsqueda se resuelven en SQL con el
   mundo como condición. La búsqueda usa `instr(lower(...))` sobre nombre,
   alias, resumen y texto de la descripción; no se añade FTS5 en esta entrega.
9. **Autoguardado con debounce y guardado explícito.** La interfaz espera 700 ms
   desde el último cambio y envía una actualización completa e idempotente; el
   botón «Guardar ahora» fuerza el envío. El estado (`Guardando…`, `Guardado`,
   `Cambios sin guardar`, error) se anuncia con `aria-live`. Al desmontar la
   vista se intenta un último guardado. El servidor repite toda la validación.
10. **Gestión visual de tipos.** La lista de fichas abre un diálogo para crear,
    duplicar, editar y borrar tipos personalizados con un constructor de campos.
    Los tipos del sistema solo se duplican. Un tipo con fichas no se puede
    borrar (incluidas las fichas en papelera, para que una restauración futura
    encuentre su plantilla) y tampoco puede perder campos ni cambiar el tipo de
    un campo existente: primero hay que cambiar o mover esas fichas. Sí se pueden
    ajustar etiquetas, opciones, icono, color y añadir campos.
11. **Creación rápida desde cualquier pantalla.** El shell ofrece «Nueva ficha»
    con mundo, tipo y nombre; al crear se abre la ficha para completarla. La
    lista del mundo ofrece el mismo flujo con el mundo fijo.
12. **Validación compartida y frontera de confianza.** La interfaz valida para
    dar mensajes por campo; el proceso principal repite nombre, alias, resumen,
    plantilla, valores, referencias, etiquetas, assets y descripción. Una
    referencia y un enlace interno de la descripción deben existir, estar vivos
    y pertenecer al mismo mundo; si el campo declara `targetTypeKey`, también se
    comprueba el tipo de destino.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Guardar HTML rico en `description` | Permitiría XSS, estilos fuera de tokens y una exportación frágil; el JSON validado es portable y se puede renderizar sin HTML crudo. |
| Editor propio sobre `contenteditable` | Mucho trabajo, accesibilidad frágil y sin extensiones de enlaces; el ADR 0007 ya eligió Tiptap. |
| Galería como JSON de IDs en `entities` | No permite FK, orden explícito ni validación de integridad; la tabla puente conserva la posición y las restricciones. |
| Reutilizar `assets` como galería global del mundo | Mezclaría imágenes de varias fichas y rompería el orden y la selección de imagen principal. |
| Etiquetas como texto libre en la ficha | No habría filtros consistentes, colores por mundo ni reutilización; se duplicarían nombres con variantes. |
| Autoguardado solo al salir | Perdería cambios si se cierra la ventana o se cambia de ficha antes de enviar. |
| Permitir cambiar el tipo de una ficha existente | Los atributos de la plantilla anterior quedarían huérfanos o habría que convertirlos; se pospone a una migración de valores explícita. |
| Borrar tipos con fichas en cascada | Perdería la plantilla que las fichas necesitan para mostrarse; se bloquea hasta reasignarlas. |
| Enlaces externos en la descripción | La issue pide enlaces internos; permitir URLs amplía la superficie de seguridad y la validación. |

## Consecuencias

### Positivas

- La ficha completa se guarda y se recupera con todos sus campos, etiquetas,
  imagen y galería sin depender de la red.
- La descripción es portable, validable y renderizable en ambos temas.
- Las imágenes no duplican archivos y las miniaturas no cargan originales.
- El autoguardado reduce la pérdida de contenido sin renunciar al guardado
  explícito.
- La gestión de tipos permite crear plantillas propias sin tocar el sistema.
- Las pruebas cubren CRUD, aislamiento, referencias, imágenes, filtros y
  migración.

### Negativas y riesgos

- La plantilla cerrada de ProseMirror exige actualizarla si Tiptap añade nodos
  nuevos; cualquier ampliación debe pasar por una migración de documento.
- El autoguardado no es una transacción entre ventanas: una ventana cerrada a la
  fuerza antes del debounce puede perder los últimos milisegundos.
- La búsqueda sin FTS5 puede ser más lenta en catálogos muy grandes; se revisará
  con la búsqueda global (#76).
- El tipo de una ficha no se puede cambiar; el usuario debe crear otra ficha o
  esperar a la migración de valores.
- La galería añade una tabla no prevista en el esquema objetivo; se documenta en
  `docs/base-de-datos/esquema.md` y el rollback la elimina.
- Los tipos con fichas no se pueden borrar, lo que puede sorprender si el mundo
  tiene mucho contenido.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Lista y ficha a 1024/1280/1600 px sin scroll horizontal; el editor y la galería se apilan en anchos estrechos. |
| Temas (Claro/Oscuro) | Todos los estilos usan tokens; colores de tipo y etiqueta resuelven en ambos temas y el color no es el único indicador. |
| Accesibilidad | Formularios con etiquetas, errores asociados, foco visible, diálogos nativos, `aria-live` para el guardado y botones con nombre accesible. |
| Seguridad y privacidad | Canales en allowlist, Zod estricto, sin Node en el renderer, sin HTML crudo, sin rutas de archivo y con el protocolo de assets ya existente. |
| Datos y preservación | Migración aditiva con copia previa, rollback, borrado lógico y pruebas de preservación; las imágenes y etiquetas no se borran al eliminar la ficha. |
| Coste | 0 €/mes; Tiptap y ProseMirror son MIT y no hay servicios externos. |
| Portabilidad de datos | La ficha usa claves estables, JSON abierto y assets referenciados por ID; #78 compondrá el ZIP del mundo. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Tiptap Pro | Licencia de pago | Solo se usan paquetes MIT del núcleo; no se contratan extensiones Pro | M3 |
| Tamaño del renderer | ~839 kB minificado | Se mantiene en un único bundle por simplicidad; se valorará code splitting si crece | M2 |
| Catálogo de búsqueda | Sin servicio externo | SQLite local con `instr`; FTS5 se evaluará con la búsqueda global | #76 |

## Plan de revisión

Se revisa si #76 necesita FTS5 para la búsqueda global, si #77 define una
papelera de fichas con restauración o purga, si #78 amplía el formato de
exportación con fichas y galerías, y si Tiptap cambia su licencia o sus nodos
básicos. Cualquier cambio de esquema exige una migración nueva y una prueba de
preservación.

## Referencias

- Issue: #74
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), sección 2.1.2
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-044
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), secciones 4.3,
  4.3.1 y 4.6
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md),
  `0004_entities`
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), sección 3.14
- ADR 0005, ADR 0007, ADR 0017, ADR 0019 y ADR 0020
