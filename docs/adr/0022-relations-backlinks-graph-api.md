# ADR 0022 — Relaciones tipadas, etiquetas inversas y API del grafo

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-20
- **Fecha del documento:** 2026-11-20
- **Issue:** #75
- **Decisiones del registro:** D-045
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0006, ADR 0009, ADR 0010, ADR 0011, ADR 0016, ADR 0019, ADR 0020, ADR 0021

## Contexto

M1-04 (#75) tenía que unir las fichas de #74 con relaciones tipadas y
navegables. La issue fijaba un modelo relacional con tipos del sistema y
personalizados, etiqueta directa e inversa, color, notas, fuerza, metadatos,
backlinks y una API preparada para el grafo de M2-04. Quedaban abiertas varias
decisiones:

1. Cómo representar la dirección y la etiqueta inversa sin duplicar aristas.
2. Dónde viven los tipos del sistema y cómo se protegen.
3. Cómo validar duplicados, autorreferencias y aislamiento por mundo.
4. Qué borrar al eliminar una relación o un tipo personalizado.
5. Cómo exponer las aristas al futuro grafo sin acoplar la interfaz al modelo
   de la ficha.

## Decisión

1. **Migración `0005_relations` aditiva.** Crea `relation_types` y `relations`
   con claves foráneas a `worlds`, `entities` y `relation_types`, índices por
   mundo, origen, destino y tipo, `CHECK` de fuerza 1–5, autorreferencia y JSON
   de metadatos. `user_version` pasa a 6 y el rollback de referencia elimina
   solo estas tablas. No se edita ninguna migración anterior.
2. **Tipos del sistema en la migración y en código.** Los 18 tipos de relación
   del sistema se siembran como filas con `world_id NULL`, `is_system = 1` e IDs
   UUIDv7 fijos. `src/shared/relations/catalog.ts` es el espejo en código y una
   prueba de integración compara literalmente IDs, claves, etiquetas y colores.
   Los tipos personalizados pertenecen a un mundo y usan una clave única.
3. **Aristas dirigidas con etiqueta directa e inversa.** Cada relación guarda
   `source_id` y `target_id`; `label` e `inverse_label` son sobrescrituras
   opcionales. La etiqueta efectiva directa es `label ?? type.name` y la inversa
   es `inverse_label ?? type.inverse_name`. No se guardan dos filas por cada
   relación: la ficha de destino lee la misma arista con la etiqueta inversa.
   Un tipo con el mismo nombre directo e inverso se considera simétrico y el
   servicio rechaza la arista inversa duplicada.
4. **Integridad en el servicio.** Origen y destino deben ser fichas vivas del
   mismo mundo, distintas entre sí; el tipo debe ser del sistema o de ese mundo.
   Se rechazan duplicados exactos y, en tipos simétricos, el duplicado
   invertido. SQLite aporta el `UNIQUE` y los `CHECK` como segunda barrera.
5. **Borrado directo de relaciones.** Eliminar una relación es una acción
   explícita y confirmada; no se conserva una fila muerta. Las fichas siguen con
   borrado lógico y las relaciones que apuntan a una ficha en la papelera se
   ocultan de las listas, pero no se destruyen, para que una restauración futura
   las recupere.
6. **Tipos del sistema protegidos y personalizados en uso bloqueados.** Un tipo
   del sistema no se edita ni se borra. Un tipo personalizado solo se borra si
   no tiene relaciones; si las tiene, el servicio devuelve un error explicativo.
7. **API de aristas preparada para el grafo.** `relations:list` devuelve aristas
   con origen, destino y tipo resueltos, filtros por ficha y tipo y un límite
   acotado. La ficha consume la misma API con `entityId`; M2-04 podrá pedir el
   mundo completo sin cambiar el contrato.
8. **Interfaz con backlinks navegables.** La ficha muestra las relaciones
   salientes con la etiqueta directa y los backlinks con la inversa. Cada arista
   permite navegar a la otra ficha, editar tipo, etiquetas, notas y fuerza, o
   eliminarla con confirmación. Un gestor visual administra los tipos
   personalizados y muestra los del sistema en solo lectura.
9. **Validación compartida y frontera de confianza.** El renderer valida para
   dar mensajes; el proceso principal repite nombres, claves, etiquetas, notas,
   fuerza, metadatos y pertenencia al mundo. Los canales están en la allowlist,
   usan Zod estricto y el preload comprueba la forma de las respuestas.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Guardar dos filas por relación (directa e inversa) | Duplica datos, exige mantenerlas sincronizadas y complica el borrado; una arista con etiqueta inversa resuelve lo mismo. |
| Duplicar los tipos del sistema en cada mundo | Multiplica filas y complica actualizar el catálogo; los tipos del sistema son iguales en todos los mundos. |
| Etiquetas libres sin tipo | No habría catálogo, color, validación ni API estable para el grafo. |
| Relaciones sin dirección | La issue pide etiqueta directa e inversa; la dirección permite leer la historia desde cada ficha. |
| Borrado lógico de relaciones | Añade complejidad de papelera y purga sin una necesidad de producto; la eliminación es explícita y confirmada. |
| Meter las relaciones en un JSON de la ficha | Rompe la integridad referencial, los backlinks y las consultas del grafo. |
| Devolver las relaciones dentro de `EntityDetail` | Acopla la ficha al grafo y obliga a recargar todo el detalle al cambiar una arista; una API de aristas separada sirve a la ficha y a M2. |
| Permitir borrar tipos en uso con cascada | Perdería relaciones sin avisar; se bloquea y se pide eliminar antes las aristas. |

## Consecuencias

### Positivas

- Las fichas dejan de estar aisladas y el lore se puede recorrer en ambos
  sentidos.
- La etiqueta inversa se resuelve sin duplicar aristas ni filas.
- El modelo y la API sirven para los backlinks de M1 y para el grafo de M2 sin
  rehacer el contrato.
- Los tipos del sistema son estables y los personalizados se aíslan por mundo.
- Las pruebas cubren validación, duplicados, simetría, aislamiento, papelera,
  etiquetas inversas y migración.

### Negativas y riesgos

- La simetría se deduce de que el nombre directo y el inverso coincidan; un
  tipo con etiquetas iguales pero semántica asimétrica necesitaría una columna
  explícita en una migración futura.
- Los metadatos se guardan y exponen en la API, pero todavía no se editan en la
  interfaz; una pantalla avanzada puede añadirlos más adelante.
- Las aristas que apuntan a fichas en la papelera se ocultan; la papelera de #77
  decidirá si las limpia o avisa al restaurar.
- Duplicar un mundo no copia fichas ni relaciones; el alcance actual solo copia
  tipos personalizados.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | El panel de relaciones se apila en 1024 px y no genera scroll horizontal; las etiquetas y notas largas usan `overflow-wrap`. |
| Temas (Claro/Oscuro) | Los colores de tipo usan la paleta cerrada y los tokens de etiqueta existentes; el color nunca es el único indicador. |
| Accesibilidad | Listas con encabezados, botones con nombre accesible, confirmación explícita, diálogos nativos, foco visible y fuerza anunciada con texto alternativo. |
| Seguridad y privacidad | Canales nuevos en la allowlist, Zod estricto, sin Node en el renderer, sin rutas ni HTML y metadatos escalares acotados. |
| Datos y preservación | Migración aditiva con copia previa, rollback, pruebas de preservación y aristas ocultas en lugar de destruidas cuando una ficha va a la papelera. |
| Coste | 0 €/mes; no se añaden dependencias ni servicios. |
| Portabilidad de datos | El modelo usa IDs y claves estables, JSON abierto y etiquetas por tipo; #78 podrá exportar relaciones entre fichas. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Crecimiento del grafo | Sin servicio externo | Listas con límite acotado y filtros por ficha y tipo; el grafo de M2 evaluará paginación o consultas por vecinos | M2-04 |
| Simetría implícita | Sin coste | Se documenta y se prueba; si aparece un caso real, se añade una columna con migración nueva | M2 |
| Metadatos sin interfaz | Sin coste | Se validan y conservan en la API; la UI podrá exponerlos sin cambiar el esquema | Backlog |

## Plan de revisión

Se revisa cuando M2-04 necesite consultas por vecinos o paginación, cuando #77
defina la papelera y la restauración de fichas, cuando #78 exporte relaciones, y
si el catálogo de tipos del sistema cambia. Cualquier cambio de esquema exige
una migración nueva, copia previa y prueba de preservación.

## Referencias

- Issue: #75
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), secciones 2.1.3 y 3.3
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-045
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), secciones 4.4
  y 4.5
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md),
  `0005_relations`
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), sección 3.15
- ADR 0004, ADR 0019, ADR 0020 y ADR 0021
