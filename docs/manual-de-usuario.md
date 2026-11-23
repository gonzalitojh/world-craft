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
> lateral con la navegación **Inicio** y **Mundos**, una barra superior con el
> título de lo que estás viendo, el buscador de la paleta `Ctrl+K`, una acción
> principal, un menú `⋯` para las secundarias y los iconos de actualizaciones y
> tema; el tema Claro/Oscuro se conmuta sin recargar. La página de inicio es una
> **mesa de trabajo** con los mundos recientes y la actividad, o su estado vacío.
> También existe una **base de datos
> local** que se crea y se comprueba al arrancar, con **copias automáticas** y
> **restauración desde modo seguro**. Ya se pueden crear, editar, duplicar,
> archivar y eliminar mundos con su actividad, y crear **fichas** de cualquier
> tipo con campos personalizados, descripción enriquecida, imágenes, etiquetas y
> favoritos. Todavía no hay mapas, manuscritos, ajustes ni papelera visible, y la
> preferencia de tema no se recuerda al reiniciar. Las **muestras** de
> componentes siguen existiendo solo como página interna de desarrollo y no
> aparecen en la navegación ni en la búsqueda.

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
   el instalador no está firmado; se explica en la sección 13.
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
**prevista**: todavía no existe.

### 2.4 Estado actual del desarrollo

El proyecto ya genera un **instalador local** y permite abrir la ventana de la
aplicación instalada. Esa ventana tiene el aspecto definitivo en lo básico: una
barra lateral con la navegación **Inicio** y **Mundos**, una barra superior con
el título contextual, el buscador de la paleta `Ctrl+K`, una sola acción
principal, un menú `⋯` para las secundarias y los iconos de actualizaciones y
tema; dos modos de color y componentes de interfaz ya creados (botones, campos,
insignias, tarjetas, diálogos, pestañas, avisos y ayudas emergentes).

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
`Ctrl+K`. Todavía no hay ventanas de mapas, manuscritos, grafo, ajustes ni
papelera visible, y la portada del mundo y la descripción enriquecida del mundo
llegarán en actualizaciones posteriores. **No hay una release pública**: el
instalador se genera y se prueba en local, y la publicación oficial llegará con
M5.

## 3. La ventana

### 3.1 Partes de la pantalla

Estas partes ya existen en la versión instalada y en el entorno de desarrollo:

- **Barra lateral:** contiene el logotipo y el nombre de la aplicación, la
  navegación entre **Inicio** y **Mundos**, y un botón para plegarla. Expandida
  ocupa 240 px y plegada 64 px; al plegarla quedan el logotipo y los iconos, con
  su nombre accesible y una ayuda emergente. No muestra lema permanente ni
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

- **Mapas, escritura, juego y ajustes** en la barra lateral.
- **Paneles** de filtros o de detalles en otras pantallas.
- **Barra de estado** con el guardado y los avisos.

La **búsqueda** ya no tiene entrada propia en la navegación: se llega por el
buscador de la barra superior y por la paleta (sección 10).

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

**La preferencia no se recuerda al reiniciar:** cada vez que se abre la
aplicación empieza en el tema Claro. Guardar la elección y elegirla desde una
pantalla de Ajustes llegará más adelante.

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

- **Continuar**, solo si en esta sesión ya has abierto un mundo o una ficha.
  Indica el destino y ofrece **Abrir el mundo** o **Abrir la ficha**. Es un
  recordatorio temporal: si cierras o recargas la aplicación, desaparece; tampoco
  aparece si no hay destino o si el mundo recordado ya no existe. Conservarlo
  entre sesiones llegará más adelante.
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
problema, la aplicación avisa antes de abrir la ventana (sección 15).

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
diálogo explica que están desactivadas. Todavía **no hay un interruptor para
desactivarlas** porque no hay comprobación automática; ese ajuste llegará con la
pantalla de Ajustes en M1.

Si la comprobación o la descarga fallan, el diálogo muestra un aviso y puedes
volver a intentarlo. Un fallo de actualización no toca tus datos: la base, los
assets y las copias siguen en `%APPDATA%\World Craft` (sección 12).

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

