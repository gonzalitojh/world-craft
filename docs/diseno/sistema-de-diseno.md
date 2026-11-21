# Sistema de diseño de World Craft (v2)

> **Estado:** dirección v2 aprobada el 21/11/2026 en la issue #124 mediante el
> ADR 0025 y la decisión D-048. Este documento describe el sistema que se va a
> implementar en las issues #125–#133. No presenta como existente nada que aún
> no lo esté: hasta que cada issue migre su parte, la aplicación sigue usando
> los tokens y componentes v1. El estado real se mantiene en la sección 17.
> **Ámbito:** identidad, superficies, color, tipografía, iconos, espaciado,
> radios, elevación, bordes, componentes, shell, estados, accesibilidad,
> movimiento, patrones de escritorio, migración y verificación.

## 1. Identidad y principios

1. **Estudio moderno con alma de cartógrafo.** La aplicación se lee como una
   herramienta de trabajo contemporánea. La referencia al taller de cartógrafo
   queda en el cuidado editorial, la tipografía de contenido y el verde bosque,
   no en una textura de pergamino global.
2. **La calidez está en el acento y el contenido.** Las superficies son
   neutras; el color de marca no se extiende a cada caja. La arena se reserva
   para selección o detalle.
3. **Contenido primero.** La interfaz se aparta cuando el usuario escribe,
   dibuja o conecta ideas. Un documento se lee como documento, no como un
   formulario permanente.
4. **Jerarquía por espacio, tamaño, peso y contraste.** El orden se construye
   antes que los bordes y las sombras.
5. **Dos temas, una identidad.** Claro y Oscuro comparten jerarquía, roles,
   espaciado y contraste; no son dos productos distintos.
6. **Densidad de escritorio.** Hay espacio para paneles y tablas. No se diseña
   para pulgares ni para pantallas de 360 px.
7. **Una acción primaria por pantalla.** Las secundarias van a un menú `⋯`, a
   la barra contextual o a la paleta de comandos.
8. **Accesible por defecto.** Teclado, foco visible, contraste AA y movimiento
   reducido desde el primer componente.
9. **Opaco y nativo.** Sin cristal detrás de texto, sin efectos que compitan
   con la lectura. Mica solo como extra opcional con fallback.
10. **Sin sorpresas.** Las acciones destructivas se confirman, los estados se
    anuncian y los errores explican qué hacer.

## 2. Ventana, rejilla y composición

- Tamaño mínimo: **1024×700**.
- Referencias de prueba: **1024×700**, **1280×800**, **1600×900** y
  **1920×1080**.
- A 1024, 1280 y 1600 px no hay desplazamiento horizontal de página.
- El desplazamiento horizontal solo se permite dentro de tablas, bloques de
  código y el lienzo del mapa.
- Rejilla base de 4 px; espaciado habitual en múltiplos de 4 y 8.
- Barra lateral: 240 px expandida, 64 px plegada.
- Barra superior: 56 px.
- Paneles laterales: 280–360 px, redimensionables solo donde aporte valor.
- Ancho de lectura del editor: 60–72 caracteres; columna centrada con panel de
  propiedades opcional.
- Todo hijo de flex o grid que pueda contener texto largo lleva `min-width: 0`
  y `overflow-wrap: break-word`.

### 2.1 Vocabulario de composición

| Pieza | Papel | Regla |
|---|---|---|
| Rail | Navegación principal y marca | 240 px; 64 px plegado; sin lema permanente ni versión. |
| Barra superior | Contexto, búsqueda y acciones globales | 56 px; una entrada a la paleta `Ctrl+K`, tema y acciones de la vista. |
| Lienzo | Contenido principal | Superficie base; sin tarjeta contenedora que lo encierre todo. |
| Panel de propiedades | Datos secundarios de la ficha | 280–360 px; plegable; no compite con el documento. |
| Barra contextual | Acciones de la selección | Aparece solo con selección; no duplica la acción primaria. |
| Diálogo | Decisión o formulario breve | Flotante, con velo, foco atrapado y cierre con Escape. |

## 3. Material y plataforma

- **Superficies opacas.** El fondo de la ventana y los paneles son opacos. No
  se usa Acrylic detrás de texto ni se aplica transparencia a las tarjetas.
- **Mica.** Solo como spike opcional de Windows 11, desactivado por defecto y
  con fallback opaco. Si se prueba, afecta únicamente al fondo de la ventana,
  nunca al contenido ni a los diálogos.
- **Sin contenido remoto.** No se cargan fuentes, texturas, iconos ni imágenes
  desde Internet.
- **Ventana nativa.** El marco, los controles de ventana y el comportamiento de
  la barra de tareas siguen el sistema operativo. La app no dibuja controles de
  ventana propios.

### 3.1 Superficies

| Superficie | Rol | Uso |
|---|---|---|
| `--bg` | Base | Fondo de la ventana y lienzo principal. |
| `--surface` | Panel | Tarjetas, paneles, listas y bloques de contenido. |
| `--surface-raised` | Flotante | Diálogos, menús, tooltips y paleta de comandos. |
| `--surface-sunken` | Hundida | Rail, pozos, barras y zonas que retroceden. |

