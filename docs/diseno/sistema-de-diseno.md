# Sistema de diseño de World Craft

Guía práctica de los tokens, los componentes base, el shell y el tema. Es el
«cómo se usa» del sistema; el «por qué» de las decisiones vive en el
[ADR 0018](../adr/0018-design-system-tokens-and-shell.md) y en el
[ADR 0010](../adr/0010-two-themes-design-system.md).

La página viva está en `/design-system`: muestra fundamentos, componentes,
patrones, accesibilidad y los enlaces a las capturas de referencia.

---

## 1. Arquitectura de tokens

Los estilos viven en `src/styles/` y `src/app/globals.css` solo los importa.
Cada archivo tiene una responsabilidad y existe una única fuente de verdad por
regla.

| Capa | Archivo | Contenido | Regla |
|---|---|---|---|
| 1. Paleta cruda | `src/styles/tokens/palette.css` | Única fuente de `#hex` y `rgb()`. Cada color existe con sufijo `-light` y `-dark`. | Ningún otro CSS, componente o test declara un color. |
| 2. Escalas | `src/styles/tokens/scales.css` | Tipografía fluida, interlineado, tracking, radios, medidas del shell, capas y movimiento. | No depende del tema. |
| 3. Semántica | `src/styles/tokens/semantic.css` | Asigna un papel a cada color por tema y lo mapea a Tailwind con `@theme inline`. | Solo `var(--craft-*)`, ningún valor literal. |
| 4. Base | `src/styles/base.css` | Borde por defecto, superficie, texto, foco visible, selección y red de seguridad de movimiento reducido. | Se aplica a toda la aplicación. |
| 5. Movimiento | `src/styles/motion.css` | Animaciones de overlays, drawers y avisos. | Todo dentro de `prefers-reduced-motion: no-preference`. |

### Paleta cruda

`--craft-<token>-<tema>`, por ejemplo `--craft-accent-light` y
`--craft-accent-dark`. Agrupa papel y tinta (`paper`, `paper-raised`,
`paper-sunken`, `ink`, `ink-muted`), bordes (`border`, `border-strong`), acento
tierra/ocre (`accent`, `accent-strong`, `accent-ink`, `accent-muted`), estados
(`danger`, `success`, `warning`, `info` con `-ink` y `-surface`) y apoyo
(`focus`, `overlay`, `shadow-tint`).

### Tokens semánticos

Los componentes consumen estos papeles a través de utilidades, nunca la paleta
cruda.

| Grupo | Tokens | Utilidades de Tailwind |
|---|---|---|
| Superficie y texto | `--surface`, `--surface-raised`, `--surface-sunken`, `--foreground`, `--muted-foreground` | `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `text-foreground`, `text-muted-foreground` |
| Bordes | `--border`, `--border-strong` | `border-border`, `border-border-strong` |
| Acento | `--accent`, `--accent-strong`, `--accent-ink`, `--accent-muted` | `bg-accent`, `text-accent`, `bg-accent-muted`, `text-accent-ink` |
| Estados | `--danger`, `--success`, `--warning`, `--info` (+ `-ink`, `-surface`) | `bg-danger-surface`, `text-danger`, `text-success`… |
| Foco y velo | `--focus`, `--overlay` | `outline` global, `bg-overlay` |
| Elevación | `--elevation-card`, `--elevation-dialog`, `--elevation-rail` | `shadow-card`, `shadow-dialog`, `shadow-rail` |

### Escalas y medidas

| Grupo | Tokens |
|---|---|
| Tipografía | `text-display-xl`, `text-display-lg`, `text-display-md`, `text-display-sm`, `text-eyebrow`; familias `font-display`, `font-sans`, `font-mono`. |
| Interlineado y tracking | `leading-display`, `leading-body`, `tracking-display`, `tracking-eyebrow`. |
| Radios | `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`. |
| Shell | `--rail-width`, `--rail-width-collapsed`, `--topbar-height`, `--bottombar-height`, `--content-max`, `--prose-max`, `--gutter`. |
| Capas | `--z-rail`, `--z-topbar`, `--z-overlay`, `--z-dialog`, `--z-toast`. |
| Movimiento | `--duration-fast`, `--duration-base`, `--duration-slow`, `--ease-standard`. |

**La escala display es una sola decisión.** Cada tamaño `text-display-*` lleva
en el token su interlineado **y su peso** (`--text-display-*--font-weight:
600`), así que una pantalla no elige el grosor: lo hereda. El tracking sigue
siendo una utilidad propia (`tracking-display`) y sustituye a `tracking-tight`
en toda la tipografía de familia `font-display`. La jerarquía entre pantallas
sale del tamaño, no de inventar pesos:

| Nivel | Utilidad | Dónde |
|---|---|---|
| Portada | `text-display-xl` + `tracking-display` | `h1` de `/` |
| Página | `text-display-lg` + `tracking-display` | `h1` de login, estado, 404, error y `/design-system` |
| Sección | `text-display-md` + `tracking-display` | `h2` de sección y de la portada |
| Título corto | `text-display-sm` + `tracking-display` | `h2` del bloque de acceso y `h3` de los pilares |

Dentro de un componente (`CardTitle`, `EmptyState`) el título usa `text-lg` de
la familia display con `tracking-display`: el tamaño menor lo mantiene al
servicio del contenido. Ese es el motivo de que `EmptyState` tenga `titleAs`
(`h4` dentro de un `h3`, `p` fuera del índice) y no un tamaño de página.

No se usan `text-4xl`/`text-5xl`/`text-6xl` ni `font-semibold` sueltos en
títulos: romperían la única fuente de verdad del peso.

`src/lib/theme-palette.ts` replica los colores sólidos en TypeScript porque
`themeColor`, el manifest y el cálculo de contraste en servidor no resuelven
variables CSS. `tests/unit/tokens.test.ts` comprueba que cada valor coincide con
`palette.css`.

---

## 2. Reglas de uso

1. **Ningún color literal fuera de `palette.css`.** Si falta un tono, se añade
   en las dos mitades de la paleta, se mapea en `semantic.css` y se comprueba
   el contraste. El test de capas falla si aparece un `#hex` o `rgb()` suelto.
