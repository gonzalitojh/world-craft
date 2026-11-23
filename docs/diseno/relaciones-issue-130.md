# Contrato de diseño — #130 «Relaciones legibles y grafo contextual»

> **Estado:** contrato visual y de accesibilidad aprobado por `ui-ux-designer`
> el 23/11/2026. **Vinculante para `tdd-ddd-architect`.** No implementa código de
> producción.
>
> **Precedencia.** Donde este documento contradiga el plan de
> `tasks/task-issue-130.json`, prevalece este contrato y el plan queda corregido
> por la lista C1–C16 de la sección 12 (la nota de corrección está registrada en
> el propio task file). Donde contradiga el sistema de diseño v2, prevalece el
> sistema.
>
> **Base normativa:** [`sistema-de-diseno.md`](sistema-de-diseno.md) §4.3, §4.5,
> §6, §7, §8, §11, §12 y §15, y los tokens reales de
> `src/renderer/styles/tokens/{palette,semantic,scales}.css`. No se añade ningún
> rol de color, ni hex, ni dependencia, ni icono de terceros.

## 0. Alcance y principios

La sección **Relaciones** de la ficha pasa de dos listas planas con botones
sueltos a una **red de lore legible**: dirección → tipo → entrada. El cambio es
de presentación e interacción; la API, el servicio, el esquema y los canales IPC
no se tocan. La sección sigue viviendo dentro de `DisclosureSection`
(`#wc-entity-section-relations`, `data-section="relations"`) y conserva su
cabecera, su recuento (`relationsMeta`) y sus acciones (`Añadir relación`,
`Tipos de relación`).

Siete reglas gobiernan el resto del documento:

1. **Dirección primero.** Salientes y backlinks son dos lecturas distintas y se
   distinguen por texto e icono, no por color.
2. **Tipo después, por etiqueta efectiva.** El grupo es lo que se lee en esta
   ficha; la etiqueta recíproca solo aparece cuando difiere.
3. **No es una tabla.** Sin `<table>`, sin roles de tabla, sin columnas fijas y
   sin tarjetas apiladas: una lista de entradas separadas por un divisor.
4. **Una acción visible por entrada.** Abrir la contraparte. Editar y eliminar
   viven en `⋯`; eliminar confirma en un diálogo modal.
5. **El foco no se pierde.** Alta, edición, borrado, reintento y cambio de grupo
   tienen destino de foco explícito (§6).
6. **Solo tokens existentes.** Cero hex, cero roles nuevos, cero fuentes nuevas.
7. **Sin grafo.** Mientras #83 no exista no hay enlace, botón, ítem deshabilitado,
   tooltip, texto ni clave de i18n de grafo (§8).

---

## 1. Principios de lectura

| Pieza | Regla | Por qué |
|---|---|---|
| **Red de lore, no tabla** | Entradas como unidades editoriales de dos o tres líneas, no como filas alineadas por columnas. | Una relación es una frase («Puerto Sal contiene a Mara Viento»), no un registro. |
| **Dirección → tipo → entrada** | `h4` de dirección, `h5` de tipo, `ul > li` de entradas. | El backlink no es una relación propia: debe leerse antes que ningún dato. |
| **Etiqueta efectiva** | El encabezado del grupo es la etiqueta que se lee **en esta ficha** (`relationForwardLabel` en salientes, `relationBackwardLabel` en entrantes). | Se lee lo que el usuario ve al abrir la ficha, no una etiqueta abstracta del tipo. |
| **Etiqueta recíproca** | Si difiere, se añade `Inversa: …` (salientes) o `Directa: …` (entrantes) en una línea secundaria. | La otra ficha usa otra palabra; ocultarla obliga a navegar para entender la relación. |
| **Tipos simétricos** | Si la recíproca coincide con la efectiva, no se repite. | «Relacionado con / Relacionado con» es ruido. |
| **Sobrescritura visible** | Si la etiqueta efectiva es una sobrescritura, el grupo añade `Tipo: <typeName>`. | Sin el tipo, una etiqueta libre («Aliada desde la infancia») pierde su identidad. |
| **Orden determinista** | Salientes → backlinks; grupos por etiqueta con `Intl.Collator`; entradas por nombre. | El orden no depende de `updatedAt` y no cambia entre sesiones. |
| **Densidad de escritorio** | Objetivos de 28–32 px, una sola columna, sin plegado anidado. | La sección ya es plegable; un segundo acordeón añade controles sin resolver nada. |
| **Sin truncar** | Nombres, etiquetas y notas envuelven (`overflow-wrap: anywhere`); nada esencial se corta con puntos suspensivos. | Una relación con el nombre cortado no se puede identificar. |

**Lo que no se hace:** plegar por tipo, numerar filas, mostrar el `id` de la
relación, usar `title` como única vía de lectura, ni pintar el color del tipo
como texto.

---

## 2. Árbol DOM semántico y orden de lectura

### 2.1 Árbol exacto

```text
div.wc-relations
├─ p.wc-page__section-lead                                «lead» (guía de lectura)
├─ p.wc-visually-hidden[role="status"][aria-live="polite"][aria-atomic="true"]
│        «Cargando las relaciones…»   (siempre montado; texto solo en carga)
└─ div.wc-relations__content[aria-busy]                   aria-busy solo en carga
   │
   ├─ [loading] div.wc-relations__loading[tabIndex="-1"]
   │            └─ 3 × Skeleton variant="text"  (40 %, 70 %, 55 %; aria-hidden)
   │
   ├─ [error] div.wc-alert.wc-alert--inline[role="alert"]
   │            ├─ p  «loadError»
   │            ├─ p.wc-page__note  «loadErrorHint»
   │            └─ div.wc-alert__actions > Button secondary sm «retry»
   │
   ├─ [empty] EmptyState headingLevel={4}
   │            ├─ h4  «emptyTitle»
   │            └─ p   «emptyDescription»
   │
   └─ [ready] div.wc-relations__directions
      ├─ section.wc-relation-direction[data-direction="outgoing"]
      │     aria-labelledby="<uid>-outgoing-heading"
      │     aria-describedby="<uid>-outgoing-lead"
      │  ├─ div.wc-relation-direction__head
      │  │  ├─ span.wc-relation-direction__icon[aria-hidden]   SVG 20 px
      │  │  ├─ h4#<uid>-outgoing-heading  «Desde esta ficha»
      │  │  └─ span.wc-relation-direction__count  «groupCount(n)»
      │  ├─ p.wc-relation-direction__lead#<uid>-outgoing-lead  «outgoingLead»
      │  └─ [grupos… | p.wc-relation-direction__empty  «outgoingEmpty»]
      │
      ├─ section.wc-relation-type-group[aria-labelledby][aria-describedby]
      │  ├─ div.wc-relation-type-group__head
      │  │  ├─ span.wc-type-mark.wc-type-color--<color>[aria-hidden]
      │  │  ├─ h5#<uid>-heading  etiqueta efectiva
      │  │  └─ span.wc-relation-type-group__count  «groupCount(n)»
      │  ├─ p.wc-relation-type-group__meta#<uid>-meta
      │  │  ├─ span  «groupInverse(label)» | «groupForward(label)»
      │  │  ├─ span[aria-hidden="true"]  «·»      (solo si hay dos piezas)
      │  │  └─ span  «groupType(typeName)»        (solo si hay sobrescritura)
      │  └─ ul.wc-relation-list
      │     └─ li.wc-relation-item[data-relation-id][data-direction]
      │        ├─ div.wc-relation-item__head
      │        │  ├─ div.wc-relation-item__identity
      │        │  │  ├─ span.wc-badge.wc-badge--neutral|accent.wc-relation-item__direction
      │        │  │  │  ├─ svg[aria-hidden]  icono de dirección (16 px)
      │        │  │  │  └─ span  «directionOutgoing» | «directionIncoming»
      │        │  │  ├─ button.wc-relation-item__target   (Button ghost sm)
      │        │  │  │  ├─ span.wc-relation-item__type-icon > TypeIcon   (16 px)
      │        │  │  │  └─ span.wc-relation-item__name    nombre completo
      │        │  │  ├─ span.wc-relation-item__sep[aria-hidden]  «·»
      │        │  │  └─ span.wc-relation-item__entity-type  «Ciudad»
      │        │  └─ div.wc-relation-item__side
      │        │     ├─ span.wc-relation-strength[role="img"][aria-label="Fuerza N de 5"]
      │        │     │  └─ span[aria-hidden]  5 marcas de forma (● / ○)
      │        │     └─ Menu label=«menuLabel» items=[editar, eliminar]
      │        └─ p.wc-relation-item__notes   (solo si hay notas)
      │
      └─ section.wc-relation-direction[data-direction="incoming"]   (misma estructura)
```

