# Plan de desarrollo de World Craft

> **Estado:** plan aprobado por el usuario el 18/11/2026 para el pivote a
> aplicación de escritorio.
> **Ámbito:** producto, arquitectura, datos, calidad y desglose de tareas. Este
> documento **no implementa** nada por sí mismo.
> **Decisiones:** cerradas el 18/11/2026; ver
> [`docs/registro-decisiones.md`](registro-decisiones.md) y
> [`docs/adr/`](adr/README.md).
> **Cambio de etapa:** el plan web anterior (Next.js + Supabase + Vercel + R2)
> queda sustituido. El detalle de lo eliminado y de las cuentas que hay que
> cerrar está en [`docs/cambio-a-escritorio.md`](cambio-a-escritorio.md).

---

## 0. Resumen ejecutivo

World Craft será una **aplicación de escritorio instalable para Windows** con la
que una persona podrá crear mundos de ficción, organizar fichas y relaciones,
dibujar mapas, escribir novelas y usar herramientas de inspiración. Todo el
contenido se guarda **en el propio equipo**, sin cuentas, sin servidores y sin
suscripciones.

La propuesta técnica es:

| Capa | Decisión |
|---|---|
| Shell de escritorio | **Electron + Vite + React + TypeScript estricto** |
| UI | **Tailwind CSS 4 + shadcn/ui + Radix + Lucide + Motion** |
| Persistencia | **SQLite local con better-sqlite3 + Drizzle ORM** |
| Búsqueda | **SQLite FTS5** |
| Archivos | **Sistema de archivos local** bajo `app.getPath('userData')` |
| Mapas | **MapLibre GL JS + Terra Draw + GeoJSON** |
| Grafo | **React Flow (`@xyflow/react`) + ELK.js** |
| Editor | **Tiptap 3 (núcleo MIT) + extensiones propias** |
| Instalador | **electron-builder + NSIS** |
| Actualizaciones | **electron-updater + GitHub Releases** |
| Pruebas | **Vitest + Testing Library + Playwright Electron + axe-core** |
| Distribución | **GitHub Releases**; sin tienda ni servicio de pago |

El coste objetivo es **0 €/mes**. La aplicación no depende de ningún servicio en
la nube: GitHub solo aloja el código y las releases, y la comprobación de
actualizaciones es opcional. La firma de código de Windows queda como mejora
opcional y requiere decisión y ADR porque no es gratuita.

El desarrollo se organiza en **seis fases** (M0 a M5) y un backlog. El punto de
partida es la limpieza del repositorio web y la creación de una base de
escritorio verificable: ventana segura, base de datos local, migraciones,
copias, IPC tipado, sistema de diseño, instalador y CI. Solo después se añade
producto.

---

## 1. Visión y alcance

### 1.1 Problema y propuesta de valor

Una persona que escribe ficción suele repartir su trabajo entre documentos,
hojas de cálculo, carpetas de imágenes, herramientas de mapas y notas sueltas.
World Craft unifica:

- **La enciclopedia del mundo:** fichas tipadas, relaciones, etiquetas, imágenes
  y búsqueda.
- **La geografía:** mapas vectoriales con marcadores vinculados a fichas.
- **La escritura:** manuscritos estructurados en libros, capítulos y escenas,
  con herramientas específicas para novela.
- **La inspiración:** tiradas de dados y tablas que proponen contenedores,
  subgéneros, detonantes y tópicos literarios.

La propuesta no es competir con herramientas colaborativas o wikis públicas. Es
una herramienta **personal, privada, rápida, offline y sin coste**, con datos
portables y una experiencia cuidada.

### 1.2 Usuarios

| Usuario | Necesidad principal |
|---|---|
| Autor (usuario único) | Crear varios mundos, escribir novelas y consultar su propio material sin fricción ni conexión. |

No hay registro, ni perfiles, ni invitaciones, ni permisos por mundo, ni
colaboración. El equipo es la unidad de confianza: quien usa la sesión de
Windows puede abrir la aplicación y sus datos.

### 1.3 Principios de producto

1. **Local por defecto.** Los datos viven en el equipo. No hay nube obligatoria.
2. **Offline de verdad.** La aplicación arranca, lee y escribe sin Internet.
3. **Los datos nunca se pierden.** Actualizar o reinstalar no toca la carpeta de
   datos; las migraciones y operaciones destructivas dejan copia.
4. **Datos portables.** Exportar e importar un mundo completo en JSON + assets.
5. **Rápido y silencioso.** Sin recargas, sin esperas de red y sin telemetría.
6. **Accesible.** WCAG AA, teclado, foco visible y movimiento reducido.
7. **Estética editorial.** Papel, tinta, cartografía y tipografía con carácter.
8. **Gratuito y sostenible.** Dependencias y servicios justificados; 0 €/mes.

### 1.4 Alcance del MVP

El MVP debe permitir, como mínimo:

- Instalar la aplicación en Windows con un instalador y conservar los datos al
  actualizar o reinstalar.
- Crear varios mundos con portada, descripción y estado.
- Crear fichas de distintos tipos (personajes, lugares, ciudades, naciones,
  culturas, razas, organizaciones, religiones, magia, objetos, criaturas,
  idiomas, eventos, etc.) con campos personalizados, imágenes, etiquetas y texto
  enriquecido.
- Relacionar fichas entre sí y navegar las relaciones en una vista de grafo.
- Crear mapas vectoriales con capas, formas, líneas, puntos, etiquetas y
  marcadores vinculados a fichas; exportar el mapa en SVG/PNG.
- Escribir una novela estructurada en libros, capítulos y escenas, con
  autoguardado, modo diálogo, modo concentración, objetivos y estadísticas.
- Exportar el manuscrito a DOCX, PDF, EPUB y Markdown; importar DOCX/Markdown.
- Tirar dados y generar propuestas con tablas de contenedores, subgéneros,
  detonantes y tópicos literarios, guardando las sesiones.
- Buscar globalmente y navegar con una paleta de comandos.
- Usar la app en los dos temas, con accesibilidad AA.
- Exportar/importar mundos, crear copias de seguridad y restaurarlas.

### 1.5 Fuera de alcance

- Versión web, PWA, aplicación móvil o tablet.
- Cuentas, autenticación, allowlist, roles por mundo, invitaciones o
  colaboración en tiempo real.
- Wiki pública, comunidad, comentarios de lectores o perfiles públicos.
- Sincronización en la nube o backup remoto obligatorio.
- Servidores, bases de datos gestionadas, Docker o despliegues cloud.
- Pagos, suscripciones o marketplace.
- API pública para terceros.
- Calendarios fantásticos completos y líneas temporales avanzadas (backlog).
- Firma de código obligatoria en el MVP (mejora opcional con ADR).
- Aplicaciones para macOS o Linux en el MVP (el código no se cerrará a ello,
  pero no se prueba ni se distribuye).

