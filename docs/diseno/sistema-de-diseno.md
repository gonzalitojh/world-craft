# Sistema de diseño de World Craft

> **Estado:** guía vigente desde el 18/11/2026 para la aplicación de escritorio.
> Los tokens, los componentes base y el shell de escritorio se implementaron en
> la issue #65; las pantallas de dominio llegarán con las issues de UI de M1.
> La matriz visual real, las capturas y la auditoría de todas las pantallas se
> completan en #93; el axe del shell y el E2E de ventana y temas están
> implementados desde #70.
> **Ámbito:** principios visuales, tokens, temas, tipografía, componentes,
> estados, accesibilidad y patrones de escritorio.

## 1. Principios

1. **Taller de cartógrafo.** Papel, tinta, mapas, anotaciones y herramientas de
   mesa. Nada de gradientes morados, cristal o estética de panel de control
   genérico.
2. **Contenido primero.** La interfaz se aparta cuando el usuario escribe,
   dibuja o conecta ideas.
3. **Dos temas, una identidad.** Claro y Oscuro comparten jerarquía, tokens y
   contraste; no son dos productos distintos.
4. **Densidad de escritorio.** Hay espacio para paneles y tablas; no se diseña
   para pulgares ni para pantallas de 360 px.
5. **Accesible por defecto.** Teclado, foco visible, contraste AA y movimiento
   reducido desde el primer componente.
6. **Sin sorpresas.** Las acciones destructivas se confirman, los estados se
   anuncian y los errores explican qué hacer.

## 2. Ventana y rejilla

- Tamaño mínimo: **1024×700**.
- Referencias de prueba: **1024×700**, **1280×800**, **1600×900** y
  **1920×1080**.
- A 1024, 1280 y 1600 px no hay desplazamiento horizontal de página.
- El desplazamiento horizontal solo se permite dentro de tablas, bloques de
  código y el lienzo del mapa.
- Rejilla base de 4 px; espaciado habitual en múltiplos de 4 y 8.
- Barra lateral: 240 px expandida, 64 px plegada.
- Paneles laterales: 280–360 px, redimensionables donde aporte valor.
- Ancho de lectura del editor: 60–72 caracteres; columna centrada con panel de
  escena opcional.

### 2.1 Shell implementado (#65)

`src/renderer/shell/app-shell.tsx` aplica esas medidas: barra lateral (`aside`)
de 240 px plegable a 64 px, barra superior (`header`) de 56 px y `main` como
destino del enlace de salto, con `tabIndex={-1}` para poder enfocarlo.

- La navegación marca la vista activa con `aria-current="page"` y el botón de
  plegado usa `aria-expanded` y `aria-controls`.
- El rail muestra el logotipo (`src/renderer/assets/world-craft-logo.svg`) como
  imagen con sus propios colores, con el nombre y el lema al lado. El SVG se
  puede sustituir sin tocar el componente; si el logotipo cambia de fondo o de
  paleta, se revisa su legibilidad sobre `--surface` en ambos temas.
- Con el rail plegado, las etiquetas pasan a visualmente ocultas y su texto
  queda disponible como `title`. El estado plegado dura la sesión: todavía no se
  guarda entre reinicios.
- La barra superior muestra el título de la vista y el botón de tema.
- Las vistas son Inicio (`src/renderer/pages/home-page.tsx`) y Muestras
  (`src/renderer/pages/samples-page.tsx`). No hay router: el shell alterna dos
  vistas en una sola ventana.

## 3. Tokens

### 3.1 Capas

| Capa | Archivo | Contenido |
|---|---|---|
| Paleta | `src/renderer/styles/tokens/palette.css` | Única fuente de colores hex y de los valores con alfa (sombras y velo). |
| Semántica | `src/renderer/styles/tokens/semantic.css` | Roles (`--bg`, `--fg`, `--surface`...). Sin hex. |
| Escalas | `src/renderer/styles/tokens/scales.css` | Espaciado, radios, tipografía, movimiento, capas y medidas del shell. |
| Tema | `:root`, `[data-theme="light"]` y `[data-theme="dark"]` en `semantic.css` | Overrides agrupados por rol. |