### 2.2 Reglas de semántica

- **Encabezados:** `h3` de sección (lo pone `DisclosureSection`) → `h4` de
  dirección → `h5` de tipo. El vacío global usa `h4`. No hay saltos hacia abajo.
- **Regiones con nombre:** cada `section` de dirección y de tipo lleva
  `aria-labelledby` a su encabezado. Las direcciones llevan además
  `aria-describedby` a su párrafo de guía; los grupos, a su línea de metadatos
  (cuando existe).
- **Listas reales:** `ul.wc-relation-list > li.wc-relation-item`. El `li` **no**
  es clicable entero: contiene controles y anidar un área pulsable crearía
  controles dentro de controles.
- **Nada de tabla:** prohibidos `<table>`, `role="table"`, `role="row"`,
  `role="grid"` y `role="cell"`.
- **Navegación interna:** el nombre de la contraparte es un `button` que llama a
  `onOpenEntity`, no un `a` con hash ni un enlace externo.
- **IDs:** los `id` de encabezado y descripción se generan con `useId()` dentro
  del componente de grupo o dirección; **nunca** se derivan de la etiqueta
  (puede tener 80 caracteres, acentos, comillas o espacios).
- **Datos para pruebas y CSS:** `data-section="relations"` (ya existe),
  `data-direction="outgoing|incoming"`, `data-relation-id` en cada `li`. No se
  usan como información accesible.

### 2.3 Orden de lectura y de tabulación

1. Guía de la sección (`lead`), solo texto.
2. Encabezado de dirección y su recuento.
3. Guía de la dirección.
4. Por cada grupo: marca (decorativa) → etiqueta del tipo → recuento → línea de
   metadatos.
5. Por cada entrada: insignia de dirección (no enfocable) → botón de la
   contraparte → tipo de entidad (texto) → fuerza (no enfocable, `role="img"`) →
   disparador `⋯`.
6. Siguiente grupo, siguiente dirección.

Dos paradas de tabulación por entrada. El orden visual y el del DOM coinciden:
no se usa `order` de CSS para reordenar nada.

---

## 3. Composición y anatomía

### 3.1 Cabecera de dirección

- Icono de 20 px (`--icon-md`) en `--muted`, `aria-hidden`.
- `h4` en `--font-ui`, `--text-md` (16 px), 600, `--fg`, interlineado
  `--leading-snug`, sin mayúsculas.
- Recuento en `--muted`, `--text-sm` (13 px), con `white-space: nowrap` y
  `flex: 0 0 auto`; si el título es largo, el recuento baja de línea.
- Guía de la dirección en `--muted`, `--text-sm`, máximo 68ch.
- **Decisión:** el título de dirección es interfaz, no contenido; por eso usa
  `--font-ui` y no la serif de la sección. La jerarquía se construye con el
  escalón 22 → 16 → 14 px y con 32 px de separación entre direcciones.

### 3.2 Cabecera de grupo

- Marca de tipo: `span.wc-type-mark.wc-type-color--<color>` (20 px, punto de
  8 px) `aria-hidden`. El color es decorativo; la etiqueta textual es el
  indicador real.
- `h5` en `--font-ui`, `--text-base` (14 px), 600, `--fg`; envuelve
  (`overflow-wrap: anywhere`) y no se trunca.
- Recuento a la derecha del título, en `--muted`, `--text-sm`.
- Línea de metadatos: `--muted`, `--text-sm`, 68ch máximo, piezas separadas por
  8 px y un `·` `aria-hidden`. Nunca se concatenan frases en el componente: cada
  pieza es una clave del catálogo.
- **Decisión:** el recuento va fuera del `h5` para que el nombre accesible del
  grupo sea la etiqueta, no «Ubicado en 3 relaciones».

### 3.3 Anatomía de la entrada

La entrada **no es una tarjeta ni una fila de tabla**. Es una unidad de lista:

| Zona | Contenido | Visible | Notas |
|---|---|---|---|
| Insignia de dirección | Icono + «Saliente» / «Backlink» | Sí | `Badge` neutral (saliente) o acento (backlink) |
| Contraparte | `TypeIcon` + nombre completo | Sí | `Button ghost sm` con aspecto de enlace; abre la ficha |
| Tipo de entidad | «Ciudad», «Personaje»… | Sí | Texto `--muted` 13 px tras un `·` |
| Fuerza | 5 marcas de forma | Sí | `role="img"`, `aria-label` «Fuerza N de 5» |
| Notas | Texto plano con saltos | Sí, si existen | `white-space: pre-wrap`, sin HTML |
| Menú `⋯` | Editar / Eliminar | Sí | 2 ítems; eliminar en tono peligro |
| Etiqueta recíproca | «Inversa: …» / «Directa: …» | Sí | En la cabecera del grupo, no en la entrada |
| Tipo del grupo | «Tipo: …» | Solo en sobrescrituras | En la línea de metadatos |
| `id` de la relación | — | No | Solo `data-relation-id` |

- **Dos líneas:** la principal (insignia, contraparte, tipo, fuerza, `⋯`) y las
  notas debajo. Sin tercera línea decorativa.
- **Sin superficie propia:** la entrada vive sobre `--bg` y se separa de la
  anterior con un divisor `1px --border` (`li + li`). La primera entrada no
  lleva divisor. Así la sección no crea una tercera superficie y no se encierra
  una tarjeta dentro de otra.
- **Nombre como enlace:** color `--accent-strong`, subrayado visible por defecto
  y `--fg` al pasar el ratón sobre `--surface-sunken`. Es la única acción
  visible y no depende del color: el subrayado y la condición de botón la
  identifican.