### 1.6 Referencia: vvd.world

vvd.world ofrece organización de mundos, mapas interactivos, visualización de
conexiones, wiki personalizable y colaboración en tiempo real. World Craft toma
la **organización por fichas**, los **mapas interactivos** y la **visualización
de conexiones**, pero:

- Elimina la capa social y de comunidad.
- Sustituye la wiki pública por una experiencia privada de consulta.
- Añade un editor de novela más profundo y un generador de ideas con dados.
- Prioriza el coste cero, el funcionamiento offline y la portabilidad de datos.

No se copiará su diseño, textos, ilustraciones ni estructura de datos.

---

## 2. Requisitos

### 2.1 Requisitos funcionales

#### 2.1.1 Mundos

- Listar, crear, editar, archivar, duplicar, exportar e importar mundos.
- Campos: nombre, slug, resumen, descripción, portada, géneros, estado
  (borrador/en desarrollo/en pausa/completado), idioma, fechas de creación y
  actualización.
- Aislamiento estricto entre mundos en la interfaz y en las consultas.
- Dashboard del mundo con accesos rápidos, actividad reciente y progreso.

#### 2.1.2 Entidades y fichas

- Tipos del sistema: personaje, lugar, ciudad, nación, cultura, raza/especie,
  organización/facción, religión, deidad, sistema de magia, objeto/artefacto,
  criatura, idioma, evento, conflicto, tecnología, flora/fauna y concepto.
- Tipos personalizados por mundo, con icono, color y plantilla de campos.
- Campos: nombre, alias, resumen, descripción enriquecida, imagen principal,
  galería, etiquetas, atributos clave-valor tipados, estado, favorito y fechas.
- Autoguardado y creación rápida desde cualquier pantalla.
- Enlaces internos entre fichas y backlinks.
- Historial de cambios por ficha (al menos versiones de descripción).
- Papelera con restauración.

#### 2.1.3 Relaciones y grafo

- Relaciones tipadas y dirigidas (o bidireccionales) entre entidades: familiar,
  miembro de, ubicado en, aliado, enemigo, pertenece a, causó, participó en,
  etc.
- Etiqueta directa e inversa, notas, fuerza/importancia y metadatos.
- Vista de grafo interactiva: zoom, paneo, selección, búsqueda, filtros por
  tipo/relación, foco en un nodo, expansión de vecinos, diseño automático y
  posiciones manuales guardadas.
- Exportar el grafo a PNG/SVG.
- Acciones rápidas desde el grafo: abrir ficha, crear relación, ocultar tipos.

#### 2.1.4 Mapas

- Varios mapas por mundo (mundo, región, ciudad, interior).
- Editor vectorial: capas (terreno, agua, costas, rutas, regiones, puntos,
  etiquetas, iconos), polígonos, líneas, puntos, texto, estilos, orden Z,
  bloquear/ocultar capa.
- Imagen raster de fondo opcional y georreferenciada para calcar.
- Herramientas: seleccionar, mover, editar vértices, dibujar, borrar,
  deshacer/rehacer, duplicar, alinear, snap, medir distancias, escala y leyenda.
- Marcadores vinculados a entidades, con popup y enlace a la ficha.
- Pan/zoom fluido, atajos de teclado y rueda/arrastre de ratón.
- Exportar SVG (vectorial, sin pérdida), PNG (alta resolución) y GeoJSON;
  importar GeoJSON.
- Vista de solo lectura para consulta.

#### 2.1.5 Escritura

- Biblioteca de obras: novela, novella, relato, saga; estado y objetivo de
  palabras.
- Estructura: obra → partes/libros → capítulos → escenas.
- Editor de texto enriquecido con títulos, negrita, cursiva, citas, separadores
  de escena, listas y notas.
- **Modo diálogo:** detectar y formatear diálogos con raya, asignar hablante,
  autocompletar nombres de personajes y resaltar interlocutores.
- **Modo concentración:** ocultar el resto de la interfaz; **modo máquina de
  escribir** (la línea actual permanece centrada).
- Objetivos diarios/semanales, contador de palabras, estadísticas de sesión y
  racha.
- Buscar y reemplazar; corrector ortográfico nativo y diccionario personal.
- Notas de escena, POV, lugar, fecha de la historia y estado.
- Autoguardado local con recuperación tras cierre inesperado.
- Historial de versiones por escena y restauración.
- Exportar a DOCX, PDF, EPUB y Markdown con formato de manuscrito; importar DOCX
  y Markdown.
- Modo lectura/impresión.

#### 2.1.6 Juego de inspiración

- Tirada de dados con notación estándar (`1d20`, `2d6+1`, etc.) y resultados
  reproducibles mediante semilla.
- Tablas de contenido: **contenedores**, **subgéneros**, **detonantes** y
  **tópicos literarios**, con pesos, etiquetas y variantes.
- Flujo «inspiración»: combinar una tirada de cada categoría, bloquear/rerolear
  resultados y guardar la combinación como semilla de historia.
- Historial de sesiones y posibilidad de vincular una semilla a un mundo.
- Tablas personalizadas por el usuario y edición de contenido.
- Contenido inicial en español, con tono y nivel de edad configurables.

#### 2.1.7 Búsqueda y navegación

- Búsqueda global en mundos, fichas, relaciones, mapas, manuscritos y escenas.
- Búsqueda por prefijo y difusa con FTS5; filtros por mundo, tipo, etiqueta y
  estado.
- Paleta de comandos (`Ctrl + K`) para navegar, crear y ejecutar acciones.
- Recientes y favoritos.
- Resultados con resaltado y navegación por teclado.

#### 2.1.8 Ajustes y datos

- Tema (claro/oscuro), densidad, tamaño de fuente del editor, idioma de la
  interfaz (español en MVP), atajos.
- Exportar un mundo completo (JSON + assets) e importarlo.
- Exportar todos los datos y eliminarlos con confirmación.
- Gestión de almacenamiento y borrado de assets huérfanos.
- Abrir la carpeta de datos y la carpeta de copias desde la aplicación.
- Comprobar actualizaciones manualmente y configurar la comprobación automática.

#### 2.1.9 Ayuda y documentación

- Manual de usuario en `docs/manual-de-usuario.md`, enlazado desde la app.
- Onboarding breve para el primer mundo.
- Tooltips y textos de ayuda contextuales.
- Página de novedades/cambios.

### 2.2 Requisitos no funcionales

