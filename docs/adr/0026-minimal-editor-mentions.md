# ADR 0026 — Editor mínimo, menú Formato y menciones `@` / `[[ ]]`

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-23
- **Fecha del documento:** 2026-11-23
- **Issue:** #131 (`M1.5-08`), dentro del epic #123 (`M1.5-00`)
- **Decisiones del registro:** D-049
- **Decisores:** usuario / agentes
- **Relacionados:** ADR 0007, ADR 0021, ADR 0023, ADR 0025
- **Contrato visual:** [`docs/diseno/editor-issue-131.md`](../diseno/editor-issue-131.md)
- **Reutilización prevista:** #85 (editor de manuscritos de M3)

## Contexto

La descripción de una ficha se edita con Tiptap 3 desde #74 (ADR 0021) y la ficha
se lee como documento desde #129. El editor heredado mostraba **once controles**
—negrita, cursiva, título 1–3, viñetas, numerada, cita, enlace, quitar enlace y
abrir enlace— y solo permitía enlazar fichas mediante un diálogo. La barra
competía con el texto y contradecía la dirección visual v2 (ADR 0025), que pide
jerarquía por espacio y contraste y no por acumulación de botones.

La issue #131 pedía tres cosas a la vez:

1. reducir la barra a las acciones esenciales, con las avanzadas en un menú;
2. permitir **mencionar fichas escribiendo** `@` o `[[`, sin abandonar el
   teclado y sin insertar HTML;
3. dejar un **componente reutilizable** para el manuscrito de M3 sin implementar
   manuscritos en esta tarea.

El stack ya incluía `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`
y `@tiptap/pm`. El documento se valida en `src/shared/entities/description.ts`
con una lista cerrada de nodos y marcas, enlaces internos `wc-entity://<uuid>` de
80 caracteres como máximo y rechazo de HTML. No había que cambiar datos, IPC ni
esquema: una mención es exactamente un texto con la marca `link` que ya se
valida.

Las restricciones de accesibilidad eran el punto delicado: un `contenteditable`
multipárrafo que se anuncia como `combobox` mientras mantiene el foco y navega
con `aria-activedescendant`, sin romper atajos ni composición IME.

## Decisión

1. **Typeahead con plugin propio sobre `@tiptap/pm`**, sin añadir
   `@tiptap/suggestion`. El plugin vive en
   `src/renderer/components/editor/extensions/mention.ts` y controla el estado
   abierto, el disparador, la consulta y la opción activa. Se elige porque
   necesitamos dos disparadores con reglas distintas (`@` solo tras inicio,
   espacio o puntuación de apertura; `[[` en cualquier posición), límites propios
   y una accesibilidad combobox/listbox que habría que escribir igualmente.
2. **Barra mínima permanente de cinco acciones** en este orden: Negrita,
   Cursiva, Formato, Enlace y Mención. Títulos, listas, cita, «Abrir enlace» y
   «Quitar enlace» viven solo en el menú **Formato**. La formulación anterior
   «sin barra de herramientas permanente» del sistema v2 queda corregida: lo que
   se retira es la barra extensa de once controles y cualquier segunda fila, no
   una barra mínima de una sola fila. La barra no se oculta al perder el foco ni
   al desplazarse.
3. **Menú Formato con tres bloques** y roles ARIA estables: Párrafo y Título 1–3
   como `menuitemradio` con `aria-checked`, listas y cita como
   `menuitemcheckbox`, y Abrir/Quitar enlace como `menuitem` deshabilitados
   cuando el cursor no está en un enlace. Reutiliza el primitivo `Menu` existente
   con flechas, `Inicio`/`Fin`, `Escape` con retorno de foco y posicionamiento con
   volteo.
4. **Patrón combobox/listbox en un `contenteditable`.** En edición el nodo de
   ProseMirror lleva `role="combobox"`, `aria-expanded` y `aria-controls`
   **siempre presentes**, `aria-autocomplete="list"`, `aria-activedescendant` solo
   con una opción activa y `tabindex="0"`. **No lleva `aria-multiline`**, porque
   el rol `combobox` no lo admite y axe lo señala. El `listbox` existe siempre en
   edición, **no es descendiente del combobox** —vive en `.wc-mention`, dentro de
   la superficie del editor—, se relaciona con él mediante `aria-controls` y se
   oculta con `hidden` y `display: none`. El foco permanece en el editor durante
   toda la navegación.