Los tres archivos existen desde #65 y se importan en ese orden en
`src/renderer/main.tsx`, antes de `base.css` y `components.css`. `palette.css` es
la única capa con colores literales; `scales.css` no declara ningún valor
cromático y las sombras y el velo toman su color de la paleta.

### 3.2 Roles semánticos

| Token | Papel en tema claro | Papel en tema oscuro |
|---|---|---|
| `--bg` | Fondo base (resuelve a `--paper`) | Fondo base (resuelve a `--ink`) |
| `--fg` | Texto base (resuelve a `--ink`) | Texto base (resuelve a `--paper`) |
| `--paper` | Superficie principal | Texto principal |
| `--ink` | Texto principal | Superficie principal |
| `--surface` | Superficie secundaria | Superficie elevada |
| `--surface-raised` | Tarjetas y paneles | Tarjetas y paneles |
| `--border` | Bordes y separadores | Bordes y separadores |
| `--muted` | Texto secundario | Texto secundario |
| `--accent` | Acento principal | Acento principal |
| `--accent-strong` | Acento con más contraste | Acento con más contraste |
| `--accent-contrast` | Texto sobre acento | Texto sobre acento |
| `--accent-surface` | Fondo tintado de acento | Fondo tintado de acento |
| `--success` | Éxito | Éxito |
| `--success-surface` | Fondo tintado de éxito | Fondo tintado de éxito |
| `--warning` | Aviso | Aviso |
| `--warning-surface` | Fondo tintado de aviso | Fondo tintado de aviso |
| `--danger` | Error o destructivo | Error o destructivo |
| `--danger-surface` | Fondo tintado de error | Fondo tintado de error |
| `--focus` | Anillo de foco | Anillo de foco |
| `--selection` | Fondo de selección | Fondo de selección |

`--paper` y `--ink` son la excepción deliberada: intercambian su papel entre
temas para conservar la identidad papel/tinta. Los componentes no eligen entre
ellas: usan `--bg` y `--fg`, que ya resuelven el par en el tema activo y
mantienen 16,61:1 en Claro y en Oscuro. El resto de roles tiene **un solo papel
por tema** y un override agrupado; no se usa una variable como fondo en un tema
y como texto en el otro sin comprobar los dos.

### 3.3 Velo y controles deshabilitados

- `--overlay`: negro cálido translúcido para el velo de los diálogos modales.
  No depende de `--ink` porque esa variable se invierte; su color vive en la
  paleta junto a las sombras y oscurece en ambos temas.
- `--disabled-surface` y `--disabled-text`: superficie y texto de un control
  deshabilitado, resueltos con la superficie secundaria y el texto `--muted`,
  sin `opacity`. El texto sigue leyéndose (5,04:1 en claro y 7,99:1 en oscuro).

### 3.4 Colores de tipos de entidad

Cada tipo de entidad tiene un color accesible en ambos temas. El color se usa
en el icono, la etiqueta y el nodo del grafo; nunca es el único indicador de
estado. Se eligen de una paleta limitada y se validan con contraste.

Desde #73 el modelo solo admite cuatro tokens (`moss`, `ochre`, `danger` y
`prussian`) y una lista cerrada de nombres de icono Lucide. No se guardan hex
libres: el renderer resuelve el token con las variables de tema y el icono se
dibuja con el conjunto permitido. La UI de tipos y fichas de #74 aplicará esta
correspondencia y la revisión visual de #93 comprobará contraste y tamaño.

### 3.5 Verificación automática

`tests/unit/design-tokens.test.ts` lee los CSS reales, resuelve los tokens de
cada tema y calcula el contraste WCAG 2.2 con la fórmula de luminancia relativa.
Comprueba:

- Los ratios de texto principal (≥ 7:1), roles secundarios y de estado
  (≥ 4,5:1) y foco y bordes (≥ 3:1) en Claro y Oscuro.
