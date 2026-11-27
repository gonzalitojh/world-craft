# Portada del mundo (#115): contrato de interfaz

> **Estado:** aprobado el 2026-11-27. Contrato vinculante para
> `tdd-ddd-architect`, `qa-reviewer` y `documentation-sync` de la issue #115.
> No describe código ya implementado: fija el resultado visible y accesible que
> la implementación debe cumplir.
>
> **Base normativa:** `AGENTS.md` (reglas 2, 4, 5, 12, 15, 17 y 18);
> `docs/diseno/sistema-de-diseno.md` §2, §4, §5, §6, §7, §9 y §10.2–10.3;
> tokens de `src/renderer/styles/tokens/`;
> `src/renderer/components/worlds/world-mark.tsx`,
> `world-card.tsx`, `world-form-dialog.tsx`, `src/renderer/pages/world-page.tsx`,
> el selector de portada de `entity-detail-page.tsx` (~1661–1708), los estilos
> `.wc-image-picker*` de `components.css` y `src/renderer/messages/es.ts`.
>
> El estado real del producto se consulta en el sistema de diseño; este
> documento solo añade el contrato de #115 y no presenta como existente nada que
> aún no lo esté.

## Decisiones cerradas

1. **Una sola portada por mundo**, almacenada en `worlds.cover_asset_id`. Se
   elige entre las imágenes del propio mundo; no hay subida de un archivo
   distinto al flujo de assets. La imagen original nunca se pinta en la
   interfaz: todas las previsualizaciones y miniaturas usan
   `assetUrl(id, 'thumb')`.
2. **Encuadre 1:1 con recorte centrado** (`object-fit: cover`,
   `object-position: center`). Es la proporción real de `WorldMark` en la
   tarjeta (4,5 rem) y en la cabecera del mundo (4,5 rem). En #115 **no hay
   zoom, paneo ni editor de recorte**: elegir la imagen es elegir el encuadre.
3. **Se extrae un `AssetPickerDialog` compartido** a partir del selector inline
   de la ficha. La ficha y el mundo usan el mismo componente y los mismos
   textos; se retiran del selector de la ficha los estilos y cadenas
   duplicados. El comportamiento de la ficha no cambia salvo la mejora de
   selección descrita en §3.3.
4. **Crear mundo no tiene selector.** Sin `worldId` no hay assets del mundo ni
   forma de importar. En creación se muestra una explicación, no un botón
   deshabilitado ni un control enfocable muerto. En edición sí hay selector.
5. **En el formulario la portada es parte del formulario:** elegir o quitar
   actualiza la vista previa y **se persiste al guardar**. Cancelar no cambia la
   portada del mundo. Las imágenes importadas desde el selector sí se guardan
   en el mundo al importarlas, porque `assets:import` es inmediato; se
   documenta como comportamiento conocido.
6. **En la página del mundo la portada se persiste al elegir** y se anuncia con
   el aviso existente. Si falla, la portada anterior permanece y el aviso
   explica el fallo. Quitar la portada no borra la imagen del mundo y no pide
   confirmación.
7. **No se crean tokens, colores, sombras ni tipografías nuevas.** La portada
   usa los roles semánticos existentes y `WorldMark` conserva sus tonos
   `--entity-*`.
8. La cabecera del mundo gana **una acción propia de la portada**, no una
   acción de página: un botón de texto bajo la miniatura. Es una excepción
   deliberada a «la cabecera no declara acciones» de §10.3, exigida por #115;
   `documentation-sync` debe reflejarla en el sistema de diseño y en el manual.

## 1. Dónde vive la portada

### 1.1 Formulario de crear/editar mundo (`world-form-dialog.tsx`)

Se sustituye la nota actual `worlds.form.coverNote` (línea ~355) por un bloque
de portada **después de «Idioma del mundo»** y antes del error de guardado.
El orden de los campos existentes no cambia; la portada es el último dato
porque es un atributo de presentación, no un campo de texto.

```text
Diálogo «Editar mundo» (wc-dialog--wide, 44 rem, cuerpo con scroll)
  Nombre
  Identificador
  Resumen
  Descripción (editor de #114)
  Géneros
  Idioma del mundo
  ┌ Portada ────────────────────────────────────────────────────────┐
  │ [vista previa 4,5 rem]  Se muestra en la lista de mundos y en   │
  │                         la cabecera del mundo.                  │
  │                         [Cambiar portada]  [Quitar portada]     │
  └─────────────────────────────────────────────────────────────────┘
  [error de guardado, role=alert]
Pie fijo: Cancelar · Guardar cambios
```