5. **Inserción en una sola transacción, sin HTML.** Al elegir una opción se
   reemplaza el disparador y la consulta por el nombre de la ficha con la marca
   `link` y `href` `wc-entity://<uuid>`, más un espacio sin marca para que lo
   escrito después no herede el enlace. Se hace con una transacción de
   ProseMirror (`replaceWith`), sin HTML ni contenido remoto. `insertContent` solo
   se usa con el literal `@` del botón Mención y con el nodo de mención ya
   construido desde el diálogo de enlace; nunca con HTML ni con contenido de
   usuario sin validar. `Escape` cierra sin borrar el texto, y una inserción
   equivale a un solo paso de deshacer.
6. **`]]` no se acepta como cierre.** La consulta de `[[` termina al insertar,
   con `Escape`, al mover el cursor fuera del rango o al teclear `[`, `]` o un
   salto de bloque; en ese caso el selector se cierra sin insertar y el texto
   queda para que el usuario lo corrija. Aceptar `]]` como cierre exige una
   decisión de producto nueva y otro ADR.
7. **Universo de menciones acotado a las fichas ya cargadas** para la ficha, con
   un máximo de 200 y sin la ficha actual, **incluidas archivadas y borradores**
   para mantener la paridad con el diálogo de enlace existente. No hay consulta
   por tecla, estado de carga ni error de red: el filtrado es síncrono y local.
8. **Componente reutilizable `RichTextEditor`** en
   `src/renderer/components/editor/`. Recibe documento, etiqueta, candidatas,
   ayuda, estado deshabilitado y modo lectura, y notifica cambios y aperturas de
   enlaces; no conoce la página de fichas ni el autoguardado. El manuscrito de M3
   podrá usarlo con la misma API.
9. **Sin cambios de datos, IPC ni esquema.** No hay migración, canal ni tabla
   nueva; el renderer sigue sin acceso a Node y la mención se valida con la
   función compartida de #74.
10. **Se añade `@tiptap/core` como dependencia directa** porque el plugin y la
    extensión lo importan explícitamente. Ya estaba en el árbol como dependencia
    de `@tiptap/react`, `@tiptap/starter-kit` y `@tiptap/extension-link`; es MIT y
    no incorpora paquetes nuevos.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| `@tiptap/suggestion` como base del typeahead | Añade una extensión para resolver la parte fácil (posición y ciclo de vida) y deja fuera lo que diferencia a esta tarea: dos disparadores con límites distintos, consulta acotada a 60 caracteres, cierre por `]`, control del foco y anuncio de resultados. Habríamos escrito igualmente casi todo y con menos control del `combobox`. |
| `BubbleMenu` flotante sobre la selección | Duplica acciones de la barra, aparece y desaparece al mover el cursor y añade una dependencia de posicionamiento. Además compite con el popup de menciones y con el menú Formato por la misma capa y el mismo foco. |
| Comandos de barra con `/` | Colisiona con la prosa (fechas, rutas, fracciones) y con el diálogo de enlace; un escritor escribe barras con normalidad. Se descarta frente a dos disparadores explícitos. |
| Mantener la barra de once controles y añadir solo el typeahead | No resuelve el problema visual ni la densidad de acciones; contradice la dirección v2 y la regla de una sola forma de hacer cada cosa. |
| Editor propio sobre `contenteditable` sin Tiptap | Reimplementa selección, historial, esquema y serialización ya resueltos, con más superficie de seguridad y de accesibilidad. Tiptap ya era una decisión aceptada (ADR 0007). |
| Nodo de mención propio en el esquema | Obligaría a migrar el documento validado de #74 y a cambiar la exportación; una mención es un enlace interno y no necesita semántica distinta. Se conserva texto con marca `link`. |
| Buscar fichas en el proceso principal en cada tecla | Introduce IPC nuevo, latencia y estados de carga para un universo que ya está en memoria. La búsqueda asíncrona queda como follow-up si el universo crece. |
| Insertar HTML con `insertContent` | Prohibido por las reglas del proyecto y por la validación compartida; además impide controlar marcas y deshacer con precisión. |

## Consecuencias

### Positivas

- La barra deja de competir con el texto: una fila, cinco acciones y las
  avanzadas donde se buscan.
- Mencionar una ficha es escribir `@` o `[[` y elegir; no hay diálogo paralelo
  ni dos formas de hacer lo mismo.
- La mención insertada es el enlace interno que ya se validaba: sin esquema
  nuevo, sin migración y sin HTML.
- El componente `RichTextEditor` separa editor y página, y deja M3 sin
  reimplementar barra, menciones ni accesibilidad.
- El patrón combobox/listbox con foco en el editor es verificable con axe y con
  teclado, y evita trampas de foco dentro de un campo de texto.
- Cero dependencias nuevas en el árbol: `@tiptap/core` ya estaba presente.

### Negativas y riesgos

