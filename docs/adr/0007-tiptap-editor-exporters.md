# ADR 0007 — Editor Tiptap y exportadores

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-027
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0008 de la etapa web (Tiptap en Next.js)
- **Relacionados:** ADR 0002, ADR 0006

## Contexto

El módulo de escritura necesita un editor rico para manuscritos, escenas,
descripciones y notas. Debe funcionar sin conexión, guardar el contenido de
forma portable, permitir menciones a fichas y exportar a formatos de lectura.
Las extensiones de colaboración y comentarios de pago no encajan en el coste
cero.

## Decisión

1. **Tiptap 3** sobre ProseMirror, con extensiones propias para:
   - modo diálogo,
   - menciones a personajes y lugares,
   - separadores de escena,
   - contador de palabras,
   - pegado limpio.
2. El contenido se guarda como **JSON de ProseMirror** en SQLite y como texto
   plano en `content_text` para búsqueda y estadísticas.
3. Las extensiones Pro (comentarios, historial, colaboración) **no se
   contratan**. El historial se implementa con snapshots propios
   (`scene_versions`).
4. Exportadores propios: **Markdown, HTML, EPUB y PDF**.
5. El HTML se sanea al exportar; nunca se inyecta HTML arbitrario en el
   renderer.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Lexical | Buen rendimiento, pero menos extensiones listas para el flujo de novela. |
| Slate | Más trabajo de base y menos ecosistema. |
| CodeMirror/Markdown | Excelente para código, pero pobre para formato rico y menciones. |
| Editor propio sobre `contenteditable` | Mucho trabajo y accesibilidad frágil. |
| Tiptap Pro | Coste recurrente; el MVP debe ser 0 €/mes. |

## Consecuencias

### Positivas

- Editor maduro y accesible sobre ProseMirror.
- Contenido JSON portable y versionable.
- Exportación a formatos abiertos.
- Sin dependencia de un servicio de colaboración.

### Negativas y riesgos

- El JSON de ProseMirror debe validarse al importar.
- Los exportadores EPUB/PDF requieren pruebas de maquetación.
- El historial propio no es tan rico como el de pago.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Editor a una columna, panel de escena opcional y modo concentración. |
| Temas (Claro/Oscuro) | El editor usa tokens; el contenido exportado usa estilos propios. |
| Accesibilidad | Atajos, foco, etiquetas y navegación por teclado. |
| Seguridad y privacidad | Sanitización al exportar; sin HTML arbitrario. |
| Datos y preservación | JSON + texto plano; versiones por escena; exportación. |
| Coste | 0 €/mes con el núcleo MIT. |
| Portabilidad de datos | Markdown, HTML, EPUB, PDF y JSON. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Extensiones Pro | Licencia de pago | No se usan; historial propio | M3 |
| EPUB/PDF | Complejidad de maquetación | Exportadores propios con pruebas | M3 |
| Contenido inválido | Importación | Zod + validación de nodos | M3 |

## Plan de revisión

Se revisa si el historial propio no cubre las necesidades o si Tiptap cambia
sus licencias. La colaboración queda fuera del MVP; si se plantea, exige un ADR
nuevo con coste y seguridad.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D9
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), tablas de escritura
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-027
- Documentación de Tiptap y ProseMirror consultada el 18/11/2026.