En **creación**:

```text
  ┌ Portada ────────────────────────────────────────────────────────┐
  │ [pozo 4,5 rem, icono]   Guarda el mundo para poder elegir una    │
  │                         portada.                                │
  └─────────────────────────────────────────────────────────────────┘
```

- Sin botón y sin pozo interactivo: solo icono decorativo, título «Portada» y la
  explicación. No se anuncia como error.
- Al crear el mundo no se abre el selector automáticamente: la portada se
  elige después desde la página del mundo o desde Editar.

En **edición**:

| Situación | Vista previa | Acciones |
|---|---|---|
| Sin portada | Pozo 4,5 rem con icono y «Sin portada todavía.» | **Elegir portada** (secundario, `sm`) |
| Con portada | `WorldMark` 4,5 rem con la miniatura | **Cambiar portada** (secundario, `sm`) · **Quitar portada** (fantasma, `sm`) |
| Sin imágenes en el mundo | Pozo 4,5 rem con icono | **Elegir portada** sigue visible; el selector ofrece **Añadir imagen** |

El bloque se marca con `role="group"` y `aria-labelledby` apuntando a su `h3`
«Portada» (nivel correcto dentro del `h2` del diálogo). No se usa `<label>`
porque no hay un control nativo único que etiquetar.

### 1.2 Página del mundo (`world-page.tsx`)

La miniatura de la cabecera deja de ser solo decorativa en apariencia, pero
**el `WorldMark` sigue con `aria-hidden`**: el control es un botón contenedor
con texto visible.

```text
header.wc-world-header
  div.wc-world-header__cover
    WorldMark (4,5 rem, aria-hidden)
    button.wc-button.wc-button--ghost.wc-button--sm  «Cambiar portada»
                                                      o «Elegir portada»
  div.wc-world-header__body
    Badge de estado
    p resumen
    ul géneros
```

- **Sin portada:** el botón dice **Elegir portada**.
- **Con portada:** el botón dice **Cambiar portada**.
- El botón va **debajo** de la miniatura, alineado a la izquierda, con
  `gap: var(--space-2)`. No se superpone a la imagen, no depende de `hover` y
  no es solo un icono: la acción es visible y tiene nombre accesible por su
  propio texto. No lleva `aria-label` distinto para respetar «label in name».
- **No** se añade una acción al menú `⋯` ni a la barra superior. El botón
  pertenece al bloque de portada, no compite con «Nueva ficha».
- Al pulsarlo se abre el `AssetPickerDialog` de §3. Al elegir o quitar, la
  cabecera se actualiza y aparece el aviso correspondiente (§5).

## 2. Estructura y objeto del `AssetPickerDialog`

Componente compartido nuevo, propuesto en
`src/renderer/components/assets/asset-picker-dialog.tsx`, sobre el `Dialog`
existente. La ficha y el mundo lo consumen; no se duplica markup.

```text
Dialog «Elegir portada» (36 rem; velo, foco atrapado, Escape)
  h2 «Elegir portada» + botón cerrar (X)
  cuerpo:
    p.wc-dialog__lead  «Elige una imagen de este mundo como portada.»
    [estado]
      carga:   8 esqueletos 1:1, aria-busy, «Cargando las imágenes del mundo…»
      error:   .wc-alert--inline + «Volver a intentar»
      vacío:   .wc-empty (icono + «Este mundo todavía no tiene imágenes.»)
               + primario «Añadir imagen» (solo si hay onImport)
      listo:   ul.wc-image-picker
                 li > button.wc-image-picker__item[aria-pressed]
                        img.wc-image-picker__thumb (thumb)
                        span.wc-image-picker__badge «Portada» + check (si actual)
  pie:
    [Quitar portada] (solo si hay portada y onClear)   [Cerrar]
```

### 2.1 Contrato de propiedades (orientativo, no vinculante en nombres)

```ts
interface AssetPickerDialogProps {
  open: boolean;
  assets: readonly AssetSummary[];
  state: 'loading' | 'ready' | 'error';
  selectedAssetId: string | null;
  pending?: boolean;            // escritura de la portada o importación
  saveError?: string | null;    // fallo al persistir (solo página)
  onSelect: (assetId: string) => void;
  onClear?: () => void;         // si falta, no hay «Quitar portada»
  onImport?: () => void;        // si falta, el vacío no ofrece añadir
  importing?: boolean;
  importError?: string | null;
  onRetry?: () => void;
  onClose: () => void;
}
```

El poseedor carga `assets:list(worldId)` **al abrir** (y al reintentar), no al
montar la página ni el formulario. La lista es la del mundo completo, incluidas
las imágenes de fichas.

