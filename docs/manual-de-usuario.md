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
> actualizaciones** integrada en la barra superior. La ventana incluye barra
> lateral con navegación, tema Claro/Oscuro conmutable, una página de inicio que
> es el **dashboard de mundos** (o su estado vacío) y una **página de muestras
> solo para desarrollo**. También existe una **base de datos local** que se crea
> y se comprueba al arrancar, con **copias automáticas** y **restauración desde
> modo seguro**. Ya se pueden crear, editar, duplicar, archivar y eliminar
> mundos con su actividad, y crear **fichas** de cualquier tipo con campos
> personalizados, descripción enriquecida, imágenes, etiquetas y favoritos.
> Todavía no hay mapas, manuscritos, ajustes ni papelera visible, y la
> preferencia de tema no se recuerda al reiniciar.

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
barra lateral con navegación, una barra superior con el botón de búsqueda, el de
actualizaciones y el de tema, dos modos de color y componentes de interfaz ya
creados (botones, campos, insignias, tarjetas, diálogos, pestañas, avisos y
ayudas emergentes).

La aplicación crea y comprueba su base de datos local, guarda copias automáticas,
sabe arrancar en **modo seguro** si algo va mal y permite restaurar una copia.
La comprobación de actualizaciones es **manual y cancelable**; no se ejecuta sola.
Los datos se quedan en este equipo, en una carpeta propia que sobrevive a las
actualizaciones de la aplicación.
Ya se pueden **crear, editar, duplicar, archivar y eliminar mundos**, y el
dashboard muestra tus mundos, la actividad reciente y su preparación. Dentro de
cada mundo puedes **crear y editar fichas** con sus tipos, campos, descripción,
imágenes, etiquetas, favoritos y **relaciones tipadas con backlinks**. También
existe la **búsqueda global** con filtros, recientes y favoritos, y una **paleta
de comandos** que se abre con `Ctrl+K`. Todavía no hay ventana de grafo, mapas,
manuscritos, ajustes ni papelera visible, y la portada del mundo y la descripción
enriquecida del mundo llegarán en actualizaciones posteriores. **No hay una
release pública**: el instalador se genera y se prueba en local, y la publicación
oficial llegará con M5.

## 3. La ventana

### 3.1 Partes de la pantalla

Estas partes ya existen en la versión instalada y en el entorno de desarrollo:

- **Barra lateral:** contiene el logotipo y el nombre de la aplicación, la
  navegación entre **Inicio**, **Búsqueda**, **Mundos** y **Muestras**, y un botón
  para plegarla. Expandida ocupa 240 px y plegada 64 px; al plegarla quedan el
  logotipo y los iconos.
- **Barra superior:** muestra el nombre de la pantalla actual —o el del mundo
  abierto—, el botón **Buscar** con su atajo `Ctrl+K`, el botón
  **Actualizaciones** y el botón de tema. El botón de actualizaciones abre un
  diálogo para buscar, descargar e instalar versiones nuevas (sección 3.6).
- **Área central:** el contenido de la pantalla. Es el destino del enlace
  «Saltar al contenido principal» que aparece al empezar a usar el teclado.

El botón **Nueva ficha** de la barra superior abre la creación rápida desde
cualquier pantalla. Las fichas se abren desde la página de su mundo, no desde la
barra lateral.

Siguen **previstas**, para cuando existan mapas y escritura:

- **Mapas, escritura, juego y ajustes** en la barra lateral.
- **Paneles** de detalles, filtros o propiedades.
- **Barra de estado** con el guardado y los avisos.

La página **Muestras** solo sirve para revisar el aspecto de los componentes en
los dos temas y con textos largos. Es una página de desarrollo: no forma parte
de lo que verá quien use la aplicación.

### 3.2 Navegación por teclado

- Pulsa `Tab` para avanzar por los controles. El primer `Tab` muestra el enlace
  «Saltar al contenido principal», que lleva directamente al contenido y evita
  recorrer toda la barra lateral.
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
- El foco siempre se ve, en los dos temas.

