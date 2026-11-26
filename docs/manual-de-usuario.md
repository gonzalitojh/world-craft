# Manual de usuario de World Craft

> **Estado:** manual en construcción. World Craft se encuentra en desarrollo y
> **todavía no hay una release pública**: el instalador existe y se genera en
> local para probar cada versión, pero la publicación oficial llega con M5. Las
> funciones se marcan como **previstas** hasta que la issue que las implementa
> esté terminada y probada. Este manual se actualiza en la misma tarea que cada
> cambio visible.
>
> Hoy el proyecto ya tiene un **instalador local para Windows** que se instala
> por usuario, sin permisos de administrador, y una **comprobación manual de
> actualizaciones** integrada en la barra superior. La ventana incluye una barra
> lateral con la navegación **Inicio**, **Mundos** y **Papelera**, una barra
> superior con el título de lo que estás viendo, el buscador de la paleta
> `Ctrl+K`, una acción principal, un menú `⋯` para las secundarias y los iconos de
> actualizaciones y tema; el tema Claro/Oscuro se conmuta sin recargar. La página
> de inicio es una **mesa de trabajo** con los mundos recientes y la actividad, o
> su estado vacío. También existe una **base de datos local** que se crea y se
> comprueba al arrancar, con **copias automáticas** y **restauración desde modo
> seguro**. Ya se pueden crear, editar, duplicar, archivar y eliminar mundos con
> su actividad; crear **fichas** de cualquier tipo con campos personalizados,
> descripción enriquecida, imágenes, etiquetas y favoritos; **recuperarlas desde
> la Papelera** y eliminar de verdad lo que ya no quieras; consultar y
> restaurar el **historial de versiones** de la descripción de una ficha; y
> **exportar e importar un mundo completo** en un archivo abierto que incluye
> sus imágenes. También existe una pantalla de **Ajustes** para cambiar la
> apariencia, consultar el idioma y los atajos, ver el estado de las
> actualizaciones y **gestionar tus datos**: abrir las carpetas, ver el uso de
> disco, exportar todo, limpiar imágenes huérfanas y eliminar todos los datos
> con una copia recuperable. Todavía no hay mapas, manuscritos ni juego. La
> aplicación **recuerda entre sesiones** el tema, la densidad, el tamaño del
> texto, la barra lateral plegada, el panel de propiedades con su ancho y las
> secciones de la ficha, y **Continuar** retoma el último mundo o ficha aunque
> cierres y vuelvas a abrir. Las **muestras** de componentes siguen existiendo
> solo como página interna de desarrollo y no aparecen en la navegación ni en la
> búsqueda.

## 1. Qué es World Craft

World Craft es una aplicación de escritorio para Windows que te ayuda a crear y
organizar mundos de ficción: personajes, lugares, objetos, relaciones, mapas,
textos y herramientas de juego. Todo se guarda en tu ordenador. No necesitas
cuenta, conexión a Internet ni suscripción.

La aplicación está pensada para:

- Escritores que necesitan consistencia entre escenas y capítulos.
- Personas que dirigen partidas de rol y quieren un mundo propio a mano.
- Creadores que disfrutan construyendo mundos por el placer de hacerlo.

## 2. Antes de empezar

### 2.1 Requisitos

- Windows 10 u 11 de 64 bits.
- Al menos 4 GB de memoria RAM y 500 MB libres en disco. El instalador ocupa
  unos 133 MB y la aplicación instalada necesita espacio adicional.
- Una ventana de al menos 1024×700 píxeles; se recomienda 1280×800 o más.
- No hace falta conexión a Internet para trabajar. Solo la comprobación de
  actualizaciones consulta GitHub cuando tú lo pides.

### 2.2 Instalación

1. Consigue el instalador de World Craft. Todavía **no se descarga de una
   página pública**: cuando se prepara una versión, el archivo se genera en
   local como `release/world-craft-0.1.0-setup.exe` y se prueba antes de
   publicarlo. La descarga oficial llegará con M5.
2. Ejecuta el instalador. Windows puede mostrar un aviso de SmartScreen porque
   el instalador no está firmado; se explica en la sección 14.
3. El asistente instala **solo para tu usuario**, en
   `%LOCALAPPDATA%\Programs\World Craft`. **No pide permisos de administrador ni
   muestra el control de cuentas de usuario (UAC).** Puedes cambiar la carpeta de
   instalación si lo deseas.
4. Elige si quieres abrir World Craft al terminar. El acceso directo se crea en
   el menú Inicio, no en el escritorio.
5. Abre World Craft desde el menú Inicio.

La instalación es por usuario y no requiere permisos de administrador. No crea
ni modifica tu carpeta de datos `%APPDATA%\World Craft`: si ya tenías datos de
una versión anterior, se conservan y se usan al abrir la aplicación.

### 2.3 Primer arranque

La primera vez, la aplicación crea su carpeta de datos y una base de datos nueva
con la estructura inicial en tu equipo. Antes de abrir la ventana comprueba que
la base está en buen estado y, si hay que actualizar su estructura, guarda antes
una copia de seguridad.

Más adelante, el primer arranque mostrará además una pantalla de bienvenida con
la opción de crear tu primer mundo o importar uno existente. Esa pantalla es
**prevista**: todavía no existe. Mientras tanto, puedes importar un mundo desde
**Inicio** o **Mundos** con **Importar mundo…** (sección 4.6).

### 2.4 Estado actual del desarrollo

El proyecto ya genera un **instalador local** y permite abrir la ventana de la
aplicación instalada. Esa ventana tiene el aspecto definitivo en lo básico: una
barra lateral con la navegación **Inicio**, **Mundos** y **Papelera**, una barra
superior con el título contextual, el buscador de la paleta `Ctrl+K`, una sola
acción principal, un menú `⋯` para las secundarias y los iconos de
actualizaciones y tema; dos modos de color y componentes de interfaz ya creados
(botones, campos, insignias, tarjetas, diálogos, pestañas, avisos y ayudas
emergentes).

La aplicación crea y comprueba su base de datos local, guarda copias automáticas,
sabe arrancar en **modo seguro** si algo va mal y permite restaurar una copia.
La comprobación de actualizaciones es **manual y cancelable**; no se ejecuta sola.
Los datos se quedan en este equipo, en una carpeta propia que sobrevive a las
actualizaciones de la aplicación.
Ya se pueden **crear, editar, duplicar, archivar y eliminar mundos**, e **Inicio**
reúne los mundos recientes y la actividad en una mesa de trabajo. Dentro de
cada mundo puedes **crear y editar fichas** con sus tipos, campos, descripción
con formato y menciones, imágenes, etiquetas, favoritos y **relaciones tipadas con
backlinks**. La página de un mundo ya es un **marco modular**: su cabecera reúne
la identidad del mundo y una navegación de módulos donde **Resumen** y **Fichas**
funcionan, con el recuento de fichas, mientras que **Mapas**, **Manuscrito** y
**Grafo** aparecen como **Previsto** sin pantalla todavía. También existe la
**búsqueda global** con
filtros, recientes y favoritos, y una **paleta de comandos** que se abre con
`Ctrl+K`. La **Papelera** muestra los mundos, las fichas y los tipos
personalizados que has borrado, permite **restaurarlos** a su sitio y
**eliminarlos definitivamente** con una copia previa de la base. La descripción
de una ficha guarda un **historial de versiones** que puedes consultar y
restaurar. También puedes **exportar un mundo completo** a un archivo y
**volver a importarlo** en esta u otra instalación: el archivo incluye las
fichas, los tipos personalizados, las etiquetas, las relaciones, las versiones y
las imágenes (sección 4.6). Todavía no hay ventanas de mapas, manuscritos ni
grafo, y la portada del mundo y la descripción enriquecida del mundo llegarán en
actualizaciones posteriores. **No hay una release pública**: el instalador se
genera y se prueba en local, y la publicación oficial llegará con M5.

El **rediseño visual** está terminado: todas las pantallas que ya existen se han
revisado en los modos **Claro** y **Oscuro** y con ventanas de 1024, 1280 y
1600 px de ancho, con contenido largo, sin que nada quede ilegible ni se salga de
la ventana. Esa revisión cierra la etapa de diseño (M1.5) y no añade funciones
nuevas: corrige detalles de aspecto y la forma de mostrar algunos avisos.

## 3. La ventana

### 3.1 Partes de la pantalla

Estas partes ya existen en la versión instalada y en el entorno de desarrollo:

- **Barra lateral:** contiene el logotipo y el nombre de la aplicación, la
  navegación entre **Inicio**, **Mundos** y **Papelera**, y un botón para
  plegarla. En el pie, encima del botón de plegar, está **Ajustes**. Expandida
  ocupa 240 px y plegada 64 px; al plegarla quedan el logotipo, los iconos y el
  de Ajustes, con su nombre accesible y una ayuda emergente. La aplicación
  recuerda si la dejaste plegada o expandida. No muestra lema permanente ni
  versión.
- **Barra superior:** ocupa 56 px y muestra un único **título contextual**: el
  nombre del mundo cuando estás en un mundo, en sus fichas o en una ficha, y el
  nombre de la vista en el resto. A su lado están el disparador de la **paleta
  de comandos** con su atajo `Ctrl+K`, **una sola acción principal** de la
  pantalla —cuando la hay; en Fichas y Ficha vive en la propia página—, el menú
  `⋯` con las acciones secundarias, el icono de **actualizaciones** —con un
  punto cuando hay una versión disponible— y el icono de **tema**. La versión
  instalada se consulta dentro del diálogo de actualizaciones (sección 3.6).
- **Área central:** el contenido de la pantalla. Es el destino del enlace
  «Saltar al contenido principal» que aparece al empezar a usar el teclado; al
  usarlo, el foco pasa al contenido sin cambiar de vista.

La acción principal cambia con la pantalla: **Crear mundo** en Inicio y Mundos
cuando ya hay al menos un mundo, **Nueva ficha** en la vista de un mundo y
**Nueva ficha** en la página de fichas. Con cero mundos, el botón **Crear mundo**
vive en el estado vacío y no se repite en la barra. La creación rápida de una
ficha —con su mundo, su tipo y su nombre— está en el menú `⋯` de Inicio y Mundos
y en la paleta de comandos.

En la **ficha**, las acciones del documento —favorita, editar, guardar y el menú
`⋯`— y el panel de propiedades viven en la propia página. La ficha se lee como un
documento y solo muestra campos cuando entras en edición (sección 5.2); no es un
formulario permanente.

Siguen **previstas**, para cuando existan mapas y escritura:

- **Mapas, escritura y juego** en la barra lateral.
- **Paneles** de filtros o de detalles en otras pantallas.
- **Barra de estado** con el guardado y los avisos.

La **Papelera** no depende de un mundo: reúne todo lo borrado en la aplicación y
se explica en la sección 6.

La **búsqueda** ya no tiene entrada propia en la navegación: se llega por el
buscador de la barra superior y por la paleta (sección 11).

La página de **muestras** solo sirve para revisar el aspecto de los componentes
en los dos temas y con textos largos. Es una página interna de desarrollo: no
aparece en la navegación, ni en la paleta, ni forma parte de lo que verá quien
use la aplicación; solo se abre por su dirección interna.

### 3.2 Navegación por teclado

- Pulsa `Tab` para avanzar por los controles. El primer `Tab` muestra el enlace
  «Saltar al contenido principal», que lleva directamente al contenido y evita
  recorrer toda la barra lateral. Usarlo no cambia la pantalla ni la dirección
  interna.
- El botón **Plegar menú lateral** o **Expandir menú lateral** anuncia su estado
  con `aria-expanded`. Con la barra plegada, cada icono de navegación conserva su
  nombre accesible y muestra una ayuda emergente al recibir el foco.
- El menú `⋯` de la barra superior se abre con `Enter` o espacio. Dentro, las
  flechas recorren las acciones, `Inicio` y `Fin` van a la primera y a la última,
  `Enter` ejecuta la acción y `Escape` cierra. Al cerrarse, el foco vuelve al
  botón que lo abrió.
- Las tarjetas de mundo tienen su propio menú `⋯`, con el mismo comportamiento:
  `Tab` llega al botón **Abrir** y al de **Más acciones**, el menú se abre con
  `Enter` o espacio, se recorre con las flechas y se cierra con `Escape`
  devolviendo el foco al botón que lo abrió.
- En las pestañas, usa las flechas izquierda y derecha para cambiar de pestaña;
  `Inicio` y `Fin` van a la primera y a la última.
- Pulsa `Ctrl+K` para abrir la paleta de comandos. Dentro de la paleta, las
  flechas mueven la selección, `Inicio` y `Fin` van al primer y último resultado,
  `Enter` abre el elemento seleccionado y `Escape` cierra. El atajo no se activa
  mientras escribes en un campo ni con un diálogo abierto.
- **Ajustes** se recorre como el resto de la navegación: `Tab` llega a su botón,
  `Enter` lo abre y `Escape` cierra los diálogos que abras dentro. En Apariencia,
  las flechas cambian de opción dentro de cada grupo; en la tabla de carpetas,
  `Tab` recorre los botones de abrir.
- En los resultados de la búsqueda, `Tab` recorre los resultados y las flechas
  arriba y abajo mueven el foco entre ellos.
- En un diálogo, el foco se queda dentro mientras está abierto y `Escape` lo
  cierra. Al cerrarlo, el foco vuelve al control que lo abrió o, si ya no existe,
  al contenido principal.