### 2.2 Comportamiento de las acciones

| Acción | Comportamiento |
|---|---|
| **Elegir/Cambiar portada** (formulario) | Abre el selector. Al elegir, actualiza el estado local, cierra el selector, devuelve el foco al botón y anuncia el cambio en la región viva del campo. No persiste hasta «Guardar cambios». |
| **Elegir/Cambiar portada** (página) | Abre el selector. Al elegir, cierra, persiste y muestra el aviso. Si el asset elegido ya era la portada, cierra sin escribir ni avisar. |
| **Quitar portada** (formulario) | Pone `null` en el estado local, cierra el selector si estaba abierto, enfoca «Elegir portada» y anuncia que se aplicará al guardar. |
| **Quitar portada** (página) | Cierra el selector, persiste `null`, enfoca el botón —que pasa a decir «Elegir portada»— y muestra «Se ha quitado la portada del mundo.». Sin confirmación: no borra la imagen. |
| **Añadir imagen** (selector) | Dispara `assets:import` con el `worldId`. Mientras dura: botón con `loading`, texto «Importando imágenes…», miniaturas deshabilitadas y selector no descartable. Al terminar: añade las nuevas al principio de la lista, **no** las selecciona sola, enfoca la primera importada y mantiene el diálogo abierto. Si se cancela el diálogo nativo, no hay aviso y el foco vuelve a «Añadir imagen». |
| **Cerrar** | Cierra sin cambios. En el formulario, Escape y la X cierran solo el selector, nunca el formulario padre. |

No hay botón «Guardar» en el selector: la elección es la acción. La página
persiste al elegir; el formulario, al guardar el mundo.

## 3. Aspecto, medidas y tokens

### 3.1 Bloque de portada del formulario

| Pieza | Valor |
|---|---|
| Contenedor | `display: grid; grid-template-columns: 4.5rem minmax(0, 1fr); gap: var(--space-4); align-items: start; min-width: 0;` |
| Título | `h3.wc-field__label` «Portada»; ocupa la fila completa (`grid-column: 1 / -1`) con `gap: var(--space-1)` respecto al resto. |
| Vista previa | 4,5 rem × 4,5 rem; `border: 1px solid var(--border)`; `border-radius: var(--radius-sm)`; `background: var(--surface-sunken)`; `overflow: hidden`. Es una previsualización, no un control: el borde decorativo `--border` es correcto. |
| Pozo vacío | Mismo cuadrado; icono `--icon-lg` (24 px) en `--muted`, `aria-hidden`. |
| Texto de vacío | «Sin portada todavía.» en `--text-xs`, `--muted`, dentro del cuadrado si cabe en dos líneas (máximo 3 líneas, `overflow-wrap: anywhere`); si el texto no cabe, el cuadrado solo lleva el icono y el texto pasa debajo como ayuda. |
| Ayuda | `.wc-field__hint` (12 px, `--muted`), máximo 60ch. |
| Acciones | `display: flex; flex-wrap: wrap; gap: var(--space-2); margin-block-start: var(--space-2);` |
| Botón principal del bloque | `secondary`, `size="sm"` (28 px de alto). |
| Botón de quitar | `ghost`, `size="sm"`. |

El bloque no añade fondo ni tarjeta: se apoya en la superficie del diálogo y en
el espacio, como el resto de campos.

### 3.2 Portada de la cabecera (página del mundo)

| Pieza | Valor |
|---|---|
| Columna | `div.wc-world-header__cover`: `display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); min-width: 0;` |
| Miniatura | `WorldMark` 4,5 rem, sin cambios de tamaño ni de tono. `object-fit: cover` ya existe. |
| Botón | `.wc-button .wc-button--ghost .wc-button--sm`; `max-inline-size: 100%`, texto sin truncar ni `nowrap` forzado. |
| Ancho de la columna | El del botón (~7–8 rem con «Cambiar portada»). La rejilla `auto minmax(0, 1fr)` absorbe la diferencia; el resumen y los géneros siguen usando `min-width: 0` y `overflow-wrap`. |

No se dibuja ningún velo, insignia flotante ni icono sobre la imagen. La
miniatura conserva su lectura de sello/portada y la acción es texto.

### 3.3 Selector compartido

