# Contrato de diseño — #129 «Ficha como documento vivo y panel de propiedades»

> **Estado:** contrato visual y de accesibilidad aprobado por `ui-ux-designer`
> el 22/11/2026. **Vinculante para `tdd-ddd-architect`.** No implementa código.
> Donde este documento contradiga el plan de `tasks/task-issue-129.json`,
> prevalece este contrato y el plan queda corregido por la lista C1–C25 de la
> sección 13. Donde contradiga el sistema de diseño v2, prevalece el sistema.
>
> **Base normativa:** [`sistema-de-diseno.md`](sistema-de-diseno.md) v2 (ADR
> 0025, D-048) y los tokens reales de `src/renderer/styles/tokens/*.css`.
> Cualquier referencia a `--paper`, `--ink`, Fraunces, Inter o Tailwind está
> retirada. La ficha se migra a la composición v2 en esta issue.

## 0. Alcance y principios de la pantalla

La ficha pasa de formulario permanente a **documento legible con edición en
contexto**. Lectura por defecto; una sola acción primaria en edición («Listo»);
«Editar» es secundaria en lectura; el panel de propiedades es un inspector
secundario, no un formulario paralelo.

Reglas que gobiernan todas las decisiones siguientes:

1. **Documento antes que formulario.** En reposo no hay campos de nombre, alias,
   resumen, descripción ni atributos. Solo el panel conserva controles
   (portada, estado y etiquetas).
2. **Una sola primaria.** «Listo» en edición. En lectura no hay primaria.
3. **Jerarquía por espacio, tamaño y peso.** Sin bordes de tarjeta, sin sombra,
   sin contenedor que encierre el documento.
4. **Dos superficies como máximo en la vista.** Documento sobre `--bg`; panel
   sobre `--surface`; nada más. Las secciones no son tarjetas.
5. **El error nunca se esconde.** Una sección cerrada con error se abre; un
   fallo se anuncia; el autoguardado no roba el foco.
6. **Solo tokens existentes.** No se añade ningún rol de color ni dependencia.
7. **Escritorio.** Ratón y teclado, ventana mínima 1024×700. Sin patrones
   táctiles ni puntos de ruptura móviles.

---

## 1. Composición exacta y orden DOM

### 1.1 Árbol semántico

El orden es fijo y no se altera con CSS `order` en ningún ancho (el orden visual
y el de tabulación deben coincidir).

```text
div.wc-page.wc-page--entity[data-mode="read|edit"]
├─ div.wc-page__header.wc-entity-pagebar
│  ├─ button.wc-button.wc-button--ghost          «Volver a las fichas»
│  └─ button.wc-icon-button.wc-entity-pagebar__toggle
│        aria-expanded · aria-controls="wc-entity-properties"
│        label «Ocultar propiedades» / «Mostrar propiedades»
│
├─ div.wc-entity-doc[data-properties="open|closed"]
│  │     style="--wc-properties-width: 320px"
│  ├─ div.wc-entity-doc__main
│  │  ├─ header.wc-document-header                 (header interno, no banner)
│  │  │  ├─ div.wc-document-header__top
│  │  │  │  ├─ div.wc-document-header__badges
│  │  │  │  │  ├─ span.wc-badge.wc-badge--neutral  tipo + icono
│  │  │  │  │  └─ span.wc-badge.wc-badge--success|warning|neutral  estado
│  │  │  │  └─ div.wc-document-header__actions
│  │  │  │     ├─ p.wc-save-state[role="status"]
│  │  │  │     ├─ button.wc-button--secondary      «Favorita» (aria-pressed)
│  │  │  │     ├─ button.wc-button--secondary      «Editar» | «Guardar ahora»
│  │  │  │     ├─ button.wc-button--primary        «Listo» (solo edición)
│  │  │  │     └─ div.wc-menu                      «⋯»
│  │  │  ├─ h2.wc-document-header__title
│  │  │  ├─ p.wc-document-header__aliases          solo lectura
│  │  │  ├─ p.wc-document-header__summary          solo lectura
│  │  │  ├─ div.wc-document-header__fields         solo edición
│  │  │  │  ├─ TextField  Nombre
│  │  │  │  ├─ TextField  Alias
│  │  │  │  └─ TextAreaField  Resumen
│  │  │  └─ p.wc-document-header__meta
│  │  │     ├─ <time dateTime="…">fecha actualizada</time>
│  │  │     └─ code.wc-document-header__slug
│  │  ├─ div.wc-alert.wc-alert--inline[role="alert"]   (condicional)
│  │  ├─ section.wc-disclosure#wc-entity-section-description
│  │  ├─ section.wc-disclosure#wc-entity-section-attributes
│  │  ├─ section.wc-disclosure#wc-entity-section-relations
│  │  └─ section.wc-disclosure#wc-entity-section-resources
│  ├─ div.wc-properties-resizer[role="separator"]
│  └─ aside.wc-entity-properties#wc-entity-properties
│        aria-labelledby="wc-entity-properties-title"
│     ├─ h2.wc-entity-properties__title
│     └─ div.wc-entity-properties__grid
│        ├─ section.wc-entity-properties__block--cover
│        │  ├─ h3  «Portada»
│        │  ├─ div.wc-entity-cover (img | vacío)
│        │  └─ button  «Elegir/Cambiar portada» | «Ir a Recursos»
│        ├─ section.wc-entity-properties__block--status
│        │  └─ SelectField  «Estado» (su etiqueta hace de rótulo del bloque)
│        └─ section.wc-entity-properties__block--tags
│           ├─ h3  «Etiquetas»
│           ├─ ul.wc-tag-list[aria-label]
│           ├─ SelectField  «Añadir etiqueta»
│           └─ button  «Nueva etiqueta»
│
└─ (diálogos existentes: portada, etiqueta, relación, tipos, borrado)
```

**Piezas semánticas:**

| Pieza | Elemento | Por qué |
|---|---|---|
| Página | `div` con `.wc-page` | Contenedor presentacional; el `main` es del shell (`#wc-main`). |
| Barra de página | `div` | No es un landmark; contiene volver y el toggle. |
| Cabecera del documento | `header` | `header` interno a `main`: no genera banner, pero agrupa identidad. |
| Título | `h2` | El `h1` único es el nombre del mundo en la barra superior (sistema §10.1). |
| Secciones | `section[aria-labelledby]` | Región nombrada por su `h3`. |
| Título de sección | `h3 > button` | El botón de plegado es el título; el `h3` conserva el esquema. |
| Panel | `aside[aria-labelledby]` | Landmark `complementary` con nombre «Propiedades». |
| Ficha técnica | `dl > dt + dd` | Datos, no tabla. Sin `div` intermedios. |
| Lista de etiquetas | `ul > li` | Lista real, con nombre accesible. |
| Separador | `div[role="separator"]` | Widget de redimensionado con valor ARIA. |
| Galería | `ul.wc-gallery > li` | Lista de imágenes. |

**No se usa:** `nav`, `table` para atributos, `role="button"` en el `h2`,
`tabIndex` en elementos no interactivos, `aria-label` en `div` genéricos.

### 1.2 Orden de tabulación

1. Enlace «Saltar al contenido» del shell → rail → barra superior (búsqueda,
   primaria, `⋯`, actualizaciones, tema) → `#wc-main`.
2. «Volver a las fichas».
3. Toggle de propiedades.
4. Cabecera: «Favorita» → «Editar» (o «Guardar ahora» → «Listo») → `⋯`.
5. Por sección, en este orden: botón de plegado → acciones de la sección →
   controles y enlaces del cuerpo (solo si está abierta).
6. Separador de propiedades (solo si el panel está abierto y el ancho es
   > 1180 px).
7. Panel: estado → quitar etiqueta (una por chip) → añadir etiqueta → nueva
   etiqueta → acción de portada.

El botón «Editar» no se convierte en el `h2`; el clic en el título es un atajo
de ratón, no un control adicional.

---

## 2. Cabecera de documento

### 2.1 Jerarquía