- **Continuar:** retoma el último mundo o la última ficha que abriste **durante
  esta sesión**. El botón se llama **Abrir el mundo** o **Abrir la ficha**.
  Desaparece al recargar y se omite si el mundo recordado ya no existe; al
  eliminarlo, el bloque se limpia. Guardar este recordatorio entre sesiones
  llegará con una actualización posterior.
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

### 4.5 Editar, duplicar, archivar y eliminar

Dentro de un mundo, las cuatro acciones están en el menú `⋯` de la barra
superior, junto a la acción principal **Nueva ficha**. La página del mundo no
repite esos botones: solo muestra la identidad, los módulos y el contenido. Las
tarjetas de Inicio y de Mundos muestran **Abrir** y su propio menú `⋯` con
**Editar**, **Duplicar**, **Archivar** o **Restaurar** y **Eliminar**.

- **Editar:** cambia el nombre, el identificador, el resumen, la descripción, los
  géneros o el idioma. El mundo se actualiza al guardar y queda registrado en la
  actividad.
- **Duplicar:** crea un mundo nuevo con el contenido editable del original y un
  nombre propuesto. La portada no se copia porque pertenece al mundo original.
- **Archivar:** oculta el mundo de la lista de activos sin borrar nada. Puedes
  verlo con el filtro **Archivados** y restaurarlo cuando quieras.
- **Eliminar:** pide confirmación y mueve el mundo a la papelera. Deja de
  aparecer en Inicio y Mundos; la pantalla de papelera para restaurarlo llegará
  en una actualización posterior. Hasta entonces, las copias de seguridad siguen
  siendo la red de seguridad (sección 12).

Todas las acciones destructivas piden confirmación y ninguna borra archivos del
disco sin avisar. Al cerrar el diálogo, el foco vuelve al control que lo abrió
o, si ese control ya no existe, al contenido principal.

### 4.6 Lo que llegará después

- **Portada del mundo:** elegir una imagen local y verla en la cabecera del mundo.
- **Descripción enriquecida del mundo:** formato básico, enlaces internos y texto
  listo para buscar.
- **Exportar e importar** un mundo completo en un archivo abierto.
- **Papelera visible** para restaurar o vaciar definitivamente.

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
- El panel de propiedades y las secciones plegables recuerdan su estado mientras
  la aplicación sigue abierta. Conservarlo entre reinicios llegará con #132.
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
  papelera para que una restauración futura encuentre su plantilla. Sí puedes
  ajustar etiquetas, opciones, icono, color y añadir campos.
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
  ficha deja de aparecer en la lista; la pantalla de papelera para restaurarla
  llegará con la siguiente entrega. Hasta entonces, las copias de seguridad siguen
  siendo la red de seguridad (sección 12).

## 6. Relaciones y grafo

### 6.1 Relacionar fichas

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

### 6.2 Editar y eliminar relaciones

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

### 6.3 Tipos de relación

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

### 6.4 Grafo (previsto)

La vista de grafo llegará en una etapa posterior. Mostrará las relaciones como
un mapa de nodos, con zoom, filtros por tipo o etiqueta, encuadre y apertura de
la ficha al seleccionar un nodo. Las relaciones que crees ahora se conservarán y
aparecerán en esa vista.

Mientras el grafo esté previsto, la ficha **no incluye ningún botón, enlace ni
acción** para abrirlo: la sección Relaciones solo ofrece lo descrito en 6.1 y
6.2. Cuando la vista llegue, se añadirá su acceso en la misma tarea.

## 7. Mapas (previsto)

- **Crear un mapa:** elige un nombre y un estilo de fondo.
- **Dibujar:** punto, línea, polígono, rectángulo, círculo y trazo libre.
- **Editar:** mueve, cambia el tamaño y edita vértices.
- **Capas:** organiza el mapa en capas y ocúltalas cuando no las necesites.
- **Marcadores:** enlaza un punto del mapa con una ficha.
- **Imagen de fondo:** usa una imagen propia como referencia.
- **Exportar:** guarda el mapa como SVG o PNG.

