# Manual de usuario de World Craft

> **Estado:** manual en construcción. World Craft se encuentra en desarrollo y
> todavía **no hay una versión instalable** para usar. Las funciones se marcan
> como **previstas** hasta que la issue que las implementa esté terminada y
> probada. Este manual se actualiza en la misma tarea que cada cambio visible.
>
> Hoy el proyecto tiene una **pantalla inicial de comprobación** que se abre en
> el entorno de desarrollo y una **base de datos local** que se crea y se
> comprueba al arrancar. Todavía no hay mundos, fichas ni ajustes, y la apariencia
> es provisional: el sistema de diseño y los temas llegarán más adelante.

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
desarrollo, pero **todavía no existe un programa instalable**. Esa ventana solo
muestra una pantalla de bienvenida técnica con el nombre y la versión; sirve
para comprobar que la base de la aplicación arranca correctamente.

La aplicación ya crea y comprueba su base de datos local, y sabe arrancar en
**modo seguro** si algo va mal. Por ahora no se puede crear un mundo, guardar
contenido ni cambiar ajustes. Cuando haya una versión instalable, esta sección
explicará cómo conseguirla y qué esperar del primer arranque.

## 3. La ventana

### 3.1 Partes de la pantalla (previstas)

- **Barra lateral:** acceso a mundos, fichas, mapas, escritura, juego, búsqueda
  y ajustes. Se puede plegar a iconos.
- **Barra superior:** nombre del mundo, búsqueda y acciones de la pantalla.
- **Área central:** el contenido de la pantalla actual.
- **Paneles:** detalles, filtros o propiedades, según la pantalla.
- **Barra de estado:** guardado, avisos y mensajes.

### 3.2 Tamaño de ventana

La ventana se puede redimensionar y el tamaño mínimo es 1024×700. A 1024, 1280 y
1600 píxeles de ancho el contenido se adapta sin desplazamiento horizontal de
página; solo las tablas y el lienzo del mapa pueden desplazarse dentro de su
propio espacio. **Hoy la ventana aún no recuerda su tamaño ni su posición**: se
abre con un tamaño inicial de 1280×800 y esa memoria llegará en una actualización
posterior.

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

- **Apariencia:** tema Claro u Oscuro; se aplica a toda la aplicación.
- **Idioma:** español en el MVP; la estructura está preparada para más idiomas.
- **Ventana:** recordar tamaño y posición.
- **Datos:** abrir carpetas, verificar la base, reconstruir la búsqueda,
  compactar y eliminar todos los datos.
- **Copias:** crear, verificar y restaurar copias.
- **Actualizaciones:** buscar, descargar e instalar; se puede desactivar.
- **Ayuda:** abrir este manual y exportar un diagnóstico.

## 12. Tus datos y las copias

- Todo se guarda en tu equipo, en la carpeta de datos de World Craft
  (`%APPDATA%\World Craft`). La base de datos está en la subcarpeta `data` y se
  crea sola al arrancar.
- Actualizar o desinstalar la aplicación **no borrará** tus datos: la carpeta de
  datos queda fuera de la carpeta de instalación.
- Antes de cambiar la estructura de la base, la app guarda una copia de
  seguridad verificable en la subcarpeta `backups`. Si la copia no se puede
  crear o comprobar, no se cambia nada.
- Las copias automáticas diarias, semanales y mensuales, la restauración guiada
  desde Ajustes → Copias y la exportación de un mundo completo son **previstas**:
  todavía no están disponibles. La restauración guiada llegará en una próxima
  etapa del desarrollo.
- No hay sincronización automática entre equipos ni subida de datos a Internet.
- Mientras no exista la restauración guiada, si la app avisa de un problema,
  **no borres la carpeta de datos ni la de copias**: son la vía para recuperar tu
  información cuando la restauración esté disponible.

## 13. Aviso de SmartScreen (previsto)

El instalador del MVP no está firmado con un certificado de código. Windows
puede mostrar un aviso azul de SmartScreen. Para continuar:

1. Comprueba que has descargado el instalador desde la página oficial del
   proyecto.
2. Pulsa «Más información».
3. Pulsa «Ejecutar de todas formas».

La firma de código es opcional y de pago; se valorará más adelante. El aviso no
significa que la aplicación tenga un problema.

## 14. Accesibilidad (previsto)

- Navegación completa por teclado.
- Foco visible en todos los controles.
- Contraste mínimo WCAG AA en los dos temas.
- Etiquetas y errores asociados en formularios.
- Avisos de guardado y cambios con `aria-live`.
- Respeto de `prefers-reduced-motion`: las animaciones se reducen o se
  desactivan.
- Los atajos de teclado se documentarán en la ayuda de la app.

## 15. Problemas frecuentes

Algunos avisos ya existen en el estado actual del desarrollo; otros llegarán con
las funciones correspondientes.

| Problema | Qué hacer |
|---|---|
| La app avisa de que ha arrancado en modo seguro | El aviso explica el motivo y ofrece tres opciones: **Abrir carpeta de copias**, **Continuar en modo seguro** (sin escribir en tus datos) o **Salir**. La restauración guiada todavía no está disponible; no borres la carpeta de copias. |
| La base no abre | La app arranca en modo seguro sin modificar el archivo. Conserva la carpeta de datos y las copias; la restauración guiada llegará en una próxima etapa. |
| La app no arranca | Comprueba los requisitos y, cuando exista el instalador, revisa el aviso de Windows. |
| No encuentro una ficha | Previsto: revisa la papelera y reconstruye la búsqueda. |
| Una imagen no se ve | Previsto: comprueba que el archivo sigue en la carpeta de assets. |
| Windows avisa al instalar | Es SmartScreen por falta de firma; sigue la sección 13. |
| He borrado un mundo | Previsto: restáuralo desde la papelera o desde una copia. |

## 16. Glosario

- **Mundo:** contenedor de todo el contenido de una ambientación.
- **Ficha o entidad:** personaje, lugar, objeto o concepto del mundo.
- **Relación:** vínculo entre dos fichas.
- **Grafo:** representación visual de las relaciones.
- **Asset:** archivo (imagen, documento) asociado a un mundo.
- **Manuscrito:** conjunto de textos organizados en libros, capítulos y escenas.
- **Copia:** archivo de seguridad de la base y, opcionalmente, de los assets.
- **Modo seguro:** arranque sin escritura para diagnosticar el problema y abrir
  la carpeta de copias sin modificar tus datos.

## 17. Estado de las funciones

| Función | Estado |
|---|---|
| Pantalla inicial de comprobación | Solo en desarrollo |
| Base de datos local y comprobación al arrancar | Implementada (en desarrollo) |
| Aviso de modo seguro con apertura de la carpeta de copias | Implementada (en desarrollo) |
| Copia automática antes de cambiar la estructura de datos | Implementada (en desarrollo) |
| Instalador y aplicación | Prevista |
| Mundos | Prevista |
| Fichas y tipos | Prevista |
| Relaciones y grafo | Prevista |
| Mapas | Prevista |
| Escritura | Prevista |
| Juego | Prevista |
| Búsqueda | Prevista |
| Ajustes y temas | Prevista |
| Copias automáticas y restauración guiada | Prevista (M0-07) |
| Actualizaciones | Prevista |
| Manual dentro de la app | Prevista |

Este manual se actualizará cuando cada función esté disponible. Mientras una
función figure como **prevista**, no se debe presentar como si ya existiera.
