# Sistema de diseño de World Craft (v2)

> **Estado:** dirección v2 aprobada el 21/11/2026 en la issue #124 mediante el
> ADR 0025 y la decisión D-048. #125 implementó los tokens, la tipografía y las
> primitivas; #126 migró el shell, la navegación y la barra superior; #127 migró
> Inicio y las tarjetas de mundo; #128 migró la vista de mundo modular; #129
> migró la ficha como documento y su panel de propiedades; #130, las relaciones;
> #131, el editor mínimo y las menciones; #132, las preferencias persistentes;
> #79, Ajustes y la gestión de datos; y #133 cerró **M1.5** con la auditoría
> visual de todas las pantallas. La auditoría final de accesibilidad sigue en #93
> y el grafo completo, en #83. Este documento
> describe el contrato completo y distingue lo implementado de lo previsto, sin
> presentar como existente nada que aún no lo esté. El estado real se mantiene en
> la sección 17.
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
| Navegación modular | Módulos de un mundo | Lista de módulos; el actual lleva `aria-current="page"` y lo previsto es texto con insignia, sin enlace ni foco. |
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
| `--bg` | Base | Fondo de la ventana —también el nativo de Electron— y lienzo principal. |
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
- El **fondo nativo** de `BrowserWindow` coincide exactamente con `--bg`:
  `#f6f4ef` en Claro y `#141715` en Oscuro. Se fija en el proceso principal antes
  de crear la ventana y se actualiza con el tema; una prueba unitaria falla si los
  valores se desincronizan de los tokens (#132, ADR 0027).

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
| `--danger-contrast` | `#ffffff` | `#0f1210` | Texto sobre `--danger`. |
| `--focus` | `#2e5b45` | `#9acbaf` | Anillo de foco. |
| `--selection` | `#e8dfc8` | `#3b3424` | Fondo de selección de texto o elemento. |
| `--disabled-surface` | `#efece4` | `#141715` | Superficie de control deshabilitado. |
| `--disabled-text` | `#626a64` | `#a3aca5` | Texto de control deshabilitado, sin `opacity`. |
| `--disabled-border` | `#7d847c` | `#7d847c` | Borde de control deshabilitado. |
| `--skeleton` | `#e1ddd2` | `#3a403c` | Base del esqueleto de carga. |
| `--skeleton-pulse` | `#d8d3c7` | `#626a64` | Paso alto del pulso del esqueleto. |
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

Desde #125 los roles `--entity-moss`, `--entity-ochre`, `--entity-danger` y
`--entity-prussian` resuelven la marca con su superficie tintada
(`--entity-*-surface`). El texto de etiquetas y tipos sigue en `--fg`: el color
persistido nunca se usa como color de texto.

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
| `--fg` sobre `--surface-sunken` | Texto normal | 12,87:1 | 17,15:1 | 4,5:1 |
| `--muted` sobre `--bg` | Texto normal | 5,07:1 | 7,74:1 | 4,5:1 |
| `--muted` sobre `--surface` | Texto normal | 5,34:1 | 7,15:1 | 4,5:1 |
| `--muted` sobre `--surface-raised` | Texto normal | 5,58:1 | 6,51:1 | 4,5:1 |
| `--accent` sobre `--bg` | Texto normal | 7,08:1 | 8,01:1 | 4,5:1 |
| `--accent` sobre `--surface-raised` | Texto normal | 7,78:1 | 6,74:1 | 4,5:1 |
| `--accent-contrast` sobre `--accent` | Texto normal | 7,78:1 | 8,36:1 | 4,5:1 |
| `--accent` sobre `--accent-surface` | Texto normal | 6,54:1 | 5,44:1 | 4,5:1 |
| `--accent-strong` sobre `--accent-surface` | Texto normal | 8,36:1 | 6,74:1 | 4,5:1 |
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
| `--disabled-text` sobre `--disabled-surface` | Texto (mejora) | 4,72:1 | 7,74:1 | 4,5:1 |
| `--disabled-text` sobre `--surface-raised` | Texto de menú deshabilitado | 5,58:1 | 6,51:1 | 4,5:1 |
| `--disabled-border` sobre `--disabled-surface` | Componente | 3,26:1 | 4,70:1 | 3:1 |
| `--danger-contrast` sobre `--danger` | Texto normal | 6,68:1 | 9,32:1 | 4,5:1 |
| `--muted` sobre `--surface-sunken` | Texto normal | 4,72:1 | 8,08:1 | 4,5:1 |
| `--focus` sobre `--surface-sunken` | Foco | 6,59:1 | 10,35:1 | 3:1 |
| `--danger` sobre `--surface-raised` | Texto normal | 6,68:1 | 7,51:1 | 4,5:1 |
| `--danger` sobre `--surface-sunken` | Texto normal | 5,65:1 | 9,32:1 | 4,5:1 |
| `--focus` sobre `--surface-raised` | Foco | 7,78:1 | 8,34:1 | 3:1 |
| `--accent-strong` sobre `--surface-sunken` | Texto normal | 8,42:1 | 10,35:1 | 4,5:1 |
| `--entity-moss` sobre `--entity-moss-surface` | Marca de tipo | 6,54:1 | 5,44:1 | 3:1 |
| `--entity-ochre` sobre `--entity-ochre-surface` | Marca de tipo | 3,64:1 | 6,69:1 | 3:1 |
| `--entity-danger` sobre `--entity-danger-surface` | Marca de tipo | 5,36:1 | 7,07:1 | 3:1 |
| `--entity-prussian` sobre `--entity-prussian-surface` | Marca de tipo | 5,15:1 | 10,12:1 | 3:1 |

`--border` es un divisor decorativo (1,23:1 en Claro y 1,57:1 en Oscuro) y no
sustituye a `--border-strong` en el límite de un control interactivo. Las
marcas de tipo de entidad superan 3:1 contra su superficie y no se usan como
texto; el texto del tipo usa `--fg`.

`--disabled-surface` se distingue de `--surface-raised` (1,18:1 en Claro y
1,19:1 en Oscuro) y el borde deshabilitado supera 3:1 contra su superficie.
Sobre `--selection` solo se usa `--fg`: `--muted` sobre la selección de Claro se
queda en 4,20:1 y no cumple AA para texto normal.

## 5. Tipografía

### 5.1 Pilas

| Uso | Pila | Regla |
|---|---|---|
| Interfaz | `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Noto Sans", sans-serif` | Pila del sistema; no se empaqueta ni se redistribuye Segoe. |
| Contenido | `"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif` | Serif OFL empaquetada para títulos de contenido y lectura larga; la reserva local mantiene el aspecto si el activo no carga. |
| Datos y código | `"Cascadia Mono", Consolas, "Liberation Mono", monospace` | Pila del sistema; sin dependencia externa. |

- **Sin URLs remotas.** No hay `@font-face` con `https://` ni carga de fuentes
  desde Internet. `styles/fonts.css` es el único archivo con `@font-face` y
  declara rutas relativas al activo versionado.
- **No se redistribuye Segoe.** Es una fuente del sistema; la app la usa si
  está instalada y cae a `system-ui` si no.
- **Source Serif 4 (OFL 1.1) se empaqueta desde #125.** Dos cortes —400 para
  lectura larga y 600 para títulos de contenido— con subset latin, `font-display:
  swap` y `unicode-range` que cubre el español completo. La procedencia (Google
  Fonts v15 / Fontsource 5.3.1, proyecto upstream de Adobe) y los tamaños
  medidos se registran en `THIRD-PARTY-NOTICES.md`; el texto OFL completo vive
  en `src/renderer/assets/fonts/source-serif-4/OFL.txt` y en
  `resources/licenses/source-serif-4-OFL.txt`.
- **Sin ADR nuevo.** ADR 0025, decisión 3, ya fijaba la arquitectura: serif
  reservada a contenido, empaquetada como OFL y nunca cargada de Internet. La
  familia, los pesos y el subset son detalles operativos y reversibles; un ADR
  nuevo duplicaría contexto sin una decisión arquitectónica distinta.
- **Alias retirado.** `--font-display` ya no existe: se eliminó en #126 cuando
  el shell y la marca pasaron a `--font-ui`. Las superficies de interfaz usan
  `--font-ui` y el contenido y los títulos editoriales, `--font-content`; no
  queda ningún alias de tipografía.

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
| Botón | Primario, secundario, fantasma y destructivo; una acción primaria por pantalla; carga con `aria-busy`; deshabilitado sin `opacity`. | Adaptado v2 | #125 |
| Botón de icono | Icono de 20 px, etiqueta accesible obligatoria, tooltip si el icono no es evidente. | Implementado | #125 |
| Campo de texto | Etiqueta visible, ayuda, error con `aria-describedby`, `aria-invalid` y longitud máxima. | Adaptado v2 | #125 |
| Área de texto | Misma semántica; alto mínimo y redimensionado solo vertical. | Adaptado v2 | #125 |
| Selector | `<select>` nativo con etiqueta, ayuda, error y opciones tipadas. | Adaptado v2 | #125 |
| Casilla y radio | Nativos, con etiqueta y foco visible; el objetivo de la fila y la etiqueta es de al menos 28 px. | Implementado | #125 |
| Búsqueda | Campo con icono, limpiar y resultado anunciado; la barra solo ofrece el disparador de la paleta, sin duplicar el campo. | Implementado | #76, #126 |
| Insignia | Tonos neutro, acento, éxito, aviso y peligro; siempre con texto. | Adaptado v2 | #125 |
| Tarjeta | Sin contorno ni sombra por defecto; título y contenido primero. Una acción visible y las secundarias en `⋯`; portada o marca procedural, sin iniciales gigantes. La misma tarjeta sirve a la fila de Inicio y a la rejilla de Mundos. | Implementada | #125, #127 |
| Marca procedural de mundo | Portada si existe; si no, sello determinista por `id` con 4 tramas × 4 tonos resueltos con `--entity-*`. Decorativa (`aria-hidden`), estática y legible en ambos temas. | Implementada | #127 |
| Navegación modular de mundo | Lista de módulos con el actual en `aria-current="page"`; los previstos son texto con insignia, sin enlace ni foco. El recuento de fichas es secundario y se omite si no está disponible. | Implementada | #128 |
| Diálogo | `<dialog>` nativo, velo, foco atrapado, Escape y acciones claras. | Adaptado v2 | #125 |
| Diálogo de transferencia | `<Dialog>` de hasta 40rem con insignia de estado, fase anunciada, barra de progreso, resumen de recuentos, lista de avisos y error con `role="alert"`. Estados `running`, `cancelling`, `exported`, `imported` y `failed`; `Escape` bloqueado mientras está en curso. Sin tokens nuevos. | Implementado | #78 |
| Barra de progreso indeterminada | Variante de `.wc-progress` sin porcentaje conocido: barra al 35 % con animación de 1,6 s y `role="progressbar"` con `aria-valuetext` y sin `aria-valuenow`; se detiene con `prefers-reduced-motion`. | Implementada | #78 |
| Menú `⋯` | Acciones secundarias; teclado, foco y cierre con Escape. Se posiciona respecto al viewport, elige el lado con más espacio, limita su altura y desplaza su contenido sin cerrar el menú. | Implementado | #125 |
| Tooltip | Visible con foco y hover, `aria-describedby`, se oculta con Escape sin cerrar el diálogo que lo contiene. Ancho de contenido con máximo de 18rem y colocación arriba o abajo según el espacio. | Adaptado v2 | #125 |
| Aviso toast | `aria-live="polite"`, `role="status"`, cierre manual. | Adaptado v2 | #125 |
| Pestañas | Solo para formularios o Ajustes; no son pestañas de trabajo en M1.5. | Adaptado v2 | #125 |
| Panel | Sección con encabezado real y acciones; no se pliega por sí mismo. La primitiva plegable de la ficha es `DisclosureSection` desde #129; #132 persiste su estado, no añade el plegado. | Implementado | #125, #129, #132 |
| Esqueleto | Marcador decorativo con `aria-hidden`; el contenedor lleva `aria-busy`. | Implementado | #125 |
| Tabla | Ordenación, filtros y selección; scroll horizontal solo dentro. | Previsto | — |
| Estado vacío | Explica qué falta y cuál es la acción principal. | Adaptado v2 | #125 |
| Paleta de comandos | `Ctrl+K`, combobox/listbox, navegación, creación, tema y reconstrucción. Entrada desde la barra superior y sin Muestras. | Implementado | #76, #126 |
| Cabecera de ficha | Tipo, estado, título, alias y resumen legibles; favorito, estado de guardado, «Editar»/«Listo» y `⋯`. En lectura no existen los campos de cabecera. | Implementada | #126, #129 |
| Panel de propiedades | Inspector de portada, estado y etiquetas; ocultable, de 280–360 px con separador accesible y sticky. No es un formulario paralelo. Su visibilidad y ancho se persisten desde #132. | Implementado | #129, #132 |
| Sección plegable | `h3 > button` con `aria-expanded` y `aria-controls`, chevron decorativo, recuento y acciones fuera del botón; el cuerpo sigue montado y se oculta con `hidden`. Su estado se persiste por sección desde #132, con ámbito global. | Implementada | #129, #132 |
| Ficha técnica de campos | Lista `dl` de dos columnas, sin aspecto de tabla; números y fechas formateados, referencias como enlaces y «Sin valor» para los vacíos. | Implementada | #129 |
| Lista de relaciones | Dirección, etiqueta efectiva y recíproca, ficha contraparte, backlinks y menú `⋯`; sin tabla. | Implementada | #130 |
| Nodo de grafo | Avatar, nombre, tipo y selección; el grafo completo llega con #83. | Previsto | #83 |
| Editor mínimo | Barra mínima permanente de cinco acciones (Negrita, Cursiva, Formato, Enlace, Mención); acciones avanzadas en el menú Formato; menciones `@` y `[[` con combobox/listbox; sin barra extensa ni segunda fila. | Implementado | #131 |

## 10. Shell y pantallas

### 10.1 Shell

- Rail de 240 px plegable a 64 px sobre `--surface-sunken`, con la marca y
  navegación de producto **solo Inicio y Mundos**; sin lema permanente, versión,
  búsqueda duplicada ni actualizaciones. Los iconos de navegación conservan su
  nombre accesible y una ayuda emergente cuando el rail está plegado.
- El plegado usa iconos, `aria-label`, tooltip accesible, `aria-expanded` y
  `aria-controls`; el estado se persiste desde #132 y entra ya correcto en el
  primer render, sin animación de 240 a 64 px.
- Barra superior de 56 px con un único `h1` contextual —nombre del mundo en
  mundo, fichas y ficha; etiqueta de vista en el resto—, truncado a una línea con
  `title`, el disparador de la paleta `Ctrl+K`, **una sola acción primaria**,
  el menú `⋯` de secundarias, el icono de actualizaciones con punto y `aria-live`
  cuando hay versión disponible, y el icono de tema con etiqueta y tooltip.
- Las acciones son declarativas por vista. Inicio y Mundos ofrecen «Crear mundo»
  en la barra solo con al menos un mundo (con cero manda el estado vacío) y
  «Crear una ficha» en `⋯`. Mundo ofrece «Nueva ficha» como primaria y
  editar/duplicar/archivar/eliminar en `⋯`. Fichas deja «Nueva ficha» en la
  página y «Gestionar tipos» en `⋯`. Ficha añade el toggle del panel de
  propiedades en su barra de página; el guardado sigue en el contenido, el
  favorito es un botón visible y «Mover a la papelera» sigue en `⋯`. Búsqueda no
  tiene primaria y ofrece «Reconstruir el índice» en `⋯`.
- **Muestras sale del producto.** Ya no aparece en el rail ni en la paleta; se
  accede solo por el hash interno `#/internal/samples`, como banco de desarrollo
  y contenido largo de los E2E. Cualquier otro hash vuelve a Inicio.
- La búsqueda completa de #76 se conserva: se entra por el disparador de la barra
  o la paleta y, desde la paleta, a la página de resultados.
- El enlace «Saltar al contenido principal» enfoca `#wc-main` con
  `preventDefault`, sin cambiar el hash ni la vista, para no devolver la ventana
  a Inicio.

### 10.2 Inicio

Implementado en #127: Inicio es una mesa de trabajo en una sola columna, no un
dashboard de contadores.

- **Orden:** «Continuar» (condicional) → «Mundos recientes» → «Actividad
  reciente». No hay contadores, rejilla de accesos rápidos ni párrafo de
  presentación.
- **Continuar** retoma el último mundo o ficha abiertos, también entre sesiones
  (persistido desde #132). Se omite si no hay destino o si el mundo recordado ya
  no está en la biblioteca; al eliminar ese mundo se limpia. Si la ficha
  desapareció, se abre su mundo y se usa el aviso existente de que la ficha ya no
  existe. El botón dice **Abrir el mundo** o **Abrir la ficha**; no existe
  «continuar escribiendo» hasta que haya manuscrito.
- **Mundos recientes** muestra como máximo cinco filas. «Ver todos los mundos»
  solo aparece con más de cinco y es una acción fantasma, no una primaria.
- **Actividad reciente** muestra cinco entradas, con tipografía y peso
  secundarios, sin caja por fila y separada por un divisor `--border`.
- **Una sola primaria.** Con al menos un mundo, «Crear mundo» vive en la barra
  superior y el contenido no declara ninguna primaria. Con cero mundos manda el
  estado vacío, que conserva el único botón primario.
- **Tarjeta compartida.** `WorldCard` es la misma en la fila de Inicio y en la
  rejilla de Mundos. En Inicio ocupa tres columnas (marca, contenido, acciones);
  en Mundos pasa a dos filas con las acciones a pie completo. La tarjeta no es
  clicable entera para no anidar controles: **Abrir** y `⋯` son los únicos
  controles.
- **Contenido de la tarjeta:** marca o portada, nombre con `h3`, estado,
  resumen limitado a dos líneas con el texto completo en el DOM y en `title`,
  géneros, fecha relativa y acciones. El menú `⋯` contiene Editar, Duplicar,
  Archivar/Restaurar y Eliminar.
- **Fechas:** `Intl.RelativeTimeFormat` con ventanas de 45 s, 45 min, 22 h, 6
  días, 4 semanas y 11 meses; el futuro se recorta a «ahora». El `<time>` lleva
  `dateTime` con la fecha completa y `title` con fecha y hora.
- **Estados:** carga con `aria-busy`, `role="status"` y tres esqueletos; error
  con explicación y «Volver a intentar»; vacío con una sola primaria. La
  actividad no se pinta durante la carga.
- **Marca procedural:** `worldMarkVariant` usa FNV-1a del `id` inmutable; el
  motivo usa los dos bits bajos y el tono los siguientes, de modo que renombrar
  o editar el mundo no cambia la marca. Sin `Math.random`, fecha ni estado.
  Cuatro tramas (meridianos, contornos, cruz, líneas) por cuatro pares
  `--entity-*`; la marca es decorativa y no anima.
- **Espacio y texto largo:** `min-width: 0`, `overflow-wrap: anywhere` y rejilla
  que envuelve a 1024/1280/1600 px sin scroll horizontal de página.

### 10.3 Vista de mundo

Implementado en #128: la página de un mundo es el marco modular del mundo, no un
documento apilado. La descripción rica del módulo «Resumen» llega con #114.

- **Composición y orden:** vuelta a Inicio → cabecera de identidad → navegación
  «Módulos del mundo» → «Resumen» → «Preparación del mundo» → «Actividad de este
  mundo». El orden es fijo y la vista no tiene paneles plegables.
  No hay hero con inicial gigante, ni rejilla de «Accesos rápidos» con
  descripciones, ni párrafo de presentación.
- **Cabecera de identidad:** portada o `WorldMark` (4,5 rem) y un bloque con la
  insignia de estado, el resumen —con texto de reserva si falta— y los géneros
  como insignias de acento. No repite el nombre: el `h1` vive en la barra
  superior desde #126. Tampoco declara acciones: **Nueva ficha** y el menú `⋯`
  con editar, duplicar, archivar/restaurar y eliminar siguen solo en la barra.
- **Navegación modular:** `nav` con la etiqueta «Módulos del mundo» y una lista de
  cinco piezas. **Resumen** es el módulo actual (`aria-current="page"`) y
  **Fichas** es el único módulo implementado al que se navega. **Mapas**,
  **Manuscrito** y **Grafo** son texto estático con la insignia «Previsto»: no
  son botones, no entran en el orden de tabulación y no generan enlaces muertos;
  una nota al pie aclara que llegarán en próximas versiones. El juego se
  incorporará a la lista cuando tenga pantalla.
- **Recuento de fichas:** vive dentro del botón **Fichas** como información
  secundaria. Se lee una vez por montaje con el canal existente `entities:list`
  (límite por defecto) y se presenta como «1 ficha», «N fichas» o «N o más
  fichas» cuando la lista alcanza el límite. En carga o error se omite: no
  bloquea la página ni anuncia un fallo. Al volver de Fichas la vista se remonta
  y el recuento se refresca.
- **Resumen:** descripción legible —con texto de reserva e indicación de dónde
  añadirla— y una lista de datos `dl` en dos columnas que colapsa con el ancho:
  identificador, idioma del contenido, creado y actualizado, con `<time>`.
- **Descripción rica del mundo (#114):** desde #114 el módulo «Resumen» pinta el
  documento de ProseMirror con el editor compartido en lectura, a 68ch, sin barra,
  sin popover y sin atributos de formulario. El título es «Resumen»; a su derecha
  aparece «N palabras» con el cualificador oculto «Recuento de la descripción:»,
  solo si hay texto. Los enlaces internos se leen en `--accent-strong`, navegan
  con clic y con `Enter`, y un enlace a una ficha no disponible avisa sin navegar.
  Si no hay texto, se muestra un párrafo de vacío en `--muted` y no se monta un
  editor vacío. **No se añaden acciones nuevas:** editar sigue en el menú `⋯` de
  la barra superior. El contenido largo no se trunca y la página desplaza en
  vertical. El contrato está en
  [`mundo-descripcion-issue-114.md`](mundo-descripcion-issue-114.md).
- **Preparación:** barra de progreso con `role="progressbar"`,
  `aria-valuemin/max/now` y `aria-valuetext` porcentual, recuento «de 3 campos
  completados» y lista de resumen, descripción y géneros con **Completado** o
  **Pendiente**. La pista usa `--border-strong` para alcanzar 3:1 sobre la
  superficie.
- **Actividad:** al final, con tipografía y peso secundarios, solo del mundo
  abierto. Las entradas se separan con un divisor `--border` y no llevan caja. No
  se pinta durante la carga.
- **Estados:** carga con un aviso de estado; error con explicación, **Volver a
  intentar** y **Volver a Inicio**, sin perder los datos.
- **Espacio y texto largo:** `min-width: 0` y `overflow-wrap` en cabecera,
  descripción y datos; a 1024, 1280 y 1600 px no hay scroll horizontal de página.

### 10.4 Ficha

Implementado en #129: la ficha es un documento legible con edición en contexto,
no un formulario permanente. El contrato visual y de accesibilidad completo está
en [`ficha-issue-129.md`](ficha-issue-129.md).

- **Modo:** lectura por defecto y edición explícita desde **Editar** o el clic en
  el título. En lectura no existen los campos de nombre, alias ni resumen; en
  edición aparecen una sola vez, sin duplicar el texto. Una sola primaria,
  **Listo**; no hay «Cancelar» porque el autoguardado ya persiste.
- **Cabecera:** insignias de tipo y estado, `h2` con el nombre —«Ficha sin
  nombre» si falta—, alias y resumen como texto, fecha y slug, favorito con
  nombre fijo y `aria-pressed`, estado de guardado `role="status"` siempre
  montado, **Editar** o **Guardar ahora** + **Listo**, y `⋯` con la papelera.
- **Secciones plegables:** Descripción, Campos del tipo, Relaciones y Recursos,
  con `h3 > button`, `aria-expanded`, chevron decorativo, recuento y acciones
  fuera del botón. Solo Descripción abierta al entrar; el cuerpo cerrado sigue
  montado y se oculta con `hidden`. Un error abre la sección afectada.
- **Panel de propiedades:** `aside` llamado «Propiedades» con portada, estado y
  etiquetas, nada más. Se oculta con el toggle de la barra de página, se
  redimensiona entre 280 y 360 px (320 por defecto) con separador accesible y es
  sticky bajo la barra. A ≤ 1180 px se apila después del documento y el separador
  desaparece.
- **Recursos:** la galería importa y quita imágenes; la portada se elige solo en
  el panel y la miniatura que lo es lleva la insignia «Portada». Una sola
  autoridad de portada, sin «Usar como principal» duplicado.
- **Campos:** ficha técnica `dl` en lectura, con números y fechas formateados,
  referencias navegables y «Sin valor»; formulario compacto solo en edición.
- **Foco y errores:** «Editar» enfoca Nombre; «Listo» devuelve el foco a
  «Editar»; «Editar descripción» y «Editar campos» abren su sección y enfocan su
  destino; un error explícito enfoca el primer control inválido y el
  autoguardado no roba el foco. La alerta en línea explica el fallo y ofrece
  reintento solo si falló el guardado.
- **`Ctrl+S`:** guarda en edición, evita siempre el diálogo de guardar página y
  no actúa con un diálogo abierto.
- **Persistencia:** el panel, su ancho y las secciones se persisten desde #132
  con ámbito global, no por ficha ni por tipo, y se aplican en el primer render.
  El detalle está en §10.8 y en el ADR 0027.
- **Ventana y texto largo:** a 1024, 1280 y 1600 px no hay scroll horizontal de
  página; el panel, las secciones, los chips y los valores largos usan
  `min-width: 0` y `overflow-wrap`.

### 10.5 Relaciones y grafo

Contrato aprobado en [`relaciones-issue-130.md`](relaciones-issue-130.md).
**Implementado en #130**; la fila «Lista de relaciones» de §9 y la de §17 ya
figuran como implementadas. El grafo completo sigue previsto en #83.

- **Lectura:** dirección primero (salientes y backlinks) y, dentro, grupos por
  etiqueta efectiva. La recíproca solo aparece si difiere («Inversa: …» en
  salientes, «Directa: …» en entrantes); los tipos simétricos no la repiten. Si
  la etiqueta es una sobrescritura, el grupo añade «Tipo: …».
- **Entradas:** no son una tabla ni una tarjeta. Lista `ul > li` separada por
  divisores `--border`, con insignia de dirección (texto e icono), nombre de la
  contraparte con `TypeIcon` y aspecto de enlace, tipo de entidad, fuerza en
  forma con nombre accesible, notas completas y menú `⋯`. Sin tercera
  superficie.
- **Acciones:** abrir la ficha contraparte es la única acción visible; editar y
  eliminar viven en `⋯`. El borrado es modal, empieza con el foco en «Cancelar»
  y no se puede cerrar mientras la petición está en curso.
- **Backlinks:** se rotulan como tales en la sección y en cada entrada, y
  navegan a la ficha de origen.
- **Grafo:** no hay enlace, botón, ítem deshabilitado, tooltip, texto ni clave de
  i18n de grafo mientras #83 no exista. El grafo contextual no duplicará el de
  #83.
- **Color:** la marca del tipo y las insignias son decorativas o van con texto;
  la relación se entiende por jerarquía, texto y forma, no por color.
- **Ventana:** la sección no tiene punto de ruptura propio; a 1024, 1280 y 1600 px
  envuelve en una columna sin scroll horizontal y con `min-width: 0` en todos
  los hijos de flex/grid.

### 10.6 Editor

Contrato completo y vinculante en
[`editor-issue-131.md`](editor-issue-131.md), aprobado en #131. Corrige la
formulación anterior «sin barra de herramientas permanente»: la barra mínima de
cinco acciones **sí es permanente en edición**; lo que se retira es la barra
extensa de once controles y cualquier segunda fila.

- **Edición:** una sola fila de cinco controles en este orden: Negrita,
  Cursiva, **Formato**, Enlace y Mención. Botones de 32×32 px, glifo o icono de
  20 px, separación de 4 px y ≈255 px de ancho total; nunca se envuelve ni
  provoca scroll horizontal a 1024, 1280 y 1600 px. «Formato» es texto visible
  con chevron; Enlace y Mención son solo icono con nombre accesible y se
  distinguen por forma, posición y nombre. El botón Mención inserta `@` y abre
  el mismo selector que el teclado.
- **Menú Formato:** tres bloques separados: Párrafo y Título 1–3
  (`menuitemradio` con `aria-checked`), listas y cita (`menuitemcheckbox`) y
  Abrir/Quitar enlace (`menuitem`, deshabilitados si el cursor no está en un
  enlace). Reutiliza el `Menu` existente, incluidos flechas con envoltura,
  Inicio/Fin, Escape con retorno de foco y posicionamiento con volteo; al
  aplicar un formato el foco vuelve al editor.
- **Menciones:** `@` (tras inicio, espacio o puntuación de apertura) y `[[`
  (en cualquier posición) abren un combobox/listbox anclado al cursor, de 17–22
  rem, con clamp horizontal, volteo vertical, máximo de ocho opciones visibles y
  scroll interno. El foco permanece en el editor y `aria-activedescendant` marca
  la opción; el nombre largo envuelve sin truncarse. `Escape` cierra sin borrar
  el texto y `Enter`, `Tab` o clic insertan el enlace interno `wc-entity://`.
- **Patrón accesible:** en edición el contenteditable es `role="combobox"` con
  `aria-expanded` y `aria-controls` siempre presentes, `aria-autocomplete="list"`
  y sin `aria-multiline`; el `listbox` existe siempre y se oculta con `hidden` y
  `display: none`. En lectura se retiran todos los atributos de formulario y no
  se monta el popup.
- **Lectura:** sin barra, sin menú y sin popup; los enlaces internos van en
  `--accent-strong` y el clic normal navega. En edición, `Ctrl/Cmd+clic` y
  «Abrir enlace» del menú.
- **Guardado:** se anuncia con `aria-live`; el autoguardado no roba el foco.
- **Contenido largo:** ancho de lectura de 60–72 caracteres y scroll vertical;
  la barra y el popup no generan scroll de página.
- **Temas:** solo roles semánticos. Las parejas de contraste del editor
  (`--fg` sobre `--surface-sunken`, `--accent-strong` sobre `--accent-surface`,
  `--accent`, `--muted` y `--disabled-text` sobre `--surface-raised`) viven en
  §4.5 y en el test de tokens.

#### 10.6.1 Variante de la descripción del mundo (#114)

El editor compartido se usa también en la descripción del mundo con el mismo
contrato de #131 y una variante de composición. El detalle vinculante está en
[`mundo-descripcion-issue-114.md`](mundo-descripcion-issue-114.md).

- **Barra:** tres controles en **creación** (Negrita, Cursiva, `│`, Formato);
  cinco en **edición** (los anteriores más Enlace y Mención). Una sola fila,
  `flex-wrap: nowrap`, ≈170 px con tres y ≈255 px con cinco; nunca desborda a
  1024 px.
- **Candidatas:** en creación no hay fichas y no se montan Enlace ni Mención. En
  edición se cargan las del mundo; mientras cargan o si falla la carga, los dos
  botones quedan deshabilitados con estado visible, `role="status"` y
  **Reintentar**, que no bloquea el guardado.
- **Roles:** `combobox` con listbox cuando las candidatas están listas; `textbox`
  multilínea mientras cargan, fallan o no hay menciones. En lectura no hay rol ni
  atributos de formulario; solo los enlaces son enfocables.
- **Contador y error:** etiqueta y contador en una fila (`0 / 4.000 caracteres`);
  el exceso se marca en `--danger`, con `aria-invalid`, error asociado por
  `aria-describedby`, envío bloqueado y foco al editor. El límite se calcula sobre
  el texto plano extraído, nunca sobre el JSON.
- **Borde del formulario:** en el diálogo del mundo, la barra y el contenido del
  editor usan `--border-strong` para cumplir 3:1 como control de formulario; el
  editor de la ficha conserva `--border` por #131. Con error, el borde pasa a
  `--danger`; deshabilitado usa `--disabled-*` sin opacidad.
- **Navegación:** dentro del diálogo modal **no se navega**; `Ctrl/Cmd+clic` y
  «Abrir enlace» se suprimen y la ayuda lo explica. La navegación a una ficha vive
  solo en la página del mundo.
- **Escape por capas:** el popover de menciones y el diálogo de enlace cierran
  solo su capa; el diálogo del mundo ignora Escape con `defaultPrevented` y no se
  cierra mientras guarda.
- **Medidas:** diálogo de 44 rem, cuerpo con scroll y pie fijo; editor de 10 a
  20 rem con scroll interno. Verificado a 1024, 1280 y 1600 px en Claro y Oscuro.

### 10.7 Ajustes

Implementado en #79 (ADR 0030). Ajustes es una **página editorial de una
columna** —no un dashboard de tarjetas—, con un ancho máximo de 60 rem y scroll
vertical. Se abre desde el **pie del rail**, encima del botón de plegar, con
`aria-current="page"`, desde el comando **Abrir Ajustes** de la paleta y por el
hash estable `#/settings`. La aplicación sigue abriendo en Inicio.

**Orden y composición**

```text
Ajustes
  lead
  Apariencia        tema · densidad · tamaño · Restablecer apariencia
  Idioma            valor actual + nota, sin selector
  Atajos            plegable, cerrado; solo Ctrl+K y Esc + nota del editor
  Actualizaciones   versión, última comprobación, estado y abrir diálogo
  Datos             resumen · carpetas · uso (plegable) · exportar ·
                    huérfanas · zona de peligro (siempre visible)
  Restablecer preferencias
```

- Solo se pliegan **Atajos de consulta** y **Uso de disco**. La zona de peligro
  nunca se pliega.
- Los cambios de apariencia se aplican al instante; las preferencias se guardan
  en la misma capa de #132 (§10.8).
- «Restablecer apariencia» vuelve a Claro, Cómoda y Normal con `update`, no con
  `reset`; «Restablecer preferencias» usa `reset` tras confirmación y no borra
  contenido.

**Apariencia y tokens**

- Tres `fieldset` con `legend` único: Tema (Claro/Oscuro), Densidad (Cómoda/
  Compacta) y Tamaño del texto (Pequeño/Normal/Grande). Nunca un `select` para
  estas opciones.
- La densidad redefine `--space-3` a `--space-9` y mantiene `--space-1`,
  `--space-2`, los mínimos de control (≥28 px), iconos, radios y `--focus-*`.
- El tamaño redefine `--text-xs` a `--text-display` por token. No se toca
  `html { font-size }`, `zoom`, `transform` ni `--space-*`.
- La rejilla de apariencia usa `auto-fit`/`minmax(14rem, 1fr)`; a 1024 px pasa a
  2 o 1 columna sin recortar etiquetas.
- La tabla de carpetas usa `table-layout: fixed`, `caption` oculta y
  `scope="col"`/`scope="row"`; la ruta relativa va en mono y la acción envuelve.
  Las tablas no generan scroll horizontal de página.
- La zona de peligro usa `--danger-surface` de fondo, `--danger` en borde y
  título, y `--fg` en el cuerpo (nunca `--muted`). Cero colores literales.

**Datos y diálogos**

- Estados de carga con esqueletos solo en Datos; error inline con `role="alert"`
  y reintento; modo seguro con el texto de no disponible.
- Exportar muestra nombre, tamaño y número de mundos; el diálogo no se descarta
  mientras dura.
- Purgar huérfanas y eliminar todos los datos usan diálogos destructivos no
  descartables, con foco inicial en **Cancelar**, foco al estado durante la
  operación y al resultado al terminar, y retorno al disparador al cerrar.
- El borrado exige escribir **ELIMINAR TODO**, con la casilla «Conservar también
  las copias» desmarcada por defecto; el éxito se lee en un panel de reinicio
  enfocable.
- Una sola región `aria-live="polite"` por página mediante
  `SettingsAnnouncerProvider`; los errores usan `role="alert"` y no duplican el
  anuncio. `prefers-reduced-motion` detiene esqueletos y transiciones.

### 10.8 Preferencias persistentes de interfaz

Implementado en #132 (ADR 0027) y ampliado en #79 (ADR 0030). El estado de
interfaz que antes vivía en memoria se guarda en la base local y se aplica antes
del primer pintado. Ajustes (§10.7) consume esta misma capa: no hay pantalla con
almacenamiento paralelo ni `localStorage`.

**Matriz de estados persistidos**

| Preferencia | Al abrir | Defecto | Valor inválido | Ámbito | Cuándo se escribe |
|---|---|---|---|---|---|
| Tema | Toda la UI en el tema guardado; `data-theme` antes de `createRoot` y fondo de ventana coherente | Claro | Claro | Aplicación | Toggle de la barra, comando de la paleta, radios de Ajustes |
| Densidad | Espaciado guardado desde el primer frame | Cómoda | Cómoda | Aplicación | Radios de Ajustes o «Restablecer apariencia» |
| Tamaño del texto | Escala de texto guardada desde el primer frame | Normal | Normal | Aplicación | Radios de Ajustes o «Restablecer apariencia» |
| Rail plegado | 240/64 px desde el primer frame, sin animación | Expandido | Expandido | Aplicación | Al plegar o expandir |
| Panel visible | `aside` Propiedades como se dejó | Visible | Visible | Global, no por ficha | Toggle de la barra de página |
| Ancho del panel | Ancho guardado entre 280 y 360 px | 320 | Redondeo o recorte; no finito → 320 | Global | Solo en commits explícitos: soltar arrastre, flechas, Inicio/Fin, doble clic y toggle |
| Secciones | Descripción, Campos, Relaciones y Recursos como se dejaron | Solo Descripción abierta | Solo Descripción abierta, por sección | Global | Al plegar o expandir; también cuando un error abre una sección |
| Última vista | No se ve: la aplicación abre siempre en Inicio | Inicio | Inicio | Aplicación | Cada cambio de vista salvo Muestras; incluye `settings` |
| Último mundo o ficha | Tarjeta Continuar | Ausente | Se limpia | Aplicación | Abrir mundo o ficha, cargar el nombre, borrar y degradar |

**Reglas de arranque**

1. El proceso principal lee el tema **antes de crear la ventana** y aplica
   `nativeTheme` y el fondo nativo (`#f6f4ef` en Claro, `#141715` en Oscuro, igual
   que `--bg`).
2. La ventana nace oculta y solo se muestra cuando coinciden `ready-to-show` y
   `did-finish-load`, con un límite de 2.500 ms para no dejarla invisible. Enfocar
   una segunda instancia no adelanta esa compuerta.
3. El renderer lee el snapshot antes de montar React, fija `data-theme`,
   `data-density` y `data-font-scale` antes de `createRoot` y descarta una
   respuesta tardía tras 1.500 ms; así `StrictMode` no duplica la lectura ni hay
   cambio de apariencia tras el primer pintado.
4. Un fallo de lectura, una forma inválida o una API ausente caen en los valores
   por defecto sin bloquear el arranque. Un fallo de escritura conserva el estado
   de la sesión y no muestra aviso, toast ni `aria-live`: el tema ya aplicado no se
   revierte y el cromo de la ventana sigue coherente.
5. `lastView` se guarda pero **nunca navega** ni toca el hash. «Continuar» es la
   única reanudación y se valida contra la biblioteca; `samples` no se persiste y
   `settings` sí.

**Escritura, restablecimiento y restauración**

- Leer no crea filas ni repara valores: cada clave cae a su defecto sin contagiar
  a las demás. La primera escritura crea su fila.
- Se escribe solo lo que cambia, con `updated_at` y en una transacción.
- **Restablecer apariencia** envía un `update` con `theme: 'light'`,
  `density: 'comfortable'` y `fontScale: 'normal'`; conserva el resto de
  preferencias y no toca datos.
- **Restablecer preferencias** borra únicamente las claves `ui.*` tras la
  confirmación del diálogo y devuelve los valores por defecto; no toca mundos,
  fichas, imágenes, relaciones, copias ni migraciones. Se adopta en caliente, sin
  recargar ni cerrar diálogos.
- A **≤ 1180 px** el panel se apila y el ancho guardado no se aplica; al volver a
  más de 1180 px se recupera el ancho persistido.

El contrato completo de la decisión está en el
[ADR 0027](../adr/0027-ui-preferences-persistence.md) y en el
[ADR 0030](../adr/0030-settings-data-and-full-deletion.md).

### 10.9 Transferencia de mundos

Implementado en #78 (ADR 0029). No añade tokens, dependencias ni un patrón de
diálogo nuevo: reutiliza `Dialog`, `Button`, `Badge` y `.wc-progress`.

**Composición**

- El diálogo se abre con el **primer evento de progreso**, no al pulsar la
  acción; mientras el selector nativo está abierto no hay diálogo.
- Ancho máximo de **40rem**, con nombre del mundo y textos largos que envuelven
  (`overflow-wrap` y `min-width: 0`).
- Cabecera con insignia de estado y, en exportación, el nombre del mundo.
- Cuerpo de progreso: fase, detalle, recuento y barra. En éxito o error, resumen
  con metadatos, recuentos, avisos o el código traducido.

**Estados y tokens**

| Estado | Composición | Tokens |
|---|---|---|
| `running` | Insignia **En curso** (`accent`), fase, detalle, recuento, barra y **Cancelar** si la fase es cancelable | `--accent-surface`, `--muted`, `--border`, `--surface-sunken` |
| `cancelling` | Insignia **Cancelando** (`neutral`), botón de carga deshabilitado y detalle de espera | `--disabled-*`, `--muted` |
| `exported` / `imported` | Insignia **Completado** (`success`) o **Completado con avisos** (`warning`), resumen y acciones | `--success`, `--warning`, `--surface-sunken` |
| `failed` | Insignia **No completado** (`danger`), mensaje con `role="alert"`, garantía de que no se ha guardado nada y reintento si procede | `--danger`, `--border`, `--surface-sunken` |
| Avisos | Icono decorativo + texto con plural `Intl`; no usan solo color | `--warning` |

**Accesibilidad y movimiento**

- Fase en `role="status"` con `aria-live="polite"` y `aria-atomic="true"`; el
  error de la operación completa en `role="alert"`.
- Barra con `role="progressbar"`, `aria-label`, `aria-valuetext` y
  `aria-valuemin`/`aria-valuemax`/`aria-valuenow` solo cuando el total se
  conoce; indeterminada no expone `aria-valuenow`. `aria-busy` queda fuera de la
  región viva para no duplicar anuncios.
- Foco inicial en **Cancelar** si la fase es cancelable; si no, en la fase. Al
  terminar, foco en la acción principal del resumen y, al cerrar, retorno al
  disparador. `Escape` no cierra mientras `running` o `cancelling`.
- La barra indeterminada usa `--ease-in-out` y se **detiene** con
  `prefers-reduced-motion: reduce`; el estado se transmite igualmente por texto
  y `aria-valuetext`.
- Contraste AA en ambos temas; sin elementos nuevos fuera de los tokens
  existentes.

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
| Deshabilitado | `--disabled-surface`, `--disabled-border` y `--disabled-text`, sin `opacity`; la superficie se distingue de `--surface-raised`. |
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
- El separador del panel de propiedades es un `role="separator"` enfocable con
  nombre, `aria-valuemin/max/now` y `aria-valuetext`; flechas ±16 px, `Inicio` y
  `Fin`, y `Escape` cancela el arrastre.
- El foco se dirige al entrar y salir de edición y al primer error de un guardado
  explícito; el autoguardado anuncia el error sin mover el foco.
- En lectura, la descripción no conserva `role="textbox"` ni el `aria-label` de
  Tiptap; el nombre lo aporta el encabezado de la sección.
- En edición, el editor es un `combobox` con `aria-expanded` y `aria-controls`
  siempre presentes y sin `aria-multiline`; el `listbox` de menciones existe
  siempre, se oculta con `hidden` y el foco permanece en el editor mientras se
  navega con `aria-activedescendant`.
- `Ctrl+S` guarda en edición y evita el diálogo de guardar página de Electron.
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
- **Paneles:** se pueden plegar y, donde aporta valor, redimensionar (la ficha,
  280–360 px con separador accesible). El estado del panel, su ancho y las
  secciones de la ficha se persisten desde #132.
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
- Cuando un botón repite el nombre visible de su objeto, la acción va primero y
  el objeto después («Quitar campo Etiqueta»), de modo que el texto visible quede
  contenido en la etiqueta accesible.
- Las acciones destructivas nombran el objeto y la consecuencia.
- No se usan cadenas de interfaz dispersas en componentes.

## 16. Migración de tokens

La migración de tokens y primitivas se ejecutó en #125. La tabla es el contrato
de sustitución que se aplicó y sirve de referencia para las pantallas que migran
en #127–#133.

| v1 | v2 | Acción |
|---|---|---|
| `--palette-paper-50/100/200` | `--palette-neutral-0/50/100` | Reasignar superficies; el texto oscuro deja de usar la familia papel. |
| `--palette-ink-950/900/800/600/500/400/200` | `--palette-neutral-900/850/800/600/500/400/450` | No hay equivalencia 1:1; cada rol se reasigna a `--bg`, `--fg`, `--muted`, `--border` o `--surface*`. |
| `--palette-moss-*` | `--palette-forest-*` y `--palette-success-*` | El acento pasa a bosque; el éxito usa su propia familia. |
| `--palette-ochre-*` | `--palette-sand-*` y `--palette-warning-*` | La selección usa arena; el aviso usa su propia familia. |
| `--palette-danger-*` | `--palette-danger-*` | Se conservan los nombres y se actualizan los valores. |
| `--palette-prussian-*` | `--palette-slate-*` | Sale del foco de UI; el token persistido `prussian` se resuelve como marca de tipo. |
| `--paper` y `--ink` | `--bg`, `--fg` y `--surface*` | Se retiraron del contrato de componentes en #125; no hay alias de color. |
| `--surface` y `--surface-raised` | Se conservan | Se añade `--surface-sunken`. |
| `--border` | `--border` (divisor) y `--border-strong` | Los campos y controles usan `--border-strong`; los divisores, `--border`. |
| `--focus` | `--focus` | Pasa de azul prusiano a bosque; se mantiene 3:1. |
| `--selection` | `--selection` | Pasa de ocre/musgo a arena. |
| `--shadow-1/2` | Se conservan | Nuevos valores neutros; las tarjetas dejan de usar sombra. |
| `--radius-sm/md/lg` | Se conservan | 4/6/8 px; se retiran los 10 px por defecto. |
| `--font-display` | `--font-content` y `--font-ui` | La serif se reserva a contenido; la interfaz usa `--font-ui` del sistema. El alias se retiró en #126. |
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
| Tokens, tipografía y primitivas v2 | Implementado | #125 |
| Shell, navegación y barra superior v2 | Implementado | #126 |
| Inicio y tarjetas de mundo | Implementado | #127 |
| Vista de mundo modular | Implementado | #128 |
| Ficha como documento y panel de propiedades | Implementado | #129 |
| Relaciones legibles y grafo contextual | Implementado (relaciones); grafo previsto en #83 | #130 |
| Editor mínimo y menciones | Implementado | #131 |
| Preferencias de interfaz persistentes | Implementado | #132 |
| Ajustes, apariencia y datos | Implementado | #79 |
| Auditoría visual, temas y ruido | Implementado | #133 |
| Diálogo de transferencia y barra indeterminada | Implementado | #78 |

**M1.5 está cerrado.** La composición v2 está aplicada y auditada en tokens y
primitivas (#125), shell (#126), Inicio (#127), vista de mundo (#128), ficha
(#129), relaciones (#130), editor (#131), preferencias persistentes (#132) y
auditoría visual (#133). La auditoría transversal cubrió las seis pantallas, sus
estados alcanzables, los overlays y el banco de Muestras en 3 anchos × 2 temas;
el resultado y las capturas locales están en
[`auditoria-visual-issue-133.md`](auditoria-visual-issue-133.md). Siguen
previstos el grafo completo (#83) y la auditoría final de accesibilidad de M5
(#93), que este trabajo no sustituye.

### 17.2 Verificación automática

- `tests/unit/design-tokens.test.ts` verifica la paleta v2, los roles de ambos
  temas, la tabla §4.5 completa (incluidas las parejas nuevas de superficie
  hundida, foco, marcas de entidad y las que añade el editor en #131), la
  disciplina de capas, la ausencia de tokens indefinidos, las escalas, la
  elevación, los estados sin opacidad, el movimiento reducido y la licencia OFL
  de la fuente empaquetada.
- `tests/components/primitives.test.tsx` cubre botón de icono, menú, casilla,
  radio, panel, sección plegable, esqueleto, tarjeta, diálogo y avisos;
  `samples.test.tsx` monta el banco completo con el catálogo real.
- `tests/components/shell.test.tsx` verifica que el rail muestra solo Inicio y
  Mundos, sin Muestras, lema ni versión, y que Mundos queda como página actual
  también en mundo, fichas y ficha. Cubre el plegado con nombres accesibles y
  tooltip al foco, el estado controlado, la acción primaria única, el menú `⋯`
  con retorno de foco, el disparador de la paleta con su atajo y el título
  truncado a una línea.
- `tests/e2e/accessibility.spec.ts` ejecuta axe sobre el shell en Claro y Oscuro
  con el rail expandido y plegado, y sobre Muestras abierta por su hash interno.
- `tests/e2e/design-v2.spec.ts` comprueba en la ventana real, a 1024 px y en los
  dos temas, el ancho de tooltip, la colisión de tooltip y menú con el borde
  derecho, el foco computado de la casilla inválida, los objetivos de 28 px, el
  hover, las marcas de tipo y el recorte dentro del diálogo. Repite con tooltip
  y menú abiertos a 1280 y 1600 px para verificar que tampoco desbordan.
  También verifica que el primer Escape con tooltip visible solo cierra el
  tooltip, que PageDown cierra un menú corto, que un menú largo limita su altura
  y conserva la rueda interna, y que el menú del diálogo se mantiene dentro de
  la tarjeta.
- `tests/e2e/shell.spec.ts` comprueba que la navegación no muestra versión, que
  Inicio y Mundos son las únicas entradas y que Muestras solo se abre por hash y
  la URL se limpia al salir. Mide el rail plegado a 64 px y la barra a 56 px,
  verifica una sola primaria por vista, el menú del mundo con teclado, `Escape` y
  retorno de foco, los iconos accesibles de tema y actualizaciones, el enlace de
  salto sin cambio de hash, la ventana a 1024, 1280 y 1600 px sin scroll
  horizontal con un nombre de mundo largo, Muestras como contenido largo y la
  carga de la fuente local.
- `tests/e2e/entities.spec.ts` cubre la lista y la ficha. Desde #129 incluye 9
  E2E de entidades: creación, autoguardado, etiquetas, favorito y filtros;
  creación rápida; relaciones y backlinks; contenido largo con axe; documento
  vivo con lectura, foco, secciones, panel, separador y persistencia de la vista;
  arrastre del separador con `Escape`; errores que abren la sección y enfocan el
  control; matriz 1024/1280/1600 × temas × panel abierto/cerrado; y papelera
  desde `⋯`.
- `tests/e2e/search.spec.ts` entra a la búsqueda por la paleta, porque el rail ya
  no tiene ítem; `tests/components/search.test.tsx` comprueba que la paleta no
  ofrece Muestras y que el comando se llama «Abrir la página de búsqueda».
- `tests/unit/i18n/formats.test.ts` cubre `formatRelativeTime` con reloj
  inyectable: «ahora», recorte de futuro y las ventanas de segundos, minutos,
  horas, días, semanas, meses y años. `tests/unit/world-mark.test.ts` fija los
  vectores de `worldMarkVariant`, su determinismo, la cobertura de 4 motivos y 4
  tonos y la cadena vacía. `tests/unit/recent-location.test.ts` cubre
  `resolveContinueTarget`: sin destino, mundo ausente, mundo, ficha con y sin
  nombre y no mutación.
- `tests/components/home-page.test.tsx` verifica la mesa de trabajo: orden de
  secciones, ausencia de contadores y accesos rápidos, cinco mundos y «Ver
  todos» solo con más de cinco, cinco entradas de actividad, «Continuar» con
  mundo y ficha, texto de reserva, omisión sin destino, carga con `aria-busy` y
  `role="status"`, error con reintento y una sola primaria en el estado vacío.
  `tests/components/worlds.test.tsx` cubre la marca procedural (`data-motif`,
  `data-tone`, `aria-hidden` y sin texto), la miniatura de portada y el `<time>`
  relativo con `dateTime` y `title`.
- `tests/e2e/worlds.spec.ts` recorre «Continuar» con el último mundo, su
  conservación al recargar —persistida desde #132—, la reanudación de una ficha,
  la desaparición al eliminar el mundo recordado y el menú de la tarjeta con
  flechas, `Fin`, `Escape` y retorno de foco. Añade Inicio con contenido largo a
  1024, 1280 y 1600 px, rail expandido y plegado y ambos temas (12
  combinaciones), sin scroll horizontal, y ejecuta axe WCAG 2.1 A/AA en Inicio en
  Claro y Oscuro sin violaciones críticas ni graves.
- La vista de mundo modular se cubre desde #128. `tests/unit/entity-count.test.ts`
  fija el recuento: resultado correcto, límite alcanzado («N o más»), error,
  lista vacía y no mutación. `tests/components/worlds.test.tsx` añade 11 pruebas
  del bloque «página de mundo» con el puente simulado: vuelta, cabecera sin
  nombre ni acciones, `nav` con `aria-current` y módulos previstos sin botón,
  recuento presente, ausente en carga y en error, oración de reserva, datos del
  mundo y actividad. `tests/e2e/worlds.spec.ts` comprueba la vista modular en la
  ventana real: entrada a Fichas por la navegación, que la cabecera no repite el
  nombre ni los botones de la barra, los módulos previstos sin foco y el bucle
  1024/1280/1600 px × rail expandido y plegado × ambos temas con una descripción
  de 4.000 caracteres, ocho géneros y un identificador largo, sin scroll
  horizontal y con axe WCAG 2.1 A/AA sin violaciones críticas ni graves.
- `scripts/check-build.mjs` verifica que los dos woff2 viajan en `out/renderer`,
  que el CSS construido los referencia con rutas relativas y que no hay hosts
  remotos de fuentes.
- La ficha como documento se cubre desde #129.
  `tests/unit/entity-view-memory.test.ts` fija los valores por defecto (panel
  abierto a 320 px y solo Descripción desplegada), el redondeo y el límite
  280–360, la actualización parcial, las copias sin mutación y `reset`.
  `tests/components/entity-detail.test.tsx` añade 18 pruebas: lectura sin campos,
  foco de «Editar» y «Listo», «Guardar ahora», autoguardado serializado, error
  explícito y error de autoguardado sin robar foco, secciones con teclado, panel
  con solo portada/estado/etiquetas, memoria del panel, separador con teclado,
  galería en Recursos, `Ctrl+S`, guardado al desmontar, reintento de relaciones,
  fallo de guardado, cola obsoleta, favorita y papelera, valores vacíos y fechas
  en UTC. `DisclosureSection` se cubre en `primitives.test.tsx`.
- Las preferencias de interfaz se cubren desde #132:
  `tests/unit/preferences/contracts.test.ts` fija los valores por defecto, los
  límites 280–360 y las guardas; `validation.test.ts` cubre la lectura tolerante y
  el rechazo estricto del parche; `handlers.test.ts` y
  `tests/unit/ipc-registry.test.ts` comprueban los tres canales. `tests/integration/preferences/service.test.ts`
  verifica la persistencia, la transacción, el borrado de `recentLocation`, el
  reset por prefijo y la preservación de datos. `tests/components/preferences.test.tsx`
  cubre el hook y la adopción optimista. `tests/e2e/preferences.spec.ts` reinicia
  la aplicación con tema, rail, panel y secciones persistidos, comprueba el reset
  por API sin pérdida de mundos ni fichas y recorre 1024/1280/1600 px en ambos
  temas con axe. Ajustes (#79) se cubre con pruebas de componentes de apariencia,
  idioma, atajos, actualizaciones y datos, y con `tests/e2e/settings.spec.ts`:
  navegación y persistencia, matriz de anchos y temas con axe, carpetas
  instrumentadas, exportación e importación real, huérfanas y borrado con copia
  `pre-delete`, reinicio simulado y sentinel de instalación.
- La transferencia se cubre desde #78: `tests/components/transfer.test.tsx` y
  `transfer-hook.test.tsx` recorren los estados, el foco, la cancelación, los
  avisos, el contenido largo y axe en ambos temas;
  `tests/e2e/transfer.spec.ts` comprueba el diálogo real a 1024/1280/1600 px,
  con contraste y `prefers-reduced-motion` en la barra indeterminada. No hay
  tokens nuevos.
- La auditoría visual se cubre desde #133 con un arnés propio:
  `tests/e2e/visual-audit.spec.ts` recorre 1024, 1280 y 1600 px × Claro/Oscuro
  las seis pantallas, sus estados vacíos o sin resultados, los siete overlays y
  el banco interno de Muestras, y deja 98 registros (88 celdas de la matriz más
  10 capturas extra). La semilla de `tests/e2e/fixtures/audit.ts` son 12 mundos,
  60 fichas (200 para rendimiento), una ficha de 50.000 caracteres y un tipo
  personalizado en uso. `scripts/audit-report.mjs` regenera la Parte B de
  [`auditoria-visual-issue-133.md`](auditoria-visual-issue-133.md) desde
  `test-results/e2e/audit/records.json`. El arnés mide `scrollWidth` frente a
  `clientWidth`, contraste computado con WCAG 2.2, axe, recorrido de foco con
  orden DOM y objetivos mínimos, movimiento reducido, ruido de cajas y
  rendimiento (nodos, montaje, long tasks y bloqueo). Las capturas PNG quedan en
  `test-results/` y no se versionan; `pnpm test:audit` ejecuta solo esta matriz.
  `tests/unit/design-noise.test.ts` impide reintroducir cajas heredadas,
  selectores muertos y residuos v1. Los estados `loading` y `error` no son
  inyectables con la API del preload congelada por `contextBridge` y se cubren
  en las pruebas de componentes citadas arriba. El informe generado registra 0
  violaciones de axe, 64 pares de contraste dentro de mínimo, 129 paradas de foco
  por tema con orden 0..n-1, 0 desbordamientos y 0 ruido.
- Al cerrar #127 la suite queda en 447 unitarias en verde (4 omitidas), 87 de
  componentes, 134 de integración en verde (1 omitida) y 42 E2E en verde. Al
  cerrar #128 queda en 453 unitarias (4 omitidas), 96 de componentes, 134 de
  integración (1 omitida) y 43 E2E. Al cerrar #129 queda en 459 unitarias (4
  omitidas), 119 de componentes, 134 de integración (1 omitida) y 9 E2E de
  entidades en verde; la suite E2E completa no se ejecutó en esa tarea. Al cerrar
  #132 queda en 518 unitarias (4 omitidas), 171 de componentes, 146 de integración
  (1 omitida) y 53 E2E en verde. Al cerrar #133 queda en 531 unitarias (4
  omitidas), 174 de componentes, 146 de integración (1 omitida) y 60 E2E en
  verde, con `pnpm test:audit` en 7/7.

### 17.3 Checklist antes de cerrar una issue de UI

Este checklist se mantiene como plantilla para las issues de UI de M2–M5. En el
cierre de M1.5 se cumplió entero y con evidencia en
[`auditoria-visual-issue-133.md`](auditoria-visual-issue-133.md): seis pantallas
en Claro y Oscuro, 1024/1280/1600 px sin scroll horizontal de página, 64 pares de
contraste medidos, 129 paradas de foco por tema, axe en 0/0/0, movimiento
reducido verificado, textos del catálogo, estados de carga, vacío y error
cubiertos (los no inyectables, en componentes), cero cajas de tarjeta por defecto
y manual actualizado.

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
- [ADR 0027: preferencias de interfaz persistentes](../adr/0027-ui-preferences-persistence.md)
- [ADR 0030: Ajustes, datos y borrado total](../adr/0030-settings-data-and-full-deletion.md)
- [Contrato de la ficha #129](ficha-issue-129.md)
- [Contrato del editor mínimo #131](editor-issue-131.md)
- [Contrato y auditoría visual #133](auditoria-visual-issue-133.md)
- [Plan de desarrollo](../plan-desarrollo.md)
- [Arquitectura](../arquitectura.md)
- [Proceso SDD](../proceso-sdd.md)
- [Plan de pruebas](../calidad/plan-de-pruebas.md)
- [Internacionalización](../internacionalizacion.md)
- [Manual de usuario](../manual-de-usuario.md)