- **Dirección con texto e icono:** el chip nunca es solo color. «Saliente» usa
  `neutral`; «Backlink» usa `accent`, y ambos llevan la palabra dentro.
- **Fuerza por forma:** cinco glifos con relleno y contorno distintos, no un
  color. El nombre accesible está siempre presente.
- **Notas:** se leen completas; no hay «ver más», ni tooltip, ni recorte.

### 3.4 Qué vive en el menú y qué no

| Acción | Dónde | Por qué |
|---|---|---|
| Abrir la ficha contraparte | Botón visible (nombre) | Es la acción principal de la entrada. |
| Editar relación | Menú `⋯` | Secundaria, frecuente pero no primaria. |
| Eliminar relación | Menú `⋯`, tono peligro | Destructiva: nunca a un clic de distancia. |
| Abrir la ficha desde el backlink | Botón visible (nombre) | Misma acción; el origen ya es la contraparte. |
| Plegar por tipo | No existe | La sección ya es plegable (§1). |
| Ver en el grafo | No existe | #83 (§8). |
| Copiar, duplicar, mover | No existe | Fuera de alcance. |

---

## 4. Medidas, espaciado y tipografía

Solo tokens de `scales.css` y `semantic.css`. Las medidas en px/rem son
dimensiones del componente; no se crean tokens. **Sin hex nuevos.**

### 4.1 Tabla de tokens por pieza

| Pieza | Superficie | Texto / trazo | Borde | Radio | Espaciado | Tipografía |
|---|---|---|---|---|---|---|
| Sección `.wc-relations` | `--bg` | `--fg` | — | — | `gap: --space-6` | `--font-ui` |
| Guía de sección | `--bg` | `--muted` | — | — | 68ch máx. | `--text-base`, 1,5 |
| Contenido | `--bg` | — | — | — | `gap: --space-7` entre direcciones | — |
| Dirección | `--bg` | `--fg` | — | — | `gap: --space-3` | — |
| Icono de dirección | — | `--muted` | — | — | 20×20 | `--icon-md` |
| `h4` de dirección | `--bg` | `--fg` | — | — | — | `--text-md`, 600, 1,4 |
| Recuento | `--bg` | `--muted` | — | — | `--space-2` | `--text-sm` |
| Guía de dirección | `--bg` | `--muted` | — | — | 68ch máx. | `--text-sm`, 1,5 |
| Grupo | `--bg` | `--fg` | — | — | `gap: --space-2` | — |
| Marca de tipo | `--entity-*-surface` | `--entity-*` | — | `--radius-pill` | 20×20, punto 8 | — |
| `h5` de grupo | `--bg` | `--fg` | — | — | — | `--text-base`, 600, 1,4 |
| Metadatos del grupo | `--bg` | `--muted` | — | — | `gap: --space-2` | `--text-sm` |
| Entrada | `--bg` | `--fg` | top `1px --border` (salvo la primera) | — | `padding-block: --space-3`; `gap: --space-2` | — |
| Insignia de dirección | `--surface-sunken` / `--accent-surface` | `--fg` / `--accent` | — | `--radius-pill` | `--space-1 --space-3` | `--text-xs`, 500 |
| Icono de la insignia | — | heredado | — | — | 16×16 | `--icon-sm` |
| Nombre de contraparte | transparente (hover `--surface-sunken`) | `--accent-strong` (hover `--fg`) | transparente | `--radius-sm` | `--space-2` inline; mín. 28 de alto | `--text-base`, 500 |
| Tipo de entidad | `--bg` | `--muted` | — | — | `--space-2` | `--text-sm` |
| Separador «·» | `--bg` | `--muted` | — | — | — | `--text-sm` |
| Fuerza | `--bg` | `--accent-strong` | — | — | `letter-spacing: 0.12em` | `--text-sm` |
| Notas | `--bg` | `--fg` | — | — | 68ch máx.; `pre-wrap` | `--text-base`, 1,5 |
| Menú `⋯` | `--surface-raised` | `--fg`; peligro `--danger` | `1px --border` | `--radius-md` | primitiva `Menu` | primitiva `Menu` |
| Diálogo de borrado | `--surface-raised` | `--fg`; alerta `--danger-surface`/`--danger` | `1px --border` | `--radius-lg` | primitiva `Dialog` | primitiva `Dialog` |
| Esqueleto | `--skeleton` / `--skeleton-pulse` | — | — | `--radius-sm` | 3 barras | — |
| Foco | — | `--focus` | — | — | 2 px + 2 px | global `:focus-visible` |

### 4.2 Medidas exactas decididas

| Medida | Valor | Motivo |
|---|---|---|
| Separación entre direcciones | `--space-7` (32 px) | Es el mayor salto de la sección sin dibujar una caja. |
| Separación entre grupos | `--space-6` (24 px) | Separa tipos sin competir con las direcciones. |
| Separación cabecera de grupo → lista | `--space-2` (8 px) | La línea de metadatos ya separa. |
| Padding vertical de entrada | `--space-3` (12 px) | Ritmo denso de escritorio; dos líneas caben en ~88 px. |
| Separación interna de la entrada | `--space-2` (8 px) | La misma que el resto del sistema. |
| Cluster derecho (fuerza + `⋯`) | `gap: --space-1` (4 px) | El `⋯` ya tiene 32 px de caja. |
| Nombre de contraparte | `flex: 1 1 12rem`, `min-inline-size: 0` | Envuelve antes de empujar el cluster. |
| Identidad (insignia + nombre + tipo) | `flex: 1 1 18rem` | A 1024 sobra ancho; a 1280 con panel tampoco se rompe. |
| Notas | `max-inline-size: 68ch` | Ancho de lectura del sistema; el resto del ancho queda libre. |
| Objetivo del nombre | mínimo 28 px de alto | Mínimo de control del sistema. |
| Objetivo del `⋯` | 32×32 (por defecto de `IconButton`) | ≥28 y coherente con el resto de menús. |
| Acciones del diálogo | 32 px de alto (`Button md`) | Mínimo de control principal. |

### 4.3 Lo que se decide y por qué

1. **Sin tarjeta por entrada.** El plan permitía `--surface`; se descarta: la
   sección ya vive dentro de una sección plegable del documento y una tarjeta
   por relación devolvería el aspecto de listado de registros. El divisor
   `--border` es decorativo (1,23 / 1,57) y no informa.
2. **Nombre como enlace subrayado.** Da la affordance que antes daba el botón
   suelto «Editar», sin añadir controles.
3. **Dos tonos de insignia.** `neutral` para saliente y `accent` para backlink
   reutiliza parejas ya verificadas y no introduce color nuevo; el texto sigue
   siendo el indicador.
4. **Fuerza de solo forma + nombre accesible.** No se añade «4/5» visible: la
   forma ya distingue relleno de contorno y el lector de pantalla recibe el
   texto. Se evita una cuarta pieza tipográfica en la línea principal.
5. **Sin icono en el estado vacío.** El título y la explicación bastan; el vacío
   no compite con la cabecera de la sección.
