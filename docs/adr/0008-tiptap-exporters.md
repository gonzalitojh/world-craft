# ADR 0008 — Tiptap y exportadores de manuscritos

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** —
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0001, ADR 0009, ADR 0010

## Contexto

El editor de manuscritos necesita texto enriquecido, estructura por libros,
capítulos y escenas, herramientas específicas de novela y exportación a formatos
abiertos. También necesita historial de versiones y autoguardado sin contratar
extensiones Pro. El contenido debe ser portable y apto para búsqueda.

## Decisión

1. **Editor:** Tiptap 3 sobre ProseMirror, usando solo el núcleo MIT.
2. **Extensiones propias:** modo diálogo, menciones a personajes, separadores de
   escena y contadores de palabras.
3. **Sin funciones Pro:** comentarios, historial y colaboración no se contratan.
   El historial se implementa con snapshots propios y la colaboración queda
   fuera del MVP.
4. **Almacenamiento:** JSON de ProseMirror + texto plano (`content_text`) para
   búsqueda, estadísticas y exportación.
5. **Exportación:** DOCX con `docx`; PDF con `@react-pdf/renderer` o impresión
   CSS; EPUB con `jszip` + XHTML (o `epub-gen`); Markdown con
   `prosemirror-markdown`.
6. **Importación:** DOCX con `mammoth` y Markdown con el parser de ProseMirror.
7. **Autoguardado:** debounce de 2–3 s, diff de contenido y snapshots
   periódicos; no se serializa todo el manuscrito en cada tecla.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Lexical | Buen rendimiento, pero menos extensiones listas para novela y menos ecosistema para exportación. |
| Slate | Muy flexible, pero más trabajo propio de estabilidad, esquema y accesibilidad. |
| CodeMirror / Markdown | Excelente para Markdown puro, insuficiente para edición rica, diálogos y menciones. |
| Tiptap Pro | Las extensiones de historial, comentarios y colaboración tienen coste y no son necesarias en el MVP. |

## Consecuencias

### Positivas

- Núcleo MIT sin coste y con ecosistema maduro.
- Las extensiones propias cubren las necesidades concretas de novela.
- El JSON de ProseMirror es portable y el texto plano habilita búsqueda.
- La exportación usa librerías abiertas y formatos estándar.

### Negativas y riesgos

- Las extensiones propias requieren mantenimiento y pruebas.
- La exportación a PDF/EPUB puede consumir CPU y memoria.
- El historial por snapshots no ofrece colaboración en tiempo real.
- La importación de DOCX complejos puede perder formato.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Una columna en móvil, panel de escena opcional y modo concentración. |
| Temas (Claro/Oscuro) | El editor usa tokens de papel y tinta del ADR 0010. |
| Accesibilidad | Atajos documentados, foco visible, contraste AA y `aria-live` en autoguardado. |
| Seguridad y privacidad | Contenido sanitizado y esquema de ProseMirror; sin servicio externo. |
| Coste | 0 €/mes; sin extensiones Pro ni servicios de conversión. |
| Portabilidad de datos | JSON, Markdown, DOCX, PDF y EPUB son formatos abiertos o estándar. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Extensiones Pro | Coste de licencia | Solo núcleo MIT; historial y comentarios propios | M3-01 (#21) y M3-04 (#24) |
| Exportación pesada | 300 s y 2 GB por función en Vercel | Exportaciones acotadas, generación en cliente cuando sea posible y aviso de tamaño | M3-03 (#23) |
| Fuentes | Sin servicio de fuentes de pago | Fuentes OFL autoalojadas con `next/font` | ADR 0010 |
| Pérdida de contenido | Sin coste económico | Autosave, snapshots y exportación como copia | ADR 0009 |

## Plan de revisión

Se revisa si Tiptap cambia su licencia, si la exportación supera los límites de
la función o si se decide añadir colaboración (backlog B-01). Un cambio de
editor exige un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D10 y §3.5
- Documentación oficial de Tiptap, ProseMirror y las librerías de exportación,
  consultada el 12/11/2026.
