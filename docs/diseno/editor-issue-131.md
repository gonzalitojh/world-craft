# Contrato de diseño — #131 «Editor mínimo y menciones @ / [[ ]]»

> **Estado:** contrato visual y de interacción aprobado por `ui-ux-designer`
> el 23/11/2026. **Vinculante para `tdd-ddd-architect`.** No implementa código,
> estilos ni mensajes: los especifica.
>
> **Base normativa:** [`sistema-de-diseno.md`](sistema-de-diseno.md) v2 (ADR
> 0025, D-048), los tokens reales de `src/renderer/styles/tokens/*.css` y el
> plan aprobado en `tasks/task-issue-131.json`. Donde este contrato contradiga
> el plan, prevalece el contrato; donde contradiga el sistema v2, prevalece el
> sistema, salvo la corrección C1, aprobada por el usuario en la sección 17 del
> plan.
>
> **Decisiones del usuario ya cerradas:** barra mínima permanente de cinco
> acciones, universo de menciones con las fichas ya cargadas, inclusión de
> archivadas y borradores como hoy, y `]]` no se acepta como cierre.

## 0. Alcance y principios

Gobierna el editor de la descripción de ficha y el componente reutilizable que
usará el manuscrito de M3: barra mínima, menú «Formato», typeahead de
menciones, patrón ARIA, estados, temas, ventana, movimiento y textos.

**No entra:** el manuscrito de M3, el lienzo de mapas, el grafo, el diálogo de
enlace (se reutiliza tal cual), el autoguardado y la persistencia (sin cambios).

Reglas que gobiernan todo lo siguiente:

1. **Escribir es la tarea.** La barra no compite con el documento: una fila,
   cinco acciones y nada más.
2. **Una sola forma de hacer cada cosa.** El botón «Mención» inserta `@` y abre
   el mismo selector que el teclado; no hay un diálogo paralelo.
3. **El foco no se secuestra.** Mientras el selector está abierto, el foco
   permanece en el editor; el teclado no intercepta atajos cuando el selector
   está cerrado.
4. **Nada invisible ni ambiguo.** Cada control tiene nombre accesible, estado no
   cromático y contraste AA en los dos temas.
5. **Solo tokens existentes.** Sin colores literales ni roles nuevos.
6. **Escritorio.** Ratón y teclado, 1024×700 mínimo, sin patrones táctiles.

---

## 1. Composición y barra mínima

### 1.1 Corrección de la formulación anterior (C1)

El sistema de diseño decía «sin barra de herramientas permanente». **Eso queda
corregido:** en edición la barra mínima de cinco acciones **sí es permanente**.
Lo que se elimina es la barra extensa de once controles y cualquier segunda
fila. El §10.6 y la tabla de componentes del sistema se actualizan en esta
tarea; el ADR 0026 lo registra.

La barra no se oculta al perder el foco ni al desplazarse. No hay barra
flotante, ni burbuja de selección, ni comandos de barra (`/`).

### 1.2 Acciones y orden exacto (C2)

Una sola fila, siempre en este orden:

| # | Acción | Control | Estado que comunica |
|---:|---|---|---|
| 1 | Negrita | botón de conmutación | `aria-pressed` |
| 2 | Cursiva | botón de conmutación | `aria-pressed` |
| 3 | Formato | disparador de menú | `aria-haspopup="menu"`, `aria-expanded` |
| 4 | Enlace | botón de acción | abre el diálogo de enlace |
| 5 | Mención | botón de acción | inserta `@` y abre el selector |

- **No hay más controles de primer nivel.** Título 1–3, listas, cita, «Abrir
  enlace» y «Quitar enlace» viven solo en el menú «Formato».
- **Una única forma de insertar una mención:** el botón inserta `@` (precedido
  de un espacio solo si el carácter anterior es de palabra, para no pegar
  `palabra@`), coloca el cursor tras él y abre el mismo popup del teclado. Si el
  cursor está dentro de un enlace, sale primero al final del enlace, retira la
  marca y luego inserta; nunca abre el selector dentro de un enlace.
- El contenedor conserva `role="toolbar"` con `aria-label` del editor. Los cinco
  controles son paradas de tabulación independientes: **no** se implanta
  roving tabindex ni navegación con flechas entre botones (decisión registrada;
  cinco paradas son predecibles y axe no lo exige).

### 1.3 Iconografía y etiquetas visibles (C3)

Set propio de iconos en SVG para eslabón y chevron, con trazo **1,6 px**,
`currentColor` y `aria-hidden`. Tamaño 20 px dentro de un botón de 32×32. Los
glifos B, I y @ son texto real, no SVG.

| Control | Representación | ¿Texto visible? | Nombre accesible |
|---|---|---|---|
| Negrita | glifo tipográfico **B** en `--font-ui` 700 | No | «Negrita» |
| Cursiva | glifo tipográfico **I** en `--font-ui`, 600 itálica | No | «Cursiva» |
| Formato | **texto «Formato»** + chevron de 16 px | **Sí** | «Formato» (el texto es el nombre) |
| Enlace | icono de eslabón, 20 px | **No, solo icono** | «Enlace a una ficha» |
| Mención | glifo **@**, 20 px | **No, solo icono** | «Mención» |

- **Enlace y Mención son solo icono con nombre accesible.** Se distinguen sin
  ambigüedad por forma (eslabón frente a arroba), por posición fija (4 y 5) y
  por nombre accesible. No comparten glifo, color ni posición.
- «Formato» lleva texto visible y chevron porque es un menú, no una acción
  directa; el texto evita confundirlo con un icono de tipografía.
- El botón «Mención» lleva un tooltip con `mentionHint` (describe el atajo
  `@` / `[[`). Los demás no repiten su nombre en un tooltip: B, I y el eslabón
  son convencionales y «Formato» ya muestra su texto.