6. **Sin `title` en nombres y etiquetas.** El texto completo está en el DOM; un
   tooltip sería la única vía de lectura para nadie y añadiría ruido.
7. **Clases nuevas, primitivas intactas.** `wc-relations__*`, `wc-relation-direction*`,
   `wc-relation-type-group*` y `wc-relation-item*` se declaran en
   `relations.css`. No se duplican estilos de `Button`, `Badge`, `Menu`,
   `Dialog`, `Skeleton` ni `EmptyState`; se reutilizan sus clases y solo se
   ajustan las piezas propias de la entrada. Se eliminan las reglas antiguas del
   panel que dejen de usarse, **salvo** `.wc-inline-confirm` (C12).

**Tokens que faltan:** ninguno. **Colores hardcodeados:** ninguno.

---

## 5. Estados, textos y claves de i18n

### 5.1 Matriz de estados

| Estado | Presentación | Accesibilidad | Foco |
|---|---|---|---|
| **Carga** | Guía visible; 3 barras `Skeleton variant="text"` (40 %, 70 %, 55 %) dentro de `div.wc-relations__loading[tabIndex={-1}]`. | `aria-busy="true"` en `.wc-relations__content`; `role="status"` **fuera** del contenedor ocupado, siempre montado, texto «Cargando las relaciones…». Los esqueletos ya son `aria-hidden`. | Sin foco forzado al entrar; el bloque de carga recibe el foco solo tras pulsar «Volver a intentar». |
| **Vacío** | `EmptyState headingLevel={4}`: «Todavía no hay relaciones» + explicación. Sin botón: la acción ya vive en la cabecera de la sección. | Región nombrada por su `h4`; sin secciones de dirección. | Sin foco forzado. |
| **Error de carga** | `.wc-alert.wc-alert--inline`: `loadError`, `loadErrorHint` y «Volver a intentar» (secundaria, `sm`). | `role="alert"`; si el reintento vuelve a fallar, el foco regresa al botón. | Reintento → bloque de carga enfocado (`tabIndex={-1}`, anillo visible); éxito → primera entrada, «Añadir relación» o el botón de la sección; fallo → botón de reintento. |
| **Listo con relaciones** | Direcciones y grupos descritos. | Encabezados y regiones con nombre. | — |
| **Pendiente** | Ítems del menú deshabilitados (`--disabled-text`, sin `opacity`); botón de envío con `loading` y `aria-busy`. El disparador `⋯` **sigue enfocable**. | No se anuncia dos veces: el botón conserva su nombre y el toast existente confirma. | Al empezar la petición, foco al cuerpo del diálogo (`tabIndex={0}`); ver §6. |
| **Error de mutación** | El diálogo no se cierra; alerta `role="alert"` con el texto de error; los datos introducidos se conservan. | `aria-invalid` + `aria-describedby` en los campos afectados. | Primer control inválido; si no hay, la alerta (`tabIndex={-1}`). |

### 5.2 Textos definitivos y claves (`entities.relations`)

**Nuevas o reescritas**

| Clave | Texto / firma |
|---|---|
| `lead` | `Cada relación se agrupa por dirección y tipo. La etiqueta del grupo se lee desde esta ficha; la recíproca, desde la otra.` |
| `outgoingLead` | `Relaciones que salen de esta ficha hacia otras.` |
| `incomingLead` | `Fichas que apuntan a esta. La etiqueta del grupo es la inversa de la relación.` |
| `directionOutgoing` | `Saliente` |
| `directionIncoming` | `Backlink` |
| `groupCount` | `(count: number)` — «1 relación» si vale 1; «N relaciones» si no |
| `groupInverse` | `(label: string)` — «Inversa: Contiene» |
| `groupForward` | `(label: string)` — «Directa: Ubicado en» |
| `groupType` | `(typeName: string)` — «Tipo: Ubicado en» |
| `openEntityNamed` | `(name: string)` — «Abrir la ficha Mara Viento» |
| `menuLabel` | `(label: string, name: string)` — «Acciones de la relación «Ubicado en» con Puerto Sal» |
| `editMenuItem` | `Editar relación` |
| `removeMenuItem` | `Eliminar relación` |
| `emptyTitle` | `Todavía no hay relaciones` |
| `emptyDescription` | `Una relación une esta ficha con otra del mundo y se lee en las dos. Empieza con «Añadir relación», en la cabecera de esta sección.` |
| `loadErrorHint` | `El resto de la ficha sigue disponible. Vuelve a intentarlo.` |
| `deleteError` | `No se pudo eliminar la relación. Inténtalo de nuevo.` |

**Reutilizadas sin cambios**

`title`, `outgoingTitle` («Desde esta ficha»), `incomingTitle` («Backlinks»),
`outgoingEmpty`, `incomingEmpty`, `add`, `manageTypes`, `removeTitle`,
`removeBody` («La relación desaparecerá de las dos fichas. Las fichas y sus datos
no se borran.»), `removeSubmit`, `strength`, `notesLabel`, `typeLabel`,
`typeHint`, `targetLabel`, `targetPlaceholder`, `searchLabel`,
`searchPlaceholder`, `noCandidates`, `noMatches`, `labelLabel`, `labelHint`,
`inverseLabelLabel`, `inverseLabelHint`, `strengthLabel`, `strengthOptions`,
`createTitle`, `createLead`, `editTitle`, `editLead`, `submitCreate`,
`submitEdit`, `cancel`, `created`, `updated`, `removed`, `error`, `loading`,
`loadError`, `retry`, `relationWith`, `types.*`.

**Retiradas** (solo las usaba el panel; ninguna otra vista las referencia)

| Clave | Sustituto |
|---|---|
| `empty` | `emptyTitle` + `emptyDescription` |
| `backlinkHint` | La insignia «Backlink» y la guía de la dirección |
| `edit`, `editNamed` | `editMenuItem` + `menuLabel` |
| `remove`, `removeNamed` | `removeMenuItem` + `menuLabel` |

**Reglas:** los plurales se resuelven en el catálogo; no se concatenan frases en
componentes (solo piezas completas separadas por un `·` decorativo). **No se crea
ninguna clave de grafo.**

---

## 6. Acciones, diálogos y foco

### 6.1 Menú `⋯`

- Se reutiliza `Menu` sin reimplementarlo: `Enter`/`Espacio`/`ArrowDown`/
  `ArrowUp` abren; flechas, `Inicio` y `Fin` recorren; `Escape` cierra y devuelve
  el foco al disparador; `Tab` cierra y también lo devuelve; clic fuera y scroll
  lo cierran; se posiciona respecto al viewport con 24 px de margen y elige el
  lado con espacio.
- `label` = `menuLabel(label, name)`; `align="end"`; **sin** `triggerTooltip`
  (el nombre accesible ya describe el disparador y el icono `⋯` es evidente).
- Ítems: `Editar relación` y `Eliminar relación` con `tone="danger"` en el
  segundo.
- **Mientras `pending`:** se pasan `disabled: true` a los dos ítems, no al
  disparador. Deshabilitar el `⋯` enfocado lo sacaría del árbol de foco.

### 6.2 Diálogo de borrado