- La jerarquía se construye con un paso de superficie y espacio; no se apilan
  más de dos pasos en una misma vista.
- Una tarjeta no se encierra en otra tarjeta. Si un bloque necesita separación,
  se usa espacio o `--surface`, no un borde.
- Las superficies flotantes son las únicas que combinan borde y sombra.
- En Oscuro, el escalón entre `--bg`, `--surface` y `--surface-raised` es la
  señal principal; la sombra solo remata.

## 4. Color

### 4.1 Capas y disciplina

| Capa | Archivo | Contenido |
|---|---|---|
| Paleta | `src/renderer/styles/tokens/palette.css` | Única fuente de hex, rgb y valores con alfa. |
| Semántica | `src/renderer/styles/tokens/semantic.css` | Roles de tema resueltos con `var(--palette-*)`. Sin hex. |
| Escalas | `src/renderer/styles/tokens/scales.css` | Espaciado, radios, tipografía, elevación, movimiento, capas y medidas. |

Reglas:

- Ningún componente declara un color literal. Los componentes usan solo roles
  semánticos (`--bg`, `--fg`, `--accent`, `--danger`...).
- `semantic.css` no contiene hex; solo asigna valores de la paleta.
- `scales.css` no contiene valores cromáticos.
- Los overrides de tema van agrupados por selector y con una sola fuente de
  verdad por regla.
- Un rol no se usa como fondo en un tema y como texto en el otro sin comprobar
  la pareja en ambos.

### 4.2 Paleta

La paleta v2 se organiza por familias. Los pasos intermedios existen para
resolver roles concretos; no se usan todos en componentes.

| Familia | Token | Valor | Uso previsto |
|---|---|---|---|
| Neutro | `--palette-neutral-0` | `#ffffff` | Superficie elevada en Claro. |
| Neutro | `--palette-neutral-50` | `#fbfaf7` | Superficie en Claro. |
| Neutro | `--palette-neutral-100` | `#f6f4ef` | Fondo base en Claro y texto principal en Oscuro. |
| Neutro | `--palette-neutral-200` | `#efece4` | Fondo hundido en Claro. |
| Neutro | `--palette-neutral-300` | `#e1ddd2` | Divisores suaves en Claro. |
| Neutro | `--palette-neutral-400` | `#d8d3c7` | Divisor de mayor contraste en Claro (reserva). |
| Neutro | `--palette-neutral-450` | `#a3aca5` | Texto secundario en Oscuro. |
| Neutro | `--palette-neutral-500` | `#7d847c` | Borde fuerte y controles interactivos. |
| Neutro | `--palette-neutral-600` | `#626a64` | Texto secundario en Claro. |
| Neutro | `--palette-neutral-700` | `#3a403c` | Texto terciario o énfasis suave. |
| Neutro | `--palette-neutral-750` | `#343b36` | Divisores en Oscuro. |
| Neutro | `--palette-neutral-800` | `#222723` | Texto principal en Claro y superficie elevada en Oscuro. |
| Neutro | `--palette-neutral-850` | `#1b1f1c` | Superficie en Oscuro. |
| Neutro | `--palette-neutral-900` | `#141715` | Fondo base en Oscuro. |
| Neutro | `--palette-neutral-950` | `#0f1210` | Fondo hundido en Oscuro. |
| Bosque | `--palette-forest-100` | `#e3eee7` | Superficie tintada de acento en Claro. |
| Bosque | `--palette-forest-300` | `#9acbaf` | Acento fuerte y foco en Oscuro. |
| Bosque | `--palette-forest-400` | `#7fb99b` | Acento en Oscuro. |
| Bosque | `--palette-forest-600` | `#2e5b45` | Acento y acción primaria en Claro. |
| Bosque | `--palette-forest-700` | `#244a38` | Acento fuerte y hover en Claro. |
| Bosque | `--palette-forest-900` | `#223a2d` | Superficie tintada de acento en Oscuro. |
| Arena | `--palette-sand-200` | `#e8dfc8` | Selección en Claro. |
| Arena | `--palette-sand-500` | `#8c6d2f` | Marca de tipo de entidad; nunca texto. |
| Arena | `--palette-sand-800` | `#3b3424` | Selección en Oscuro. |
| Éxito | `--palette-success-100` | `#e2f0e8` | Superficie de éxito en Claro. |
| Éxito | `--palette-success-300` | `#8fd3aa` | Éxito en Oscuro. |
| Éxito | `--palette-success-600` | `#2f6b4f` | Éxito en Claro. |
| Éxito | `--palette-success-900` | `#1e3328` | Superficie de éxito en Oscuro. |
| Aviso | `--palette-warning-100` | `#f7ead2` | Superficie de aviso en Claro. |
| Aviso | `--palette-warning-300` | `#e3b878` | Aviso en Oscuro. |
| Aviso | `--palette-warning-600` | `#8a5a18` | Aviso en Claro. |
| Aviso | `--palette-warning-900` | `#3b3020` | Superficie de aviso en Oscuro. |
| Peligro | `--palette-danger-100` | `#f6e2df` | Superficie de error en Claro. |
| Peligro | `--palette-danger-300` | `#efa39b` | Error y destructivo en Oscuro. |
| Peligro | `--palette-danger-600` | `#a03a32` | Error y destructivo en Claro. |
| Peligro | `--palette-danger-900` | `#3a2523` | Superficie de error en Oscuro. |
| Pizarra | `--palette-slate-300` | `#a9c2cc` | Marca `prussian` en Oscuro; nunca texto. |
| Pizarra | `--palette-slate-600` | `#4c6672` | Marca `prussian` en Claro; nunca texto. |
| Sombra | `--palette-shadow-1` | `rgb(18 22 19 / 8%)` | Sombra contenida en Claro. |
| Sombra | `--palette-shadow-2` | `rgb(18 22 19 / 16%)` | Sombra flotante en Claro. |
| Sombra | `--palette-shadow-dark-1` | `rgb(0 0 0 / 40%)` | Sombra contenida en Oscuro. |
| Sombra | `--palette-shadow-dark-2` | `rgb(0 0 0 / 60%)` | Sombra flotante en Oscuro. |
| Velo | `--palette-overlay-light` | `rgb(14 18 15 / 45%)` | Velo de diálogo en Claro. |
| Velo | `--palette-overlay-dark` | `rgb(5 7 6 / 65%)` | Velo de diálogo en Oscuro. |