- Que `--bg`/`--fg` superen 7:1 y que el deshabilitado se lea sin `opacity`.
- Que solo `palette.css` declare colores literales y que toda referencia a la
  paleta exista.
- Que ningún componente use `--ink` como color de texto ni como fondo de
  superficie.
- Que exista `prefers-reduced-motion` y que `html`/`body` no usen
  `overflow-x: hidden`.

La tabla completa de parejas y ratios vive en el test y en el informe de la
issue #65; no se duplica aquí.

## 4. Tipografía

| Uso | Fuente | Tamaño mínimo | Peso |
|---|---|---|---|
| Display y títulos | **Fraunces** | 24 px | 600 |
| Texto de interfaz | **Inter** | 13 px | 400/500 |
| Datos y código | **JetBrains Mono** | 12 px | 400 |

- Interlineado de 1,4–1,6 en texto corrido.
- El texto de 13 px solo se usa en metadatos; el cuerpo va a 14–16 px.
- No se usan mayúsculas sostenidas en párrafos largos.
- Las fuentes se empaquetarán con la aplicación; no se cargan de Internet.
- Las pilas viven en `src/renderer/styles/tokens/scales.css` y ponen Fraunces,
  Inter y JetBrains Mono como primera opción, con respaldo local del sistema
  (Georgia, Segoe UI, Consolas...).
- **El empaquetado OFL de los archivos de fuente sigue pendiente**: todavía no
  hay `@font-face` ni recursos remotos, así que la app usa las fuentes del
  sistema que estén instaladas. Empaquetarlas es una tarea posterior y no debe
  introducir ninguna URL externa.

## 5. Componentes

### 5.1 Base implementada (#65)

Los componentes son nativos: no hay Radix, shadcn ni dependencias nuevas. Todos
usan solo roles semánticos y escalas, viven en `src/renderer/components/` y se
exportan desde su `index.ts`.

| Componente | Archivo | Qué cubre |
|---|---|---|
| Botón | `button.tsx` | Variantes primaria, secundaria, fantasma y destructiva; tamaño normal y pequeño; carga con `aria-busy`; deshabilitado. |
| Campo de texto | `text-field.tsx` | Etiqueta visible, ayuda y error con `aria-describedby`, `aria-invalid`, lectura, deshabilitado y longitud máxima. |
| Área de texto | `text-area-field.tsx` | Misma semántica que el campo de texto; alto mínimo y redimensionado solo vertical para no romper la ventana. |
| Selector | `select-field.tsx` | `<select>` nativo con etiqueta, ayuda, error y opciones tipadas; hereda teclado y contraste del sistema. |
| Insignia | `badge.tsx` | Tonos neutro, acento, éxito, aviso y peligro; siempre con texto. |
| Tarjeta | `card.tsx` | Superficie con título y tono; nivel de encabezado configurable. |
| Estado vacío | `empty-state.tsx` | Título, descripción y acción opcional; explica qué hacer. |
| Diálogo | `dialog.tsx` | `<dialog>` nativo con `showModal()`, que aporta velo, foco atrapado y cierre con Escape; acciones y botón de cierre. |
| Pestañas | `tabs.tsx` | `tablist`/`tab`/`tabpanel`, `aria-selected`, flechas, Inicio y Fin. |
| Aviso toast | `toast.tsx` | Región con `aria-live="polite"` y `role="status"`; cierre manual. |
| Tooltip | `tooltip.tsx` | Visible con foco y hover, `aria-describedby`, se oculta con Escape. |

`src/renderer/pages/samples-page.tsx` muestra esos componentes con sus estados y
con contenido largo (nombres sin espacios y rutas). Es una **página de
desarrollo** para revisar el sistema de diseño, no una función de producto.

Siguen **previstos**: casilla y radio, panel lateral, menú, tabla y árbol. Se
añadirán cuando las pantallas de M1 y M2 los necesiten.

### 5.2 Dominio de mundos (implementado, #72)

Estos componentes ya existen en `src/renderer/components/worlds/` y se usan en
el dashboard, la lista y la página de un mundo:

| Componente | Archivo | Uso |
|---|---|---|
| Tarjeta de mundo | `world-card.tsx` | Portada o inicial, nombre, estado, resumen, géneros, fecha y acciones con el nombre del mundo en su etiqueta accesible. |
| Diálogo de mundo | `world-form-dialog.tsx` | Crear y editar con validación por campo, ayuda, longitud máxima y nota de portada prevista. |
| Diálogo de duplicado | `world-duplicate-dialog.tsx` | Nombre propuesto y explicación de que la portada no se copia. |
| Confirmación | `world-confirm-dialog.tsx` | Archivar, restaurar y mover a la papelera; el texto explica qué ocurre y si hay recuperación. |
| Actividad | `world-activity-list.tsx` | Acción, mundo y fecha con `Intl`; estados de carga, error y vacío. |

Las páginas `home-page.tsx`, `worlds-page.tsx` y `world-page.tsx` componen esos
elementos. La rejilla de tarjetas usa `repeat(auto-fit, minmax(18rem, 1fr))` y
la ficha del mundo una columna de portada de 10 rem; ambas caben a 1024 px sin
desplazamiento horizontal. Los títulos y resúmenes usan `overflow-wrap` y los
hijos flexibles `min-width: 0`.

### 5.3 Componentes de dominio previstos

Estos componentes **todavía no existen**: llegarán con las pantallas de M1 y M2.

| Componente | Uso |
|---|---|
| Cabecera de ficha | Imagen, nombre, tipo, favorito y menú. |
| Editor de campos | Campos del sistema y personalizados. |
| Selector de relaciones | Buscar fichas y elegir tipo. |
| Nodo de grafo | Avatar, nombre, tipo y estado de selección. |
| Lienzo de mapa | Capas, herramientas y minimapa. |
| Panel de capas | Visibilidad, orden y bloqueo. |
| Árbol de manuscrito | Libros, capítulos y escenas. |
| Editor de escena | Formato, menciones, separadores y contador. |
| Mesa de juego | Dados, tablas y resultado. |
| Paleta de comandos | Búsqueda y acciones rápidas. |

## 6. Temas

### 6.1 Modos

- **Claro:** `--paper` como superficie y `--ink` como texto.
- **Oscuro:** `--ink` como superficie y `--paper` como texto.

No hay modo «sistema» en el MVP. Desde #65 el tema se conmuta en memoria desde
la barra superior: `src/renderer/theme.ts` aplica `data-theme` en `<html>` y los
overrides de `semantic.css` repintan toda la aplicación. El arranque usa Claro
por defecto.

**La preferencia todavía no se recuerda al reiniciar.** Guardarla en
`config.json` y elegirla en Ajustes son tareas posteriores; cuando existan,
deberán aplicarla antes del primer pintado para evitar parpadeo.

Los componentes no usan `--paper` ni `--ink` directamente para fondo y texto
base: usan `--bg` y `--fg`, que resuelven la inversión del par en cada tema.

### 6.2 Reglas

1. Todo componente nuevo se revisa en los dos temas.
2. Ningún texto o superficie queda invisible o por debajo de AA.
3. Los overrides van agrupados por selector y con una sola fuente de verdad.
4. Los colores hardcodeados llevan un comentario que justifica por qué no usan
   variable y se comprueban en ambos temas.
5. Las imágenes y texturas funcionan en ambos temas; si no, se sustituyen por
   un patrón CSS.

## 7. Estados

Toda pantalla debe cubrir:

- **Carga:** esqueleto o indicador discreto; no bloquear toda la ventana.
- **Vacío:** explicación y acción principal.
- **Error:** qué ha fallado, qué se conserva y qué hacer.
- **Sin conexión:** no aplica al trabajo local; solo en actualizaciones.
- **Guardando:** indicador no intrusivo y `aria-live`.
- **Guardado:** confirmación breve.
- **Modo seguro:** aviso persistente y acciones de recuperación.
- **Permisos:** no aplica (app de un solo usuario).
- **Conflicto:** no aplica (sin sincronización).