- Las ayudas emergentes (tooltip) aparecen al pasar el ratón o al llegar con el
  teclado, y se ocultan con `Escape`.
- En la ficha, los títulos de las secciones —Descripción, Campos del tipo,
  Relaciones y Recursos— son botones: `Enter` o espacio las pliegan y
  despliegan, y el estado se anuncia con `aria-expanded`. El cuerpo cerrado no
  se recorre con `Tab`.
- En la ficha, **Historial** es otra sección plegable bajo Descripción. Cerrada
  por defecto, no se recorre hasta abrirla; dentro, `Tab` llega a **Guardar
  versión** y a **Restaurar** de cada versión. Los diálogos de guardar y de
  restaurar atrapan el foco, se cierran con `Escape` y devuelven el foco al
  botón que los abrió.
- En la **Papelera**, cada grupo es una sección con su encabezado. `Tab` recorre
  **Restaurar** y **Eliminar definitivamente** de cada fila. Al confirmar una
  restauración o una purga, el foco pasa al siguiente elemento del grupo o a su
  mensaje de grupo vacío, y el resultado se anuncia sin robar el foco. **Cargar
  más** conserva el foco y anuncia cuántos elementos se han añadido.
- El separador del panel de propiedades, cuando el panel está abierto y la
  ventana es ancha, se enfoca con `Tab`. Con las flechas izquierda y derecha
  cambia el ancho en pasos de 16 px; `Inicio` lo lleva a 280 px y `Fin` a 360 px.
  Mientras arrastras con el ratón, `Escape` cancela el cambio.
- En edición, `Ctrl+S` guarda como **Guardar ahora**. No actúa en lectura ni con
  un diálogo abierto.
- Al entrar en edición con **Editar** o al hacer clic en el título, el foco va al
  campo **Nombre**. **Editar descripción** y **Editar campos** abren su sección y
  enfocan el editor o el primer campo. Al pulsar **Listo** y guardarse, el foco
  vuelve a **Editar**.
- Si un dato obligatorio falla, la ficha abre la sección afectada y lleva el foco
  al primer campo con error cuando el guardado fue explícito. El autoguardado
  abre la sección y anuncia el error, pero no mueve el foco.
- El foco siempre se ve, en los dos temas.

### 3.3 Tema Claro y Oscuro

El icono de tema de la barra superior muestra un sol o una luna, incluye en su
nombre la etiqueta del tema actual («Claro» u «Oscuro») y una ayuda emergente
con esa misma información. Al pulsarlo, el cambio es inmediato y afecta a toda
la ventana: los mismos contenidos, la misma jerarquía y el mismo contraste en
ambos temas.

El tema elegido **se recuerda**: al cerrar y volver a abrir la aplicación se
aplica el mismo tema desde el primer momento, sin un destello del otro modo. Si
la preferencia guardada no se puede leer, la aplicación abre en Claro. El tema
también se puede cambiar desde la paleta `Ctrl+K` y desde **Ajustes →
Apariencia**, donde están el tema, la densidad y el tamaño del texto (sección
12.1).

### 3.4 Tamaño de ventana

La ventana se puede redimensionar y el tamaño mínimo es 1024×700. El diseño está
preparado para que a 1024, 1280 y 1600 píxeles de ancho el contenido se adapte
sin desplazamiento horizontal de página; el inicio, los mundos, las fichas,
la búsqueda y el editor se comprueban en esos anchos. Solo las tablas y el lienzo
del mapa
podrán desplazarse dentro de su propio espacio. **Hoy la ventana aún no recuerda
su tamaño ni su posición**: se abre con un tamaño inicial de 1280×800 y esa
memoria llegará en una actualización posterior.

### 3.5 Qué se ve al abrir

La aplicación abre en **Inicio**. Mientras no exista ningún mundo, la pantalla
explica que todavía no hay ninguno, ofrece el botón **Crear mundo** y resume lo
que se podrá hacer con el primer mundo: fichas, relaciones, mapas y manuscrito.
Un aviso recuerda que los datos se quedan en tu equipo. Al pulsar **Crear mundo**
se abre un formulario para ponerle nombre, resumen, descripción, géneros e
idioma (sección 4).

Cuando ya hay mundos, **Inicio** es una mesa de trabajo en una sola columna. De
arriba abajo muestra:

- **Continuar**, solo si has abierto un mundo o una ficha, también en sesiones
  anteriores. Indica el destino y ofrece **Abrir el mundo** o **Abrir la ficha**.
  Si el mundo o la ficha ya no existen —por ejemplo, porque los borraste—, el
  bloque se limpia. Si al pulsarlo la ficha ya no está, se abre el mundo al que
  pertenecía y se avisa de que la ficha ya no existe.
- **Mundos recientes**, con un máximo de cinco filas. El botón **Ver todos los
  mundos** solo aparece cuando hay más de cinco. Cada fila muestra la portada o
  una marca gráfica, el nombre, el estado, el resumen, los géneros, la última
  actualización y las acciones de la tarjeta (sección 4.2).
- **Actividad reciente**, con un máximo de cinco entradas y en un segundo plano,
  separada del resto por una línea.

No hay contadores ni una rejilla de accesos rápidos. La acción principal **Crear
mundo** vive en la barra superior y no se duplica en el cuerpo; con cero mundos,
el botón vive en el estado vacío y la barra no lo repite. Mientras se carga la
lista se muestra un esqueleto con un aviso para lectores de pantalla; si la
carga falla, la pantalla explica el problema y ofrece **Volver a intentar**.

La base de datos local se crea y se comprueba sola al arrancar; si hubiera un
problema, la aplicación avisa antes de abrir la ventana (sección 16).

### 3.6 Actualizaciones

La comprobación de actualizaciones es **siempre manual**: la aplicación no
consulta Internet al arrancar ni en segundo plano. Solo lo hace cuando pulsas el
icono de **actualizaciones** en la barra superior y después **Buscar
actualizaciones**.

1. Pulsa el icono de **Actualizaciones**. Cuando hay una versión disponible, el
   icono muestra un punto y su nombre accesible lo anuncia. El diálogo muestra la
   **versión instalada** y la **última comprobación**, o «Todavía no se ha
   comprobado ninguna actualización».
2. Pulsa **Buscar actualizaciones**. El estado pasa a «Buscando una versión
   nueva…». Puedes pulsar **Cancelar** para detener la comprobación.
3. Si ya tienes la última versión, el diálogo lo indica. Si hay una nueva,
   muestra su número y el botón **Descargar actualización**.
4. Pulsa **Descargar actualización**. La descarga solo empieza con tu
   consentimiento y muestra el progreso. Puedes pulsar **Cancelar** durante la
   descarga; si lo haces, no se instala nada.
5. Cuando la descarga termina, el botón cambia a **Reiniciar e instalar**. Al
   pulsarlo, la aplicación se cierra, instala la versión nueva y vuelve a
   abrirse. **Nunca se instala ni se reinicia sin que lo pidas.**
6. Cerrar el diálogo no cancela una descarga en curso: puedes volver a abrirlo
   para ver el progreso o cancelarla.

La comprobación solo consulta GitHub Releases. **No envía el contenido de tus
mundos, tus fichas ni datos personales.** En el entorno de desarrollo, en modo
seguro o si la instalación no incluye la configuración de actualizaciones, el
diálogo explica que están desactivadas. **No hay comprobación automática ni un
interruptor para desactivarla**; Ajustes muestra la versión, la última
comprobación y un botón que abre este mismo diálogo (sección 12.4).

Si la comprobación o la descarga fallan, el diálogo muestra un aviso y puedes
volver a intentarlo. Un fallo de actualización no toca tus datos: la base, los
assets y las copias siguen en `%APPDATA%\World Craft` (sección 13).

## 4. Mundos

Un mundo reúne todo lo que pertenece a una misma historia: sus fichas, mapas,
manuscritos y partidas. Todo lo que crees dentro de un mundo queda aislado de
los demás; la actividad y las listas nunca mezclan datos de otro mundo.

### 4.1 Crear un mundo

1. Pulsa **Crear mundo**: en la barra superior cuando ya tienes algún mundo o,
   si es el primero, en el estado vacío de **Inicio**. La misma acción principal
   aparece en **Mundos** cuando hay mundos.
2. Rellena el **nombre** (obligatorio), el **resumen** y la **descripción**. El
   resumen es una o dos frases para reconocer el mundo en la lista; la
   descripción admite varias líneas.
3. Añade **géneros** separados por comas (por ejemplo, `Fantasía, Aventura`;
   máximo 8).
4. Elige el **idioma del contenido** del mundo: español, inglés o italiano.
5. El **identificador** es opcional. Si lo dejas vacío se genera a partir del
   nombre; si ya existe, la aplicación añade un número para no repetirlo.
6. Pulsa **Crear mundo**. El mundo se abre en su propia página y aparece un aviso
   de confirmación.

La **portada** todavía no se puede elegir: su selector llegará con la galería de
imágenes del mundo. El formulario lo indica para no prometer una función que aún
no existe.

### 4.2 Inicio como mesa de trabajo

Cuando ya hay mundos, **Inicio** reúne lo que necesitas para retomar el trabajo
sin pasar por un panel de cifras:

- **Continuar:** retoma el último mundo o la última ficha que abriste, aunque
  hayas cerrado y vuelto a abrir la aplicación. El botón se llama **Abrir el
  mundo** o **Abrir la ficha**. Se omite si no hay destino o si el mundo
  recordado ya no existe; al eliminarlo, el bloque se limpia. Si la ficha
  desapareció, se abre su mundo y se avisa de que la ficha ya no existe.
- **Mundos recientes:** hasta cinco filas con la portada o la marca gráfica del
  mundo, su nombre y estado, el resumen, los géneros y la fecha de la última
  actualización. **Ver todos los mundos** aparece solo cuando hay más de cinco.
- **Actividad reciente:** hasta cinco entradas de todos tus mundos. Cada línea
  indica qué ocurrió, en qué mundo y cuándo, de modo que no se atribuye una
  acción al mundo equivocado. Es información secundaria y va separada del resto.

Cada tarjeta de mundo tiene una sola acción visible, **Abrir**, y un menú `⋯`
con **Editar**, **Duplicar**, **Archivar** o **Restaurar** y **Eliminar**. La
misma tarjeta se usa en **Mundos**; en ambos sitios el resumen se limita a dos
líneas sin perder el texto completo, y en Mundos las acciones pasan a un pie de
tarjeta.

La **fecha** se muestra en relativo («Actualizado ahora», «hace 5 minutos»,
«ayer»…) y la fecha completa aparece en la ayuda emergente nativa y en el propio
elemento de fecha. Si el mundo tiene una portada, la
tarjeta la muestra; si no, pinta una **marca gráfica** basada en su
identificador: el mismo mundo conserva siempre la misma marca, también en los dos
temas. No hay iniciales gigantes.

### 4.3 La lista de Mundos

**Mundos** muestra todas las tarjetas, con el mismo diseño que en Inicio. Puedes:

- **Buscar** por nombre, identificador o resumen.
- **Filtrar** por estado: todos, activos o archivados.
- Ver cuántos mundos coinciden con el filtro.
- Quitar los filtros con un botón cuando no haya resultados.

### 4.4 La página de un mundo

Al abrir un mundo entras en su **marco modular**. La barra superior ya muestra
el nombre del mundo como título y reúne la acción principal **Nueva ficha** y el
menú `⋯` con las acciones del mundo (sección 4.5): la página no repite ni el
nombre ni esos botones. Lo primero es **Volver a Inicio** y, después, la
identidad del mundo y sus módulos.

- **Cabecera de identidad:** la portada o la marca gráfica del mundo, su estado
  (activo o archivado), el resumen y los géneros. Si todavía no hay resumen, la
  cabecera lo dice en su lugar.
- **Módulos del mundo:** una navegación con cinco módulos.
  - **Resumen** es el módulo en el que estás.
  - **Fichas** abre la lista de fichas del mundo. A su lado aparece cuántas hay:
    «1 ficha», «N fichas» o «200 o más fichas» cuando el mundo es muy grande.
    Ese recuento es solo informativo: si tarda o no se puede leer, simplemente
    no se muestra y la página sigue funcionando.
  - **Mapas**, **Manuscrito** y **Grafo** llevan la insignia **Previsto** y no
    se pueden pulsar, porque sus pantallas todavía no existen. Una nota recuerda
    que llegarán en próximas versiones.
- **Resumen:** la descripción del mundo, que indica cómo añadirla si aún no la
  tiene, y sus datos: identificador, idioma del contenido y fechas de creación y
  de actualización.
- **Preparación del mundo:** una barra de progreso indica si faltan el resumen,
  la descripción o los géneros. Los campos que ya están completos se marcan como
  **Completado** y los que faltan, como **Pendiente**.
- **Actividad de este mundo:** al final y como información secundaria, solo las
  acciones de ese mundo con su fecha.

Mientras el mundo se está leyendo se muestra un aviso de carga. Si la lectura
falla, la página lo explica y ofrece **Volver a intentar** y **Volver a Inicio**;
tus datos siguen guardados.

### 4.5 Editar, duplicar, exportar, archivar y eliminar