## 8. Escritura (previsto)

- **Manuscritos:** agrupa libros, capítulos y escenas.
- **Editor:** escribe con formato, diálogos y separadores de escena.
- **Menciones:** enlaza personajes y lugares desde el texto. Las menciones `@` y
  `[[ ]]` ya funcionan en la descripción de una ficha (sección 5.3); el
  manuscrito todavía no existe.
- **Versiones:** guarda una versión de una escena antes de un cambio grande.
- **Objetivos:** define una meta de palabras.
- **Modo concentración:** oculta paneles para escribir sin distracciones.
- **Exportar:** genera Markdown, HTML, EPUB o PDF.

## 9. Juego de inspiración (previsto)

El juego todavía no tiene un módulo propio en la navegación de un mundo: cuando
exista su pantalla se incorporará a ella junto a **Mapas**, **Manuscrito** y
**Grafo**, que hoy aparecen como **Previsto**. Estas son las funciones
planeadas:

- **Dados:** tira dados y guarda el resultado.
- **Tablas:** consulta tablas de ideas por categoría.
- **Tablas propias:** crea y edita tus tablas.
- **Packs:** importa y exporta contenido de juego.
- **Sesiones:** guarda el resultado de una sesión y añade notas.

## 10. Búsqueda y paleta de comandos

### 10.1 Buscar en toda la biblioteca

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

### 10.2 Filtros

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

### 10.3 Recientes y favoritos

Cuando el campo está vacío, la pantalla muestra **Recientes** (lo último que se
ha actualizado) y **Favoritos** (las fichas marcadas como favoritas). Sirven para
volver rápido a lo que estabas usando.

### 10.4 Paleta de comandos

Pulsa `Ctrl+K`, o el disparador de la barra superior, para abrir la paleta:

- Escribe para filtrar **comandos** y **resultados** al mismo tiempo.
- Los comandos permiten ir a Inicio o Mundos, **abrir la página de búsqueda**,
  crear un mundo, crear una ficha, cambiar el tema y **reconstruir el índice de
  búsqueda**. **Muestras** no aparece: es una página interna de desarrollo.
- Las flechas mueven la selección, `Enter` la ejecuta y `Escape` cierra.
- El atajo no se activa mientras escribes en un campo ni con otro diálogo
  abierto, para no interferir con el texto.

### 10.5 Si los resultados no cuadran

El índice de búsqueda es una copia local que se actualiza sola al crear, editar,
borrar o restaurar contenido. Si sospechas que está desincronizado, abre el menú
`⋯` de la pantalla de **Búsqueda** y elige **Reconstruir el índice de búsqueda**;
también puedes abrir la paleta con `Ctrl+K`, escribir `reconstruir` y elegir el
mismo comando. No borra ningún dato: solo vuelve a leer los mundos, las fichas y
las relaciones. La pantalla Ajustes → Datos añadirá este mismo botón más
adelante.

### 10.6 Lo que llegará después

La búsqueda de mapas, manuscritos y escenas llegará con esas secciones. El grafo
interactivo tendrá su propia búsqueda y navegación. La búsqueda es siempre local y
no se envía a ningún servicio externo.

## 11. Ajustes (previsto)

- **Apariencia:** tema Claro u Oscuro; se aplica a toda la aplicación. Hoy el
  tema ya se cambia desde la barra superior, pero **todavía no se guarda** entre
  sesiones: elegirlo y recordarlo será parte de esta pantalla.
- **Idioma:** español en el MVP; la estructura está preparada para más idiomas.
- **Ventana:** recordar tamaño y posición.
- **Datos:** abrir carpetas, verificar la base, reconstruir la búsqueda (hoy se
  hace desde el menú `⋯` de la pantalla de Búsqueda o desde la paleta `Ctrl+K`,
  sección 10.5), compactar y eliminar todos los datos.