### 4.3 Roles semánticos

| Token | Claro | Oscuro | Papel |
|---|---|---|---|
| `--bg` | `#f6f4ef` | `#141715` | Fondo base de la ventana. |
| `--surface` | `#fbfaf7` | `#1b1f1c` | Paneles y tarjetas. |
| `--surface-raised` | `#ffffff` | `#222723` | Diálogos, menús y elementos flotantes. |
| `--surface-sunken` | `#efece4` | `#0f1210` | Rail, pozos y zonas hundidas. |
| `--fg` | `#222723` | `#f6f4ef` | Texto principal. |
| `--muted` | `#626a64` | `#a3aca5` | Texto secundario y metadatos. |
| `--border` | `#e1ddd2` | `#343b36` | Divisores decorativos. |
| `--border-strong` | `#7d847c` | `#7d847c` | Bordes de campos y límites interactivos. |
| `--accent` | `#2e5b45` | `#7fb99b` | Marca, enlaces y acción primaria. |
| `--accent-strong` | `#244a38` | `#9acbaf` | Hover y acento de mayor contraste. |
| `--accent-contrast` | `#ffffff` | `#0f1210` | Texto sobre `--accent`. |
| `--accent-surface` | `#e3eee7` | `#223a2d` | Fondo tintado de acento. |
| `--success` | `#2f6b4f` | `#8fd3aa` | Éxito. |
| `--success-surface` | `#e2f0e8` | `#1e3328` | Fondo tintado de éxito. |
| `--warning` | `#8a5a18` | `#e3b878` | Aviso. |
| `--warning-surface` | `#f7ead2` | `#3b3020` | Fondo tintado de aviso. |
| `--danger` | `#a03a32` | `#efa39b` | Error y acción destructiva. |
| `--danger-surface` | `#f6e2df` | `#3a2523` | Fondo tintado de error. |
| `--focus` | `#2e5b45` | `#9acbaf` | Anillo de foco. |
| `--selection` | `#e8dfc8` | `#3b3424` | Fondo de selección de texto o elemento. |
| `--disabled-surface` | `#efece4` | `#222723` | Superficie de control deshabilitado. |
| `--disabled-text` | `#626a64` | `#a3aca5` | Texto de control deshabilitado, sin `opacity`. |
| `--overlay` | `rgb(14 18 15 / 45%)` | `rgb(5 7 6 / 65%)` | Velo de diálogos modales. |

`--bg` y `--fg` son el único par base. Los componentes no usan colores de la
paleta cruda ni eligen entre Claro y Oscuro: el tema resuelve los roles.

### 4.4 Colores de tipos de entidad

Los tokens persistidos de tipos de entidad **no cambian de nombre** en la base
de datos: `moss`, `ochre`, `danger` y `prussian`. La interfaz los resuelve con
la paleta v2:

| Token persistido | Resolución v2 | Uso |
|---|---|---|
| `moss` | `--accent` | Marca de tipo, icono o nodo. |
| `ochre` | `--palette-sand-500` en Claro; `--palette-warning-300` en Oscuro | Marca de tipo, icono o nodo. |
| `danger` | `--danger` | Marca de tipo, icono o nodo. |
| `prussian` | `--palette-slate-600` en Claro; `--palette-slate-300` en Oscuro | Marca de tipo, icono o nodo. |

El color es una marca gráfica, nunca el único indicador de estado. El nombre del
tipo y su texto usan `--fg`; la marca debe superar 3:1 contra la superficie
donde se dibuja. No se guardan hex libres.