| Pieza | Valor |
|---|---|
| Diálogo | Ancho por defecto de `.wc-dialog`: `min(36rem, calc(100vw − 2 * var(--space-6)))`; no se usa `--wide`. |
| Rejilla | `.wc-image-picker`: `repeat(auto-fill, minmax(6.5rem, 1fr))`, `gap: var(--space-3)`. En 36 rem de diálogo caben 4 columnas (~7,6–8 rem cada una). |
| Miniatura | `aspect-ratio: 1`, `object-fit: cover`, `border-radius: var(--radius-sm)`, `loading="lazy"`. Siempre variante `thumb`. |
| Elemento | Botón de ancho completo, `border: 2px solid transparent`, `padding: 0`, `border-radius: var(--radius-md)`. |
| Seleccionado | `aria-pressed="true"` **y** borde `--accent` **y** insignia visible «Portada» con check. El color no es el único indicador. |
| Insignia | Fondo sólido `--surface-raised`, texto `--fg`, borde `--border-strong`, icono de check 16 px, `--text-xs`, radio `--radius-sm`; arriba a la izquierda con `var(--space-2)`. Fondo opaco para no depender del brillo de la foto. |
| Foco | Anillo global de 2 px `--focus` con 2 px de separación; en el elemento se mantiene el `:focus-visible` existente. |
| Carga | 8 esqueletos con la misma rejilla y `aspect-ratio: 1`; `aria-hidden` cada uno, `aria-busy="true"` en el contenedor y texto de carga oculto con `role="status"`. |
| Error | `.wc-alert .wc-alert--inline` con el mensaje y **Volver a intentar** (`secondary`, `sm`). |
| Vacío | `.wc-empty` compacto: icono 24 px, descripción y **Añadir imagen** como única primaria del diálogo. |
| Pie | `Quitar portada` (fantasma) y `Cerrar` (fantasma), alineados al final; si no hay portada, solo `Cerrar`. |
| Medidas del pie | Botones `sm`; el pie ya envuelve con `flex-wrap`. |

**Cambio respecto al selector actual de la ficha:** se añade la insignia
«Portada» y el check al elemento seleccionado; se conserva `aria-pressed`, el
borde de acento y el cierre al elegir. La ficha pasa a usar el componente
compartido; no se añade importación desde el selector de la ficha
(`onImport` ausente) para no cambiar su alcance.

## 4. Estados

### 4.1 Formulario

| Estado | Qué se ve | ARIA / foco |
|---|---|---|
| **Creación** | Pozo + «Guarda el mundo para poder elegir una portada.», sin acciones. | Sin `aria-live`; no es un error. |
| **Edición sin portada** | Pozo + «Sin portada todavía.» + **Elegir portada**. | El grupo está etiquetado por «Portada». |
| **Edición con portada** | Miniatura + **Cambiar portada** + **Quitar portada**. | Igual. |
| **Selector abierto** | `AssetPickerDialog` sobre el formulario. | Foco inicial en la miniatura actual o la primera; Escape cierra solo el selector. |
| **Portada elegida/quitar** | La vista previa cambia al instante. | Región `role="status"` oculta: «Portada elegida. El cambio se aplicará al guardar.» / «Portada quitada. El cambio se aplicará al guardar.» |
| **Guardando** | Botón del pie con `loading`; el bloque no bloquea. | Estado existente «Guardando el mundo…». |
| **Error al guardar** | Error general del formulario al final, `role="alert"` y foco. | La portada elegida sigue en pantalla. |

### 4.2 Página del mundo

| Estado | Qué se ve | ARIA / foco |
|---|---|---|
| **Sin portada** | Marca procedural + **Elegir portada**. | Botón con nombre por texto. |
| **Con portada** | Miniatura + **Cambiar portada**. | Igual. |
| **Cargando imágenes** | El selector se abre con esqueletos y «Cargando las imágenes del mundo…». | Contenedor `aria-busy`; foco al cuerpo; no se roba el foco al terminar si el usuario ya se movió. |
| **Error al cargar** | Alerta en línea + **Volver a intentar**; la portada actual no cambia. | `role="alert"`; el foco permanece en el selector. |
| **Mundo sin imágenes** | Vacío + **Añadir imagen** (primaria). | Foco en «Añadir imagen». |
| **Importando** | Botón con `loading`, texto «Importando imágenes…»; miniaturas deshabilitadas. | `aria-busy` en la rejilla; selector no descartable. |
| **Cambio correcto** | La cabecera se repinta y aparece el aviso. | Aviso global `role="status"` (toast existente). |
| **Cambio fallido** | La portada anterior sigue; aviso de error. | Aviso global; la elección no se aplica. |
| **Quitada** | Vuelve la marca procedural y el botón dice «Elegir portada». | Aviso de éxito. |

No se añade una segunda región `aria-live` en la página: se reutiliza la del
toast (`ToastRegion`), que ya es `role="status"` y `aria-live="polite"`.