Dentro de un mundo, las cinco acciones están en el menú `⋯` de la barra
superior, junto a la acción principal **Nueva ficha**. La página del mundo no
repite esos botones: solo muestra la identidad, los módulos y el contenido. Las
tarjetas de Inicio y de Mundos muestran **Abrir** y su propio menú `⋯` con
**Editar**, **Duplicar**, **Archivar** o **Restaurar** y **Eliminar**.

- **Editar:** cambia el nombre, el identificador, el resumen, la descripción, los
  géneros o el idioma. El mundo se actualiza al guardar y queda registrado en la
  actividad.
- **Duplicar:** crea un mundo nuevo con el contenido editable del original y un
  nombre propuesto. La portada no se copia porque pertenece al mundo original.
- **Exportar mundo…:** guarda el mundo completo en un archivo ZIP que incluye sus
  imágenes. Se explica en la sección 4.6.
- **Archivar:** oculta el mundo de la lista de activos sin borrar nada. Puedes
  verlo con el filtro **Archivados** y restaurarlo cuando quieras.
- **Eliminar:** pide confirmación y mueve el mundo a la papelera. Deja de
  aparecer en Inicio y Mundos, pero **puedes recuperarlo** desde la **Papelera**
  (sección 6). Si eliges eliminarlo definitivamente allí, la aplicación crea antes
  una copia de seguridad de la base. Archivar no es lo mismo: archivar lo oculta
  de los activos sin pasar por la papelera.

Todas las acciones destructivas piden confirmación y ninguna borra archivos del
disco sin avisar. Al cerrar el diálogo, el foco vuelve al control que lo abrió
o, si ese control ya no existe, al contenido principal.

### 4.6 Exportar e importar un mundo

Puedes llevarte un mundo completo a un archivo y volver a abrirlo en esta u otra
instalación de World Craft. El archivo es un **ZIP abierto** que se puede
inspeccionar con herramientas normales; no hace falta la aplicación para leer su
contenido. El formato completo está en
[`docs/formato-de-exportacion.md`](formato-de-exportacion.md) y la decisión en
el [ADR 0029](adr/0029-world-export-import.md).

#### Exportar un mundo

1. Abre el mundo que quieras guardar.
2. En el menú `⋯` de la barra superior, elige **Exportar mundo…**.
3. Elige dónde guardar el archivo. La aplicación propone un nombre terminado en
   `.zip` a partir del nombre del mundo y lo ajusta a las reglas de Windows.
4. Espera a que termine. El diálogo muestra la fase, el progreso y los avisos.
5. Al terminar, verás el nombre del archivo, su tamaño y un resumen del
   contenido exportado.

**Qué incluye:** el nombre, el resumen, la descripción, los géneros y el idioma
del mundo; sus fichas con los campos, la descripción, el estado, el favorito y
las etiquetas; los tipos de ficha y de relación personalizados; las etiquetas;
las relaciones; el historial de versiones de cada ficha exportada; la portada,
las imágenes principales y las galerías; y los archivos de esas imágenes.

**Qué no incluye:** la papelera ni lo eliminado definitivamente, la actividad
del mundo, el índice de búsqueda, las preferencias de la aplicación, las
miniaturas (se regeneran al importar) ni las imágenes que no usa ninguna ficha o
el mundo. Tampoco hay mapas, manuscritos ni escenas: esas funciones todavía no
existen. **La papelera nunca se exporta** y solo viaja contenido vivo de mundos
vivos.

La exportación se hace en segundo plano para que la ventana siga respondiendo.
Puedes cancelarla mientras se prepara, se empaqueta o se comprueba; si cancelas,
**el archivo de destino no se modifica**. En la fase final, **Guardando el
resultado**, ya no se puede cancelar: el archivo se está publicando de forma
atómica.

#### Importar un mundo

1. En **Inicio** o **Mundos**, abre el menú `⋯` de la barra superior y elige
   **Importar mundo…**.
2. Selecciona el archivo `.zip`. También puedes elegir cualquier archivo con
   «Todos los archivos»; la aplicación comprobará si es un mundo válido.
3. Espera a que termine. Verás el progreso, la fase y, al final, el resumen con
   los recuentos y los avisos.
4. Pulsa **Abrir mundo** para ir al mundo importado o **Cerrar** para quedarte
   donde estabas.

**La importación siempre crea un mundo nuevo.** No fusiona, no actualiza y no
sobrescribe ningún mundo existente: tus mundos, fichas, imágenes, relaciones,
copias y preferencias se quedan como estaban. El mundo importado queda
**activo**, con la fecha de importación, y sus fichas conservan sus fechas
originales.

- **Identificador:** si ya existe un mundo con el mismo identificador, la
  aplicación añade un sufijo: `-2`, `-3` y así sucesivamente. El resumen te dice
  el identificador final y avisa de que se ha ajustado.
- **Avisos:** si el archivo trae un enlace a una ficha que no existe, una
  referencia rota, una imagen que falta, una etiqueta o un tipo ausente, una
  relación duplicada o un valor de campo que ya no encaja, la aplicación lo
  quita o lo normaliza y te lo cuenta en el resumen. **No se inventa contenido**
  ni se completan campos obligatorios vacíos.
- **Cancelación:** puedes cancelar mientras se lee, se comprueba, se extrae o se
  prepara el contenido. Si cancelas, **no se añade ningún mundo** y no se toca
  nada de lo existente. En **Guardando el resultado** ya no se puede cancelar.
- **Sin copia previa:** la importación solo añade y se hace de una vez; si algo
  falla, se deshace por completo y no queda un mundo a medias. Por eso no se crea
  una copia de seguridad antes de importar, a diferencia de una migración o de
  una eliminación definitiva.
- **Sin conexión:** exportar e importar funcionan sin Internet. No se sube nada
  a ningún servicio.

#### Si algo falla

| Mensaje o situación | Qué hacer |
|---|---|
| «El archivo no es compatible con esta versión de World Craft» | Se creó con un formato más reciente. Actualiza la aplicación o pide el archivo en un formato compatible. |
| «El archivo no tiene la estructura de un mundo de World Craft o está dañado» | Comprueba que elegiste el `.zip` correcto y que no se ha truncado al copiarlo. Vuelve a exportarlo desde el origen. |
| «El archivo está dañado o se modificó después de crearse» | El checksum no coincide. No fuerces la importación: vuelve a copiar el archivo desde el origen. |
| «El mundo o el archivo supera los límites de tamaño o de contenido» | El ZIP supera 8 GiB, el contenido descomprimido 16 GiB o alguno de los límites por número de fichas, versiones, relaciones, etiquetas, tipos o imágenes. Divide el mundo o revisa el archivo. |
| «El archivo contiene una parte que no está permitida y se ha rechazado» | Trae una ruta peligrosa, un enlace, un nombre reservado o una entrada que no es un mundo. No lo abras a mano ni lo importes en otra herramienta. |
| «No hay espacio suficiente en el equipo» | Libera espacio en la unidad de datos y vuelve a intentarlo. La importación no deja un mundo parcial. |
| «No se pudo preparar el destino de la operación» | Comprueba permisos y espacio en la carpeta de datos. Cierra otras instancias y vuelve a intentarlo. |
| «Ya hay otra exportación o importación en curso» | Espera a que termine la operación anterior. |
| «Esta función no está disponible en este momento» | La aplicación está en modo seguro, sin base de datos. Restaura una copia (sección 13.3) y vuelve a abrirla. |
| «No se pudo leer el mundo o el archivo» | El archivo o el mundo de origen ya no existe o no es accesible. Comprueba la ruta y los permisos. |

Si el fallo ocurre al exportar, **el archivo de destino anterior queda
intacto**. Si ocurre al importar, **no se añade ningún mundo** y los existentes
no cambian.

### 4.7 Lo que llegará después

- **Portada del mundo:** elegir una imagen local y verla en la cabecera del mundo.
- **Descripción enriquecida del mundo:** formato básico, enlaces internos y texto
  listo para buscar.

## 5. Fichas y entidades

Las fichas son la base del mundo: personajes, lugares, organizaciones, objetos,
criaturas, eventos y cualquier tipo que crees. Se abren desde el módulo
**Fichas** de la página de un mundo, que también indica cuántas tienes; dentro,
la lista se titula **Fichas del mundo**.

### 5.1 Crear una ficha

1. Abre un mundo: la acción principal de la barra superior es **Nueva ficha**.
   También puedes entrar en el módulo **Fichas** y pulsar **Nueva ficha** en la
   cabecera de la lista.
2. Elige el mundo, el tipo y el nombre. Desde Inicio y Mundos, el menú `⋯`
   ofrece **Crear una ficha** y la paleta `Ctrl+K` incluye el mismo comando; los
   dos abren la creación rápida con el mundo preseleccionado cuando ya estás
   dentro de uno.
3. Al crearla se abre como documento, en lectura. Pulsa **Editar** para completar
   el alias, el resumen, la descripción y los campos del tipo; la portada, el
   estado y las etiquetas se ajustan en el panel de propiedades sin entrar en
   edición.

### 5.2 Guardado y edición

- La ficha se abre en **lectura**: nombre, alias y resumen se leen como texto y
  no hay campos permanentes. Si falta el nombre se muestra «Ficha sin nombre».
- Pulsa **Editar** para entrar en edición; también puedes hacer clic en el título
  con el ratón. Aparecen los campos de nombre, alias y resumen y las acciones de
  edición, incluido **Guardar ahora**. **Listo** guarda y vuelve a la lectura; si
  falla, la ficha permanece en edición.
- No hay **Cancelar**: el autoguardado ya ha persistido lo escrito y cancelar
  sugeriría descartar cambios que no se pierden.
- El contenido se **autoguarda** poco después de dejar de escribir. La cabecera
  muestra **Guardando…**, **Guardado**, **Cambios sin guardar** o **No se pudo
  guardar**.
- **Guardar ahora** fuerza el guardado en ese momento y `Ctrl+S` hace lo mismo en
  edición.
- Si el guardado falla, la cabecera lo indica y aparece un aviso con **Volver a
  intentar**; tus cambios siguen en pantalla. Si falta un dato obligatorio, la
  ficha entra en edición y abre la sección afectada —la cabecera, **Campos del
  tipo** o **Descripción**— con el error señalado.
- Al salir de la ficha se guarda el último cambio pendiente, aunque el
  autoguardado aún no hubiera llegado; al volver, el contenido sigue ahí. El
  nombre es obligatorio y los campos marcados con `*` también.
- El panel de propiedades, su ancho y las secciones plegables **se recuerdan**
  aunque cierres y vuelvas a abrir la aplicación. Son preferencias de la
  aplicación, no de cada ficha: el mismo estado se aplica a todas las fichas y
  tipos. En ventanas estrechas el panel se coloca debajo del documento y, al
  volver a ensanchar, recupera el ancho guardado.
- El **tipo no cambia** después de crear la ficha. Si necesitas otra plantilla,
  crea una ficha nueva con ese tipo.

### 5.3 Descripción enriquecida

La descripción admite **negrita**, **cursiva**, párrafos, títulos de nivel 1 a 3,
listas con viñetas, listas numeradas, citas y **menciones a otras fichas** del
mismo mundo. No se pega HTML ni se permiten enlaces externos.

- En **lectura**, la descripción se muestra como texto de documento, sin barra de
  herramientas. La sección indica cuántas palabras tiene y ofrece **Añadir
  descripción** si está vacía o **Editar descripción** si ya tiene contenido.
- En **lectura**, un clic normal en una mención o en un enlace interno abre esa
  ficha.
- En **edición**, la barra del editor es una sola fila con cinco acciones:
  **Negrita**, **Cursiva**, **Formato**, **Enlace** y **Mención**. La barra sigue
  a la vista mientras escribes y no hay una segunda fila de botones.
- **Negrita** y **Cursiva** indican si están activas. **Enlace** abre el diálogo
  para enlazar una ficha del mundo.
- El menú **Formato** reúne el resto de acciones: **Párrafo**, **Título 1**,
  **Título 2**, **Título 3**, **Lista con viñetas**, **Lista numerada**, **Cita**,
  **Abrir enlace** y **Quitar enlace**. Se abre con el ratón o con `Enter` o
  espacio; las flechas recorren los elementos, `Inicio` y `Fin` van al primero y
  al último, `Enter` o espacio aplican y `Escape` cierra sin cambiar nada. Al
  elegir un formato, el cursor vuelve al texto para que sigas escribiendo.
- **Abrir enlace** y **Quitar enlace** solo se pueden usar si el cursor está
  dentro de un enlace; si no, aparecen deshabilitados. Para abrir un enlace sin
  salir de la edición también puedes usar `Ctrl` + clic (`Cmd` + clic en macOS).
- Si falta un dato de la descripción, la sección se abre y el error queda
  asociado.

#### Mencionar una ficha en la descripción

Escribe `@` o dos corchetes `[[` en el texto y aparecerá una lista con las fichas
del mundo para elegirlas sin soltar el teclado.

1. Escribe `@` (por ejemplo, después de un espacio) o abre dos corchetes `[[`.
2. Sigue escribiendo parte del nombre: la lista se filtra al momento. Cada
   opción muestra el nombre de la ficha y su tipo, e incluye las fichas
   archivadas y las que están en borrador.
3. Usa las flechas `↑` y `↓` para recorrer la lista; `Inicio` y `Fin` van a la
   primera y a la última opción.
4. Pulsa `Enter` o `Tab` para insertar la ficha como mención con su nombre. Si
   prefieres el ratón, haz clic en la opción.
