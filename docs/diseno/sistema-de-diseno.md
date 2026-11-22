# Sistema de diseño de World Craft (v2)

> **Estado:** dirección v2 aprobada el 21/11/2026 en la issue #124 mediante el
> ADR 0025 y la decisión D-048. #125 implementó los tokens, la tipografía y las
> primitivas; #126 migró el shell, la navegación y la barra superior; #127 migró
> Inicio y las tarjetas de mundo; #128 migró la vista de mundo modular; #129
> migró la ficha como documento y su panel de propiedades. Las pantallas
> restantes se migran en #130–#133. Este documento describe el contrato completo
> y distingue lo implementado de lo previsto, sin presentar como existente nada
> que aún no lo esté. El estado real se mantiene en la sección 17.
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
| `--disabled-text` sobre `--disabled-surface` | Texto (mejora) | 4,72:1 | 7,74:1 | 4,5:1 |
| `--disabled-border` sobre `--disabled-surface` | Componente | 3,26:1 | 4,70:1 | 3:1 |
| `--danger-contrast` sobre `--danger` | Texto normal | 6,68:1 | 9,32:1 | 4,5:1 |
| `--muted` sobre `--surface-sunken` | Texto normal | 4,72:1 | 8,08:1 | 4,5:1 |
| `--focus` sobre `--surface-sunken` | Foco | 6,59:1 | 10,35:1 | 3:1 |
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
| Menú `⋯` | Acciones secundarias; teclado, foco y cierre con Escape. Se posiciona respecto al viewport, elige el lado con más espacio, limita su altura y desplaza su contenido sin cerrar el menú. | Implementado | #125 |
| Tooltip | Visible con foco y hover, `aria-describedby`, se oculta con Escape sin cerrar el diálogo que lo contiene. Ancho de contenido con máximo de 18rem y colocación arriba o abajo según el espacio. | Adaptado v2 | #125 |
| Aviso toast | `aria-live="polite"`, `role="status"`, cierre manual. | Adaptado v2 | #125 |
| Pestañas | Solo para formularios o Ajustes; no son pestañas de trabajo en M1.5. | Adaptado v2 | #125 |
| Panel | Sección con encabezado real y acciones; no se pliega por sí mismo. La primitiva plegable de la ficha es `DisclosureSection` desde #129; #132 persiste su estado, no añade el plegado. | Implementado | #125, #129 |
| Esqueleto | Marcador decorativo con `aria-hidden`; el contenedor lleva `aria-busy`. | Implementado | #125 |
| Tabla | Ordenación, filtros y selección; scroll horizontal solo dentro. | Previsto | — |
| Estado vacío | Explica qué falta y cuál es la acción principal. | Adaptado v2 | #125 |
| Paleta de comandos | `Ctrl+K`, combobox/listbox, navegación, creación, tema y reconstrucción. Entrada desde la barra superior y sin Muestras. | Implementado | #76, #126 |
| Cabecera de ficha | Tipo, estado, título, alias y resumen legibles; favorito, estado de guardado, «Editar»/«Listo» y `⋯`. En lectura no existen los campos de cabecera. | Implementada | #126, #129 |
| Panel de propiedades | Inspector de portada, estado y etiquetas; ocultable, de 280–360 px con separador accesible y sticky. No es un formulario paralelo. | Implementado | #129 |
| Sección plegable | `h3 > button` con `aria-expanded` y `aria-controls`, chevron decorativo, recuento y acciones fuera del botón; el cuerpo sigue montado y se oculta con `hidden`. | Implementada | #129 |
| Ficha técnica de campos | Lista `dl` de dos columnas, sin aspecto de tabla; números y fechas formateados, referencias como enlaces y «Sin valor» para los vacíos. | Implementada | #129 |
| Lista de relaciones | Dirección, etiqueta y ficha destino legibles; backlinks claros. | Previsto | #130 |
| Nodo de grafo | Avatar, nombre, tipo y selección; el grafo completo llega con #83. | Previsto | #130 |
| Editor mínimo | Formato básico, menciones `@` y `[[ ]]`; sin barra permanente. | Previsto | #131 |

## 10. Shell y pantallas

### 10.1 Shell

- Rail de 240 px plegable a 64 px sobre `--surface-sunken`, con la marca y
  navegación de producto **solo Inicio y Mundos**; sin lema permanente, versión,
  búsqueda duplicada ni actualizaciones. Los iconos de navegación conservan su
  nombre accesible y una ayuda emergente cuando el rail está plegado.
