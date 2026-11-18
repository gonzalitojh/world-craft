# Sistema de diseño de World Craft

> **Estado:** guía vigente desde el 18/11/2026 para la aplicación de escritorio.
> Los componentes y tokens se implementarán en las issues de UI de M0 y M1.
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

## 3. Tokens

### 3.1 Capas

| Capa | Archivo previsto | Contenido |
|---|---|---|
| Paleta | `src/renderer/styles/tokens/palette.css` | Única fuente de colores hex. |
| Semántica | `src/renderer/styles/tokens/semantic.css` | Roles (`--paper`, `--ink`, `--surface`...). Sin hex. |
| Escalas | `src/renderer/styles/tokens/scales.css` | Espaciado, radios, sombras, tipografía, movimiento. |
| Tema | `[data-theme="light"]` y `[data-theme="dark"]` | Overrides agrupados por rol. |

Los archivos se crearán con el scaffold de UI; las rutas son el contrato
previsto, no archivos existentes.

### 3.2 Roles semánticos

| Token | Papel en tema claro | Papel en tema oscuro |
|---|---|---|
| `--paper` | Superficie principal | Texto principal |
| `--ink` | Texto principal | Superficie principal |
| `--surface` | Superficie secundaria | Superficie elevada |
| `--surface-raised` | Tarjetas y paneles | Tarjetas y paneles |
| `--border` | Bordes y separadores | Bordes y separadores |
| `--muted` | Texto secundario | Texto secundario |
| `--accent` | Acento principal | Acento principal |
| `--accent-strong` | Acento con más contraste | Acento con más contraste |
| `--success` | Éxito | Éxito |
| `--warning` | Aviso | Aviso |
| `--danger` | Error o destructivo | Error o destructivo |
| `--focus` | Anillo de foco | Anillo de foco |

Cada variable tiene **un solo papel por tema** y un override agrupado. No se
usa una variable como fondo en un tema y como texto en el otro sin comprobar
los dos.

### 3.3 Colores de tipos de entidad

Cada tipo de entidad tiene un color accesible en ambos temas. El color se usa
en el icono, la etiqueta y el nodo del grafo; nunca es el único indicador de
estado. Se eligen de una paleta limitada y se validan con contraste.

## 4. Tipografía

| Uso | Fuente | Tamaño mínimo | Peso |
|---|---|---|---|
| Display y títulos | **Fraunces** | 24 px | 600 |
| Texto de interfaz | **Inter** | 13 px | 400/500 |
| Datos y código | **JetBrains Mono** | 12 px | 400 |

- Interlineado de 1,4–1,6 en texto corrido.
- El texto de 13 px solo se usa en metadatos; el cuerpo va a 14–16 px.
- No se usan mayúsculas sostenidas en párrafos largos.
- Las fuentes se empaquetan con la aplicación; no se cargan de Internet.

## 5. Componentes

### 5.1 Base

| Componente | Estados | Notas |
|---|---|---|
| Botón | Reposo, hover, foco, activo, deshabilitado, cargando | Variantes primaria, secundaria, fantasma y destructiva. |
| Campo de texto | Reposo, foco, error, deshabilitado, lectura | Etiqueta siempre visible; error asociado. |
| Área de texto | Igual que campo | Contador opcional. |
| Selector | Reposo, abierto, foco, error | Teclado completo. |
| Casilla y radio | Marcado, indeterminado, foco | Área de clic amplia. |
| Tarjeta | Reposo, hover, seleccionada | No usa hover como único indicador. |
| Insignia | Neutra, acento, éxito, aviso, peligro | Texto, no solo color. |
| Diálogo | Abierto, cerrado, foco atrapado | Confirmación para acciones destructivas. |
| Panel lateral | Abierto, cerrado, redimensionando | Persistente cuando aporta. |
| Pestañas | Activa, inactiva, foco | `aria-selected`. |
| Menú | Abierto, cerrado, teclado | Sin menús anidados profundos. |
| Tooltip | Visible al foco y al hover | Solo para iconos y datos breves. |
| Aviso toast | Información, éxito, error | `aria-live` y cierre manual si es un error. |
| Estado vacío | Con y sin acción | Explica qué hacer, no solo «no hay datos». |
| Tabla | Ordenación, selección, vacía, carga | Scroll horizontal dentro del contenedor. |
| Árbol | Expandido, colapsado, seleccionado | Para capítulos y capas. |

### 5.2 Dominio

| Componente | Uso |
|---|---|
| Tarjeta de ficha | Nombre, tipo, imagen, resumen, etiquetas y acciones. |
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

No hay modo «sistema» en el MVP: el usuario elige Claro u Oscuro en Ajustes. La
preferencia se guarda en `config.json` y se aplica antes del primer pintado para
evitar parpadeo.

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