- Los glifos B, I y @ son texto real (no SVG) para conservar nitidez y evitar
  dibujar letras; van en un `span` `aria-hidden`.

### 1.4 Medidas (C4)

| Pieza | Valor |
|---|---|
| Alto de la barra | 40 px (`--space-1` de padding 4 + botón 32 + 4) |
| Botón de icono | 32×32 px (`IconButton` tamaño `md`) |
| Disparador «Formato» | 32 px de alto, `padding-inline: var(--space-2)`, `gap: var(--space-1)` |
| Icono / glifo | 20×20 px |
| Separación entre controles | `gap: var(--space-1)` (4 px) |
| Divisor | 1 px × 20 px `--border`, `margin-inline: var(--space-1)`, solo entre Cursiva y Formato |
| Ancho total aproximado | **≈255 px** |
| Alineación | Inicio de la fila; la barra ocupa el ancho del campo, los controles no se estiran |

El divisor es decorativo (`--border`); no sustituye al borde de un control. No
hay una segunda fila ni `flex-wrap` efectivo.

### 1.5 Superficie (C5)

En edición, barra y campo forman **una sola pieza**:

- Barra: fondo `--surface`, con el mismo borde de 1 px `--border` que el campo
  y esquinas superiores `--radius-md`; entre barra y campo hay un divisor
  interior de 1 px `--border`, no un segundo marco.
- Campo: fondo `--surface-raised`, borde 1 px `--border`, esquinas inferiores
  `--radius-md`, esquinas superiores rectas mientras la barra está presente.
- Sin sombra. La jerarquía la da el escalón `--surface` → `--surface-raised` y
  el divisor. El campo conserva `min-block-size: 12rem` y
  `max-block-size: 32rem` con scroll vertical.
