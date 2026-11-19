# Manual de usuario de World Craft

> **Estado:** manual en construcción. World Craft se encuentra en desarrollo y
> todavía **no hay una versión instalable** para usar. Las funciones se marcan
> como **previstas** hasta que la issue que las implementa esté terminada y
> probada. Este manual se actualiza en la misma tarea que cada cambio visible.
>
> Hoy el proyecto ya tiene un **shell de escritorio** que se abre en el entorno
> de desarrollo: barra lateral con navegación, barra superior, tema Claro/Oscuro
> conmutable, una página de inicio con estado vacío y una **página de muestras
> solo para desarrollo**. También existe una **base de datos local** que se crea
> y se comprueba al arrancar, con **copias automáticas** y **restauración desde
> modo seguro**. Todavía no hay mundos, fichas, ajustes ni instalador, y la
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

### 2.1 Requisitos (previstos)

- Windows 10 u 11 de 64 bits.
- Al menos 4 GB de memoria RAM y 500 MB libres en disco.
- Una ventana de al menos 1024×700 píxeles; se recomienda 1280×800 o más.
- No hace falta conexión a Internet para trabajar.

### 2.2 Instalación (prevista)

1. Descarga el instalador desde la página de releases del proyecto.
2. Ejecuta el instalador. Windows puede mostrar un aviso de SmartScreen porque
   el instalador no está firmado; se explica en la sección 13.
3. Elige la carpeta de instalación o acepta la propuesta.
4. Abre World Craft desde el menú Inicio.

La instalación es por usuario y no requiere permisos de administrador.

### 2.3 Primer arranque

La primera vez, la aplicación crea su carpeta de datos y una base de datos nueva
con la estructura inicial en tu equipo. Antes de abrir la ventana comprueba que
la base está en buen estado y, si hay que actualizar su estructura, guarda antes
una copia de seguridad.

Cuando exista la versión instalable, el primer arranque mostrará además una
pantalla de bienvenida con la opción de crear tu primer mundo o importar uno
existente. Esa pantalla es **prevista**: todavía no existe.

### 2.4 Estado actual del desarrollo

El proyecto ya permite abrir la ventana de la aplicación en un entorno de
desarrollo, pero **todavía no existe un programa instalable**. Esa ventana ya
tiene el aspecto definitivo en lo básico: una barra lateral con navegación, una
barra superior, dos temas de color y componentes de interfaz ya creados (botones,
campos, insignias, tarjetas, diálogos, pestañas, avisos y ayudas emergentes).

La aplicación ya crea y comprueba su base de datos local, guarda copias
automáticas y sabe arrancar en **modo seguro** si algo va mal, ofreciendo
restaurar una copia. Por ahora **no se puede crear un mundo**, guardar contenido
ni cambiar ajustes. El botón «Crear mundo» de la página de inicio todavía avisa
de que la función llegará en una próxima versión. Cuando haya una versión
instalable, esta sección explicará cómo conseguirla y qué esperar del primer
arranque.

## 3. La ventana

### 3.1 Partes de la pantalla

Estas partes ya existen en el entorno de desarrollo:

- **Barra lateral:** contiene el nombre de la aplicación, la navegación entre
  **Inicio** y **Muestras**, y un botón para plegarla. Expandida ocupa 240 px y
  plegada 64 px; al plegarla quedan los iconos.
- **Barra superior:** muestra el nombre de la pantalla actual y el botón de
  tema.
- **Área central:** el contenido de la pantalla. Es el destino del enlace
  «Saltar al contenido principal» que aparece al empezar a usar el teclado.

Siguen **previstas**, para cuando existan mundos y fichas:

- **Mundos y fichas** en la barra lateral, además de mapas, escritura, juego,
  búsqueda y ajustes.