| Requisito | Criterio |
|---|---|
| Plataforma | Windows 10/11 x64; instalable con NSIS; sin dependencia de navegador. |
| Ventana | Mínimo 1024×700; sin scroll horizontal de página a 1024, 1280 y 1600 px; tamaño y posición recordados. |
| Datos | SQLite local con WAL; assets en el sistema de archivos; actualizar/reinstalar no borra datos. |
| Offline | Arranque, lectura y escritura sin Internet; actualizaciones opcionales. |
| Temas | Dos modos (Claro y Oscuro) con contraste WCAG AA mínimo 4.5:1. |
| Accesibilidad | Teclado, foco visible, etiquetas ARIA, `prefers-reduced-motion`, axe sin errores críticos. |
| Rendimiento | Arranque < 3 s en un equipo medio; mapa de 500 elementos a 60 fps; grafo de 200 nodos < 2 s; búsqueda < 150 ms en 10.000 fichas. |
| Privacidad | Sin telemetría, sin cuentas, sin subida de datos; exportación y borrado local. |
| Seguridad | Contexto aislado, sandbox, IPC validado, CSP, sin contenido remoto, assets con protocolo seguro. |
| Portabilidad | Exportación JSON + assets, GeoJSON, Markdown; SQLite estándar; migraciones versionadas. |
| Mantenibilidad | TypeScript estricto, lint/format, tests, ADRs, módulos por dominio, dependencias justificadas. |
| Coste | 0 €/mes en servicios; firma de código opcional con ADR. |
| Idioma | Interfaz y contenido inicial en español; textos centralizados para i18n futura. |

---

## 3. Arquitectura técnica

### 3.1 Vista general

```text
┌────────────────────────────────────────────────────────────────────┐
│ Proceso principal de Electron                                     │
│  ├─ Ventana segura (contextIsolation, sandbox, sin Node en renderer)│
│  ├─ SQLite (better-sqlite3) + Drizzle + migraciones + FTS5         │
│  ├─ Assets locales + protocolo wc-asset:// validado                │
│  ├─ Copias de seguridad, exportación/importación y restauración    │
│  ├─ Instalador/actualizador (electron-updater + GitHub Releases)   │
│  └─ IPC tipado y validado con Zod                                  │
└───────────────────────────────┬────────────────────────────────────┘
                                │ preload + contextBridge
┌───────────────────────────────▼────────────────────────────────────┐
│ Renderer (React 19 + Vite + TypeScript)                            │
│  ├─ Shell de escritorio, navegación y paleta de comandos           │
│  ├─ Fichas, relaciones, grafo (React Flow + ELK)                   │
│  ├─ Mapas (MapLibre + Terra Draw)                                  │
│  ├─ Editor (Tiptap) y exportadores                                 │
│  └─ Juego, ajustes y ayuda                                         │
└────────────────────────────────────────────────────────────────────┘
```

**Flujo típico:** el renderer llama a `window.worldCraft.<dominio>.<acción>`; el
preload envía un mensaje IPC con canal allowlisted; el proceso principal valida
la entrada con Zod, ejecuta la operación en SQLite o en el sistema de archivos y
devuelve un resultado tipado (`{ ok, data }` o `{ ok, error }`). El renderer
nunca ve rutas absolutas, handles de base de datos ni errores internos.

### 3.2 Decisiones y alternativas

Las puntuaciones son orientativas (1-5) y ponderan el contexto: uso personal,
coste cero, calidad, rapidez de desarrollo, mantenibilidad y encaje con las
funciones interactivas.

#### D1. Shell de escritorio: Electron

| Criterio | Electron | Tauri 2 | .NET/WPF | Avalonia |
|---|---:|---:|---:|---:|
| Ecosistema React para editor/grafo/mapas | 5 | 4 | 1 | 1 |
| Madurez y documentación | 5 | 3 | 5 | 4 |
| Facilidad de instalación en Windows | 5 | 4 | 4 | 4 |
| Tamaño de instalación | 2 | 5 | 4 | 4 |
| Seguridad y aislamiento | 3 | 4 | 4 | 4 |
| **Total** | **20** | **20** | **18** | **17** |

**Decisión:** Electron + Vite + React + TypeScript. El ecosistema React es
decisivo para Tiptap, React Flow, MapLibre, dnd-kit y shadcn/ui. Electron tiene
el instalador, la actualización y el soporte de SQLite nativo más maduros para
Windows. El coste es un instalador más grande (~100 MB); se mitiga con
`asar`, compresión y sin dependencias innecesarias. Tauri se reevalúa si el
tamaño o el consumo de memoria se vuelven un problema, pero cambiaría el runtime
y el acceso a SQLite.

#### D2. UI: Tailwind CSS + shadcn/ui

| Criterio | Tailwind + shadcn/ui | MUI | Chakra | Mantine | CSS Modules |
|---|---:|---:|---:|---:|---:|
| Control visual y estética propia | 5 | 3 | 3 | 4 | 4 |
| Accesibilidad de primitivas | 5 | 4 | 4 | 4 | 2 |
| Temas múltiples con tokens | 5 | 3 | 3 | 4 | 4 |
| Peso y dependencias | 5 | 2 | 3 | 3 | 5 |
| Velocidad de desarrollo | 5 | 4 | 4 | 4 | 2 |
| **Total** | **25** | **16** | **17** | **19** | **17** |

**Decisión:** Tailwind CSS 4 + shadcn/ui (Radix) + Lucide + Motion. shadcn/ui no
es una dependencia monolítica: los componentes se copian al repositorio y se
adaptan. Encaja con una estética editorial propia y con los dos temas.

#### D3. Persistencia: SQLite + better-sqlite3

| Criterio | SQLite + better-sqlite3 | node:sqlite | libSQL | JSON/lowdb | IndexedDB | PGlite |
|---|---:|---:|---:|---:|---:|---:|
| Modelo relacional y consultas | 5 | 4 | 5 | 1 | 2 | 5 |
| Búsqueda FTS5 | 5 | 4 | 5 | 1 | 1 | 4 |
| Madurez y herramientas | 5 | 3 | 4 | 3 | 4 | 3 |
| Integración con Electron | 5 | 4 | 3 | 5 | 3 | 4 |
| Copias y portabilidad | 5 | 4 | 4 | 5 | 2 | 3 |
| **Total** | **25** | **19** | **21** | **15** | **12** | **19** |

**Decisión:** SQLite con `better-sqlite3` y Drizzle ORM. SQLite es un formato
abierto, un único archivo, transaccional y con FTS5 integrado. `better-sqlite3`
es síncrono, rápido y maduro en Electron; las operaciones se ejecutan en el
proceso principal y las exportaciones largas en un utility process. `node:sqlite`
es una alternativa nativa interesante, pero su API y su empaquetado con
Electron aún son menos predecibles. Se descarta JSON para el modelo principal
por integridad referencial, consultas y búsqueda.