- `RelationDeleteDialog` sobre la primitiva `Dialog` (modal nativo, velo, trampa
  de foco, `aria-labelledby` al título).
- Título: `removeTitle(label, name)` («¿Eliminar la relación «Ubicado en» con
  Puerto Sal?»). Se permite que envuelva: el `h2` ya lleva `overflow-wrap:
  anywhere` y el cuerpo tiene scroll propio. No se trunca.
- Cuerpo: `removeBody` (desaparece de las dos fichas; las fichas no se borran).
- Acciones: **Cancelar** (`ghost`, `data-autofocus`) y **Eliminar relación**
  (`danger`, `loading` mientras la petición está en curso).
- **Foco inicial en Cancelar**, nunca en la acción destructiva.
- `Escape` cancela y devuelve el foco al `⋯` (comportamiento nativo de
  `Dialog`). Con la petición en curso, el cierre está bloqueado (§C2).
- Error: el diálogo sigue abierto, la alerta `role="alert"` aparece bajo el
  cuerpo y el foco vuelve al botón destructivo para poder reintentar.

### 6.3 Mapa de foco vinculante

| Acción | Foco al terminar |
|---|---|
| Abrir el menú | Primer ítem habilitado (primitiva). |
| `Escape` en el menú | Disparador `⋯` de la misma entrada. |
| «Añadir relación» → cancelar | `#wc-entity-add-relation`. |
| «Añadir relación» → crear | `#wc-entity-add-relation` (la entrada nueva aparece en su grupo; no se persigue). |
| Editar → cancelar | `⋯` de la misma relación. |
| Editar → guardar, mismo grupo | `⋯` de la misma relación (`data-relation-id`). |
| Editar → guardar, **cambio de grupo** | `⋯` de la misma relación, ya en su grupo nuevo. Si la relación ya no existe, `#wc-entity-add-relation`. |
| Borrar → cancelar | `⋯` de la relación (sigue existiendo). |
| Borrar → confirmar | `⋯` de **la siguiente entrada en orden visible**; si no hay, de la anterior; si la lista queda vacía, `#wc-entity-add-relation`. |
| Borrar → error | El diálogo sigue abierto; foco en el botón destructivo; la alerta se anuncia. |
| Reintento de carga → al pulsar | Bloque de carga (`tabIndex={-1}`), con anillo visible. |
| Reintento de carga → fallo | Botón «Volver a intentar». |
| Reintento de carga → éxito | Botón de la primera contraparte; si no hay relaciones, `#wc-entity-add-relation`; si está deshabilitado, el botón de plegado de la sección. |

**Mecánica obligatoria (para no perder el foco con el DOM vivo):**

1. `Dialog` devuelve el foco al elemento activo al abrirse. Cuando ese elemento
   se desmonta (borrado, cambio de grupo), ese retorno es un no-op y el foco cae
   en `body`. El panel **no depende** de él: guarda una intención de foco
   (`{ kind: 'self' | 'next' | 'prev' | 'add', relationId? }`) y la resuelve en un
   efecto **posterior al commit** de la nueva lista, con `requestAnimationFrame`.
2. La búsqueda es `li[data-relation-id="…"] button[aria-haspopup="menu"]`; no se
   añaden `id` a `Menu` ni props nuevas a la primitiva.
3. «Siguiente» y «anterior» se calculan sobre el **orden visible aplanado**
   (salientes, sus grupos en orden, sus entradas en orden; después backlinks),
   con la lista anterior al borrado. Si el grupo desaparece, la siguiente
   entrada es la del grupo siguiente.
4. El diálogo de borrado conserva el objeto `RelationEdge` completo en estado,
   no un `id` que se busque en la lista nueva.
5. Los diálogos se montan condicionalmente (`open && …`), como hoy: evita estado
   obsoleto al pasar de editar una relación a otra.

### 6.4 Diálogo de alta y edición (ajustes acotados)

- Sin cambios de contrato de datos. Se añaden `id` estables
  (`wc-relation-type`, `wc-relation-target`), `aria-invalid` y
  `aria-describedby` a los campos con error, y se enfoca el primer inválido.
- Mientras `pending`: acciones bloqueadas, sin cierre accidental (C2) y foco en
  el cuerpo del diálogo si el botón pulsado se deshabilita.
- El error de envío se anuncia una sola vez: la alerta `role="alert"` no se
  duplica con un `aria-live` en el campo.

---

## 7. Backlinks

Un backlink es una arista entrante: la ficha actual es el destino. Se distingue
de forma **inequívoca y redundante**, nunca solo por color:

1. **Sección** `h4` «Backlinks» con su icono de entrada y su recuento.
2. **Guía** `incomingLead` que dice que la etiqueta del grupo es la inversa.
3. **Etiqueta del grupo** con la etiqueta efectiva en esta ficha y
   `Directa: …` cuando la del origen difiere.
4. **Insignia de cada entrada** «Backlink» (tono acento) con icono de entrada;
   las salientes llevan «Saliente» (tono neutro) con icono de salida.
5. **Nombre** de la ficha de **origen**, con `TypeIcon` y su tipo de entidad.
6. **Navegación:** el botón llama a `onOpenEntity(source.id)`. El destino es
   siempre la ficha que apunta a esta, no la actual. Sin enlaces externos ni
   hashes.

No se muestra el texto «Se lee desde X» por entrada (`backlinkHint` se retira):
repetiría seis veces lo que ya dicen la sección, la guía y la insignia.

---

## 8. Ausencia total de grafo

Mientras #83 no exista, la sección **no contiene**:

- botón, enlace, pestaña, ítem de menú, ítem deshabilitado, tooltip, insignia ni
  texto con la palabra «grafo» o equivalente;
- ninguna clave nueva de i18n (`graph`, `viewInGraph`, `openGraph`…);
- ninguna ruta, hash, `data-*` ni icono preparatorio;
- ninguna mención en la guía, el vacío ni la alerta de error.

La verificación es doble: revisión de que el `diff` no añade claves ni rutas, y
aserción E2E de que dentro de `[data-section="relations"]` no existe ningún
control ni nodo de texto cuyo nombre contenga «grafo». El grafo contextual
seguirá siendo una issue aparte.

---

## 9. Matriz de temas y contraste

Ratios WCAG 2.2 (sRGB) calculados sobre los valores reales de
`palette.css`/`semantic.css`. Texto normal ≥4,5:1; componentes, marcas y foco
≥3:1. Todos los pares de abajo **se cumplen en los dos temas**.

### 9.1 Parejas por pieza