| Nivel | Contenido | Tipografía | Tokens |
|---|---|---|---|
| 1 | Tipo + estado | 12 px, 500 | `Badge`; tipo neutro; estado `success`/`warning`/`neutral`. |
| 2 | Título | 32 px, 600, 1,2 | `--font-content`, `--text-display`, `--fg`. |
| 3 | Alias | 13 px, 400 | `--font-ui`, `--text-sm`, `--muted`. |
| 4 | Resumen | 16 px, 400, 1,5 | `--font-ui`, `--text-md`, `--fg`, máx. 68ch. |
| 5 | Campos en edición | 14 px | `wc-form-grid` de una columna, máx. 40rem. |
| 6 | Metadatos | 13 px + 12 px mono | `--muted`; fecha con `<time>`; slug en `code`. |

- Sin redondel de tipo de 48 px: el icono viaja en la insignia de tipo. Un
  segundo icono grande repetiría información y devolvería el aspecto de tarjeta
  que la v2 retira (corrección C1).
- La fecha usa `formats.formatDate(entity.updatedAt)` dentro de `<time
  dateTime={entity.updatedAt}>`; el slug va en `<code>` con
  `--font-mono` y `overflow-wrap: anywhere`.
- El bloque de identidad es una columna flex con `min-width: 0`; título, alias,
  resumen y metadatos llevan `overflow-wrap: anywhere`.

### 2.2 Lectura y edición

| Pieza | Lectura (`read`) | Edición (`edit`) |
|---|---|---|
| Insignias tipo/estado | Sí, estado desde el borrador | Sí, estado en vivo |
| Título `h2` | Nombre actual; si falta, «Ficha sin nombre» en `--muted` | Igual, actualizado al escribir |
| Alias | Frase «Alias: …» | Campo «Alias» + ayuda |
| Resumen | Párrafo; si está vacío se omite | Área de texto con marcador |
| Nombre / Alias / Resumen | No existen en el DOM | Campos visibles, una columna |
| Favorita | Botón con `aria-pressed` | Igual |
| Guardado | `role="status"` visible | Igual |
| Acción principal | Ninguna | «Listo» (primaria) |
| Acción secundaria | «Editar» | «Guardar ahora» |
| Menú `⋯` | Mover a la papelera | Igual |

- **Sin resumen vacío:** en lectura no se pinta el párrafo ni un hueco. El
  camino es «Editar». No se llena el documento de textos de reserva.
- **Un solo modo de página:** cualquier entrada (título, «Editar», «Editar
  descripción», «Editar campos») muestra todos los controles del documento; el
  foco va al destino elegido. No hay edición por campo ni borradores paralelos.
- **Sin duplicar texto en edición:** los párrafos de alias y resumen se
  sustituyen por sus campos; el `h2` permanece como ancla y se actualiza en vivo.
- **El título vacío** se pinta como «Ficha sin nombre» con `--muted`; al salir de
  edición no se permite guardar sin nombre (validación existente).

### 2.3 Acciones y guardado

Orden visual de la fila de acciones: **estado de guardado → Favorita → Editar |
(Guardar ahora + Listo) → ⋯**.

- **Favorita:** `Button variant="secondary" size="sm"`, texto fijo «Favorita»,
  estrella rellena/vacía `aria-hidden`, `aria-pressed={entity.isFavorite}`. El
  nombre accesible **no cambia** con el estado (corrección C6). El toast existente
  anuncia el resultado.
- **Editar:** `variant="secondary"`, `size="sm"`, texto «Editar». En lectura es
  la única entrada de teclado a la edición.
- **Guardar ahora:** `variant="secondary"`, `size="sm"`,
  `aria-keyshortcuts="Control+S"`, solo en edición.
- **Listo:** `variant="primary"`, `size="md"`, única primaria, solo en edición.
  Guarda y vuelve a lectura; si falla, permanece en edición.
- **No hay «Cancelar»:** el autoguardado ya ha persistido; cancelar sugeriría
  descartar cambios que no se pierden. Se documenta en el manual.
- **`⋯`:** menú existente con «Mover a la papelera»; misma posición y mismo
  retorno de foco que hoy.
- **Estado de guardado:** `<p class="wc-save-state wc-save-state--…"
  role="status" aria-live="polite" aria-atomic="true">` **siempre montado**.
  Textos cortos (C5): «Guardando…», «Guardado», «Cambios sin guardar», «No se
  pudo guardar». El texto largo de `saveError` vive en la alerta, no en la fila.
  `min-inline-size: 9rem; max-inline-size: 12rem; text-align: end` para evitar
  saltos de layout.
- **Clic en el título:** solo en lectura; `cursor: text`; entra en edición y
  enfoca Nombre. Se ignora si `window.getSelection()?.isCollapsed === false`
  (el usuario está seleccionando texto para copiar). No se añade `role`,
  `tabIndex` ni `aria-label`: el camino accesible es «Editar».

### 2.4 Medida de lectura y saltos

- Título: todo el ancho de la columna del documento; `overflow-wrap: anywhere`.
- Alias, resumen y metadatos: `max-inline-size: 68ch`.
- Descripción en lectura: `max-inline-size: 68ch`, 18 px, 1,7.
- Campos en edición: `max-inline-size: 40rem`; una sola columna.
- Todos los hijos de flex/grid: `min-width: 0`.
- El documento nunca centra el texto: la columna de lectura queda alineada al
  inicio de su track; el espacio libre a la derecha es deliberado.

---

## 3. Secciones plegables

### 3.1 Estructura

```html
<section class="wc-disclosure" id="wc-entity-section-description"
         data-section="description" data-open="true"
         aria-labelledby="wc-entity-section-description-heading">
  <div class="wc-disclosure__header">
    <h3 class="wc-disclosure__heading" id="…-heading">
      <button type="button" class="wc-disclosure__toggle"
              aria-expanded="true" aria-controls="…-body">
        <span class="wc-disclosure__chevron" aria-hidden="true">…</span>
        <span class="wc-disclosure__title">Descripción</span>
        <span class="wc-disclosure__meta">124 palabras</span>
      </button>
    </h3>
    <div class="wc-disclosure__actions">
      <!-- acciones reales, FUERA del botón de plegado -->
    </div>
  </div>
  <div class="wc-disclosure__body" id="…-body" data-open="true">
    …
  </div>
</section>
```

- El cuerpo **permanece montado** al cerrar (Tiptap incluido) y se oculta con el
  atributo `hidden` + `[hidden] { display: none }`. No se desmonta (C8).
- Las acciones nunca se anidan dentro del botón: evita botones dentro de botones
  y conserva dos paradas de tabulación claras.
- `data-section` es estable para CSS y pruebas; los `id` también.

### 3.2 Cabecera, chevron y objetivo

| Propiedad | Valor |
|---|---|
| Alto de fila | `min-block-size: 3rem` (48 px); padding-block 8 px. |
| Chevron | 16 px, contenedor de 28×28 px con `--surface-sunken` y radio `--radius-sm`. |
| Título | 22 px, 600, `--font-content`, `--fg`. |
| Meta | 13 px, `--muted`, oculta si no hay dato. |
| Acciones | `Button size="sm"` (28 px mínimo); alineadas a la derecha con `margin-inline-start: auto`. |
| Separación | `border-block-start: 1px solid var(--border)` en cada sección. |
| Cuerpo | `padding-block: var(--space-2) var(--space-6)`; sin borde ni fondo. |

- El botón de plegado ocupa todo el ancho disponible de la izquierda (título +
  meta + chevron), con `flex: 1 1 auto; min-width: 0; text-align: start`.
- **Objetivo:** el botón mide al menos 44 px de alto (fila de 48 y padding), muy
  por encima del mínimo de 28. Las acciones, 28.
- El chevron es decorativo (`aria-hidden`); el estado lo comunica
  `aria-expanded`, no el icono.

### 3.3 Estados abierto / cerrado

| Estado | Chevron | Título | Meta | Fondo de la fila |
|---|---|---|---|---|
| Reposo abierto | Abajo (`rotate(0)`) | `--fg` | `--muted` | `--bg` |
| Reposo cerrado | Derecha (`rotate(-90deg)`) | `--fg` | `--muted` | `--bg` |
| Hover (ambos) | `--accent` sobre `--accent-surface` | `--accent` | `--muted` | `--bg` |
| Activo | Igual que hover | `--accent-strong` | `--muted` | `--bg` |
| Foco | Anillo global 2+2 px en el botón | — | — | — |

- **El estado cerrado no parece un enlace muerto:** la fila conserva el mismo
  alto y el mismo tratamiento que abierta, el chevron va dentro de una caja de
  28 px, la meta (recuento) sigue visible y las acciones de la derecha siguen
  presentes. No se usa subrayado, no se cambia a `--muted` el título y no se
  reduce el objetivo.