### 3.3 Tema Claro y Oscuro

El botón de la barra superior indica el tema actual («Claro» u «Oscuro») y
cambia al pulsarlo. El cambio es inmediato y afecta a toda la ventana: los
mismos contenidos, la misma jerarquía y el mismo contraste en ambos temas.

**La preferencia no se recuerda al reiniciar:** cada vez que se abre la
aplicación empieza en el tema Claro. Guardar la elección y elegirla desde una
pantalla de Ajustes llegará más adelante.

### 3.4 Tamaño de ventana

La ventana se puede redimensionar y el tamaño mínimo es 1024×700. El diseño está
preparado para que a 1024, 1280 y 1600 píxeles de ancho el contenido se adapte
sin desplazamiento horizontal de página; el dashboard, los mundos, las fichas,
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

Cuando ya hay mundos, **Inicio** se convierte en el dashboard: muestra un
resumen con el número de mundos activos y archivados, tarjetas con los mundos
actualizados recientemente, la actividad reciente de todos tus mundos con el
nombre de cada uno y accesos rápidos para crear o gestionar mundos.

La base de datos local se crea y se comprueba sola al arrancar; si hubiera un
problema, la aplicación avisa antes de abrir la ventana (sección 15).

### 3.6 Actualizaciones

La comprobación de actualizaciones es **siempre manual**: la aplicación no
consulta Internet al arrancar ni en segundo plano. Solo lo hace cuando pulsas
**Actualizaciones** en la barra superior y después **Buscar actualizaciones**.

1. Pulsa **Actualizaciones**. El diálogo muestra la **versión instalada** y la
   **última comprobación**, o «Todavía no se ha comprobado ninguna
   actualización».
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

1. En **Inicio**, pulsa **Crear mundo**. También puedes hacerlo desde **Mundos**.
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

### 4.2 El dashboard de Inicio

Cuando ya hay mundos, **Inicio** muestra:

- Un **resumen** con el total de mundos y cuántos están activos o archivados.
- Tus **mundos recientes** como tarjetas con su nombre, resumen, géneros,
  estado y fecha de actualización. Cada tarjeta permite abrir, editar, duplicar,
  archivar o restaurar y eliminar.
- La **actividad reciente** de todos tus mundos. Cada línea indica qué ocurrió,
  en qué mundo y cuándo, de modo que no se atribuye una acción al mundo
  equivocado.
- **Accesos rápidos** para crear un mundo nuevo o ir a la lista completa.

### 4.3 La lista de Mundos

**Mundos** muestra todas las tarjetas. Puedes:

- **Buscar** por nombre, identificador o resumen.
- **Filtrar** por estado: todos, activos o archivados.
- Ver cuántos mundos coinciden con el filtro.
- Quitar los filtros con un botón cuando no haya resultados.

### 4.4 La página de un mundo

Al abrir un mundo ves su ficha completa: nombre, estado, resumen, géneros,
descripción, identificador, idioma y fechas de creación y actualización.

- **Preparación del mundo:** una barra de progreso indica si faltan el resumen,
  la descripción o los géneros. Los campos que ya están completos se marcan como
  **Completado**.
- **Actividad de este mundo:** solo las acciones de ese mundo, con su fecha.
- **Accesos rápidos:** **Fichas del mundo** abre la lista de fichas. Mapas,
  manuscrito y juego siguen como **Previsto** hasta que lleguen sus pantallas.
  Mientras tanto, la ficha del mundo ya es editable.

### 4.5 Editar, duplicar, archivar y eliminar

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
disco sin avisar.

### 4.6 Lo que llegará después

- **Portada del mundo:** elegir una imagen local y verla en la ficha.
- **Descripción enriquecida:** formato básico, enlaces internos y texto listo
  para buscar.
- **Exportar e importar** un mundo completo en un archivo abierto.
- **Papelera visible** para restaurar o vaciar definitivamente.