### 4.5 Tabla de contraste

Ratios calculados con la fórmula de luminancia relativa de WCAG 2.2 (sRGB). Los
valores se redondean a dos decimales. La misma pareja de texto cubre texto
normal y grande; se indica el mínimo de cada caso.

| Pareja | Tipo | Claro | Oscuro | Mínimo |
|---|---|---|---|---|
| `--fg` sobre `--bg` | Texto normal | 13,82:1 | 16,43:1 | 4,5:1 |
| `--fg` sobre `--bg` | Texto grande | 13,82:1 | 16,43:1 | 3:1 |
| `--fg` sobre `--surface` | Texto normal | 14,55:1 | 15,17:1 | 4,5:1 |
| `--fg` sobre `--surface-raised` | Texto normal | 15,19:1 | 13,82:1 | 4,5:1 |
| `--muted` sobre `--bg` | Texto normal | 5,07:1 | 7,74:1 | 4,5:1 |
| `--muted` sobre `--surface` | Texto normal | 5,34:1 | 7,15:1 | 4,5:1 |
| `--accent` sobre `--bg` | Texto normal | 7,08:1 | 8,01:1 | 4,5:1 |
| `--accent-contrast` sobre `--accent` | Texto normal | 7,78:1 | 8,36:1 | 4,5:1 |
| `--accent` sobre `--accent-surface` | Texto normal | 6,54:1 | 5,44:1 | 4,5:1 |
| `--success` sobre `--bg` | Texto normal | 5,73:1 | 10,37:1 | 4,5:1 |
| `--success` sobre `--success-surface` | Texto normal | 5,35:1 | 7,74:1 | 4,5:1 |
| `--warning` sobre `--bg` | Texto normal | 5,37:1 | 9,80:1 | 4,5:1 |
| `--warning` sobre `--warning-surface` | Texto normal | 4,96:1 | 6,99:1 | 4,5:1 |
| `--danger` sobre `--bg` | Texto normal | 6,07:1 | 8,93:1 | 4,5:1 |
| `--danger` sobre `--danger-surface` | Texto normal | 5,36:1 | 7,07:1 | 4,5:1 |
| `--border-strong` sobre `--bg` | Componente | 3,50:1 | 4,70:1 | 3:1 |
| `--border-strong` sobre `--surface` | Componente | 3,68:1 | 4,34:1 | 3:1 |
| `--focus` sobre `--bg` | Foco | 7,08:1 | 9,92:1 | 3:1 |
| `--focus` sobre `--surface` | Foco | 7,46:1 | 9,16:1 | 3:1 |
| `--focus` sobre `--accent-surface` | Foco | 6,54:1 | 6,74:1 | 3:1 |
| `--fg` sobre `--selection` | Texto normal | 11,44:1 | 11,22:1 | 4,5:1 |
| `--disabled-text` sobre `--disabled-surface` | Texto (mejora) | 4,72:1 | 6,51:1 | 4,5:1 |

`--border` es un divisor decorativo (1,23:1 en Claro y 1,57:1 en Oscuro) y no
sustituye a `--border-strong` en el límite de un control interactivo. Las
marcas de tipo de entidad superan 3:1 contra su superficie y no se usan como
texto; el texto del tipo usa `--fg`.

## 5. Tipografía

### 5.1 Pilas

| Uso | Pila | Regla |
|---|---|---|
| Interfaz | `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Noto Sans", sans-serif` | Pila del sistema; no se empaqueta ni se redistribuye Segoe. |
| Contenido | `Fraunces, "Iowan Old Style", "Palatino Linotype", Georgia, serif` | Solo títulos de contenido y lectura larga. Si se conserva la serif, se empaqueta una OFL; hasta entonces se usa el respaldo local. |
| Datos y código | `"Cascadia Mono", Consolas, "Liberation Mono", monospace` | Pila del sistema; sin dependencia externa. |

- **Sin URLs remotas.** No hay `@font-face` con `https://` ni carga de fuentes
  desde Internet.
- **No se redistribuye Segoe.** Es una fuente del sistema; la app la usa si
  está instalada y cae a `system-ui` si no.
- **La serif es opcional.** Si no se empaqueta una OFL, la serif del sistema es
  un respaldo y no se presenta como identidad definitiva.

### 5.2 Escala

| Uso | Tamaño | Peso | Interlineado |
|---|---|---|---|
| Título de página | 28–32 px | 600 | 1,2 |
| Título de sección | 20–24 px | 600 | 1,25 |
| Cuerpo de interfaz | 14 px | 400 | 1,5 |
| Metadatos y tablas | 12–13 px | 400/500 | 1,4 |
| Título de contenido | 28–32 px | 600 | 1,2 |
| Lectura larga | 17–18 px | 400 | 1,7 |
| Código y datos | 12–13 px | 400 | 1,5 |

- El texto de 13 px se usa en metadatos; el cuerpo de interfaz va a 14 px y el
  de lectura a 17–18 px.
