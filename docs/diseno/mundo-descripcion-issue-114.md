# Descripción enriquecida del mundo (#114): contrato de interfaz

> **Estado:** aprobado el 2026-11-26. Contrato vinculante para `tdd-ddd-architect`,
> `qa-reviewer` y `documentation-sync` de la issue #114.
>
> **Base normativa:** `AGENTS.md`; `docs/diseno/sistema-de-diseno.md` §10.3 (vista
> de mundo) y §10.6 (editor); `docs/diseno/editor-issue-131.md` (contrato del
> editor compartido); tokens de `src/renderer/styles/tokens/`;
> `src/renderer/components/editor/*`; `world-form-dialog.tsx`; `world-page.tsx`;
> `src/renderer/messages/es.ts`.

## Decisiones cerradas

1. Se reutiliza `RichTextEditor` y su contrato de #131. **No se bifurca** el
   editor ni se crea un segundo sistema de menciones.
2. En **creación** de mundo no existen fichas: no se ofrecen enlaces ni
   menciones (ni botones ni disparadores de teclado). En **edición** se cargan
   las fichas del mundo. En **lectura** los enlaces navegan.
3. Dentro del diálogo modal **no se navega** a una ficha: ni `Ctrl+clic` ni
   «Abrir enlace». La navegación vive en la página del mundo.
4. La página del mundo sigue siendo un **marco de lectura**: no se añade
   «Editar descripción» ni edición en línea. Se mantiene el acceso por el menú
   `⋯` de la barra superior → **Editar**.
5. No se crean colores, sombras ni roles nuevos. El borde del editor dentro del
   formulario sube a `--border-strong` para cumplir 3:1 como control de
   formulario.
6. El editor del mundo mantiene la misma barra y el mismo menú «Formato» que el
   de fichas, incluidos Título 1–3.
7. **Límite de la descripción del mundo: 4.000 caracteres de texto plano**
   (límite vigente del producto). El contador y los errores se calculan sobre
   el texto extraído del documento, no sobre su JSON. El límite de JSON
   acompañante es `WORLD_DESCRIPTION_JSON_MAX_LENGTH = 200_000`.

## 1. Composición y jerarquía

### 1.1 Diálogo de crear/editar mundo

Orden de campos (sin cambios): nombre, identificador, resumen (textarea de 3
filas), **descripción (editor enriquecido)**, géneros, idioma, nota de portada,
error de guardado y estado vivo «Guardando el mundo…».

```text
┌─ Diálogo ancho (44rem, máx. 100vh − 48px) ─────────────────────────┐
│ Cabecera: título + cerrar                                         │
│ Cuerpo con scroll vertical:                                       │
│   Nombre                                                          │
│   Identificador                                                   │
│   Resumen                                                         │
│   Descripción                0 / 4.000 caracteres   ← etiqueta     │
│   ┌─ barra: B I │ Formato Enlace Mención ─────────────────────┐   │
│   │ contenido Tiptap, 10–20rem, scroll interno               │   │
│   └───────────────────────────────────────────────────────────┘   │
│   Ayuda de formato                                                │
│   [Estado de candidatas: cargando / error + Reintentar]           │
│   [Error de descripción: exceso o enlace inválido]                │
│   Géneros                                                         │
│   Idioma                                                          │
│   Nota de portada                                                 │
│   [Error de guardado, role=alert]                                 │
│ Pie fijo: Cancelar · Crear/Guardar                                │
└───────────────────────────────────────────────────────────────────┘
```

| Pieza | Valor |
|---|---|
| Diálogo | `wc-dialog--wide`, `inline-size: min(44rem, calc(100vw − 2 * var(--space-6)))`; no se cambia el ancho. |
| Cuerpo | `overflow-y: auto`; cabecera y pie fijos. |
| Editor en el formulario | `min-block-size: 10rem`, `max-block-size: 20rem`, scroll interno. |
| Barra | 40 px, una fila, `flex-wrap: nowrap`; ≈255 px con 5 controles; ≈170 px con 3. |
| Etiqueta y contador | Una fila, contador al final; envuelve si no cabe. |
| Ayuda | Debajo, `--text-sm`, `--muted`, máximo 68ch. |
| Error de campo | Debajo de la ayuda, `--danger`, `role="alert"`. |
| Error de guardado | Al final, `--danger-surface`, borde `--danger`, `role="alert"`; recibe foco. |