- **Meta por sección** (visible abierta y cerrada, omitida si no hay dato):
  - Descripción: «1 palabra» / «N palabras» (`descriptionMeta`).
  - Campos: «1 campo» / «N campos»; se omite si el tipo no tiene campos.
  - Relaciones: «1 relación» / «N relaciones».
  - Recursos: «1 imagen» / «N imágenes».
- **Sin animación de altura.** Solo el chevron transiciona `transform` 120 ms
  (`--motion-fast`, `--ease-standard`). Con `prefers-reduced-motion: reduce` el
  cambio es instantáneo (la regla global de `base.css` ya lo cubre). No hay
  desplazamientos automáticos.
- **Estado inicial:** solo «Descripción» abierta; Campos, Relaciones y Recursos
  cerradas. La memoria de sesión (módulo puro, sin `localStorage` ni IPC) conserva
  lo que el usuario cambie y se pierde al recargar; es la sutura de #132.
- **Estado con error:** la sección afectada se abre al producirse el error
  (validación o guardado) y permanece abierta; el foco solo se mueve si la
  acción fue explícita (ver §6).
- **Recuentos:** `descriptionMeta` cuenta las palabras de
  `extractEntityDescriptionText(draft.description)` (módulo compartido ya
  existente), separando por espacios; `fieldsMeta` usa `type.fields.length`,
  `relationsMeta` usa `relations.length` y `resourcesMeta` usa `gallery.length`.

### 3.4 Acciones por sección

| Sección | Lectura | Edición |
|---|---|---|
| Descripción | «Añadir descripción» si vacía; «Editar descripción» si tiene texto. Ghost, `sm`. | Ninguna: el editor ya está activo. |
| Campos del tipo | «Editar campos» si hay campos. Ghost, `sm`. | Ninguna. |
| Relaciones | «Añadir relación» (secundaria, `sm`) + «Tipos de relación» (ghost, `sm`). | Igual. |
| Recursos | «Añadir imágenes» (secundaria, `sm`, `loading`). | Igual. |

Toda acción que produce contenido abre la sección antes de ejecutarse (añadir
relación, añadir imágenes) para que el resultado sea visible.

---

## 4. Panel de propiedades

### 4.1 Composición y medidas

| Propiedad | Valor |
|---|---|
| Ancho | 280–360 px; por defecto **320 px**; abierto por defecto; variable local `--wc-properties-width`. |
| Padding | `var(--space-4)` (16 px) en todos los anchos. |
| Fondo | `--surface`; radio `--radius-md` (6 px). **Sin borde ni sombra** (C1). |
| Separación interna | `var(--space-6)` (24 px) entre bloques. |
| Posición | `position: sticky`; `inset-block-start: calc(var(--topbar-height) + var(--space-4))` (C4). |
| Altura máxima | `calc(100vh - var(--topbar-height) - var(--space-4) * 2)` con `overflow-y: auto` (C4). |
| Orden | Portada → Estado → Etiquetas. **Solo eso.** |
| Título | `h2` «Propiedades», 16 px, 600, `--font-ui`, `--fg`. |

- **Sin** galería, nombre, resumen, campos, relaciones ni descripción. Esos
  datos viven en el documento (C14).
- En ancho, el panel es una columna; el documento manda.
- La memoria del panel (abierto/cerrado y ancho) es de sesión: módulo puro, sin
  `localStorage`; se pierde al recargar y #132 la persistirá.
- El control de estado es un `<select>` nativo con etiqueta visible «Estado».
  **No** se añade un `h3` «Estado»: duplicaría la etiqueta (C21). La etiqueta del
  campo se estiliza a 13 px/600 para actuar como rótulo del bloque.
- Las etiquetas: `h3` «Etiquetas», lista de chips y controles de añadir.

### 4.2 Portada

- **Marco:** ancho completo del panel, alto fijo **184 px** (`11.5rem`),
  `border-radius: var(--radius-sm)`, `border: 1px solid var(--border)`,
  `overflow: hidden`. Imagen con `object-fit: cover`, `alt` del asset o `alt=""`.
- **Vacío:** fondo `--surface-sunken`, icono de imagen 20 px `--muted` y texto
  «Sin portada todavía.» (13 px, `--muted`, máximo 24ch). Sin borde discontinuo.
- **Acción única:**
  - Con assets y sin portada: «Elegir portada» (`secondary`, `sm`).
  - Con portada: «Cambiar portada» (`secondary`, `sm`).
  - Sin ningún asset en el mundo: texto de ayuda «Añade imágenes en Recursos y
    elige una como portada.» + botón ghost «Ir a Recursos» que abre la sección
    Recursos y enfoca «Añadir imágenes» (C25). Nunca un botón deshabilitado sin
    explicación.
- El diálogo de selección lista los assets del mundo con `aria-pressed` en el
  actual; título «Elegir portada»; cerrar con «Cerrar».
- **La portada solo se elige desde el panel.** La galería no repite «Usar como
  principal» (C13).

### 4.3 Estado

- `SelectField` «Estado» con Activa, Borrador, Archivada; siempre habilitado
  (también en lectura), porque es una propiedad, no texto validable.
- El cambio actualiza el borrador, marca «Cambios sin guardar» y autoguarda.
- La insignia de la cabecera se actualiza en vivo con el valor del borrador.
- El color de la insignia no es el único indicador: siempre lleva texto.

### 4.4 Etiquetas

- Chips: `<span class="wc-tag wc-tag--color wc-tag--dismissible">` con el nombre
  en `--fg` y un botón de quitar integrado de 28×28 px (`aria-label` «Quitar la
  etiqueta X de la ficha»). `.wc-tag--dismissible` usa `padding-block: 0`,
  `padding-inline: var(--space-3) var(--space-1)` y `min-block-size: 1.75rem`;
  el texto lleva `min-width: 0` y `overflow-wrap: anywhere`. El alto mínimo es
  28 px; un nombre largo puede hacer crecer el chip en varias líneas.
- Lista con `aria-label="Etiquetas de la ficha"`; si no hay etiquetas asignadas
  no se pinta una lista vacía.
- Añadir: `SelectField` «Añadir etiqueta» con opción inicial «Elige una
  etiqueta». Si no quedan disponibles, el campo se deshabilita con la ayuda «No
  quedan etiquetas por asignar.». Si el mundo no tiene ninguna, ayuda «Todavía no
  hay etiquetas en este mundo. Crea la primera.».
- Límite 12: ayuda `tagsLimit(12)` y «Nueva etiqueta» deshabilitado.
- «Nueva etiqueta» ghost `sm` abre el diálogo existente.

### 4.5 Comportamiento a ≤ 1180 px

- El panel se apila **después** del documento en el DOM y en pantalla. No se
  usa `order` para adelantarlo: el orden de tabulación debe coincidir.
- `grid-template-columns: minmax(0, 1fr)`, `row-gap: var(--space-6)`.
- Separador `display: none` (fuera del orden de tabulación y del árbol de
  accesibilidad).
- Panel: `position: static`, `inline-size: auto`, `max-block-size: none`,
  `overflow: visible`, mismo fondo/radio/padding.
- **Interior en dos columnas** cuando el panel apilado tiene al menos ~700 px
  útiles (siempre a 1024 con rail expandido):
  `grid-template-columns: minmax(14rem, 20rem) minmax(0, 1fr)`, áreas
  `"cover status" "cover tags"`, título a ancho completo. La portada deja de ser
  una banda de 736×184 y se limita a 320 px de ancho (C22).
- El toggle sigue visible y sigue ocultando/mostrando el bloque completo.

### 4.6 Toggle

- `IconButton` en `.wc-entity-pagebar`, alineado a la derecha.
- Icono de panel lateral de 20 px, `currentColor`, `aria-hidden`.
- `aria-expanded={propertiesOpen}`; `aria-controls="wc-entity-properties"`;
  `aria-label` y tooltip = «Ocultar propiedades» / «Mostrar propiedades».
- Abierto: `variant="secondary"` (se distingue del ghost cerrado); el estado
  real lo da `aria-expanded`, no el color.