- El editor es multipárrafo pero se anuncia como `combobox` sin
  `aria-multiline`; es la restricción de axe y conviene comprobarlo con lector de
  pantalla.
- El `listbox` siempre montado exige mantener `hidden` **y** `display: none`;
  una regla de estilo futura que anule uno de los dos lo devuelve al árbol de
  accesibilidad.
- La búsqueda es parcial en mundos con más de 200 fichas.
- `]]` no cierra el selector: hay que documentarlo y probarlo, y si el producto
  cambia de opinión hará falta una decisión nueva.
- El plugin propio es código que mantenemos: cambios de ProseMirror o de Tiptap
  pueden exigir ajustes que `@tiptap/suggestion` habría absorbido.
- Un mundo sin otras fichas no ofrece «Crear ficha» desde el selector; el vacío
  solo explica el caso.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Escritorio | Barra de ≈255 px en una sola fila; comprobada a 1024, 1280 y 1600 px sin scroll horizontal de página; popup anclado al cursor con clamp y volteo. |
| Temas (Claro/Oscuro) | Solo roles semánticos; las cinco parejas del editor en la tabla §4.5 del sistema y en el test de tokens, con AA en ambos temas. |
| Accesibilidad | Combobox/listbox con `aria-expanded` y `aria-controls` siempre, `aria-live` para el recuento, foco en el editor, teclado completo y `prefers-reduced-motion`. |
| Seguridad y privacidad | Sin HTML inyectado, sin contenido remoto, sin nuevas superficies del renderer y sin IPC nuevo. |
| Datos y preservación | Sin migraciones ni cambios de dominio; el documento guardado conserva formato y enlaces internos existentes. |
| Coste | 0 €/mes. `@tiptap/core` es MIT y ya estaba en el árbol; no hay servicios ni telemetría. |
| Portabilidad | Sin cambios: la exportación e importación futuras siguen leyendo el mismo documento validado. |

## Riesgos y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| `aria-multiline` retirado en un editor multipárrafo | axe y lectores | Patrón `combobox` documentado, `aria-label` de la descripción y comprobación manual con NVDA | #131, #133 |
| `listbox` siempre montado | Árbol de accesibilidad | `hidden` y `display: none` en la misma regla, con test de lectura y de popup cerrado | #131 |
| Búsqueda parcial con más de 200 fichas | Mundos grandes | Limitar a las candidatas ya cargadas y documentar la limitación; búsqueda asíncrona como follow-up | #131, M5 |
| `]]` no cierra el selector | Expectativa del usuario | Probado, documentado en el manual y en el contrato; cambio futuro con ADR | #131 |
| Plugin propio que envejece | Mantenimiento | Aislado en una extensión con pruebas unitarias de consulta y contenido | #131 |
| Selector dentro de un enlace | Inserción ambigua | No se abre dentro de una marca de enlace; el botón Mención sale antes de insertar y se prueba | #131 |
| Regresión visual al integrar barra y campo | Temas y ventana | Contrato C1–C28, capturas en ambos temas, matriz 1024/1280/1600 y axe | #131, #133 |

No hay riesgos de free tier: la decisión no añade servicios, cuentas ni
dependencias de pago.

## Plan de revisión

- Se revisa si cambia el conjunto de acciones de la barra, la semántica de las
  menciones o el universo de candidatas.
- Si se adopta `]]` como cierre, búsqueda asíncrona o «Crear ficha» desde el
  selector, se reabre con una issue de producto y un ADR nuevo.
- La reutilización en el manuscrito de M3 (#85) puede revisar la API de
  `RichTextEditor`, no la decisión de fondo.
- La auditoría visual de #133 comprueba contraste, ventana y ruido del editor.

## Referencias

- Issue: #131
- [`docs/diseno/editor-issue-131.md`](../diseno/editor-issue-131.md), contrato
  visual C1–C28
- [`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md), §4.5,
  §9, §10.6 y §17
- [`docs/manual-de-usuario.md`](../manual-de-usuario.md), §5.3
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-049
- [`docs/adr/0007-tiptap-editor-exporters.md`](0007-tiptap-editor-exporters.md)
- [`docs/adr/0021-entities-crud-gallery-tags-editor.md`](0021-entities-crud-gallery-tags-editor.md)
- [`docs/adr/0023-global-search-fts5-command-palette.md`](0023-global-search-fts5-command-palette.md)
- [`docs/adr/0025-visual-direction-v2.md`](0025-visual-direction-v2.md)
- Epic #123 y issues #74, #85, #129 y #131
- WCAG 2.2, criterios 1.4.3, 1.4.11, 2.1.1, 2.4.7 y 4.1.2, consultados el
  23/11/2026.