#### D4. ORM y validación: Drizzle + Zod

| Criterio | Drizzle | Prisma |
|---|---:|---:|
| SQLite y control de migraciones | 5 | 4 |
| Tipos precisos sin motor | 5 | 4 |
| Ligeros y empaquetado con Electron | 5 | 2 |
| Facilidad de consultas relacionales | 4 | 5 |
| Madurez | 4 | 5 |
| **Total** | **23** | **20** |

**Decisión:** Drizzle ORM + Zod. Drizzle genera SQL comprensible, tipos precisos
y migraciones versionadas sin un motor externo; encaja con SQLite y con el
empaquetado de Electron. Zod se comparte entre formularios, IPC, importación y
validación de datos.

#### D5. Instalador y actualizaciones

| Criterio | electron-builder + NSIS | Squirrel.Windows | MSIX | WiX |
|---|---:|---:|---:|---:|
| Instalador por usuario sin admin | 5 | 5 | 3 | 2 |
| Actualización automática | 5 | 5 | 3 | 2 |
| Control del proceso y del formato | 5 | 4 | 3 | 4 |
| Madurez con Electron | 5 | 4 | 3 | 1 |
| Coste | 5 | 5 | 4 | 5 |
| **Total** | **25** | **23** | **16** | **14** |

**Decisión:** `electron-builder` con target **NSIS** por usuario, instalación en
`%LOCALAPPDATA%\Programs\World Craft`, sin privilegios de administrador, con
opción de cambiar la carpeta. `electron-updater` con GitHub Releases y
`latest.yml`. La actualización descarga en segundo plano y se instala al
reiniciar, siempre con consentimiento; nunca toca `userData`. Se descarta MSIX
por complejidad de firma y de sideloading, y Squirrel por menor control del
instalador.

#### D6. Archivos: sistema de archivos local

**Decisión:** los assets viven en `%APPDATA%\World Craft\assets\` con una
estructura por mundo y asset (`worlds/<worldId>/<assetId>.<ext>`). La base de
datos guarda la ruta relativa, el MIME, el tamaño y el hash; nunca rutas
absolutas. El renderer los carga con el protocolo `wc-asset://asset/<assetId>`,
registrado en el proceso principal, que valida la ruta y sirve solo archivos
dentro de la carpeta de datos. Se descarta `file://` por seguridad y por
portabilidad. Las imágenes se re-codifican a WebP con `sharp` y se generan
miniaturas.

#### D7. Mapas: MapLibre GL JS + Terra Draw

| Criterio | MapLibre + Terra Draw | SVG propio | Fabric.js | tldraw | Leaflet + Geoman |
|---|---:|---:|---:|---:|---:|
| Datos vectoriales nativos | 5 | 5 | 4 | 4 | 4 |
| Herramientas de dibujo listas | 5 | 1 | 4 | 4 | 4 |
| Rendimiento con muchos elementos | 5 | 2 | 3 | 4 | 4 |
| Pan/zoom de ratón | 5 | 3 | 4 | 5 | 4 |
| Exportación SVG sin pérdida | 4 | 5 | 4 | 4 | 3 |
| Libertad de licencia/coste | 5 | 5 | 5 | 3 | 5 |
| **Total** | **29** | **21** | **24** | **24** | **24** |

**Decisión:** MapLibre GL JS + Terra Draw, con datos en **GeoJSON**. Terra Draw
aporta modos de dibujo (punto, línea, polígono, rectángulo, círculo, freehand,
selección y edición de vértices) y adaptador oficial para MapLibre. La
exportación SVG se implementa con un serializador propio sobre las capas
GeoJSON; PNG con el canvas de MapLibre. Riesgo: el estilo de mapas fantásticos y
la exportación SVG requieren trabajo; se valida en un **spike** antes de
comprometer el editor completo.

#### D8. Grafo: React Flow + ELK.js

| Criterio | React Flow | Cytoscape.js | Sigma.js | D3 |
|---|---:|---:|---:|---:|
| Integración con React | 5 | 2 | 2 | 3 |
| Nodos personalizados | 5 | 3 | 2 | 3 |
| Rendimiento a gran escala | 3 | 5 | 5 | 4 |
| Facilidad de uso | 5 | 3 | 2 | 2 |
| Licencia/coste | 5 | 5 | 5 | 5 |
| **Total** | **23** | **18** | **16** | **17** |

**Decisión:** React Flow 12 + ELK.js para layout automático. Los nodos son
componentes React (avatar, tipo, color, acciones). Para mundos personales,
cientos de nodos son manejables; si se superan ~1.000, se añaden filtros,
agrupación y carga bajo demanda.

#### D9. Editor: Tiptap 3 + extensiones propias

| Criterio | Tiptap | Lexical | Slate | CodeMirror/Markdown |
|---|---:|---:|---:|---:|
| Madurez y ecosistema | 5 | 4 | 3 | 5 |
| Extensiones y personalización | 5 | 4 | 4 | 4 |
| Integración React | 5 | 4 | 3 | 4 |
| Editor de novela (diálogos, estructura) | 5 | 3 | 4 | 3 |
| Coste de licencia | 4 | 5 | 5 | 5 |
| **Total** | **24** | **20** | **19** | **21** |

**Decisión:** Tiptap 3 (núcleo MIT) sobre ProseMirror. Se implementan
extensiones propias para modo diálogo, menciones a personajes, separadores de
escena y contadores. Las extensiones Pro (comentarios, historial, colaboración)
**no se contratan**: el historial se implementa con snapshots propios y la
colaboración queda fuera del MVP. El contenido se guarda como JSON de
ProseMirror + texto plano para búsqueda/exportación.

#### D10. Estado, formularios y contratos

- **Zustand** para estado de UI de editor/mapa/grafo (selección, herramientas,
  paneles).
- **TanStack Query** solo si una vista necesita caché/optimistic updates; no se
  usa por defecto.
- **React Hook Form** para formularios complejos.
- **Zod** como única fuente de validación en renderer, IPC e importación.
- **IPC tipado** para todas las mutaciones y consultas; no hay acceso directo a
  la base de datos desde el renderer.

#### D11. Pruebas y calidad

- **Vitest** para dominio, utilidades, esquema, migraciones, búsqueda y
  exportadores.
- **Testing Library** para componentes del renderer.
- **Playwright Electron** para E2E, ventana, temas y accesibilidad.
- **axe-core** para accesibilidad.
- **Pruebas de preservación de datos** en cada migración y en el instalador.
- **gitleaks** y `pnpm audit` en CI.

#### D12. Copias y recuperación