## 5. Fichas y entidades

Las fichas son la base del mundo: personajes, lugares, organizaciones, objetos,
criaturas, eventos y cualquier tipo que crees. Se abren desde **Fichas del
mundo**, en los accesos rápidos de la página de un mundo.

### 5.1 Crear una ficha

1. Abre un mundo y pulsa **Fichas del mundo**.
2. Pulsa **Nueva ficha** (o **Nueva ficha** en la barra superior desde cualquier
   pantalla) y elige el mundo, el tipo y el nombre.
3. Al crearla se abre la ficha para completar el resto: alias, resumen,
   descripción, campos del tipo, imagen, galería, etiquetas y estado.

### 5.2 Guardado y edición

- El contenido se **autoguarda** poco después de dejar de escribir. La cabecera
  de la ficha muestra **Guardando…**, **Guardado**, **Cambios sin guardar** o un
  aviso si no se pudo guardar.
- **Guardar ahora** fuerza el guardado en ese momento.
- El nombre es obligatorio. Los campos marcados con `*` también.
- Los valores inválidos se señalan en su campo y no se envían al guardado.
- El **tipo no cambia** después de crear la ficha. Si necesitas otra plantilla,
  crea una ficha nueva con ese tipo.

### 5.3 Descripción enriquecida

La descripción admite **negrita**, **cursiva**, títulos de nivel 1 a 3, listas con
viñetas, listas numeradas, citas y **enlaces internos a otras fichas** del mismo
mundo. Los enlaces se insertan con el botón de enlace; para abrir uno, coloca el
cursor sobre él y pulsa **Abrir enlace** en la barra del editor, o usa `Ctrl` +
clic. No se pega HTML ni se permiten enlaces externos.

### 5.4 Campos del tipo

Cada tipo puede tener campos de **texto**, **número**, **fecha**, **selección** o
**referencia a otra ficha**. Los campos de referencia solo ofrecen fichas del
mismo mundo y, si el tipo lo limita, del tipo de destino. Los valores se validan
antes de guardar.

### 5.5 Tipos personalizados

El botón **Gestionar tipos** abre la lista de tipos del sistema y de los
personalizados de ese mundo.

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

### 5.6 Imágenes y galería

- **Imagen principal:** elige una imagen del mundo o añade una nueva. Se guarda
  en tu equipo y se muestra sin salir de la aplicación.
- **Galería:** añade varias imágenes, usa las miniaturas y elige cuál es la
  principal. Puedes quitar una imagen de la galería sin borrar el archivo.
- Las imágenes se guardan en la carpeta de datos de la aplicación. Al
  actualizar o reinstalar no se borran.

### 5.7 Etiquetas y favoritos

- **Etiquetas:** crea etiquetas de color por mundo y asígnalas a las fichas. Se
  pueden quitar de una ficha sin borrar la etiqueta.
- **Favoritos:** la estrella marca las fichas que más usas.
- En la lista puedes **buscar** por nombre, alias, resumen o descripción y
  **filtrar** por tipo, etiqueta, favorito y estado.
- Los filtros y las etiquetas nunca mezclan datos de otros mundos.

### 5.8 Estado y borrado

- Cada ficha puede estar **Activa**, en **Borrador** o **Archivada**.
- **Mover a la papelera** pide confirmación. La ficha deja de aparecer en la
  lista; la pantalla de papelera para restaurarla llegará con la siguiente
  entrega. Hasta entonces, las copias de seguridad siguen siendo la red de
  seguridad (sección 12).

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

Las relaciones de la ficha actual se muestran en **Desde esta ficha** con la
etiqueta directa. En **Backlinks** aparecen las fichas que apuntan a esta, con la
etiqueta inversa. En ambos casos puedes pulsar el nombre de la otra ficha para
abrirla.

### 6.2 Editar y eliminar relaciones

- **Editar** permite cambiar el tipo, las etiquetas, las notas y la fuerza. El
  origen y el destino no cambian; para invertirlos, crea la relación desde la
  otra ficha.