- No se usan mayúsculas sostenidas en párrafos largos.
- El ancho de lectura se limita a 60–72 caracteres.
- Los títulos de contenido pueden usar la serif; la navegación, los formularios
  y los metadatos no.
- Los números y fechas usan `Intl` con el idioma del perfil.

## 6. Espaciado, radios y elevación

### 6.1 Espaciado

Rejilla de 4 px. Se conservan los nombres `--space-1` a `--space-12`; el uso
preferente es:

| Token | Valor | Uso |
|---|---|---|
| `--space-1` | 4 px | Separación mínima entre texto e icono. |
| `--space-2` | 8 px | Gap de controles y metadatos. |
| `--space-3` | 12 px | Padding compacto de campos y filas. |
| `--space-4` | 16 px | Padding estándar y separación de bloques. |
| `--space-6` | 24 px | Separación de secciones. |
| `--space-7` | 32 px | Separación de bloques principales. |
| `--space-9` | 48 px | Márgenes de lienzo. |
| `--space-10` | 64 px | Aire en Inicio y cabeceras. |

Los pasos 5, 8, 11 y 12 se conservan como escala heredada; no se añaden valores
nuevos fuera de la rejilla.

### 6.2 Radios

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 4 px | Campos, botones e insignias compactas. |
| `--radius-md` | 6 px | Tarjetas, paneles y diálogos. |
| `--radius-lg` | 8 px | Superficies flotantes de mayor tamaño. |
| `--radius-pill` | 999 px | Solo insignias y contadores. |

No se usan radios de 10 px o superiores como valor por defecto. Una tarjeta no
lleva un radio distinto en cada esquina ni combina radios y bordes decorativos.

### 6.3 Elevación

| Nivel | Token | Uso |
|---|---|---|
| 0 | Sin sombra | Fondo, tarjetas, secciones y paneles. La jerarquía la hace la superficie y el espacio. |
| 1 | `--shadow-1` | Barras adhesivas y elementos que se separan del lienzo. |
| 2 | `--shadow-2` | Diálogos, menús, tooltips y paleta de comandos. |

- Una tarjeta no lleva sombra por defecto. Si necesita separarse, se usa un paso
  de superficie (`--surface` o `--surface-raised`) antes que una sombra.
- En Oscuro, el escalón de superficie hace la mayor parte del trabajo y la
  sombra solo remata el borde de las superficies flotantes.

## 7. Bordes

- **Campos y controles interactivos:** 1 px de `--border-strong`. Es el límite
  que debe superar 3:1.
- **Divisores:** 1 px de `--border`. Son decorativos; no sustituyen al borde
  fuerte de un control.
- **Superficies flotantes:** 1 px de `--border` o `--border-strong` según el
  contraste, más `--shadow-2` si hace falta.
- **Foco:** anillo de 2 px de `--focus` con 2 px de separación. Se usa
  `:focus-visible` y se mantiene visible sobre `--bg`, `--surface` y
  `--accent-surface`.
- **Tarjetas y secciones:** sin contorno por defecto. No se dibuja una caja
  alrededor de cada bloque.
- **Selección:** se indica con `--selection`, `--accent-surface` o un cambio de
  peso; no se aumenta el grosor del borde.
- **Prohibido:** dobles bordes, bordes de 2 px decorativos y bordes que solo
  existen para compensar una jerarquía débil.

## 8. Iconos

- Un único set centralizado en el renderer, con trazo de **1,6 px** y tamaños
  **16, 20 y 24 px**. El tamaño por defecto es 20 px.
- El catálogo actual se normaliza a ese trazo y se centraliza; no se mezclan
  familias de iconos ni se añade Fluent Icons como dependencia.
- Los iconos usan `currentColor`; no llevan color propio ni hex inline.
- Un icono decorativo lleva `aria-hidden="true"`; un icono con acción lleva
  etiqueta accesible y, si es el único contenido del botón, `aria-label`.
- El icono nunca es el único indicador de estado: se acompaña de texto, color
  semántico y, cuando aplica, `aria-live`.
- Los iconos de tipo de entidad salen de la lista cerrada del catálogo; no se
  aceptan nombres libres.

## 9. Componentes

La tabla describe el comportamiento v2. La columna «Estado» evita presentar
como existente lo que aún no lo está.