- **Copias:** dentro de Ajustes → Datos, crear, verificar y restaurar copias. La
  restauración desde el aviso de modo seguro ya existe (sección 12.3); esta
  pantalla, con la copia manual y la elección de carpeta, es prevista.
- **Actualizaciones:** hoy se buscan, descargan e instalan desde el icono de
  actualizaciones de la barra superior (sección 3.6). Ajustes añadirá el
  interruptor y la frecuencia, pero **no habrá comprobación automática hasta
  M1**; ahora no existe un ajuste para desactivarla porque no hay nada que
  desactivar.
- **Ayuda:** abrir este manual y exportar un diagnóstico.

## 12. Tus datos y las copias

### 12.1 Dónde están tus datos

- Todo se guarda en tu equipo, en la carpeta de datos de World Craft
  (`%APPDATA%\World Craft`). La base de datos está en la subcarpeta `data` y se
  crea sola al arrancar. Las imágenes y los archivos están en `assets`; las
  copias, en `backups`; y los registros técnicos, en `logs`.
- Los binarios se instalan aparte, en `%LOCALAPPDATA%\Programs\World Craft`.
  **Actualizar, reinstalar o desinstalar no borra** la carpeta de datos.
- La aplicación puede guardar en su carpeta de datos un identificador técnico de
  actualización y registros de la comprobación. No contienen tus mundos, tus
  fichas ni el contenido de tus archivos. Las descargas de actualizaciones se
  guardan en una carpeta temporal de Windows, fuera de `userData`; al instalar
  o cancelar no se mezclan con tus datos.
- No hay sincronización automática entre equipos ni subida de datos a Internet.

### 12.2 Copias automáticas

Mientras la aplicación está en desarrollo, las copias ya funcionan pero no
tienen una pantalla propia: se crean solas al arrancar con normalidad y solo se
pueden consultar o restaurar desde el aviso de modo seguro. La pantalla
Ajustes → Datos, con la sección de copias, llegará en una etapa posterior.

- **Cuándo se crean:** al abrir la aplicación, una vez comprobada la base. No se
  crean al cerrar. Si pasas días sin abrirla, al volver se crea la copia del
  periodo actual.
- **Con qué frecuencia:** una copia **diaria**, una **semanal** y una
  **mensual**. Cada una se guarda en su carpeta dentro de `backups`.
- **Antes de actualizar la estructura de la base:** se guarda una copia
  **pre-migración**; si esa copia no se puede crear o comprobar, no se cambia
  nada.
- **Cuántas se conservan:** 7 diarias, 4 semanales, 12 mensuales y 5
  pre-migración. Las más antiguas se van borrando automáticamente. Las copias
  **pre-restauración** no se borran solas.
- **Qué contienen:** solo la base de datos. **Las imágenes y los archivos
  (assets) no van dentro de la copia** y no se sustituyen al restaurar.
- **Copias dañadas:** si una copia no supera la comprobación, no se te ofrece,
  no cuenta para el límite y **no se borra automáticamente**. Se queda donde
  está por si sirve para un diagnóstico.
- Las copias son locales. La aplicación no las sube a ningún servicio.

### 12.3 Restaurar una copia

Hoy la restauración se ofrece desde el **aviso de modo seguro**, que aparece
cuando la aplicación no puede usar la base de datos con seguridad. La pantalla
Ajustes → Datos llegará en una etapa posterior. Si la aplicación arranca con
normalidad, **todavía no hay una pantalla para restaurar una copia**: esa opción
llegará con Ajustes.

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

### 12.4 Copias pre-restauración y recuperación manual

Antes de reemplazar la base, la aplicación guarda la base anterior en la
subcarpeta `backups/pre-restore`. Esa copia **no se ofrece desde la aplicación**
y no se borra automáticamente: sirve para una recuperación manual si algo sale
mal.

- La recuperación manual requiere **cerrar la aplicación** y copiar el archivo
  `world-craft.sqlite` de la carpeta `pre-restore` sobre
  `data/world-craft.sqlite`. Si hay archivos `-wal`, `-shm` o `-journal` junto a
  la copia, se copian también.