## 5. Textos e i18n

Todos los textos viven en `messages/es.ts`. Se añaden dos espacios nuevos y se
retiran las claves que queden sin uso.

### 5.1 `worlds.cover`

| Clave | Texto |
|---|---|
| `label` | `Portada` |
| `hint` | `Se muestra en la lista de mundos y en la cabecera del mundo.` |
| `empty` | `Sin portada todavía.` |
| `createHint` | `Guarda el mundo para poder elegir una portada.` |
| `choose` | `Elegir portada` |
| `change` | `Cambiar portada` |
| `remove` | `Quitar portada` |
| `selected` | `Portada elegida. El cambio se aplicará al guardar.` |
| `cleared` | `Portada quitada. El cambio se aplicará al guardar.` |
| `updated` | `Portada del mundo actualizada.` |
| `removedNotice` | `Se ha quitado la portada del mundo.` |
| `updateError` | `No se pudo cambiar la portada. Se mantiene la anterior.` |
| `removeError` | `No se pudo quitar la portada. Se mantiene la actual.` |

### 5.2 `components.assetPicker`

| Clave | Texto |
|---|---|
| `title` | `Elegir portada` |
| `lead` | `Elige una imagen de este mundo como portada.` |
| `loading` | `Cargando las imágenes del mundo…` |
| `loadError` | `No se pudieron cargar las imágenes del mundo.` |
| `retry` | `Volver a intentar` |
| `empty` | `Este mundo todavía no tiene imágenes.` |
| `addImage` | `Añadir imagen` |
| `importing` | `Importando imágenes…` |
| `importError` | `No se pudieron importar las imágenes.` |
| `option` | `(index: number) => Usar la imagen ${index} como portada` |
| `selected` | `Portada` |
| `clear` | `Quitar portada` |
| `close` | `Cerrar` |
| `saving` | `Guardando la portada…` (solo si el poseedor decide esperar la escritura; el selector puede cerrarse antes) |

Reglas:

- Se elimina `worlds.form.coverNote`.
- El selector de la ficha migra a `components.assetPicker.*`; se retiran
  `entities.detail.coverPickerTitle`, `coverPickerLead`, `coverOption` y, si no
  se usa en otro sitio, `noImages`. `entities.detail.coverTitle`,
  `coverEmpty`, `chooseCover`, `changeCover`, `coverBadge` y `close` siguen
  porque pertenecen al panel y a la galería.
- `Portada` como insignia y como etiqueta del grupo comparten texto visible,
  pero son claves distintas: una es estado del selector y la otra, título de
  campo.
- No se concatenan frases; el índice y los plurales se resuelven con las
  funciones del catálogo. No se escriben cadenas en componentes.

## 6. Temas (Claro y Oscuro)

No hay overrides nuevos: todo se resuelve con roles semánticos, que ya cambian
de papel según el tema.

| Superficie / texto | Claro | Oscuro | Comprobación |
|---|---|---|---|
| Texto del botón «Cambiar portada» sobre `--bg` | `--fg` | `--fg` | 13,82:1 / 16,43:1 |
| Pozo vacío y texto secundario | `--surface-sunken` + `--muted` | `--surface-sunken` + `--muted` | 4,72:1 / 8,08:1 |
| Borde del pozo | `--border` | `--border` | Decorativo: no es un control. |
| Miniatura seleccionada | Borde `--accent` sobre `--surface-raised` | Borde `--accent` sobre `--surface-raised` | 7,78:1 / 6,74:1 (≥ 3:1) |
| Insignia «Portada» | `--surface-raised` + `--fg` + borde `--border-strong` | Igual | 15,19:1 / 13,82:1; borde 3,68:1 / 4,34:1 |
| Foco en miniaturas y botones | `--focus` sobre `--bg`/`--surface-raised` | Igual | 7,08–7,78:1 / 8,34–9,92:1 |
| Error en línea | `--danger` + `--danger-surface` | Igual | 5,36:1 / 7,07:1 (texto sobre superficie) |
| Marca procedural sin portada | Tonos `--entity-*` | Igual | Ya cumple 3:1 en #127 |

Cuidado con los pares que cambian de papel: `--surface-raised` es fondo del
diálogo en ambos temas, `--fg` es texto en ambos, `--accent` es borde de
selección en ambos. Ninguna pareja invierte su rol en este componente.

No se usan colores literales, ni `opacity` para deshabilitar, ni velos sobre la
miniatura.

## 7. Ventana de escritorio