| Componente | Regla v2 | Estado | Issue |
|---|---|---|---|
| Botón | Primario, secundario, fantasma y destructivo; una acción primaria por pantalla; carga con `aria-busy`; deshabilitado sin `opacity`. | Existente v1; se adapta | #125 |
| Botón de icono | Icono de 20 px, etiqueta accesible obligatoria, tooltip si el icono no es evidente. | Previsto | #125 |
| Campo de texto | Etiqueta visible, ayuda, error con `aria-describedby`, `aria-invalid` y longitud máxima. | Existente v1; se adapta | #125 |
| Área de texto | Misma semántica; alto mínimo y redimensionado solo vertical. | Existente v1; se adapta | #125 |
| Selector | `<select>` nativo con etiqueta, ayuda, error y opciones tipadas. | Existente v1; se adapta | #125 |
| Casilla y radio | Nativos, con etiqueta y foco visible; no se sustituyen por divs. | Previsto | #125 |
| Búsqueda | Campo con icono, limpiar y resultado anunciado; no duplica la paleta. | Previsto | #126 |
| Insignia | Tonos neutro, acento, éxito, aviso y peligro; siempre con texto. | Existente v1; se adapta | #125 |
| Tarjeta | Sin contorno ni sombra por defecto; título, contenido y acciones en `⋯`. | Existente v1; se adapta | #125 |
| Diálogo | `<dialog>` nativo, velo, foco atrapado, Escape y acciones claras. | Existente v1; se adapta | #125 |
| Menú `⋯` | Acciones secundarias; teclado, foco y cierre con Escape. | Previsto | #125 |
| Tooltip | Visible con foco y hover, `aria-describedby`, se oculta con Escape. | Existente v1; se adapta | #125 |
| Aviso toast | `aria-live="polite"`, `role="status"`, cierre manual. | Existente v1; se adapta | #125 |
| Pestañas | Solo para formularios o Ajustes; no son pestañas de trabajo en M1.5. | Existente v1; se limita | #125 |
| Tabla | Ordenación, filtros y selección; scroll horizontal solo dentro. | Previsto | #125 |
| Estado vacío | Explica qué falta y cuál es la acción principal. | Existente v1; se adapta | #125 |
| Paleta de comandos | `Ctrl+K`, combobox/listbox, navegación, creación, tema y reconstrucción. | Existente #76; se rediseña la entrada | #126 |
| Cabecera de ficha | Título, tipo, favorito y acciones en `⋯`; no cinco botones. | Previsto | #129 |
| Panel de propiedades | Plegable, 280–360 px; edita en contexto sin tapar el documento. | Previsto | #129 |
| Lista de relaciones | Dirección, etiqueta y ficha destino legibles; backlinks claros. | Previsto | #130 |
| Nodo de grafo | Avatar, nombre, tipo y selección; el grafo completo llega con #83. | Previsto | #130 |
| Editor mínimo | Formato básico, menciones `@` y `[[ ]]`; sin barra permanente. | Previsto | #131 |

## 10. Shell y pantallas

### 10.1 Shell

- Rail de 240 px plegable a 64 px, con navegación principal y marca sin lema
  permanente ni versión.
- Barra superior de 56 px con el contexto de la vista, la entrada a la paleta
  `Ctrl+K`, el conmutador de tema y las acciones globales.
- El estado plegado del rail se recuerda entre reinicios a partir de #132.
- La navegación no muestra «Muestras»; esa página queda como herramienta de
  desarrollo fuera del producto.
- La búsqueda ya implementada en #76 se conserva; no se duplica en la barra.
- Las actualizaciones se muestran de forma discreta, sin ocupar el rail.

### 10.2 Inicio

- Mesa de trabajo, no dashboard de contadores.
- Mundos recientes con portada o inicial, nombre, estado y una acción principal.
- Acceso rápido a crear mundo, buscar y continuar donde se dejó.
- Una sola acción primaria visible; el resto va a `⋯` o a la paleta.

### 10.3 Vista de mundo

- Navegación modular: resumen, fichas, relaciones, mapas, manuscrito y juego
  según existan.
- Cabecera con nombre, estado, portada y una acción primaria.
- El contenido y las acciones secundarias no compiten con la cabecera.
- Los paneles se pliegan y su estado se recuerda por pantalla cuando #132 lo
  permita.

### 10.4 Ficha

- Documento antes que formulario: título, tipo y contenido legible.
- El contenido se edita en contexto; el panel de propiedades se abre cuando se
  necesita y no tapa el documento.
- Las acciones secundarias van a `⋯`; la acción primaria es editar o guardar.
- Las relaciones y backlinks se leen como parte de la ficha, no como una tabla
  aparte.

### 10.5 Relaciones y grafo

- La lista de relaciones muestra dirección, tipo, etiqueta y ficha destino.
- El grafo contextual se enlaza desde la ficha y no duplica el grafo de #83.
- El color de tipo es una marca; la relación se entiende por texto y por
  posición.

### 10.6 Editor

- Editor mínimo con formato básico y menciones `@` / `[[ ]]` en #131.
- Sin barra de herramientas permanente que reduzca el ancho de lectura.
- El guardado se anuncia con `aria-live`; el autoguardado no roba el foco.
- El contenido largo mantiene el ancho de lectura y el scroll vertical.

### 10.7 Ajustes

- Tema, rail y panel se persisten a partir de #132.
- Las preferencias se aplican antes del primer pintado para evitar parpadeo.
- «Datos y copias» y el borrado completo siguen su propio flujo confirmado.

## 11. Estados

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

### 11.1 Estados de interacción