- Visible en todos los anchos, incluido 1024 (donde el panel está apilado).
- Al ocultar: `display: none` en `aside` y separador; el grid pasa a una columna;
  el foco permanece en el toggle. La memoria de sesión conserva el estado.

### 4.7 Separador accesible

- Marcado: `div.wc-properties-resizer[role="separator"]` con:
  `aria-orientation="vertical"`, `tabIndex={0}`,
  `aria-controls="wc-entity-properties"`,
  `aria-label="Ajustar el ancho del panel de propiedades"`,
  `aria-valuemin={280}`, `aria-valuemax={360}`, `aria-valuenow={width}`,
  `aria-valuetext="320 píxeles"` (`propertiesWidth(formats.formatNumber(width))`).
- Zona de agarre: 10 px de ancho (`0.625rem`); ocupa todo el alto de la fila
  del grid (`align-self: stretch`) y la pill se centra verticalmente.
- Línea: 1 px `--border` a toda la altura (decorativa). **Agarre visible:** pill
  de 4×24 px centrada, `--border-strong` (3,50:1 en Claro, 4,70:1 en Oscuro).
  Hover: línea `--border-strong`, pill `--accent`. (C2: un separador interactivo
  no puede ser solo `--border`, 1,23:1.)
- Cursor `col-resize` en toda la zona; durante el arrastre `user-select: none`,
  captura de puntero y `Escape` cancela y restaura el ancho inicial.
- Teclado: `←`/`→` ±16 px; `Inicio` → 280; `Fin` → 360; el valor se escribe en
  la memoria al soltar la tecla. `preventDefault` para no desplazar la página.
- Ratón: el ancho se actualiza en vivo durante el arrastre; se persiste en
  memoria al soltar. Doble clic restablece 320 px.
- Foco visible: anillo de 2 px `--focus` con 2 px de separación **alrededor del
  pill** (el separador anula su outline y lo sustituye por este anillo; la
  alternativa es visible y equivalente, nunca ausencia de foco).
- Oculto a ≤ 1180 px.

---

## 5. Recursos: galería y portada sin duplicar

| Acción | Dónde vive | Por qué |
|---|---|---|
| Elegir / cambiar portada | **Panel**, botón único | El panel es el inspector de propiedades. |
| Abrir Recursos si no hay imágenes | **Panel**, ghost «Ir a Recursos» | Evita un botón deshabilitado sin salida. |
| Importar imágenes | **Recursos**, cabecera «Añadir imágenes» | La importación pertenece a la galería. |
| Quitar una imagen de la galería | **Recursos**, cada miniatura | Acción destructiva local, con nombre accesible. |
| Marcar la portada | **No se repite** | La portada se elige en el panel; la miniatura que es portada muestra la insignia «Portada». |

- La galería se dibuja con `ul.wc-gallery` (rejilla `repeat(auto-fill,
  minmax(7rem, 1fr))`, miniatura 4:3, radio `--radius-sm`).
- Cada elemento tiene una sola acción visible «Quitar» (ghost `sm`); el nombre
  accesible es «Quitar X de la galería» o, si es la portada, «Quitar X de la
  galería y de la portada».
- La miniatura de la portada lleva `<Badge tone="accent">Portada</Badge>`.
- Vacío: «Añade imágenes para ilustrar la ficha.»; la acción está en la cabecera
  de la sección, a 8 px, no se duplica dentro del vacío.
- Al quitar la portada de la galería se limpia también la portada (comportamiento
  actual) y el nombre accesible lo advierte.

---

## 6. Guardado y errores

### 6.1 Estados y tonos

| Estado | Texto en la fila | Tono | Región |
|---|---|---|---|
| `saved` | «Guardado» | `--success` | `role="status"` |
| `dirty` | «Cambios sin guardar» | `--warning` | `role="status"` |
| `saving` | «Guardando…» | `--muted` | `role="status"` |
| `error` | «No se pudo guardar» | `--danger` | `role="status"` + alerta |

- La fila nunca muestra la frase larga: la alerta usa
  «No se pudo guardar. Tus cambios siguen en pantalla.».
- Todos los pares están en la tabla §4.5: `success`/`warning`/`danger` sobre
  `--bg` (5,73 / 5,37 / 6,07 en Claro; 10,37 / 9,80 / 8,93 en Oscuro).
- `.wc-save-state--saving` se añade explícitamente con `--muted` (hoy cae al
  color base).

### 6.2 Alertas

- Contenedor `div.wc-alert.wc-alert--inline[role="alert"]` con
  `tabIndex={-1}`, entre la cabecera y la primera sección, dentro de la columna
  del documento.
- **Validación:** texto `invalid` («Revisa los campos marcados antes de
  guardar.»), sin acción. Los errores de campo ya llevan `role="alert"` y
  `aria-invalid`.
- **Fallo de guardado:** texto `saveError` + botón secundario «Volver a
  intentar» que repite `flush(true)`.
- **Error de carga:** alerta propia con `errorTitle`, `errorDescription` y
  «Volver a intentar». La barra de página ya ofrece «Volver a las fichas»; no se
  duplica el botón dentro de la alerta (C24).
- La alerta no tapa el panel ni cambia el ancho del documento.

### 6.3 Foco y revelado (contrato)

1. **Guardado explícito** («Listo» o «Guardar ahora») con validación inválida:
   permanece en edición, abre las secciones afectadas y enfoca el **primer
   control inválido en orden DOM**: Nombre → primer campo del tipo con error →
   editor de descripción. Si no hay control (error de documento), enfoca la
   alerta.
2. **Fallo de almacenamiento** en guardado explícito: permanece en edición y
   enfoca la alerta (`tabIndex=-1`), no un campo.
3. **Autoguardado** con validación inválida: entra en edición, abre las secciones
   afectadas y anuncia por `aria-live`/`role="alert"`, **sin mover el foco**,
   salvo que el elemento enfocado haya desaparecido al cambiar de modo; en ese
   caso, enfoca el primer error para no dejar el foco en `body`.
4. **Éxito de «Listo»:** vuelve a lectura y devuelve el foco al botón «Editar»
   (efecto posterior al commit).
5. **«Editar» / clic en el título:** enfoca Nombre (cursor al final).
6. **«Editar descripción»:** abre la sección y enfoca `.wc-editor__content`.
7. **«Editar campos»:** abre la sección y enfoca el primer control (o el primero
   inválido si lo hay).
8. **«Ir a Recursos»:** abre Recursos y enfoca «Añadir imágenes».
9. Los errores no se ocultan al plegar una sección: si el usuario la cierra, el
   indicador de guardado y la alerta siguen visibles; al guardar de nuevo se
   vuelve a abrir.

Las secciones se abren **antes** de intentar enfocar; el foco se aplica en un
efecto posterior al commit (`requestAnimationFrame`), nunca en el mismo tick.

### 6.4 Serialización del guardado

- Cola de una sola promesa encadenada: un guardado en curso no descarta el
  siguiente.
- El borrador no se reemplaza al guardar; cambiar de modo no lo toca.
- Al desmontar, flush del último borrador.
- Si el borrador cambió mientras se guardaba, no se pinta «Guardado»; se encola
  el siguiente guardado y se mantiene «Cambios sin guardar» hasta que el último
  borrador esté persistido.
- `Ctrl+S`: `preventDefault` siempre (evita el diálogo de guardar página de
  Electron); solo guarda en edición. No actúa si hay un `<dialog open>`.

---

## 7. Matriz de estados