Referencias: 1024×700, 1280×800 y 1600×900. No hay diseño móvil.

| Ancho | Formulario | Página del mundo |
|---|---|---|
| **1024** | Diálogo de 44 rem limitado a `100vw − 48px`; el bloque de portada conserva 4,5 rem + 16 px + texto. Los botones envuelven si el tamaño de texto es «Grande». | Cabecera: columna de portada ≈ 7–8 rem, 24 px de gap y cuerpo `minmax(0, 1fr)`. El resumen y los géneros envuelven; no hay scroll horizontal. |
| **1280** | Igual: el diálogo no crece con la ventana. | La página llega a su máximo de 72 rem; la columna de portada mantiene su ancho y el cuerpo gana aire. |
| **1600** | Igual; el diálogo sigue en 44 rem y se centra. | La página se centra con máximo 72 rem; no se estira la miniatura. |

- El selector mide 36 rem en todos los anchos; a 1024 y 1600 tiene las mismas 4
  columnas. Su límite real es la altura: a 700 px el cuerpo hace scroll
  vertical y el pie queda visible.
- No se permite scroll horizontal de página en ningún ancho. El único scroll
  horizontal admitido sigue siendo el de tablas, código y lienzo de mapa.
- Nada de `overflow-x: hidden` como parche.
- Con el rail plegado a 64 px el contenido gana ancho; el diseño no depende de
  ello.
- El botón de portada no trunca su texto: si el tamaño de texto del sistema
  crece, envuelve y la columna se ensancha; el cuerpo se adapta con
  `min-width: 0`.

## 8. Accesibilidad

### 8.1 Semántica y teclado

- **Formulario:** grupo `role="group"` con `aria-labelledby` al `h3` «Portada».
  Las acciones son botones nativos con texto visible. La región de estado es un
  `p.wc-visually-hidden` con `role="status"` y `aria-live="polite"`.
- **Página:** el botón de portada es un `<button type="button">` con texto
  visible; no lleva `aria-label` distinto. El `WorldMark` contenedor sigue con
  `aria-hidden="true"` y la imagen con `alt=""`: la portada es decorativa y el
  botón aporta el nombre.
- **Selector:** un `button` por imagen en una lista `ul > li`; `aria-pressed`
  refleja si es la portada actual. `img` con `alt=""` y `loading="lazy"`.
  Insignia «Portada» con texto y check, no solo color.
- **Orden de tabulación:** en la página, «Volver a Inicio» → «Cambiar/Elegir
  portada» → navegación modular. En el selector: cerrar (X) → miniaturas en
  orden de la lista → añadir (si existe) → quitar → cerrar (pie). No se
  implementa navegación con flechas: son botones nativos y Tab/Shift+Tab
  recorren la rejilla.
- **Enter y Espacio** activan la miniatura y cierran el selector. El clic hace
  lo mismo.
- **Foco al abrir:** la miniatura seleccionada; si no hay, la primera; si el
  estado es vacío, «Añadir imagen»; si está cargando, el cuerpo del diálogo
  (`tabIndex` existente). Se mueve una sola vez al terminar la primera carga;
  los reintentos y las importaciones no roban el foco, salvo el foco a la
  primera imagen recién importada.
- **Foco al cerrar:** siempre al disparador. El `Dialog` existente ya lo hace
  mediante `previousFocusRef`; el selector anidado debe devolver el foco al
  botón del formulario o de la cabecera, no al documento.
- **Escape por capas:** el selector consume el primer Escape y cierra solo su
  capa (`preventDefault`); el formulario padre no se cierra. El selector no es
  descartable mientras importa.
- **Anuncio de cambios:** en el formulario, la región viva del campo; en la
  página, el toast global. No se duplican anuncios.
- **Errores:** `role="alert"` en la alerta del selector; el foco no salta al
  error salvo que el usuario reintente y el foco ya estuviera en el cuerpo.
- **Formularios:** el bloque no tiene `required` ni validación propia. Un fallo
  de guardado usa el error general existente, que ya recibe foco.

### 8.2 Contraste y color

- Todos los pares de §6 cumplen AA (4,5:1 texto normal; 3:1 componentes).
- La selección no se comunica solo por color: borde + insignia con texto +
  check + `aria-pressed`.
- El icono del pozo vacío es decorativo; el texto explica el estado.
- La marca procedural sin portada conserva el contraste ya auditado en #127; no
  se altera.

### 8.3 Movimiento

- No se añaden animaciones de entrada, hover ni transición de la miniatura. El
  cambio de portada es instantáneo.