5. Pulsa `Escape` para cerrar la lista sin insertar; el texto que habías escrito
   se conserva para que lo corrijas o lo borres.

- También puedes pulsar **Mención** en la barra: escribe `@` en el texto y abre
  la misma lista, sin un diálogo aparte.
- Si no hay coincidencias, la lista lo dice («No hay fichas que coincidan.»); si
  el mundo todavía no tiene otras fichas, lo explica. En esos casos no se inserta
  nada y `Enter` sigue su comportamiento normal.
- La mención se ve y se comporta como un enlace interno: en edición, `Ctrl` +
  clic (`Cmd` + clic en macOS) o **Abrir enlace** del menú **Formato** la abren;
  en lectura, un clic normal.
- La lista busca entre las fichas que la aplicación ya tiene cargadas para esa
  ficha, hasta 200, igual que el diálogo de enlace. En un mundo con muchas más
  fichas la búsqueda puede ser parcial y faltar alguna; está previsto mejorarlo
  en una etapa posterior.
- No se abre la lista si escribes `@` dentro de un enlace ni si la arroba forma
  parte de una palabra, como en una dirección de correo.

### 5.4 Campos del tipo

Cada tipo puede tener campos de **texto**, **número**, **fecha**, **selección** o
**referencia a otra ficha**. En lectura, los campos se leen como una **ficha
técnica**: cada etiqueta con su valor, los números y las fechas con el formato del
perfil, las referencias como enlaces que abren la ficha enlazada y «Sin valor»
cuando están vacías. Una referencia rota se explica en lugar de quedar como un
identificador sin salida.

- **Editar campos** abre la sección y el primer control; en edición, cada campo
  usa su propio formulario compacto.
- Los campos de referencia solo ofrecen fichas del mismo mundo y, si el tipo lo
  limita, del tipo de destino. Los valores se validan antes de guardar.

### 5.5 Tipos personalizados

El menú `⋯` de la cabecera de **Fichas** ofrece **Gestionar tipos**, que abre la
lista de tipos del sistema y de los personalizados de ese mundo.

- Los 18 tipos del sistema (personaje, lugar, ciudad, nación, cultura, raza,
  organización, religión, deidad, magia, objeto, criatura, idioma, evento,
  conflicto, tecnología, flora y fauna y concepto) no se editan ni se borran.
- **Duplicar** un tipo crea una copia personalizada en el mundo para ajustar su
  nombre, icono, color y campos.
- Los tipos personalizados se pueden **crear**, **editar** y **borrar**. Un tipo
  con fichas no se puede borrar ni puede perder campos o cambiar el tipo de un
  campo existente hasta cambiar o mover esas fichas; se incluyen las fichas en
  papelera para que, al restaurarlas, encuentren su plantilla. Sí puedes
  ajustar etiquetas, opciones, icono, color y añadir campos. Si intentas borrar
  un tipo que está en uso, la explicación aparece **dentro de la propia
  confirmación** y el botón **Cancelar** sigue disponible: no se pierde nada y
  puedes cerrar el aviso sin salir de la ventana. Un tipo borrado se recupera
  desde la **Papelera** (sección 6).
- Los iconos y colores usan la paleta de la aplicación; el color nunca es el
  único indicador: siempre acompaña al icono y al nombre.

### 5.6 Imágenes, portada y galería

- **Portada:** vive en el panel de propiedades. Muestra la imagen elegida o «Sin
  portada todavía.» y ofrece **Elegir portada** o **Cambiar portada**. El diálogo
  lista las imágenes del mundo y marca la actual.
- **Sin imágenes en el mundo:** el panel explica que añadas imágenes en
  **Recursos** y ofrece **Ir a Recursos**, que abre la sección y enfoca **Añadir
  imágenes**.
- **Galería:** vive en la sección **Recursos**. **Añadir imágenes** abre el
  diálogo del sistema; cada miniatura tiene **Quitar** y la que es portada muestra
  la insignia **Portada**.
- La portada solo se elige o cambia desde el panel; la galería solo importa y
  quita. Al quitar de la galería la imagen que es portada, la portada también se
  borra y el nombre accesible del botón lo advierte. Quitar una imagen de la
  galería no borra el archivo del equipo.
- Las imágenes se guardan en la carpeta de datos de la aplicación. Al actualizar
  o reinstalar no se borran.

### 5.7 Etiquetas y favoritos

- **Etiquetas:** crea etiquetas de color por mundo y asígnalas a las fichas desde
  el panel de propiedades. La lista muestra las asignadas como chips con su botón
  de quitar; **Añadir etiqueta** ofrece las que faltan y **Nueva etiqueta** crea
  una. Se pueden quitar de una ficha sin borrar la etiqueta, y cada ficha admite
  hasta 12.
- **Favoritos:** el botón **Favorita** de la cabecera marca las fichas que más
  usas. Conserva siempre el mismo nombre, «Favorita», y usa `aria-pressed` para
  anunciar si la ficha es favorita o no.
- En la lista puedes **buscar** por nombre, alias, resumen o descripción y
  **filtrar** por tipo, etiqueta, favorito y estado.
- Los filtros y las etiquetas nunca mezclan datos de otros mundos.

### 5.8 Estado y borrado

- Cada ficha puede estar **Activa**, en **Borrador** o **Archivada**. El estado se
  cambia en el panel de propiedades y la insignia de la cabecera se actualiza al
  momento; funciona también en lectura.
- **Mover a la papelera** está en el menú `⋯` de la ficha y pide confirmación. La
  ficha deja de aparecer en la lista y en la búsqueda, pero **puedes recuperarla**
  desde la **Papelera** (sección 6). Sus etiquetas, imágenes, relaciones e
  historial de versiones se conservan.
- Una ficha en la papelera no muestra ni genera versiones; mientras esté allí, no
  se puede consultar su historial. Al restaurarla vuelve con el historial que
  tenía.
- Si eliminas la ficha definitivamente desde la Papelera, se borran también sus
  relaciones, etiquetas, galería e historial, y queda una copia recuperable de la
  base. Las imágenes y los archivos del equipo **no se borran**.

### 5.9 Historial de versiones de la descripción

La descripción de una ficha guarda un historial para que puedas volver atrás sin
perder lo escrito. Está en la sección **Historial**, dentro de la ficha y debajo
de la descripción. Empieza cerrada y se abre al pulsarla; no es una preferencia
que se recuerde entre sesiones.

- **Automática:** cuando cambias la descripción, la aplicación guarda el estado
  **anterior** como una versión automática. Los cambios seguidos se agrupan
  durante **5 minutos**, de modo que el autoguardado no crea decenas de versiones.
  Se conservan **20 automáticas por ficha** durante **90 días**; las más antiguas
  se van retirando y la más reciente nunca se borra.
- **Manual:** pulsa **Guardar versión** y escribe una **etiqueta** de 1 a 120
  caracteres. Sirve para marcar un punto al que quieras volver; las manuales
  **no caducan** y puedes guardar hasta **50** por ficha. Al llegar al límite, la
  aplicación te pide conservar el historial antes de guardar otra.
- **Restaurar:** elige una versión y pulsa **Restaurar**. Antes de aplicarla, la
  descripción actual se guarda como versión **Antes de restaurar**, que no
  caduca: **restaurar nunca destruye el texto que tenías**. El diálogo muestra
  una vista previa de la versión y, si la descripción ya coincide, avisa de que no
  hay cambios.
- **Qué se ve:** cada versión muestra su origen (**Automática**, **Manual** o
  **Antes de restaurar**), la fecha, la etiqueta si la tiene y un fragmento del
  texto. La lista no carga los documentos completos antiguos, solo la vista
  previa.
- Si una ficha está en la papelera, su historial no se muestra. Si la purgas, sus
  versiones se eliminan con ella y solo quedan en la copia previa a la purga.

### 5.10 Lo que llegará después (fichas)

- **Comparar versiones** lado a lado y restaurar un fragmento concreto.
- **Filtrar y buscar dentro del historial** de una ficha muy longeva.

## 6. Papelera y recuperación

La **Papelera** reúne todo lo que has borrado en la aplicación: **mundos**,
**fichas** y **tipos personalizados**. Está en la barra lateral, no dentro de un
mundo, porque lo borrado puede venir de cualquiera. **Nada se borra del todo al
moverlo a la papelera** y la papelera **no caduca sola**: lo que está dentro sigue
ahí hasta que lo restaures o lo elimines definitivamente.

### 6.1 Qué aparece y cómo se lee

Al abrir **Papelera** ves tres grupos, cada uno con su encabezado:

- **Mundos:** el nombre y la fecha en que lo eliminaste.
- **Fichas:** el nombre, su mundo y su tipo de origen (`Mundo · Tipo`) y la fecha.
- **Tipos personalizados:** el nombre, su mundo (`Mundo: …`) y la fecha.

Los tipos del sistema no aparecen: no se pueden borrar. Cada fila ofrece
**Restaurar** y **Eliminar definitivamente**. Si un grupo está vacío, lo dice con
su propio mensaje; si los tres lo están, la pantalla explica que la papelera está
vacía. Con muchos elementos, **Cargar más** añade la siguiente tanda sin perder
el foco. Mientras se carga se muestra un aviso para lectores de pantalla; si la
lectura falla, la pantalla lo explica y ofrece **Volver a intentar**, sin tocar
tus datos.

Lo que está en la papelera **no aparece** en Inicio, en Mundos, en las listas, en
las relaciones ni en la búsqueda. Al restaurarlo, vuelve a aparecer.

### 6.2 Restaurar

1. Abre **Papelera** y busca el elemento en su grupo.
2. Pulsa **Restaurar**.
3. El elemento vuelve a su sitio: un mundo a **Inicio** y **Mundos**; una ficha a
   su mundo y su tipo originales; un tipo personalizado a su mundo.
4. La lista se actualiza, el resultado se anuncia y el foco pasa al siguiente
   elemento o al mensaje del grupo.

Hay dos casos en los que la restauración no se aplica y la aplicación lo explica
con un mensaje claro:

- **El mundo está en la papelera.** Una ficha o un tipo no pueden volver a un
  mundo que sigue borrado. La fila lo avisa y la solución es **restaurar primero
  el mundo** y después la ficha o el tipo.
- **El tipo ya no está disponible.** Si el tipo personalizado de una ficha se
  borró y purgó, la ficha no puede volver tal cual; restaura antes el tipo o
  cambia la ficha de tipo.

**Restaurar un mundo no restaura en cascada** las fichas o tipos que ya estaban
en la papelera antes. Primero vuelve el mundo y después cada elemento que quieras
recuperar. Nada se pierde por hacerlo en ese orden.

### 6.3 Eliminar definitivamente y vaciar

**Eliminar definitivamente** borra un elemento para siempre. Antes de borrar, la
aplicación:

1. Crea una **copia de seguridad de la base** y la comprueba. Si la copia falla
   —por ejemplo, por falta de espacio—, **no se borra nada**.
2. Borra el elemento y su contenido dependiente: una ficha se lleva sus
   relaciones, etiquetas, galería e historial; un mundo se lleva sus fichas,
   tipos, etiquetas, relaciones, actividad e historial; un tipo solo se elimina
   si ya no le quedan fichas.
3. Actualiza la lista y anuncia el resultado.

El diálogo explica qué se va a borrar, avisa de que **la acción no se puede
deshacer desde la papelera** y deja **Cancelar** como opción inicial. Si el
elemento ya no estaba o el tipo sigue en uso, el diálogo lo dice y la lista se
actualiza. Las **imágenes y los archivos del equipo no se borran**.

**Vaciar la papelera** está en la parte superior de la pantalla y elimina todo de
una vez. Exige marcar una casilla —**Entiendo que se eliminará definitivamente
todo el contenido de la papelera**— antes de habilitar el botón. Crea **una sola
copia previa** y muestra un resumen con cuántos mundos, fichas y tipos se han
eliminado. Los tipos que todavía tengan fichas se conservan y se cuentan en el
resumen.

### 6.4 La copia previa y cómo recuperar una purga

Las copias previas a una eliminación definitiva se guardan en la carpeta de
copias, dentro de `backups/pre-purge`. Se conservan las **10 más recientes** que
sean válidas; las dañadas no se borran solas y no cuentan para ese límite.

- La copia **no** es un botón de «deshacer» dentro de la papelera: la acción
  definitiva sigue siendo definitiva desde la interfaz.
- Es la **red de recuperación**. Si necesitas volver atrás, esa copia se puede
  elegir en el aviso de modo seguro o restaurar a mano con la aplicación cerrada
  (secciones 13.3 y 13.4). Ajustes → Datos permite abrir la carpeta de copias,
  pero **todavía no restaura** desde ahí: la restauración guiada desde Ajustes
  sigue prevista.
- La copia contiene la base de datos, no las imágenes ni los archivos. Como la
  purga tampoco borra assets, los archivos siguen en el equipo; las filas que
  quedan sin mundo se pondrán en cuarentena en una actualización posterior.

### 6.5 Lo que llegará después

- **Restaurar una copia desde Ajustes** sin pasar por el aviso de modo seguro.
  Hoy Ajustes solo abre la carpeta de copias y muestra su uso; crear, verificar
  y restaurar copias manuales desde ahí sigue previsto.
- **Cuarentena de imágenes y archivos huérfanos** tras purgar un mundo, con su
  propia copia recuperable.