- Copia automática diaria de la base de datos y de los assets críticos.
- Rotación de copias (por ejemplo, 7 diarias, 4 semanales y 12 mensuales).
- Copia previa obligatoria a cada migración.
- Verificación de integridad (`PRAGMA integrity_check`) al arrancar y tras una
  restauración.
- Restauración desde la app con confirmación y copia de seguridad de la base
  actual antes de reemplazarla.
- Exportación de mundo completo en ZIP (JSON + assets) como copia de usuario.

#### D13. Temas y sistema de diseño

Se adoptan **dos modos**: Claro y Oscuro. Ambos usan variables CSS:

- Tema claro: `--paper` como superficie principal y `--ink` como texto.
- Tema oscuro: `--ink` como superficie y `--paper` como texto.

Tokens adicionales: `--surface`, `--surface-raised`, `--border`, `--muted`,
`--accent`, `--accent-strong`, `--success`, `--warning`, `--danger`, `--focus`.
Cada tipo de entidad tiene un color accesible en ambos modos. Los colores
hardcodeados deben justificarse con un comentario y comprobarse en los dos
temas.

**Dirección visual:** «taller de cartógrafo». Tipografía de display **Fraunces**
(serif con carácter), texto de interfaz **Inter** y monoespaciada **JetBrains
Mono** para datos. Paleta base papel/tinta con acentos tierra, musgo y ocre;
textura de papel sutil mediante SVG, sin gradientes morados genéricos.

#### D14. Idioma

Interfaz en español en el MVP. Todos los textos en un catálogo tipado (por
ejemplo, `src/messages/es.ts`), con acceso mediante un proveedor de idioma y
formatos `Intl`. La estructura queda preparada para añadir `en.ts` e `it.ts` sin
refactorizar componentes. Los identificadores de código y de base de datos van
en inglés; los comentarios y la documentación, en español.

#### D15. Estructura del repositorio

Aplicación única (no monorepo), organizada por procesos y dominios:

```text
src/
  main/           Proceso principal: ventana, SQLite, assets, backups, updates, IPC
  preload/        Puente tipado y allowlist de canales
  renderer/       React + Vite: shell, pantallas y componentes
    components/   ui/, shell/, editors/, maps/, graph/
    modules/      worlds/, entities/, relations/, maps/, graph/, writing/, game/, search/
    messages/     Catálogo tipado y proveedor de i18n
    styles/       Tokens, base y movimiento
  shared/         Tipos y contratos compartidos (sin Node ni React)
tests/
  unit/           Vitest (dominio, esquema, IPC, utilidades)
  integration/    SQLite temporal + migraciones + backups
  e2e/            Playwright Electron
docs/
  adr/ plan-desarrollo.md persistencia.md ...
```

Cada módulo expone su esquema Drizzle, sus casos de uso y sus componentes. No se
crean carpetas `utils` gigantes ni lógica de negocio en componentes de
presentación.

### 3.3 Modelo de datos

El modelo es relacional y local. Todas las tablas de contenido llevan
`world_id` directo o derivado para facilitar el borrado, la exportación y la
búsqueda por mundo.

```text
worlds
  ├─< entity_types
  ├─< entities >─< relations
  │      ├─ entity_tags >─ tags
  │      └─ assets
  ├─< maps >─< map_entity_links
  ├─< manuscripts >─< books >─< chapters >─< scenes >─< scene_versions
  ├─< game_tables >─< game_table_entries
  ├─< game_sessions
  └─< activity_log
game_content_packs >─ game_tables
app_settings
search_documents / search_fts (FTS5)
```

Tablas principales:

| Tabla | Campos clave |
|---|---|
| `app_settings` | `key` (pk), `value` json, `updated_at` |
| `worlds` | `id`, `name`, `slug`, `summary`, `description` json, `cover_asset_id`, `genres` json, `status`, `settings` json, `archived_at`, timestamps, `deleted_at` |
| `entity_types` | `id`, `world_id` (null = sistema), `key`, `name`, `icon`, `color`, `fields` json, `is_system` |
| `entities` | `id`, `world_id`, `type_id`, `name`, `slug`, `aliases` json, `summary`, `description` json, `description_text`, `image_asset_id`, `attributes` json, `status`, `is_favorite`, timestamps, `deleted_at` |
| `relation_types` | `id`, `world_id` (null = sistema), `key`, `name`, `inverse_name`, `color` |
| `relations` | `id`, `world_id`, `source_id`, `target_id`, `type_id`, `label`, `inverse_label`, `notes`, `strength`, `metadata` json, timestamps |
| `tags` / `entity_tags` | etiquetas por mundo con color; relación N:M con entidades |
| `assets` | `id`, `world_id`, `kind`, `relative_path`, `mime`, `size`, `width`, `height`, `alt`, `hash`, `created_at` |
| `maps` | `id`, `world_id`, `name`, `description`, `document` json (capas + GeoJSON), `style` json, `bounds` json, `thumbnail_asset_id`, timestamps, `deleted_at` |
| `map_entity_links` | `map_id`, `entity_id`, `feature_id`, `label`; índice inverso |
| `manuscripts` | `id`, `world_id`, `title`, `kind`, `synopsis`, `status`, `target_words`, `settings` json, timestamps, `deleted_at` |
| `books` | `id`, `manuscript_id`, `title`, `position` |
| `chapters` | `id`, `book_id`, `title`, `position`, `summary`, `status` |
| `scenes` | `id`, `chapter_id`, `title`, `position`, `content` json, `content_text`, `word_count`, `status`, `pov_entity_id`, `location_entity_id`, `story_date`, `notes`, timestamps, `deleted_at` |
| `scene_versions` | `id`, `scene_id`, `content` json, `content_text`, `word_count`, `label`, `created_at` |
| `game_tables` | `id`, `world_id` (null = global), `pack_id` (null = tabla suelta), `key`, `name`, `category`, `description`, `is_system`, `is_editable`, `version` |
| `game_table_entries` | `id`, `table_id`, `text`, `weight`, `tags` json, `metadata` json |
| `game_content_packs` | `id`, `name`, `version`, `description`, `author`, `license`, `metadata` json, `created_at` |
| `game_sessions` | `id`, `world_id`, `seed`, `results` json, `notes`, `created_at` |
| `activity_log` | `id`, `world_id`, `action`, `entity_type`, `entity_id`, `diff` json, `created_at` |
| `search_documents` | `id`, `world_id`, `kind`, `ref_id`, `title`, `body`, `updated_at` |
| `search_fts` | Tabla virtual FTS5 sobre `title` y `body`, sincronizada por triggers |

**Decisiones de modelado:**

- **JSON para contenido rico y atributos variables.** Permite campos
  personalizados sin migraciones por cada tipo; se valida con Zod.