- **Barra superior con el nombre del mundo** y la búsqueda.
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
- En un diálogo, el foco se queda dentro mientras está abierto y `Escape` lo
  cierra.
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
sin desplazamiento horizontal de página; la comprobación visual completa llegará
con la fase de pruebas de la interfaz. Solo las tablas y el lienzo del mapa
podrán desplazarse dentro de su propio espacio. **Hoy la ventana aún no recuerda
su tamaño ni su posición**: se abre con un tamaño inicial de 1280×800 y esa
memoria llegará en una actualización posterior.

### 3.5 Qué se ve al abrir

La aplicación abre en **Inicio**. Mientras no exista ningún mundo, la pantalla
explica que todavía no hay ninguno, ofrece el botón «Crear mundo» (que de momento
avisa de que la creación llegará más adelante) y resume lo que se podrá hacer con
el primer mundo: fichas, relaciones, mapas y manuscrito. Un aviso recuerda que
los datos se quedan en tu equipo.

La base de datos local se crea y se comprueba sola al arrancar; si hubiera un
problema, la aplicación avisa antes de abrir la ventana (sección 15).

## 4. Mundos (previsto)

- **Crear un mundo:** ponle nombre, sinopsis y, si quieres, una portada.
- **Abrir un mundo:** selecciónalo en la barra lateral.
- **Editar:** cambia nombre, sinopsis, géneros y portada.
- **Archivar:** oculta el mundo de la lista sin borrarlo.
- **Borrar:** lo mueve a la papelera; puedes restaurarlo.
- **Exportar:** genera un archivo ZIP con los datos y los archivos del mundo.
- **Importar:** añade un mundo desde un ZIP exportado.

## 5. Fichas y entidades (previsto)

Las fichas son la base del mundo: personajes, lugares, organizaciones, objetos,
criaturas, eventos y cualquier tipo que crees.

- **Crear una ficha:** elige el tipo, ponle nombre y rellena los campos.
- **Campos personalizados:** cada tipo puede tener sus propios campos.
- **Imagen:** añade una imagen principal; se guarda en tu equipo.
- **Etiquetas:** clasifica fichas con etiquetas de color.
- **Favoritos:** marca las fichas que más usas.
- **Papelera:** las fichas borradas se pueden restaurar.
- **Duplicar:** crea una copia para partir de una plantilla.

## 6. Relaciones y grafo (previsto)

- **Relaciones:** conecta dos fichas con un tipo («aliado de», «vive en»,
  «posee»). Cada relación puede tener nota e intensidad.
- **Grafo:** visualiza las relaciones como un mapa de nodos.
- **Filtros:** muestra solo ciertos tipos o etiquetas.
- **Encuadre:** acerca, aleja y centra el grafo.
- **Abrir ficha:** haz doble clic en un nodo para abrir su ficha.

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

## 10. Búsqueda (previsto)

- **Búsqueda global:** busca en fichas, mapas, escenas y tablas.
- **Filtros:** por mundo, tipo y etiqueta.
- **Resultados:** muestra el contexto y abre el elemento.
- **Reconstruir índice:** desde Ajustes → Datos si los resultados no cuadran.

## 11. Ajustes (previsto)

- **Apariencia:** tema Claro u Oscuro; se aplica a toda la aplicación. Hoy el
  tema ya se cambia desde la barra superior, pero **todavía no se guarda** entre
  sesiones: elegirlo y recordarlo será parte de esta pantalla.
- **Idioma:** español en el MVP; la estructura está preparada para más idiomas.
- **Ventana:** recordar tamaño y posición.
- **Datos:** abrir carpetas, verificar la base, reconstruir la búsqueda,
  compactar y eliminar todos los datos.
- **Copias:** dentro de Ajustes → Datos, crear, verificar y restaurar copias. La
  restauración desde el aviso de modo seguro ya existe (sección 12.3); esta
  pantalla, con la copia manual y la elección de carpeta, es prevista.
- **Actualizaciones:** buscar, descargar e instalar; se puede desactivar.
- **Ayuda:** abrir este manual y exportar un diagnóstico.