| Estado | Documento | Panel | Foco / ARIA |
|---|---|---|---|
| **Carga** | Barra con «Volver»; esqueleto de título, 3 líneas y cabecera de sección; `aria-busy="true"`; texto de carga en `.wc-visually-hidden` con `role="status"`. | No se pinta; toggle no se pinta. | Nada se enfoca solo. |
| **Error de carga** | Barra con «Volver»; alerta con título, descripción y «Volver a intentar». | No se pinta. | `role="alert"`; sin foco forzado. |
| **Vacío de descripción** | Sección abierta; «Todavía no hay descripción.» en `--muted`; acción «Añadir descripción». | Normal. | Acción ghost. |
| **Tipo sin campos** | Sección «Campos del tipo» con «Este tipo no tiene campos adicionales.»; sin acción de edición; meta omitida. | Normal. | — |
| **Sin etiquetas** | Igual. | Chips ausentes; select «Añadir etiqueta» + «Nueva etiqueta»; ayuda si el mundo no tiene ninguna. | — |
| **Sin imágenes** | Recursos con «Añade imágenes para ilustrar la ficha.» y «Añadir imágenes» en la cabecera. | Portada vacía; «Ir a Recursos» si no hay assets. | — |
| **Panel oculto** | Grid de una columna; el documento ocupa todo el ancho. | `display: none`; separador `display: none`. | Toggle `aria-expanded="false"`; foco en el toggle. |
| **Sección cerrada** | Cabecera de 48 px con chevron a la derecha, meta y acciones; cuerpo `hidden`. | Normal. | `aria-expanded="false"`, `aria-controls` válido. |
| **Guardando** | Estado «Guardando…»; campos editables. | Normal. | `role="status"`; sin foco forzado. |
| **Error de guardado** | Estado corto en `--danger` + alerta con reintento. | Normal. | Foco solo si fue explícito. |
| **Solo lectura** | Sin campos de texto; enlaces internos navegan con clic; descripción serif 18/1,7. | Interactivo (estado/etiquetas/portada). | Sin `textbox` de nombre/alias/resumen; el editor no expone rol de formulario. |
| **Edición** | Campos de cabecera, toolbar de descripción, formulario de campos; «Guardar ahora» + «Listo»; favorito y `⋯`. | Igual. | «Listo» primaria; foco dirigido por la entrada. |

Estados adicionales de sección: **error de carga de relaciones** (alerta interna
con reintento, ya existente) y **carga de relaciones** (texto de estado).

---

## 8. Tokens por pieza

Solo roles existentes. No se inventa ningún color. Las medidas en px/rem son
dimensiones, no tokens de color.

| Pieza | Superficie | Texto | Borde / línea | Radio | Espaciado | Tipografía |
|---|---|---|---|---|---|---|
| Página / documento | `--bg` | `--fg` | — | — | `--space-7` entre bloques | `--font-ui` base |
| Título del documento | `--bg` | `--fg` | — | — | — | `--font-content`, `--text-display`, 600, 1,2 |
| Alias / meta | `--bg` | `--muted` | — | — | `--space-3` | `--text-sm` |
| Resumen | `--bg` | `--fg` | — | — | — | `--text-md`, 1,5 |
| Insignia tipo | `--surface-sunken` | `--fg` | — | `--radius-pill` | `--space-1 --space-3` | `--text-xs`, 500 |
| Insignia estado | `--success-surface` / `--warning-surface` / `--surface-sunken` | `--success` / `--warning` / `--fg` | — | `--radius-pill` | igual | `--text-xs` |
| Guardado (saved/dirty/error) | `--bg` | `--success` / `--warning` / `--danger` | — | — | — | `--text-sm` |
| Botón primario | `--accent` (hover `--accent-strong`) | `--accent-contrast` | `--accent` | `--radius-sm` | `--space-2 --space-4` | `--text-base`, 500 |
| Botón secundario | `--surface-raised` | `--fg` | `--border-strong` | `--radius-sm` | igual | `--text-base` |
| Botón ghost | transparente (hover `--surface-sunken`) | `--fg` | transparente | `--radius-sm` | igual | `--text-base` |
| Sección | `--bg` | `--fg` | top `1px --border` | — | header 8/48; cuerpo 8/24 | título `--font-content` 22/600 |
| Chevron | `--surface-sunken` (hover `--accent-surface`) | `--muted` (hover `--accent`) | — | `--radius-sm` | 28×28 | icono 16 |
| Meta de sección | `--bg` | `--muted` | — | — | `--space-2` | `--text-sm` |
| Panel | `--surface` | `--fg` | — | `--radius-md` | padding `--space-4`; gap `--space-6` | `--font-ui` |
| Título del panel | `--surface` | `--fg` | — | — | — | 16/600 |
| Rótulo de bloque | `--surface` | `--fg` | — | — | 8 inferior | 13/600 |
| Ayuda del panel | `--surface` | `--muted` | — | — | 4 | `--text-sm` |
| Portada (marco) | `--surface-sunken` si vacía | — | `1px --border` | `--radius-sm` | alto 184 | — |
| Texto de portada vacía | `--surface-sunken` | `--muted` | — | — | `--space-4` | `--text-sm` |
| Chip | `--surface` / `--entity-*-surface` | `--fg` | `1px --border` / `--entity-*` | `--radius-pill` | mín. 28 de alto | `--text-sm` |
| Lista de campos (`dl`) | `--bg` | `dt --muted`, `dd --fg` | sin líneas | — | row-gap 8, column-gap 24 | `dt --text-sm`, `dd --text-md` |
| Enlace de referencia | `--bg` | `--accent-strong` | — | — | inline | `--text-md`, subrayado |
| Galería (miniatura) | `--surface-raised` | — | `1px --border` | `--radius-md` | `--space-2` | — |
| Alerta en línea | `--danger-surface` | `--fg` | `1px --danger` | `--radius-md` | `--space-4` | `--font-ui` |
| Separador (zona) | transparente | — | línea 1px `--border` | — | 10 px | — |
| Separador (pill) | `--border-strong` | — | — | `--radius-pill` | 4×24 | — |

**Tokens que faltan:** ninguno de color. Se necesita una variable local
`--wc-properties-width` (280–360, por defecto 320) en el contenedor del grid; no
es un token de tema. El alto 184 px, la zona de 10 px y los objetivos de 28/48 px
son medidas del componente, no tokens.

---

## 9. Matriz de temas y contraste

Parejas ya cubiertas por la tabla §4.5 del sistema: `fg` sobre `bg`/`surface`,
`muted` sobre `bg`/`surface`/`surface-sunken`, `accent` sobre `bg`/`accent-surface`,
`success`/`warning`/`danger` sobre `bg` y sobre sus superficies, `border-strong`
sobre `bg`/`surface`, `focus` sobre `bg`/`surface`, `fg` sobre `selection` y las
marcas `--entity-*` sobre su superficie.

**Parejas nuevas que este contrato introduce** (deben añadirse a §4.5 y al test
`tests/unit/design-tokens.test.ts`):

| Pareja | Uso | Claro | Oscuro | Mínimo |
|---|---|---:|---:|---|
| `--accent-strong` sobre `--bg` | Enlaces de referencia y enlaces de lectura | 9,05:1 | 9,92:1 | 4,5:1 |
| `--accent-contrast` sobre `--accent-strong` | Hover/activo de la primaria | 9,94:1 | 10,35:1 | 4,5:1 |
| `--fg` sobre `--surface-sunken` | Insignia neutra, chevron | 12,87:1 | 17,15:1 | 4,5:1 |
| `--fg` sobre `--entity-moss-surface` | Chip musgo | 12,77:1 | 11,17:1 | 4,5:1 |
| `--fg` sobre `--entity-ochre-surface` | Chip arena | 11,44:1 | 11,22:1 | 4,5:1 |
| `--fg` sobre `--entity-danger-surface` | Chip terracota | 12,20:1 | 13,01:1 | 4,5:1 |
| `--fg` sobre `--entity-prussian-surface` | Chip pizarra | 12,87:1 | 17,15:1 | 4,5:1 |
| `--warning` sobre `--surface-raised` | Estrella de favorita activa (gráfico) | 5,90:1 | 8,24:1 | 3:1 |
| `--muted` sobre `--surface-raised` | Estrella de favorita inactiva (gráfico) | 5,58:1 | 6,51:1 | 3:1 |

**Comprobaciones por pieza (Claro / Oscuro):**

| Pieza | Pareja | Claro | Oscuro |
|---|---|---:|---:|
| Documento | `--fg` / `--bg` | 13,82 | 16,43 |
| Alias, meta | `--muted` / `--bg` | 5,07 | 7,74 |
| Guardado | `--success` / `--bg` | 5,73 | 10,37 |
| Guardado | `--warning` / `--bg` | 5,37 | 9,80 |
| Guardado | `--danger` / `--bg` | 6,07 | 8,93 |
| Insignia estado activa | `--success` / `--success-surface` | 5,35 | 7,74 |
| Insignia estado borrador | `--warning` / `--warning-surface` | 4,96 | 6,99 |
| Chevron | `--muted` / `--surface-sunken` | 4,72 | 8,08 |
| Panel | `--fg` / `--surface` | 14,55 | 15,17 |
| Ayuda del panel | `--muted` / `--surface` | 5,34 | 7,15 |
| Portada vacía | `--muted` / `--surface-sunken` | 4,72 | 8,08 |
| Separador | `--border-strong` / `--bg` | 3,50 | 4,70 |
| Separador | `--focus` / `--bg` (anillo) | 7,08 | 9,92 |
| Toggle abierto | `--accent` / `--accent-surface` | 6,54 | 5,44 |
| Alerta | `--fg` / `--danger-surface` | 12,20 | 13,01 |
| Primaria | `--accent-contrast` / `--accent` | 7,78 | 8,36 |

