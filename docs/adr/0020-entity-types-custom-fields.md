# ADR 0020 — Tipos de entidad del sistema y campos personalizados

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-20
- **Fecha del documento:** 2026-11-20
- **Issue:** #73
- **Decisiones del registro:** D-043
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0006, ADR 0009, ADR 0010, ADR 0011, ADR 0016, ADR 0019

## Contexto

Las fichas necesitan tipos con plantillas de campos distintas. El esquema no
puede migrarse cada vez que un mundo añade un campo, y el catálogo inicial debe
traer tipos útiles sin depender de datos remotos. M1-02 (#73) prepara el modelo
y la validación; la UI de fichas y la gestión visual de tipos llegan con M1-03
(#74), y la exportación completa del mundo con M1-07 (#78).

La decisión afecta a datos, IPC, validación y portabilidad. Había que resolver
dónde viven los tipos del sistema, cómo se protegen, cómo se guardan los campos
variables, cómo se aíslan por mundo y qué viaja en una exportación.

## Decisión

1. **Tipos del sistema como filas globales, sembradas en la migración.** La
   migración `0003_entity_types` crea la tabla y siembra los 18 tipos con
   `world_id NULL`, `is_system = 1` e IDs UUIDv7 fijos. El catálogo en código
   (`src/shared/entity-types/catalog.ts`) es la fuente de contenido y una prueba
   de integración compara IDs, claves, nombres, iconos, colores y plantillas con
   el seed. No se crean filas por mundo ni se descargan de la red.
2. **Protección del sistema en el dominio.** El servicio rechaza actualizar o
   borrar un tipo con `isSystem` verdadero; el renderer recibe `INVALID_INPUT`.
   Para cambiar una plantilla se duplica el tipo en el mundo, que crea una fila
   personalizada con clave nueva y permite editarla.
3. **Tipos personalizados por mundo, con clave estable y borrado lógico.** Cada
   fila tiene `world_id`, `key`, `name`, `icon`, `color`, `fields`,
   `is_system = 0` y `deleted_at`. La clave es única por mundo, no puede coincidir
   con una del sistema y no cambia al editar. Borrar es lógico: la fila se
   conserva y la clave sigue reservada; la papelera visible y la purga llegan con
   #77.
4. **Plantilla JSON validada con Zod y cinco tipos de campo.** `fields` es un
   array JSON de definiciones con clave, etiqueta, obligatoriedad y tipo `text`,
   `number`, `date`, `select` o `reference`. Zod valida claves únicas, opciones,
   rangos y límites antes de escribir. `validateEntityFieldValues` valida los
   valores con la misma plantilla y devuelve un código por `fieldKey`
   (`required`, `invalid-number`, `invalid-option`…), sin textos visibles. La UI
   de #74 reutilizará la función y el main repetirá la validación. En #73 una
   referencia solo se valida por forma y longitud; la existencia del destino, su
   mundo y su tipo se comprobarán al guardar fichas en #74.
5. **Iconos y colores cerrados.** El icono es un nombre de Lucide de una lista
   cerrada y el color es un token de la paleta (`moss`, `ochre`, `danger`,
   `prussian`). No se guardan hex libres: la interfaz resuelve el token en ambos
   temas y el color nunca es el único indicador del tipo.
6. **Aislamiento y duplicado de mundo.** Las listas incluyen los tipos del
   sistema y los del mundo; las mutaciones de un tipo personalizado comprueban
   `world_id`. Al duplicar un mundo, sus tipos personalizados se copian dentro de
   la misma transacción y con IDs nuevos. El borrado del mundo es lógico y no
   toca los tipos; la purga definitiva los eliminará en cascada.
7. **Transferencia versionada `entity-types.v1`.** El bloque solo incluye tipos
   personalizados (`key`, `name`, `icon`, `color`, `fields`), sin IDs internos ni
   mundo de origen. La importación valida con Zod, rechaza claves del sistema o
   ya existentes e inserta todo en una transacción. #78 compondrá este bloque en
   el ZIP del mundo; los tipos del sistema son implícitos y no se duplican.
8. **Sin UI en M1-02.** La issue es de datos y contratos. La gestión visual de
   tipos, las fichas y sus formularios llegan con #74, que consumirá la API
   `entityTypes` y la validación compartida.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Tipos del sistema solo en código, sin filas | `entities.type_id` necesita una fila con FK y una exportación portable necesita IDs estables; además, la UI necesita listar los tipos con una sola consulta. |
| Sembrar los 18 tipos en cada mundo | Duplica contenido global, complica actualizar el catálogo y multiplica filas sin aportar aislamiento; los tipos del sistema son iguales en todos los mundos. |
| Guardar los campos como columnas del esquema | Cada campo nuevo exigiría una migración y una tabla `entities` con un esquema distinto por mundo; el JSON validado mantiene el esquema estable. |
| Aceptar JSON libre sin Zod | Permitiría claves repetidas, opciones inexistentes, valores de otro tipo y datos que la UI no sabe mostrar. |
| Colores hex e iconos libres | Rompen el contraste verificado en ambos temas, la consistencia visual y la portabilidad si cambia el conjunto de iconos. |
| Borrado físico de tipos personalizados | Perdería la definición que una ficha o una exportación antigua puede referenciar; el borrado lógico conserva la fila y permite la papelera de #77. |
| Editar las plantillas del sistema desde la app | Rompería la protección del catálogo y la reproducibilidad entre instalaciones; duplicar en el mundo cubre el caso de personalización. |

## Consecuencias

### Positivas

- Añadir campos a un tipo no exige migrar el esquema.
- El catálogo del sistema es contenido versionado y verificable, sin red.
- Los tipos del sistema son estables entre instalaciones y exportaciones.
- Los valores inválidos se detectan antes de guardar y el error se asocia al
  campo, lo que permite señalar el control exacto.
- Duplicar un mundo conserva sus tipos sin compartir filas ni IDs.
- La exportación de tipos no arrastra datos de otro mundo y la importación es
  atómica.

### Negativas y riesgos

- La plantilla JSON no tiene FK ni restricciones internas en SQLite; la garantía
  depende de Zod y de que toda escritura pase por el servicio.
- Cambiar un campo de una plantilla con fichas existentes exigirá una estrategia
  de migración de valores en #74 (renombrar, convertir o conservar el valor
  anterior).
- Un tipo borrado lógicamente sigue ocupando su clave y su fila hasta la purga.
- Las etiquetas de las plantillas del sistema están en español como contenido;
  traducir el catálogo a otros idiomas exigirá una estrategia de localización.
- La UI de tipos no existe todavía: el CRUD solo se ejerce por API y pruebas
  hasta #74.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Sin UI nueva en #73; #74 comprobará 1024/1280/1600 px y teclado. |
| Temas (Claro/Oscuro) | Los colores son tokens de la paleta verificada; no hay hex libres. |
| Accesibilidad | El color no es el único indicador: siempre acompaña a icono y nombre. |
| Seguridad y privacidad | IPC en allowlist, Zod estricto, sin Node en el renderer y sin contenido remoto. |
| Datos y preservación | Migración aditiva con copia previa, seed estable, borrado lógico y prueba de preservación. |
| Coste | Sin dependencias nuevas: se usa el Zod ya presente. |
| Portabilidad de datos | Formato `entity-types.v1` sin IDs internos, preparado para #78. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| No aplica | No hay servicio externo ni plan de pago | El catálogo vive en el código y el resto en SQLite local | — |

## Plan de revisión

Se revisa si #74 necesita cambiar el modelo de valores (campos obligatorios con
datos existentes, referencias entre mundos o tipos), si #77 define una papelera
de tipos con restauración o si #78 amplía el formato `entity-types.v1`. Cualquier
cambio de esquema exige una migración nueva y una prueba de preservación.

## Referencias

- Issue: #73
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), sección 2.1.2
  (entidades y fichas)
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-043
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), sección 4.2
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md), `0003_entity_types`
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), sección 3.13
- API de Zod 4 ya usada por el repositorio (`zod` 4.6.7); no se consultaron
  fuentes externas nuevas.
