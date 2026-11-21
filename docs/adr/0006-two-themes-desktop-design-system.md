# ADR 0006 — Dos temas y sistema de diseño de escritorio

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-026
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0010 y ADR 0018 de la etapa web
- **Relacionados:** ADR 0001, ADR 0009, ADR 0025

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

## Nota de implementación (2026-11-18, issue #65)

La primera implementación del sistema confirma la decisión con estos matices:

- **Componentes nativos.** Los componentes base se implementaron sin Radix ni
  shadcn, con HTML y React propios, para no añadir dependencias ni romper el
  aislamiento del renderer. Radix sigue siendo una opción futura si un patrón
  complejo (menús anidados, combobox, tablas) lo justifica.
- **Alias de tema.** `--paper` y `--ink` se invierten entre temas, así que los
  componentes usan `--bg` y `--fg` para fondo y texto base y no necesitan
  conocer el tema activo. `--ink` queda prohibido como color de texto o como
  fondo de componente.
- **Roles nuevos.** Se añadieron `--overlay` (velo de diálogo, independiente de
  `--ink`), `--disabled-surface` y `--disabled-text` (deshabilitado sin
  `opacity`), `--accent-contrast` y las superficies tintadas de estado
  (`--accent-surface`, `--success-surface`, `--warning-surface`,
  `--danger-surface`).
- **Fuentes.** Las pilas usan Fraunces, Inter y JetBrains Mono como primera
  opción con respaldo del sistema; el empaquetado OFL de los archivos sigue
  pendiente y no hay `@font-face` ni recursos remotos.
- **Tema en memoria.** Se conmuta desde la barra superior y arranca en Claro.
  La persistencia en `config.json` y la pantalla de Ajustes son posteriores; la
  preferencia todavía no se recuerda al reiniciar.
- **Verificación.** `tests/unit/design-tokens.test.ts` calcula el contraste por
  tema y comprueba la disciplina de tokens. Desde #70,
  `tests/e2e/accessibility.spec.ts` ejecuta axe sobre el shell en Claro y Oscuro
  y comprueba la ventana a 1024, 1280 y 1600 px. La matriz visual real, las
  capturas y la auditoría de todas las pantallas siguen en #93.

## Nota de revisión (2026-11-21, issue #124)

El ADR 0025 y D-048 modernizan la lectura estética de esta decisión: mantienen
los dos temas, los tokens en tres capas, la ventana mínima y las garantías de
accesibilidad, y cambian la paleta, las pilas tipográficas, la elevación y las
reglas de borde. Este ADR no se supersede; su histórico se conserva.

## Referencias

- [`docs/adr/0025-visual-direction-v2.md`](0025-visual-direction-v2.md)
- [`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D2 y D13
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-026
- WCAG 2.2, criterios de contraste, consultado el 18/11/2026.