**Reglas de tema:**

- Nada se pinta con `--border` si es un control: `--border` es divisor (1,23 /
  1,57) y no supera 3:1.
- No se usa `--muted` sobre `--selection` en Claro (4,20:1): los chips usan
  `--fg`.
- No se intercambian papeles de rol: `--success` es texto, no fondo; las
  superficies tintadas son fondos.
- Las estrellas, iconos y marcas van con texto o `aria-pressed`; el color nunca
  es el único indicador.
- Sin `opacity` en deshabilitados: `--disabled-surface`, `--disabled-border`,
  `--disabled-text`.

---

## 10. Ventana y anchos

Anchos de referencia con rail expandido (240 px) y padding del `main` de 24 px
por lado.

### 10.1 Medidas reales

| Ventana | Ancho útil | Panel | Separador + gaps | Documento | Modo del panel |
|---:|---:|---:|---:|---:|---|
| 1024×700 | 736 | ancho completo | 0 | 736 | apilado, 1 columna de documento |
| 1280×800 | 992 | 320 (hasta 360) | 34 | 638 (598) | lateral, sticky |
| 1600×900 | 1312 | 320 (hasta 360) | 34 | 958 (918) | lateral, sticky |

- 1024: la barra de página cabe en una fila; la cabecera del documento envuelve
  insignias y acciones si hace falta; el panel pasa debajo y su portada se limita
  a 320 px de ancho; la galería hace 6 columnas.
- 1280: cabecera a dos columnas (identidad + acciones) o con las acciones
  envolviendo si el tipo/estado es largo; panel sticky; el texto de lectura se
  limita a 68ch aunque sobren 638 px. La galería hace 5 columnas con panel de 320
  y 4 con panel de 360.
- 1600: el documento tiene 958 px, pero la lectura sigue a 68ch; la galería hace
  7 columnas (10 con el panel cerrado); el panel conserva su ancho elegido.
- A 1181 px (justo antes de apilar) con panel a 360 el documento baja a 499 px
  (~57ch). Es el único punto por debajo de la guía de 60ch; se acepta porque el
  usuario ha ensanchado el panel a propósito y no hay desbordamiento. Con el
  ancho por defecto (320) el documento queda en 539 px (~61ch).

### 10.2 Comprobaciones obligatorias

- `document.documentElement.scrollWidth <= window.innerWidth` y
  `document.body.scrollWidth <= window.innerWidth` en 1024, 1280 y 1600, con
  panel abierto y cerrado, en Claro y Oscuro.
- Contenido de prueba: nombre de 120 caracteres sin espacios; 10 alias de 80
  caracteres; resumen de 280 caracteres sin espacios; etiqueta de 40 caracteres
  sin espacios; etiqueta de campo de 80; valor de texto de 800; slug de 80 sin
  guiones; descripción de 4.000 caracteres con un enlace interno.
- Cada contenedor (`wc-entity-doc`, `wc-document-header`, `wc-disclosure__header`,
  `wc-entity-properties`, `.wc-tag`) cumple `scrollWidth <= clientWidth + 1`.
- No se permite `overflow-x: hidden` en `body`/`html`.
- A 1024: el separador no existe en el DOM visible ni en el orden de tabulación.
- A 1600: el panel no empuja el documento más allá de su track; el texto no se
  centra ni se sale.

---

## 11. Accesibilidad

### 11.1 Nombres y relaciones

| Control | Nombre accesible | Estado / relación |
|---|---|---|
| Volver | «Volver a las fichas» | — |
| Toggle panel | «Ocultar propiedades» / «Mostrar propiedades» | `aria-expanded`, `aria-controls="wc-entity-properties"`, tooltip |
| Favorita | «Favorita» (fijo) | `aria-pressed` |
| Editar | «Editar» | — |
| Guardar ahora | «Guardar ahora» | `aria-keyshortcuts="Control+S"` |
| Listo | «Listo» | primaria |
| Sección | «Descripción», «Campos del tipo», «Relaciones», «Recursos» | `aria-expanded`, `aria-controls`, meta incluida en el nombre |
| Separador | «Ajustar el ancho del panel de propiedades» | `aria-orientation`, `aria-valuemin/max/now/valuetext`, `aria-controls` |
| Panel | «Propiedades» | `aside` + `aria-labelledby` |
| Portada | «Elegir portada» / «Cambiar portada» / «Ir a Recursos» | — |
| Chip quitar | «Quitar la etiqueta X de la ficha» | — |
| Galería quitar | «Quitar X de la galería» / «… y de la portada» | — |

- Las secciones cerradas no exponen su cuerpo (`hidden`).
- El `h2` del título no es interactivo para AT; el clic es solo un atajo de
  ratón.
- Los errores de campo usan `aria-invalid` y `aria-describedby` (componentes
  existentes).

### 11.2 Teclado

| Tecla | Dónde | Acción |
|---|---|---|
| `Enter` / `Espacio` | Botón de sección | Pliega/despliega. |
| `←` / `→` | Separador enfocado | ±16 px; no desplaza la página. |
| `Inicio` / `Fin` | Separador enfocado | 280 / 360 px. |
| `Escape` | Durante arrastre | Cancela y restaura el ancho inicial. |
| `Ctrl+S` | Página, sin diálogos | Guarda en edición; `preventDefault` siempre. |
| `Tab` / `Shift+Tab` | Toda la página | Orden de §1.2, sin trampas. |
| `Escape` | Diálogos y menú | Cierre y retorno de foco existentes. |

- Foco visible global de 2 px `--focus` con 2 px de separación; en el separador,
  anillo equivalente alrededor del pill.
- No se mueve el foco al cargar, al autoguardar ni al abrir/cerrar secciones
  (salvo la entrada explícita a edición).
- Al volver a lectura tras «Listo», el foco va a «Editar».
- `prefers-reduced-motion`: chevron sin transición, sin animación de altura, sin
  desplazamientos automáticos. El pulso del esqueleto se detiene por la regla
  global.

### 11.3 axe

Sin violaciones críticas ni graves en Claro y Oscuro, con:

- panel abierto y cerrado;
- secciones abiertas y cerradas;
- alerta de validación visible;
- separador enfocado;
- contenido largo.

Riesgos concretos a vigilar:

- `role="separator"` focusable: exige nombre y `aria-valuemin/max/now`.
- `aria-controls` debe apuntar a IDs existentes también cuando el panel está
  oculto.
- El div de ProseMirror en lectura **no** debe conservar `role="textbox"` ni
  `aria-label` (Tiptap los pone por defecto). Se retiran en lectura y se
  restauran en edición; en lectura el nombre lo da el `h3` de la sección (C7).
- `aria-label` no se usa en `div`/`span` genéricos sin rol.
- Las listas con nombre (`ul[aria-label]`) y el `dl` no generan roles extraños.
- El `h2` del panel después de los `h3` de sección no rompe `heading-order`
  (solo se comprueba el salto hacia abajo).
- El toggle con `aria-expanded` y el `aside` con `display:none` es válido.

---

## 12. Textos (`entities.detail`)

Tono cercano, frases completas, sin concatenaciones en componentes. Los
plurales y listas se resuelven con funciones del catálogo o `formats`.

### 12.1 Nuevos