| Pieza | Pareja | Claro | Oscuro | Mín. |
|---|---|---:|---:|---:|
| Guía, recuentos, metadatos, tipo de entidad | `--muted` / `--bg` | 5,07 | 7,74 | 4,5 |
| Títulos `h4`/`h5`, nombre, notas | `--fg` / `--bg` | 13,82 | 16,43 | 4,5 |
| Nombre (enlace) | `--accent-strong` / `--bg` | 9,05 | 9,92 | 4,5 |
| Nombre al pasar el ratón | `--fg` / `--surface-sunken` | 12,87 | 17,15 | 4,5 |
| Insignia «Saliente» | `--fg` / `--surface-sunken` | 12,87 | 17,15 | 4,5 |
| Insignia «Backlink» | `--accent` / `--accent-surface` | 6,54 | 5,44 | 4,5 |
| Fuerza | `--accent-strong` / `--bg` | 9,05 | 9,92 | 4,5 |
| Marca musgo | `--entity-moss` / `--entity-moss-surface` | 6,54 | 5,44 | 3 |
| Marca arena | `--entity-ochre` / `--entity-ochre-surface` | 3,64 | 6,69 | 3 |
| Marca terracota | `--entity-danger` / `--entity-danger-surface` | 5,36 | 7,07 | 3 |
| Marca pizarra | `--entity-prussian` / `--entity-prussian-surface` | 5,15 | 10,12 | 3 |
| Ítem de menú | `--fg` / `--surface-raised` | 15,19 | 13,82 | 4,5 |
| Ítem de menú al pasar el ratón | `--fg` / `--surface-sunken` | 12,87 | 17,15 | 4,5 |
| Ítem de menú peligroso | `--danger` / `--surface-raised` | 6,68 | 7,51 | 4,5 |
| Ítem peligroso al pasar el ratón | `--danger` / `--surface-sunken` | 5,65 | 9,32 | 4,5 |
| Ítem deshabilitado | `--disabled-text` / `--surface-raised` | 5,58 | 6,51 | — |
| Diálogo | `--fg` / `--surface-raised` | 15,19 | 13,82 | 4,5 |
| Alerta del diálogo | `--fg` / `--danger-surface` | 12,20 | 13,01 | 4,5 |
| Botón destructivo | `--danger-contrast` / `--danger` | 6,68 | 9,32 | 4,5 |
| Foco sobre la página | `--focus` / `--bg` | 7,08 | 9,92 | 3 |
| Foco sobre insignia hundida | `--focus` / `--surface-sunken` | 6,59 | 10,35 | 3 |
| Foco sobre menú/diálogo | `--focus` / `--surface-raised` | 7,78 | 8,34 | 3 |
| Foco sobre insignia de acento | `--focus` / `--accent-surface` | 6,54 | 6,74 | 3 |
| Divisor de entrada | `--border` / `--bg` | 1,23 | 1,57 | decorativo |

### 9.2 Reglas de tema

- **Nada interactivo se delimita con `--border`:** el divisor solo separa
  entradas; los controles que necesitan límite usan `--border-strong`
  (`Button secondary`, campos del diálogo).
- **El color nunca informa solo:** la marca de tipo es decorativa; la dirección
  y el backlink llevan palabra; la fuerza lleva forma y nombre accesible.
- **Sin `opacity`** en deshabilitados: `--disabled-text` sobre la superficie del
  menú.
- **No se intercambian papeles:** `--accent-surface`, `--surface-sunken` y
  `--danger-surface` son fondos; `--accent`, `--muted`, `--danger` y
  `--accent-strong` son texto o trazo.
- **Parejas a añadir a §4.5 y al test** (todas ya cumplen; hoy solo están en
  `design-tokens.test.ts` parcialmente): `--danger` sobre `--surface-raised`
  (6,68/7,51), `--danger` sobre `--surface-sunken` (5,65/9,32), `--focus` sobre
  `--surface-raised` (7,78/8,34) y `--accent-strong` sobre `--surface-sunken`
  (8,42/10,35). Ver C9.

---

## 10. Ventana, anchos y contenido largo

Rail expandido (240 px), padding del `main` de 24 px por lado y
`--wc-properties-width: 320px` por defecto.

### 10.1 Medidas reales

| Ventana | Ancho útil | Panel | Documento | Modo del panel |
|---:|---:|---|---:|---|
| 1024×700 | 736 | apilado | 736 | ≤1180: debajo del documento |
| 1280×800 | 992 | 320 (máx. 360) | 638 (598 con 360) | lateral, sticky |
| 1600×900 | 1312 | 320 (máx. 360) | 958 (918 con 360) | lateral, sticky |

La sección **no tiene punto de ruptura propio**: siempre es una columna. Lo que
cambia es el ancho disponible para envolver.

### 10.2 Comportamiento por ancho

| Ancho | Qué cambia en Relaciones |
|---|---|
| **1024** | Panel apilado: el documento conserva 736 px. Insignia, nombre, tipo, fuerza y `⋯` caben en una línea con nombres normales; los nombres largos envuelven dentro del botón. El cluster derecho baja de línea solo con nombres muy largos o etiquetas de 80. Sin scroll horizontal. |
| **1280** | Con panel abierto (638) el cluster derecho baja antes; la identidad se mantiene en una línea. Las notas se limitan a 68ch (~510 px) y dejan aire a la derecha. Con panel cerrado (992) la entrada respira. |
| **1600** | Con panel abierto (958) la entrada no gana columnas: el nombre y las notas siguen a la izquierda y el espacio libre a la derecha es deliberado. Sin tablas ni rejillas. Con panel cerrado (1312) se mantiene el ancho de lectura. |

### 10.3 Contenido de prueba y comprobaciones

Fixtures realistas (los legales por contrato de datos):

| Fixture | Valor | Dónde se prueba |
|---|---|---|
| Nombre de ficha | **120** caracteres sin espacios (`ENTITY_NAME_MAX_LENGTH`) | Componente + E2E (el máximo que acepta Zod). |
| Nombre sintético | **200+** caracteres sin espacios | Solo unidad y componente del modelo de vista/tarjeta (no pasa por IPC). |
| Etiqueta de relación | 80 caracteres sin espacios (`RELATION_LABEL_MAX_LENGTH`) | Componente + E2E. |
| Nombre de tipo | 80 caracteres | Unidad + componente. |
| Notas | 2.000 caracteres con párrafos (`RELATION_NOTES_MAX_LENGTH`) | Componente + E2E. |
| Relaciones | 500 (límite por defecto) | Unidad del modelo de vista. |

Comprobaciones obligatorias:

- `document.documentElement.scrollWidth <= window.innerWidth` y
  `document.body.scrollWidth <= window.innerWidth` con la sección abierta, panel
  de propiedades abierto y cerrado, y contenido largo, en 1024/1280/1600.
- Cada contenedor (`wc-relations`, `wc-relation-direction`,
  `wc-relation-type-group`, `wc-relation-item`) cumple
  `scrollWidth <= clientWidth + 1`.
- Prohibido `overflow-x: hidden` en `body`/`html` y en la sección.
- El menú `⋯` de la **última** entrada abre hacia arriba si no cabe y nunca
  genera scroll horizontal (primitiva `Menu`, 24 px de margen).
- Las notas de 2.000 caracteres crecen en vertical; no hay truncado ni
  desplazamiento horizontal.
- No se crea una tercera superficie: la entrada no tiene `background-color`
  propio (solo el hover del nombre).

---

## 11. Accesibilidad

### 11.1 Nombres accesibles