## 8. Accesibilidad

- Contraste mínimo 4,5:1 para texto normal y 3:1 para texto grande y
  componentes gráficos.
- Foco visible con `--focus` en ambos temas.
- Navegación completa por teclado; sin trampas de foco.
- HTML semántico y landmarks (`main`, `nav`, `aside`, `header`).
- Formularios con etiqueta, ayuda y error asociados.
- `aria-live` para guardado, errores y resultados de acciones largas.
- `prefers-reduced-motion`: sin animaciones esenciales ni desplazamientos
  automáticos.
- axe sin errores críticos en las pantallas principales.
- Los atajos se documentan y no chocan con los del sistema.
- El shell incluye un enlace «Saltar al contenido principal» visible al foco y
  `main` enfocable (`tabIndex={-1}`); las pestañas, el diálogo y el tooltip
  tienen navegación de teclado propia (flechas, Inicio/Fin y Escape).

## 9. Movimiento

- Duración habitual: 120–200 ms.
- Curvas suaves; sin rebotes exagerados.
- El movimiento explica un cambio (panel que se abre, elemento que se mueve),
  no decora.
- Con movimiento reducido, los cambios son instantáneos o un fundido mínimo.
- No hay animaciones en bucle ni parallax.

## 10. Patrones de escritorio

- **Ratón:** clic para seleccionar, doble clic para abrir, clic derecho para
  menú contextual cuando aporte.
- **Teclado:** `Ctrl+N` nueva ficha, `Ctrl+S` guardar, `Ctrl+K` paleta de
  comandos, `Ctrl+Z` deshacer, `F1` ayuda. Los atajos se documentan en la app.
- **Paneles:** se pueden plegar; el estado se recuerda por pantalla.
- **Ventanas:** una sola ventana principal; los diálogos no se salen de ella.
- **Arrastrar y soltar:** para reordenar escenas, capas y fichas; siempre hay
  alternativa por teclado.
- **Tablas:** ordenación, filtros y selección; el scroll horizontal queda dentro.

## 11. Contenido y textos

- Todos los textos visibles van en el catálogo tipado de i18n.
- Tono cercano, directo y sin jerga técnica.
- Los errores explican la causa y la acción, no solo un código.
- Los botones usan verbos: «Crear mundo», «Guardar copia», «Restaurar».
- Las acciones destructivas nombran el objeto y la consecuencia.

## 12. Verificación

Desde #65 existe una verificación automática de tokens y contraste
(`tests/unit/design-tokens.test.ts`, 14 pruebas). Desde #70,
`tests/e2e/accessibility.spec.ts` ejecuta axe sobre el shell en Claro y Oscuro,
`tests/e2e/shell.spec.ts` comprueba la ventana a 1024, 1280 y 1600 px sin scroll
horizontal y `tests/e2e/entities.spec.ts` hace lo mismo con la lista y la ficha,
incluidos sus componentes y ambos temas. La matriz visual real, las capturas y la auditoría de todas las
pantallas **siguen pendientes** de #93 y de la revisión local; no deben darse por
hechos.

Antes de cerrar una issue de UI:

- [ ] Captura o revisión en Claro y Oscuro.
- [ ] Ventana a 1024, 1280 y 1600 px sin scroll horizontal de página.
- [ ] Contraste AA comprobado.
- [ ] Teclado y foco revisados.
- [ ] axe sin errores críticos.
- [ ] Movimiento reducido comprobado.
- [ ] Textos en el catálogo, sin cadenas dispersas.
- [ ] Estados de carga, vacío y error.
- [ ] Manual actualizado si el cambio es visible.

## 13. Documentos relacionados

- [Arquitectura](../arquitectura.md)
- [Plan de pruebas](../calidad/plan-de-pruebas.md)
- [Internacionalización](../internacionalizacion.md)
- [Manual de usuario](../manual-de-usuario.md)
- [ADR 0006](../adr/0006-two-themes-desktop-design-system.md)