| Clave | Texto / firma |
|---|---|
| `edit` | `Editar` |
| `done` | `Listo` |
| `untitled` | `Ficha sin nombre` |
| `favoriteLabel` | `Favorita` |
| `saveFailedShort` | `No se pudo guardar` |
| `propertiesTitle` | `Propiedades` |
| `propertiesShow` | `Mostrar propiedades` |
| `propertiesHide` | `Ocultar propiedades` |
| `propertiesResize` | `Ajustar el ancho del panel de propiedades` |
| `propertiesWidth` | ``(pixels: string) => `${pixels} píxeles` `` |
| `aliasLine` | ``(list: string) => `Alias: ${list}.` `` |
| `summaryPlaceholder` | `Una o dos frases para recordar de qué trata.` |
| `descriptionEmpty` | `Todavía no hay descripción.` |
| `addDescription` | `Añadir descripción` |
| `editDescription` | `Editar descripción` |
| `editFields` | `Editar campos` |
| `descriptionMeta` | ``(count: number) => count === 1 ? '1 palabra' : `${count} palabras` `` |
| `fieldsMeta` | ``(count: number) => count === 1 ? '1 campo' : `${count} campos` `` |
| `relationsMeta` | ``(count: number) => count === 1 ? '1 relación' : `${count} relaciones` `` |
| `resourcesMeta` | ``(count: number) => count === 1 ? '1 imagen' : `${count} imágenes` `` |
| `emptyValue` | `Sin valor` |
| `referenceMissing` | `La ficha enlazada ya no está disponible.` |
| `coverTitle` | `Portada` |
| `coverEmpty` | `Sin portada todavía.` |
| `coverBadge` | `Portada` |
| `chooseCover` | `Elegir portada` |
| `changeCover` | `Cambiar portada` |
| `coverHintEmpty` | `Añade imágenes en Recursos y elige una como portada.` |
| `goToResources` | `Ir a Recursos` |
| `coverPickerTitle` | `Elegir portada` |
| `coverPickerLead` | `Elige una imagen de este mundo como portada.` |
| `tagsAssignedLabel` | `Etiquetas de la ficha` |
| `tagAddLabel` | `Añadir etiqueta` |
| `tagAddPlaceholder` | `Elige una etiqueta` |
| `noAvailableTags` | `No quedan etiquetas por asignar.` |
| `tagsNone` | `Todavía no hay etiquetas en este mundo. Crea la primera.` |
| `removeCoverNamed` | `(label: string) =>` devuelve «Quitar {label} de la galería y de la portada»; con `label` vacío usa «la imagen». |

### 12.2 Reutilizados

`back`, `loading`, `errorTitle`, `errorDescription`, `retry`, `nameLabel`,
`aliasesLabel`, `aliasesHint`, `summaryLabel`, `descriptionLabel`,
`descriptionHint`, `attributesTitle`, `attributesEmpty`, `statusLabel`,
`tagsTitle`, `tagsLimit`, `removeTagNamed`, `newTag`,
`galleryEmpty`, `addImages`, `removeImageNamed`, `imageOption`, `noImages`,
`save`, `saving`, `saved`, `unsaved`, `saveError`, `invalid`, `menuLabel`,
`delete*`, `imageError`, `status.*`, `relations.*`.

### 12.3 Retirados o sustituidos

| Antiguo | Sustituto | Motivo |
|---|---|---|
| `imageTitle` | `coverTitle` / `coverPickerTitle` | Se adopta «portada» como término de interfaz. |
| `imageEmpty` | `coverEmpty` | Igual. |
| `chooseMain` / `changeMain` | `chooseCover` / `changeCover` | Igual. |
| `setMain`, `setMainNamed`, `mainBadge` | `coverBadge` | Ya no se marca la portada desde la galería. |
| `galleryTitle` | — | La sección «Recursos» ya es el título. |
| `tagsEmpty` | `tagAddPlaceholder` / `tagsNone` / `noAvailableTags` | La lista vacía no se pinta; los textos dependen del caso. |
| `favorite` / `unfavorite` (en `detail`) | `favoriteLabel` | El nombre del toggle no cambia; los avisos siguen en `entities.notices`. |
| `removeImage` | `removeFromGallery` = «Quitar» | Texto visible corto; el nombre accesible es `removeImageNamed`. |

No se escriben cadenas visibles en componentes; todo pasa por el catálogo tipado.

---

## 13. Correcciones vinculantes C1–C25

Cada corrección indica severidad, archivo principal y criterio de verificación.
Las severidades altas bloquean la puerta de UI.