- **Texto plano duplicado** en `entities.description_text` y
  `scenes.content_text` para búsqueda, exportación y estadísticas.
- **`position` real** para reordenar sin reescribir filas.
- **Borrado lógico** (`deleted_at`) en entidades, mapas, manuscritos y escenas;
  purga explícita desde la papelera.
- **Búsqueda:** FTS5 con tokenizador `unicode61` y prefijos; los documentos se
  reconstruyen desde la aplicación y triggers.
- **Timestamps** en milisegundos UTC; la interfaz muestra la zona local.
- **Migraciones** con Drizzle Kit, versionadas y revisables; nunca se edita una
  migración aplicada.

El diccionario completo, los índices y las reglas de integridad están en
[`docs/base-de-datos/esquema.md`](base-de-datos/esquema.md). La operación y las
migraciones, en [`docs/base-de-datos/migraciones.md`](base-de-datos/migraciones.md)
y [`docs/persistencia.md`](persistencia.md).

### 3.4 Datos en disco

```text
%APPDATA%\World Craft\            (app.getPath('userData'))
  ├─ data\
  │   └─ world-craft.sqlite       Base de datos principal
  │   └─ world-craft.sqlite-wal   WAL (se consolida al cerrar)
  ├─ assets\
  │   └─ worlds\<worldId>\<assetId>.<ext>
  ├─ backups\
  │   ├─ daily\ weekly\ monthly\
  │   └─ pre-migration\
  ├─ exports\
  ├─ logs\
  └─ config.json                 Ventana, tema, idioma y preferencias
```

- La carpeta de instalación (`%LOCALAPPDATA%\Programs\World Craft`) contiene
  solo binarios y recursos. Actualizar o desinstalar no toca `userData`.
- `config.json` guarda solo preferencias; los datos de producto están en SQLite.
- Los logs son locales, rotativos y sin contenido del usuario por defecto.
- La app permite abrir las carpetas de datos, copias y logs desde Ajustes.

### 3.5 Seguridad y privacidad

**Modelo de confianza:** un único usuario en un equipo Windows. No hay
autenticación de aplicación; la seguridad se centra en aislar el renderer,
validar IPC, proteger rutas y no ejecutar contenido no confiable.

1. **Proceso principal confiable; renderer no confiable.** `contextIsolation`,
   `sandbox`, `nodeIntegration: false`, `webSecurity: true`.
2. **Preload mínimo.** Solo expone funciones concretas; nunca `ipcRenderer`,
   `require` ni rutas absolutas.
3. **IPC allowlisted + Zod.** Cada canal tiene esquema de entrada y salida;
   errores internos se convierten en códigos estables.
4. **CSP estricta.** Sin `unsafe-eval`; estilos y scripts desde el bundle local;
   `img-src 'self' wc-asset: data:`.
5. **Sin contenido remoto.** `will-navigate` y `setWindowOpenHandler` bloquean
   navegación; los enlaces externos se abren con `shell.openExternal` solo para
   `https:`.
6. **Assets.** Protocolo propio, normalización de rutas, comprobación de que el
   destino está dentro de `assets/`, MIME y tamaño validados.
7. **Importación.** ZIP/JSON validados con Zod, límites de tamaño y de número de
   archivos, sin rutas absolutas ni `..`; se importa en una transacción y se
   copia a una carpeta temporal antes de publicar.
8. **Contenido rico.** Se guarda como JSON de ProseMirror y se sanea al
   exportar a HTML; nunca se inyecta HTML arbitrario.
9. **Dependencias.** Lockfile, `pnpm audit`, licencias compatibles y revisión
   de alternativas gratuitas.
10. **Secretos.** No hay claves de servicios en la aplicación. Si en el futuro
    se firma el instalador, el certificado vive fuera del repositorio y en
    GitHub Secrets.
11. **Privacidad.** Sin telemetría, sin cuentas, sin subida de datos. Las
    actualizaciones consultan GitHub Releases y no envían contenido.
12. **Datos.** La carpeta `userData` hereda los permisos del usuario de Windows;
    la app no la comparte por red ni la expone.

**Amenazas principales y mitigación:** XSS en el renderer (CSP + sanitización +
sin HTML arbitrario), escalado a Node (sandbox + preload mínimo), path traversal
en assets/importación (normalización + comprobación de prefijo), corrupción de
datos (WAL + transacciones + copias + integridad), pérdida por actualización
(instalador no toca userData + prueba de preservación), suplantación de
actualización (HTTPS + GitHub Releases + verificación de firma cuando exista).

### 3.6 Rendimiento

- Arranque: ventana visible antes de cargar datos; splash mínimo solo si la
  migración o la comprobación de integridad tarda.
- SQLite con WAL, `synchronous=NORMAL`, `busy_timeout` y consultas indexadas.
- Paginación por cursor en listas y búsqueda; virtualización de listas largas.
- Carga diferida de editor, mapa y grafo; no se montan hasta que se abren.
- Imágenes WebP con miniaturas; no se cargan originales en listas.
- Mapas: límite de features por capa, simplificación y capas ocultas no
  renderizadas.
- Grafo: filtros por tipo, expansión de vecinos, layout en Web Worker y límite
  de nodos visibles.
- Editor: debounce de autoguardado (1-2 s), diff de contenido y no serializar
  todo el manuscrito en cada tecla.
- Exportaciones y copias largas en un utility process para no bloquear la UI.

### 3.7 Ventana y accesibilidad

**Tamaños de referencia:** 1024×700 (mínimo), 1280×800 y 1600×900. Se prueba
también 1920×1080.

- Navegación: rail lateral en ventanas anchas y rail colapsado a iconos en
  ventanas estrechas; paneles redimensionables donde aporte valor.
- Editor: una columna central con panel de escena opcional; modo concentración
  a pantalla completa.
- Mapa: toolbar, panel de capas y panel de propiedades; controles de ratón y
  atajos.
- Grafo: botones de encuadre, panel de filtros y zoom con rueda.
- Tablas: scroll horizontal solo dentro de su contenedor.
- Textos largos: `overflow-wrap: break-word`, `min-width: 0` en hijos de
  flex/grid, sin truncar contenido esencial.
- Accesibilidad: HTML semántico, landmarks, foco visible, atajos documentados,
  contraste AA, `aria-live` para autoguardado, formularios con etiquetas y
  errores asociados, `prefers-reduced-motion`.

### 3.8 Distribución y actualizaciones

- **Repositorio:** GitHub público, licencia MIT, ramas `main` y `dev`.
- **Releases:** GitHub Releases con el instalador NSIS, `latest.yml` y los
  artefactos de bloqueo de versión.