2. **`--craft-*` no se usa en componentes.** Los componentes usan solo
   utilidades semánticas (`bg-surface`, `text-foreground`, `border-border`…).
   La paleta cruda es un detalle de implementación del CSS.
3. **Sin variantes `dark:`.** El tema se resuelve con `[data-theme]` y
   `@theme inline`; una variante `dark:` dispersa el tema por el componente y
   rompe el patrón de selectores agrupados.
4. **`min-w-0` en hijos de flex y grid.** Sin él, un texto largo o una palabra
   sin espacios ensancha la columna y provoca scroll horizontal de página.
   Acompáñalo de `break-words` cuando el contenido pueda ser largo.
5. **Contraste AA.** 4.5:1 para texto normal y 3:1 para texto grande y
   componentes gráficos, verificado en los dos temas.
6. **Foco visible.** Viene de la regla global `:focus-visible` (outline de 2 px
   con offset). Ningún componente lo anula sin sustituto.
7. **Objetivos táctiles de 44 px.** Los controles interactivos usan `h-11` o
   `min-h-11` en móvil.
8. **Textos centralizados.** Todo lo visible, incluidos los `aria-label`, vive
   en `src/messages/es.ts` y se lee con `t()` o `getMessages()` (ADR 0012).
9. **Comprobar siempre los dos temas**, aunque el cambio parezca de uno solo.

---

## 3. Componentes

Están en `src/components/ui/`. Todos consumen tokens semánticos y comprueban
los dos temas.