| Estado | Regla |
|---|---|
| Reposo | Rol semántico base, sin borde decorativo. |
| Hover | Cambio de superficie o de acento; no desplaza el layout. |
| Activo | Acento fuerte o superficie hundida; sin rebote. |
| Foco | Anillo de 2 px de `--focus` con 2 px de separación. |
| Seleccionado | `--selection` o `--accent-surface`, más texto o icono; no solo color. |
| Deshabilitado | `--disabled-surface` y `--disabled-text`, sin `opacity`. |
| Cargando | `aria-busy`, indicador discreto y acción bloqueada. |
| Error | `--danger`, texto de ayuda y `aria-invalid` cuando aplica. |

## 12. Accesibilidad

- Contraste mínimo 4,5:1 para texto normal y 3:1 para texto grande y
  componentes gráficos.
- Foco visible con `--focus` en ambos temas; nunca se elimina el contorno sin
  sustituto.
- Navegación completa por teclado; sin trampas de foco.
- HTML semántico y landmarks (`main`, `nav`, `aside`, `header`).
- Formularios con etiqueta, ayuda y error asociados.
- `aria-live` para guardado, errores y resultados de acciones largas.
- `prefers-reduced-motion`: sin animaciones esenciales ni desplazamientos
  automáticos.
- axe sin errores críticos en las pantallas principales.
- Los atajos se documentan y no chocan con los del sistema.
- El shell incluye un enlace «Saltar al contenido principal» visible al foco y
  `main` enfocable (`tabIndex={-1}`).
- Los objetivos de clic tienen al menos 28×28 px; los controles principales,
  32×32 px.
- El color no es el único indicador de estado; se combina con texto, icono o
  posición.

## 13. Movimiento

- Duración habitual: 120–180 ms.
- Curvas suaves; sin rebotes exagerados.
- El movimiento explica un cambio (panel que se abre, elemento que se mueve),
  no decora.
- Con movimiento reducido, los cambios son instantáneos o un fundido mínimo.
- No hay animaciones en bucle ni parallax.
- Las transiciones de tema no se animan si el usuario pide movimiento reducido.

## 14. Patrones de escritorio

- **Ratón:** clic para seleccionar, doble clic para abrir, clic derecho para
  menú contextual cuando aporte.
- **Teclado:** `Ctrl+N` nueva ficha, `Ctrl+S` guardar, `Ctrl+K` paleta de
  comandos, `Ctrl+Z` deshacer, `F1` ayuda. Los atajos se documentan en la app.
- **Paneles:** se pueden plegar; el estado se recuerda por pantalla cuando
  #132 lo permita.
- **Ventanas:** una sola ventana principal; los diálogos no se salen de ella.
- **Arrastrar y soltar:** para reordenar escenas, capas y fichas; siempre hay
  alternativa por teclado.
- **Tablas:** ordenación, filtros y selección; el scroll horizontal queda dentro
  del contenedor.
- **Texto largo:** rutas, nombres sin espacios, fechas y sinopsis usan
  `overflow-wrap` y `min-width: 0`.

## 15. Contenido y textos

- Todos los textos visibles van en el catálogo tipado de i18n.
- Tono cercano, directo y sin jerga técnica.
- Los errores explican la causa y la acción, no solo un código.
- Los botones usan verbos: «Crear mundo», «Guardar copia», «Restaurar».
- Las acciones destructivas nombran el objeto y la consecuencia.
- No se usan cadenas de interfaz dispersas en componentes.

## 16. Migración de tokens

La migración se ejecuta en #125. Hasta entonces, los tokens v1 siguen siendo
los que usa la aplicación. Esta tabla es el contrato de sustitución.

| v1 | v2 | Acción |
|---|---|---|
| `--palette-paper-50/100/200` | `--palette-neutral-0/50/100` | Reasignar superficies; el texto oscuro deja de usar la familia papel. |
| `--palette-ink-950/900/800/600/500/400/200` | `--palette-neutral-900/850/800/600/500/400/450` | No hay equivalencia 1:1; cada rol se reasigna a `--bg`, `--fg`, `--muted`, `--border` o `--surface*`. |
| `--palette-moss-*` | `--palette-forest-*` y `--palette-success-*` | El acento pasa a bosque; el éxito usa su propia familia. |
| `--palette-ochre-*` | `--palette-sand-*` y `--palette-warning-*` | La selección usa arena; el aviso usa su propia familia. |
| `--palette-danger-*` | `--palette-danger-*` | Se conservan los nombres y se actualizan los valores. |
| `--palette-prussian-*` | `--palette-slate-*` | Sale del foco de UI; el token persistido `prussian` se resuelve como marca de tipo. |
| `--paper` y `--ink` | `--bg`, `--fg` y `--surface*` | Se retiran del contrato de componentes. Mientras dure #125 solo pueden existir como alias temporales en `semantic.css`; nunca en un componente. |
| `--surface` y `--surface-raised` | Se conservan | Se añade `--surface-sunken`. |
| `--border` | `--border` (divisor) y `--border-strong` | Los campos y controles usan `--border-strong`; los divisores, `--border`. |
| `--focus` | `--focus` | Pasa de azul prusiano a bosque; se mantiene 3:1. |
| `--selection` | `--selection` | Pasa de ocre/musgo a arena. |
| `--shadow-1/2` | Se conservan | Nuevos valores neutros; las tarjetas dejan de usar sombra. |
| `--radius-sm/md/lg` | Se conservan | 4/6/8 px; se retiran los 10 px por defecto. |
| `--font-display` | `--font-content` | La serif se reserva a contenido; la interfaz usa `--font-ui` del sistema. |
| `--font-ui` | Se conserva | Pasa a la pila del sistema; no se empaqueta Segoe. |
| `--font-mono` | Se conserva | Pasa a la pila del sistema. |
| `--text-*` | Se conservan los nombres | Nueva escala: 12, 13, 14, 16, 18, 22 y 32 px. |
| `--space-*` | Se conservan | Uso preferente 4, 8, 12, 16, 24, 32, 48 y 64 px. |
| `--motion-*` | Se conservan | 120–180 ms y curvas suaves. |
| `--sidebar-width`, `--topbar-height`, `--focus-*` | Se conservan | 240/64, 56, 2+2 px. |