- **Actualizaciones:** `electron-updater` consulta la release estable; descarga
  en segundo plano; el usuario decide cuándo reiniciar. Se puede desactivar.
- **Canales:** `latest` (estable) y, si hace falta, `beta` mediante pre-releases.
- **Firma:** el MVP se distribuye sin firmar. Windows SmartScreen puede mostrar
  un aviso; se documenta en el manual. La firma requiere certificado de pago y
  aprobación explícita (ADR 0015).
- **Datos:** el instalador actualiza binarios y recursos; nunca borra
  `userData`. La primera ejecución tras una actualización migra la base con
  copia previa.

### 3.9 Costes y dependencia externa

| Servicio | Plan | Uso | Riesgo |
|---|---|---|---|
| GitHub | Free | Código, issues y Releases | Límites de almacenamiento de releases; suficiente para uso personal |
| GitHub Actions | Free en repo público | CI y builds de release | Minutos y runners; se controla con caché y jobs acotados |
| Windows | — | Sistema operativo del usuario | Requisito de plataforma |
| Firma de código | Opcional de pago | Evitar avisos de SmartScreen | No es gratuita; no bloquea el MVP |

No hay Supabase, Vercel, Cloudflare R2, UptimeRobot, Sentry, Resend ni dominio.
Las cuentas que hubiera que cerrar están en
[`docs/cambio-a-escritorio.md`](cambio-a-escritorio.md).

**Estrategia de coste cero:** repo público, GitHub Releases, SQLite y assets
locales, actualizaciones directas desde GitHub. La firma de código queda fuera
del MVP.

---

## 4. Proceso de desarrollo

### 4.1 Agentes

Se mantiene el equipo de ocho agentes, adaptado al contexto de escritorio:

| Agente | Cambio principal |
|---|---|
| `sdd-master` | Sigue siendo el punto de entrada; orquesta el flujo y la publicación local-first. |
| `publisher` | Sin cambios de fondo: rama, commit y diff locales; push/PR solo con confirmación. |
| `task-architect` | Planifica con Electron, SQLite, IPC, backups, instalador y offline; sin Supabase ni responsive web. |
| `tdd-ddd-architect` | Implementa con TDD pragmático; seguridad Electron, datos locales y migraciones. |
| `qa-reviewer` | Comprueba ventana 1024/1280/1600, dos temas, a11y, offline, preservación de datos y manual. |
| `security-champion` | Revisa IPC, sandbox, CSP, path traversal, importación, dependencias y secretos. |
| `documentation-sync` | ADRs, manual, changelog, arquitectura y coherencia documental. |
| `ui-ux-designer` | Diseño de escritorio, tokens, temas, accesibilidad y estados; sin móvil. |

Los subagentes **no fijan modelo**: heredan el modelo de la sesión. La variante
recomendada sigue existiendo como label y guía, pero se selecciona en la sesión.
El detalle está en [`docs/variantes-modelo.md`](variantes-modelo.md).

### 4.2 Cambios en `AGENTS.md`

Las reglas obligatorias se han reescrito para el contexto de escritorio. Las
principales diferencias con la etapa web son:

- Se elimina la responsividad web, los anchos 360/768 y la PWA.
- Se eliminan Supabase, RLS, auth, allowlist, roles e invitaciones.
- Se añaden preservación de datos, seguridad Electron, offline y ventana de
  escritorio.
- Se mantienen PRs contra `dev`, manual, dos temas, accesibilidad, i18n,
  publicación local-first, dependencias justificadas y migraciones reversibles.
- La firma de código se trata como excepción opcional de pago con ADR.

### 4.3 Flujo SDD

```text
Issue (label ai + status: todo + variant: *)
  → adopción: task file en tasks/task-issue-N.json
  → plan (task-architect)
  → implementación (tdd-ddd-architect)
  → QA (qa-reviewer): criterios, ventana, temas, a11y, datos
  → seguridad (security-champion): IPC, sandbox, rutas, secretos
  → documentación (documentation-sync): ADR + manual + changelog
  → publisher en modo local: rama + commit + diff, SIN push
  → el usuario prueba en local
  → publicación explícita: push + PR a dev (sin keyword de cierre)
  → merge a dev → issue cerrada con status: done
  → el usuario promueve dev a main cuando la versión es estable
```

**Task file** (`tasks/task-issue-N.json`): título, descripción, issue, estado,
criterios de aceptación, Definition of Done, plan, resultados de QA/seguridad,
ADR y bloque `pr` solo cuando se publique. Se versiona en el repo.

**Estados:** `created` → `planned` → `implemented` → `validated` →
`security-cleared` → `documented` → `review` → `published`. `blocked` cuando
falte una decisión.

**Labels de estado:** `status: todo`, `status: in-progress`,
`status: needs-review`, `status: blocked`, `status: done`.

### 4.4 Git, ramas y PRs

- `main`: versión estable; solo el usuario promueve desde `dev`.
- `dev`: integración; aquí se fusionan las PRs.
- Ramas de trabajo: `feature/issue-N-slug`, `fix/issue-N-slug`,
  `docs/issue-N-slug`, `chore/issue-N-slug`.
- Commits convencionales: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
  `test:`, `style:`, `content:`.
- PR pequeña, con resumen, issue relacionada, cambios, pruebas y capturas si hay
  UI. Sin keywords de cierre.
- Revisión: CI verde + QA + seguridad. El publisher no publica sin confirmación.

### 4.5 Etiquetas e hitos

**Tipos:** `type: feature`, `type: bug`, `type: chore`, `type: docs`,
`type: design`, `type: testing`, `type: refactor`, `type: content`.

**Áreas:** `area: agents`, `area: architecture`, `area: infra`, `area: desktop`,
`area: persistence`, `area: packaging`, `area: data`, `area: worlds`,
`area: entities`, `area: graph`, `area: maps`, `area: writing`, `area: game`,
`area: search`, `area: ui`, `area: docs`, `area: security`, `area: qa`.

**Estado:** `status: todo`, `status: in-progress`, `status: needs-review`,
`status: blocked`, `status: done`.

**Prioridad:** `priority: p0` (bloqueante), `priority: p1` (alta),
`priority: p2` (media), `priority: p3` (baja).

**Tamaño:** `size: s`, `size: m`, `size: l`, `size: xl`.

**Otros:** `ai` (lista para agentes), `needs-decision` (requiere decisión del
usuario), `future` (backlog).

**Hitos:** `M0 · Fundaciones de escritorio`, `M1 · Núcleo local`,
`M2 · Mapas y grafo`, `M3 · Escritura`, `M4 · Juego creativo`,
`M5 · Calidad y distribución`, `Backlog`.

### 4.6 Fases y catálogo de issues