- **Papelera de mapas y escenas** cuando existan esos módulos, reutilizando esta
  misma pantalla.

## 7. Relaciones y grafo

### 7.1 Relacionar fichas

Una relación une dos fichas del mismo mundo y se lee desde las dos. Por ejemplo,
«Mara Viento» puede ser **aliada de** «Puerto Sal», y en la ficha de Puerto Sal
la misma relación aparece como **tiene como aliado a** Mara Viento.

1. Abre una ficha y baja hasta la sección **Relaciones**.
2. Pulsa **Añadir relación**.
3. Elige el **tipo de relación** y la **ficha de destino**. Puedes buscar por
   nombre o alias.
4. Ajusta si quieres la **etiqueta directa**, la **etiqueta inversa**, la
   **fuerza** de 1 a 5 y las **notas**. Si dejas las etiquetas vacías se usan las
   del tipo.
5. Pulsa **Crear relación**.

La sección **Relaciones** se lee como una red de lore, agrupada primero por
dirección y después por tipo:

- **Desde esta ficha** reúne las relaciones que salen de la ficha abierta. Cada
  entrada lleva la insignia **Saliente**.
- **Backlinks** reúne las relaciones creadas desde otras fichas que apuntan a
  esta. Un **backlink** es, por tanto, una relación que ves aquí porque la
  creaste en la ficha de origen; cada entrada lleva la insignia **Backlink** y el
  nombre que se abre es el de esa ficha de origen.

Dentro de cada dirección, los grupos se ordenan por el nombre que muestran. El
título del grupo es la **etiqueta que se lee en esta ficha**:

- En **Desde esta ficha** es la etiqueta directa; si la ficha de destino usa otra
  palabra para el mismo vínculo, el grupo añade **Inversa: …**.
- En **Backlinks** es la etiqueta inversa; si la ficha de origen usa otra, el
  grupo añade **Directa: …**.
- Si las dos etiquetas coinciden, como en «Relacionado con», no se repiten.
- Cuando has personalizado la etiqueta de una relación, el grupo añade
  **Tipo: …** con el nombre del tipo, para que la etiqueta libre no pierda su
  identidad.

Cada entrada muestra la insignia de dirección, el nombre de la ficha contraparte
con su tipo de entidad, la fuerza en cinco marcas y las notas. El nombre es la
acción visible: al pulsarlo se abre esa ficha. Los nombres largos y las notas se
muestran completos y envuelven en varias líneas.

### 7.2 Editar y eliminar relaciones

- **Abrir la ficha contraparte** es la acción visible de cada entrada.
- **Editar relación** y **Eliminar relación** están en el menú `⋯` de la
  entrada. El menú se abre con `Enter` o espacio, se recorre con las flechas y se
  cierra con `Escape` devolviendo el foco al botón que lo abrió.
- **Editar relación** permite cambiar el tipo, las etiquetas, las notas y la
  fuerza. El origen y el destino no cambian; para invertirlos, crea la relación
  desde la otra ficha. Al guardar, el foco vuelve al botón `⋯` de la misma
  relación, aunque haya cambiado de grupo.
- **Eliminar relación** abre un diálogo de confirmación que indica qué relación
  se va a borrar. La opción inicial es **Cancelar**; `Escape` también cancela. Al
  confirmar, la relación desaparece de las dos fichas, pero las fichas y sus
  datos no se borran. Mientras se envía la petición, el diálogo no se puede
  cerrar y, al terminar, el foco pasa a la siguiente entrada o a **Añadir
  relación** si no queda ninguna.
- No se permiten relaciones de una ficha consigo misma ni relaciones repetidas.
  En los tipos simétricos, como «Relacionado con», tampoco se permite la misma
  relación en el sentido contrario.
- Solo se pueden relacionar fichas del mismo mundo. Las fichas que están en la
  papelera no se ofrecen como origen ni como destino.

### 7.3 Tipos de relación

El botón **Tipos de relación** abre el gestor:

- Los 18 tipos del sistema (relacionado con, aliado de, enemigo de, progenitor
  de, hermano de, cónyuge de, miembro de, dirige, ubicado en, parte de, posee,
  creó, participó en, adora a, causó, protege a, sirve a y conoce a) no se
  editan ni se borran.
- Puedes **crear tipos propios** con una etiqueta directa, una inversa y un
  color. Por ejemplo, «Mentor de» / «Aprendiz de».
- Un tipo personalizado se puede **editar** y **borrar** mientras no tenga
  relaciones. Si está en uso, elimina antes esas relaciones.
- El color nunca es el único indicador: siempre acompaña a la etiqueta.

### 7.4 Grafo (previsto)

La vista de grafo llegará en una etapa posterior. Mostrará las relaciones como
un mapa de nodos, con zoom, filtros por tipo o etiqueta, encuadre y apertura de
la ficha al seleccionar un nodo. Las relaciones que crees ahora se conservarán y
aparecerán en esa vista.

Mientras el grafo esté previsto, la ficha **no incluye ningún botón, enlace ni
acción** para abrirlo: la sección Relaciones solo ofrece lo descrito en 6.1 y
6.2. Cuando la vista llegue, se añadirá su acceso en la misma tarea.

## 8. Mapas (previsto)

- **Crear un mapa:** elige un nombre y un estilo de fondo.
- **Dibujar:** punto, línea, polígono, rectángulo, círculo y trazo libre.
- **Editar:** mueve, cambia el tamaño y edita vértices.
- **Capas:** organiza el mapa en capas y ocúltalas cuando no las necesites.
- **Marcadores:** enlaza un punto del mapa con una ficha.
- **Imagen de fondo:** usa una imagen propia como referencia.
- **Exportar:** guarda el mapa como SVG o PNG.

## 9. Escritura (previsto)

- **Manuscritos:** agrupa libros, capítulos y escenas.
- **Editor:** escribe con formato, diálogos y separadores de escena.
- **Menciones:** enlaza personajes y lugares desde el texto. Las menciones `@` y
  `[[ ]]` ya funcionan en la descripción de una ficha (sección 5.3); el
  manuscrito todavía no existe.
- **Versiones:** guarda una versión de una escena antes de un cambio grande.
- **Objetivos:** define una meta de palabras.
- **Modo concentración:** oculta paneles para escribir sin distracciones.
- **Exportar:** genera Markdown, HTML, EPUB o PDF.

## 10. Juego de inspiración (previsto)

El juego todavía no tiene un módulo propio en la navegación de un mundo: cuando
exista su pantalla se incorporará a ella junto a **Mapas**, **Manuscrito** y
**Grafo**, que hoy aparecen como **Previsto**. Estas son las funciones
planeadas:

- **Dados:** tira dados y guarda el resultado.
- **Tablas:** consulta tablas de ideas por categoría.
- **Tablas propias:** crea y edita tus tablas.
- **Packs:** importa y exporta contenido de juego.
- **Sesiones:** guarda el resultado de una sesión y añade notas.

## 11. Búsqueda y paleta de comandos

### 11.1 Buscar en toda la biblioteca

La pantalla de **Búsqueda** no tiene entrada en la barra lateral. Se entra por el
buscador de la barra superior o con `Ctrl+K`; en la paleta puedes elegir **Abrir
la página de búsqueda** o abrir directamente un resultado. La pantalla busca a la
vez en mundos, fichas y relaciones. Escribe al menos una letra en **Buscar en tu
biblioteca**: se encuentran coincidencias por el título, el resumen, la
descripción, los alias, las notas de una relación y las etiquetas. No hace falta
conexión a Internet.

- La búsqueda acepta **prefijos**: `gand` encuentra «Gandalf el Gris».
- No importan las mayúsculas ni los acentos: `cancion` encuentra «Canción».
- Si te equivocas en una letra, la búsqueda prueba palabras parecidas del propio
  índice (`gandolf` encuentra «Gandalf») y avisa de que son resultados
  aproximados.
- El texto encontrado aparece resaltado en el título o en el fragmento cuando la
  coincidencia está ahí; si coincide por un alias, una etiqueta o el nombre del
  tipo de relación, el resultado aparece igualmente sin marca en el texto.
- Cada resultado indica si es un mundo, una ficha o una relación, a qué mundo
  pertenece y cuándo se actualizó. Al pulsarlo se abre el mundo, la ficha o la
  ficha de origen de la relación.
- Se muestran hasta 50 resultados por consulta; el recuento indica el total
  encontrado y el tiempo que tardó la búsqueda.

### 11.2 Filtros

Los filtros se pueden combinar:

- **Mundo:** limita a un mundo concreto.
- **Tipo de contenido:** mundos, fichas o relaciones.
- **Tipo de ficha:** se activa al elegir un mundo y filtra por el tipo de sus
  fichas.
- **Etiqueta:** también se activa con un mundo elegido.
- **Estado:** activo, borrador o archivado del documento; los mundos solo
  tienen activo y archivado.

**Quitar filtros** los borra todos. Si una búsqueda no devuelve nada, prueba otra
palabra o quita algún filtro.

### 11.3 Recientes y favoritos

Cuando el campo está vacío, la pantalla muestra **Recientes** (lo último que se
ha actualizado) y **Favoritos** (las fichas marcadas como favoritas). Sirven para
volver rápido a lo que estabas usando.

### 11.4 Paleta de comandos

Pulsa `Ctrl+K`, o el disparador de la barra superior, para abrir la paleta:

- Escribe para filtrar **comandos** y **resultados** al mismo tiempo.
- Los comandos permiten ir a Inicio, Mundos o **Ajustes**, **abrir la página de
  búsqueda**, crear un mundo, crear una ficha, cambiar el tema y **reconstruir el
  índice de búsqueda**. **Muestras** no aparece: es una página interna de
  desarrollo.
- Las flechas mueven la selección, `Enter` la ejecuta y `Escape` cierra.
- El atajo no se activa mientras escribes en un campo ni con otro diálogo
  abierto, para no interferir con el texto.

### 11.5 Si los resultados no cuadran

El índice de búsqueda es una copia local que se actualiza sola al crear, editar,
borrar o restaurar contenido. Si sospechas que está desincronizado, abre el menú
`⋯` de la pantalla de **Búsqueda** y elige **Reconstruir el índice de búsqueda**;
también puedes abrir la paleta con `Ctrl+K`, escribir `reconstruir` y elegir el
mismo comando. No borra ningún dato: solo vuelve a leer los mundos, las fichas y
las relaciones. Ajustes no incluye hoy este botón; sigue disponible en los dos
sitios anteriores.

### 11.6 Lo que llegará después

La búsqueda de mapas, manuscritos y escenas llegará con esas secciones. El grafo
interactivo tendrá su propia búsqueda y navegación. La búsqueda es siempre local y
no se envía a ningún servicio externo.

## 12. Ajustes

La pantalla de **Ajustes** ya está disponible. Se abre desde **Ajustes**, en el
pie de la barra lateral, encima del botón de plegar; también desde la paleta
`Ctrl+K` con el comando **Abrir Ajustes** y por su dirección interna
`#/settings`. La aplicación **sigue abriendo en Inicio**: Ajustes no cambia la
pantalla de arranque.

Los cambios de apariencia se aplican **al instante** y se guardan en este equipo.
La página se lee de arriba abajo: Apariencia, Idioma, Atajos de consulta,
Actualizaciones, Datos y copias y Restablecer preferencias.

### 12.1 Apariencia

Tres grupos de opciones, cada uno con sus botones de opción:

- **Tema:** **Claro** u **Oscuro**. Se aplica a toda la ventana y es el mismo
  ajuste que el icono de tema de la barra superior y el comando de la paleta
  (sección 3.3).
- **Densidad:** **Cómoda** o **Compacta**. Cambia el espacio entre bloques y
  controles; no cambia el tamaño del texto ni oculta información. Compacta
  permite ver más contenido en la misma ventana.
- **Tamaño del texto:** **Pequeño**, **Normal** o **Grande**. Cambia el tamaño de
  los textos de la interfaz, no el tamaño de la ventana ni el zoom del sistema.
  Con **Grande** y densidad **Compacta** la ventana sigue adaptándose a 1024 px
  sin desplazamiento horizontal de página.

Debajo está **Restablecer apariencia**. Vuelve a **Claro**, **Cómoda** y
**Normal** y lo anuncia en la propia sección. No cambia tus mundos, fichas,
imágenes, relaciones, copias ni registros, y no toca el resto de preferencias:
para eso está **Restablecer preferencias** (final de la página).

### 12.2 Idioma

La interfaz está en **español**. Ajustes muestra el idioma actual y una nota
informativa; **no hay un selector** porque todavía no hay otros idiomas
disponibles. La aplicación está preparada para añadirlos en el futuro, pero no
se promete una fecha ni una lista.

### 12.3 Atajos de consulta

Una sección plegable, cerrada por defecto, reúne los atajos disponibles:

| Acción | Atajo |
|---|---|
| Abrir la paleta de comandos | `Ctrl+K` |
| Cerrar un diálogo o menú | `Esc` |

En el editor, `@` abre la mención de una ficha. **Los atajos son solo de
consulta y no se pueden reasignar** en esta versión. El resto del teclado se
explica en la sección 3.2.

### 12.4 Actualizaciones

Muestra la **versión instalada**, la **última comprobación** (o «Todavía no se ha
comprobado») y el estado actual. **Abrir actualizaciones** lleva al mismo diálogo
del icono de la barra superior, donde se busca, descarga e instala con tu
consentimiento (sección 3.6).

