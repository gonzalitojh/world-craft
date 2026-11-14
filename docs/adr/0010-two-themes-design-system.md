# ADR 0010 — Dos temas y sistema de diseño

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-002
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0001, ADR 0006, ADR 0007, ADR 0012

## Contexto

La aplicación debe ser accesible, coherente y utilizable de día y de noche. Se
quiere una estética editorial de «taller de cartógrafo», no un dashboard
genérico, y hay que evitar que los componentes nuevos queden invisibles o con
contraste insuficiente en alguno de los modos.

## Decisión

1. **Dos temas:** solo **Claro** y **Oscuro**. Se descartan el blanco puro, el
   negro puro y una matriz de cuatro temas.
2. **Variables CSS con papeles invertidos:** en claro, `--paper` es la superficie
   y `--ink` el texto; en oscuro, `--ink` es la superficie y `--paper` el texto.
3. **Tokens:** `--surface`, `--surface-raised`, `--border`, `--muted`, `--accent`,
   `--accent-strong`, `--success`, `--warning`, `--danger` y `--focus`. Cada tipo
   de entidad tiene un color accesible en ambos modos.
4. **Overrides agrupados:** `[data-theme="light"]` y `[data-theme="dark"]` con una
   sola fuente de verdad por regla.
5. **Contraste:** WCAG AA, 4.5:1 para texto normal y 3:1 para texto grande y
   componentes gráficos. Los colores hardcodeados se justifican con un comentario
   y se comprueban en ambos temas.
6. **Stack visual:** Tailwind CSS 4 + shadcn/ui (Radix) + Lucide + Motion. Los
   componentes de shadcn/ui se copian al repositorio y se adaptan.
7. **Dirección visual:** tipografía **Fraunces** para display, **Inter** para
   interfaz y **JetBrains Mono** para datos; paleta papel/tinta con acentos
   tierra, musgo y ocre; textura de papel sutil mediante SVG, sin gradientes
   morados genéricos.
8. **Responsive:** puntos de referencia 360, 768 y 1280 px, con pruebas también a
   320 y 1920 px. Sin scroll horizontal de página.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Cuatro temas (claro, oscuro, blanco, negro) | Duplica tokens, pruebas y capturas sin aportar valor real. |
| Blanco puro y negro puro | Fatiga visual y contraste agresivo; peor lectura prolongada. |
| MUI | Impone su estética y dificulta la dirección editorial propia. |
| Chakra / Mantine | Buenos kits, pero menos control visual y más peso. |
| CSS Modules sin sistema | Más trabajo de consistencia y de temas. |
| Solo tema oscuro | No cubre el uso diurno ni la preferencia del usuario. |

## Consecuencias

### Positivas

- Menos combinaciones que probar y mantener.
- Los tokens permiten cambiar la estética sin tocar componentes.
- La estética propia diferencia el producto de un dashboard genérico.
- La accesibilidad se integra en el sistema desde el inicio.

### Negativas y riesgos

- Exige disciplina para no introducir colores fuera de tokens.
- Los overrides agrupados pueden volverse difíciles de leer si crecen.
- Las fuentes y texturas añaden peso; hay que vigilar el rendimiento.
- La textura de papel puede reducir el contraste si se abusa de ella.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Rail lateral en escritorio, barra inferior en móvil y drawers para paneles. |
| Temas (Claro/Oscuro) | Es la decisión central: ambos modos son obligatorios y se prueban juntos. |
| Accesibilidad | AA, foco visible, `prefers-reduced-motion` y capturas por tema. |
| Seguridad y privacidad | Sin impacto directo. |
| Coste | Fuentes OFL e iconos libres; sin servicios de pago. |
| Portabilidad de datos | Sin impacto directo. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Fuentes de pago | No se contratan | Fraunces, Inter y JetBrains Mono son OFL y se sirven con `next/font` | M0-07 (#8) |
| Peso de texturas e imágenes | Banda de Vercel | SVG sutil, WebP y carga diferida | ADR 0005 |
| Regresiones de contraste | Sin coste económico | axe, capturas por tema y revisión de QA | M5-02 (#29) |
| Inconsistencia de tokens | Sin coste económico | Una fuente de verdad por regla y revisión de UI | M0-07 (#8) |

## Plan de revisión

Se revisa si la accesibilidad falla en un componente, si se plantea un tercer
tema o si cambia la dirección visual. Cualquier cambio de número de temas o de
sistema de diseño exige un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D2 y D15, §3.6 y §7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-002
- [`AGENTS.md`](../../AGENTS.md), regla 4