El catálogo detallado vive en GitHub: 41 issues (#61–#101), organizadas en
los hitos M0–M5 y Backlog. El inventario con títulos y números está en
[`cambio-a-escritorio.md`](cambio-a-escritorio.md#53-issues-creadas). Resumen:

| Fase | Objetivo | Issues principales |
|---|---|---|
| **M0** | Base técnica y proceso | Pivote documental, scaffold Electron, SQLite/Drizzle, IPC, sistema de diseño, assets, backups, CI, instalador. |
| **M1** | Núcleo local | Mundos, fichas, tipos, etiquetas, relaciones, búsqueda, ajustes, papelera y versiones. |
| **M2** | Mapas y grafo | Spike MapLibre/Terra Draw, editor de mapas, marcadores, grafo. |
| **M3** | Escritura | Editor Tiptap, diálogos y enfoque, exportación/importación. |
| **M4** | Juego | Dados y tablas, contenido inicial, tablas personalizadas y packs. |
| **M5** | Calidad y distribución | Auditoría a11y/temas/rendimiento, release y auto-update, manual, pruebas de datos, beta 1.0. |
| **Backlog** | Futuro | Calendarios, IA opcional, macOS/Linux y firma de código. |

Cada issue incluye contexto, alcance, dependencias, criterios de aceptación,
labels, hito y variante recomendada. Las dependencias se reflejan en el cuerpo.

---

## 5. Migración desde la etapa web

### 5.1 Qué se conserva

- El repositorio, la licencia MIT, las ramas `main`/`dev`, el flujo SDD, los
  agentes y la publicación local-first.
- La estética editorial, los dos temas y la accesibilidad AA.
- El alcance de producto: mundos, fichas, relaciones, mapas, grafo, escritura y
  juego.
- Los datos de ejemplo y el catálogo de tipos, adaptados a SQLite.
- La disciplina de pruebas, ADRs y documentación.

### 5.2 Qué se elimina

- Next.js, React Server Components, Server Actions y route handlers.
- Supabase (Postgres, Auth, RLS, allowlist, invitaciones), Vercel y Cloudflare
  R2, junto con sus secretos. UptimeRobot se retira; Sentry y Resend se habían
  previsto pero no se configuraron.
- PWA, service worker, IndexedDB, manifest y requisitos móviles/responsive.
- El código web de `src/app`, `src/components`, `src/lib`, `src/messages`,
  `src/styles`, `drizzle/` PostgreSQL, scripts de base de datos y storage, tests
  web y configuración de Next/Vercel/Playwright web.
- Los ADRs y documentos específicos de la etapa web, que quedan en el historial
  de git y se sustituyen por la serie de escritorio.

### 5.3 Qué se crea

- Documentación de escritorio: plan, arquitectura, persistencia, esquema,
  migraciones, continuidad, calidad, manual y ADRs.
- Un baseline de tooling (TypeScript, ESLint, Vitest, Prettier) sin Next.
- El catálogo de issues y los hitos nuevos.
- `docs/cambio-a-escritorio.md` con la lista de archivos eliminados, issues
  borradas, labels/hitos cambiados y cuentas a cerrar.

### 5.4 Cuentas externas a cerrar

El usuario cerrará manualmente, cuando confirme que no hay datos que conservar:

- Supabase (proyecto de desarrollo y cualquier proyecto asociado).
- Vercel (proyecto y equipo).
- Cloudflare R2 (bucket, tokens y lifecycle).
- UptimeRobot (monitor).
- Sentry y Resend solo si se llegó a crear alguna cuenta; no estaban
  configurados en el repositorio.
- GitHub Actions secrets/variables de la etapa web (`SUPABASE_*`, `R2_*`,
  `HEALTHCHECK_URL`, `BACKUP_PASSPHRASE`, etc.).
- Cualquier `.env.local` o credencial local.

El detalle y las comprobaciones están en
[`docs/cambio-a-escritorio.md`](cambio-a-escritorio.md).

---

## 6. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Pérdida de datos al actualizar o migrar | Muy alto | `userData` fuera de la instalación, copia previa, transacción, prueba de preservación y restauración. |
| Corrupción de SQLite | Alto | WAL, integridad al arrancar, copias rotativas y restauración guiada. |
| Instalador sin firma y SmartScreen | Medio | Documentar el aviso, publicar checksums y valorar firma con ADR. |
| Tamaño y consumo de Electron | Medio | `asar`, sin dependencias innecesarias, carga diferida y medición. |
| Complejidad de mapas/exportación SVG | Medio | Spike temprano y plan B con editor SVG propio. |
| Migración de datos web (si hubiera) | Bajo | La etapa web no llegó a producto; no hay datos reales que migrar. |
| Dependencia de GitHub Releases | Bajo | Los datos y la app funcionan sin actualizaciones; el instalador se conserva. |
| Fuga de datos por logs o exportaciones | Medio | Logs sin contenido, exportaciones locales, borrado seguro y revisión de seguridad. |
| Accesibilidad insuficiente | Medio | axe, teclado, temas y revisión en cada issue de UI. |
| Deuda de documentación | Medio | `documentation-sync` y manual obligatorio en cambios visibles. |

---

## 7. Criterios de éxito del pivote

- [ ] No queda código, configuración ni documentación que presente World Craft
      como web, PWA o app con Supabase/Vercel/R2.
- [ ] El repositorio tiene un baseline de tooling que pasa lint, typecheck y
      tests sin Next.
- [ ] Existe un plan, una arquitectura, un modelo de datos y una serie de ADRs
      coherentes con Electron + SQLite.
- [ ] Los agentes y `AGENTS.md` no exigen responsive web, auth ni RLS, y no
      fuerzan un modelo gratuito.
- [ ] El catálogo de issues y los hitos reflejan las fases de escritorio.
- [ ] `docs/cambio-a-escritorio.md` permite cerrar todas las cuentas externas sin
      olvidar secretos.
- [ ] El cambio queda en una rama y un commit locales, sin push ni PR, para
      revisión del usuario.

---

## 8. Documentos relacionados

- [Arquitectura](arquitectura.md)
- [Persistencia](persistencia.md)
- [Esquema de base de datos](base-de-datos/esquema.md)
- [Migraciones](base-de-datos/migraciones.md)
- [Continuidad y copias](continuidad.md)
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [Sistema de diseño](diseno/sistema-de-diseno.md)
- [Internacionalización](internacionalizacion.md)
- [Manual de usuario](manual-de-usuario.md)
- [Registro de decisiones](registro-decisiones.md)
- [ADRs](adr/README.md)
- [Proceso SDD](proceso-sdd.md)
- [Cambio a escritorio](cambio-a-escritorio.md)