No hay comprobación automática ni un interruptor de frecuencia: la aplicación
solo consulta GitHub Releases cuando tú lo pides y **nunca** envía el contenido
de tus mundos ni datos personales.

### 12.5 Datos y copias

Al entrar, la sección carga un **resumen** con los mundos activos, archivados y
en la papelera, las fichas, las imágenes y las copias. Si la lectura falla,
aparece un aviso con **Volver a intentar** y el resto de la pantalla sigue
siendo utilizable. En **modo seguro** los datos no están disponibles: la
sección lo explica, no permite exportar, purgar ni borrar, pero **sí puedes abrir
las carpetas** para revisar o recuperar archivos.

**Carpetas**

La tabla de carpetas permite abrir en el Explorador de Windows las carpetas de
la aplicación:

| Carpeta | Contenido |
|---|---|
| `data` | Base de datos, preferencias y archivos internos. |
| `assets` | Imágenes y miniaturas de las fichas. |
| `backups` | Copias automáticas y copias previas a operaciones. |
| `logs` | Registros técnicos de la aplicación. |
| `imports` | Trabajo temporal de importación (grupo **Temporales**). |
| `exports` | Trabajo temporal de exportación (grupo **Temporales**). |

Solo se muestran el nombre y la ruta **relativa** dentro de la carpeta de datos;
**nunca la ruta completa del equipo**. Si una carpeta no existe, la aplicación la
crea antes de abrirla. Si no puede abrirla, lo explica sin exponer rutas.

**Uso de disco**

La sección **Uso de disco** está plegada y muestra el total en su cabecera. Al
abrirla, presenta el tamaño de la base de datos, las imágenes, las copias, los
registros y los temporales, más el total. **Volver a calcular** repite la
medición.

La medición es rápida y tiene un límite: si hay muchísimos archivos o tarda
demasiado, aparece la insignia **Parcial** y el resto de cifras sigue siendo
válido. Los temporales son los mismos directorios que vacía el borrado total, de
modo que la cifra no promete espacio que no se vaya a liberar.

**Exportar todos los datos**

1. Pulsa **Exportar todos los datos**.
2. Elige en el diálogo de Windows dónde guardar el archivo y con qué nombre. El
   formato es un ZIP abierto llamado **biblioteca** (`world-craft-library`,
   versión 1).
3. La aplicación prepara primero una carpeta temporal y después publica el
   archivo. Mientras dura, el diálogo no se puede cerrar.
4. Al terminar verás el **nombre del archivo**, su **tamaño** y cuántos **mundos**
   incluye. Si eliges un archivo que ya existía, se sustituye solo al final; un
   fallo conserva el anterior.

La biblioteca contiene:

- **Un paquete por cada mundo vivo**, activo o archivado, con sus fichas, tipos
  personalizados, etiquetas, relaciones, versiones de la descripción e imágenes.
  Es el mismo formato de la sección 4.6, así que cada paquete se puede importar
  por separado.
- **`settings.json`** con la apariencia: tema, densidad, tamaño del texto, barra
  lateral y memoria de la vista de ficha.
- **`database/world-craft.sqlite`**, una **copia completa y verificada de la base
  de datos**. Esa copia sí incluye la **papelera**, la **actividad** y las
  **preferencias**, también el último mundo o ficha recordados y los datos de
  vista.

Los paquetes de mundo **excluyen** la papelera, la actividad y las preferencias;
esas tres cosas solo están en la copia de la base. La biblioteca **no incluye**
las copias automáticas ni las imágenes huérfanas. Si no hay mundos, la
exportación sigue siendo válida e incluye la base y las preferencias.

**La importación sigue siendo mundo a mundo:** usa **Importar mundo** en Inicio o
Mundos (sección 4.6) y elige el paquete `worlds/<nombre>.zip` que quieras. No hay
un botón para importar la biblioteca completa.

**Imágenes huérfanas**

Una imagen huérfana es la que ninguna ficha usa. Pulsa **Analizar** para ver el
resumen: archivos que se pueden purgar, imágenes sin referencia, miniaturas
huérfanas, temporales, archivos ausentes, enlaces no seguidos, entradas no
reconocidas y espacio recuperable.

Si hay algo que purgar, **Purgar…** abre una confirmación con el número de
archivos y su tamaño. Marca la casilla de confirmación y pulsa **Purgar
imágenes**. Antes de borrar se guarda una **copia verificable** en
`backups/orphans`; si la copia falla, no se borra nada. **Las imágenes que usa
alguna ficha no se tocan.**

**Eliminar todos los datos**

La **zona de peligro** elimina todo el contenido de World Craft de este equipo.
Es una acción distinta de desinstalar: **no desinstala la aplicación ni borra la
carpeta de instalación**.

1. Pulsa **Eliminar todos los datos**.
2. Lee la lista de lo que se eliminará y de lo que se conservará.
3. Decide si marcas **Conservar también las copias de seguridad**. Está
   **desmarcada por defecto**: si la dejas así, también se borran las copias
   automáticas. La copia previa al borrado se conserva **siempre**.
4. Escribe exactamente **ELIMINAR TODO**. El botón no se habilita hasta que la
   frase coincide; si no coincide, se explica el error.
5. Pulsa **Eliminar todos los datos** y espera. El diálogo no se puede cerrar
   durante el proceso.
6. Al terminar, la aplicación avisa y **se reinicia sola**. La base se vuelve a
   crear vacía al arrancar.

Se eliminan los mundos, fichas, tipos, etiquetas, relaciones, versiones,
actividad, preferencias, imágenes, temporales, registros y las copias (salvo que
hayas marcado conservarlas). Se conservan la **copia previa** en
`backups/pre-delete`, la **instalación** y el identificador técnico de
actualizaciones. Si algún elemento no se puede borrar —por ejemplo, porque
Windows lo tiene bloqueado—, la aplicación indica las **categorías restantes** y
se reinicia igualmente para dejar un estado limpio.

**Restablecer preferencias**

Vuelve a los valores iniciales el tema, la barra lateral, el panel de
propiedades, las secciones plegables y el último mundo o ficha recordados. Pide
confirmación y **no borra** mundos, fichas, imágenes, relaciones, copias ni
registros. Es distinto de **Restablecer apariencia**, que solo toca tema,
densidad y tamaño del texto.

### 12.6 Qué hace cada acción y cómo se recupera

| Acción | Qué hace | Qué no hace | Cómo se recupera |
|---|---|---|---|
| **Restablecer preferencias** | Devuelve tema, rail, panel, secciones y último destino a sus valores iniciales. | No borra contenido, copias ni registros. | No hace falta: se puede volver a configurar a mano. |
| **Exportar todos los datos** | Crea una biblioteca con un paquete por mundo, `settings.json` y una copia completa de la base. | No incluye copias automáticas, imágenes huérfanas ni la instalación. | Importa cada mundo con **Importar mundo**; la copia completa de la base se puede abrir con una herramienta SQLite o copiar con la aplicación cerrada, sin restauración guiada. |
| **Purgar imágenes huérfanas** | Borra imágenes y miniaturas que ninguna ficha usa, tras copiarlas. | No toca imágenes referenciadas ni fichas. | Copia los archivos desde `backups/orphans` con la aplicación cerrada. |
| **Eliminar todos los datos** | Borra el contenido, las imágenes, los registros y las copias según tu elección, y reinicia. | No desinstala ni toca la carpeta de instalación. | Restaura a mano la copia `backups/pre-delete` (sección 12.7). |

### 12.7 Recuperar la copia previa al borrado total

La copia previa al borrado **no se restaura sola ni se ofrece en el aviso de
modo seguro**: esa restauración guiada solo sustituye la base y dejaría las
imágenes desalineadas. La recuperación es manual y requiere mover archivos con
la aplicación cerrada.

1. **Cierra World Craft** por completo. Comprueba que no queda abierta en la
   bandeja del sistema.
2. Abre la carpeta de copias desde Ajustes → Datos → **Abrir copias** (o desde
   `%APPDATA%\World Craft\backups`) y entra en **`pre-delete`**.
3. Elige la carpeta con la fecha del borrado que quieras recuperar. Dentro
   encontrarás `world-craft.sqlite`, la carpeta `assets`, `assets-manifest.json`,
   `manifest.json` y `recovery.json`.
4. Copia `world-craft.sqlite` sobre `%APPDATA%\World Craft\data\world-craft.sqlite`.
   Si en `data` quedan archivos `-wal`, `-shm` o `-journal` de la base vacía,
   bórralos antes de arrancar.