- Si no te sientes cómodo moviendo archivos, **no borres nada**: conserva la
  carpeta de datos y la de copias y pide ayuda antes de tocar los archivos.

### 12.5 Si la aplicación no arranca o no ofrece una copia

- **No borres la carpeta de datos ni la de copias.** Son la vía para recuperar
  tu información.
- Si el aviso de modo seguro aparece pero no hay copias que restaurar, puede que
  las copias estén dañadas o que sean de otra versión. Abre la carpeta de copias
  desde el propio aviso y revisa que existan `backups/daily`, `weekly`,
  `monthly` o `pre-migration` con su `manifest.json`.
- Si la aplicación se cierra sin mostrar el aviso, comprueba los requisitos
  (sección 2.1) y el aviso de Windows (sección 13). Si el problema continúa,
  conserva las carpetas y pide ayuda.
- Si la aplicación se queda en modo seguro después de una restauración, puede
  haber quedado un archivo de bloqueo o un resto de la operación anterior. Cierra
  la aplicación, vuelve a abrirla y prueba otra copia. En casos excepcionales,
  con la aplicación cerrada, se puede borrar el archivo `data/.restore.lock`;
  no es un archivo con tus datos. **No borres `data/.restore.pending`**: es el
  marcador que impide crear una base vacía; si está presente, prueba otra copia
  o pide ayuda.

### 12.6 Desinstalar World Craft

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

## 13. Aviso de SmartScreen

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

## 14. Accesibilidad

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
- Etiquetas, ayudas y errores asociados en los campos de texto.
- Avisos con `aria-live` (se anuncian sin robar el foco) y cierre manual. La
  disponibilidad de una actualización también se anuncia así.
- Respeto de `prefers-reduced-motion`: las animaciones se reducen o se
  desactivan.
- Revisión automática de accesibilidad (axe) sin errores críticos en el shell,
  Inicio, la vista de mundo, la lista de fichas y la ficha —incluido el editor con
  el menú **Formato** y el selector de menciones abiertos—, en los dos temas y con
  la barra lateral expandida y plegada; el contraste se comprueba con la tabla del
  sistema de diseño.

Sigue **previsto**:

- Contraste y apariencia comprobados visualmente en todas las pantallas, hasta
  completar la auditoría visual que llega con #133.
- Los atajos de teclado generales, que se documentarán en la ayuda de la app.

## 15. Problemas frecuentes

Algunos avisos ya existen en el estado actual del desarrollo; otros llegarán con
las funciones correspondientes.