Reglas de migración:

1. Primero se migran los roles semánticos y los tests de tokens; después los
   componentes.
2. Ningún componente nuevo usa `--paper` o `--ink`.
3. `--ink` no se usa como fondo ni como texto fuera de su papel; en v2
   directamente desaparece del contrato.
4. Los tokens persistidos de tipos de entidad no se renombran en la base de
   datos.
5. Un token obsoleto se elimina cuando no quedan referencias y el test de
   tokens lo permite.

### 16.1 Colores hardcodeados

- Solo `palette.css` puede contener hex, `rgb()` o `hsl()`.
- `semantic.css` y `scales.css` no contienen colores literales.
- Los componentes no usan colores inline ni hex en TSX. Los iconos usan
  `currentColor`.
- Una excepción debe llevar un comentario que explique por qué no existe un rol,
  qué pareja de tema se comprobó y qué contraste tiene. Nunca se acepta una
  excepción para texto o superficie.
- Los valores con alfa (sombras y velo) viven en la paleta, no en componentes.

## 17. Verificación y estado de implementación

### 17.1 Estado

| Entregable | Estado | Issue |
|---|---|---|
| ADR 0025, D-048, este documento y taxonomía de hitos | Aprobado | #124 |
| Tokens, tipografía y primitivas v2 | Previsto | #125 |
| Shell, navegación y barra superior v2 | Previsto | #126 |
| Inicio y tarjetas de mundo | Previsto | #127 |
| Vista de mundo modular | Previsto | #128 |
| Ficha como documento y panel de propiedades | Previsto | #129 |
| Relaciones legibles y grafo contextual | Previsto | #130 |
| Editor mínimo y menciones | Previsto | #131 |
| Preferencias de interfaz persistentes | Previsto | #132 |
| Auditoría visual, temas y ruido | Previsto | #133 |

Mientras una fila diga «Previsto», la aplicación sigue mostrando el sistema v1
en esa parte. No se deben tomar capturas nuevas como si el sistema v2 ya
estuviera implementado.

### 17.2 Verificación automática

- `tests/unit/design-tokens.test.ts` verifica hoy los tokens v1. En #125 se
  actualiza para resolver la paleta v2, comprobar los ratios de la tabla 4.5 y
  mantener la disciplina de capas.
- `tests/e2e/accessibility.spec.ts` ejecuta axe sobre el shell en Claro y
  Oscuro.
- `tests/e2e/shell.spec.ts` comprueba la ventana a 1024, 1280 y 1600 px sin
  scroll horizontal.
- `tests/e2e/entities.spec.ts` hace lo mismo con la lista y la ficha.
- La matriz visual completa, las capturas y la auditoría de todas las pantallas
  se completan en #133.

### 17.3 Checklist antes de cerrar una issue de UI

- [ ] Revisión en Claro y Oscuro.
- [ ] Ventana a 1024, 1280 y 1600 px sin scroll horizontal de página.
- [ ] Contraste AA comprobado con la tabla 4.5.
- [ ] Teclado y foco revisados.
- [ ] axe sin errores críticos.
- [ ] Movimiento reducido comprobado.
- [ ] Textos en el catálogo, sin cadenas dispersas.
- [ ] Estados de carga, vacío y error.
- [ ] Sin bordes de tarjeta por defecto ni acumulación de botones.
- [ ] Manual actualizado si el cambio es visible.

## 18. Documentos relacionados

- [ADR 0025: dirección visual v2](../adr/0025-visual-direction-v2.md)
- [ADR 0006: dos temas y sistema de diseño de escritorio](../adr/0006-two-themes-desktop-design-system.md)
- [Plan de desarrollo](../plan-desarrollo.md)
- [Arquitectura](../arquitectura.md)
- [Proceso SDD](../proceso-sdd.md)
- [Plan de pruebas](../calidad/plan-de-pruebas.md)
- [Internacionalización](../internacionalizacion.md)
- [Manual de usuario](../manual-de-usuario.md)