| Aspecto | Crear | Editar |
|---|---|---|
| Candidatas | Ninguna; el mundo aún no existe. | Las del mundo, cargadas al abrir. |
| Barra | Negrita, Cursiva, `│`, Formato. Sin Enlace ni Mención. | Negrita, Cursiva, `│`, Formato, Enlace, Mención. |
| Enlace/Mención | No se montan. | Deshabilitados mientras cargan o si falla la carga; habilitados al estar listas. |
| Menú Formato | Párrafo/Título 1–3, listas, cita y «Quitar enlace». Sin «Abrir enlace». | Igual, con «Quitar enlace» operativo. |
| Ayuda | «Formato básico. Podrás mencionar fichas cuando el mundo esté creado.» | «Formato básico y enlaces internos. Escribe @ o [[ para mencionar una ficha; Enter inserta y Escape cierra el selector. Los enlaces se abren desde la página del mundo.» |
| Rol | `textbox` multilínea. | `combobox` con listbox cuando las candidatas están listas; `textbox` mientras cargan o fallan. |

Se retira el `TextAreaField` de 6 filas y su `maxLength` nativo. El límite se
aplica sobre el texto plano extraído (4.000) con contador y error.

### 1.2 Página del mundo en lectura

```text
section.wc-page__section[aria-labelledby=summaryId]
  div.wc-section-heading
    h2.wc-page__section-title#summaryId   «Resumen»
    p.wc-page__section-meta                «N palabras» + cualificador oculto
  div.wc-world-description
    editor Tiptap en lectura, 68ch, sin barra ni marco
  div.wc-world-data
    h3 «Datos del mundo» + dl
```

- **Título:** «Resumen»; no se añade h3 «Descripción».
- **Metadatos:** recuento de palabras a la derecha del título, con texto
  oculto «Recuento de la descripción:». Solo si hay texto.
- **Acciones:** ninguna nueva; el vacío remite al menú `⋯` → **Editar**.
- **Contenido:** editor compartido en `readOnly`, sin barra, sin popover, sin
  atributos de formulario; enlaces internos con clic normal y Enter.
- **Vacío:** párrafo `wc-world-description wc-world-description--empty` con
  `worlds.detail.noDescription`, en `--font-ui`, 14 px, `--muted`, 68ch. No se
  monta un editor vacío.
- **Contenido largo:** sin truncar, sin «Leer más» y sin scroll propio; la
  página desplaza en vertical. Medida de 68ch.
- **Preparación:** «Descripción» se completa con `!descriptionEmpty`, no con
  `description !== null` a secas.

## 2. Estados

| Estado | Formulario | Página | Foco / ARIA |
|---|---|---|---|
| **Vacío** | Editor en blanco, etiqueta, contador `0 / 4.000`, ayuda. Sin placeholder dentro del editor. | Párrafo de vacío; sin metadatos ni editor. | No se anuncia error. |
| **Cargando candidatas** | Editor editable; Enlace y Mención deshabilitados; «Cargando las fichas del mundo…» con `role="status"`; `@`/`[[` no abren. | No aplica. | `textbox` multilínea; al terminar pasa a `combobox` sin recrear el editor. |
| **Error de candidatas** | Editor editable y guardable; Enlace/Mención deshabilitados; error + **Reintentar**; no bloquea el guardado. | No aplica. | `role="status"`, `aria-live="polite"`. |
| **Sin fichas en mundo existente** | Enlace/Mención habilitados; popover «Todavía no hay fichas que mencionar en este mundo.»; diálogo de enlace «No hay fichas que coincidan.». | Los enlaces existentes se leen y navegan. | Mensajes de #131. |
| **Guardando (`pending`)** | Editor deshabilitado; barra deshabilitada; Cancelar y cerrar deshabilitados; botón `aria-busy`; estado vivo «Guardando el mundo…». | No aplica. | No se roba el foco; Escape no cierra. |
| **Error de guardado** | Diálogo abierto; contenido intacto; error al final `role="alert"`; foco al error. | No aplica. | Se anuncia el fallo. |
| **Solo párrafos vacíos** | Contador 0; al guardar se normaliza a `null`. | Estado vacío. | Sin error. |
| **Exceso** | Contador en `--danger` con «máximo superado»; error; `aria-invalid`; envío bloqueado; foco al editor. | No aplica. | Error asociado con `aria-describedby`. |
| **Enlace inválido** | Detectado al enviar si la lista está completa: error y bloqueo; se quita desde Formato → Quitar enlace. Si la lista está truncada, la autoridad es el proceso principal y se muestra el error de guardado. | Al pulsar no navega; aviso «La ficha enlazada ya no está disponible en este mundo.». | Aviso con la región de toasts; el foco permanece en el enlace. |
| **Deshabilitado** | `--disabled-surface`, `--disabled-text`, `--disabled-border`; sin opacidad. | No aplica. | `aria-disabled="true"`; en lectura no hay atributos de formulario. |
| **Lectura** | No aplica. | Editor sin barra, sin listbox, sin `tabindex` propio; solo los enlaces son enfocables. | El nombre lo aporta el h2 «Resumen». |

## 3. Teclado, foco y lectores de pantalla

### 3.1 Flujo de foco

| Momento | Comportamiento |
|---|---|
| Abrir diálogo | Foco en **Nombre**. No se enfoca el editor. |
| Tabulación | Nombre → Identificador → Resumen → barra (B, I, Formato, Enlace, Mención) → contenido → Géneros → Idioma → Cancelar → Crear/Guardar. |
| Salir del editor | `Tab` sale al siguiente control salvo que el selector de menciones esté abierto con resultados: inserta y mantiene el foco. |
| Guardar con éxito | Se desmonta el diálogo y el foco vuelve al disparador o a `#wc-main`. |
| Cancelar / cerrar | Igual que guardar con éxito. |
| Error de guardado | Foco al párrafo de error (`tabIndex={-1}`); no se pierde contenido. |
| Error de validación | Foco al editor (exceso o enlace inválido); si el primer error es el nombre, al nombre. |
| Tras una mención | El foco permanece en el editor. |
| Tras elegir enlace | El foco vuelve al editor. |
| En lectura | Solo los enlaces son paradas; `Enter` los abre. |

### 3.2 Capas de Escape (crítico)

| Capa abierta | Escape debe… |
|---|---|
| Tooltip | Cerrar solo el tooltip. |
| Menú «Formato» | Cerrar el menú y devolver el foco al disparador. |
| Popover de menciones | Cerrar el selector sin borrar `@` ni la consulta; **no cerrar el diálogo**. |
| Diálogo de enlace anidado | Cerrar solo el diálogo de enlace; devolver el foco a Enlace. |
| Editor sin capas | Cerrar el diálogo del mundo (como hoy). |
| Diálogo con `pending` | No cerrar: `dismissible={!pending}`. |

**Corrección obligatoria en `Dialog`:** ignorar el evento si
`event.defaultPrevented`; la comprobación de popovers debe incluir
`[role="listbox"]:not([hidden])`. Sin esto, el Escape del popover o del diálogo
anidado cerraría también el diálogo padre.

### 3.3 Atributos ARIA del editor

| Estado | `role` | `aria-expanded` / `aria-controls` | `aria-multiline` | `tabindex` | Otros |
|---|---|---|---|---|---|
| Edición con menciones listas | `combobox` | Siempre; `aria-controls` al listbox persistente. | **No** (restricción de axe). | `0` | `aria-labelledby`; `aria-describedby`; `aria-autocomplete="list"`; `aria-activedescendant` solo con opción activa. |
| Edición cargando / error / sin menciones | `textbox` | Ausentes; no se monta listbox. | `true`. | `0` | `aria-labelledby`, `aria-describedby`, `aria-invalid` si procede. |
| Deshabilitado | El que corresponda | Se conservan. | El que corresponda. | Se conserva. | `aria-disabled="true"`; `contenteditable=false`. |
| Lectura | Sin rol de formulario | Ausentes. | Ausente. | Se retira. | Sin `aria-label`, `aria-describedby`, `aria-invalid` ni `aria-activedescendant`. |

- `label` sigue siendo obligatorio como nombre de respaldo; con `labelledBy` se
  usa `aria-labelledby` y no `aria-label`.
- La barra conserva `role="toolbar"` y `aria-label` «Editor de descripción».
- El listbox existe solo en `combobox`, oculto con `hidden` y `display: none`.
- El contador y el recuento de palabras no son regiones vivas.

### 3.4 Anuncios

1. Al abrir: «Crear un mundo, diálogo» o «Editar “X”, diálogo»; foco en
   «Nombre del mundo, obligatorio».
2. Barra: «Editor de descripción, barra de herramientas»; botones con nombre y
   `aria-pressed` en Negrita/Cursiva.
3. Editor: «Descripción, cuadro combinado» o «Descripción, edición de texto,
   multilínea» según el estado.
4. Candidatas: carga, error y reintento.
5. Menciones: recuento `aria-live="polite"`; vacíos propios de #131.
6. Enlace: «Enlazar a una ficha, diálogo»; retorno al editor.
7. Guardado: «Guardando el mundo…»; fallo con el texto del error.
8. Lectura: «Resumen, encabezado de nivel 2»; «Recuento de la descripción: N
   palabras»; enlaces «Nombre, enlace»; aviso de ficha no disponible.

## 4. Estilos y tokens

### 4.1 Tokens

Sin colores nuevos. Se usan `--bg`, `--surface`, `--surface-raised`,
`--surface-sunken`, `--border`, `--border-strong`, `--fg`, `--muted`,
`--accent`, `--accent-strong`, `--accent-surface`, `--danger`,
`--danger-surface`, `--focus`, `--disabled-surface`, `--disabled-text`,
`--disabled-border`, `--radius-sm`, `--radius-md`, espaciados, tamaños de texto,
familias, pesos, interlineados, `--shadow-2`, `--z-tooltip`, `--motion-fast` y
`--ease-out`.

### 4.2 Matriz de temas

| Pieza | Claro | Oscuro |
|---|---|---|
| Diálogo | `--surface-raised` | `--surface-raised` |
| Barra del editor | `--surface` | `--surface` |
| Contenido del editor | `--surface-raised` + `--fg` | `--surface-raised` + `--fg` |
| Borde del editor en formulario | `--border-strong` | `--border-strong` |
| Enlace en edición | `--accent` sobre `--surface-raised` | igual |
| Enlace en lectura | `--accent-strong` sobre `--bg` | igual |
| Contador / metadatos | `--muted` | `--muted` |
| Contador excedido / error | `--danger` | `--danger` |
| Deshabilitado | `--disabled-*` | `--disabled-*` |
| Vacío en lectura | `--muted` sobre `--bg` | igual |
| Foco | `--focus` 2 px, offset 2 px | igual |

El color nunca es el único indicador.

### 4.3 Clases y CSS

Se reutilizan `wc-editor*`, `wc-world-description*`, `wc-page__section*`,
`wc-section-heading`, `wc-dialog--wide`, `wc-field*`, `wc-form*` y
`wc-link-list*`. Se añaden solo estas clases:

```css
.wc-field__label-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
  min-width: 0;
}

.wc-editor-field__count {
  min-width: 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  line-height: var(--leading-snug);
  overflow-wrap: break-word;
}

.wc-editor-field__count--over {
  color: var(--danger);
  font-weight: var(--weight-medium);
}

.wc-editor-field__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-2);
  min-width: 0;
}

.wc-page__section-meta {
  flex: 0 0 auto;
  margin-inline-start: auto;
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
  white-space: nowrap;
}

.wc-world-form .wc-editor__toolbar,
.wc-world-form .wc-editor__content {
  border-color: var(--border-strong);
}

.wc-world-form .wc-editor__content {
  min-block-size: 10rem;
  max-block-size: 20rem;
}

.wc-world-form .wc-field--invalid .wc-editor__toolbar,
.wc-world-form .wc-field--invalid .wc-editor__content {
  border-color: var(--danger);
}

.wc-editor[data-disabled='true'] .wc-editor__content {
  border-color: var(--disabled-border);
  background-color: var(--disabled-surface);
  color: var(--disabled-text);
  cursor: not-allowed;
}

.wc-world-description {
  min-width: 0;
  max-inline-size: 68ch;
  overflow-wrap: break-word;
}

.wc-world-description--empty {
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}
```

Se elimina de `.wc-world-description` la declaración `white-space: pre-line` y
la tipografía de contenido duplicada: el editor en lectura ya aporta
`--font-content`, 18 px, 1,7 y 68ch.

### 4.4 Contraste

Parejas usadas ya verificadas, salvo una nueva:

| Pareja | Uso | Claro | Oscuro | Mínimo |
|---|---|---:|---:|---:|
| `--fg` sobre `--surface-raised` | Texto | 15,19:1 | 13,82:1 | 4,5:1 |
| `--muted` sobre `--surface-raised` | Ayuda, contador | 5,58:1 | 6,51:1 | 4,5:1 |
| `--muted` sobre `--bg` | Vacío y metadatos | 5,07:1 | 7,74:1 | 4,5:1 |
| `--accent` sobre `--surface-raised` | Enlace en edición | 7,78:1 | 6,74:1 | 4,5:1 |
| `--accent-strong` sobre `--bg` | Enlace en lectura | 9,05:1 | 9,92:1 | 4,5:1 |
| `--danger` sobre `--surface-raised` | Contador excedido | 6,68:1 | 7,51:1 | 4,5:1 |
| `--fg` sobre `--danger-surface` | Alerta | 12,20:1 | 13,01:1 | 4,5:1 |
| `--disabled-text` sobre `--disabled-surface` | Deshabilitado | 4,72:1 | 7,74:1 | 4,5:1 |
| **`--border-strong` sobre `--surface-raised`** | **Borde del editor** | **≈3,8:1** | **≈4,1:1** | **3:1** |

Añadir a `CONTRAST_PAIRS` de `tests/unit/design-tokens.test.ts`:

```ts
{ fg: '--border-strong', bg: '--surface-raised', min: 3, label: 'componente' },
```

### 4.5 Ventana y contenido largo

| Ancho | Diálogo | Editor | Página |
|---:|---|---|---|
| 1024×700 | 704 px; cuerpo con scroll; pie fijo | 632 px útiles; barra de 255 px en una fila; 10–20rem | `main` 736 px con rail 240; 68ch; sin scroll horizontal |
| 1280×800 | 704 px centrado | igual | `main` 992 px; 68ch |
| 1600×900 | 704 px centrado | igual | `main` 1152 px; 68ch |

`scrollWidth <= innerWidth` en los tres anchos y ambos temas; la barra no se
envuelve; nombres de 120 caracteres y tipos de 40 no desbordan el popover; una
descripción de 4.000 caracteres con listas, citas y una palabra sin espacios no
genera scroll horizontal.

### 4.6 Movimiento

Sin animaciones nuevas. El popover conserva 120 ms y el chevron 120 ms, ya
cubiertos por `prefers-reduced-motion`. La carga de candidatas es texto, no
spinner.

## 5. Textos (i18n)

### 5.1 `worlds.form`

| Clave | Tipo | Texto |
|---|---|---|
| `descriptionLabel` | `string` | `Descripción` (sin cambios) |
| `descriptionHint` | `string` | `Formato básico y enlaces internos. Escribe @ o [[ para mencionar una ficha; Enter inserta y Escape cierra el selector. Los enlaces se abren desde la página del mundo.` |
| `descriptionHintCreate` | `string` | `Formato básico. Podrás mencionar fichas cuando el mundo esté creado.` |
| `descriptionCount` | `(count: string, max: string) => string` | `${count} / ${max} caracteres` |
| `descriptionCountOver` | `(count: string, max: string) => string` | `${count} / ${max} caracteres · máximo superado` |
| `descriptionTooLong` | `(max: string) => string` | `La descripción supera el máximo de ${max} caracteres. Acórtala para guardar el mundo.` |
| `descriptionLinkInvalid` | `string` | `La descripción enlaza a una ficha que ya no está disponible en este mundo. Quita ese enlace desde Formato y vuelve a intentarlo.` |
| `mentionsLoading` | `string` | `Cargando las fichas del mundo…` |
| `mentionsError` | `string` | `No se pudieron cargar las fichas del mundo. Puedes seguir escribiendo, pero no insertar enlaces.` |
| `mentionsRetry` | `string` | `Reintentar` |
| `saving` | `string` | `Guardando el mundo…` |
| `formError` | `string` | `No se pudo guardar el mundo. Tus cambios siguen en pantalla; vuelve a intentarlo.` |

Los contadores reciben números formateados con `formats.formatNumber`. El texto
antiguo «Máximo 4.000 caracteres.» se retira.

### 5.2 `worlds.detail`

| Clave | Tipo | Texto |
|---|---|---|
| `descriptionWordsLabel` | `string` | `Recuento de la descripción:` |
| `descriptionLinkMissing` | `string` | `La ficha enlazada ya no está disponible en este mundo.` |

El recuento visible reutiliza `entities.detail.descriptionMeta(count)`. Se
conserva `worlds.detail.noDescription`.

### 5.3 Reutilizadas

`entities.editor.*` (barra, Formato, listas, cita, enlace, menciones),
`entities.detail.descriptionMeta`, `components.dialog.close`,
`components.form.requiredMark` y los botones existentes.

## 6. Riesgos y aceptación visual

### 6.1 Riesgos

1. **Escape en capas:** sin la corrección de `defaultPrevented`, un Escape
   cierra el modal padre y descarta el formulario.
2. **Navegación desde el modal:** `Ctrl+clic` o «Abrir enlace» perderían
   cambios; se suprimen y se explica en la ayuda.
3. **Recreación del editor:** si las extensiones se reconstruyen al pasar de
   «cargando» a «listo», se pierde foco y selección. Usar un indicador
   `enabled` en el plugin.
4. **Scroll anidado:** cuerpo del diálogo + editor; el máximo de 20rem evita
   atrapar la rueda.
5. **Borde del editor:** `--border` no alcanza 3:1; en el formulario se usa
   `--border-strong`. El editor de la ficha conserva `--border` por #131.
6. **Jerarquía de encabezados:** posible inversión entre el h2 «Resumen» y un h2
   del contenido; se resuelve en el sistema para ambas descripciones, no con un
   parche local.
7. **Lista de candidatas truncada:** con más de 200 fichas se omite la
   validación previa; el proceso principal sigue siendo la autoridad.
8. **Enlaces heredados:** un `href` malformado no navega; la validación debe
   descartarlo antes.
9. **Pérdida al cerrar:** Escape con el editor enfocado cierra el diálogo y
   descarta cambios, como el resto del formulario; no se añade confirmación.
10. **Recuento de palabras:** misma regla que la ficha; las viñetas cuentan como
    tokens.

### 6.2 Criterios de aceptación visual (QA)

- [ ] A 1024, 1280 y 1600 px, en Claro y Oscuro, `scrollWidth <= innerWidth` en
      la página y con el diálogo abierto.
- [ ] Creación: 3 controles, sin Enlace ni Mención, ayuda de creación, contador
      0/4.000; foco inicial en Nombre.
- [ ] Edición: 5 controles en una fila; Enlace/Mención deshabilitados durante la
      carga y el error; estado visible y reintento.
- [ ] El editor no desborda a 1024 px; el cuerpo del diálogo desplaza y el pie
      queda fijo.
- [ ] Descripción de 4.000 caracteres con párrafos, listas, cita y una palabra
      sin espacios: sin scroll horizontal, sin truncar; scroll interno.
- [ ] Contador normal, excedido y error visibles en ambos temas; el envío se
      bloquea y el foco va al editor.
- [ ] Error de guardado visible, enfocado y anunciado; contenido intacto.
- [ ] Popover de menciones en las cuatro esquinas: no se recorta, se limita a
      24 px del viewport, voltea si no cabe y queda por encima.
- [ ] Escape con el popover abierto cierra solo el popover; con el menú, solo el
      menú; con el diálogo de enlace, solo ese diálogo; el diálogo del mundo
      sigue abierto. Un segundo Escape lo cierra.
- [ ] Página con descripción formateada: «Resumen», «N palabras», listas y
      enlaces; sin barra ni atributos de formulario; sin scroll horizontal.
- [ ] Página vacía: texto de vacío, sin editor ni metadatos ni acción nueva.
- [ ] Un enlace existente navega; uno inexistente o de otro mundo avisa y no
      navega.
- [ ] `prefers-reduced-motion`: sin transiciones nuevas.
- [ ] axe sin violaciones críticas en página, diálogo (crear/editar/cargando/
      error), popover, menú y diálogo de enlace, en ambos temas.
- [ ] Manual actualizado.

## 7. Handoff a implementación

### 7.1 Árbol DOM cerrado

**Formulario:**

```html
<form class="wc-form wc-world-form" id="…" novalidate>
  <div class="wc-field">… Nombre …</div>
  <div class="wc-field">… Identificador …</div>
  <div class="wc-field">… Resumen (textarea) …</div>

  <div class="wc-field wc-world-form__description" data-field="description">
    <div class="wc-field__label-row">
      <span class="wc-field__label" id="…-label">Descripción</span>
      <span class="wc-editor-field__count">0 / 4.000 caracteres</span>
    </div>

    <div class="wc-editor" data-readonly="false" data-disabled="false"
         data-entity-links="off | disabled | enabled">
      <div class="wc-editor__toolbar" role="toolbar" aria-label="Editor de descripción">
        <button aria-label="Negrita" aria-pressed="…">B</button>
        <button aria-label="Cursiva" aria-pressed="…">I</button>
        <span class="wc-editor__divider" aria-hidden="true"></span>
        <button class="wc-editor__format-trigger" aria-haspopup="menu" aria-expanded="…">Formato …</button>
        <button aria-label="Enlace a una ficha" disabled>…</button>
        <button aria-label="Mención" disabled>…</button>
      </div>

      <div class="wc-editor__surface">
        <div class="ProseMirror wc-editor__content"
             role="combobox | textbox" tabindex="0"
             aria-labelledby="…-label"
             aria-describedby="…-hint …-status …-error"
             aria-invalid="…"></div>

        <div class="wc-mention" hidden>
          <ul class="wc-mention__list" role="listbox" aria-label="Fichas para mencionar" hidden></ul>
          <p class="wc-mention__empty">…</p>
        </div>
      </div>

      <p class="wc-field__hint" id="…-hint">… ayuda …</p>
      <div class="wc-editor-field__status">… carga / error + Reintentar …</div>
      <p class="wc-field__error" id="…-error" role="alert">… error …</p>
    </div>
  </div>

  <div class="wc-field">… Géneros …</div>
  <div class="wc-field">… Idioma …</div>
  <p class="wc-form__note">… portada …</p>
  <p class="wc-form__error" role="alert" tabindex="-1">… error de guardado …</p>
  <p class="wc-visually-hidden" role="status" aria-live="polite">Guardando el mundo…</p>
</form>
```

**Página:**

```html
<section class="wc-page__section" aria-labelledby="…">
  <div class="wc-section-heading">
    <h2 class="wc-page__section-title" id="…">Resumen</h2>
    <p class="wc-page__section-meta">
      <span class="wc-visually-hidden">Recuento de la descripción: </span>N palabras
    </p>
  </div>

  <div class="wc-world-description">
    <div class="wc-editor" data-readonly="true" data-entity-links="off">
      <div class="wc-editor__surface">
        <div class="ProseMirror wc-editor__content">…</div>
      </div>
    </div>
  </div>

  <p class="wc-world-description wc-world-description--empty">…</p>

  <div class="wc-world-data">… Datos del mundo …</div>
</section>
```

### 7.2 Componentes y props

**`RichTextEditor` (ampliación, sin bifurcar):**

```ts
export type EntityLinkMode = 'enabled' | 'disabled' | 'off';

export interface RichTextEditorProps {
  readonly document: EntityRichTextDocument | null;
  readonly label: string;
  readonly labelledBy?: string;
  readonly describedBy?: string;
  readonly invalid?: boolean;
  readonly hintId?: string;
  readonly candidates: readonly EntitySummary[];
  readonly hint?: string | undefined;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly entityLinks?: EntityLinkMode; // por defecto 'enabled'
  readonly navigateLinks?: boolean; // por defecto true
  readonly onChange: (document: EntityRichTextDocument | null) => void;
  readonly onOpenEntity: (entityId: string) => void;
  readonly editorRef?: Ref<Editor | null>;
}
```

- No se recrean las extensiones al cambiar `entityLinks`; la extensión `Mention`
  recibe un estado `enabled` en el plugin. Así se conserva foco y selección.
- `navigateLinks=false` suprime `Ctrl/Cmd+clic` y oculta «Abrir enlace».
- `entityLinks='off'` no monta Enlace/Mención ni `LinkDialog`; `'disabled'` los
  deja visibles y deshabilitados.
- El efecto de atributos distingue `combobox` (enabled), `textbox`
  (disabled/off) y lectura (sin atributos).
- `hintId`, `invalid` y `describedBy` permiten asociar ayuda y error.

**`EditorToolbar`:** añade `entityLinks` y `navigateLinks`; «Abrir enlace» solo
con navegación; «Quitar enlace» siempre; una sola fila.

**`Mention`:** `MentionState.enabled`; `setMentionEnabled()`; `detectState`
cerrado si no está habilitada; el resto del contrato de #131 no cambia.

**`Dialog`:** ignora Escape con `defaultPrevented`; incluye
`[role="listbox"]:not([hidden])`; el diálogo del mundo usa
`dismissible={!pending}`.

**`WorldDescriptionField` (formulario):**

```ts
export interface WorldDescriptionFieldProps {
  readonly mode: 'create' | 'edit';
  readonly document: EntityRichTextDocument | null;
  readonly candidates: readonly EntitySummary[];
  readonly candidatesState: 'loading' | 'ready' | 'error';
  readonly pending: boolean;
  readonly error?: string | undefined;
  readonly onChange: (document: EntityRichTextDocument | null) => void;
  readonly onRetryCandidates?: (() => void) | undefined;
  readonly editorRef?: Ref<Editor | null>;
}
```

Responsabilidades: etiqueta y contador; normalizar a `null` un documento sin
texto; calcular contador y exceso sobre texto plano; `entityLinks` `off` en
creación, `enabled`/`disabled` según estado; `navigateLinks={false}`; ayuda,
estado de candidatas con reintento y error; ARIA.

**`WorldDescriptionView` (lectura):**

```ts
export interface WorldDescriptionViewProps {
  readonly document: EntityRichTextDocument | null;
  readonly onOpenEntity: (entityId: string) => void;
}
```

Sin texto → párrafo de vacío; con texto → `RichTextEditor readOnly`,
`entityLinks="off"`, `candidates={[]}`, `onChange` estable y `onOpenEntity`. No
monta barra, popover ni diálogo de enlace.

**`WorldFormDialog`:**

```ts
readonly mentionCandidates?: readonly EntitySummary[];
readonly mentionCandidatesState?: 'loading' | 'ready' | 'error';
readonly mentionCandidatesComplete?: boolean;
readonly onRetryMentionCandidates?: () => void;
```

`FormValues.description: EntityRichTextDocument | null`; errores de descripción;
valida exceso, enlaces inválidos (si la lista está completa) y campos actuales;
envía documento o `null`; enfoca el error de guardado; `dismissible={!pending}`.

**`WorldPage`:** nuevo `onOpenEntity`; calcula texto, vacío y palabras con el
mismo extractor; sustituye el `<p>` por `WorldDescriptionView`; preparación con
`!descriptionEmpty`; fila de metadatos.

**`App`:** el diálogo de edición incluye candidatas, estado y completitud;
`openEdit` carga `entities.list({ worldId, filter: { limit: 200 } })`;
`onRetryMentionCandidates` reintenta; `openWorldDescriptionEntity(id)` valida
con `entities.get({ worldId, id })` y navega o avisa `descriptionLinkMissing`.

### 7.3 Correcciones vinculantes

| # | Severidad | Corrección | Verificación |
|---|---|---|---|
| C1 | Alta | `WorldDetail.description` es documento validado; `description_text` se calcula en main; migración e importación convierten texto sin perder párrafos. | Tests de migración, guardado, importación y búsqueda. |
| C2 | Alta | `WorldDescriptionField` y `WorldDescriptionView` son envoltorios finos; no se duplica barra, menciones ni enlaces. | Test: misma toolbar, sin una segunda. |
| C3 | Alta | `RichTextEditor` amplía `entityLinks`, `navigateLinks`, `labelledBy`, `describedBy`, `invalid`, `hintId` y `data-disabled`; no recrea extensiones al cargar candidatas. | Foco y selección sobreviven a `loading → ready`; rol cambia. |
| C4 | Alta | Matriz ARIA de §3.3 en los tres modos. | axe con popover abierto/cerrado; atributos. |
| C5 | Alta | Barra de 3 controles en creación y 5 en edición, una fila, sin envolver; «Abrir enlace» solo con navegación. | `scrollWidth`; recuento; capturas. |
| C6 | **Bloqueante** | `Dialog` ignora Escape con `defaultPrevented` y reconoce `[role="listbox"]:not([hidden])`; `dismissible={!pending}`. | Escape por capas; segundo Escape cierra. |
| C7 | Alta | Popover y menús `position: fixed`, `overflow: visible`; sin `transform`/`filter`/`contain`; se cierran al desplazar o redimensionar. | Cuatro esquinas a 1024; sin recorte; clamp y volteo. |
| C8 | Media | Layout del formulario: fila etiqueta/contador, editor 10–20rem, ayuda, estado, error; cuerpo con scroll y pie fijo; 44rem. | Capturas; sin desborde; pie visible. |
| C9 | Alta | Límite de 4.000 sobre texto plano: contador, exceso, error, `aria-invalid`, bloqueo y foco. | 4.001 caracteres; no guarda; foco al editor. |
| C10 | Alta | En el modal no se navega; en lectura clic normal; enlace roto avisa. | Ctrl+clic no cambia de vista; clic navega; roto avisa. |
| C11 | Alta | Página: «Resumen» + «N palabras» con cualificador oculto; lectura con editor; vacío sin editor; sin acciones; preparación con el mismo booleano. | Tests de página. |
| C12 | Media | CSS: `--border-strong` en formulario; `--danger` inválido; `--disabled-*`; retirar `white-space: pre-line` y tipografía duplicada; nuevas clases con tokens. | Revisión de CSS; ambos temas. |
| C13 | Alta | Claves y textos de §5; sin cadenas en componentes; números con `formats.formatNumber`. | Typecheck; revisión de textos. |
| C14 | Alta | Actualizar tests de componentes y E2E al editor. | Suites en verde. |
| C15 | Alta | Manual y sistema de diseño; ADR y persistencia. | Documentación revisada. |
| C16 | Media | Foco: abrir en Nombre; guardar/cancelar al disparador o `#wc-main`; fallo enfoca el error; validación enfoca el primer campo inválido; guardar no roba el foco. | Tests de teclado y `activeElement`. |

### 7.4 Pruebas mínimas

- **Unitarias:** texto migrado, `collectEntityLinkIds`, validación de enlaces,
  recuento de palabras, contador, `Mention` deshabilitada.
- **Componentes:** creación (3 controles, sin menciones), edición (5), carga,
  error y reintento, exceso, enlace inválido, guardado pendiente, error de
  guardado, vacío, lectura con enlaces y sin atributos de formulario.
- **Integración/E2E:** crear con formato; editar y guardar; recargar y comprobar
  documento y texto; pegar HTML malicioso; navegar a una ficha; enlace roto;
  1024/1280/1600 × Claro/Oscuro; axe; `prefers-reduced-motion`.
- **Tokens:** pareja `--border-strong` sobre `--surface-raised`; sin
  `white-space: pre-line`; borde fuerte en el formulario; deshabilitado sin
  opacidad.