| # | Sev. | Corrección | Archivo(s) | Verificación |
|---|---|---|---|---|
| C1 | Media | Sustituir el redondel de tipo de 48 px y el radio `--radius-lg` del panel por el patrón v2: icono en la insignia y `--radius-md` en el panel. No añadir borde ni sombra al panel. | `entity-document-header.tsx`, `components.css` | El panel calcula `border-radius: 6px`; no hay `box-shadow` ni borde en `.wc-entity-properties`; el `h2` del documento es el mayor texto. |
| C2 | **Bloqueante** | El separador no puede ser solo una línea de 2 px `--border` (1,23:1). Dejar una línea decorativa de 1 px `--border` y un agarre visible de 4×24 px `--border-strong` (3,50 / 4,70); hover `--accent`. | `components.css` | Contraste medido del agarre ≥ 3:1 en ambos temas; el agarre se ve en captura a 1280 y 1600. |
| C3 | **Bloqueante** | Implementar el separador como widget: `role="separator"`, orientación vertical, `tabIndex=0`, `aria-controls`, `aria-valuemin=280`, `aria-valuemax=360`, `aria-valuenow`, `aria-valuetext`; flechas ±16, Inicio/Fin, Escape cancela el arrastre, doble clic a 320. | `entity-detail-page.tsx` (o `entity-properties-resizer.tsx`), `components.css` | Test de teclado: `aria-valuenow` 320 → 336 con →, 280 con Inicio, 360 con Fin; el foco no sale del separador; clamp en los extremos. |
| C4 | Alta | `sticky` con `top: calc(var(--topbar-height) + var(--space-4))` (no solo `--space-4`) y `max-block-size: calc(100vh - var(--topbar-height) - var(--space-4) * 2)` con scroll interno; el panel no debe quedar bajo la barra ni con el final inalcanzable. | `components.css` | A 1280×700 con 12 etiquetas: el panel se detiene a 72 px del viewport y su contenido tiene scroll interno; a 800/900 no hay scroll interno si cabe. |
| C5 | Media | Estado de guardado corto y estable: «No se pudo guardar» en la fila; la frase larga `saveError` solo en la alerta. Reservar `min-inline-size: 9rem`. | `entity-document-header.tsx`, `messages/es.ts`, `components.css` | Cambiar entre los cuatro estados no mueve los botones (mismo `getBoundingClientRect().right`); el texto largo no aparece en la fila. |
| C6 | Alta | El botón de favorito mantiene el nombre «Favorita» y usa `aria-pressed`; no intercambia el nombre por «Quitar de favoritas». | `entity-document-header.tsx`, `messages/es.ts` | El nombre accesible es «Favorita» en ambos estados; `aria-pressed` cambia de true a false; el icono relleno/vacío acompaña. |
| C7 | Alta | En lectura, el editor de descripción no debe exponer un `textbox` ni un `aria-label` genérico: retirar `role` y `aria-label` de `.ProseMirror`, ocultar toolbar, ayuda y diálogo de enlace, quitar borde/fondo/alto de campo, usar `--font-content` 18/1,7 y 68ch. En lectura, un clic normal en un enlace interno navega; en edición se mantiene Ctrl/Cmd+clic y «Abrir enlace». | `entity-description-editor.tsx`, `components.css` | En lectura no hay `getByRole('textbox', { name: Descripción })`; axe sin `aria-prohibited-attr`; un clic en el enlace navega; en edición el toolbar sigue disponible. |
| C8 | Alta | El cuerpo de una sección cerrada permanece montado y se oculta con `hidden` + `[hidden]{display:none}`, sin desmontar Tiptap. | `disclosure-section.tsx` | Escribir, cerrar «Descripción», reabrir: el texto y el cursor/estado del editor se conservan; el cuerpo cerrado no es accesible ni enfocable. |
| C9 | Alta | Mapa de errores a secciones (`name`→cabecera, clave de campo→`attributes`, documento→`description`) con apertura previa al foco. En explícito, enfocar el primer control inválido; en autoguardado, no mover el foco salvo que el elemento enfocado haya desaparecido. | `entity-detail-page.tsx` | Test: campo obligatorio vacío + «Listo» → sección abierta, foco en el control; mismo error en autoguardado → sección abierta, foco donde estaba. |
| C10 | Alta | Añadir un `id` estable a los controles de `EntityAttributesFields` con el patrón `wc-attribute-<clave>` para poder enfocar por error; las claves cumplen `[a-z0-9-]+`. | `entity-attributes-fields.tsx` | El control con error recibe foco y `id` estable; sin duplicados con 30 campos. |
| C11 | Media | Fechas de campo `date`: formatear el valor como `AAAA-MM-DDT00:00:00Z` con `{ timeZone: 'UTC' }` para no desplazar el día. | `entity-attributes-view.tsx` | `2026-01-01` se muestra como 1 de enero en cualquier zona horaria; test unitario con TZ distinta. |
| C12 | Media | La ficha técnica es un `dl` de dos columnas sin líneas ni aspecto de tabla; `dt --muted --text-sm`, `dd --fg --text-md`; referencias como botón con aspecto de enlace `--accent-strong`; valores vacíos «Sin valor»; referencia rota con `referenceMissing`. | `entity-attributes-view.tsx`, `components.css` | Sin `table`/`role=table`; `dl` con pares directos; el enlace de referencia navega; el contraste de `accent-strong` sobre `bg` es 9,05/9,92. |
| C13 | Alta | Una sola autoridad de portada: el panel elige/cambia; la galería no repite «Usar como principal»; la miniatura de portada muestra la insignia «Portada»; Recursos solo importa y quita. Al quitar la portada, el nombre accesible lo advierte. | `entity-properties-panel.tsx`, `entity-resources-section.tsx`, `messages/es.ts` | No hay dos botones con el mismo efecto; el flujo de portada se completa desde el panel; el E2E ya no busca «Usar como principal» en la galería. |
| C14 | **Bloqueante** | El `aside` contiene solo portada, estado y etiquetas. Fuera galería, nombre, resumen, campos, relaciones y descripción. | `entity-properties-panel.tsx` | Test por rol: `complementary` «Propiedades» no contiene `textbox` de nombre/resumen, ni `dl`, ni `.wc-gallery`. |
| C15 | Alta | A ≤1180 px: una columna, panel después del documento, separador `display:none`, panel no sticky y sin ancho fijo; interior del panel en dos columnas (portada 224–320 + campos). Sin `order` CSS. | `components.css` | A 1024 y 1180 no hay `separator` accesible ni sticky; el panel aparece debajo; a 1181 vuelve el lateral. Sin overflow. |
| C16 | Alta | `overflow-wrap: anywhere` en título, alias, resumen, meta, slug, títulos de sección, chips, `dt`/`dd` y valores; `min-width:0` en todos los hijos de flex/grid. | `components.css` | Matriz de contenido largo (§10.2) sin scroll horizontal de página en 1024/1280/1600 × ambos temas. |
| C17 | Alta | Toggle con `aria-expanded`, `aria-controls="wc-entity-properties"`, nombre de acción, tooltip, `variant` distinto abierto/cerrado y visible en todos los anchos. | `entity-detail-page.tsx` | Al ocultar, `aria-expanded=false`, panel `display:none`, foco en el toggle; a 1024 sigue disponible. |
| C18 | Alta | `DisclosureSection`: `section[aria-labelledby]`, `h3 > button[aria-expanded][aria-controls]`, chevron `aria-hidden`, acciones fuera del botón, fila ≥48 px, meta, `data-section`. | `disclosure-section.tsx`, `components.css` | Enter/Espacio pliegan; `aria-expanded` cambia; el botón de acción no pliega; el cuerpo cerrado no es accesible. |
| C19 | Media | Región de guardado siempre montada, `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, sin robar foco. | `entity-document-header.tsx` | El nodo existe desde el montaje; los cambios se anuncian una vez; el foco no cambia al autoguardar. |
| C20 | Media | Alerta en línea `--danger-surface`/`--danger` con padding 16, radio `--radius-md`, `role="alert"`, `tabIndex=-1`; reintento solo en fallo de guardado. En error de carga no duplicar «Volver» dentro de la alerta. | `entity-detail-page.tsx`, `components.css` | axe sin alertas anidadas; el foco va a la alerta solo en fallo explícito; el error de carga conserva la barra con Volver. |
| C21 | Media | Evitar el doble «Estado»: sin `h3` en el bloque de estado; la etiqueta visible del `SelectField` actúa de rótulo (13 px/600). | `entity-properties-panel.tsx`, `components.css` | El nombre accesible del select es «Estado» una sola vez; no hay dos textos «Estado» consecutivos. |
| C22 | Baja | Portada: alto fijo 184 px; en apilado, ancho máximo 20rem (320 px) para no convertirla en banda; vacío con `--surface-sunken`, icono y texto, sin borde discontinuo. | `components.css` | Captura a 1024: la portada no supera 320 px de ancho; a 1280/1600 mantiene 184 px de alto. |
| C23 | Baja | Una sola primaria: «Listo» en edición; en lectura no hay primaria; «Editar», «Guardar ahora», «Añadir relación/imágenes» y «Elegir portada» son secundarias; «Nueva etiqueta»/ghost. | `entity-detail-page.tsx`, `entity-properties-panel.tsx` | Test: en lectura 0 `button` primarios; en edición exactamente 1 («Listo»). |
| C24 | Alta | Carga y error con barra de página (Volver) y sin panel; esqueleto con `aria-busy` y estado oculto; error con reintento. | `entity-detail-page.tsx`, `components.css` | En carga no hay toggle ni panel; en error se puede volver y reintentar; axe correcto. |
| C25 | Media | Sin ningún asset en el mundo, el panel no muestra un botón deshabilitado: muestra ayuda y «Ir a Recursos», que abre la sección y enfoca «Añadir imágenes». | `entity-properties-panel.tsx`, `entity-detail-page.tsx` | Con cero assets, «Ir a Recursos» está enfocable y lleva a la acción de importar; con assets, aparece «Elegir portada». |

**Otras decisiones registradas**

- No se añade ADR: no hay decisión arquitectónica nueva. La dirección v2 ya está
  aprobada (ADR 0025 / D-048) y la memoria de sesión es el patrón de #126–#128.
- No se añaden dependencias ni iconos de terceros: chevron, panel e imagen se
  dibujan con SVG propio de 1,6 px y `currentColor`.
- El documento de diseño (§9, §10.4, §14, §17) se actualiza al cerrar la issue;
  este contrato se conserva como registro de la decisión de #129.

---

## 14. Entrega al implementador

**Orden recomendado:** memoria de sesión → `DisclosureSection` → i18n → panel y
vista `dl` → reescritura de la página → estilos → pruebas de componentes → E2E.

**No entra en esta issue:** presentación legible de relaciones y grafo (#130),
editor mínimo y menciones (#131), persistencia de preferencias en
`app_settings` (#132), auditoría visual global (#133).

**Manual de usuario (deltas para `documentation-sync`):**

- §3.2: plegado con Enter/Espacio, separador con flechas/Inicio/Fin, `Ctrl+S`.
- §5.1: al crear una ficha se abre en lectura; «Editar» para completarla.
- §5.2: reescribir el guardado: lectura por defecto, «Editar»/«Listo»,
  «Guardar ahora», autoguardado, estados y errores que abren la sección.
- §5.3: descripción en lectura/edición; en lectura los enlaces internos se abren
  con un clic.
- §5.4: los campos se leen como ficha técnica.
- §5.6: portada en el panel; galería en Recursos; quién hace cada acción.
- §5.7: etiquetas en el panel; favorito en la cabecera.
- §5.8: estado en el panel; borrado en `⋯`.
- §14: secciones plegables, panel redimensionable, revelado de errores.
- §17: fila de fichas y nueva fila «Ficha como documento y panel de propiedades».

**Pruebas mínimas de UI:** las 12 del plan (§7, paso 7), más las de contraste de
§9, la matriz de estados de §7, la matriz de anchos de §10 y axe en Claro y
Oscuro con panel abierto/cerrado y una alerta visible.

---

## Nota de revisión (2026-11-24, #132)

Este contrato se conserva como registro de #129. Donde dice «memoria de sesión»,
#132 ya **persiste** el panel, su ancho y las secciones en `app_settings` con las
claves `ui.*`, junto con el tema, la barra lateral y el último destino de
«Continuar» (ADR 0027, D-050). No cambian las medidas de 280–360 px ni el ancho
por defecto de 320, las reglas de foco, el apilado a ≤ 1180 px ni el ámbito
visual: el estado persistido es **global**, no por ficha ni por tipo.