| Problema | Qué hacer |
|---|---|
| La app avisa de que ha arrancado en modo seguro | El aviso explica el motivo y ofrece **Restaurar copia**, **Abrir carpeta de copias**, **Continuar en modo seguro** (sin escribir en tus datos) o **Salir**. Para recuperar una versión anterior, pulsa «Restaurar copia» y sigue la sección 12.3. |
| La base no abre | La app arranca en modo seguro sin modificar el archivo. Restaura una copia desde el propio aviso. Si no hay copias válidas, conserva la carpeta de datos y la de copias y pide ayuda. |
| No aparece la copia que busco | La app no ofrece copias dañadas, con manifiesto inválido, de una versión más reciente ni las de `pre-restore`. Abre la carpeta de copias y comprueba que la carpeta elegida contiene `world-craft.sqlite` y `manifest.json`. |
| La restauración falla | La app vuelve al aviso de modo seguro e intenta dejar los datos como estaban. Prueba otra copia; la base anterior queda en `backups/pre-restore`. No borres esas carpetas. |
| La app sigue en modo seguro después de restaurar | Cierra la aplicación y vuelve a abrirla. Si persiste, prueba otra copia; como último recurso, con la app cerrada, borra `data/.restore.lock` (no contiene tus datos), pero **no borres `data/.restore.pending`**. |
| La app no arranca | Comprueba los requisitos (sección 2.1) y revisa el aviso de Windows (sección 13). No borres la carpeta de datos ni la de copias; conserva ambas y pide ayuda. |
| Windows avisa al instalar | Es SmartScreen por falta de firma; sigue la sección 13. Comprueba el SHA-256 si tienes el valor publicado. |
| El instalador pide administrador o no encuentra la carpeta | No debería: la instalación es por usuario en `%LOCALAPPDATA%\Programs\World Craft` y no usa UAC. Cierra el instalador y vuelve a ejecutarlo; si persiste, no continúes y pide ayuda. |
| La instalación o la actualización falla | Comprueba el espacio libre (el instalador ocupa unos 133 MB) y que la carpeta de instalación sea accesible. Vuelve a ejecutar el instalador; tus datos de `%APPDATA%\World Craft` no se tocan. |
| No aparece ninguna actualización | La comprobación es manual: pulsa el icono de **Actualizaciones** y luego **Buscar actualizaciones**. Si no hay una versión publicada más reciente, el diálogo indica que ya tienes la última. La comprobación real contra GitHub Releases se probará con la primera release pública (M5). |
| La comprobación de actualizaciones falla | Revisa la conexión e inténtalo de nuevo. La aplicación sigue funcionando sin conexión y tus datos no cambian. |
| La descarga de la actualización falla | Comprueba el espacio libre y la conexión, y vuelve a intentarlo. Puedes cancelar la descarga sin instalar nada. |
| La actualización está descargada pero no se instala | Pulsa **Reiniciar e instalar** en el diálogo. La instalación no ocurre sola: necesita tu confirmación. Si falla, cierra la aplicación y vuelve a intentarlo. |
| Las actualizaciones están desactivadas | El diálogo explica el motivo: estás en desarrollo, en modo seguro o falta la configuración de la instalación. No es un fallo de tus datos. |
| He desinstalado y no sé dónde están mis datos | Se conservan en `%APPDATA%\World Craft` (sección 12.6). La desinstalación no los borra; solo desaparecen si borras esa carpeta manualmente. |
| No encuentro una ficha | Previsto: revisa la papelera y reconstruye la búsqueda. |
| Una imagen no se ve | Previsto: comprueba que el archivo sigue en la carpeta de assets. La restauración de la base no sustituye las imágenes. |
| He borrado un mundo | Previsto: restáuralo desde la papelera o desde una copia. |

## 16. Glosario

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
- **Modo seguro:** arranque sin escritura para diagnosticar el problema, abrir la
  carpeta de copias y restaurar una copia sin modificar tus datos.

## 17. Estado de las funciones