- **Eliminar** pide confirmación y quita la relación de las dos fichas. Las
  fichas y sus datos no se borran.
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
- **Menciones:** enlaza personajes y lugares desde el texto.
- **Versiones:** guarda una versión de una escena antes de un cambio grande.
- **Objetivos:** define una meta de palabras.
- **Modo concentración:** oculta paneles para escribir sin distracciones.
- **Exportar:** genera Markdown, HTML, EPUB o PDF.

## 9. Juego de inspiración (previsto)

- **Dados:** tira dados y guarda el resultado.
- **Tablas:** consulta tablas de ideas por categoría.
- **Tablas propias:** crea y edita tus tablas.
- **Packs:** importa y exporta contenido de juego.
- **Sesiones:** guarda el resultado de una sesión y añade notas.

## 10. Búsqueda y paleta de comandos

### 10.1 Buscar en toda la biblioteca

La pantalla **Búsqueda** de la barra lateral busca a la vez en mundos, fichas y
relaciones. Escribe al menos una letra en **Buscar en tu biblioteca**: se
encuentran coincidencias por el título, el resumen, la descripción, los alias, las
notas de una relación y las etiquetas. No hace falta conexión a Internet.

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

Pulsa `Ctrl+K`, o el botón **Buscar** de la barra superior, para abrir la paleta:

- Escribe para filtrar **comandos** y **resultados** al mismo tiempo.
- Los comandos permiten ir a Inicio, Búsqueda, Mundos o Muestras, crear un mundo,
  crear una ficha, cambiar el tema y **reconstruir el índice de búsqueda**.
- Las flechas mueven la selección, `Enter` la ejecuta y `Escape` cierra.
- El atajo no se activa mientras escribes en un campo ni con otro diálogo
  abierto, para no interferir con el texto.

### 10.5 Si los resultados no cuadran

El índice de búsqueda es una copia local que se actualiza sola al crear, editar,
borrar o restaurar contenido. Si sospechas que está desincronizado, abre la paleta
con `Ctrl+K`, escribe `reconstruir` y elige **Reconstruir el índice de búsqueda**.
No borra ningún dato: solo vuelve a leer los mundos, las fichas y las relaciones.
La pantalla Ajustes → Datos añadirá este mismo botón más adelante.

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
  hace desde la paleta `Ctrl+K`, sección 10.5), compactar y eliminar todos los
  datos.
- **Copias:** dentro de Ajustes → Datos, crear, verificar y restaurar copias. La
  restauración desde el aviso de modo seguro ya existe (sección 12.3); esta
  pantalla, con la copia manual y la elección de carpeta, es prevista.
- **Actualizaciones:** hoy se buscan, descargan e instalan desde el botón
  **Actualizaciones** de la barra superior (sección 3.6). Ajustes añadirá el
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
  foco visible en los dos temas.
- Pestañas con flechas, `Inicio` y `Fin`; diálogo con foco atrapado y `Escape`;
  ayudas emergentes que se ocultan con `Escape`.
- Etiquetas, ayudas y errores asociados en los campos de texto.
- Avisos con `aria-live` (se anuncian sin robar el foco) y cierre manual.
- Respeto de `prefers-reduced-motion`: las animaciones se reducen o se
  desactivan.

Sigue **previsto**:

- Contraste y apariencia comprobados visualmente en todas las pantallas, con
  revisión automática de accesibilidad pendiente para la fase de pruebas de UI.
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
| No aparece ninguna actualización | La comprobación es manual: pulsa **Actualizaciones → Buscar actualizaciones**. Si no hay una versión publicada más reciente, el diálogo indica que ya tienes la última. La comprobación real contra GitHub Releases se probará con la primera release pública (M5). |
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
| Barra lateral con navegación y plegado | Implementada (en desarrollo) |
| Barra superior con el título, Buscar, Actualizaciones y el botón de tema | Implementada (en desarrollo) |
| Tema Claro/Oscuro conmutable | Implementado (en desarrollo); no se recuerda al reiniciar |
| Instalador por usuario, sin administrador, en `%LOCALAPPDATA%` | Implementado (local); la release pública llega con M5 |
| Desinstalación que conserva `%APPDATA%\World Craft` | Implementada (local); el desinstalador avisa de los datos conservados |
| Comprobación manual de actualizaciones con descarga y cancelación | Implementada (en desarrollo); requiere una versión instalada y una release publicada para probarse de extremo a extremo |
| Instalación de la actualización con reinicio consentido | Implementada (en desarrollo); nunca se instala sola |
| Instancia única | Implementada; abrir la aplicación de nuevo enfoca la ventana existente |
| Aviso de SmartScreen y checksums | Documentado; el instalador sigue sin firma (ADR 0015) |
| Componentes base (botones, campos, avisos, diálogos...) | Implementados (en desarrollo) |
| Página de inicio con estado vacío | Implementada (en desarrollo); el botón abre el formulario de creación |
| Página de muestras | Solo en desarrollo; no es una función de producto |
| Dashboard con resumen, mundos recientes y actividad | Implementado (en desarrollo); sin mezclar datos entre mundos |
| Lista de mundos con búsqueda y filtro por estado | Implementada (en desarrollo) |
| CRUD de mundos: crear, editar, duplicar y archivar/restaurar | Implementado (en desarrollo); con validación y confirmación |
| Borrado lógico de mundos con confirmación | Implementado (en desarrollo); la papelera visible llega con #77 |
| Página de mundo con preparación y actividad aislada | Implementada (en desarrollo) |
| Portada del mundo | Prevista (#115) |
| Descripción enriquecida de mundos | Prevista (#114) |
| Base de datos local y comprobación al arrancar | Implementada (en desarrollo) |
| Aviso de modo seguro con restauración y apertura de la carpeta de copias | Implementada (en desarrollo) |
| Copia automática antes de cambiar la estructura de datos | Implementada (en desarrollo) |
| Copias automáticas diarias, semanales y mensuales | Implementadas (en desarrollo); retención 7/4/12 |
| Restauración desde el aviso de modo seguro | Implementada (en desarrollo); la pantalla de Ajustes llega en una etapa posterior |
| Instalador y aplicación | Implementados en local (0.1.0); sin release pública hasta M5 |
| Mundos | Implementada (en desarrollo); sin portada ni descripción enriquecida |
| Fichas, tipos, imágenes, etiquetas y favoritos | Implementada (en desarrollo); papelera visible y restauración con #77 |
| Gestión visual de tipos personalizados | Implementada (en desarrollo) |
| Relaciones entre fichas, etiquetas inversas y backlinks | Implementada (en desarrollo); los metadatos quedan en la API |
| Búsqueda global con prefijos, acentos y errores tipográficos | Implementada (en desarrollo); índice local reconstruible |
| Filtros de búsqueda por mundo, tipo, etiqueta y estado | Implementados (en desarrollo) |
| Paleta de comandos `Ctrl+K` | Implementada (en desarrollo) |
| Recientes y favoritos en la búsqueda | Implementados (en desarrollo) |
| Grafo | Previsto |
| Mapas | Prevista |
| Escritura | Prevista |
| Juego | Prevista |
| Ajustes | Prevista |
| Guardar la preferencia de tema | Prevista (con Ajustes) |
| Copias manuales y elección de carpeta | Prevista (con Ajustes) |
| Ajustes de actualizaciones (interruptor y frecuencia) | Previstos (con Ajustes, M1); hoy no hay auto-check |
| Firma de código del instalador | Opcional y de pago; fuera del MVP (ADR 0015) |
| Release pública y actualización desde GitHub Releases | Previstas para M5 |
| Manual dentro de la app | Prevista |

Este manual se actualizará cuando cada función esté disponible. Mientras una
función figure como **prevista**, no se debe presentar como si ya existiera.