5. Copia la carpeta `assets` de la copia en `%APPDATA%\World Craft\`, junto a
   `data`, de modo que sustituya a la carpeta de imágenes actual.
6. Antes de abrir la aplicación, sigue las instrucciones de `recovery.json` y
   comprueba los archivos con `assets-manifest.json`: ahí están el recuento, los
   tamaños y los hashes SHA-256. **No edites esos archivos.**
7. Abre World Craft con normalidad. La aplicación comprobará la base y, si todo
   cuadra, verás los mundos, las fichas, la papelera y las preferencias de la
   copia.

Si algo no cuadra, **no borres la copia ni la carpeta de datos**: conserva ambas
y pide ayuda antes de seguir. La copia `pre-delete` no se poda sola y no cuenta
para los límites de las copias automáticas.

### 12.8 Lo que llegará después

Siguen **previstos**, sin fecha en esta pantalla:

- Crear, verificar y restaurar copias manuales desde Ajustes, con elección de
  carpeta.
- Compactar y verificar la base de datos desde Ajustes.
- Exportar un diagnóstico local.
- Recordar el tamaño y la posición de la ventana.
- El interruptor y la frecuencia de las actualizaciones, cuando exista la
  comprobación automática (M5-05).
- Más idiomas y un selector real de idioma.
- Importar una biblioteca completa y restaurar una copia desde Ajustes con un
  flujo guiado.

## 13. Tus datos y las copias

### 13.1 Dónde están tus datos

- Todo se guarda en tu equipo, en la carpeta de datos de World Craft
  (`%APPDATA%\World Craft`). La base de datos está en la subcarpeta `data` y se
  crea sola al arrancar. Las imágenes y los archivos están en `assets`; las
  copias, en `backups`; los registros técnicos, en `logs`; y las carpetas
  `imports` y `exports` solo guardan temporales de una transferencia en curso o
  interrumpida, que se limpian al arrancar. La **papelera** y el
  **historial de versiones** viven en la misma base: entran en las copias y una
  restauración los recupera. El ZIP que exportas **no** se queda en esa carpeta:
  se guarda donde tú elijas.
- Los binarios se instalan aparte, en `%LOCALAPPDATA%\Programs\World Craft`.
  **Actualizar, reinstalar o desinstalar no borra** la carpeta de datos.
- La aplicación puede guardar en su carpeta de datos un identificador técnico de
  actualización y registros de la comprobación. No contienen tus mundos, tus
  fichas ni el contenido de tus archivos. Las descargas de actualizaciones se
  guardan en una carpeta temporal de Windows, fuera de `userData`; al instalar
  o cancelar no se mezclan con tus datos.
- Tus **preferencias de interfaz** —el tema, la densidad, el tamaño del texto,
  la barra lateral plegada, el panel de propiedades con su ancho, las secciones
  plegables y el último mundo o ficha de **Continuar**— se guardan en la misma
  base de datos local. Entran en las copias automáticas, de modo que una
  restauración las recupera, y **no** forman parte de la exportación de un
  mundo. **Restablecer preferencias** en Ajustes solo devuelve sus valores
  iniciales: **no borra** mundos, fichas, imágenes, relaciones ni copias. La
  biblioteca total de Ajustes sí incluye las preferencias en su copia completa de
  la base (sección 12.5).
- El **borrado total** de Ajustes elimina el contenido, las imágenes, los
  registros y las copias que elijas, pero **no desinstala la aplicación ni toca
  la carpeta de instalación**. Antes de borrar guarda una copia `pre-delete` que
  se conserva siempre (secciones 12.5 y 12.7).
- No hay sincronización automática entre equipos ni subida de datos a Internet.

### 13.2 Copias automáticas

Mientras la aplicación está en desarrollo, las copias ya funcionan pero no
tienen una pantalla propia: se crean solas al arrancar con normalidad y solo se
pueden consultar o restaurar desde el aviso de modo seguro. Ajustes → Datos ya
permite **abrir la carpeta de copias**, ver cuánto ocupan y exportar todos los
datos, pero **crear, verificar o restaurar copias desde ahí sigue previsto**.

- **Cuándo se crean:** al abrir la aplicación, una vez comprobada la base. No se
  crean al cerrar. Si pasas días sin abrirla, al volver se crea la copia del
  periodo actual.
- **Con qué frecuencia:** una copia **diaria**, una **semanal** y una
  **mensual**. Cada una se guarda en su carpeta dentro de `backups`.
- **Antes de actualizar la estructura de la base:** se guarda una copia
  **pre-migración**; si esa copia no se puede crear o comprobar, no se cambia
  nada.
- **Antes de eliminar algo de la papelera para siempre:** se guarda una copia
  **pre-purga** y se comprueba; si falla, no se borra nada (sección 6.4).
- **Cuántas se conservan:** 7 diarias, 4 semanales, 12 mensuales, 5
  pre-migración y 10 pre-purga. Las más antiguas se van borrando
  automáticamente. Las copias **pre-restauración** no se borran solas.
- **Qué contienen:** solo la base de datos, incluidas tus preferencias de
  interfaz. **Las imágenes y los archivos (assets) no van dentro de la copia** y
  no se sustituyen al restaurar. La copia `pre-delete` del borrado total es la
  excepción: incluye también las imágenes (sección 12.7). Si necesitas las
  imágenes sin borrar nada, exporta el mundo (sección 4.6) o usa la biblioteca
  total (sección 12.5): ambas incluyen los assets y se pueden importar en otra
  instalación.
- **Copias dañadas:** si una copia no supera la comprobación, no se te ofrece,
  no cuenta para el límite y **no se borra automáticamente**. Se queda donde
  está por si sirve para un diagnóstico.
- Las copias son locales. La aplicación no las sube a ningún servicio.

### 13.3 Restaurar una copia

Hoy la restauración se ofrece desde el **aviso de modo seguro**, que aparece
cuando la aplicación no puede usar la base de datos con seguridad. Ajustes →
Datos ya existe, pero **no restaura copias**: permite abrir la carpeta de copias,
ver su uso y exportar todos los datos. La restauración guiada desde Ajustes sigue
prevista. Si la aplicación arranca con normalidad, **todavía no hay una pantalla
para restaurar una copia**.

1. Abre World Craft. Si hay un problema, antes de la ventana aparece el aviso
   «World Craft ha arrancado en modo seguro», con una explicación y un código.
2. Pulsa **Restaurar copia**.
3. Elige **Usar la copia más reciente** o **Elegir una carpeta**. La carpeta
   debe estar dentro de la carpeta de copias; si eliges otra cosa, la aplicación
   la rechaza.
4. La aplicación comprueba la copia antes de continuar. Si está dañada, es de
   una versión más reciente o no es una copia válida, no te la ofrece y no toca
   nada.
5. Aparece una confirmación con la **fecha de la copia** y su **versión**. Si
   aceptas, la aplicación guarda primero una copia de los datos actuales, cambia
   la base y se reinicia sola.
6. Al volver a abrirse, la aplicación termina de preparar la base restaurada.
   Tus imágenes y archivos no se tocan.

Si la restauración falla, la aplicación vuelve al aviso de modo seguro e intenta
dejar los datos como estaban. No se pierde la copia que acabas de elegir ni la
copia de los datos anteriores. La restauración **nunca se hace sola ni en
segundo plano**.

### 13.4 Copias pre-restauración, pre-purga, pre-delete y recuperación manual

Antes de reemplazar la base, la aplicación guarda la base anterior en la
subcarpeta `backups/pre-restore`. Esa copia **no se ofrece desde la aplicación**
y no se borra automáticamente: sirve para una recuperación manual si algo sale
mal.

La **exportación de un mundo** (sección 4.6) es otra vía de recuperación manual:
a diferencia de las copias automáticas, el ZIP incluye las imágenes y se puede
importar en una instalación nueva. Solo contiene contenido vivo del mundo
exportado, no la papelera, la actividad ni las preferencias. Si pierdes la
carpeta de datos, el ZIP te permite recuperar ese mundo, pero no la biblioteca
completa ni las copias. La **biblioteca total** de Ajustes añade una copia
completa de la base y un paquete por mundo (sección 12.5), pero tampoco incluye
las copias automáticas.

Las copias **pre-purga** de la papelera viven en `backups/pre-purge`, sí se
ofrecen como cualquier copia válida en el aviso de modo seguro y también se
pueden recuperar a mano:

- La recuperación manual requiere **cerrar la aplicación** y copiar el archivo
  `world-craft.sqlite` de la carpeta `pre-purge` (o `pre-restore`) sobre
  `data/world-craft.sqlite`. Si hay archivos `-wal`, `-shm` o `-journal` junto a
  la copia, se copian también.
- Si no te sientes cómodo moviendo archivos, **no borres nada**: conserva la
  carpeta de datos y la de copias y pide ayuda antes de tocar los archivos.

La copia **pre-delete** del borrado total vive en `backups/pre-delete` y es
distinta: incluye la base **y** las imágenes, y **no se ofrece en el aviso de
modo seguro**. Su recuperación es siempre manual y está explicada paso a paso en
la sección 12.7. La aplicación no la restaura sola ni la poda.

### 13.5 Si la aplicación no arranca o no ofrece una copia

- **No borres la carpeta de datos ni la de copias.** Son la vía para recuperar
  tu información.
- Si el aviso de modo seguro aparece pero no hay copias que restaurar, puede que
  las copias estén dañadas o que sean de otra versión. Abre la carpeta de copias
  desde el propio aviso y revisa que existan `backups/daily`, `weekly`,
  `monthly` o `pre-migration` con su `manifest.json`.
- Si la aplicación se cierra sin mostrar el aviso, comprueba los requisitos
  (sección 2.1) y el aviso de Windows (sección 14). Si el problema continúa,
  conserva las carpetas y pide ayuda.
- Si la aplicación se queda en modo seguro después de una restauración, puede
  haber quedado un archivo de bloqueo o un resto de la operación anterior. Cierra
  la aplicación, vuelve a abrirla y prueba otra copia. En casos excepcionales,
  con la aplicación cerrada, se puede borrar el archivo `data/.restore.lock`;
  no es un archivo con tus datos. **No borres `data/.restore.pending`**: es el
  marcador que impide crear una base vacía; si está presente, prueba otra copia
  o pide ayuda.

### 13.6 Desinstalar World Craft

1. Abre **Configuración → Aplicaciones** de Windows (en Windows 11,
   **Aplicaciones instaladas**; en Windows 10, **Aplicaciones y
   características**), busca **World Craft** y elige **Desinstalar**. También
   puedes usar el desinstalador de la carpeta de instalación.
2. La desinstalación es por usuario y **no pide permisos de administrador**.
   Elimina los binarios y el acceso directo del menú Inicio.
3. El desinstalador avisa de que tus mundos, fichas, mapas y copias
   **se conservan** en `%APPDATA%\World Craft`. En una desinstalación silenciosa
   no muestra el aviso, pero tampoco borra los datos.
4. Si quieres eliminar también los datos, ciérrala y borra manualmente esa
   carpeta. Antes de hacerlo, guarda una copia o exporta lo que necesites: esa
   acción **no se puede deshacer** desde la aplicación.

## 14. Aviso de SmartScreen

El instalador del MVP **no está firmado** con un certificado de código. Windows
puede mostrar un aviso azul de SmartScreen la primera vez que lo ejecutes. Para
continuar:

1. Comprueba que has obtenido el instalador por el canal oficial del proyecto y
   que su nombre es el esperado (`world-craft-<versión>-setup.exe`).
2. Si quieres comprobar la integridad, compara su SHA-256 con el valor publicado
   junto al instalador (`SHA256SUMS`). Deben coincidir exactamente.
3. Pulsa «Más información».
4. Pulsa «Ejecutar de todas formas».

La firma de código es opcional y de pago; se valorará más adelante. El aviso no
significa que la aplicación tenga un problema. Descargar el instalador de un
sitio no oficial y ejecutarlo sí es un riesgo: sin firma, el aviso de Windows no
puede distinguir un archivo manipulado. Descárgalo siempre del origen oficial y
verifica el checksum cuando esté disponible.

## 15. Accesibilidad

Ya funciona en el shell de desarrollo:

- Navegación completa por teclado, con enlace «Saltar al contenido principal» y
  foco visible en los dos temas; usarlo no cambia de pantalla.
- Barra lateral plegable con nombres accesibles, `aria-expanded` y ayudas
  emergentes al foco; menús `⋯` de la barra superior y de las tarjetas de mundo
  con flechas, `Inicio`, `Fin` y `Escape`.
- Pestañas con flechas, `Inicio` y `Fin`; diálogo con foco atrapado y `Escape`;
  ayudas emergentes que se ocultan con `Escape`.
- En la ficha, las secciones se pliegan con `Enter` o espacio y anuncian su
  estado con `aria-expanded`; el cuerpo cerrado no se recorre.
- El separador del panel de propiedades tiene nombre, se enfoca con `Tab` y
  anuncia su valor; las flechas cambian el ancho, `Inicio` y `Fin` van a los
  extremos y `Escape` cancela el arrastre.
- El foco se dirige al entrar y salir de edición, a la descripción o al primer
  campo, y al primer error cuando el guardado es explícito. El autoguardado no
  roba el foco.
- En lectura, la descripción no se anuncia como un campo de formulario; en
  edición recupera su barra y su nombre accesible.
- La barra del editor es una barra de herramientas con cinco paradas de
  tabulación; el menú **Formato** se recorre con flechas, `Inicio`, `Fin` y
  `Escape`, y los botones de formato anuncian si están activos.
- El selector de menciones anuncia al abrir y al filtrar cuántas fichas hay,
  mantiene el foco en el texto y se recorre con flechas, `Inicio`, `Fin`, `Enter`,
  `Tab` y `Escape`; cerrar con `Escape` no borra lo escrito.
- `Ctrl+S` guarda en edición y no abre el diálogo de guardar página.
- En la **Papelera** y en el **Historial**, las listas son semánticas, los
  botones tienen nombre accesible («Restaurar “Nombre”»), los resultados y los
  recuentos se anuncian con `aria-live` y el foco pasa al siguiente elemento o al
  mensaje del grupo tras una acción. Los diálogos destructivos dejan **Cancelar**
  como opción inicial, atrapan el foco y lo devuelven al cerrarse; el vaciado no
  habilita su botón hasta marcar la casilla.
- El **diálogo de exportación e importación** anuncia la fase con `aria-live`, el
  error con `role="alert"` y la barra con `role="progressbar"`; el foco inicial va
  a **Cancelar** o a la fase cuando ya no se puede cancelar, `Escape` no cierra
  mientras la operación está en curso y al terminar el foco vuelve al control que
  abrió el diálogo. La barra indeterminada se detiene con movimiento reducido.
- Etiquetas, ayudas y errores asociados en los campos de texto.
- Avisos con `aria-live` (se anuncian sin robar el foco) y cierre manual. La
  disponibilidad de una actualización también se anuncia así.
- Respeto de `prefers-reduced-motion`: las animaciones se reducen o se
  desactivan.
- Revisión automática de accesibilidad (axe) sin errores críticos en el shell,
  Inicio, la vista de mundo, la lista de fichas, la ficha —incluido el editor con
  el menú **Formato** y el selector de menciones abiertos—, la Papelera, el
  Historial y el diálogo de exportación e importación, en los dos temas y con
  la barra lateral expandida y plegada; el contraste se comprueba con la tabla del
  sistema de diseño.
- Revisión visual de todas las pantallas existentes y de los diálogos, en Claro y
  Oscuro y en ventanas de 1024, 1280 y 1600 px de ancho, sin contenido cortado ni
  desplazamiento horizontal de página.

Sigue **previsto**:

- Los atajos de teclado generales, que se documentarán en la ayuda de la app.

## 16. Problemas frecuentes

Algunos avisos ya existen en el estado actual del desarrollo; otros llegarán con
las funciones correspondientes.

| Problema | Qué hacer |
|---|---|
| La app avisa de que ha arrancado en modo seguro | El aviso explica el motivo y ofrece **Restaurar copia**, **Abrir carpeta de copias**, **Continuar en modo seguro** (sin escribir en tus datos) o **Salir**. Para recuperar una versión anterior, pulsa «Restaurar copia» y sigue la sección 13.3. |
| La base no abre | La app arranca en modo seguro sin modificar el archivo. Restaura una copia desde el propio aviso. Si no hay copias válidas, conserva la carpeta de datos y la de copias y pide ayuda. |
| No aparece la copia que busco | La app no ofrece copias dañadas, con manifiesto inválido, de una versión más reciente ni las de `pre-restore`. Abre la carpeta de copias y comprueba que la carpeta elegida contiene `world-craft.sqlite` y `manifest.json`. |
| La restauración falla | La app vuelve al aviso de modo seguro e intenta dejar los datos como estaban. Prueba otra copia; la base anterior queda en `backups/pre-restore`. No borres esas carpetas. |
| La app sigue en modo seguro después de restaurar | Cierra la aplicación y vuelve a abrirla. Si persiste, prueba otra copia; como último recurso, con la app cerrada, borra `data/.restore.lock` (no contiene tus datos), pero **no borres `data/.restore.pending`**. |
| La app no arranca | Comprueba los requisitos (sección 2.1) y revisa el aviso de Windows (sección 14). No borres la carpeta de datos ni la de copias; conserva ambas y pide ayuda. |
| Windows avisa al instalar | Es SmartScreen por falta de firma; sigue la sección 14. Comprueba el SHA-256 si tienes el valor publicado. |
| El instalador pide administrador o no encuentra la carpeta | No debería: la instalación es por usuario en `%LOCALAPPDATA%\Programs\World Craft` y no usa UAC. Cierra el instalador y vuelve a ejecutarlo; si persiste, no continúes y pide ayuda. |
| La instalación o la actualización falla | Comprueba el espacio libre (el instalador ocupa unos 133 MB) y que la carpeta de instalación sea accesible. Vuelve a ejecutar el instalador; tus datos de `%APPDATA%\World Craft` no se tocan. |
| No aparece ninguna actualización | La comprobación es manual: pulsa el icono de **Actualizaciones** y luego **Buscar actualizaciones**. Si no hay una versión publicada más reciente, el diálogo indica que ya tienes la última. La comprobación real contra GitHub Releases se probará con la primera release pública (M5). |
| La comprobación de actualizaciones falla | Revisa la conexión e inténtalo de nuevo. La aplicación sigue funcionando sin conexión y tus datos no cambian. |
| La descarga de la actualización falla | Comprueba el espacio libre y la conexión, y vuelve a intentarlo. Puedes cancelar la descarga sin instalar nada. |
| La actualización está descargada pero no se instala | Pulsa **Reiniciar e instalar** en el diálogo. La instalación no ocurre sola: necesita tu confirmación. Si falla, cierra la aplicación y vuelve a intentarlo. |
| Las actualizaciones están desactivadas | El diálogo explica el motivo: estás en desarrollo, en modo seguro o falta la configuración de la instalación. No es un fallo de tus datos. |
| He desinstalado y no sé dónde están mis datos | Se conservan en `%APPDATA%\World Craft` (sección 13.6). La desinstalación no los borra; solo desaparecen si borras esa carpeta manualmente. |
| No encuentro una ficha | Abre **Papelera** y busca en el grupo **Fichas**; también puedes revisar los filtros de la lista y reconstruir la búsqueda. Si estaba en un mundo que borraste, restaura primero el mundo (sección 6.2). |
| Una imagen no se ve | Comprueba que el archivo sigue en la carpeta de assets. La restauración de la base no sustituye las imágenes. Si purgaste un mundo, sus imágenes siguen en el equipo hasta la cuarentena de una actualización posterior. |
| He borrado un mundo | Abre **Papelera**, grupo **Mundos**, y pulsa **Restaurar**; vuelve a Inicio y Mundos con su contenido. Si ya lo eliminaste definitivamente, usa la copia `pre-purge` (sección 6.4). |
| La exportación falla | Comprueba que el destino existe, que tienes permisos y espacio libre, y que el mundo sigue vivo (no está en la papelera). Si cancelaste, el archivo de destino no se ha modificado. Vuelve a intentarlo. |
| El archivo de mundo no se importa | Comprueba que es el `.zip` correcto y que no está truncado. Si se creó con una versión más reciente, actualiza World Craft. Si supera los límites, reduce el mundo. No edites el ZIP a mano. |
| La importación termina con avisos | Es normal si el archivo traía enlaces, referencias, imágenes, etiquetas o tipos ausentes. El resumen indica cuántos elementos se han quitado o normalizado; el mundo se ha importado con el resto. |
| El mundo importado tiene otro identificador | Ya existía un mundo con ese identificador y la aplicación añadió `-2`, `-3`… No se ha sobrescrito nada; puedes cambiar el identificador en **Editar**. |
| No puedo restaurar una ficha o un tipo | Si su mundo está en la papelera, restaura primero el mundo. Si el tipo personalizado ya no existe, restaura el tipo o cambia la ficha de tipo (sección 6.2). |
| La eliminación definitiva no se realiza | La aplicación no habrá podido crear o verificar la copia previa, normalmente por falta de espacio; no se ha borrado nada. Libera espacio e inténtalo de nuevo. |
| Quiero deshacer una eliminación definitiva | No hay un botón de deshacer en la papelera. La copia de `backups/pre-purge` es la red de recuperación: se restaura desde el aviso de modo seguro o a mano (secciones 13.3 y 13.4). |

## 17. Glosario

- **Mundo:** contenedor de todo el contenido de una ambientación.
- **Ficha o entidad:** personaje, lugar, objeto o concepto del mundo.
- **Relación:** vínculo entre dos fichas.
- **Grafo:** representación visual de las relaciones.
- **Asset:** archivo (imagen, documento) asociado a un mundo.
- **Manuscrito:** conjunto de textos organizados en libros, capítulos y escenas.
- **Copia:** archivo de seguridad de la base de datos. Las copias automáticas no
  incluyen las imágenes ni los archivos.
- **Copia pre-restauración:** copia de la base anterior que se guarda antes de
  restaurar; no se ofrece desde la aplicación y se recupera a mano.
- **Copia previa a la purga (pre-purga):** copia verificable de la base que se
  crea antes de eliminar definitivamente algo de la papelera. Se conservan las 10
  más recientes.
- **Papelera:** lista de lo borrado que se puede restaurar a su mundo y tipo de
  origen. No caduca sola; eliminar de la papelera es una acción aparte.
- **Purga o eliminación definitiva:** borrado real de un elemento de la papelera
  y de su contenido dependiente, siempre con copia previa y confirmación.
- **Versión:** copia del estado anterior de la descripción de una ficha.
  Automática, manual con etiqueta o de seguridad antes de restaurar.
- **Modo seguro:** arranque sin escritura para diagnosticar el problema, abrir la
  carpeta de copias y restaurar una copia sin modificar tus datos.
- **Exportación de mundo:** archivo ZIP abierto con el contenido vivo de un mundo
  y sus imágenes. Se puede inspeccionar sin la aplicación e importar en otra
  instalación.
- **Importación de mundo:** creación de un mundo nuevo a partir de un ZIP de
  exportación. Nunca fusiona ni sobrescribe mundos existentes.
- **Aviso de importación:** elemento que se ha quitado o normalizado porque el
  archivo traía una referencia rota, un tipo o una etiqueta ausente, una relación
  duplicada o un valor inválido.

## 18. Estado de las funciones

| Función | Estado |
|---|---|
| Barra lateral con navegación Inicio/Mundos/Papelera, Ajustes en el pie y plegado | Implementada (en desarrollo); sin lema ni versión |
| Barra superior con título contextual, buscador `Ctrl+K`, acción primaria, menú `⋯` e iconos de actualizaciones y tema | Implementada (en desarrollo) |
| Tema Claro/Oscuro conmutable | Implementado (en desarrollo); se recuerda al reiniciar y se aplica sin destello |
| Densidad Cómoda/Compacta y tamaño de texto Pequeño/Normal/Grande | Implementados (en desarrollo); presets de tokens, se aplican al instante y se recuerdan |
| Pantalla de Ajustes en el pie del rail, `#/settings` y paleta | Implementada (en desarrollo); la aplicación sigue abriendo en Inicio |
| Apariencia: tema, densidad, tamaño y **Restablecer apariencia** | Implementada (en desarrollo); el restablecimiento no toca datos ni el resto de preferencias |
| Idioma informativo (solo español, sin selector) | Implementado (en desarrollo); la estructura está preparada para más idiomas |
| Atajos de consulta y actualizaciones informativas en Ajustes | Implementados (en desarrollo); los atajos no se reasignan y no hay auto-comprobación |
| Instalador por usuario, sin administrador, en `%LOCALAPPDATA%` | Implementado (local); la release pública llega con M5 |
| Desinstalación que conserva `%APPDATA%\World Craft` | Implementada (local); el desinstalador avisa de los datos conservados |
| Comprobación manual de actualizaciones con descarga y cancelación | Implementada (en desarrollo); requiere una versión instalada y una release publicada para probarse de extremo a extremo |
| Instalación de la actualización con reinicio consentido | Implementada (en desarrollo); nunca se instala sola |
| Instancia única | Implementada; abrir la aplicación de nuevo enfoca la ventana existente |
| Aviso de SmartScreen y checksums | Documentado; el instalador sigue sin firma (ADR 0015) |
| Componentes base (botones, campos, avisos, diálogos...) | Implementados (en desarrollo) |
| Inicio como mesa de trabajo con Continuar, mundos recientes y actividad | Implementada (en desarrollo); sin contadores ni accesos rápidos |
| «Continuar» con el último mundo o ficha abiertos | Implementada (en desarrollo); se conserva entre sesiones y se limpia si el destino ya no existe |
| Tarjetas de mundo con **Abrir** y menú `⋯` | Implementada (en desarrollo); portada o marca gráfica determinista y fecha relativa |
| Página de muestras | Interna de desarrollo; solo por su dirección interna, fuera de la navegación y la paleta |
| Lista de mundos con búsqueda y filtro por estado | Implementada (en desarrollo) |
| CRUD de mundos: crear, editar, duplicar y archivar/restaurar | Implementado (en desarrollo); con validación y confirmación |
| Borrado lógico de mundos con confirmación | Implementado (en desarrollo); se recupera desde la Papelera |
| Página de mundo modular con identidad, navegación, preparación y actividad | Implementada (en desarrollo); Fichas navegable con recuento y Mapas, Manuscrito y Grafo como previstos sin enlace |
| Elegir la portada del mundo | Prevista (#115); si el mundo ya tiene una portada, Inicio y Mundos la muestran |
| Descripción enriquecida de mundos | Prevista (#114) |
| Base de datos local y comprobación al arrancar | Implementada (en desarrollo) |
| Aviso de modo seguro con restauración y apertura de la carpeta de copias | Implementada (en desarrollo) |
| Copia automática antes de cambiar la estructura de datos | Implementada (en desarrollo) |
| Copias automáticas diarias, semanales y mensuales | Implementadas (en desarrollo); retención 7/4/12, 5 pre-migración y 10 pre-purga |
| Restauración desde el aviso de modo seguro | Implementada (en desarrollo); Ajustes no restaura copias todavía |
| Datos en Ajustes: resumen, carpetas, uso de disco e imágenes huérfanas | Implementados (en desarrollo); rutas relativas, medición acotada y purga con copia |
| Exportar todos los datos como biblioteca `world-craft-library` v1 | Implementado (en desarrollo); paquete por mundo, `settings.json` y copia completa de SQLite verificada |
| Eliminar todos los datos con copia `pre-delete` y reinicio | Implementado (en desarrollo); frase **ELIMINAR TODO**, copia de base y assets, conserva la instalación y la copia |
| Instalador y aplicación | Implementados en local (0.1.0); sin release pública hasta M5 |
| Mundos | Implementada (en desarrollo); sin portada ni descripción enriquecida |
| Fichas, tipos, imágenes, etiquetas y favoritos | Implementada (en desarrollo); la ficha se lee como documento (fila siguiente) y se recupera desde la Papelera |
| Ficha como documento y panel de propiedades | Implementada (en desarrollo); lectura por defecto, edición en contexto, secciones plegables y panel de 280–360 px |
| Editor de la descripción con barra mínima y menciones `@` / `[[` | Implementado (en desarrollo); barra de cinco acciones, menú Formato, selector de fichas con teclado y enlaces internos; el manuscrito sigue previsto |
| Gestión visual de tipos personalizados | Implementada (en desarrollo) |
| Papelera global de mundos, fichas y tipos personalizados, con restauración | Implementada (en desarrollo); tres grupos, paginación por cursor y motivos claros si el mundo o el tipo no están disponibles |
| Eliminación definitiva y vaciado de la papelera con copia previa | Implementados (en desarrollo); confirmación explícita, copia `pre-purge` verificable y los assets no se borran |
| Historial de versiones de la descripción de una ficha | Implementado (en desarrollo); automáticas 5 min/20/90 días, manuales con etiqueta hasta 50 y restauración que conserva el estado actual |
| Exportación de un mundo a un ZIP abierto con imágenes | Implementada (en desarrollo); desde el menú del mundo, con progreso y cancelación |
| Importación de un mundo como mundo nuevo | Implementada (en desarrollo); validación, avisos, progreso y cancelación; nunca sobrescribe |
| Relaciones entre fichas, etiquetas inversas y backlinks | Implementada (en desarrollo); lectura por dirección y tipo, etiqueta recíproca, menú `⋯` con edición y borrado confirmado; los metadatos quedan en la API |
| Búsqueda global con prefijos, acentos y errores tipográficos | Implementada (en desarrollo); índice local reconstruible |
| Filtros de búsqueda por mundo, tipo, etiqueta y estado | Implementados (en desarrollo) |
| Paleta de comandos `Ctrl+K` | Implementada (en desarrollo); sin entrada a Muestras |
| Recientes y favoritos en la búsqueda | Implementados (en desarrollo) |
| Grafo | Previsto |
| Mapas | Prevista |
| Escritura | Prevista |
| Juego | Prevista |
| Ajustes | Implementada (en desarrollo); apariencia, idioma informativo, atajos, actualizaciones, datos y restablecimiento |
| Guardar la preferencia de tema | Implementada (en desarrollo); también se cambia desde Ajustes y la paleta |
| Recordar la barra lateral plegada | Implementada (en desarrollo) |
| Recordar el panel de propiedades, su ancho y las secciones plegables de la ficha | Implementada (en desarrollo); estado global, no por ficha |
| Restablecer las preferencias de interfaz | Implementada (en desarrollo); confirmación y sin borrar contenido |
| Copias manuales y elección de carpeta | Prevista |
| Ajustes de actualizaciones (interruptor y frecuencia) | Previstos (M5-05); hoy no hay auto-comprobación |
| Recordar el tamaño y la posición de la ventana | Previsto |
| Importar una biblioteca completa o restaurar una copia desde Ajustes | Previstas |
| Exportar un diagnóstico local | Previsto |
| Más idiomas y selector de idioma | Previstos |
| Firma de código del instalador | Opcional y de pago; fuera del MVP (ADR 0015) |
| Release pública y actualización desde GitHub Releases | Previstas para M5 |
| Manual dentro de la app | Prevista |

Este manual se actualizará cuando cada función esté disponible. Mientras una
función figure como **prevista**, no se debe presentar como si ya existiera.