| Función | Estado |
|---|---|
| Barra lateral con navegación Inicio/Mundos y plegado | Implementada (en desarrollo); sin lema ni versión |
| Barra superior con título contextual, buscador `Ctrl+K`, acción primaria, menú `⋯` e iconos de actualizaciones y tema | Implementada (en desarrollo) |
| Tema Claro/Oscuro conmutable | Implementado (en desarrollo); no se recuerda al reiniciar |
| Instalador por usuario, sin administrador, en `%LOCALAPPDATA%` | Implementado (local); la release pública llega con M5 |
| Desinstalación que conserva `%APPDATA%\World Craft` | Implementada (local); el desinstalador avisa de los datos conservados |
| Comprobación manual de actualizaciones con descarga y cancelación | Implementada (en desarrollo); requiere una versión instalada y una release publicada para probarse de extremo a extremo |
| Instalación de la actualización con reinicio consentido | Implementada (en desarrollo); nunca se instala sola |
| Instancia única | Implementada; abrir la aplicación de nuevo enfoca la ventana existente |
| Aviso de SmartScreen y checksums | Documentado; el instalador sigue sin firma (ADR 0015) |
| Componentes base (botones, campos, avisos, diálogos...) | Implementados (en desarrollo) |
| Inicio como mesa de trabajo con Continuar, mundos recientes y actividad | Implementada (en desarrollo); sin contadores ni accesos rápidos |
| «Continuar» con el último mundo o ficha abiertos | Implementada (en desarrollo); memoria de la sesión, no se conserva al recargar |
| Tarjetas de mundo con **Abrir** y menú `⋯` | Implementada (en desarrollo); portada o marca gráfica determinista y fecha relativa |
| Página de muestras | Interna de desarrollo; solo por su dirección interna, fuera de la navegación y la paleta |
| Lista de mundos con búsqueda y filtro por estado | Implementada (en desarrollo) |
| CRUD de mundos: crear, editar, duplicar y archivar/restaurar | Implementado (en desarrollo); con validación y confirmación |
| Borrado lógico de mundos con confirmación | Implementado (en desarrollo); la papelera visible llega con #77 |
| Página de mundo modular con identidad, navegación, preparación y actividad | Implementada (en desarrollo); Fichas navegable con recuento y Mapas, Manuscrito y Grafo como previstos sin enlace |
| Elegir la portada del mundo | Prevista (#115); si el mundo ya tiene una portada, Inicio y Mundos la muestran |
| Descripción enriquecida de mundos | Prevista (#114) |
| Base de datos local y comprobación al arrancar | Implementada (en desarrollo) |
| Aviso de modo seguro con restauración y apertura de la carpeta de copias | Implementada (en desarrollo) |
| Copia automática antes de cambiar la estructura de datos | Implementada (en desarrollo) |
| Copias automáticas diarias, semanales y mensuales | Implementadas (en desarrollo); retención 7/4/12 |
| Restauración desde el aviso de modo seguro | Implementada (en desarrollo); la pantalla de Ajustes llega en una etapa posterior |
| Instalador y aplicación | Implementados en local (0.1.0); sin release pública hasta M5 |
| Mundos | Implementada (en desarrollo); sin portada ni descripción enriquecida |
| Fichas, tipos, imágenes, etiquetas y favoritos | Implementada (en desarrollo); la ficha se lee como documento (fila siguiente) y la papelera visible llega con #77 |
| Ficha como documento y panel de propiedades | Implementada (en desarrollo); lectura por defecto, edición en contexto, secciones plegables y panel de 280–360 px |
| Editor de la descripción con barra mínima y menciones `@` / `[[` | Implementado (en desarrollo); barra de cinco acciones, menú Formato, selector de fichas con teclado y enlaces internos; el manuscrito sigue previsto |
| Gestión visual de tipos personalizados | Implementada (en desarrollo) |
| Relaciones entre fichas, etiquetas inversas y backlinks | Implementada (en desarrollo); lectura por dirección y tipo, etiqueta recíproca, menú `⋯` con edición y borrado confirmado; los metadatos quedan en la API |
| Búsqueda global con prefijos, acentos y errores tipográficos | Implementada (en desarrollo); índice local reconstruible |
| Filtros de búsqueda por mundo, tipo, etiqueta y estado | Implementados (en desarrollo) |
| Paleta de comandos `Ctrl+K` | Implementada (en desarrollo); sin entrada a Muestras |
| Recientes y favoritos en la búsqueda | Implementados (en desarrollo) |
| Grafo | Previsto |
| Mapas | Prevista |
| Escritura | Prevista |
| Juego | Prevista |
| Ajustes | Prevista |
| Guardar la preferencia de tema | Prevista (con Ajustes) |
| Recordar la barra lateral plegada | Prevista (#132); hoy se recuerda solo durante la sesión |
| Recordar el panel de propiedades y las secciones plegables de la ficha | Prevista (#132); hoy se recuerdan solo durante la sesión |
| Copias manuales y elección de carpeta | Prevista (con Ajustes) |
| Ajustes de actualizaciones (interruptor y frecuencia) | Previstos (con Ajustes, M1); hoy no hay auto-check |
| Firma de código del instalador | Opcional y de pago; fuera del MVP (ADR 0015) |
| Release pública y actualización desde GitHub Releases | Previstas para M5 |
| Manual dentro de la app | Prevista |

Este manual se actualizará cuando cada función esté disponible. Mientras una
función figure como **prevista**, no se debe presentar como si ya existiera.