## 12. Tus datos y las copias

### 12.1 Dónde están tus datos

- Todo se guarda en tu equipo, en la carpeta de datos de World Craft
  (`%APPDATA%\World Craft`). La base de datos está en la subcarpeta `data` y se
  crea sola al arrancar. Las imágenes y los archivos están en `assets`.
- Actualizar o desinstalar la aplicación **no borrará** tus datos: la carpeta de
  datos queda fuera de la carpeta de instalación.
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
  (sección 2.1) y, cuando exista el instalador, el aviso de Windows (sección
  13). Si el problema continúa, conserva las carpetas y pide ayuda.
- Si la aplicación se queda en modo seguro después de una restauración, puede
  haber quedado un archivo de bloqueo o un resto de la operación anterior. Cierra
  la aplicación, vuelve a abrirla y prueba otra copia. En casos excepcionales,
  con la aplicación cerrada, se puede borrar el archivo `data/.restore.lock`;
  no es un archivo con tus datos. **No borres `data/.restore.pending`**: es el
  marcador que impide crear una base vacía; si está presente, prueba otra copia
  o pide ayuda.

## 13. Aviso de SmartScreen (previsto)

El instalador del MVP no está firmado con un certificado de código. Windows
puede mostrar un aviso azul de SmartScreen. Para continuar:

1. Comprueba que has descargado el instalador desde la página oficial del
   proyecto.
2. Pulsa «Más información».
3. Pulsa «Ejecutar de todas formas».

La firma de código es opcional y de pago; se valorará más adelante. El aviso no
significa que la aplicación tenga un problema.

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
| La app no arranca | Comprueba los requisitos (sección 2.1) y, cuando exista el instalador, revisa el aviso de Windows (sección 13). No borres la carpeta de datos ni la de copias; conserva ambas y pide ayuda. |
| No encuentro una ficha | Previsto: revisa la papelera y reconstruye la búsqueda. |
| Una imagen no se ve | Previsto: comprueba que el archivo sigue en la carpeta de assets. La restauración de la base no sustituye las imágenes. |
| Windows avisa al instalar | Es SmartScreen por falta de firma; sigue la sección 13. |
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
| Barra superior con el título y el botón de tema | Implementada (en desarrollo) |
| Tema Claro/Oscuro conmutable | Implementado (en desarrollo); no se recuerda al reiniciar |
| Componentes base (botones, campos, avisos, diálogos...) | Implementados (en desarrollo) |
| Página de inicio con estado vacío | Implementada (en desarrollo); «Crear mundo» avisa de que llegará |
| Página de muestras | Solo en desarrollo; no es una función de producto |
| Base de datos local y comprobación al arrancar | Implementada (en desarrollo) |
| Aviso de modo seguro con restauración y apertura de la carpeta de copias | Implementada (en desarrollo) |
| Copia automática antes de cambiar la estructura de datos | Implementada (en desarrollo) |
| Copias automáticas diarias, semanales y mensuales | Implementadas (en desarrollo); retención 7/4/12 |
| Restauración desde el aviso de modo seguro | Implementada (en desarrollo); la pantalla de Ajustes llega en una etapa posterior |
| Instalador y aplicación | Prevista |
| Mundos | Prevista |
| Fichas y tipos | Prevista |
| Relaciones y grafo | Prevista |
| Mapas | Prevista |
| Escritura | Prevista |
| Juego | Prevista |
| Búsqueda | Prevista |
| Ajustes | Prevista |
| Guardar la preferencia de tema | Prevista (con Ajustes) |
| Copias manuales y elección de carpeta | Prevista (con Ajustes) |
| Actualizaciones | Prevista |
| Manual dentro de la app | Prevista |

Este manual se actualizará cuando cada función esté disponible. Mientras una
función figure como **prevista**, no se debe presentar como si ya existiera.