- El único movimiento es el pulso del esqueleto en carga y el spinner del botón
  al importar; ambos se detienen con la regla global de
  `prefers-reduced-motion` de `base.css` y con la variante de `.wc-progress`.
- No se usa `scroll-behavior: smooth` para llevar el foco al bloque.

## 9. Estilos: reutilizados y nuevos

### 9.1 Reutilizados sin cambios

- `.wc-dialog`, `.wc-dialog__header`, `.wc-dialog__body`, `.wc-dialog__actions`,
  `.wc-dialog__title`, `.wc-dialog__lead`.
- `.wc-button`, `--primary`, `--secondary`, `--ghost`, `--sm`, `loading`.
- `.wc-field__label`, `.wc-field__hint`, `.wc-empty`, `.wc-alert--inline`,
  `.wc-skeleton`, `.wc-visually-hidden`.
- `.wc-world-mark`, `.wc-world-mark--cover`, `.wc-world-mark__image`.
- `.wc-world-header`, `.wc-world-header__body`.

### 9.2 Nuevos (mínimos)

| Selector | Uso |
|---|---|
| `.wc-world-cover-field` | Grupo del formulario; rejilla 4,5 rem + cuerpo. |
| `.wc-world-cover-field__preview` | Cuadrado de 4,5 rem con borde `--border`, `--surface-sunken` y `overflow: hidden`. |
| `.wc-world-cover-field__preview--empty` | Centra el icono y el texto de vacío. |
| `.wc-world-cover-field__actions` | Fila de botones con `flex-wrap`. |
| `.wc-world-header__cover` | Columna de la cabecera: miniatura + botón. |
| `.wc-image-picker__item` (modificado) | `position: relative` para la insignia; conserva borde, `aria-pressed` y foco. |
| `.wc-image-picker__badge` | Insignia «Portada» opaca con check, 16 px de icono. |
| `.wc-image-picker__skeleton` | Esqueleto 1:1 para la carga (o modificador de `.wc-skeleton--block`). |
| `.wc-image-picker__state` | Contenedor compacto para vacío/error dentro del diálogo. |

No se renombra `.wc-image-picker`; se amplía. No se crean variables CSS.

## 10. Persistencia y dependencias de implementación

El diseño no fija canales IPC, pero sí el resultado visible y estas condiciones
técnicas, que `tdd-ddd-architect` debe resolver:

1. **`WorldUpdateInput` debe aceptar `coverAssetId?: string | null`.** Hoy no lo
   acepta (`src/shared/contracts/worlds.ts`, líneas 91–104), aunque
   `WorldDetail` ya lo devuelve. El proceso principal valida que el asset
   exista y pertenezca al mundo; `null` quita la portada. La creación no lo
   acepta.
2. **La página del mundo persiste al elegir.** Puede ser una extensión de
   `worlds:update` o un canal específico de portada; en cualquier caso, la
   respuesta debe devolver el mundo actualizado para repintar la cabecera y la
   lista, y un fallo no debe dejar la portada a medias.
3. **El formulario persiste al guardar.** `FormValues` incorpora
   `coverAssetId`; `toFormValues` lo lee de `world.coverAssetId`; el envío lo
   incluye en modo edición. Cancelar descarta el cambio de portada, pero no las
   imágenes importadas.
4. **`assets:list` y `assets:import` ya existen** y son suficientes. No se crea
   un canal de assets nuevo.
5. **`WorldPage` necesita `onNotify` y un callback de cambio de portada** desde
   `App.tsx`, además de cargar assets al abrir el selector. La página sigue
   siendo presentacional en lo demás.
6. **Extracción del `AssetPickerDialog`:** la ficha migra su bloque inline
   (~1661–1708 de `entity-detail-page.tsx`) al componente compartido y retira
   las cadenas duplicadas. No cambia el resto de la ficha.
7. **Manual y sistema de diseño:** el cambio es visible; el manual debe
   explicar elegir, cambiar y quitar la portada, la diferencia entre creación y
   edición y que quitar la portada no borra la imagen. El sistema de diseño
   debe recoger la acción de portada en la cabecera del mundo (§10.3) y el
   `AssetPickerDialog` en §9.

## 11. Criterios de aceptación visual

- [ ] En creación no hay ningún control de portada enfocable; solo el título y
      la explicación.
- [ ] En edición, elegir una imagen actualiza la vista previa al instante; el
      cambio solo persiste con «Guardar cambios»; «Cancelar» conserva la
      portada anterior.
- [ ] «Quitar portada» en el formulario deja el pozo vacío y se anuncia al
      guardar.
