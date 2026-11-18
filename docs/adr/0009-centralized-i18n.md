# ADR 0009 — Internacionalización centralizada y tipada

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-029
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0012 de la etapa web
- **Relacionados:** ADR 0006, ADR 0014

## Contexto

El MVP está en español, pero la estructura debe permitir añadir inglés e
italiano sin refactorizar componentes. En una app de escritorio no hay servidor
ni middleware de locale: el idioma se guarda en la configuración local y se
aplica en el renderer.

## Decisión

1. Catálogo único en `src/renderer/messages/es.ts`, con claves tipadas.
2. El traductor acepta solo claves existentes; una clave ausente rompe el
   typecheck.
3. El locale se guarda en `config.json` y se pasa al renderer por el preload.
4. Fechas, números, listas y plurales usan `Intl`.
5. No se usa una librería de i18n pesada en el MVP.
6. Los textos de `aria-label`, `alt` y errores también están en el catálogo.
7. Añadir un idioma es copiar el catálogo, traducirlo y añadirlo al tipo
   `Locale`; no se tocan los componentes.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| `react-i18next` | Más peso y configuración para un MVP de un solo idioma. |
| `next-intl` | Dependía de Next.js; ya no aplica. |
| Textos por componente | Imposible de traducir y de revisar. |
| Un archivo por pantalla sin tipos | Claves rotas en tiempo de ejecución. |

## Consecuencias

### Positivas

- Un solo lugar para revisar textos.
- Claves tipadas y detectadas por TypeScript.
- Formatos correctos con `Intl`.
- Añadir idiomas no requiere refactor.

### Negativas y riesgos

- El catálogo crece y hay que mantenerlo ordenado.
- Las traducciones futuras requieren revisión humana.
- Los textos largos pueden romper el layout; hay que probarlos.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Textos largos y truncados a 1024 px. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | Etiquetas, errores y `aria-live` traducidos. |
| Seguridad y privacidad | Sin servicios de traducción en línea. |
| Datos y preservación | El locale vive en `config.json`. |
| Coste | 0 €/mes. |
| Portabilidad de datos | El idioma no afecta a los datos. |

## Riesgos de free tier y mitigación

No aplica: no hay servicio externo ni coste. La única dependencia es el
catálogo local.

## Plan de revisión

Se revisa si se añade un segundo idioma o si el catálogo se vuelve difícil de
mantener. En ese caso se valora una librería con carga dinámica, con ADR nuevo.

## Referencias

- [`docs/internacionalizacion.md`](../internacionalizacion.md)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D14
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-029
- Documentación de `Intl` consultada el 18/11/2026.