| Control | Nombre accesible | Estado / relación |
|---|---|---|
| Botón de contraparte | `openEntityNamed(name)` («Abrir la ficha Mara Viento») | Contiene el texto visible (2.5.3). |
| Menú `⋯` | `menuLabel(label, name)` | `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` cuando está abierto (primitiva). |
| Ítems del menú | «Editar relación» / «Eliminar relación» | `role="menuitem"`; `danger` en el segundo. |
| Fuerza | «Fuerza N de 5» | `role="img"`; marcas `aria-hidden`. |
| Sección de dirección | «Desde esta ficha» / «Backlinks» | `aria-labelledby`; `aria-describedby` a la guía. |
| Grupo de tipo | Etiqueta efectiva | `aria-labelledby`; `aria-describedby` a los metadatos. |
| Diálogo de borrado | `removeTitle(label, name)` | `aria-labelledby` del `Dialog`. |
| Botones del diálogo | «Cancelar» / «Eliminar relación» | «Cancelar» con `data-autofocus`. |
| Región de carga | «Cargando las relaciones…» | `role="status"` + `aria-live="polite"` + `aria-atomic`. |

No se usan `aria-label` en `div`/`span` sin rol, ni `tabIndex` en elementos no
interactivos (salvo el bloque de carga y los contenedores que reciben foco
programático, con `tabIndex={-1}`).

### 11.2 Teclado

| Tecla | Dónde | Acción |
|---|---|---|
| `Tab` / `Shift+Tab` | Página | Orden de §2.3; dos paradas por entrada. |
| `Enter` / `Espacio` | Nombre de contraparte | Abre la ficha. |
| `Enter` / `Espacio` / `↓` / `↑` | Menú `⋯` | Abre en el primer/último ítem. |
| `↑` / `↓` / `Inicio` / `Fin` | Menú abierto | Recorre los ítems habilitados. |
| `Escape` | Menú abierto | Cierra y devuelve el foco al `⋯`. |
| `Tab` | Menú abierto | Cierra y devuelve el foco al `⋯`. |
| `Escape` | Diálogo | Cancela (bloqueado mientras `pending`, C2). |
| `Enter` | «Cancelar» enfocado | Cancela sin borrar. |

Sin atajos globales nuevos. `Ctrl+S` sigue sin actuar con un diálogo abierto.

### 11.3 axe y foco visible

- Sin violaciones críticas ni graves en Claro y Oscuro, con la sección abierta,
  el menú abierto y el diálogo de borrado abierto, y con contenido largo.
- Riesgos vigilados: orden de encabezados (`h3→h4→h5`), `aria-describedby` a
  `id` existentes, `role="img"` con nombre, `role="alert"` único por estado,
  `aria-busy` fuera del `role="status"`, y ausencia de controles anidados.
- Foco visible: anillo global de 2 px `--focus` con 2 px de separación sobre
  `--bg`, `--surface`, `--surface-sunken` y `--surface-raised`; el anillo del
  nombre y del `⋯` no queda recortado (los contenedores no usan
  `overflow: hidden`).
- **Movimiento reducido:** no se añaden animaciones. Solo transiciones de color
  y fondo de 120 ms heredadas de `Button`/`Badge`, que la regla global de
  `base.css` anula con `prefers-reduced-motion: reduce`. El pulso del esqueleto
  se detiene por la misma regla.

---

## 12. Correcciones vinculantes C1–C16

| # | Sev. | Corrección | Archivo(s) | Verificación |
|---|---|---|---|---|
| C1 | **Bloqueante** | El `role="status"` de carga **no** puede vivir dentro del contenedor con `aria-busy="true"`: `aria-busy` suprime los anuncios de la región viva hasta pasar a `false`. Colocar el estado como hermano del contenido y poner `aria-busy` solo en `.wc-relations__content`. | `entity-relations-panel.tsx`, `relations.css` | El nodo `[role="status"]` no tiene ningún ancestro con `aria-busy="true"`; el texto se anuncia una vez al cargar. |
| C2 | **Bloqueante** | `Dialog` no permite bloquear el cierre: con `pending`, `Escape` cierra el diálogo nativo y el `X` también. Añadir a `Dialog` la prop opcional `dismissible?: boolean` (por defecto `true`): con `false` ignora `Escape` y el `X` se pinta `disabled`. Usarla en el diálogo de borrado y en el de alta/edición. Añadir `dialog.tsx` a la tabla de archivos del plan. | `dialog.tsx`, `relation-delete-dialog.tsx`, `entity-relation-dialog.tsx` | Con la petición en curso, `Escape` y el `X` no cierran; al terminar, el cierre vuelve a funcionar. Los demás diálogos no cambian. |
| C3 | **Bloqueante** | El retorno de foco de `Dialog` apunta al `⋯` que se desmonta al borrar o al cambiar de grupo. El panel debe restaurar el foco en un efecto posterior al commit, con `[data-relation-id] button[aria-haspopup="menu"]` y `requestAnimationFrame`, según §6.3; fallback `#wc-entity-add-relation`. | `entity-relations-panel.tsx`, `entity-detail-page.tsx` | `document.activeElement` es el `⋯` siguiente/anterior/el de alta tras borrar, y el de la misma relación tras guardar un cambio de tipo. |
| C4 | Alta | Al pulsar «Eliminar relación» o «Guardar relación», el botón enfocado pasa a `disabled` por `loading` y el foco cae en `body` dentro de un modal. Mover el foco al cuerpo del diálogo (`tabIndex={0}`, ya existe) al empezar la petición; en fallo, devolverlo al botón de acción. | `relation-delete-dialog.tsx`, `entity-relation-dialog.tsx` | Con `pending`, `document.activeElement` pertenece al diálogo; en fallo vuelve al botón; el foco nunca sale del modal. |
| C5 | Alta | No deshabilitar el disparador `⋯` con `pending`: se pierde el foco. Deshabilitar los **ítems** (`MenuItem.disabled`) y mantener el disparador enfocable. | `entity-relations-panel.tsx` | Con `pending`, el menú abre con dos ítems deshabilitados, `Escape` devuelve el foco al `⋯` y el foco nunca cae en `body`. |
| C6 | Alta | `ENTITY_NAME_MAX_LENGTH` es **120**: un E2E con nombre de 200+ no puede crearse (Zod lo rechaza). Usar 120 sin espacios en E2E y reservar 200+ para fixtures sintéticos de unidad/componente. | `tests/e2e/entities.spec.ts`, `tests/components/relations.test.tsx` | El E2E crea la ficha con 120 caracteres; la tarjeta demuestra 200+ sin romper en la prueba de componente. |
| C7 | Alta | `EmptyState.headingLevel` solo admite `2 \| 3`. Ampliarlo a `2 \| 3 \| 4` y mapear `4 → 'h4'`; el vacío dentro del `h3` de la sección usa `4`. | `empty-state.tsx`, `primitives.test.tsx` | `getByRole('heading', { level: 4, name: 'Todavía no hay relaciones' })`. |
| C8 | Media | Los `id` de `aria-labelledby`/`aria-describedby` se generan con `useId()` en la dirección y en el grupo; nunca con la etiqueta (80 caracteres, acentos, comillas). Cuando dos grupos comparten etiqueta efectiva, `aria-describedby` a la línea de metadatos los desambigua. | `entity-relations-panel.tsx`, `relation-card.tsx`, `relations.css` | Dos grupos con la misma etiqueta producen `id` únicos y descripciones distintas; `axe` sin `duplicate-id-aria`. |
| C9 | Media | Añadir a §4.5 del sistema y a `tests/unit/design-tokens.test.ts` las parejas que estrena la sección: `--danger` sobre `--surface-raised`, `--danger` sobre `--surface-sunken`, `--focus` sobre `--surface-raised` y `--accent-strong` sobre `--surface-sunken`. Ya cumplen (6,68/7,51 · 5,65/9,32 · 7,78/8,34 · 8,42/10,35). | `sistema-de-diseno.md`, `design-tokens.test.ts` | El test cubre las cuatro parejas en los dos temas. |
| C10 | Media | El reintento de carga desmonta la alerta y deja el foco en `body`. Enfocar el bloque de carga (`tabIndex={-1}`, anillo visible) al pulsar y aplicar el mapa de foco de §6.3 (fallo → reintento; éxito → primera contraparte, «Añadir relación» o plegado de la sección). | `entity-relations-panel.tsx` | Tras pulsar «Volver a intentar», el foco sigue dentro de la sección; al fallar vuelve al botón y al cargar cae en un control visible. |
| C11 | Media | Retirar `backlinkHint` y «Se lee desde X»: la dirección ya se comunica con sección, guía e insignia. No repetir seis veces el mismo dato por entrada. | `messages/es.ts`, `entity-relations-panel.tsx` | No existe el texto «Se lee desde»; el backlink se identifica por «Backlinks» + «Backlink» + navegación. |
| C12 | Media | No borrar `.wc-inline-confirm` de `components.css`: la comparten `entity-type-manager` y `relation-type-manager`. Solo se eliminan las reglas exclusivas del panel de relaciones. | `relations.css`, `components.css` | Los gestores de tipos siguen mostrando su confirmación en línea; el diff de CSS no toca `.wc-inline-confirm`. |
| C13 | Media | Montar los diálogos condicionalmente (`open && …`), como hoy. Mantener el objeto `RelationEdge` completo en el estado del borrado. Evita campos obsoletos al editar otra relación y títulos vacíos tras actualizar la lista. | `entity-detail-page.tsx`, `entity-relations-panel.tsx` | Editar A, cerrar, editar B: los campos muestran B; borrar y confirmar no produce errores de render. |
| C14 | Baja | Si una arista tiene `source.id === target.id` (autorelación), clasificarla **solo** como saliente (prevalece la regla 1) y contarla una vez. | `relation-groups.ts` | Una autorelación no se duplica en backlinks y `total` la cuenta una sola vez. |
| C15 | Baja | El nombre de la contraparte debe estar en el DOM completo, con `overflow-wrap: anywhere`, `min-inline-size: 0` y sin `title` como única vía. El subrayado identifica el botón sin depender del color. | `relation-card.tsx`, `relations.css` | Con 120 caracteres sin espacios no hay scroll horizontal y el texto íntegro está en el DOM. |
| C16 | Baja | La guía de sección y el vacío no pueden mencionar el grafo ni prometer una acción inexistente; el texto debe remitir a «Añadir relación», que sí existe. | `messages/es.ts` | La aserción de ausencia de «grafo» cubre también guía y vacío. |