- El plegado usa iconos, `aria-label`, tooltip accesible, `aria-expanded` y
  `aria-controls`; el estado se mantiene durante la sesión y su persistencia
  llega con #132.
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
- **Continuar** retoma el último mundo o ficha abiertos durante la sesión. Es
  memoria de React: no se persiste, desaparece al recargar y se omite si no hay
  destino o si el mundo recordado ya no está en la biblioteca. Al eliminar ese
  mundo se limpia. El botón dice **Abrir el mundo** o **Abrir la ficha**; no
  existe «continuar escribiendo» hasta que haya manuscrito. Su persistencia es
  #132.
- **Mundos recientes** muestra como máximo cinco filas. «Ver todos los mundos»
  solo aparece con más de cinco y es una acción fantasma, no una primaria.
- **Actividad reciente** muestra cinco entradas, con tipografía y peso
  secundarios, separada por un divisor `--border`.
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
documento apilado.

- **Composición y orden:** vuelta a Inicio → cabecera de identidad → navegación
  «Módulos del mundo» → «Resumen» → «Preparación del mundo» → «Actividad de este
  mundo». El orden es fijo: los paneles plegables y su memoria llegan con #132.
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
- **Preparación:** barra de progreso con `role="progressbar"`,
  `aria-valuemin/max/now` y `aria-valuetext` porcentual, recuento «de 3 campos
  completados» y lista de resumen, descripción y géneros con **Completado** o
  **Pendiente**. La pista usa `--border-strong` para alcanzar 3:1 sobre la
  superficie.
- **Actividad:** al final, con tipografía y peso secundarios, solo del mundo
  abierto. No se pinta durante la carga.
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
- **Memoria de sesión:** panel y secciones se recuerdan en un módulo puro, sin
  `localStorage` ni IPC, y se pierden al recargar; #132 los persiste.
- **Ventana y texto largo:** a 1024, 1280 y 1600 px no hay scroll horizontal de
  página; el panel, las secciones, los chips y los valores largos usan
  `min-width: 0` y `overflow-wrap`.

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
  280–360 px con separador accesible). El estado por pantalla se recuerda durante
  la sesión y su persistencia llega con #132.
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
| Relaciones legibles y grafo contextual | Previsto | #130 |
| Editor mínimo y menciones | Previsto | #131 |
| Preferencias de interfaz persistentes | Previsto | #132 |
| Auditoría visual, temas y ruido | Previsto | #133 |

Mientras una fila diga «Previsto», esa pantalla aún no aplica la composición v2:
los tokens y las primitivas ya son v2 desde #125, el shell desde #126, Inicio
desde #127, la vista de mundo desde #128 y la ficha desde #129; las relaciones y
el editor siguen siendo los de v1 hasta que su issue los migre. No se deben tomar
capturas nuevas como si esas pantallas ya estuvieran rediseñadas.

### 17.2 Verificación automática

- `tests/unit/design-tokens.test.ts` verifica la paleta v2, los roles de ambos
  temas, la tabla §4.5 completa (incluidas las parejas nuevas de superficie
  hundida, foco y marcas de entidad), la disciplina de capas, la ausencia de
  tokens indefinidos, las escalas, la elevación, los estados sin opacidad, el
  movimiento reducido y la licencia OFL de la fuente empaquetada.
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
  vivo con lectura, foco, secciones, panel, separador y memoria de sesión;
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
- `tests/e2e/worlds.spec.ts` recorre «Continuar» con el último mundo, su pérdida
  al recargar, la reanudación de una ficha, la desaparición al eliminar el mundo
  recordado y el menú de la tarjeta con flechas, `Fin`, `Escape` y retorno de
  foco. Añade Inicio con contenido largo a 1024, 1280 y 1600 px, rail expandido y
  plegado y ambos temas (12 combinaciones), sin scroll horizontal, y ejecuta axe
  WCAG 2.1 A/AA en Inicio en Claro y Oscuro sin violaciones críticas ni graves.
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
- Al cerrar #127 la suite queda en 447 unitarias en verde (4 omitidas), 87 de
  componentes, 134 de integración en verde (1 omitida) y 42 E2E en verde. Al
  cerrar #128 queda en 453 unitarias (4 omitidas), 96 de componentes, 134 de
  integración (1 omitida) y 43 E2E. Al cerrar #129 queda en 459 unitarias (4
  omitidas), 119 de componentes, 134 de integración (1 omitida) y 9 E2E de
  entidades en verde; la suite E2E completa no se ejecutó en esta tarea.
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
- [Contrato de la ficha #129](ficha-issue-129.md)
- [Plan de desarrollo](../plan-desarrollo.md)
- [Arquitectura](../arquitectura.md)
- [Proceso SDD](../proceso-sdd.md)
- [Plan de pruebas](../calidad/plan-de-pruebas.md)
- [Internacionalización](../internacionalizacion.md)
- [Manual de usuario](../manual-de-usuario.md)
