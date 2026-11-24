# Contrato y auditoría visual · #133 «Auditoría visual, temas y ruido»

> **Issue:** #133 · M1.5-10 · cierre del rediseño v2. **Variante:** `high`.
> **Estado:** Parte A (contrato) cerrada por `ui-ux-designer` el 24/11/2026. La
> Parte B (resultado) la genera `scripts/audit-report.mjs` a partir de la
> ejecución del arnés; no se edita a mano.
> **No sustituye** a la auditoría final de accesibilidad de M5 (#93).
>
> **Cómo leer este documento**
>
> - **Parte A — Contrato.** Vinculante para la implementación. Decide qué es
>   ruido, qué caja se queda, con qué token, qué se mide y con qué criterio se
>   acepta o se rechaza. Si algo de la Parte A se cambia, se registra aquí y en
>   el task file antes de tocar código.
> - **Parte B — Resultado de la auditoría.** Se rellena *después* de ejecutar
>   `tests/e2e/visual-audit.spec.ts`. Mientras esté vacía, #133 no está cerrada.
>
> **Referencias:** [`sistema-de-diseno.md`](sistema-de-diseno.md) (§3.1
> superficies, §4.5 contraste, §6 radios y elevación, §7 bordes, §11 estados,
> §12 accesibilidad, §13 movimiento, §15 textos, §17 verificación),
> [ADR 0025](../adr/0025-visual-direction-v2.md), [contrato de la ficha
> #129](ficha-issue-129.md), [contrato del editor #131](editor-issue-131.md),
> [contrato de relaciones #130](relaciones-issue-130.md).

---

# Parte A — Contrato

## 0. Alcance y principios

### 0.1 Qué resuelve esta issue

Cerrar M1.5 con evidencia, no con impresiones: convertir la revisión visual en
un arnés repetible (3 anchos × 2 temas), corregir el ruido objetivo demostrable y
registrar como issues hijas lo que no cabe en `size: m`.

### 0.2 Relación con §7 del sistema de diseño

§7 es la norma y aquí no se redecide:

- **Campos y controles interactivos:** 1 px `--border-strong` (su límite debe
  superar 3:1).
- **Divisores:** 1 px `--border`, decorativos, de una sola cara cuando separan.
- **Superficies flotantes:** borde + `--shadow-2` si hace falta.
- **Foco:** anillo de 2 px de `--focus` con 2 px de separación.
- **Tarjetas y secciones:** sin contorno por defecto; la jerarquía la hacen
  superficie, espacio, tamaño, peso y contraste.
- **Prohibido:** dobles bordes, bordes de 2 px decorativos y bordes que solo
  compensan una jerarquía débil.

Este contrato convierte §7 en una lista cerrada de selectores y mediciones. No
introduce colores, radios, sombras ni tipografías nuevas.

### 0.3 Defecto de la dirección v2 frente a mejora estética diferible

| Categoría | Definición | Qué se hace en #133 |
|---|---|---|
| **Defecto v2** | Contradice una regla escrita de §3.1/§6/§7/§12, o produce un fallo AA, de foco, de overflow o de texto invisible. | Se corrige siempre (o se abre issue hija si exige rediseñar un componente). |
| **Ruido objetivo** | Caja perimetral en contenido no interactivo, sombra en tarjeta, radio fuera de su papel, selector muerto o estilo que ningún consumidor usa. | Se corrige si es CSS local y de bajo riesgo (§3). |
| **Mejora estética diferible** | Cambio de composición, densidad, paleta, tipografía o microinteracción que no incumple ninguna regla y no afecta a AA, foco ni overflow. | **No** se hace en #133. Se registra en el backlog de diseño. |

Regla de desempate: si una corrección exige decidir entre dos composiciones
válidas, es estética y se difiere. Si una corrección evita una violación escrita,
es defecto y se hace.

### 0.4 Límites duros

- **No es un rediseño.** No se toca la composición de §10.1–§10.6, ni el shell,
  ni la navegación, ni el panel de propiedades, ni el editor.
- **Presupuesto:** los **5 bloques** de ruido del plan (`.wc-entity-card`,
  `.wc-activity__item`, `.wc-toolbar`, `.wc-filters`, `.wc-field-card`) **más la
  fila `.wc-type-list__item`**, que el plan dejó pendiente de clasificar y que
  este contrato cierra como contenido (§3.5): **6 bloques de caja**. Además, **1
  normalización de radio** (`.wc-alert`, C7), **2 selectores muertos** (C8), **1
  renombrado de clase** (C6), **1 corrección de estado** (C10/F1, §3.10) y **1
  regla condicionada a medición** (C9, §3.9). `.wc-gallery__item` se conserva,
  así que la otra fila pendiente no consume presupuesto. Si aparece algo más no
  trivial, va a issue hija.
- **Sin dependencias nuevas, sin cambios de datos, IPC, esquema ni migraciones.**
- **Capturas:** no se versionan PNG. Rutas locales en la Parte B; si el usuario
  las quiere en la PR, se adjuntan al publicar.

---

## 1. Inventario de pantallas, estados y overlays

### 1.1 Pantallas de producto

«Inyectable» significa que el estado se alcanza en E2E sin tocar producto. La
API `window.worldCraft` está congelada por `contextBridge`, así que **ningún
fallo de transporte se puede provocar desde el renderer**; esos estados se
evidencian en tests de componentes y en revisión estática, y así se declara.

| ID | Pantalla | Estados auditados | Contenido de prueba | Qué debe verse |
|---|---|---|---|---|
| **P1** | Inicio (`home-page.tsx`) | listo, largo, Continuar (mundo/ficha), vacío; carga y error solo en componentes | 7 mundos (5 + «Ver todos»), nombre 120, resumen 280, 8 géneros, 5 actividades | Mesa de trabajo en una columna: Continuar → Mundos recientes → Actividad. Tarjetas sin caja, actividad con divisores, una sola primaria (barra o vacío). |
| **P2** | Mundos (`worlds-page.tsx`) | listo, largo, filtro sin resultados, vacío; carga y error solo en componentes | 12 mundos, nombre/resumen/géneros al límite, un archivado, uno de 4.000 caracteres | Barra de filtros sin contorno, rejilla de tarjetas sin caja, contador `role="status"`, tarjeta a dos filas con acciones a pie. |
| **P3** | Mundo (`world-page.tsx`) | listo, largo, progreso 0/2/3, actividad vacía; carga y error solo en componentes | descripción 4.000, slug 80, 8 géneros, módulos previstos | Cabecera sin repetir el nombre, nav modular con `aria-current`, módulos previstos como texto con insignia, `dl` que colapsa, progreso con `aria-valuetext`. |
| **P4** | Fichas (`entities-page.tsx`) | listo, largo, filtro sin resultados, vacío; carga, error y error de tipos solo en componentes | 60 fichas (matriz) y 200 (rendimiento), nombre 120, resumen 280, 10 etiquetas, 12 tipos | Rejilla de tarjetas sin caja con banda de portada, filtros sin contorno, una primaria (cabecera o vacío, nunca dos). |
| **P5** | Ficha (`entity-detail-page.tsx`) | lectura, edición, panel abierto/cerrado, panel apilado (≤1180), largo, guardando/guardado; errores solo en componentes | nombre 120, 10 alias, resumen 280, descripción 12.000 y 50.000, 8 campos, 20 recursos | Documento legible, panel `--surface` sin borde, secciones con divisores, estados de guardado anunciados, cero scroll horizontal. |
| **P6** | Búsqueda (`search-page.tsx`) | inactiva con sugerencias, resultados, sin resultados, largo; carga, error y error de sugerencias solo en componentes | consulta 200, 30 resultados, nombres y extractos largos | Sugerencias y resultados con filas de control, resumen `aria-live`, filtros sin contorno. |

**Qué se exige en cada estado**

| Pantalla | Carga | Vacío | Error | Largo |
|---|---|---|---|---|
| P1 | `aria-busy` en la página, tres esqueletos de tarjeta, actividad sin pintar y `role="status"` oculto. | Una sola primaria «Crear mundo», lista de próximos pasos y nota; sin contadores ni accesos rápidos. | `wc-alert` con título, explicación, qué se conserva y «Volver a intentar». | 5 filas, resumen de 2 líneas, 8 géneros envueltos, 5 actividades con fecha relativa. |
| P2 | `wc-page__status` con `role="status"`. | `EmptyState` con una primaria. | Alerta con reintento. | Rejilla de 2/3 columnas, tarjeta a dos filas, nombre y resumen al límite. |
| P3 | `wc-page__status` con `role="status"`. | No aplica: un mundo abierto siempre tiene datos; los campos vacíos usan texto de reserva. | Alerta con «Volver a intentar» y «Volver a Inicio». | Descripción de 4.000 a 68ch, `dl` en una columna, 8 géneros, slug de 80. |
| P4 | `wc-page__status` con `role="status"`. | Una primaria «Crear ficha» (cabecera o vacío, nunca las dos). | Alerta con reintento; error de tipos en `wc-alert` sin bloquear la lista. | 60 tarjetas, 10 etiquetas, resumen de 3 líneas, filtros al límite. |
| P5 | Esqueletos de cabecera y sección con `aria-busy` y `role="status"`. | Descripción, relaciones y recursos con su mensaje de vacío; alias y resumen con texto de reserva. | Alerta en línea (`role="alert"`), foco al primer control inválido solo en fallo explícito; error de carga conserva «Volver». | 50.000 caracteres en el documento, 20 recursos, panel abierto y cerrado. |
| P6 | `role="status"` en sugerencias y en el resumen. | Sin consulta: sugerencias o vacío; con consulta y sin coincidencias: `wc-empty` con «Quitar filtros». | Alerta con reintento; error de sugerencias en texto, sin bloquear la búsqueda. | 30 resultados con nombres y extractos largos; consulta de 200. |

**Estados no inyectables (limitación declarada):** `loading` y `error` de P1–P6,
`activity` en carga/error, `error de tipos` en P4, `error de relaciones` y
`error de guardado` en P5, y `error de sugerencias` en P6. Su evidencia es:
`home-page.test.tsx`, `worlds.test.tsx`, `entities.test.tsx`,
`entity-detail.test.tsx`, `search.test.tsx`, `primitives.test.tsx`, más lectura
del CSS. La Parte B debe listar exactamente qué celdas quedan cubiertas así.

**Estados que sí se provocan con datos:** vacío real (perfil sin mundos / mundo
sin fichas), filtro sin resultados (texto imposible), progreso 0/2/3 (mundo con
y sin resumen/descripción/géneros), «Continuar» (abrir un mundo y volver),
actividad con y sin entradas del mundo abierto, guardando/guardado (editar y
esperar el autoguardado).

### 1.2 Overlays y superficies flotantes

Se auditan a **1024 y 1600 px × Claro/Oscuro**. 1280 no aporta señal nueva a un
elemento `position: fixed` y se evita duplicar capturas.

| ID | Overlay | Estados | Qué debe verse |
|---|---|---|---|
| **O1** | Paleta de comandos | vacía, resultados, creación, tema, reconstruir | `dialog` con `combobox` + `listbox`, foco en el campo, `aria-activedescendant`, sin «Muestras», lista con scroll interno, `Esc` cierra y devuelve el foco. |
| **O2** | Diálogos de mundo | normal, error de validación, texto largo | Foco al primer campo o `[data-autofocus]`, error asociado, `Esc`, retorno de foco, sin desbordar la ventana. |
| **O3** | Diálogos de ficha (crear, rápida, etiquetas, relación, tipos) | normal, error, listas largas | Scroll interno en `.wc-dialog__body`, sin cajas anidadas, filas del gestor de tipos planas con divisores, **mensaje de borrado bloqueado visible dentro del diálogo** (F1, §3.10). |
| **O4** | Menú `⋯` | corto, largo, borde derecho, dentro de diálogo | Volteo, altura máxima con rueda interna, `Esc` con retorno de foco, primer `Esc` solo cierra el tooltip. |
| **O5** | Tooltip | hover, foco, borde, dentro de diálogo | Máximo 18 rem, sin recorte, `aria-describedby`, `Esc` sin cerrar el diálogo. |
| **O6** | Toast | éxito, error, varios apilados, cierre manual | `role="status"` + `aria-live="polite"`, contraste AA, cierre manual, no tapa el control enfocado. **No se ve sobre un diálogo modal** (ver F1): no se usa como único canal de un error dentro de un diálogo. |
| **O7** | Editor Tiptap | lectura, edición, barra, enlace, menciones vacías/con resultados | Cinco acciones en una fila a 1024, popup con clamp, foco en el editor, lectura sin barra. |
| **O8** | Tema y rail | ambos temas, rail 64/240 | Sin salto de layout, estado persistido, sin animación de plegado con movimiento reducido. |

### 1.3 Muestras (banco interno, no producto)

`#/internal/samples` se audita como banco de primitivas a 3 anchos × 2 temas y se
le pasa axe. **No** entra en navegación, paleta, manual de producto ni en la
comprobación de textos de producto. La palabra «Muestras» puede aparecer en su
propia página y en el `h1` contextual; en cualquier otra vista es un fallo.

### 1.4 Matriz

| Bloque | Celdas |
|---|---|
| P1–P6 listo/largo | 6 × 3 × 2 = 36 |
| P1, P2, P4, P6 vacío / filtro sin resultados | 4 × 2 (1024/1600) × 2 = 16 |
| O1–O7 | 7 × 2 × 2 = 28 |
| Muestras | 3 × 2 = 6 |
| Extra: rail plegado a 1024 | 2 temas |
| **Total** | **88 celdas** (ninguna versionada) |

Cada una deja una entrada en `records.json` con vista, estado, tema, ancho,
métricas de overflow, ratio de contraste, resultado de axe y ruta de captura.

---

## 2. Clasificación vinculante de superficies

### 2.1 Taxonomía

| Tipo | Definición | Borde | Sombra | Radio |
|---|---|---|---|---|
| **Contenido** | Agrupa información; no recibe clic. | No (solo divisores de una cara) | No | ≤ `--radius-md` |
| **Control** | Recibe clic o foco por sí mismo. | `--border-strong` si el límite es necesario para identificarlo | No | `--radius-sm`; `--radius-md` en filas grandes |
| **Campo** | Entrada de datos (input, select, textarea, contenteditable). | `--border-strong` | No | `--radius-sm` |
| **Alerta / estado** | Comunica un estado semántico (error, aviso, carga). | `--danger`/`--warning`/`--border` según el estado | No | `--radius-md` |
| **Flotante** | Se superpone al lienzo (diálogo, menú, tooltip, paleta, toast). | `--border`/`--border-strong` | `--shadow-2` | `--radius-lg` o `--radius-md` |
| **Barra adhesiva** | Permanece al hacer scroll (topbar). | Divisor de una cara | `--shadow-1` | 0 |
| **Chip / marca** | Insignia, etiqueta, marca de tipo. | Marca o `--border`; nunca es límite de control | No | `--radius-pill` |
| **Divisor** | Separa dos bloques en una sola cara. | 1 px `--border` | No | 0 |
| **Banco** | Muestrario interno de roles (Muestras). | Permitido: su función es enseñar el borde | No | ≤ `--radius-md` |

### 2.2 Criterio objetivo de ruido (cerrado)

Es ruido corregible en #133 un contenedor de **contenido** que en reposo:

1. dibuja un **borde perimetral** (los cuatro lados) **o** una sombra
   `--shadow-1/2`; **y**
2. usa un radio mayor que `--radius-md` **o** anida otro contenedor con borde y
   relleno propios.

Además son ruido, aunque no encajen en 1–2:

- declaraciones que **ningún consumidor usa** (el look real lo decide otro
  selector que ya las anula);
- **selectores muertos** (la clase no existe en TSX/TS);
- **radios fuera de su papel** según §6.2.

No es ruido: overlay, control, campo, alerta, chip, divisor, barra adhesiva,
marco de miniatura y banco de muestras. Un radio `--radius-lg` en un contenedor
de contenido **sí** es defecto, aunque no haya sombra.

### 2.3 Tabla maestra (selector a selector)

| Selector | Tipo | Decisión | Tokens exactos | Justificación | Riesgo si se aplica |
|---|---|---|---|---|---|
| `.wc-entity-card` | Contenido | **Pierde** borde y sombra; radio md; fondo `--surface` | `border: 0`; `box-shadow: none`; `--radius-md`; `--surface` | Contradice §6.3 y §7 (tarjeta con contorno + sombra + `--radius-lg`). `--surface-raised` está reservado a superficies flotantes (§3.1). | Baja: mismo patrón que `.wc-world-card` (#127). La banda de portada da el borde visual. |
| `.wc-entity-card__media` | Contenido (banda) | **Conserva** el divisor de una cara; fondo pasa a hundido | `background-color: var(--surface-sunken)`; `border-block-end: 1px solid var(--border)` | La banda necesita separarse del contenido ahora que la tarjeta no tiene borde. Un divisor de una cara está permitido. | Baja: la banda se oscurece un paso; AA no cambia (no hay texto encima). |
| `.wc-activity__item` | Contenido (fila) | **Pierde** caja; filas con divisor | sin `border`/`radius`/`fondo`; `padding-block: var(--space-2)`; `li + li { border-block-start: 1px solid var(--border) }` | Su caja base la anulaban **los dos** consumidores (`.wc-home-activity`, `.wc-world-activity`): era look muerto. §10.2 pide actividad separada por divisor. | Baja: aparecen líneas finas entre entradas; si no gustan, se revierte una regla. |
| `.wc-toolbar` | Agrupación de controles | **Pierde** borde; radio md; conserva superficie | `border: 0`; `--radius-md`; `--surface`; `padding: var(--space-4)` | §3.1 permite `--surface` para separar un bloque; el contorno era lo único que lo convertía en caja. `--radius-lg` no es su papel. | Media-baja: en Claro el paso es 1,05:1; los campos (3,68:1) y el contador `--muted` sostienen el grupo. Verificar a 1024. |
| `.wc-filters` | Agrupación de controles | Igual que `.wc-toolbar` | `border: 0`; `--radius-md`; `--surface` | Igual. Además el borde perimetral se repetía en Fichas y Búsqueda. | Media-baja: mismo caso. Ver §3.9 para el desbordamiento a 1024. |
| `.wc-field-card` → `.wc-field-group` | Agrupación de campos | **Renombrar** y **perder** caja; divisor entre grupos | sin `border`/`radius`/`fondo`; `padding-block: var(--space-3)`; `+ { border-block-start: 1px solid var(--border) }` | Es un grupo de campos dentro de un diálogo: caja dentro de caja (§3.1). El nombre `-card` mentía sobre su papel. Los inputs ya se delimitan solos. | Baja-media: el formulario de tipos queda más plano; el divisor y el botón «Quitar» mantienen la unidad. |
| `.wc-type-list__item` | Contenido con acciones | **Pierde** caja; divisor entre filas | sin `border`/`radius`/`fondo`; `padding: var(--space-3) 0`; `+ { border-block-start: 1px solid var(--border) }` | No es seleccionable (los botones son los controles), así que aplica la decisión aprobada: borde solo en filas accionables. | Baja: la insignia, el icono y las acciones siguen estructurando cada fila. |
| `.wc-gallery__item` | Marco de miniatura | **Conserva** borde y radio | `1px solid var(--border)`; `--radius-md`; `--surface-raised` | Contrato de #129: la miniatura es un objeto gráfico y el marco delimita la imagen y su botón. Excepción declarada. | — |
| `.wc-alert` | Alerta | **Conserva** borde y superficie; radio md | `1px solid var(--danger)`; `--danger-surface`; `--radius-md` | El borde comunica estado (excepción de §6.1). `--radius-lg` no es su papel y `.wc-alert--inline` ya usa md. | Nula: no cambia contraste ni medida. |
| `.wc-page__status` | Estado (carga/vacío) | **Conserva** borde, radio md y `--surface-raised` | `1px solid var(--border)`; `--radius-md` | No cumple el criterio de ruido (radio = md, sin sombra) y agrupa un mensaje transitorio con `role="status"`. | Nula. |
| `.wc-updates__status` | Estado | **Conserva** | `1px solid var(--border)`; `--radius-md`; `--surface` | Estado dentro del diálogo de actualizaciones; mismo caso. | Nula. |
| `.wc-search-hit` | Control (fila) | **Conserva** borde; `--border` en reposo | `1px solid var(--border)`; `--radius-md`; hover `--accent` | Es un botón con texto propio, cursor y foco: el borde no es lo único que lo identifica (1.4.11). Observación minor en §2.4. | Nula. |
| `.wc-image-picker__item` | Control (selección) | **Conserva** | `2px solid transparent` → `--accent` con `aria-pressed` | El borde es el estado de selección; el reposo no dibuja caja. | Nula. |
| `.wc-editor__toolbar` + `.wc-editor__content` | Campo (pieza) | **Conserva** | `1px solid var(--border)`; `--radius-md` | Contrato de #131: barra y campo son una pieza; el campo se identifica por la barra, el texto, el placeholder y el foco. Excepción declarada. | Nula (no se toca). |
| `.wc-entity-cover` | Marco de portada | **Conserva** | `1px solid var(--border)`; `--radius-sm` | Contrato de #129. | Nula. |
| `.wc-tag`, `.wc-badge`, `.wc-type-mark-group`, `.wc-swatch__chip` | Chip / marca | **Conserva** | `--border` o `--entity-*`; `--radius-pill`/`sm` | Un chip no es límite de control; el color nunca es el único indicador (siempre lleva texto o forma). | Nula. |
| `.wc-swatch` | Banco (Muestras) | **Conserva** borde | `1px solid var(--border)`; `--radius-sm` | Su función es mostrar el rol de superficie; el borde hace visible el borde del color. Solo existe en el banco interno. | Nula. |
| `.wc-skip-link`, `.wc-topbar`, `.wc-toast`, `.wc-dialog`, `.wc-menu__list`, `.wc-tooltip__bubble`, `.wc-palette*` | Flotante / barra adhesiva | **Conserva** | borde + `--shadow-1/2` | §6.3 y §7 los permiten explícitamente. | Nula. |
| `.wc-form__error`, `.wc-activity__error`, `.wc-inline-confirm` | Alerta | **Conserva** | `1px solid var(--danger)`; `--danger-surface`; `--radius-md` | Superficie semántica de error. | Nula. |
| `.wc-world-card`, `.wc-card`, `.wc-panel`, `.wc-continue__panel`, `.wc-entity-properties`, `.wc-page__section`, `.wc-disclosure`, `.wc-empty`, `.wc-home-activity`, `.wc-world-activity`, `.wc-relation-item` | Contenido | **Ya cumplen**; no se tocan | sin borde perimetral ni sombra | Base de la regresión: el guardarraíl debe impedir que vuelvan a coger caja. | Nula si no se tocan. |

### 2.4 Casos revisados que se quedan como están (con motivo)

- **`.wc-page__status`**: es el candidato más discutible del inventario. Se queda
  porque (a) no cumple el criterio de ruido, (b) agrupa un `role="status"`
  transitorio y (c) sustituirlo por texto suelto implicaría un cambio de
  composición en cuatro pantallas, es decir, rediseño. Se revisará si el usuario
  pide una pasada de densidad.
- **`.wc-search-hit`**: borde `--border` (1,23:1) en un botón con texto, hover y
  foco. No es violación de 1.4.11 porque el límite no es la única información
  para identificarlo. **Observación minor:** si se quisiera un límite de 3:1,
  sería `--border-strong`; no se hace en #133.
- **Editor y portada**: excepciones ya aprobadas en #129/#131; este contrato no
  las reabre.
- **Muestras**: banco de roles; sus bordes son el objeto de la página.

### 2.5 Cómo se conserva la jerarquía sin caja

| Dónde | Antes | Ahora |
|---|---|---|
| P1/P3 actividad | Caja por fila (anulada en los dos consumidores) | Divisor de 1 px entre filas + peso y tamaño secundarios + hora en mono y `--muted`. |
| P2 barra de filtros | Caja con contorno | Superficie `--surface` (paso 1,05:1 / 1,08:1), relleno 16 px, radio 6 px; los campos con `--border-strong` (3,68:1 / 4,34:1) son los anclajes. |
| P4 filtros | Caja con contorno | Igual; el contador y la casilla cierran el grupo. |
| P4 tarjetas | Borde + sombra + radio 8 | Gap de 16 px, banda de portada hundida de 8 rem con divisor inferior, nombre serif 18/600, insignia de tipo, resumen `--muted`, etiquetas. Precedente aprobado: `.wc-world-card` (#127). |
| O3 gestor de tipos | Caja por fila y por grupo de campos | Divisores, insignia, icono de tipo, metadatos y acciones a la derecha. |

El paso de superficie es tenue (1,05:1 en Claro, 1,08:1 en Oscuro). **La
separación efectiva la dan el espacio y la banda hundida, no el tono.** Es una
decisión de la dirección v2, no una carencia: la tarjeta no debe competir con el
contenido.

### 2.6 Matriz de temas de las correcciones

Ninguna corrección introduce selectores `[data-theme]`: todas usan roles
semánticos y el tema los resuelve. Esta tabla comprueba que la pareja resultante
tiene sentido en ambos modos.

| Corrección | Claro | Oscuro | Comprobación |
|---|---|---|---|
| C1 tarjeta | `--surface` `#fbfaf7` sobre `--bg` `#f6f4ef` (1,05:1); banda `--surface-sunken` `#efece4`; texto `--fg` 14,55:1 | `--surface` `#1b1f1c` sobre `#141715` (1,08:1); banda `#0f1210`; texto `--fg` 15,17:1 | La banda hundida se separa del contenido en ambos; no queda superficie invisible. |
| C2 actividad | Divisor `#e1ddd2`; texto `--fg` y `--muted` sobre `--bg` | Divisor `#343b36`; texto `--fg` y `--muted` sobre `--bg` | El divisor es decorativo (1,23:1 / 1,57:1) y no es límite de control. |
| C3/C4 barras | `--surface`; campos `--border-strong` 3,68:1 | `--surface`; campos `--border-strong` 4,34:1 | El grupo se lee por la superficie y los campos, no por el contorno. |
| C5/C6 filas y grupos | Sobre `--surface-raised` `#ffffff`; divisores `#e1ddd2` | Sobre `--surface-raised` `#222723`; divisores `#343b36` | El diálogo conserva su escalón; las filas no crean una segunda caja. |
| C7 alerta | `--danger-surface` `#f6e2df`, borde `--danger` 5,36:1, texto `--fg` | `--danger-surface` `#3a2523`, borde 7,07:1, texto `--fg` | La señal semántica se mantiene; solo cambia el radio. |
| C8 muertos | Sin efecto | Sin efecto | No hay cambio visual. |

---

## 3. Correcciones exactas

Ninguna introduce tokens nuevos. Todas usan `--surface`, `--surface-sunken`,
`--border`, `--danger` y `--radius-md` existentes.

### 3.1 C1 · Tarjeta de ficha (Fichas)

`.wc-entity-card`

```css
/* antes */
border: 1px solid var(--border);
border-radius: var(--radius-lg);
background-color: var(--surface-raised);
box-shadow: var(--shadow-1);

/* después: se eliminan las declaraciones de `border` y `box-shadow` */
border-radius: var(--radius-md);
background-color: var(--surface);
```

`.wc-entity-card__media`: `background-color: var(--surface)` →
`var(--surface-sunken)`. Se conserva `border-block-end: 1px solid var(--border)`
y no se añade ningún otro borde. Se conserva `overflow: hidden` en la tarjeta
para recortar la banda con el radio.

**Consecuencia aceptada:** al pasar la tarjeta a `--surface`, las etiquetas
neutras (`.wc-tag`, fondo `--surface`) dejan de tener un paso de tono con la
tarjeta y quedan como píldoras contorneadas por `--border`. Las etiquetas
tintadas (`--entity-*-surface`) conservan su fondo. No es fallo AA (el texto es
`--fg` sobre la misma superficie) y el chip sigue siendo legible por su borde y
su forma; no se añade ningún override de chip dentro de la tarjeta.

### 3.2 C2 · Actividad (Inicio y Mundo)

`.wc-activity`: `gap: var(--space-2)` → `gap: 0`.

`.wc-activity__item`

```css
/* antes */
padding: var(--space-3) var(--space-4);
border: 1px solid var(--border);
border-radius: var(--radius-md);
background-color: var(--surface-raised);

/* después */
padding: var(--space-2) 0;
```

Nueva regla, inmediatamente después:

```css
.wc-activity__item + .wc-activity__item {
  border-block-start: 1px solid var(--border);
}
```

En `.wc-home-activity .wc-activity__item, .wc-world-activity .wc-activity__item`
se **eliminan** `padding: 0`, `border: 0` y `background-color: transparent` (ya
no hace falta anular nada) y se conservan las reglas tipográficas
(`font-weight`, `font-size`). El nombre de clase `.wc-activity__item` no cambia:
`home-page.test.tsx` cuenta cinco con ese selector.

### 3.3 C3 · Barra de herramientas de Mundos

`.wc-toolbar`: eliminar `border: 1px solid var(--border)`;
`border-radius: var(--radius-lg)` → `var(--radius-md)`. Se conservan
`background-color: var(--surface)` y `padding: var(--space-4)`. No se toca
`.wc-toolbar > .wc-field` ni `.wc-toolbar__count`.

### 3.4 C4 · Filtros de Fichas y Búsqueda

`.wc-filters`: eliminar `border: 1px solid var(--border)`;
`border-radius: var(--radius-lg)` → `var(--radius-md)`. Se conservan
`background-color: var(--surface)`, `padding: var(--space-4)` y la rejilla. El
selector se mantiene porque `entities.spec.ts` lo usa como localizador.

### 3.5 C5 · Filas del gestor de tipos (diálogo)

`.wc-type-list`: `gap: var(--space-2)` → `gap: 0`.

`.wc-type-list__item`

```css
/* antes */
padding: var(--space-3);
border: 1px solid var(--border);
border-radius: var(--radius-md);
background-color: var(--surface-raised);

/* después */
padding: var(--space-3) 0;
```

Nueva regla:

```css
.wc-type-list__item + .wc-type-list__item {
  border-block-start: 1px solid var(--border);
}
```

### 3.6 C6 · Grupo de campos del gestor de tipos (renombrado)

En `components.css`, renombrar el bloque y su hijo:

- `.wc-field-card` → `.wc-field-group`
- `.wc-field-card__actions` → `.wc-field-group__actions`

Contenido nuevo:

```css
.wc-field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  padding-block: var(--space-3);
}

.wc-field-group + .wc-field-group {
  border-block-start: 1px solid var(--border);
}
```

Se eliminan `padding: var(--space-3)`, `border`, `border-radius` y
`background-color`. `.wc-field-list`: `gap: var(--space-3)` → `gap: 0`.

En `entity-type-manager.tsx` cambian exactamente dos `className`:
`wc-field-card` → `wc-field-group` y `wc-field-card__actions` →
`wc-field-group__actions`. No hay tests ni estilos que dependan del nombre viejo
(verificado en `src/` y `tests/`).

### 3.7 C7 · Radio de la alerta

`.wc-alert`: `border-radius: var(--radius-lg)` → `var(--radius-md)`. Se
conservan `border: 1px solid var(--danger)`, `--danger-surface` y el relleno. No
se toca `.wc-alert--inline`.

### 3.8 C8 · Selectores muertos

Eliminar por completo:

- `.wc-button__icon` (bloque de `components.css`, entre los modificadores del
  botón). No aparece en TSX/TS.
- `.wc-swatch__meta` (bloque del muestrario). No aparece en TSX/TS.

`is-editor-empty` **no** es un selector muerto: lo genera Tiptap. Va en la
allowlist del nuevo `tests/unit/design-noise.test.ts` con comentario.
`.wc-entity-card__name` tampoco es un selector muerto de CSS: no tiene regla y
es una clase de TSX sin estilo propio; el test no debe confundir «clase de CSS no
usada en TSX» con «clase de TSX sin CSS».

### 3.9 C9 · Regla condicionada a medición (solo si el arnés lo demuestra)

En Fichas, a 1024 px con rail expandido y barra de desplazamiento vertical, la
rejilla de `.wc-filters` (`14rem` + 3 × `9rem` + 3 huecos = 692 px) puede superar
el ancho interior disponible (≈689 px). Si el arnés mide
`scrollWidth > clientWidth` en `.wc-filters`, se añade —reutilizando el
precedente de `.wc-filters--search`—:

```css
@media (max-width: 1180px) {
  .wc-filters {
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }
}
```

Si no hay desbordamiento, **no se aplica**. La Parte B registra la medición.

### 3.10 C10 · Estado de borrado bloqueado dentro del diálogo (F1)

**Hallazgo major pre-registrado.** `<ToastRegion>` se monta fuera del shell
(`App.tsx`) y `Dialog` usa `showModal()`, que promueve el diálogo a la *top
layer*: ningún `z-index` (incluido `--z-toast`) pinta por encima. Por tanto, en
el gestor de tipos, `onNotify('error', removeBlocked)` y los toasts de éxito
mientras el diálogo sigue abierto **no se ven**; el anuncio a lectores de
pantalla no es garantizable con un modal abierto y, en todo caso, no sustituye a
una confirmación visual.

Corrección mínima, sin tocar la primitiva de avisos ni añadir textos:

- En `entity-type-manager.tsx`, si `remove` devuelve `deleted: false`, **no**
  cerrar la confirmación: mantener `pendingDelete`, guardar el mensaje existente
  `messages.entities.types.removeBlocked` en un estado local y renderizarlo
  dentro del `.wc-inline-confirm` que ya existe, como párrafo con
  `role="alert"`; ocultar «Eliminar» y dejar «Cancelar». Al cancelar, limpiar el
  error y cerrar la confirmación. Sin clases nuevas.
- Los toasts de éxito dentro del diálogo se aceptan como no bloqueantes (la
  lista se actualiza a la vista). Convertirlos a un `role="status"` interno es
  opcional.
- No se cambia `ToastRegion`, `Dialog` ni la escala de capas en #133. Una
  solución sistémica (avisos en la top layer) es una **issue hija**, no parte de
  este presupuesto.

Criterio verificable: con un tipo custom en uso, abrir el gestor, intentar
borrarlo y comprobar que el texto de `removeBlocked` es visible **dentro** del
diálogo (`expect(dialog.getByText(...)).toBeVisible()`), no solo presente en el
DOM global.

### 3.11 Lo que no se cambia

- Composición, orden y densidad de las seis pantallas (§10 del sistema).
- El shell, el rail, la topbar y la navegación.
- El panel de propiedades, el editor y las relaciones (contratos #129–#131).
- El rol `--surface-raised` para flotantes, el foco, las sombras y los radios.
- `.wc-page__status`, `.wc-updates__status`, `.wc-gallery__item`,
  `.wc-entity-cover`, `.wc-search-hit`, `.wc-image-picker__item`, chips y banco.

---

## 4. Contraste AA

### 4.1 Protocolo

- Se mide con colores **computados** en el elemento real, componiendo fondos con
  alfa sobre su ancestro opaco. No se confía en §4.5: se recalcula con WCAG 2.2
  (sRGB) y se contrasta el valor con la tabla.
- Una vez por tema a 1280; axe cubre el resto de celdas y ambos temas.
- Mínimos: **4,5:1** texto normal; **3:1** texto grande (≥ 24 px, o ≥ 18,66 px en
  negrita) y componentes gráficos (bordes de control, anillos, marcas, iconos con
  acción).
- Si un par **no** figura en §4.5 y se estabiliza, se añade a §4.5 y a
  `tests/unit/design-tokens.test.ts` en la misma tarea.
- Si un par **falla**:
  1. se bloquea el cierre de #133;
  2. se corrige el rol (token) o la asignación del componente, nunca el mínimo;
  3. si el token es correcto y falla por el fondo compuesto, se cambia la
     superficie del componente;
  4. se vuelve a medir en ambos temas. No se acepta «se ve bien en la captura».

### 4.2 Parejas a medir (lista cerrada)

| # | Pareja | Dónde se comprueba | Mín. | Ref. §4.5 |
|---|---|---|---|---|
| 1 | `--fg` / `--bg` | Texto de página, descripciones, actividad | 4,5 | 13,82 / 16,43 |
| 2 | `--fg` / `--surface` | Etiquetas de campo, tarjeta de mundo, barra de filtros | 4,5 | 14,55 / 15,17 |
| 3 | `--fg` / `--surface-raised` | Diálogo, menú, toast, nombre de tarjeta | 4,5 | 15,19 / 13,82 |
| 4 | `--fg` / `--surface-sunken` | Rail | 4,5 | 12,87 / 17,15 |
| 5 | `--muted` / `--bg` | Antetítulo, descripción de vacío, hora de actividad | 4,5 | 5,07 / 7,74 |
| 6 | `--muted` / `--surface` | Contador de la barra, resumen de tarjeta de mundo | 4,5 | 5,34 / 7,15 |
| 7 | `--muted` / `--surface-raised` | Resumen y metadatos de ficha, ayuda de diálogo | 4,5 | 5,58 / 6,51 |
| 8 | `--muted` / `--surface-sunken` | Ayuda del rail / insignia neutra | 4,5 | 4,72 / 8,08 |
| 9 | `--accent` / `--bg` | Enlaces de contenido | 4,5 | 7,08 / 8,01 |
| 10 | `--accent` / `--accent-surface` | Insignia de acento, chip de mención | 4,5 | 6,54 / 5,44 |
| 11 | `--accent-strong` / `--bg` | Enlace de relación, referencias | 4,5 | — (ficha #129: 9,05 / 9,92) |
| 12 | `--accent-contrast` / `--accent` | Botón primario | 4,5 | 7,78 / 8,36 |
| 13 | `--fg` / `--danger-surface` | Texto de alerta y de error de formulario | 4,5 | — (≈13:1) |
| 14 | `--danger` / `--danger-surface` | Borde de alerta (gráfico) | 3 | 5,36 / 7,07 |
| 15 | `--danger-contrast` / `--danger` | Botón destructivo | 4,5 | 6,68 / 9,32 |
| 16 | `--success` / `--success-surface` | Insignia «Activo», estado guardado | 4,5 | 5,35 / 7,74 |
| 17 | `--warning` / `--warning-surface` | Insignia de aviso | 4,5 | 4,96 / 6,99 |
| 18 | `--warning` / `--surface-raised` | Estrella de favorito (gráfico) | 3 | — |
| 19 | `--disabled-text` / `--disabled-surface` | Botón y opción deshabilitados | 4,5 | 4,72 / 7,74 |
| 20 | `--disabled-border` / `--disabled-surface` | Límite de control deshabilitado | 3 | 3,26 / 4,70 |
| 21 | `--border-strong` / `--bg` y / `--surface` | Campo en reposo | 3 | 3,50 / 3,68 y 4,70 / 4,34 |
| 22 | `--focus` / `--bg`, `--surface`, `--surface-raised`, `--surface-sunken`, `--accent-surface` | Anillo de foco | 3 | 7,08–7,78 / 8,34–10,35 |
| 23 | `--fg` / `--selection` | Entrada actual del rail, selección | 4,5 | 11,44 / 11,22 |
| 24 | `--entity-*` / `--entity-*-surface` | Marca de tipo, icono, chip | 3 | 3,64–6,54 / 5,44–10,12 |

**Prohibición expresa:** `--muted` sobre `--selection` (4,20:1 en Claro). El
estado seleccionado usa `--fg`. El arnés incluye una aserción de que ningún
descendiente de `[aria-current="page"]` ni de un elemento con
`background-color` igual a `--selection` calcula `color` igual a `--muted`.

**Fondos con alfa:** `--overlay` y las sombras. El texto nunca va sobre el velo;
el contraste del texto del diálogo se mide contra `--surface-raised` (opaco).

---

## 5. Foco y teclado

### 5.1 Reglas

- Anillo único de **2 px `--focus` con 2 px de separación** (`:focus-visible`).
  Ningún componente lo anula sin sustituto equivalente (el separador del panel
  usa `box-shadow` de 2 px `--bg` + 2 px `--focus` sobre la pastilla visible).
- **Objetivos**: 28×28 px mínimo (filas, casillas, botones `sm`) y 32×32 px en
  controles principales (`wc-button`, `wc-icon-button`, acciones del editor). Se
  mide con `boundingBox()`.
- **Sin `tabindex > 0`.** Se permite `tabindex="0"` solo en regiones
  desplazables sin hijos enfocables (`.wc-dialog__body`) y en el panel de
  pestañas (roving), y `tabindex="-1"` para destino de foco (`#wc-main`,
  alertas, carga de relaciones).
- **Orden = orden DOM.** Sin `tabindex` positivo y sin reordenar con CSS.
- **Al abrir** un overlay: diálogo → `[data-autofocus]` o primer enfocable;
  menú → primer ítem; paleta → campo; confirmación destructiva → «Cancelar».
- **Al cerrar**: retorno al disparador (menú, diálogo) o a «Editar» (fin de
  edición). El tooltip consume el primer `Escape`; el diálogo, el segundo.
- **No robar foco**: autoguardado, toast, `aria-live` y actualizaciones.

### 5.2 Orden esperado por pantalla

| Pantalla | Orden de tabulación |
|---|---|
| Todas | Enlace de salto → rail (Inicio, Mundos, plegar) → topbar (Buscar, primaria, `⋯`, actualizaciones, tema) → `main` en orden DOM. |
| P1 | «Abrir» de Continuar → tarjetas (Abrir, favorito solo si existe, `⋯`) → «Ver todos» → fin. La actividad no es enfocable. |
| P2 | Campo de búsqueda → estado → `⋯`; por tarjeta: Abrir → `⋯`. |
| P3 | Volver → módulo Fichas → acciones de la tarjeta si las hubiera; los módulos «Previsto» no reciben foco. |
| P4 | Volver → Nueva ficha → `⋯` → búsqueda → tipo → etiqueta → estado → favoritos → «Quitar filtros» → tarjetas (Abrir, favorito, `⋯`). |
| P5 | Volver → toggle del panel → (cabecera) Favorito → Editar (o Guardar ahora + Listo) → `⋯` → secciones (`h3 > button` y sus acciones) → separador (si el panel está abierto) → panel. |
| P6 | Búsqueda → filtros → «Quitar filtros» → resultados en orden → «Ver todos» si existe. |

### 5.3 Comprobaciones automáticas

1. Recorrido completo con `Tab` en cada pantalla de la matriz; cada parada
   tiene `outline-width` ≥ 2 px y `outline-color` igual a `--focus` (o el
   sustituto declarado), y es visible en el viewport.
2. `document.querySelectorAll('[tabindex]')` sin valores > 0.
3. Al abrir/cerrar cada overlay, `document.activeElement` es el esperado.
4. `Esc` cierra en el orden correcto (tooltip → menú → diálogo) y devuelve foco.
5. Ningún control interactivo mide menos de 28 px en su eje menor; los
   principales, 32.

---

## 6. Movimiento reducido

Con `prefers-reduced-motion: reduce` (Playwright:
`page.emulateMedia({ reducedMotion: 'reduce' })`), `base.css` fuerza
`animation-duration` y `transition-duration` a 0,01 ms, `animation-iteration-count: 1`
y `scroll-behavior: auto`. El contrato exige comprobar que **no queda información
solo en el movimiento**:

| Elemento | Animación | Con movimiento reducido |
|---|---|---|
| `.wc-skeleton` | `wc-skeleton-pulse` 1,4 s infinita | Queda estático; el contenedor conserva `aria-busy` y el `role="status"` textual. |
| `wc-button__spinner`, carga de la paleta | `wc-spin` 700 ms infinita | Queda quieto; el estado se anuncia por `aria-busy`/`role="status"`. |
| Menciones del editor | `wc-mention-in` | Aparece sin desplazamiento. |
| `.wc-shell` | `grid-template-columns` | El plegado es instantáneo (sin animación de 240→64). |
| Hover de rail, tarjeta, Continuar, búsqueda, pastilla del separador | `background-color`/`color` | Cambio instantáneo. |
| Diálogos, menús, tooltips, paleta | Sin animación declarada | Sin cambio. |

**Cómo se comprueba**

1. En cada pantalla, con movimiento reducido, leer
   `getComputedStyle(el).animationDuration` y `transitionDuration` de una lista
   cerrada de elementos (esqueleto, spinner, mención, shell, tarjeta, nav) y
   exigir ≤ 0,01 s.
2. Plegar el rail, leer `transitionDuration` de `.wc-shell` (≤ 0,01 s) y
   comprobar que el ancho del rail es 64 px en el frame siguiente, sin valores
   intermedios.
3. Ningún bucle infinito con `animation-iteration-count > 1` ni
   `animation-play-state: running` en elementos visibles.
4. Sin `transform` de entrada en popups de mención ni tooltips.
5. Capturas con `animations: 'disabled'` para el resto.

No se añaden animaciones nuevas en #133.

---

## 7. Textos y navegación

### 7.1 Catálogo

- Todo texto visible sale de `messages/es.ts` con claves tipadas. Cualquier
  literal nuevo de una corrección va al catálogo; `tests/unit/i18n/no-hardcoded.test.ts`
  y `catalog.test.ts` son la puerta.
- Tono: cercano y directo, verbos en los botones, el error dice qué pasó, qué se
  conserva y qué hacer. Sin jerga técnica ni códigos.
- No se presentan funciones no disponibles como actuales.

### 7.2 Fechas y plurales

- Fechas relativas con `Intl.RelativeTimeFormat` y las ventanas de
  `sistema-de-diseno.md` §10.2; el `<time>` lleva `dateTime` ISO y `title` con
  fecha y hora. El arnés recalcula el texto esperado para su `now` y tolera una
  unidad por el paso del reloj.
- Números con `Intl.NumberFormat` (incluye `tookMs`); plurales con
  `formats.plural` donde la frase lo permita.
- No se hardcodea «hace 2 días» en ninguna prueba.

### 7.3 Navegación de producto

- Rail solo **Inicio** y **Mundos**; sin lema, sin versión, sin campana, sin
  buscador duplicado, sin actualizaciones como ítem.
- Paleta sin «Muestras».
- Módulos «Previsto» (Mapas, Manuscrito, Grafo) no son `button`/`a`, no tienen
  `tabindex` ni generan enlaces muertos; hay una nota al pie.
- En producto no hay `a[href]` salvo el enlace de salto y los enlaces internos
  `wc-entity://` del editor.
- «Muestras» solo puede aparecer en `#/internal/samples` (título de la barra y
  contenido del banco).

### 7.4 Observaciones de texto detectadas (no bloqueantes)

| ID | Texto / sitio | Problema | Decisión |
|---|---|---|---|
| **T1** | `home.emptyDescription`: «… aparecerá aquí, con su portada, su descripción y los accesos a cada sección» | «Los accesos a cada sección» sugiere mapas y manuscrito, que aún no existen. | **Minor.** Si se corrige, se cambia solo el sintagma por «… con su portada, su descripción y sus fichas» en el catálogo. No cambia estructura ni estilos. No bloquea #133. |
| **T2** | `home.nextSteps` (4 pasos con mapas, grafo y manuscrito) | La sección ya se rotula como futura («Qué podrás hacer cuando exista el primer mundo»), así que no se presenta como disponible. | **No se toca.** Se conserva; el manual ya la marca como prevista. |
| **T3** | `search.count`, `showing` y `rebuilt` pluralizan a mano | `worlds.list.count` usa `formats.plural`; aquí hay tres funciones que no. | **Minor.** Se unifican en una tarea de textos, no en #133 (`size: m`). Correcto en español hoy. |
| **T4** | `search.took`: «Tiempo de búsqueda: ${ms} ms» | Interpola el número sin `Intl.NumberFormat` (1234 no lleva separador). | **Minor.** Mismo criterio que T3. |
| **T5** | `.wc-entity-card__summary`: 3 líneas con recorte y sin `title` | La tarjeta de mundo sí lleva `title` con el texto completo; la de ficha no. No es fallo AA (el texto está en el DOM). | **Minor / diferible.** Añadir `title={entity.summary ?? undefined}` cuando se toque `entity-card.tsx`; no entra en el presupuesto. |
| **T6** | Nav modular de Mundo: «Resumen» es un `<button>` sin `onClick` con `aria-current="page"` y `cursor: pointer` | Control enfocable que no hace nada: el módulo actual no es una acción. No es un enlace muerto (no hay `href` ni destino inexistente) ni un fallo axe. | **Minor / diferible a #93.** Arreglo correcto: texto no interactivo con `aria-current` o una acción real (volver al resumen); mientras tanto, `cursor: default` en `[aria-current="page"]` para no aparentar clic. No bloquea #133. |

No se detectan textos fuera de catálogo en TSX, ni lema, ni versión en el rail,
ni campana, ni enlaces muertos en la navegación.

---

## 8. Checklist de auditoría por pantalla

Criterios verificables; cada línea debe quedar en `records.json` o en la Parte B.

### 8.1 P1 · Inicio

- [ ] `documentElement.scrollWidth ≤ clientWidth` y `body` y `main` también, a
      1024/1280/1600 × Claro/Oscuro, con rail expandido y plegado a 1024.
- [ ] `overflow-x` de `html` y `body` no es `hidden`.
- [ ] Cada `.wc-world-card` computa `box-shadow: none`, sin borde perimetral y
      radio 6 px.
- [ ] Cinco filas de mundo y cinco entradas de actividad; «Ver todos» solo con
      más de cinco.
- [ ] Cada `<time>` tiene `dateTime` ISO y `title`; el texto coincide con
      `Intl.RelativeTimeFormat` recalculado (±1 unidad).
- [ ] Las filas de actividad no tienen caja; hay divisor solo entre filas.
- [ ] Una sola acción primaria; el vacío conserva la única primaria y las tarjetas
      no declaran otra.
- [ ] Pares 1, 2, 3, 5, 6, 7 y 23 del §4.2 ≥ mínimo en ambos temas.
- [ ] Foco: recorrido del §5.2; anillo visible; objetivos ≥ 28 px.
- [ ] Carga: `aria-busy`, `role="status"`, esqueletos `aria-hidden` (componente
      test); error con reintento (componente test).
- [ ] DOM ≤ 1.500 nodos; montaje ≤ 1.000 ms; sin long task > 500 ms.

### 8.2 P2 · Mundos

- [ ] Sin scroll horizontal de página en los tres anchos y dos temas.
- [ ] `.wc-toolbar` sin borde perimetral, radio 6 px, `scrollWidth ≤ clientWidth`
      a 1024 con barra vertical.
- [ ] Rejilla sin desbordamiento; columnas esperadas con rail expandido: 2 a
      1024 y 1280, 3 a 1600 (tolerancia: el `auto-fit` manda).
- [ ] Nombre 120 y resumen 280 envuelven sin salir de la tarjeta; `min-width: 0`
      efectivo.
- [ ] Filtro sin resultados: vacío con «Quitar filtros» y contador `role="status"`
      anunciado.
- [ ] Tarjeta sin caja, radio 6 px, hover `--surface-raised`, `focus-within` sin
      salto de layout.
- [ ] Pares 2, 3, 5, 6 y 21 del §4.2.
- [ ] DOM ≤ 3.000 con 12 mundos.

### 8.3 P3 · Mundo

- [ ] Sin scroll horizontal en tres anchos × dos temas.
- [ ] La cabecera no repite el nombre; la marca mide 4,5 rem; 8 géneros
      envuelven.
- [ ] El `dl` colapsa a una columna sin cortar el slug de 80; descripción de
      4.000 a 68ch.
- [ ] Nav: Resumen `aria-current="page"`, Fichas navegable; Mapas, Manuscrito y
      Grafo no son `button`/`a`, no son enfocables y llevan insignia «Previsto».
      El control «Resumen» se registra según T6/F2 (minor, no bloqueante).
- [ ] Progreso con `role="progressbar"`, `aria-valuetext` porcentual y pista
      `--border-strong` (3:1).
- [ ] Actividad solo del mundo abierto; sin caja, con divisores.
- [ ] Actividad vacía/cargando/error: componente test; declarar en la Parte B.
- [ ] DOM ≤ 3.000.

### 8.4 P4 · Fichas

- [ ] Sin scroll horizontal en tres anchos × dos temas.
- [ ] `.wc-entity-card` sin borde perimetral, sin sombra, radio 6 px, fondo
      `--surface`; banda `--surface-sunken` con divisor de una cara.
- [ ] Columnas esperadas con rail expandido: 2 / 3 / 4 (1024 / 1280 / 1600);
      con plegado: 3 / 4 / 5.
- [ ] Nombres de 120, resúmenes de 280 y 10 etiquetas sin desbordar; el resumen
      conserva el texto completo en el DOM.
- [ ] `.wc-filters` sin borde perimetral y `scrollWidth ≤ clientWidth` a 1024
      (si falla, aplicar C9 y volver a medir).
- [ ] Vacío real: una sola primaria; filtro vacío: secundaria «Quitar filtros».
- [ ] Gestor de tipos: filas sin caja con divisores; grupos de campos sin caja
      con divisores; **borrado bloqueado visible dentro del diálogo** (F1).
- [ ] Pares 1, 2, 5, 6, 10 y 24.
- [ ] 60 fichas: DOM y montaje dentro de umbral; 200 fichas: DOM ≤ 12.000,
      montaje ≤ 2.000 ms, ningún long task > 500 ms (uno > 1 s bloquea) y sin
      congelación > 2 s. Si se supera el DOM sin congelar, issue hija con la
      métrica.

### 8.5 P5 · Ficha

- [ ] Sin scroll horizontal en tres anchos × dos temas, con panel abierto y
      cerrado y con descripción de 12.000 y 50.000.
- [ ] Lectura: sin campos de cabecera; nombre 120, 10 alias, resumen 280 y 20
      recursos envuelven sin salir.
- [ ] Edición: cinco acciones en una fila de 32 px a 1024; popup de menciones con
      clamp a 1024 y 1600; `Esc` cierra sin borrar texto.
- [ ] Panel: 320 por defecto, 280–360, sticky; a ≤1180 se apila tras el documento
      y el separador computa `display: none`; el ancho persiste al recargar.
- [ ] Secciones: `h3 > button`, `aria-expanded`/`aria-controls`, cuerpo cerrado
      con `hidden`, recuento y acciones fuera del botón.
- [ ] Guardando/guardado en `role="status"`; error en `wc-alert--inline` con
      `role="alert"` y foco al primer control inválido; el autoguardado no mueve
      el foco.
- [ ] Foco: «Editar» enfoca Nombre; «Listo» vuelve a «Editar»; separador con
      flechas ±16, Inicio/Fin y `Escape`.
- [ ] Pares 1–8, 10, 11, 13, 21–24.
- [ ] 50k: DOM ≤ 10.000, montaje ≤ 2.000 ms, sin congelación.

### 8.6 P6 · Búsqueda

- [ ] Sin scroll horizontal en tres anchos × dos temas.
- [ ] `.wc-filters` con la misma decisión que P4; a ≤1180 la regla de 12 rem ya
      existe para `--search` y se conserva.
- [ ] Inactiva: sugerencias (recientes/favoritas) o vacío; error de sugerencias
      con texto; `role="status"` en carga.
- [ ] Resultados: fila botón con borde en reposo, hover `--accent`, icono con
      fondo `--accent-surface`, título de 200 caracteres y extracto envueltos.
- [ ] Resumen con `aria-live="polite"` y contador correcto.
- [ ] Foco: filas en orden, sin controles anidados dentro de otro botón.
- [ ] Pares 1, 2, 5, 10, 11 y 21.
- [ ] DOM ≤ 6.000 con 30 resultados.

### 8.7 Overlays (1024 y 1600 × dos temas)

- [ ] **O1** paleta: `combobox` con `aria-expanded`/`aria-controls`/
      `aria-activedescendant`, `listbox` presente, sin «Muestras», lista con
      scroll interno, `Esc` cierra y devuelve foco al disparador.
- [ ] **O2** diálogos de mundo: foco inicial, error asociado y enfocado, `Esc`,
      retorno de foco, sin desbordar la ventana, sin cajas anidadas.
- [ ] **O3** diálogos de ficha: `.wc-dialog__body` con scroll interno, lista de
      etiquetas larga sin desbordar, filas del gestor de tipos planas, F1.
- [ ] **O4** menú: volteo, altura máxima, rueda interna, `Esc`, primer `Esc` solo
      cierra el tooltip.
- [ ] **O5** tooltip: ≤ 18 rem, sin recorte, `aria-describedby`, `Esc`.
- [ ] **O6** toast: `role="status"`, `aria-live="polite"`, cierre manual,
      contraste, no tapa el control enfocado. **No se usa como único canal dentro
      de un diálogo modal.**
- [ ] **O7** editor: cinco acciones en una fila, popup, foco, lectura sin barra.
- [ ] **O8** tema y rail: sin salto de layout, persistencia, instantáneo con
      movimiento reducido.
- [ ] Todos: `scrollWidth ≤ clientWidth` en el overlay y en la página de fondo.

---

## 9. Guardarraíl estático (`tests/unit/design-noise.test.ts`)

### 9.1 Lista de contenido (prohibido: borde perimetral, sombra, radio > md)

`article` y `section` dentro de `main`, más:

`.wc-page__section`, `.wc-card`, `.wc-world-card`, `.wc-world-grid__item`,
`.wc-entity-card`, `.wc-entity-grid`, `.wc-panel`, `.wc-continue__panel`,
`.wc-entity-properties`, `.wc-activity__item`, `.wc-type-list__item`,
`.wc-field-group`, `.wc-toolbar`, `.wc-filters`, `.wc-disclosure`, `.wc-empty`,
`.wc-world-header`, `.wc-world-data`, `.wc-home-activity`, `.wc-world-activity`,
`.wc-relation-item`.

Se prohíbe el **perímetro** (los cuatro lados), no el divisor de una cara. Se
permite `border-block-start`/`border-block-end` de 1 px `--border`.

### 9.2 Excepciones declaradas (con motivo en el test)

Overlays (`dialog`, menú, tooltip, toast, paleta), controles y campos
(`wc-button`, `wc-icon-button`, `wc-field__control`, `checkbox`, `radio`,
`wc-image-picker__item`, `wc-search-hit`, `wc-editor__*`), chips y marcas
(`wc-badge`, `wc-tag`, `wc-type-mark-group`, `wc-swatch__chip`), alertas y
estados (`wc-alert`, `wc-alert--inline`, `wc-page__status`,
`wc-updates__status`, `wc-form__error`, `wc-activity__error`,
`wc-inline-confirm`), marcos (`wc-gallery__item`, `wc-entity-cover`,
`wc-entity-card__media`), barras (`wc-topbar`, `wc-skip-link`) y banco
(`wc-swatch`). `is-editor-empty` va en allowlist porque lo genera Tiptap.

### 9.3 Residuos v1 que el test debe bloquear

`--paper`, `--ink`, `--font-display`, familias `palette-paper/moss/ochre/prussian`
en componentes, `data-theme` fuera de `semantic.css`, `!important` fuera del
bloque de movimiento reducido, `overflow-x: hidden` en `html`/`body` y radios
literales no justificados.

---

## 10. Riesgos de regresión visual

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Tarjetas de ficha «flotando» en Claro | Media | Medio | Precedente de #127; gap 16 px + banda hundida; revisar 1024/1280/1600 × 2 temas. |
| Actividad con líneas que la hagan parecer una tabla | Baja | Bajo | Divisor `--border` solo entre filas, tipografía secundaria; revertir una regla si molesta. |
| Barras de filtros diluidas en el lienzo | Media | Bajo | Superficie `--surface` + radio 6 + campos `--border-strong`; comprobar a 1024. |
| Filtros de Fichas desbordan 3 px a 1024 | Media | Alto (overflow) | Medición obligatoria; C9 pre-aprobada. |
| Filas de tipos y grupos de campos pierden unidad dentro del diálogo | Media | Bajo | Divisor, insignia, icono y acciones; revisar captura a 1024. |
| El diálogo de tipos se alarga al mostrar el error de borrado | Baja | Bajo | Sustituye texto en la confirmación existente; no añade caja. |
| Renombrar `.wc-field-card` rompe algo | Muy baja | Bajo | Sin referencias en tests; solo dos `className`; ejecutar componentes. |
| Perder el divisor de la banda de portada al quitar el borde | Baja | Bajo | Se conserva explícitamente en C1. |
| Las etiquetas neutras pierden el paso de tono sobre la tarjeta | Media | Bajo | Quedan como píldoras con `--border`; las tintadas conservan fondo. Aceptado en C1; no se añade override. |
| Alguien “arregla” un fondo con `--paper`/`--ink` | Baja | Alto | Guardarraíl §9.3. |
| El arnés descubre un fallo fuera de presupuesto | Media | Alto | Política §0.4: issue hija con severidad y métrica. |

---

## 11. Entrega y capturas para la revisión local

Orden de trabajo para `tdd-ddd-architect`:

1. C8 (selectores muertos) y C1–C7 en `components.css`; C6 incluye el renombrado
   en `entity-type-manager.tsx`.
2. C10 (F1) en `entity-type-manager.tsx`, con el criterio verificable de §3.10.
3. `tests/unit/design-noise.test.ts` con las listas de §9.
4. Arneses E2E y generador de informe (§1.4).
5. Medir; si `.wc-filters` desborda, aplicar C9 y volver a medir.
6. Rellenar la Parte B.

Capturas que el usuario debe mirar en la revisión local (rutas en la Parte B):

1. Fichas · Claro · 1024 (tarjetas sin caja, 2 columnas).
2. Fichas · Oscuro · 1600 (4 columnas, banda hundida).
3. Fichas · Claro · 1024 (barra de filtros, sin desbordamiento).
4. Inicio · Oscuro · 1280 (actividad con divisores y tarjetas).
5. Mundo · Claro · 1024 (cabecera, nav modular, `dl` en una columna).
6. Ficha · Oscuro · 1024 (panel apilado, secciones).
7. Ficha · Claro · 1600 (panel a 320, documento).
8. Gestor de tipos · Oscuro · 1024 (filas y grupos sin caja).
9. Gestor de tipos · Oscuro · 1024 (error de borrado **visible** dentro del
   diálogo).
10. Paleta · Claro · 1024 y tooltip/menú en el borde derecho.
11. Búsqueda · Oscuro · 1280 (resultados y resumen).

---

# Parte B — Resultado de la auditoría

<!-- audit:begin -->

> **Generado automáticamente** por `scripts/audit-report.mjs` a partir de
> `test-results/e2e/audit/records.json`. No se edita a mano; las capturas
> viven en `test-results/e2e/audit/` y no se versionan (contrato §0.4).

## B.1 Método y entorno

| Campo | Valor |
| --- | --- |
| Fecha de ejecución | 2026-11-24 |
| Commit / rama | f90f6b8 / testing/issue-133-visual-audit |
| Comando | `pnpm build && pnpm exec playwright test tests/e2e/visual-audit.spec.ts && node scripts/audit-report.mjs` |
| Build | `out/` presente y `pnpm verify:build` en verde |
| `userData` | temporal aislado (`tests/e2e/fixtures/electron-app.ts`) |
| Anchura de ventana | 1024×700, 1280×800, 1600×900 |
| Temas | `light`, `dark` (`data-theme` en `<html>`) |
| Semilla | 12 mundos (uno largo y uno archivado), 60 fichas (200 para rendimiento), 1 ficha de 50 000 caracteres y 1 tipo personalizado en uso |
| Capturas | `test-results/e2e/audit/<view>-<state>-<theme>-<width>.png` (no versionadas) |

## B.2 Celdas ejecutadas

| Bloque | Previstas | Ejecutadas | Cubiertas en componentes | Observaciones |
| --- | --- | --- | --- | --- |
| P1–P6 listo/largo | 36 | 36 | — | Las seis pantallas × 3 anchos × 2 temas. |
| Vacíos / filtros | 16 | 16 | home-page.test.tsx, worlds.test.tsx, entities.test.tsx, search.test.tsx | Vacío real de Inicio y Mundos; filtro sin resultados en Fichas y Búsqueda. |
| Overlays | 28 | 28 | primitives.test.tsx, editor-mentions.test.tsx, entity-detail.test.tsx | Los siete overlays a 1024 y 1600 px × 2 temas. |
| Muestras | 6 | 6 | samples.test.tsx | Banco interno, fuera de producto. |
| Rail plegado | 2 | 2 | shell.test.tsx | Pasada extra a 1024 px. |
| **Total** | 88 | 88 | — | 10 capturas extra de evidencia (F1, edición de tipos y actividad). |

Estados no inyectables (declarados): `loading` y `error` de P1–P6, `activity` en carga/error, error de tipos en P4, error de relaciones y de guardado en P5 y error de sugerencias en P6. Su evidencia vive en `home-page.test.tsx`, `worlds.test.tsx`, `entities.test.tsx`, `entity-detail.test.tsx`, `search.test.tsx` y `primitives.test.tsx`.

## B.3 Hallazgos

| ID | Severidad | Pantalla | Selector / archivo | Evidencia | Decisión | Issue hija |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | major | O3 · gestor de tipos | .wc-toast-region / App.tsx; entity-type-manager.tsx | El aviso de borrado bloqueado queda bajo la top layer del showModal(); no es visible. Corregido en #133 con un role="alert" dentro de la confirmación. | C10: mensaje inline dentro de .wc-inline-confirm; «Eliminar» oculto y «Cancelar» disponible. | #144 |
| F2 | minor | P3 · Mundo | .wc-world-modules__button / world-module-nav.tsx | «Resumen» es un botón enfocable sin acción y con cursor: pointer (T6). No es un enlace muerto ni un fallo axe. | No se corrige en #133. Candidato a #93 / issue hija de teclado: texto no interactivo con aria-current o cursor: default. | #93 |

T1 y T3–T6 se mantienen como observaciones menores del contrato §7.4 y no bloquean #133. T2 no se toca.

## B.4 Contraste medido

| # | Pareja | Claro (medido) | Oscuro (medido) | Mín. | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 | --fg / --bg | 13,82:1 | 16,43:1 | 4,50 | Cumple |
| 2 | --fg / --surface | 14,55:1 | 15,17:1 | 4,50 | Cumple |
| 3 | --fg / --surface-raised | 15,19:1 | 13,82:1 | 4,50 | Cumple |
| 4 | --fg / --surface-sunken | 12,87:1 | 17,15:1 | 4,50 | Cumple |
| 5 | --muted / --bg | 5,07:1 | 7,74:1 | 4,50 | Cumple |
| 6 | --muted / --surface | 5,34:1 | 7,15:1 | 4,50 | Cumple |
| 7 | --muted / --surface-raised | 5,58:1 | 6,51:1 | 4,50 | Cumple |
| 8 | --muted / --surface-sunken | 4,72:1 | 8,08:1 | 4,50 | Cumple |
| 9 | --accent / --bg | 7,08:1 | 8,01:1 | 4,50 | Cumple |
| 10 | --accent / --accent-surface | 6,54:1 | 5,44:1 | 4,50 | Cumple |
| 11 | --accent-strong / --bg | 9,05:1 | 9,92:1 | 4,50 | Cumple |
| 12 | --accent-contrast / --accent | 7,78:1 | 8,36:1 | 4,50 | Cumple |
| 13 | --fg / --danger-surface | 12,20:1 | 13,01:1 | 4,50 | Cumple |
| 14 | --danger / --danger-surface | 5,36:1 | 7,07:1 | 3,00 | Cumple |
| 15 | --danger-contrast / --danger | 6,68:1 | 9,32:1 | 4,50 | Cumple |
| 16 | --success / --success-surface | 5,35:1 | 7,74:1 | 4,50 | Cumple |
| 17 | --warning / --warning-surface | 4,96:1 | 6,99:1 | 4,50 | Cumple |
| 18 | --warning / --surface-raised | 5,90:1 | 8,24:1 | 3,00 | Cumple |
| 19 | --disabled-text / --disabled-surface | 4,72:1 | 7,74:1 | 4,50 | Cumple |
| 20 | --disabled-border / --disabled-surface | 3,26:1 | 4,70:1 | 3,00 | Cumple |
| 21a | --border-strong / --bg | 3,50:1 | 4,70:1 | 3,00 | Cumple |
| 21b | --border-strong / --surface | 3,68:1 | 4,34:1 | 3,00 | Cumple |
| 22 | --fg / --selection | 11,44:1 | 11,22:1 | 4,50 | Cumple |
| 22-accent-surface | --focus / --accent-surface | 6,54:1 | 6,74:1 | 3,00 | Cumple |
| 22-bg | --focus / --bg | 7,08:1 | 9,92:1 | 3,00 | Cumple |
| 22-surface | --focus / --surface | 7,46:1 | 9,16:1 | 3,00 | Cumple |
| 22-surface-raised | --focus / --surface-raised | 7,78:1 | 8,34:1 | 3,00 | Cumple |
| 22-surface-sunken | --focus / --surface-sunken | 6,59:1 | 10,35:1 | 3,00 | Cumple |
| 24-danger | --entity-danger / --entity-danger-surface | 5,36:1 | 7,07:1 | 3,00 | Cumple |
| 24-moss | --entity-moss / --entity-moss-surface | 6,54:1 | 5,44:1 | 3,00 | Cumple |
| 24-ochre | --entity-ochre / --entity-ochre-surface | 3,64:1 | 6,69:1 | 3,00 | Cumple |
| 24-prussian | --entity-prussian / --entity-prussian-surface | 5,15:1 | 10,12:1 | 3,00 | Cumple |

Los ratios se calculan en la ventana real con los colores computados y WCAG 2.2 (sRGB). Coinciden con `tests/unit/design-tokens.test.ts`.

## B.5 Foco, teclado y movimiento

| Tema | Recorrido y orden DOM | Fallos de foco | axe (critical/serious/moderate) | Control mínimo | Primario mínimo |
| --- | --- | --- | --- | --- | --- |
| Claro | 129/129 paradas; orden 0..n-1 | Ninguno | 0 / 0 / 0 | 28 px | 36,9 px |
| Oscuro | 129/129 paradas; orden 0..n-1 | Ninguno | 0 / 0 / 0 | 28 px | 36,9 px |

El retorno de foco al disparador tras cerrar menús y diálogos está cubierto por `design-v2.spec.ts`, `primitives.test.tsx` y `entities.spec.ts`; aquí se mide el recorrido completo, el orden DOM, el anillo y los objetivos en las seis pantallas. Los botones de texto en línea (título de la tarjeta de ficha) quedan fuera del mínimo de 28 px por la excepción de objetivo en línea de WCAG 2.5.8; el resto de controles se mide y los primarios deben llegar a 32 px.

Movimiento reducido: transiciones ≤ 0,02 ms en 3 selectores, rail plegado a 64 px en 0.01 ms y 0 bucles infinitos.

## B.6 Textos y navegación

| Comprobación | Resultado |
| --- | --- |
| Sin «Muestras» en rail/topbar/paleta de producto | Paleta de comandos sin «Muestras». |
| Sin lema, versión ni campana en el rail | Rail solo Inicio y Mundos; sin lema, versión ni campana. |
| Módulos «Previsto» no enfocables ni enlazados | Mapas, Manuscrito y Grafo no son botones ni enlaces y no son enfocables. |
| Fechas relativas recalculadas en Inicio y Mundos | Inicio: tarjetas relativas recalculadas con Intl.RelativeTimeFormat (±2 minutos) y actividad con Intl.DateTimeFormat; Mundos: tarjetas relativas recalculadas. Todas las <time> llevan dateTime ISO y las tarjetas, title. |
| Catálogo y no-hardcoded en verde | Textos desde el catálogo; tests de i18n y no-hardcoded en verde. |
| Observaciones T1-T6 | T1 y T3–T6 menores y diferidas; T2 no se toca (§7.4). |
| Enlaces internos y de salto controlados | En producto solo el enlace de salto y los enlaces internos del editor. |

## B.7 Rendimiento

| Vista | Nodos DOM | Montaje (ms) | Long task máx. (ms) | Congelación (s) | Umbral | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| Inicio | 293 | 140 | 0 | 0,00 | 1.500 nodos / 1.000 ms / 500 ms / 2 s | Dentro de umbral |
| Mundos (12) | 424 | 146 | 58 | 0,06 | 3.000 nodos / 1.000 ms / 500 ms / 2 s | Dentro de umbral |
| Mundo | 249 | 199 | 0 | 0,00 | 3.000 nodos / 1.000 ms / 500 ms / 2 s | Dentro de umbral |
| Fichas (200) | 4567 | 671 | 90 | 0,09 | 12.000 nodos / 2.000 ms / 500 ms (bloqueo > 1.000) / 2 s | Dentro de umbral |
| Ficha (50k) | 394 | 929 | 90 | 0,09 | 10.000 nodos / 2.000 ms / 500 ms (bloqueo > 1.000) / 2 s | Dentro de umbral |
| Búsqueda (30) | 1223 | 527 | 0 | 0,00 | 6.000 nodos / 1.000 ms / 500 ms / 2 s | Dentro de umbral |

Solo un bloqueo > 2 s o un long task > 1 s bloquea #133. Una métrica por encima del umbral sin congelación se registra como candidata a issue hija.

## B.8 Cajas: antes y después

| Selector | Antes | Después | Captura |
| --- | --- | --- | --- |
| .wc-entity-card | borde + `--shadow-1` + radio 8 + `--surface-raised` | sin caja, radio 6, `--surface` | `test-results/e2e/audit/entities-ready-*-1024.png` |
| .wc-entity-card__media | `--surface` | `--surface-sunken` + divisor de una cara | Igual que la tarjeta |
| .wc-activity__item | caja por fila anulada por los dos consumidores | filas con divisor | `test-results/e2e/audit/home-activity-*-1280.png` |
| .wc-toolbar | borde + radio 8 | sin borde, radio 6, `--surface` | `test-results/e2e/audit/worlds-ready-*-1024.png` |
| .wc-filters | borde + radio 8 | sin borde, radio 6, `--surface`; C9 condicionada a medición | `test-results/e2e/audit/entities-ready-*-1024.png` |
| .wc-type-list__item | caja por fila | filas con divisor | `test-results/e2e/audit/type-manager-open-*-1024.png` |
| .wc-field-group | caja + `--surface` | grupos con divisor | `test-results/e2e/audit/type-manager-edit-form-*-1024.png` |
| .wc-alert | radio 8 | radio 6 | — (sin cambio de contraste) |

C9: `.wc-filters` mide 736 px de ancho interior a 1024 px y no desborda en ninguna celda (medición registrada en `records.json`). La regla `auto-fit minmax(12rem, 1fr)` ya existía a ≤1180 px y no se añadió otra.

## B.9 Issues hijas abiertas

| Issue | Título | Motivo | Métrica / evidencia |
| --- | --- | --- | --- |
| #144 | Avisos en top layer para diálogos modales | F1: El aviso de borrado bloqueado queda bajo la top layer del showModal(); no es visible. Corregido en #133 con un role="alert" dentro de la confirmación. | C10: mensaje inline dentro de .wc-inline-confirm; «Eliminar» oculto y «Cancelar» disponible. |
| #93 | Módulo actual no interactivo en la nav del mundo | F2: «Resumen» es un botón enfocable sin acción y con cursor: pointer (T6). No es un enlace muerto ni un fallo axe. | No se corrige en #133. Candidato a #93 / issue hija de teclado: texto no interactivo con aria-current o cursor: default. |

## B.10 Cierre

- [x] Las 88 celdas ejecutadas o justificadas (100 %).
- [x] Hallazgos corregidos o con issue hija.
- [x] Contraste sin pares por debajo del mínimo.
- [x] Foco, teclado y movimiento reducido verificados.
- [x] Movimiento reducido medido y registrado.
- [x] Textos y navegación verificados.
- [x] Rendimiento medido y registrado.
- [x] `tests/unit/design-noise.test.ts` en verde sin allowlist injustificada.
- [x] `sistema-de-diseno.md` §17 actualizado a «Implementado» y M1.5 cerrado.
- [x] Manual de usuario actualizado con la nota de estado de M1.5 y el aviso de borrado de tipos.
- [x] Plan de pruebas y changelog actualizados.

<!-- audit:end -->