**Otras decisiones registradas**

- No hay ADR: es una evolución de UI sobre tokens, primitivas y canales
  existentes.
- No se añaden dependencias ni iconos de terceros: los iconos de dirección son
  SVG inline propios (16 px, trazo 1,6, `currentColor`, `aria-hidden`), como
  `TypeIcon` y el icono de `Menu`.
- La puerta documental actualizó §4.5, §9, §10.5 y §17 del sistema de diseño;
  «Lista de relaciones» figura como implementada en #130 y «Nodo de grafo» sigue
  **Previsto** en #83.

---

## 13. Criterios de aceptación visual verificables

1. La sección contiene dos `section[data-direction]` con `h4` y, dentro,
   `section[aria-labelledby]` con `h5`; **cero** `table`, `role="table"`,
   `role="row"` y `role="cell"` dentro de `[data-section="relations"]`.
2. El grupo muestra `Inversa: …` en salientes y `Directa: …` en entrantes **solo**
   si difiere; un tipo simétrico no repite la recíproca; una sobrescritura añade
   `Tipo: …`.
3. Cada entrada tiene insignia con texto («Saliente»/«Backlink») y un botón cuyo
   nombre accesible es «Abrir la ficha <nombre>» y navega a la contraparte
   correcta (origen en backlinks).
4. La fuerza expone `role="img"` con «Fuerza N de 5» y cinco marcas de forma
   distintas; no hay ningún dato comunicado solo por color.
5. El menú `⋯` abre con teclado, contiene exactamente «Editar relación» y
   «Eliminar relación», y `Escape` devuelve el foco al disparador.
6. El borrado abre un modal con el foco inicial en **Cancelar**; `Escape`
   cancela sin llamar a `onRemove`; confirmar muestra `loading`, bloquea el
   cierre y, al terminar, deja el foco en la siguiente/anterior `⋯` o en
   «Añadir relación».
7. Editar una relación y cambiar su tipo (de grupo) deja el foco en el `⋯` de esa
   misma relación.
8. Carga: `aria-busy` en el contenido, `role="status"` fuera de él y esqueletos
   `aria-hidden`. Vacío: `h4` + descripción, sin botón duplicado y sin secciones
   de dirección. Error: `role="alert"` + reintento, con el foco gestionado.
9. Backlinks: sección «Backlinks», insignia «Backlink» y navegación al origen;
   no existe «Se lee desde».
10. No existe ningún control, texto ni clave de grafo (§8).
11. A 1024/1280/1600 px, panel abierto y cerrado, con nombre de 120, etiqueta de
    80 y notas de 2.000: sin scroll horizontal de página ni de contenedor; el
    texto íntegro está en el DOM y envuelve.
12. Claro y Oscuro: todas las parejas de §9.1 medidas; `axe` sin violaciones
    críticas ni graves con la sección, el menú y el diálogo abiertos.
13. Navegación completa por teclado con dos paradas por entrada y foco visible
    en todos los controles; `prefers-reduced-motion` sin animaciones propias.

---

## 14. Entrega al implementador

**Orden recomendado:** textos y `relation-groups.ts` → `RelationCard` → panel y
grupos → `RelationDeleteDialog` + `dismissible` en `Dialog` → foco (§6.3) →
ajustes del diálogo existente → `relations.css` → integración en la ficha → E2E.

**No entra:** vista de grafo (#83), editor (#131), preferencias persistentes
(#132), auditoría global (#133), gestor de tipos salvo que se detecte un defecto
de accesibilidad estrictamente relacionado.

**Manual de usuario (deltas para `documentation-sync`):**

- §6.1: lectura por dirección y tipo, etiqueta inversa/directa, «Tipo: …» en
  sobrescrituras y qué es un backlink.
- §6.2: menú `⋯`, edición y confirmación modal de borrado con «Cancelar».
- §6.4: el grafo sigue previsto; todavía no hay ninguna acción en la ficha.
- §17: estado de relaciones y grafo.