| Componente | API principal | Variantes y estados | Cuándo usarlo |
|---|---|---|---|
| `Button` | `variant`, `size`, `asChild`, `loading` | `default`, `outline`, `ghost`, `destructive`, `link`; `sm`, `default`, `lg`, `icon`; `disabled`, `loading` con `aria-busy` | Acción principal o secundaria. `asChild` para envolver un `<Link>`. |
| `Input` | Props nativas de `<input>` | Normal, `disabled`, `aria-invalid` | Una línea de texto. Acompáñalo de `Field` para etiqueta y error. |
| `Textarea` | Props nativas de `<textarea>` | Normal, `disabled`, `aria-invalid` | Texto largo (sinopsis, notas). |
| `Select` | Props nativas de `<select>` | Normal, `disabled`, `aria-invalid` | Elegir entre pocas opciones. Es nativo a propósito; no hay Radix Select. |
| `Field` | `label`, `description`, `error`, hijos como función `(control) => …` | Con y sin ayuda o error | Envolver `Input`, `Textarea` o `Select` y asociar etiqueta, ayuda y error. |
| `Card` | `Card`, `CardHeader`, `CardTitle` (`as`), `CardDescription`, `CardContent`, `CardFooter` | — | Agrupar contenido relacionado con superficie elevada. |
| `Badge` | `variant`, `icon` | `neutral`, `accent`, `success`, `warning`, `danger`, `info` | Etiqueta de estado corta, siempre con texto. |
| `EmptyState` | `icon`, `title`, `titleAs`, `description`, `action` | — | «Aquí todavía no hay nada»: explica qué falta y qué hacer. `titleAs` (`h3` por defecto) baja a `h4` bajo un `h3` o a `p` fuera del índice de encabezados. |
| `Dialog` | `Dialog`, `DialogTrigger`, `DialogContent` (`title`, `titleHidden`, `description`), `DialogClose` | Modal con trampa de foco | Confirmaciones y formularios breves. Título obligatorio. |
| `Drawer` | `Drawer`, `DrawerTrigger`, `DrawerContent` (`side`, `title`, `titleHidden`, `description`) | `left`, `right`, `bottom` | Paneles laterales o inferiores; el mismo primitivo que el diálogo. |
| `Tabs` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Pestaña activa con acento | Cambiar de vista sin salir de la página. |
| `Tooltip` | `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` | — | **Solo** botones de icono y rail colapsado. Nunca como única etiqueta. |
| `Toast` | `useToast()` → `toast({ title, description, variant, duration })`, `dismiss(id)` | `info`, `success`, `warning`, `error` | Avisos efímeros. `error` no se cierra solo. |
| `Command` | `CommandPaletteProvider`, `useCommandPalette()`, `CommandPaletteItem` | Abierto por botón o `Ctrl`/`Cmd` + `K` | Paleta de comandos y búsqueda global. |

### Notas por componente

- **`Field`** genera el `id` con `useId` y concatena `aria-describedby` con la
  descripción y el error. La forma de uso es una función hija:
  `<Field label="Nombre">{(control) => <Input {...control} name="name" />}</Field>`.
- **`Dialog` y `Drawer`** exigen `title`; con `titleHidden` el título sigue
  existiendo para lectores de pantalla. Comparten trampa de foco, cierre con
  Escape, bloqueo del scroll de fondo y devolución del foco. El botón de cierre
  se pinta **antes de `children` en el documento** (aunque su posición sea
  absoluta en la esquina): el orden de tabulación coincide con el visual y el
  cierre se alcanza justo después del título. Como Radix enfoca el primer
  elemento tabulable al abrir, el foco inicial es ese cierre; con `Tab` se pasa
  al contenido.
- **`EmptyState`** titula con `h3` por defecto. Cuando cuelga de otro `h3`
  (especímenes del catálogo, tarjetas) se pasa `titleAs="h4"`; en una lista o un
  hueco sin jerarquía de encabezados, `titleAs="p"`.
- **`Toast`** pinta siempre dos regiones `aria-live` vacías al principio
  (`polite` y `assertive`). Los avisos individuales no llevan `role` para evitar
  doble anuncio. El color nunca es la única información: hay icono y texto. En
  móvil, y solo cuando el shell del taller ha pintado la barra inferior, el
  contenedor sube el alto de `--bottombar-height` (regla `:has` en `base.css`):
  un aviso abierto no puede tapar la navegación ni quedarse con sus toques.
- **`Command`** carga `cmdk` con `next/dynamic({ ssr: false })` solo al abrir la
  paleta. La instancia es única y vive en el layout raíz; los botones abren la
  misma paleta mediante contexto. El buscador se autofoca, así que la fila
  entera pinta el foco (`has-[:focus-visible]`): un campo de texto sin indicador
  visible deja a quien navega con teclado sin saber dónde está.
- **`Tabs`** conserva el foco visible del panel (`TabsContent` es enfocable
  porque puede contener contenido desplazable); no se le quita el contorno.

---

## 4. Breakpoints y shell

| Ancho | Navegación | Comportamiento |
|---|---|---|
| < 768 px | Barra inferior fija con tres destinos y «Más» | El rail está oculto; «Más» abre un drawer inferior con acceso, próximamente, licencia y estado. |
| 768–1023 px | Rail colapsado a iconos | `--rail-width-collapsed`; cada icono lleva globo de ayuda y su etiqueta sigue en el árbol de accesibilidad. |
| ≥ 1024 px | Rail completo | `--rail-width`; se ven etiquetas y encabezados de grupo. |

- El shell público y el del espacio de trabajo se separan en los route groups
  `(public)` y `(workspace)`. **Los route groups no cambian las URLs.**
- La **topbar** es `sticky`, ocupa el ancho completo y usa `--topbar-height`.
  En la web pública muestra navegación horizontal o menú móvil; en el taller
  muestra migajas.