- [ ] En la página, «Elegir/Cambiar portada» abre el selector; elegir o quitar
      se persiste y se anuncia; la cabecera y la tarjeta de Inicio muestran la
      nueva miniatura tras refrescar.
- [ ] Un fallo al persistir deja la portada anterior y muestra el aviso de
      error; no hay estados intermedios ni miniaturas rotas por un `null`.
- [ ] Todos los `<img>` de portada y selector usan `assetUrl(id, 'thumb')`;
      ninguna petición usa `assetUrl(id)` (original).
- [ ] La miniatura seleccionada se distingue por borde de acento, insignia
      «Portada» con texto y check, además de `aria-pressed`.
- [ ] En Claro y Oscuro no hay texto ni superficie invisible; la insignia y el
      botón cumplen AA; el foco es visible.
- [ ] A 1024, 1280 y 1600 px `document.documentElement.scrollWidth <=
      window.innerWidth`; el diálogo no desborda y su pie queda visible a
      1024×700.
- [ ] El selector funciona con Tab, Enter, Espacio y Escape; el foco vuelve al
      disparador; Escape cierra solo la capa superior.
- [ ] axe no reporta errores críticos en el formulario, la cabecera y el
      selector.
- [ ] Con `prefers-reduced-motion: reduce` no hay animación nueva; el
      esqueleto y el spinner se detienen.
- [ ] No hay colores literales, ni tokens nuevos, ni `opacity` para
      deshabilitar.
- [ ] Los textos salen de `messages/es.ts`; no hay cadenas visibles en los
      componentes.

## 12. Riesgos y decisiones abiertas

| Riesgo | Severidad | Mitigación |
|---|---|---|
| La cabecera del mundo gana una acción y contradice §10.3 («no declara acciones»). | Media | Excepción registrada en este contrato y en el sistema de diseño; es una acción del bloque de portada, no una acción de página, y no compite con «Nueva ficha». |
| La columna de portada ensancha la cabecera a 1024 px y puede estrechar el resumen. | Baja | Columna de ~7–8 rem; cuerpo `minmax(0, 1fr)`; resumen y géneros ya envuelven. Verificar con texto largo y tamaño «Grande». |
| Insignia de selección ilegible sobre fotos claras u oscuras. | Media | Fondo opaco `--surface-raised` + texto `--fg` + borde `--border-strong`; no se usa translucidez. |
| Escape del selector cierra también el formulario. | Alta | Selector anidado que consume el Escape y llama a `preventDefault`; el `Dialog` padre ya ignora eventos con `defaultPrevented`. Probar ambos órdenes de apertura. |
| Pérdida del foco al cerrar el selector o al cambiar la etiqueta del botón. | Media | Devolver el foco al disparador; el nodo del botón se conserva al cambiar «Elegir»/«Cambiar». |
| Importar imágenes desde el formulario las guarda aunque se cancele el mundo. | Baja | Comportamiento documentado; no se pierde nada. Si el producto no lo acepta, deshabilitar `onImport` en el formulario y remitir a la página. |
| Miniatura rota si el asset de portada desaparece o la lectura falla. | Media | Recomendado: `onError` en `WorldMark` que vuelva a la marca procedural; no es imprescindible para #115, pero evita un hueco vacío. |
| Muchas imágenes en el mundo hacen largo el selector. | Baja | El cuerpo del diálogo ya tiene scroll vertical; la rejilla es de 4 columnas. No se añade paginación en #115. |
| `aria-pressed` se pierde al cerrar el selector antes de que el lector lo anuncie. | Baja | El resultado se anuncia con el toast o la región viva; el estado se conserva en la siguiente apertura. |

**Decisiones abiertas para el usuario:**

1. ¿El encuadre 1:1 centrado es suficiente o se quiere un recorte ajustable
   (arrastrar/zoom) en una issue posterior? En #115 se asume 1:1 centrado.
2. ¿Se permite importar desde el selector del formulario, con la consecuencia
   de que la imagen queda guardada aunque se cancele? La recomendación es sí,
   documentado.
3. ¿La acción de portada debe ir también en el menú `⋯` como alternativa
   textual? La recomendación es no: un solo lugar visible, el bloque de
   portada.

## 13. Fuera de alcance

- Editor de recorte, zoom o punto focal.
- Galería de imágenes a nivel de mundo fuera del selector de portada.
- Borrado de assets desde el selector.
- Cambiar la proporción de `WorldMark` en tarjeta o cabecera.
- Portada en creación antes de que el mundo exista.
- Animaciones, transiciones o arrastrar y soltar.
- Cualquier cambio en la ficha distinto de consumir el selector compartido.
