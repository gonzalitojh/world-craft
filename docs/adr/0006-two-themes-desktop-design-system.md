# ADR 0006 — Dos temas y sistema de diseño de escritorio

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-026
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0010 y ADR 0018 de la etapa web
- **Relacionados:** ADR 0001, ADR 0009

## Contexto

La etapa web tenía dos temas y un sistema de diseño con requisitos responsive
(360/768/1280). La aplicación de escritorio mantiene la identidad visual, pero
cambia el soporte: ventana mínima 1024×700, ratón y teclado, paneles y tablas.
No se diseña para móvil ni para gestos táctiles.

## Decisión

1. **Dos temas:** Claro y Oscuro. El usuario elige en Ajustes; no hay modo
   «sistema» en el MVP.
2. **Tokens en tres capas:** paleta (única fuente de hex), semántica (roles sin
   hex) y escalas (espaciado, radios, sombras, tipografía y movimiento).
3. **Tema claro:** `--paper` como superficie y `--ink` como texto.
   **Tema oscuro:** `--ink` como superficie y `--paper` como texto.
4. **Tipografía:** Fraunces para display, Inter para interfaz y JetBrains Mono
   para datos. Empaquetadas con la app.
5. **Estética:** «taller de cartógrafo», papel y tinta, acentos tierra, musgo y
   ocre.
6. **Ventana:** mínimo 1024×700; referencias 1024, 1280 y 1600 px sin scroll
   horizontal de página.
7. **Componentes base:** botón, campos, tarjeta, insignia, diálogo, panel,
   pestañas, menú, tooltip, aviso, estado vacío y tabla, sobre Radix/shadcn.
8. **Accesibilidad:** contraste AA, foco visible, teclado, `aria-live` y
   `prefers-reduced-motion`.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Cuatro temas (claro, oscuro, blanco, negro) | Más pruebas y poca diferencia real; el usuario eligió dos. |
| Tema automático del sistema | Añade complejidad y parpadeo; se puede valorar después. |
| MUI/Chakra/Mantine | Menos control de la estética editorial y más peso. |
| CSS Modules sin tokens | Cada pantalla inventaría colores y espaciados. |
| Diseño responsive web | No aplica: es una app de escritorio con ventana mínima. |

## Consecuencias

### Positivas

- Identidad visual coherente y verificable.
- Un solo sistema para todas las pantallas.
- Contraste y accesibilidad comprobables con tests de tokens.
- Sin dependencia de fuentes remotas.

### Negativas y riesgos

- Los tokens y overrides requieren disciplina en cada componente.
- Los colores de tipos de entidad deben validarse en ambos temas.
- Las capturas de diferentes tamaños de ventana hay que regenerarlas.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Diseño para 1024/1280/1600; sin móvil. |
| Temas (Claro/Oscuro) | Núcleo de la decisión; overrides agrupados. |
| Accesibilidad | AA, foco, teclado y movimiento reducido. |
| Seguridad y privacidad | Sin fuentes ni recursos remotos. |
| Datos y preservación | No aplica. |
| Coste | 0 €/mes; fuentes de código abierto. |
| Portabilidad de datos | No aplica. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Fuentes no disponibles | Licencia | Empaquetar con licencia OFL | Scaffold UI |
| Contraste insuficiente | AA | Tests de tokens y revisión visual | Cada issue de UI |
| Textos largos rompen el layout | Ventana estrecha | `overflow-wrap`, `min-width: 0` y pruebas | QA |

## Plan de revisión

Se revisa si se añade un tercer tema, si se adopta el tema del sistema o si la
estética cambia. Cualquier cambio de tokens o de contraste exige revisar las
capturas y la guía.

## Referencias

- [`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D2 y D13
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-026
- WCAG 2.2, criterios de contraste, consultado el 18/11/2026.