- El **`main`** reserva en móvil el alto de la barra inferior más
  `env(safe-area-inset-bottom)`, para que el último elemento siempre se alcance.
  La barra cumple ese alto con `min-h-(--bottombar-height)`: token, reserva del
  `main` y desplazamiento de los avisos miden lo mismo (4,25 rem). El panel
  inferior (`Drawer side="bottom"`) suma el área segura a su relleno
  (`pb-[calc(1.25rem+env(safe-area-inset-bottom))]`) para que la última acción
  no quede bajo la barra del sistema.
- Las **migajas** usan `<nav>` con nombre accesible y una lista ordenada; el
  último elemento lleva `aria-current="page"` y no es enlace.
- `src/lib/navigation.ts` concentra los destinos, los grupos y las rutas
  activas. Un destino sin página se marca `disabled` y se anuncia como no
  disponible: **nunca se pinta un enlace a una ruta inexistente**.
- El **destino activo** del rail y de la barra inferior no se distingue solo por
  color: suma peso tipográfico (`font-semibold`) y una regla de 2 px de
  `--accent` en el borde (izquierda en el rail, superior en la barra), porque el
  acento y el texto atenuado tienen luminancias casi idénticas (1,05:1) y en
  escala de grises serían indistinguibles.
- Los **estados vacíos** (`EmptyState`) son el patrón por defecto para
  secciones sin contenido.

---

## 5. Tema: Claro, Oscuro y Sistema

El selector de la topbar es un `<select>` nativo con etiqueta asociada y tres
opciones:

| Opción | Valor guardado | Comportamiento |
|---|---|---|
| Sistema | `system` | Sigue `prefers-color-scheme` y cambia en vivo si el sistema cambia. |
| Claro | `light` | Fuerza el tema claro. |
| Oscuro | `dark` | Fuerza el tema oscuro. |

Cómo funciona:

1. La preferencia se guarda en `localStorage` bajo la clave `wc-theme`.
2. Un `<script>` en línea en el layout raíz la lee **antes del primer pintado**
   y escribe `<html data-theme>` (lo que se pinta) y
   `<html data-theme-preference>` (lo que se eligió). No se usa `next/script`
   con `beforeInteractive`: en esta versión de Next el script llega tarde y el
   tema claro parpadea antes de aplicar el oscuro.
3. Si no hay preferencia guardada, el valor por defecto es «Sistema».
4. Sin JavaScript, `:root` sirve el tema claro completo y la aplicación se ve
   bien; el script solo añade el oscuro.
5. `ThemeProvider` lee el DOM con `useSyncExternalStore`; no vuelca su estado
   desde un efecto, para no sobrescribir la preferencia durante la hidratación.
6. `themeColor` y el manifest no resuelven variables CSS: sus colores salen de
   `src/lib/theme-palette.ts`, verificado contra la paleta.

Para comprobarlo: cambia de tema en la topbar y recarga; la preferencia se
mantiene. Con «Sistema», cambia el tema del sistema operativo y la página
responde sin recargar.

---

## 6. Accesibilidad

- Un solo `h1` por página, landmarks `header`/`main`/`footer` y enlace «Saltar
  al contenido» como primer elemento enfocable.
- Cada `section` con nombre de la página viva lleva un nombre accesible
  distinto (`landmark-unique` de axe): por eso los dos estados vacíos se titulan
  «Estado vacío en un componente» y «Estado vacío en una página».
- Foco visible global y navegación completa por teclado, sin `tabIndex`
  positivos.
- Diálogo, drawer, pestañas y globo de ayuda se apoyan en primitivos de Radix:
  roles, trampa de foco, Escape, flechas e Inicio/Fin ya están resueltos.
- El globo de ayuda nunca es la única etiqueta: el disparador lleva su propio
  `aria-label`.
- En diálogo y panel, el cierre se tabula antes del contenido porque va antes en
  el documento: el orden del teclado coincide con lo que se ve.
- Ningún control anima `outline-color`: la transición se limita a color, fondo
  y borde, así el anillo de foco aparece directamente con el token `--focus` y
  no arranca con el color del texto.
- Los avisos usan dos regiones `aria-live` persistentes; el color nunca es la
  única señal.
- `prefers-reduced-motion` anula animaciones y transiciones; el movimiento
  intencionado solo se declara si el usuario no pide reducirlo.
- `axe` se ejecuta en E2E sobre las rutas principales y en los dos temas.

Cuando la tarea toque interfaz, comprueba a ~360, ~768 y ~1280 px con el modo
dispositivo de DevTools y confirma en consola:

```js
document.documentElement.scrollWidth <= window.innerWidth
```

debe devolver `true`.

---

## 7. Dependencias y por qué

| Dependencia | Versión | Uso | Por qué |
|---|---|---|---|
| `@radix-ui/react-dialog` | 1.3.1 | Diálogo y drawer | Trampa de foco, Escape, devolución del foco y bloqueo de scroll resueltos. El drawer reutiliza el mismo primitivo en lugar de añadir Vaul. |
| `@radix-ui/react-tabs` | 1.2.1 | Pestañas | Roles, `aria-selected`, `aria-controls` y navegación con flechas. |
| `@radix-ui/react-tooltip` | 1.4.1 | Globo de ayuda | Solo para botones de icono y rail colapsado. |
| `cmdk` | 1.1.1 | Paleta de comandos | Búsqueda y navegación por teclado, cargada de forma diferida. |
| `@radix-ui/react-slot` | 1.5.0 | `Button asChild` | Permite renderizar un `<Link>` con los estilos del botón. |
| `class-variance-authority` | 0.7.1 | Variantes | Declara variantes tipadas sin condicionales dispersos. |
| `lucide-react` | 1.72.0 | Iconos | Iconos libres, importados por nombre. |

Todas son MIT y compatibles con React 19. **No se instala Motion**: las
animaciones necesarias caben en `motion.css`. **No se instala sonner ni Radix
Toast**: el aviso propio cubre las dos regiones `aria-live` y la pausa al
enfocar. La decisión completa está en el
[ADR 0018](../adr/0018-design-system-tokens-and-shell.md).

---

## 8. Capturas de referencia

Las cuatro imágenes documentan la primera pantalla de `/design-system` en dos
anchos y dos temas:

- [Escritorio, tema claro](capturas/design-system-1280-light.png)
- [Escritorio, tema oscuro](capturas/design-system-1280-dark.png)
- [Móvil, tema claro](capturas/design-system-360-light.png)
- [Móvil, tema oscuro](capturas/design-system-360-dark.png)

Se regeneran con:

```bash
corepack pnpm design:captures
```

El comando ejecuta solo el proyecto `captures` de Playwright, que fija el
viewport (1280×800 y 360×800), `deviceScaleFactor: 1`, movimiento reducido y el
tema inyectado en `localStorage` antes del primer pintado. Espera a que las
fuentes estén cargadas y la isla de tema esté hidratada, y comprueba que no hay
scroll horizontal antes de disparar la captura. La suite funcional
(`pnpm test:e2e`) ignora las capturas a propósito.

Las imágenes se comparan entre versiones: un cambio de tokens, tipografía o
shell debería notarse ahí.

---

## 9. Deudas aceptadas

- **Sin sincronización de tema entre pestañas.** Cambiar el tema en una pestaña
  no afecta a las demás hasta recargar.
- **Etiqueta del selector oculta por debajo de `sm`.** A 360 px solo se ve el
  valor («Sistema», «Claro», «Oscuro»); el nombre accesible sigue siendo «Tema»
  porque la etiqueta es `sr-only`, pero el control se entiende por contexto.
- **Selector de tema duplicado en `/design-system`.** La topbar y el espécimen
  «Tema» montan dos instancias del mismo `ThemeSelector`; es intencionado en la
  página de muestra, no un patrón para las pantallas de producto.
- **`format:check` sensible a CRLF en local.** En Windows puede fallar sin que
  haya un cambio real de formato.
- **`error` y `loading` solo en unitarias.** No tienen E2E propio todavía.
- **Claves `common.*` sin uso.** Reservadas para piezas compartidas futuras.
- **Textura de papel aplazada a M1-02** (issue #12).
- **Tokens de entidad aplazados a M1-03** (issue #13).
- **CSP con `nonce` o hash pendiente de M1-01** (issue #11): el script de tema
  es en línea y necesita una política que lo autorice.

---

## 10. Manual de usuario

Todavía no existe un manual de usuario. Se creará como esqueleto en M0-09
(issue #10) y cubrirá, entre otros:

- **Navegación y estructura:** rail, topbar, barra inferior, «Más», migajas y
  estados vacíos.
- **Temas:** Claro, Oscuro y Sistema, persistencia y respeto a la preferencia
  del sistema.
- **Paleta de comandos:** atajo `Ctrl`/`Cmd` + `K` y búsqueda de destinos.

Hasta entonces, esta guía y la página `/design-system` son la referencia
interna del sistema.