- En lectura no existe barra ni marco: el contenido es texto sin borde, sin
  fondo y sin alto mínimo (comportamiento actual de #129).

### 1.6 Estados (C6)

| Estado | Negrita / Cursiva | Formato | Enlace / Mención |
|---|---|---|---|
| Reposo | fondo transparente, glifo `--fg` | fondo transparente, texto `--fg` | fondo transparente, icono `--fg` |
| Hover | fondo `--surface-sunken`, glifo `--fg` | fondo `--surface-sunken` | fondo `--surface-sunken` |
| Foco visible | anillo 2 px `--focus` con 2 px de separación | igual | igual |
| Activo (pulsado) | fondo `--surface-sunken`, sin desplazamiento | fondo `--surface-sunken` | fondo `--surface-sunken` |
| Conmutado (`aria-pressed="true"`) | fondo `--accent-surface`, glifo `--accent-strong`, **barra interior inferior de 2 px `--accent-strong`** | — | — |
| Menú abierto | — | fondo `--surface-sunken`, chevron girado 180° | — |
| Deshabilitado | fondo `--disabled-surface`, glifo `--disabled-text`, borde transparente, `cursor: not-allowed`, sin `opacity` | igual | igual |

- El estado conmutado **no se comunica solo por color**: suma la barra inferior
  de 2 px (`box-shadow: inset 0 -2px 0`) y `aria-pressed`. La barra no cambia el
  tamaño ni provoca salto.
- El anillo de foco cabe dentro del padding de 4 px de la barra; no se recorta.
- No hay estado de carga en la barra: los controles solo se deshabilitan
  cuando el editor no es editable (mismo criterio que hoy).

### 1.7 Ancho (C7)

`flex-wrap: nowrap`, `overflow: visible` y sin scroll horizontal propio. Con
≈255 px de barra, el ancho mínimo del documento en la matriz de la ficha es
**499 px** (ventana de 1181 px con panel a 360); a 1024, 1280 y 1600 px el
documento mide ≥ 638 px. **Nunca se envuelve a una segunda fila.**

---

## 2. Menú «Formato»

### 2.1 Grupos, orden y roles (C8)

Un solo menú, tres bloques en este orden, separados por `role="separator"`
(1 px `--border`, no enfocable, `margin-block: var(--space-1)`):

| Bloque | Ítems | Rol | Estado |
|---|---|---|---|
| Bloque de texto | Párrafo, Título 1, Título 2, Título 3 | `menuitemradio` con `aria-checked` | Exactamente uno comprobado |
| Listas y cita | Lista con viñetas, Lista numerada, Cita | `menuitemcheckbox` con `aria-checked` | Independientes |
| Enlace | Abrir enlace, Quitar enlace | `menuitem` | Deshabilitados si el cursor no está en un enlace |

- «Párrafo» está comprobado cuando el bloque actual no es un encabezado
  (también dentro de listas o cita: el bloque de texto sigue siendo párrafo).
- Título 1–3 se comprueba con el encabezado activo. Las casillas de lista y
  cita reflejan `isActive` del bloque.
- «Abrir enlace» y «Quitar enlace» se habilitan y deshabilitan **juntos**, con
  el cursor o la selección dentro de una marca de enlace.
- El menú se reutiliza del primitivo `Menu`: mismas medidas, posicionamiento con
  volteo, cierre con Escape y retorno de foco. Solo se amplía con disparador
  etiquetado y con ítems marcables.

```html
<div class="wc-menu wc-editor__format">
  <button class="wc-editor__format-trigger" aria-haspopup="menu"
          aria-expanded="true" aria-controls="…">Formato <svg…/></button>
  <div class="wc-menu__list" role="menu" aria-label="Formato del texto">
    <button role="menuitemradio" aria-checked="true">Párrafo</button>
    <button role="menuitemradio" aria-checked="false">Título 1</button>
    <!-- … Título 2, Título 3 … -->
    <div role="separator"></div>
    <button role="menuitemcheckbox" aria-checked="false">Lista con viñetas</button>
    <!-- … Lista numerada, Cita … -->
    <div role="separator"></div>
    <button role="menuitem" disabled>Abrir enlace</button>
    <button role="menuitem" disabled>Quitar enlace</button>
  </div>
</div>
```

### 2.2 Indicador de estado comprobado (C9)

- Cada ítem reserva una **ranura inicial de 16×16 px** en todas las filas, para
  que el texto no se desplace al cambiar de estado.
- Comprobado: glifo de check de 16 px `--accent-strong`, `aria-hidden`. No
  comprobado: ranura vacía (`visibility: hidden`).
- El check es la señal de forma; el color solo refuerza. El nombre del ítem va
  en `--fg` y no cambia de color al comprobarse.
- Las acciones de enlace no llevan check (no son conmutadores); su ranura queda
  vacía.

### 2.3 Foco, teclado y cierre (C10)

| Tecla | Acción |
|---|---|
| `Enter` / `Espacio` | Aplica el ítem y cierra el menú |
| `↓` / `↑` | Siguiente / anterior con envoltura, omitiendo deshabilitados |
| `Inicio` / `Fin` | Primer / último ítem habilitado |
| `Escape` | Cierra y devuelve el foco al disparador «Formato» |
| `Tab` / `Shift+Tab` | Cierra y devuelve el foco al disparador; el siguiente `Tab` sigue el orden normal |

- **Foco inicial:** primer ítem habilitado («Párrafo»), tanto al abrir con clic
  como con `Enter`/`Espacio`. Con `↓` desde el disparador, primer habilitado;
  con `↑`, último habilitado.
- **Al aplicar un ítem, el comando vuelve a enfocar el editor** (`chain().focus()`).
  El cierre devuelve el foco al disparador y la acción lo lleva al documento;
  tras elegir un formato, el usuario sigue escribiendo sin tocar el ratón. Con
  «Abrir enlace», el diálogo toma el foco.
- El menú se cierra al hacer clic fuera sin robar el foco. `Escape` no aplica
  ningún formato.
- Abrir «Formato» cierra el popup de menciones si estaba abierto; abrir el
  diálogo de enlace cierra ambos.

### 2.4 Medidas (C11)

Las del `Menu` existente, sin cambios: `--surface-raised`, borde 1 px
`--border`, `--radius-md`, `--shadow-2`, `z-index: var(--z-tooltip)`, padding
`--space-1`, gap `--space-1`, ítem de 32 px mínimo con padding `--space-2`,
`min-inline-size: 12rem`, `max-inline-size: min(18rem, calc(100vw - 2 *
var(--space-6)))`, margen de 24 px respecto al viewport y scroll interno si no
cabe.

---

## 3. Typeahead de menciones

### 3.1 Apertura (C12)

- `@` abre el selector solo si el carácter anterior es inicio de bloque,
  espacio o puntuación de apertura (`(`, `«`, `"`, `'`, `—`, `-`). Así
  `correo@dominio` no lo abre.
- `[[` abre en cualquier posición. La consulta es el texto entre el disparador
  y el cursor dentro del mismo bloque, con un máximo de 60 caracteres; si
  contiene `[`, `]` o un salto de bloque, el selector se cierra.
- No se abre si el cursor está dentro de una marca de enlace.
- **Universo:** las fichas ya cargadas para la ficha (200 como máximo, sin la
  ficha actual), **incluidas archivadas y borradores**, con paridad con el
  diálogo de enlace actual. No hay consulta nueva por tecla ni estado de carga;
  en mundos con más de 200 fichas la búsqueda es parcial (limitación conocida).
- Se cierra con `Escape`, al insertar, al mover el cursor fuera del rango, al
  perder el foco, al abrir cualquier diálogo (el de enlace o la paleta `Ctrl+K`),
  al abrir el menú «Formato», al desplazar el editor o la página y al
  redimensionar la ventana.
- La consulta tecleada **no se decora**: el popup anclado es la señal. El texto
  del disparador y la consulta permanecen en el documento hasta insertar o
  hasta que el usuario los borre.

### 3.2 Anclaje y medidas (C13)

| Propiedad | Valor |
|---|---|
| Posición | `position: fixed` anclado al cursor (`coordsAtPos`), no al campo; no lo recorta el `overflow` del editor |
| Separación | 4 px bajo la línea del cursor |
| Ancho | `clamp(17rem, 22rem, calc(100vw - 2 * var(--space-6)))` |
| Clamp horizontal | El borde izquierdo se limita a 24 px del viewport y el derecho a 24 px; nunca sobresale |
| Volteo vertical | Por debajo si cabe; si no, por encima del cursor con 4 px; si tampoco cabe, lado con más espacio y altura recortada |
| Altura máxima | `min(20rem, espacio disponible - 24 px)` con scroll interno y `overscroll-behavior: contain` |
| Máximo de opciones visibles | **8**; el resto, scroll interno |
| Superficie | `--surface-raised`, borde 1 px `--border`, `--radius-md`, `--shadow-2` |
| Capa | `z-index: var(--z-tooltip)`, la misma que `Menu`; nunca por debajo del contenido y siempre cerrado antes de que se abra un diálogo |
| Padding | `--space-1` (4 px) |

El popup es DOM propio: sin velo, sin trampa de foco y sin `role="dialog"`.

### 3.3 Anatomía de la opción (C14)

```html
<li role="option" aria-selected="true" class="wc-mention__option">
  <span class="wc-mention__icon" aria-hidden="true"><svg…/></span>
  <span class="wc-mention__label">
    <span class="wc-mention__name">Puerto Sal</span>
    <span class="wc-mention__type">Ciudad</span>
  </span>
</li>
```

- Rejilla de dos columnas: ranura de icono de 16 px + columna de texto con
  `min-width: 0`.
- Icono del tipo a 16 px, `--muted` en reposo y `--accent-strong` en la opción
  activa; es decorativo porque el tipo va escrito.
- **Nombre** en `--fg`, `--text-base` (14 px), 1,4, `overflow-wrap: anywhere`.
- **Tipo** en una segunda línea (`display: block`), `--muted`, `--text-xs`
  (12 px), 1,4, separado del nombre por tamaño y línea, no solo por color.
- Alto mínimo de 32 px; padding `6px 8px`; radio `--radius-sm`; `cursor:
  pointer`. La opción puede crecer en alto según el nombre.
- El icono no se anuncia; el tipo forma parte del nombre de la opción, que se
  lee «Nombre Tipo» (el `display: block` del tipo introduce la separación).
- Las fichas archivadas y en borrador se listan igual que hoy y **no** añaden
  insignia de estado en la opción: el popup mantiene la paridad con el diálogo
  de enlace y no introduce un tercer dato por fila.

### 3.4 Nombre largo (C15)

Un nombre de 120 caracteres **no se trunca**: envuelve con `overflow-wrap:
anywhere` y la opción crece en líneas. No se usa `line-clamp`, ni elipsis, ni
`title` como sustituto. El popup mantiene su altura máxima y su scroll, de modo
que el layout no se rompe. El nombre completo está siempre en el DOM y a la
vista. El límite de «dos líneas» del plan se refiere al nombre normal más el
tipo; ante un nombre largo manda la regla de no truncar.

### 3.5 Opción activa (C16)

- Fondo `--accent-surface`, texto `--accent-strong` (nombre y tipo) y **barra
  interior inicial de 3 px `--accent-strong`** (`box-shadow: inset 3px 0 0`),
  presente como transparente en todas las opciones para no desplazar el texto.
- El nombre pasa a peso 600. `aria-selected="true"` es la fuente de verdad.
- El indicador no es solo cromático: barra de posición + peso + `aria-selected`.
  La barra usa `--accent-strong` (8,36:1 y 6,74:1 frente a 6,54:1 y 5,44:1 de
  `--accent`), coincide con el color del texto activo y supera 3:1 como
  componente gráfico en ambos temas.
- El ratón actualiza la opción activa al pasar por encima; no hay estilo de
  hover distinto del activo. `onMouseDown` con `preventDefault()` para que el
  foco no salga del editor; el clic inserta.

### 3.6 Estados vacíos (C17)

| Caso | Texto visible | Anuncio `aria-live` | Lista |
|---|---|---|---|
| Sin coincidencias | «No hay fichas que coincidan.» en `--muted`, 13 px, dentro del popup, fuera del `listbox` | el mismo texto | `listbox` vacío |
| Sin candidatas (mundo vacío o solo la ficha actual) | «Todavía no hay fichas que mencionar en este mundo.» | el mismo texto | `listbox` vacío |
| Resultados limitados | La lista muestra 8 | «8 de 40 fichas» | 8 opciones |

- El popup no colapsa con el vacío: alto mínimo 48 px y mismo padding.
- El texto vacío no es una `option`, no recibe foco y no se puede activar con
  `Enter`.
- **No hay estado de carga ni de error** en el popup: las candidatas ya están
  cargadas en memoria y el filtrado es síncrono. No se inventa un spinner ni un
  error de red.

### 3.7 Anuncio de resultados (C18)

- Nodo `role="status"`, `aria-live="polite"`, `aria-atomic="true"`,
  visualmente oculto (`.wc-visually-hidden`), **siempre montado en edición** para
  que el anuncio sea fiable.
- Anuncia al abrir y cuando cambia el conjunto de resultados: recuento con
  `mentionResults(count)` o `mentionResultsLimited(shown, total)`; en vacío,
  `mentionEmpty` o `mentionNoEntities`. No repite el mismo texto dos veces.
- Tono del microcopy: frase corta, en español, sin jerga, con punto final en las
  frases y sin punto en los recuentos.

---

## 4. Patrón accesible y teclado

### 4.1 Atributos del editor (C19)

En **edición**, el nodo de ProseMirror (`.ProseMirror.wc-editor__content`) lleva
siempre:

| Atributo | Valor |
|---|---|
| `role` | `combobox` |
| `aria-expanded` | `"true"` o `"false"`, **siempre presente** |
| `aria-controls` | id del `listbox`, **siempre presente** |
| `aria-autocomplete` | `list` |
| `aria-label` | «Descripción» (`entities.detail.descriptionLabel`) |
| `aria-activedescendant` | solo con una opción activa; se retira si no hay |
| `tabindex` | `0` |

- **Sin `aria-multiline` en edición.** Es la restricción de axe para `combobox`
  y una decisión registrada en el ADR 0026.
- **Sin `aria-owns`:** la relación se expresa con `aria-controls`.
- El `listbox` **existe siempre en edición**, vacío y con `hidden` cuando está
  cerrado; su `id` es estable por editor. La regla `.wc-mention__list[hidden] {
  display: none }` es obligatoria: `display: flex` anularía el atributo.
- El `listbox` es hermano del `combobox`, no hijo; `aria-controls` los une.
- El popup cerrado no deja `aria-activedescendant` ni opciones enfocables.

En **lectura** se retiran `role`, `aria-label`, `aria-expanded`,
`aria-controls`, `aria-activedescendant`, `aria-autocomplete`, `tabindex` y no se
monta ni el popup ni el `listbox`. El nombre de la región lo aporta el `h3` de
la sección (contrato de #129).

### 4.2 Teclado y foco (C20)

| Tecla | Selector abierto con resultados | Selector abierto sin resultados | Selector cerrado |
|---|---|---|---|
| `↓` / `↑` | Opción siguiente / anterior con envoltura | No se intercepta | No se intercepta |
| `Inicio` / `Fin` | Primera / última opción | No se intercepta | No se intercepta |
| `Enter` | Inserta la opción activa | Comportamiento normal (nuevo párrafo) | Normal |
| `Tab` | Inserta y cierra; no mueve el foco | Mueve el foco normalmente | Normal |
| `Shift+Tab` | Cierra y mueve el foco hacia atrás | Igual | Normal |
| `Escape` | Cierra sin insertar y **conserva el texto** | Igual | No se intercepta |
| `Ctrl/Cmd+Z` | No se intercepta; una inserción = un paso de deshacer | — | Normal |

- El foco **permanece en el editor** durante toda la navegación; nunca se mueve
  a una opción. `Tab` con resultados hace `preventDefault` y luego inserta.
- `Escape` no borra el disparador ni la consulta: el usuario puede deshacer.
- Ninguna tecla se intercepta con el selector cerrado. Con el selector abierto
  solo se interceptan las de la tabla.
- Al insertar, el cursor queda tras un espacio **sin marca de enlace**, para
  que lo que se escriba después no herede el enlace; si el texto siguiente ya
  empieza por espacio, no se duplica.

### 4.3 Composición (C21)

Durante una composición IME (`view.composing`) no se interceptan teclas ni se
llama a `preventDefault`; `compositionstart` cierra el popup. Los disparadores
se detectan leyendo el documento, nunca la tecla, para no romper AltGr ni las
distribuciones del teclado.

### 4.4 Enlaces y menciones en el texto (C22)

- Una mención es un enlace interno normal: texto = nombre de la ficha, `href`
  `wc-entity://<uuid>`. No hay un tipo visual distinto de enlace.
- En edición, el enlace va en `--accent` con subrayado; el clic simple coloca el
  cursor y `Ctrl/Cmd+clic` navega. «Abrir enlace» del menú «Formato» es la
  alternativa de teclado.
- En lectura, el enlace va en `--accent-strong`, sin subrayado adicional al
  actual, y el clic normal navega.
- No se abre el selector dentro de una marca de enlace; si el usuario escribe
  `@` ahí, el texto se inserta pero el popup no aparece.

---

## 5. Modo lectura

### 5.1 Reglas (C23)

- Sin barra, sin menú «Formato», sin popup, sin `listbox` y sin atributos de
  formulario (C19).
- El documento conserva la tipografía y la medida de #129: `--font-content`,
  18 px, 1,7, 68ch, sin borde, sin fondo y sin scroll propio.
- Un clic normal en un enlace interno navega; no hay `Ctrl/Cmd+clic` en lectura.
- No se pinta ayuda de menciones ni de formato en lectura; la ayuda pertenece a
  la edición.

---

## 6. Tokens, contraste y temas

### 6.1 Solo roles existentes (C24)

Ningún color literal. Los componentes usan exclusivamente:

`--surface`, `--surface-raised`, `--surface-sunken`, `--border`, `--fg`,
`--muted`, `--accent`, `--accent-strong`, `--accent-surface`, `--focus`,
`--disabled-surface`, `--disabled-text`, `--shadow-2`, `--radius-sm`,
`--radius-md`, `--space-1`…`--space-6`, `--text-xs`…`--text-base`, `--font-ui`,
`--motion-fast`, `--ease-out`, `--z-tooltip`.

| Pieza | Superficie | Texto / icono | Borde / indicador |
|---|---|---|---|
| Barra | `--surface` | `--fg` | `--border`; divisor interior |
| Botón reposo | transparente | `--fg` | — |
| Botón hover / activo | `--surface-sunken` | `--fg` | — |
| Botón conmutado | `--accent-surface` | `--accent-strong` | barra inferior `--accent-strong` |
| Botón deshabilitado | `--disabled-surface` | `--disabled-text` | — |
| Foco | — | — | `--focus` 2+2 px |
| Menú | `--surface-raised` | `--fg` | `--border`, `--shadow-2` |
| Ítem de menú comprobado | — | check `--accent-strong` | check de 16 px |
| Ítem deshabilitado | transparente | `--disabled-text` | — |
| Popup | `--surface-raised` | — | `--border`, `--shadow-2` |
| Opción | transparente | nombre `--fg`, tipo `--muted`, icono `--muted` | barra inicial transparente |
| Opción activa | `--accent-surface` | `--accent-strong` | barra inicial 3 px `--accent-strong` |
| Vacío | `--surface-raised` | `--muted` | — |

### 6.2 Parejas de contraste del editor (C25)

Este contrato fija cinco parejas para la tabla §4.5 del sistema y para
`CONTRAST_PAIRS` de `tests/unit/design-tokens.test.ts`. Tres ya se comprueban
(la de `--muted` sobre `--surface-raised` solo como gráfico y debe subir a 4,5);
`--accent` y `--disabled-text` sobre `--surface-raised` son nuevas:

| Pareja | Uso | Claro | Oscuro | Mínimo |
|---|---|---:|---:|---|
| `--fg` sobre `--surface-sunken` | Botón y ítem de menú en hover/activo | 12,87:1 | 17,15:1 | 4,5:1 |
| `--accent-strong` sobre `--accent-surface` | Botón conmutado y opción activa | 8,36:1 | 6,74:1 | 4,5:1 |
| `--accent` sobre `--surface-raised` | Enlace en edición | 7,78:1 | 6,74:1 | 4,5:1 |
| `--muted` sobre `--surface-raised` | Tipo de la opción, texto vacío | 5,58:1 | 6,51:1 | 4,5:1 |
| `--disabled-text` sobre `--surface-raised` | Ítem de menú deshabilitado | 5,58:1 | 6,51:1 | 4,5:1 |

Parejas ya cubiertas que este contrato reutiliza: `--fg` sobre `--surface` y
`--surface-raised`, `--muted` sobre `--surface` y `--surface-sunken`, `--accent`
sobre `--accent-surface`, `--focus` sobre `--surface` y `--surface-raised`,
`--fg` sobre `--selection`, `--disabled-text` sobre `--disabled-surface` y
`--border-strong` sobre `--surface` para cualquier límite interactivo.

### 6.3 Matriz de temas (C25)

| Pieza | Claro | Oscuro |
|---|---|---|
| Barra | `--surface` #fbfaf7 con texto #222723 | `--surface` #1b1f1c con texto #f6f4ef |
| Conmutado | `--accent-surface` #e3eee7 con `--accent-strong` #244a38 | `--accent-surface` #223a2d con `--accent-strong` #9acbaf |
| Campo | `--surface-raised` #ffffff | `--surface-raised` #222723 |
| Menú y popup | #ffffff, borde #e1ddd2, sombra suave | #222723, borde #343b36, sombra profunda |
| Opción activa | #e3eee7 / #244a38 | #223a2d / #9acbaf |
| Deshabilitado | #efece4 / #626a64 | #141715 / #a3aca5 |

- Nada queda invisible: ninguna pareja usa `--border` como texto ni `--muted`
  sobre `--selection` en Claro.
- El escalón de superficie sostiene la jerarquía en Oscuro; la sombra solo
  remata.
- El color nunca es el único indicador (barra interior, check, peso,
  `aria-pressed`, `aria-checked`, `aria-selected`).

---

## 7. Ventana

### 7.1 Matriz (C26)

| Ventana | Documento (panel abierto) | Barra | Popup |
|---:|---:|---|---|
| 1024×700 | 736 px (panel apilado) | ≈255 px, una fila | 352 px, clamp a 24 px; voltea si no cabe |
| 1280×800 | 638 px (panel 320) | igual, una fila | igual |
| 1600×900 | 958 px (panel 320) | igual, una fila | igual |

- `document.documentElement.scrollWidth <= window.innerWidth` y
  `document.body.scrollWidth <= window.innerWidth` en los tres anchos, con panel
  abierto y cerrado y en ambos temas.
- El popup es `position: fixed`: no crea scroll de página ni lo recorta el
  `overflow` del editor. Se cierra al desplazar o redimensionar.
- Un nombre de ficha de 120 caracteres y un tipo de 40 no desbordan la opción ni
  el popup; la lista hace scroll interno.
- La barra no se envuelve ni se desplaza horizontalmente en ningún ancho.

---

## 8. Movimiento

### 8.1 Reglas (C27)

- Apertura del popup: solo **opacidad**, 120 ms (`--motion-fast`), `--ease-out`.
  Sin desplazamiento, sin escala y sin rebote. El menú «Formato» conserva el
  comportamiento actual (aparición instantánea).
- El chevron de «Formato» gira 180° en 120 ms al abrir; es la única transición
  del disparador.
- `scrollIntoView` de la opción activa es `{ block: 'nearest' }`, nunca suave.
- Con `prefers-reduced-motion: reduce`: sin transición de apertura, sin giro
  animado del chevron y sin desplazamiento animado del listbox. La regla global
  de `base.css` debe bastar; no se añade animación que la esquive.

---

## 9. Textos

### 9.1 Claves nuevas en `entities.editor` (C28)

Español, claves tipadas, sin cadenas en componentes.

| Clave | Tipo | Texto exacto |
|---|---|---|
| `format` | `string` | `Formato` |
| `formatMenu` | `string` | `Formato del texto` |
| `paragraph` | `string` | `Párrafo` |
| `mention` | `string` | `Mención` |
| `mentionListLabel` | `string` | `Fichas para mencionar` |
| `mentionEmpty` | `string` | `No hay fichas que coincidan.` |
| `mentionNoEntities` | `string` | `Todavía no hay fichas que mencionar en este mundo.` |
| `mentionResults` | `(count: number) => string` | `1 ficha` / `${count} fichas` |
| `mentionResultsLimited` | `(shown: number, total: number) => string` | `${shown} de ${total} fichas` |
| `mentionHint` | `string` | `Escribe @ o [[ en el texto y elige una ficha.` |

### 9.2 Actualización de `entities.detail` (C28)

| Clave | Texto exacto |
|---|---|
| `descriptionHint` | `Formato básico y enlaces internos. Escribe @ o [[ para mencionar una ficha; Enter inserta y Escape cierra el selector. Ctrl+clic abre un enlace.` |

### 9.3 Claves reutilizadas

`heading1`, `heading2`, `heading3`, `bulletList`, `orderedList`, `quote`,
`link`, `linkOpen`, `linkRemove`, `linkTitle`, `linkLead`, `linkSearch`,
`linkEmpty`. `bold` y `italic` nombran los dos primeros botones; `boldShort` y
`italicShort` son los glifos. El nombre del editor para el `toolbar` sigue siendo
`editor.label`.

- `link` («Enlace a una ficha») es el nombre accesible del cuarto botón.
- `linkOpen` y `linkRemove` son los ítems del tercer bloque del menú y no
  aparecen en la barra.
- Los plurales se resuelven en el catálogo, no en los componentes.

---

## 10. Estados completos

| Estado | Barra | Menú | Popup | Foco / ARIA |
|---|---|---|---|---|
| Edición en reposo | 5 controles, B/I en reposo | cerrado | cerrado, `listbox` `hidden` | `combobox` con `aria-expanded="false"` |
| Escribiendo | B/I reflejan la selección | cerrado | cerrado | igual |
| Con un enlace bajo el cursor | Enlace normal | Abrir/Quitar habilitados al abrir | — | `isActive('link')` |
| Menú abierto | Formato con `aria-expanded="true"` | ítem activo con foco | cerrado | foco en el ítem, no en el editor |
| Menú con enlace deshabilitado | — | Abrir/Quitar en `--disabled-text` | — | ítems no enfocables |
| Popup con resultados | — | cerrado | 8 máximo, opción activa | foco en el editor, `aria-activedescendant` |
| Popup sin coincidencias | — | cerrado | texto de vacío, lista vacía | `aria-expanded="true"`, sin `activedescendant` |
| Sin candidatas | — | cerrado | texto propio | igual |
| Nombre de 120 caracteres | — | — | opción multilínea, lista con scroll | nombre completo accesible |
| Popup volteado | — | — | por encima del cursor | igual |
| Lectura | sin barra | no existe | no existe | sin atributos de formulario |
| Deshabilitado | controles en `--disabled-surface` | — | — | `disabled` |

No se diseñan estados de carga ni de error del popup: las candidatas son
locales y síncronas. El error de guardado sigue su contrato en la ficha (#129).

---

## 11. Decisiones para el ADR 0026

`documentation-sync` redacta el ADR con este resumen; no se crea aquí.

1. **Typeahead con plugin propio sobre `@tiptap/pm`**, sin añadir
   `@tiptap/suggestion`: dos disparadores, control de límites y accesibilidad
   propia; cero dependencias nuevas.
2. **Barra mínima permanente de cinco acciones + menú «Formato».** Corrige la
   formulación «sin barra de herramientas permanente» del sistema v2; lo que se
   retira es la barra extensa y la segunda fila.
3. **Patrón combobox/listbox en un contenteditable:** `role="combobox"`,
   `aria-expanded` y `aria-controls` siempre, `listbox` persistente, sin
   `aria-multiline`; foco siempre en el editor.
4. **Semántica de inserción:** texto + marca `link` `wc-entity://<uuid>` + espacio
   sin marca, en una sola transacción; sin HTML; `]]` no se acepta como cierre
   (el `]` invalida la consulta y el selector se cierra sin insertar).
5. **Universo de menciones:** las 200 fichas ya cargadas, incluidas archivadas y
   borradores, con paridad con el diálogo de enlace; la búsqueda asíncrona queda
   como follow-up.
6. **Descartados:** burbuja de selección (`BubbleMenu`) y comandos de barra
   (`/`), por dependencia, duplicación y colisión con la prosa.

---

## 12. Riesgos y decisiones abiertas

- **`aria-multiline` retirado.** El editor es multipárrafo, pero el rol
  `combobox` no admite `aria-multiline`. Se acepta por axe y por el patrón
  elegido; conviene una comprobación manual con NVDA en QA.
- **Listbox siempre montado.** Es necesario para `aria-controls` permanente;
  debe ocultarse con `hidden` **y** con `display: none` para no quedar en el
  árbol de accesibilidad.
- **`]]` sin cierre.** Documentado y probado; si se adopta en el futuro, exige
  una nueva decisión de producto y un ADR.
- **200 fichas.** En mundos grandes la búsqueda es parcial; limitación conocida
  y follow-up.
- **Mundo sin candidatas.** El vacío explica el caso pero no ofrece «Crear
  ficha»; fuera de alcance. Se debe al universo ya cargado y a la exclusión de
  la ficha actual.
- **Mención dentro de un enlace.** El botón sale del enlace antes de insertar;
  el teclado no abre el selector dentro de una marca. Comportamiento probado.
- **Cambio de superficie del editor.** La barra y el campo pasan a ser una sola
  pieza; en lectura se mantiene el documento sin marco de #129.

---

## 13. Correcciones vinculantes C1–C28

Las severidades altas bloquean la puerta de UI.

| # | Sev. | Corrección | Verificación |
|---|---|---|---|
| C1 | Alta | La barra mínima de cinco acciones es **permanente en edición**; se corrige «sin barra de herramientas permanente» en el sistema y en el ADR. | §10.6 y tabla de componentes actualizadas; la barra sigue visible al perder el foco y al hacer scroll. |
| C2 | Alta | Exactamente cinco acciones en el orden Negrita, Cursiva, Formato, Enlace, Mención; las avanzadas solo en «Formato»; el botón Mención inserta `@` y abre el mismo selector. | Test de componente: 5 controles; «Lista con viñetas» y «Cita» no son de primer nivel; el botón Mención deja `aria-expanded="true"`. |
| C3 | Alta | B, I, Formato, eslabón y @ con las formas descritas; Enlace y Mención solo icono con nombre accesible y sin texto visible; Mención con tooltip `mentionHint`. | Test: nombres accesibles; ningún texto visible en los botones 4 y 5; tooltip de Mención. |
| C4 | Media | 32×32, barra de 40 px, gap 4, divisor de 1×20 entre Cursiva y Formato, ancho ≈255 px. | Medidas computadas; el ancho de la fila no supera 260 px. |
| C5 | Media | Barra y campo como una sola superficie (`--surface` + `--surface-raised`, esquinas compartidas, sin sombra); lectura sin marco. | Captura en ambos temas; el campo no tiene sombra y las esquinas coinciden. |
| C6 | Alta | Estados de §1.6; conmutado con barra inferior de 2 px `--accent-strong`, no solo color; deshabilitado sin `opacity`. | `aria-pressed` y estilo conmutado; deshabilitado con `--disabled-text`/`--disabled-surface`. |
| C7 | Alta | Una sola fila a 1024/1280/1600: `flex-wrap: nowrap` y sin scroll horizontal. | Captura y `scrollWidth` a los tres anchos; altura de la barra 40 px. |
| C8 | Alta | Tres bloques con los roles de §2.1; Párrafo/T1–T3 `menuitemradio`, listas y cita `menuitemcheckbox`, enlace `menuitem`. | Test: roles y `aria-checked` correctos al mover el cursor. |
| C9 | Media | Ranura de check de 16 px reservada; check `--accent-strong` solo en comprobados; `aria-checked`. | El texto del ítem no se mueve entre estados; check visible en captura. |
| C10 | Alta | Abrir/Quitar enlace deshabilitados fuera de un enlace; foco inicial en Párrafo; flechas con envoltura; Escape devuelve el foco al disparador; aplicar devuelve el foco al editor. | Teclado: `↓`, `Inicio`, `Fin`, `Escape`, `Enter`; `document.activeElement` es `.ProseMirror` tras aplicar. |
| C11 | Baja | Menú con las medidas y el posicionamiento del `Menu` existente, sin estilos nuevos de superficie. | Comparación con el menú `⋯`; clamp y volteo a 1024. |
| C12 | Alta | Reglas de disparo y cierre de §3.1; `@` tras letra y dentro de un enlace no abre; `[[` en cualquier posición. | Tests unitarios de la consulta y manual con AltGr+2. |
| C13 | Alta | Popup `fixed` anclado al cursor, 4 px, ancho 17–22 rem con clamp, volteo vertical, altura máxima con scroll, `--z-tooltip`. | A 1024, con el cursor en los cuatro extremos: no se recorta ni genera scroll. |
| C14 | Media | Anatomía de la opción: icono 16, nombre 14, tipo 12, alto mínimo 32, dos columnas con `min-width: 0`. | Captura en ambos temas; tipo separado del nombre. |
| C15 | Alta | Nombre de 120 caracteres sin truncar: envuelve, la opción crece y la lista hace scroll. | Test con 120 caracteres y tipo de 40; no hay elipsis ni `line-clamp`. |
| C16 | Alta | Opción activa con `--accent-surface`, `--accent-strong`, barra inicial de 3 px, peso 600 y `aria-selected`. | Cambiar con flechas mueve la barra; no hay desplazamiento del texto. |
| C17 | Media | Vacíos «No hay fichas que coincidan.» y «Todavía no hay fichas que mencionar en este mundo.»; popup de 48 px mínimo; sin estados de carga/error. | Tests de cero coincidencias y cero fichas; Enter no inserta. |
| C18 | Media | Región `status` `aria-live="polite"` siempre montada y oculta; recuentos con `mentionResults` y `mentionResultsLimited`. | axe y lector: se anuncia el recuento al abrir y al filtrar. |
| C19 | **Bloqueante** | Edición: `combobox` + `aria-expanded`/`aria-controls` siempre + `aria-autocomplete` + `aria-activedescendant` solo con opción + `tabindex`; **sin `aria-multiline`**; `listbox` siempre montado y `hidden` con `display: none`; sin `aria-owns`. | axe con el popup abierto y cerrado; en lectura no existe ningún atributo de formulario. |
| C20 | **Bloqueante** | Foco en el editor; tabla de teclado de §4.2; Escape no borra; Tab inserta; sin interceptar con el selector cerrado ni sin resultados. | Tests de teclado: flechas, Inicio/Fin, Enter, Tab, Shift+Tab, Escape, Ctrl+Z; el foco no sale del editor. |
| C21 | Alta | IME: no interceptar con `view.composing`; `compositionstart` cierra; el disparador se detecta en el documento. | Test manual con teclado español (AltGr+2) y con composición. |
| C22 | Media | Mención = enlace interno con texto = nombre; edición `--accent` + Ctrl/Cmd+clic; lectura `--accent-strong` + clic normal. | Clic simple en edición coloca el cursor; Ctrl+clic y lectura navegan. |
| C23 | Alta | Lectura sin barra, menú, popup, `listbox` ni atributos de formulario. | Test de lectura: no hay `role`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-autocomplete` ni `tabindex`. |
| C24 | Alta | Solo tokens de §6.1; sin colores literales ni roles nuevos. | Revisión de CSS y TSX; el test de tokens no encuentra hex fuera de la paleta. |
| C25 | **Bloqueante** | Cinco parejas documentadas en §4.5; en el test, añadir `--accent` y `--disabled-text` sobre `--surface-raised` y subir `--muted` sobre `--surface-raised` a 4,5. | Test de contraste en verde en ambos temas. |
| C26 | Alta | Matriz de ventana de §7.1; sin scroll de página; popup sin recorte; nombres largos sin desbordar. | `scrollWidth <= innerWidth` a 1024/1280/1600, panel abierto/cerrado, ambos temas. |
| C27 | Media | Opacidad de 120 ms sin desplazamiento; chevron 120 ms; scroll `nearest`; `prefers-reduced-motion` sin transición ni desplazamiento animado. | Emulación de movimiento reducido: apertura instantánea. |
| C28 | Alta | Claves y textos exactos de §9; `descriptionHint` actualizado; sin cadenas en componentes. | Typecheck del catálogo; revisión de textos; `linkEmpty` y `mentionEmpty` coinciden. |

---

## 14. Verificación antes de cerrar

- [ ] Barra de cinco acciones, una fila, a 1024, 1280 y 1600 px, en Claro y
      Oscuro.
- [ ] «Formato» con los tres bloques, roles, checks y enlaces contextuales.
- [ ] `@` y `[[` abren el popup; teclado completo; Escape no borra; Tab inserta.
- [ ] `aria-expanded` y `aria-controls` siempre; sin `aria-multiline`; listbox
      siempre montado y oculto con `display: none`.
- [ ] Lectura sin barra ni atributos de formulario; clic que navega.
- [ ] Nombre de 120 caracteres, 40 resultados, cero coincidencias y mundo sin
      fichas.
- [ ] Contraste de las cinco parejas de §6.2; §4.5 y el test actualizados.
- [ ] `prefers-reduced-motion` sin transición ni desplazamiento animado.
- [ ] axe sin violaciones críticas con popup y menú abiertos, en ambos temas.
- [ ] Sin scroll horizontal de página en los tres anchos con contenido largo.

## 15. Documentos relacionados

- [Sistema de diseño v2](sistema-de-diseno.md)
- [Contrato de la ficha #129](ficha-issue-129.md)
- [Contrato de relaciones #130](relaciones-issue-130.md)
- [Plan de desarrollo](../plan-desarrollo.md)
- [Registro de decisiones](../registro-decisiones.md)
