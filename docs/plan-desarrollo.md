# Plan de desarrollo de World Craft

> **Estado:** plan aprobado por el usuario (issue #1); publicación mediante PR a `dev`
> **Fecha:** 12 de noviembre de 2026
> **Ámbito:** planificación, arquitectura y desglose de tareas. Este documento **no implementa** nada.
> **Decisiones:** cerradas el 12/11/2026; ver [`docs/registro-decisiones.md`](registro-decisiones.md).
> **Precios y límites:** consultados el 11/11/2026 y revisados el 12/11/2026. Los planes gratuitos cambian; antes de lanzar hay que revisarlos y registrar el resultado en un ADR.

---

## 0. Resumen ejecutivo

World Craft será una aplicación web personal para **crear mundos de ficción y escribir novelas o relatos** en un mismo lugar. La inspiración es [vvd.world](https://vvd.world/), pero el alcance se adapta a un uso personal: varios mundos, fichas de todo tipo de elementos, relaciones navegables en grafo, mapas vectoriales, un editor de escritura con herramientas para diálogos y un generador de ideas con dados y tablas.

La propuesta técnica es:

| Capa | Decisión propuesta |
|---|---|
| Framework | **Next.js (App Router) + React + TypeScript** |
| UI | **Tailwind CSS + shadcn/ui + Radix + Lucide + Motion** |
| Base de datos | **PostgreSQL gestionado en Supabase (plan Free)** |
| ORM y validación | **Drizzle ORM + Zod** |
| Autenticación | **Supabase Auth** con lista de correos permitidos e invitaciones |
| Archivos | **Cloudflare R2** (10 GB gratis) detrás de una interfaz de almacenamiento |
| Hosting | **Vercel Hobby** (uso personal, no comercial) |
| Mapas | **MapLibre GL JS + Terra Draw + GeoJSON** |
| Grafo | **React Flow (`@xyflow/react`) + ELK.js** |
| Editor | **Tiptap 3 (núcleo MIT) + extensiones propias** |
| Pruebas | **Vitest + Testing Library + Playwright + axe-core** |
| PWA | **Serwist + IndexedDB** para borradores y uso móvil |

El coste objetivo es **0 €/mes** usando únicamente planes gratuitos. La única excepción opcional sería un dominio propio (unos 10-15 €/año), que no es necesario para el MVP: se puede usar el subdominio `*.vercel.app`.

El desarrollo se organiza en **seis fases** (M0 a M5) y **43 issues** enlazadas con etiquetas y hitos. Antes de implementar nada se revisan y adaptan los agentes de IA y las reglas del proyecto (issues M0-01 y M0-02), porque los actuales están heredados de otra aplicación y contienen referencias, scripts y flujos que no existen aquí.

**Decisiones cerradas el 12/11/2026.** El detalle y las consecuencias están en [`docs/registro-decisiones.md`](registro-decisiones.md). En resumen:

1. **Stack:** Supabase Free + Vercel Hobby, con archivos en **Cloudflare R2 Free** y keep-alive/backups para la pausa de Supabase.
2. **Temas:** dos modos, Claro y Oscuro.
3. **Mapas:** fondo raster opcional y georreferenciado para calcar, sin renunciar al mapa vectorial.
4. **Acceso:** allowlist para entrar en la app; roles `owner`/`editor`/`viewer` por mundo; cualquier usuario autorizado puede crear sus propios mundos.
5. **Idioma:** español en el MVP, con textos centralizados y estructura preparada para inglés e italiano.
6. **Dominio:** subdominio de Vercel en el MVP.
7. **Publicación:** revisión local primero; PR a `dev` cuando el usuario apruebe.
8. **Juego:** contenido inicial ampliable desde la app mediante tablas y packs, sin tocar código.

---

## 1. Visión y alcance

### 1.1 Problema y propuesta de valor

Una persona que escribe ficción suele repartir su trabajo entre documentos, hojas de cálculo, carpetas de imágenes, herramientas de mapas y notas sueltas. World Craft unifica:

- **La enciclopedia del mundo:** fichas tipadas, relaciones, etiquetas y búsqueda.
- **La geografía:** mapas vectoriales con marcadores vinculados a fichas.
- **La escritura:** manuscritos estructurados en libros, capítulos y escenas, con herramientas específicas para novela.
- **La inspiración:** tiradas de dados y tablas que proponen contenedores, subgéneros, detonantes y tópicos literarios.

La propuesta no es competir con vvd.world en comunidad, wiki pública o colaboración en tiempo real. Es una herramienta **personal, privada, rápida y sin coste**, con datos portables y una experiencia cuidada.

### 1.2 Usuarios

| Usuario | Necesidad principal |
|---|---|
| Autor/propietario (usuario principal) | Crear varios mundos, escribir novelas y consultar su propio material sin fricción. |
| Amigo invitado | Acceder a un mundo concreto para leerlo o, si se le concede permiso, editarlo. También puede crear y gestionar sus propios mundos. |
| Futuro lector | Consultar una vista de lectura o una wiki pública (backlog, no MVP). |

No hay registro público, ni perfiles públicos, ni interacción entre usuarios, ni comunidad.

### 1.3 Principios de producto

1. **Privado por defecto.** Todo requiere sesión; no hay contenido público salvo que se decida explícitamente en el futuro.
2. **Local primero en la experiencia.** Autoguardado, borradores en el navegador y recuperación ante fallos de red.
3. **Datos portables.** Exportar e importar un mundo completo en un formato abierto (JSON + archivos) en cualquier momento.
4. **Rápido y silencioso.** Sin animaciones innecesarias, sin recargas completas y sin dependencias de servicios de pago.
5. **Responsive de verdad.** Móvil, tablet y escritorio; el mapa se puede consultar en móvil y editar cómodamente en escritorio.
6. **Accesible.** WCAG AA, navegación por teclado, foco visible y respeto a `prefers-reduced-motion`.
7. **Estética editorial.** Papel, tinta, cartografía y tipografía con carácter; no un dashboard genérico.
8. **Gratuito y sostenible.** Cada dependencia y servicio debe justificar su coste y su límite gratuito.

### 1.4 Alcance del MVP

El MVP debe permitir, como mínimo:

- Iniciar sesión con una cuenta propia y acceder a un espacio privado.
- Crear varios mundos con portada, descripción y estado.
- Crear fichas de distintos tipos (personajes, lugares, ciudades, naciones, culturas, razas, organizaciones, religiones, magia, objetos, criaturas, idiomas, eventos, etc.) con campos personalizados, imágenes, etiquetas y texto enriquecido.
- Relacionar fichas entre sí y navegar las relaciones en una vista de grafo.
- Crear mapas vectoriales con capas, formas, líneas, puntos, etiquetas y marcadores vinculados a fichas; exportar el mapa en SVG/PNG.
- Escribir una novela estructurada en libros, capítulos y escenas, con autoguardado, modo diálogo, modo concentración, objetivos y estadísticas.
- Exportar el manuscrito a DOCX, PDF, EPUB y Markdown; importar DOCX/Markdown.
- Tirar dados y generar propuestas con tablas de contenedores, subgéneros, detonantes y tópicos literarios, guardando las sesiones.
- Buscar globalmente y navegar con una paleta de comandos.
- Usar la app en móvil, tablet y escritorio, en los dos temas, con una PWA instalable.
- Exportar/importar mundos y disponer de copias de seguridad.

### 1.5 Fuera de alcance (inicial)

- Colaboración en tiempo real y edición simultánea.
- Wiki pública, comunidad, comentarios de lectores o perfiles públicos.
- Aplicación de escritorio nativa (se valorará Tauri/Electron en el futuro).
- Generación de contenido con IA de pago (se deja como mejora opcional futura).
- Pagos, suscripciones o marketplace.
- API pública para terceros.
- Calendarios fantásticos completos y líneas temporales avanzadas (se cubren con campos de fecha/atributos; la vista de timeline queda en backlog).
- Aplicaciones móviles nativas en App Store/Google Play.

### 1.6 Referencia: vvd.world

vvd.world ofrece organización de mundos, mapas interactivos, visualización de conexiones, wiki personalizable y colaboración en tiempo real. World Craft toma la **organización por fichas**, los **mapas interactivos** y la **visualización de conexiones**, pero:

- Elimina la capa social y de comunidad.
- Sustituye la wiki pública por una experiencia privada de consulta.
- Añade un editor de novela más profundo y un generador de ideas con dados.
- Prioriza el coste cero y la portabilidad de datos.

No se copiará su diseño, textos, ilustraciones ni estructura de datos.

---

## 2. Requisitos

### 2.1 Requisitos funcionales

#### 2.1.1 Mundos

- Listar, crear, editar, archivar, duplicar, exportar e importar mundos.
- Campos: nombre, slug, resumen, descripción, portada, género(s), estado (borrador/en desarrollo/en pausa/completado), idioma, fecha de creación y actualización.
- Aislamiento estricto entre mundos: ningún dato de un mundo debe aparecer en otro.
- Dashboard del mundo con accesos rápidos, actividad reciente y progreso.

#### 2.1.2 Entidades y fichas

- Tipos del sistema: personaje, lugar, ciudad, nación, cultura, raza/especie, organización/facción, religión, deidad, sistema de magia, objeto/artefacto, criatura, idioma, evento, conflicto, tecnología, flora/fauna y concepto.
- Tipos personalizados por mundo, con icono, color y plantilla de campos.
- Campos: nombre, alias, resumen, descripción enriquecida, imagen principal, galería, etiquetas, atributos clave-valor tipados, estado, favorito y fechas.
- Autoguardado y creación rápida desde cualquier pantalla.
- Enlaces internos entre fichas (`@personaje`) y backlinks.
- Historial de cambios por ficha (al menos versiones de descripción).
- Papelera con restauración.

#### 2.1.3 Relaciones y grafo

- Relaciones tipadas y dirigidas (o bidireccionales) entre entidades: familiar, miembro de, ubicado en, aliado, enemigo, pertenece a, causó, participó en, etc.
- Etiqueta directa e inversa, notas, fuerza/importancia y metadatos.
- Vista de grafo interactiva: zoom, paneo, selección, búsqueda, filtros por tipo/relación, foco en un nodo, expansión de vecinos, diseño automático y posiciones manuales guardadas.
- Exportar el grafo a PNG/SVG.
- Acciones rápidas desde el grafo: abrir ficha, crear relación, ocultar tipos.

#### 2.1.4 Mapas

- Varios mapas por mundo (mundo, región, ciudad, interior).
- Editor vectorial: capas (terreno, agua, costas, rutas, regiones, puntos, etiquetas, iconos), polígonos, líneas, puntos, texto, estilos, orden Z, bloquear/ocultar capa.
- Opcional: imagen raster de fondo georreferenciada para calcar o completar un mapa dibujado a mano.
- Herramientas: seleccionar, mover, editar vértices, dibujar, borrar, deshacer/rehacer, duplicar, alinear, snap, medir distancias, escala y leyenda.
- Marcadores vinculados a entidades, con popup y enlace a la ficha.
- Pan/zoom fluido, atajos de teclado y gestos táctiles.
- Exportar SVG (vectorial, sin pérdida), PNG (alta resolución) y GeoJSON; importar GeoJSON.
- Vista de solo lectura para consulta y posible enlace compartido privado.

#### 2.1.5 Escritura

- Biblioteca de obras: novela, novella, relato, saga; estado y objetivo de palabras.
- Estructura: obra → partes/libros → capítulos → escenas.
- Editor de texto enriquecido con títulos, negrita, cursiva, citas, separadores de escena, listas y notas.
- **Modo diálogo:** detectar y formatear diálogos con raya, asignar hablante, autocompletar nombres de personajes y resaltar interlocutores.
- **Modo concentración:** ocultar el resto de la interfaz; **modo máquina de escribir** (la línea actual permanece centrada).
- Objetivos diarios/semanales, contador de palabras, estadísticas de sesión y racha.
- Buscar y reemplazar; corrector ortográfico nativo y diccionario personal.
- Notas de escena, POV, lugar, fecha de la historia y estado.
- Autoguardado con buffer local y resolución de conflictos.
- Historial de versiones por escena y restauración.
- Exportar a DOCX, PDF, EPUB y Markdown con formato de manuscrito; importar DOCX y Markdown.
- Modo lectura/impresión.

#### 2.1.6 Juego de inspiración

- Tirada de dados con notación estándar (`1d20`, `2d6+1`, etc.) y resultados reproducibles mediante semilla.
- Tablas de contenido: **contenedores**, **subgéneros**, **detonantes** y **tópicos literarios**, con pesos, etiquetas y variantes.
- Flujo "inspiración": combinar una tirada de cada categoría, bloquear/rerolear resultados y guardar la combinación como semilla de historia.
- Historial de sesiones y posibilidad de vincular una semilla a un mundo/proyecto.
- Tablas personalizadas por el usuario y edición de contenido.
- Contenido inicial en español, con tono y nivel de edad configurables.

#### 2.1.7 Búsqueda y navegación

- Búsqueda global en mundos, fichas, relaciones, mapas, manuscritos y escenas.
- Búsqueda difusa (trigram) y por prefijo; filtros por mundo, tipo, etiqueta y estado.
- Paleta de comandos (`Ctrl/Cmd + K`) para navegar, crear y ejecutar acciones.
- Recientes y favoritos.
- Resultados con resaltado y navegación por teclado.

#### 2.1.8 Cuenta y acceso

- Inicio de sesión con email/contraseña y enlace mágico.
- Registro cerrado: solo correos previamente autorizados.
- La allowlist da acceso a la **aplicación**, no a los mundos de otras personas.
- Cualquier usuario autorizado puede crear sus propios mundos y será su propietario.
- Invitación de amigos a un mundo con rol **lector** o **editor**; la pertenencia al mundo es independiente del acceso a la app.
- Cierre de sesión, recuperación de contraseña y gestión de sesiones.
- Perfil básico: nombre visible, avatar, tema (claro/oscuro) y preferencias.

#### 2.1.9 Ajustes y datos

- Tema (claro/oscuro), densidad, tamaño de fuente del editor, idioma de la interfaz (español en MVP), atajos.
- Exportar un mundo completo (JSON + assets) e importarlo.
- Exportar la cuenta y eliminar la cuenta con confirmación.
- Gestión de almacenamiento y borrado de assets huérfanos.

#### 2.1.10 Ayuda y documentación

- Manual de usuario en `docs/manual-de-usuario.md`, enlazado desde la app.
- Onboarding breve para el primer mundo.
- Tooltips y textos de ayuda contextuales.
- Página de novedades/cambios.

### 2.2 Requisitos no funcionales

| Requisito | Criterio |
|---|---|
| Responsividad | Sin scroll horizontal de página a 360, 768 y 1280 px; contenido largo sin desbordar; mapa usable en móvil. |
| Temas | Dos modos (Claro y Oscuro) con contraste WCAG AA mínimo 4.5:1 en texto normal. |
| Accesibilidad | Navegación completa por teclado, foco visible, etiquetas ARIA, `prefers-reduced-motion`, axe sin errores críticos. |
| Rendimiento | LCP < 2,5 s en 4G; INP < 200 ms; CLS < 0,1; mapa de 500 elementos a 60 fps en portátil medio; grafo de 200 nodos < 2 s. |
| Privacidad | Sin contenido público; RLS en todas las tablas; sin telemetría invasiva; datos exportables y eliminables. |
| Seguridad | Contraseñas gestionadas por Supabase; sesiones en cookies HttpOnly/SameSite; CSP; validación de subidas; sin secretos en cliente. |
| Disponibilidad | Best effort con free tiers; recuperación documentada; sin SLA. |
| Portabilidad | Exportación JSON/GeoJSON/Markdown; migraciones SQL versionadas; sin dependencias propietarias en el modelo de datos. |
| Mantenibilidad | TypeScript estricto, lint/format, tests, ADRs, módulos por dominio, dependencias justificadas. |
| Coste | 0 €/mes en servicios; dominio propio opcional. |
| Idioma | Interfaz y contenido inicial en español; textos centralizados para i18n futura. |

---

## 3. Arquitectura técnica

### 3.1 Vista general

```text
┌──────────────────────────────────────────────────────────────────┐
│ Navegador (React 19 + Next.js App Router)                        │
│  ├─ RSC: dashboard, fichas, listas, ajustes                      │
│  ├─ Client: editor Tiptap, mapa MapLibre, grafo React Flow       │
│  ├─ IndexedDB: borradores y recuperación offline                 │
│  └─ PWA: shell cacheada + instalación                            │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTPS (cookies de sesión)
┌───────────────▼──────────────────────────────────────────────────┐
│ Vercel Hobby                                                     │
│  ├─ Next.js: Server Components + Server Actions + Route Handlers  │
│  ├─ Middleware: refresco de sesión y protección de rutas          │
│  ├─ Exportaciones: DOCX/PDF/EPUB/Markdown                        │
│  └─ Procesado de imágenes (sharp) y URLs firmadas                 │
└───────┬───────────────────────────────┬──────────────────────────┘
        │                               │
┌───────▼───────────────┐      ┌────────▼─────────────────────────┐
│ Supabase              │      │ Cloudflare R2                    │
│  ├─ PostgreSQL         │      │  ├─ avatares                     │
│  ├─ Auth (email)       │      │  ├─ portadas y fichas            │
│  ├─ RLS                │      │  ├─ mapas (raster/exportes)      │
│  └─ Búsqueda FTS       │      │  └─ assets de manuscritos        │
└───────────────────────┘      └──────────────────────────────────┘
```

**Flujo de una petición típica:** el middleware refresca la sesión de Supabase; el Server Component valida la membresía del mundo y consulta con Drizzle; el cliente recibe datos ya filtrados. Las mutaciones pasan por Server Actions con validación Zod, comprobación de permisos y `revalidatePath`. Las vistas pesadas (mapa, grafo, editor) se cargan solo en cliente con `dynamic(..., { ssr: false })` y guardan por route handlers con control de versión.

### 3.2 Decisiones y alternativas

Las puntuaciones son orientativas (1-5) y ponderan el contexto: uso personal, coste cero, calidad, rapidez de desarrollo, mantenibilidad y encaje con las funciones interactivas.

#### D1. Framework: Next.js App Router

| Criterio | Next.js | SvelteKit | Remix/React Router | Astro | Nuxt |
|---|---:|---:|---:|---:|---:|
| Ecosistema para editor/grafo/mapas | 5 | 3 | 4 | 2 | 3 |
| Full-stack y Server Actions | 5 | 4 | 4 | 2 | 4 |
| Despliegue gratuito y DX | 5 | 4 | 3 | 4 | 3 |
| Curva de aprendizaje y documentación | 4 | 3 | 3 | 4 | 3 |
| Rendimiento para app interactiva | 4 | 5 | 4 | 3 | 4 |
| **Total** | **23** | **19** | **18** | **15** | **17** |

**Decisión:** Next.js con App Router. El ecosistema React es decisivo para Tiptap, React Flow, MapLibre, dnd-kit y shadcn/ui. Los Server Components reducen JavaScript en pantallas de lectura y las Server Actions simplifican las mutaciones. Riesgo: complejidad de RSC y acoplamiento a Vercel; se mitiga usando APIs estándar, SQL portable y evitando servicios propietarios de Vercel.

#### D2. UI: Tailwind CSS + shadcn/ui

| Criterio | Tailwind + shadcn/ui | MUI | Chakra | Mantine | CSS Modules |
|---|---:|---:|---:|---:|---:|
| Control visual y estética propia | 5 | 3 | 3 | 4 | 4 |
| Accesibilidad de primitivas | 5 | 4 | 4 | 4 | 2 |
| Temas múltiples con tokens | 5 | 3 | 3 | 4 | 4 |
| Peso y dependencias | 5 | 2 | 3 | 3 | 5 |
| Velocidad de desarrollo | 5 | 4 | 4 | 4 | 2 |
| **Total** | **25** | **16** | **17** | **19** | **17** |

**Decisión:** Tailwind CSS 4 + shadcn/ui (Radix) + Lucide + Motion. shadcn/ui no es una dependencia monolítica: los componentes se copian al repositorio y se adaptan. Esto encaja con una estética editorial propia y con los dos temas (claro/oscuro). Se evita un kit que imponga su look.

#### D3. Base de datos: Supabase Postgres

| Criterio | Supabase | Neon | Turso | Cloudflare D1 | PocketBase | Firebase |
|---|---:|---:|---:|---:|---:|---:|
| Modelo relacional y consultas | 5 | 5 | 3 | 3 | 4 | 2 |
| Auth + Storage integrados | 5 | 4 | 1 | 2 | 4 | 4 |
| RLS y seguridad por fila | 5 | 2 | 1 | 1 | 3 | 3 |
| Límites gratuitos | 4 | 5 | 5 | 5 | 5 | 3 |
| Madurez y documentación | 5 | 4 | 3 | 3 | 3 | 5 |
| **Total** | **24** | **20** | **13** | **14** | **19** | **17** |

*El almacenamiento se evalúa por separado en D6 y finalmente se resuelve con Cloudflare R2; la fila "Auth + Storage integrados" solo valora la comodidad de tener Auth en el mismo panel.*

**Decisión:** Supabase Free (PostgreSQL 15+) para base de datos, Auth y RLS. Los archivos van a **Cloudflare R2 Free** (10 GB, egreso gratis), no a Supabase Storage, para evitar el límite de 1 GB. Los 500 MB de base de datos son suficientes para texto y metadatos. Riesgos: el proyecto se pausa tras una semana de baja actividad, no hay backups automáticos en Free y los datos deben poder recuperarse. Mitigaciones: healthcheck/monitor keep-alive, backup semanal con `pg_dump`, exportación de mundos y procedimiento de reactivación; si se superan los límites, migrar a Neon Free + R2 es una ruta documentada.

**Alternativa seria:** Neon Free + Better Auth + R2. Tiene más almacenamiento de base de datos (1 GB), no pausa y ofrece branching, pero requiere montar auth y storage por separado. Se descarta para el MVP por complejidad; se reevalúa si Supabase se queda corto.

#### D4. ORM y validación: Drizzle + Zod

| Criterio | Drizzle | Prisma |
|---|---:|---:|
| Tipo de SQL y control de migraciones | 5 | 4 |
| Ligeros/cold start en serverless | 5 | 3 |
| Facilidad con Postgres/Supabase | 5 | 4 |
| Madurez y herramientas | 4 | 5 |
| Curva de aprendizaje | 4 | 4 |
| **Total** | **23** | **20** |

**Decisión:** Drizzle ORM + `postgres` (driver) + Zod. Drizzle es SQL-first, genera tipos precisos y funciona bien con el pooler de Supabase. Prisma es más maduro, pero su motor y su flujo de migraciones con shadow database añaden peso y fricción en serverless. Zod se comparte entre formularios, Server Actions y contratos de route handlers.

#### D5. Autenticación: Supabase Auth con allowlist

| Criterio | Supabase Auth | Better Auth | Auth.js | Clerk |
|---|---:|---:|---:|---:|
| Integración con la BD/RLS | 5 | 4 | 2 | 1 |
| Autogestión y coste | 5 | 5 | 5 | 2 |
| Funciones listas (magic link, recovery) | 5 | 4 | 3 | 5 |
| Control del flujo y UI | 4 | 5 | 5 | 3 |
| **Total** | **19** | **18** | **15** | **11** |

**Decisión:** Supabase Auth con `@supabase/ssr`, email/contraseña como método principal y enlace mágico como secundario. El registro público estará cerrado: solo se permite entrar a correos de una tabla `allowed_emails` gestionada por el propietario. La allowlist da acceso a la **aplicación**, no a los mundos de otras personas: cualquier usuario autorizado puede crear sus propios mundos y las invitaciones a un mundo se hacen desde la app con un token, un rol y caducidad. RLS refuerza los permisos a nivel de base de datos.

**Correo:** el SMTP integrado de Supabase tiene límites bajos y no quita su marca en Free. Para un uso personal es suficiente, pero se puede configurar **Resend Free** (3.000 emails/mes, 100/día) como SMTP personalizado.

#### D6. Archivos: Cloudflare R2 con abstracción

**Decisión:** Cloudflare R2 Free (10 GB, 1M operaciones Class A, 10M Class B, egreso gratis) para portadas, imágenes de fichas, fondos de mapas y exportes. Se descarta Supabase Storage para producción por su límite de 1 GB. Todo acceso pasa por una interfaz `StorageAdapter` (`upload`, `getSignedUrl`, `delete`, `list`) con implementación R2 y adaptador local para desarrollo y tests. El bucket es privado; el servidor comprueba la membresía del mundo antes de firmar una URL.

Medidas: compresión a WebP en cliente/servidor, límite de dimensiones (4096 px de lado mayor en fondos de mapa), miniaturas generadas, validación de MIME y tamaño, nombres con UUID, prefijos `world/{worldId}/...`, borrado de huérfanos, CORS restringido y reglas de ciclo de vida.

#### D7. Hosting: Vercel Hobby

| Criterio | Vercel Hobby | Cloudflare Pages/Workers | Netlify Free | Render Free | VPS propio |
|---|---:|---:|---:|---:|---:|
| Soporte de Next.js | 5 | 3 | 4 | 4 | 4 |
| Despliegues de vista previa | 5 | 4 | 4 | 2 | 2 |
| Límites para uso personal | 4 | 5 | 4 | 3 | 5 |
| Coste | 5 | 5 | 5 | 4 | 2 |
| Simplicidad operativa | 5 | 3 | 4 | 3 | 1 |
| **Total** | **24** | **20** | **21** | **16** | **14** |

**Decisión:** Vercel Hobby. Es la vía con menos fricción para Next.js: despliegues por PR, funciones de hasta 300 s y dominio gratuito `*.vercel.app`. Es para uso personal no comercial, que encaja con el proyecto. Si Vercel cambiara sus condiciones o se necesitara más control, la alternativa es Cloudflare Workers/Pages con OpenNext, o un VPS.

**Límites relevantes verificados:** 100 despliegues/día, 45 min de build, funciones de 300 s máximo, 2 GB/1 vCPU, 100 cron jobs. El ancho de banda y las invocaciones se monitorizarán; para un uso personal no deberían ser un problema.

#### D8. Mapas: MapLibre GL JS + Terra Draw

| Criterio | MapLibre + Terra Draw | SVG propio | Fabric.js | tldraw | Leaflet + Geoman |
|---|---:|---:|---:|---:|---:|
| Datos vectoriales nativos | 5 | 5 | 4 | 4 | 4 |
| Herramientas de dibujo listas | 5 | 1 | 4 | 4 | 4 |
| Rendimiento con muchos elementos | 5 | 2 | 3 | 4 | 4 |
| Gestos móviles y pan/zoom | 5 | 2 | 3 | 5 | 4 |
| Exportación SVG sin pérdida | 4 | 5 | 4 | 4 | 3 |
| Libertad de licencia/coste | 5 | 5 | 5 | 3 | 5 |
| **Total** | **29** | **20** | **23** | **24** | **24** |

**Decisión:** MapLibre GL JS + Terra Draw, con datos en **GeoJSON**. Terra Draw aporta modos de dibujo (punto, línea, polígono, rectángulo, círculo, freehand, selección y edición de vértices) y adaptador oficial para MapLibre. MapLibre renderiza vectorialmente con WebGL, soporta capas, estilos, etiquetas, imágenes de fondo georreferenciadas y gestos táctiles. La exportación SVG se implementa con un serializador propio sobre las capas GeoJSON (y PNG con el canvas de MapLibre). Riesgo: la exportación SVG y el estilo de mapas fantásticos requieren trabajo; se valida en un **spike** (M2-01) antes de comprometer el editor completo. Si el spike falla, el plan B es un editor SVG propio con `d3-zoom` y `perfect-freehand`.

**Modelo:** cada mapa guarda un documento JSON con capas y un `FeatureCollection` GeoJSON; las coordenadas usan un sistema local (lng/lat sobre un mundo ficticio) y cada feature puede tener `entityId` para vincularse a una ficha. El fondo raster opcional es una imagen con `coordinates` (bbox) en una capa de tipo `image`. La vista (centro, zoom, bearing) se guarda por usuario.

#### D9. Grafo: React Flow + ELK.js

| Criterio | React Flow | Cytoscape.js | Sigma.js | D3 |
|---|---:|---:|---:|---:|
| Integración con React | 5 | 2 | 2 | 3 |
| Nodos personalizados | 5 | 3 | 2 | 3 |
| Rendimiento a gran escala | 3 | 5 | 5 | 4 |
| Facilidad de uso | 5 | 3 | 2 | 2 |
| Licencia/coste | 5 | 5 | 5 | 5 |
| **Total** | **23** | **18** | **16** | **17** |

**Decisión:** React Flow 12 + ELK.js para layout automático. Los nodos son componentes React (avatar, tipo, color, acciones), lo que permite una experiencia coherente con el resto de la app. Para mundos personales, cientos de nodos son manejables; si se superan ~1.000, se añaden filtros, agrupación y carga bajo demanda, y se evalúa Sigma.js como visor de solo lectura.

#### D10. Editor: Tiptap 3 + extensiones propias

| Criterio | Tiptap | Lexical | Slate | CodeMirror/Markdown |
|---|---:|---:|---:|---:|
| Madurez y ecosistema | 5 | 4 | 3 | 5 |
| Extensiones y personalización | 5 | 4 | 4 | 4 |
| Integración React/Next | 5 | 4 | 3 | 4 |
| Editor de novela (diálogos, estructura) | 5 | 3 | 4 | 3 |
| Coste de licencia | 4 | 5 | 5 | 5 |
| **Total** | **24** | **20** | **19** | **21** |

**Decisión:** Tiptap 3 (núcleo MIT) sobre ProseMirror. Se implementan extensiones propias para modo diálogo, menciones a personajes, separadores de escena y contadores. Las extensiones Pro (comentarios, historial, colaboración) **no se contratan**: el historial se implementa con snapshots propios y la colaboración queda fuera del MVP. El contenido se guarda como JSON de ProseMirror + texto plano para búsqueda/exportación.

**Exportación:** `docx` para DOCX; `@react-pdf/renderer` o impresión con CSS para PDF; EPUB con `jszip` + XHTML (o `epub-gen`); Markdown con `prosemirror-markdown`. La importación DOCX usará `mammoth` y la de Markdown el parser de ProseMirror.

#### D11. Estado, formularios y contratos

- **Server Components** para lectura; **Server Actions** para mutaciones.
- **Zod** como única fuente de validación en servidor y cliente.
- **React Hook Form** para formularios complejos.
- **Zustand** para estado de UI de editor/mapa/grafo (selección, herramientas, paneles).
- **TanStack Query** solo si una vista cliente necesita caché/optimistic updates; no se usa por defecto.
- **Route handlers** para autosave, subidas firmadas, exportaciones y descargas.

#### D12. Pruebas y calidad

- **Vitest** para dominio, utilidades y componentes.
- **Testing Library** para componentes.
- **Playwright** para E2E, responsive y capturas por tema.
- **axe-core** para accesibilidad.
- **MSW** para aislar red en tests.
- **Lighthouse CI** con presupuestos de rendimiento.
- **gitleaks** y `pnpm audit` en CI.

#### D13. PWA y offline

**Serwist** (sucesor de next-pwa) para service worker, manifest e instalación. **Dexie/IndexedDB** para:
- Borradores del editor con autoguardado local.
- Cambios pendientes de sincronizar.
- Caché de fichas consultadas recientemente para lectura offline.

La sincronización es "last-write-wins" con detección de conflicto por versión; no hay colaboración en tiempo real. En móvil, el mapa y el grafo se consultan en modo lectura; la edición completa se prioriza en escritorio.

#### D14. Observabilidad y backups

- **Sentry Free** (5.000 errores/mes) para errores de cliente/servidor, opcional pero recomendado.
- **Vercel Analytics/Speed Insights** o métricas propias mínimas.
- **GitHub Actions** semanal: `pg_dump` cifrado + artefacto de 90 días y, opcionalmente, copia a R2.
- **UptimeRobot Free** para keep-alive y disponibilidad; workflow de backup como complemento.
- **Registro de actividad** en la base de datos para cambios importantes (quién, qué, cuándo).

#### D15. Temas y sistema de diseño

Se adoptan **dos modos**: Claro y Oscuro. Ambos usan variables CSS:

- Tema claro: `--paper` como superficie principal y `--ink` como texto.
- Tema oscuro: `--ink` como superficie y `--paper` como texto.

Tokens adicionales: `--surface`, `--surface-raised`, `--border`, `--muted`, `--accent`, `--accent-strong`, `--success`, `--warning`, `--danger`, `--focus`. Cada tipo de entidad tiene un color accesible en ambos modos. Los colores hardcodeados deben justificarse con un comentario y comprobarse en los dos temas.

**Dirección visual:** "taller de cartógrafo". Tipografía de display **Fraunces** (serif con carácter), texto de interfaz **Inter** y monoespaciada **JetBrains Mono** para datos. Paleta base papel/tinta con acentos tierra, musgo y ocre; textura de papel sutil mediante SVG, sin gradientes morados genéricos. Ilustraciones y texturas con licencia libre o propias.

#### D16. Idioma

Interfaz en español en el MVP. Todos los textos en `src/messages/es.ts`, con claves tipadas y acceso mediante `getMessages`/`LocaleProvider`; fechas y números con `Intl` y `locale`. La estructura queda preparada para añadir `en.ts` e `it.ts` y, más adelante, `next-intl` sin refactorizar componentes. Los identificadores de código y la base de datos van en inglés; los comentarios y la documentación, en español.

#### D17. Estructura del repositorio

Aplicación única (no monorepo), organizada por dominios:

```text
src/
  app/
    (auth)/login, recuperar...
    (app)/w/[worldId]/
      overview, entities, graph, maps, writing, game, settings
    api/
  modules/
    worlds/ entities/ relations/ maps/ graph/ writing/ game/ search/ auth/
  components/
    ui/ layout/ editors/ maps/ graph/
  lib/
    db/ supabase/ storage/ validation/ utils/
  styles/
  messages/
tests/
  unit/ e2e/
docs/
  adr/ manual-de-usuario.md plan-desarrollo.md
scripts/
```

Cada módulo expone su esquema Drizzle, sus Server Actions y sus componentes. No se crean carpetas `utils` gigantes ni lógica de negocio en componentes de presentación.

### 3.3 Modelo de datos

El modelo es relacional y multi-mundo. Todas las tablas de contenido llevan `world_id` (directo o a través de una relación padre) para aplicar RLS y facilitar el borrado/exportación de un mundo.

```text
profiles (auth.users)
  └─< world_members >─ worlds
                         ├─< entities >─< relations
                         │      ├─ entity_types
                         │      ├─ tags / entity_tags
                         │      └─ assets
                         ├─< maps >─< map_entity_links
                         ├─< manuscripts >─< books >─< chapters >─< scenes >─< scene_versions
                         ├─< game_tables >─< game_table_entries
                         ├─< game_sessions
                         └─< activity_log
```

Tablas principales:

| Tabla | Campos clave |
|---|---|
| `profiles` | `id` (uuid, = auth.users), `display_name`, `avatar_url`, `theme`, `locale`, `settings` jsonb |
| `allowed_emails` | `email` (pk), `invited_by`, `created_at`, `note` |
| `worlds` | `id`, `owner_id`, `name`, `slug`, `summary`, `description` jsonb, `cover_asset_id`, `genres` text[], `status`, `settings` jsonb, `archived_at`, timestamps |
| `world_members` | `world_id`, `user_id`, `role` (owner/editor/viewer), `created_at`; PK compuesta |
| `world_invitations` | `id`, `world_id`, `email`, `role`, `token_hash`, `expires_at`, `accepted_at` |
| `entity_types` | `id`, `world_id` (null = sistema), `key`, `name`, `icon`, `color`, `fields` jsonb, `is_system` |
| `entities` | `id`, `world_id`, `type_id`, `name`, `slug`, `aliases` text[], `summary`, `description` jsonb, `description_text`, `image_asset_id`, `attributes` jsonb, `status`, `is_favorite`, `search_vector` tsvector, timestamps, `deleted_at` |
| `relation_types` | `id`, `world_id` (null = sistema), `key`, `name`, `inverse_name`, `color` |
| `relations` | `id`, `world_id`, `source_id`, `target_id`, `type_id`, `label`, `inverse_label`, `notes`, `strength`, `metadata` jsonb, timestamps |
| `tags` / `entity_tags` | etiquetas por mundo con color; relación N:M con entidades |
| `assets` | `id`, `world_id`, `uploader_id`, `bucket` (R2), `path`, `mime`, `size`, `width`, `height`, `alt`, `created_at` |
| `maps` | `id`, `world_id`, `name`, `description`, `document` jsonb (capas + GeoJSON), `style` jsonb, `bounds` jsonb, `thumbnail_asset_id`, `deleted_at`, timestamps |
| `map_entity_links` | `map_id`, `entity_id`, `feature_id`, `label`; índice para consultas inversas |
| `manuscripts` | `id`, `world_id`, `title`, `kind` (novel/novella/short/saga), `synopsis`, `status`, `target_words`, `settings` jsonb |
| `books` | `id`, `manuscript_id`, `title`, `position` |
| `chapters` | `id`, `book_id`, `title`, `position`, `summary`, `status` |
| `scenes` | `id`, `chapter_id`, `title`, `position`, `content` jsonb, `content_text`, `word_count`, `status`, `pov_entity_id`, `location_entity_id`, `story_date`, `notes` |
| `scene_versions` | `id`, `scene_id`, `content`, `content_text`, `word_count`, `label`, `created_by`, `created_at` |
| `game_tables` | `id`, `world_id` (null = global), `pack_id` (null = tabla suelta), `key`, `name`, `category` (container/subgenre/trigger/trope/custom), `description`, `is_system`, `is_editable`, `version`, `created_by` |
| `game_table_entries` | `id`, `table_id`, `text`, `weight`, `tags` text[], `metadata` jsonb |
| `game_content_packs` | `id`, `world_id` (null = global), `name`, `version`, `description`, `author`, `license`, `metadata` jsonb, `created_by`, `created_at` |
| `game_sessions` | `id`, `world_id`, `user_id`, `seed`, `results` jsonb, `notes`, `created_at` |
| `activity_log` | `id`, `world_id`, `user_id`, `action`, `entity_type`, `entity_id`, `diff` jsonb, `created_at` |

**Decisiones de modelado:**

- **JSONB para contenido rico y atributos variables.** Permite campos personalizados sin migraciones por cada tipo, manteniendo índices GIN donde se consulta.
- **Texto plano duplicado** en `entities.description_text` y `scenes.content_text` para búsqueda full-text, exportación y estadísticas.
- **`position` decimal o entero con huecos** para reordenar sin reescribir filas.
- **Borrado lógico** (`deleted_at`) en entidades, mapas y escenas para papelera; purga programada.
- **Búsqueda:** `tsvector` generado con configuración `spanish` + índice GIN; `pg_trgm` para búsqueda difusa por nombre/alias.
- **Timestamps** en UTC (`timestamptz`); la interfaz muestra la zona local.
- **Migraciones** con Drizzle Kit, versionadas y revisables; nunca se edita una migración ya aplicada en producción.

### 3.4 Seguridad y privacidad

**Modelo de acceso:**

1. La **allowlist** (`allowed_emails`) concede acceso a la aplicación. No concede acceso a los mundos de otras personas.
2. Todo el contenido vive en un mundo. `world_members` define el rol dentro de ese mundo: `owner` (todo, incluida la gestión de miembros), `editor` (contenido) y `viewer` (solo lectura).
3. Cualquier usuario autorizado puede crear sus propios mundos; el creador es el `owner`.
4. RLS en todas las tablas de contenido: `exists (select 1 from world_members ...)` con el rol adecuado. El `owner` no puede perderse ni eliminarse a sí mismo sin transferir antes la propiedad.
5. Las Server Actions vuelven a comprobar el permiso; RLS es la última línea, no la única.
6. El registro está cerrado por allowlist. Las invitaciones a un mundo se aceptan con un token de un solo uso, ligado al correo y con caducidad.
7. El service role de Supabase solo se usa en el servidor para tareas administrativas (invitar usuarios, backups) y nunca se expone al cliente.
8. R2 con bucket privado: el servidor comprueba la membresía y genera URLs firmadas de corta duración; las claves S3 solo viven en el servidor.
9. Cabeceras: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS en producción.
10. Subidas: validar MIME real, tamaño, dimensiones y re-codificar imágenes para eliminar metadatos y payloads.
11. Dependencias: lockfile, `pnpm audit`, Dependabot/Renovate y revisión de licencias.
12. Secretos: solo en variables de entorno de Vercel/Supabase/Cloudflare; `.env*` fuera de git; gitleaks en CI.
13. Datos personales: mínimo necesario (email, nombre visible, avatar). Exportación y borrado de cuenta. Sin analítica de terceros por defecto.
14. Rate limiting en login, invitaciones y subidas (por IP/usuario) mediante middleware o Upstash Redis Free si hiciera falta; para el MVP, límites básicos en Supabase y validación de tamaño.
15. Registro de actividad para acciones destructivas y cambios importantes.

**Amenazas principales y mitigación:** acceso a mundos ajenos (RLS + tests), escalado de rol (comprobación en servidor), XSS en contenido rico (sanitizar HTML y usar el esquema de ProseMirror), SSRF en importaciones (no aceptar URLs remotas arbitrarias), fuga de secretos (gitleaks), abuso de subidas (límites y re-codificación), pérdida de datos (autosave + versiones + backups).

### 3.5 Rendimiento

- Server Components y streaming para las pantallas de lectura.
- Carga diferida de editor, mapa y grafo (`dynamic` + `ssr: false`).
- Imágenes con `next/image`, WebP/AVIF, `sizes` correctos y placeholder.
- Virtualización de listas largas (`@tanstack/react-virtual`) y de tablas.
- Índices: `world_id`, `type_id`, `updated_at`, `search_vector`, `pg_trgm` en nombres.
- Paginación por cursor en listas y búsqueda.
- Mapas: límite de features por capa, simplificación de geometrías y `maxzoom`/`minzoom`; no renderizar capas ocultas.
- Grafo: filtros por tipo, expansión de vecinos, layout en Web Worker (ELK) y límite de nodos visibles.
- Editor: debounce de autosave (2-3 s), diff de contenido, no serializar todo el manuscrito en cada tecla.
- Presupuesto de JavaScript por ruta; análisis de bundle en CI.

### 3.6 Responsividad y accesibilidad

**Puntos de ruptura de referencia:** 360 px (móvil), 768 px (tablet), 1280 px (escritorio). Se prueban también 320 px y 1920 px.

- Navegación: rail lateral en escritorio, barra inferior en móvil, drawers para paneles.
- Editor: una columna en móvil, panel de escena opcional; modo concentración a pantalla completa.
- Mapa: controles táctiles grandes, toolbar inferior, panel de capas en drawer; en móvil se prioriza consulta y edición básica.
- Grafo: gestos de pan/zoom, botones de encuadre, panel de filtros en drawer.
- Tablas: scroll horizontal solo dentro de su contenedor, nunca en la página.
- Textos largos: `overflow-wrap: break-word`, `min-width: 0` en hijos de flex/grid, sin truncar contenido esencial.
- Accesibilidad: HTML semántico, landmarks, foco visible, atajos documentados, contraste AA, `aria-live` para autoguardado, formularios con etiquetas y errores asociados, `prefers-reduced-motion`.

### 3.7 Infraestructura gratuita: límites y costes

| Servicio | Plan | Límites clave (11/11/2026) | Uso previsto | Riesgo |
|---|---|---|---|---|
| Vercel | Hobby | 100 despliegues/día, 300 s/función, 2 GB/1 vCPU, 45 min build | App y API | Cambio de condiciones o picos de banda |
| Supabase | Free | 500 MB BD, 5 GB egreso, 50k MAU, 2 proyectos, pausa tras 1 semana de baja actividad, sin backups | BD, Auth, RLS | Pausa, pérdida de datos |
| Cloudflare R2 | Free | 10 GB, 1M Class A, 10M Class B, egreso gratis | Almacenamiento principal de assets | Requiere configuración S3 y claves server-side |
| GitHub | Free | Repo público: Actions ilimitado; 2.000 min/mes en privado | CI, backups | Límite de minutos si el repo pasa a privado |
| Resend (opcional) | Free | 3.000 emails/mes, 100/día | SMTP de Auth | Límite diario |
| Sentry (opcional) | Free | 5.000 errores/mes | Errores | Retención corta |
| UptimeRobot | Free | 50 monitores, 5 min | Keep-alive y disponibilidad | Falsos positivos |
| Dominio | — | 10-15 €/año | Opcional | No es gratis |

**Estrategia de coste cero:** usar el subdominio de Vercel; mantener el repo público (si no hay secretos) para Actions ilimitado; usar R2 para todos los archivos; comprimir imágenes; limitar el tamaño de los mapas; exportar y archivar assets antiguos; revisar el uso mensual en Supabase, R2 y Vercel.

**Riesgo de pausa de Supabase:** el proyecto se pausa tras una semana de baja actividad. Mitigación:
- Un endpoint ligero `/api/health` hace una consulta real a Supabase y se monitoriza con **UptimeRobot Free** cada 30-60 minutos (o un workflow equivalente). Eso genera actividad suficiente y avisa si el proyecto deja de responder.
- Un workflow semanal de backup con `pg_dump` complementa la monitorización y guarda una copia cifrada.
- Si aun así se pausa, se restaura desde el panel de Supabase. Los datos y la configuración se conservan; Supabase ofrece una ventana de restauración de un año. El procedimiento queda documentado en el runbook.
- Si la pausa o los límites resultan un problema recurrente, migrar a Neon Free (sin pausa) + R2. La capa de datos y el storage están abstraídos para facilitarlo.

**Backups:**
- Exportación de mundo completo desde la app (JSON + assets) como copia principal del usuario.
- `pg_dump` semanal cifrado con GitHub Actions, guardado como artefacto (90 días) y, opcionalmente, en R2.
- Copia/exportación periódica de los assets de R2 o capacidad de reconstruirlos desde la exportación del mundo.
- Prueba de restauración documentada y ejecutada al menos una vez antes del lanzamiento.
- Las migraciones y el seed están en el repo; los assets se pueden re-subir desde la exportación.

**Entornos:**
- **Local:** Supabase CLI + Docker (o un proyecto Supabase de desarrollo), `.env.local`.
- **Preview:** despliegue automático de cada PR en Vercel; usa un proyecto Supabase de desarrollo o una rama de base de datos.
- **Producción:** Vercel Production + Supabase Free; solo se promociona desde `main` (el usuario promueve `dev` → `main`).

---

## 4. Proceso de desarrollo

### 4.1 Auditoría de los agentes heredados

Los agentes actuales vienen de otro proyecto y contienen referencias que aquí no existen: `scripts/gh-issue.sh`, `tasks/`, `.github/workflows/issues-done-on-dev.yml`, ADR-029, issues #44/#81/#128/#145 y una URL de otro repositorio. También asumen que el publisher sube cambios y abre PRs automáticamente.

| Agente | ¿Se mantiene? | Cambios propuestos |
|---|---|---|
| `sdd-master` | Sí | Reescribir sus referencias al proyecto; eliminar el modo autónomo de CI; adaptar labels, task files y flujo; terminar en revisión local por defecto. |
| `publisher` | Sí, pero **local-first** | No hacer push ni PR por defecto. Preparar rama/commit local, mostrar diff y comandos. Solo publicar con confirmación explícita del usuario. Quitar URLs, workflows y scripts del proyecto anterior. |
| `task-architect` | Sí | Añadir restricciones de World Craft: free tiers, responsividad, 2 temas, datos portables, ADRs. |
| `tdd-ddd-architect` | Sí | Enfoque pragmático: TDD en dominio y lógica crítica; no forzar DDD en CRUDs simples. |
| `qa-reviewer` | Sí | Añadir checklist de 360/768/1280 px, 2 temas, axe, Playwright y comprobación del manual. |
| `security-champion` | Sí | Añadir RLS, políticas de R2 y URLs firmadas, auth, CSP, subidas, dependencias y secretos. |
| `documentation-sync` | Sí | ADRs + manual de usuario + changelog; verificar que cada issue visible actualiza el manual. |
| **`ui-ux-designer`** (nuevo) | Sí | Diseño de tokens, componentes, especificaciones responsive, accesibilidad y revisión visual. Es el hueco más claro del equipo actual. |
| `content-curator` (opcional) | Valorar | Curaduría de tablas del juego, plantillas de entidades y textos de ejemplo. Puede ser un skill antes que un agente. |

No se propone eliminar ningún agente, pero sí **recortar** el `sdd-master` y el `publisher` para que no arrastren complejidad de un proyecto que ya no existe. El flujo debe ser comprensible y ejecutable en local antes de añadir CI.

### 4.2 Cambios propuestos en `AGENTS.md`

Se mantienen las reglas valiosas (PRs contra `dev`, responsividad, manual actualizado, dos temas) y se adaptan al contexto:

1. **PRs siempre contra `dev`**, nunca contra `main`; el usuario promueve `dev` a `main`.
2. **Responsividad obligatoria** con los tres anchos y la comprobación `scrollWidth <= innerWidth`.
3. **Manual de usuario siempre actualizado** en `docs/manual-de-usuario.md` para cualquier cambio visible.
4. **Dos modos de tema** (claro y oscuro) con variables y overrides agrupados; verificar ambos.
5. **Publisher local-first:** no subir ni abrir PR sin confirmación explícita.
6. **Solo servicios gratuitos**; cualquier excepción requiere aprobación y ADR.
7. **Datos portables y privados:** exportación/borrado y sin contenido público por defecto.
8. **Issue-first:** toda funcionalidad nace de una issue con criterios de aceptación.
9. **Definition of Done** con typecheck, lint, tests, E2E crítico, accesibilidad, responsive, manual y ADR.
10. **Dependencias justificadas:** tamaño, licencia, mantenimiento y alternativa.
11. **Español en la interfaz**, identificadores en inglés, textos centralizados.
12. **Sin secretos en el repo** y con gitleaks en CI.
13. **Migraciones reversibles y revisadas**; no editar migraciones aplicadas.
14. **Prohibido `overflow-x: hidden` en `body`/`html`** como parche.
15. **Accesibilidad AA** y respeto a `prefers-reduced-motion`.
16. **Acceso y roles:** allowlist para entrar en la app; `owner`/`editor`/`viewer` por mundo; cualquier usuario autorizado puede crear sus propios mundos.
17. **Internacionalización:** textos centralizados y claves tipadas; español en el MVP, preparado para inglés e italiano.

### 4.3 Flujo SDD adaptado

```text
Issue (label ai + status: todo)
  → adopción: task file en tasks/task-issue-N.json
  → plan (task-architect)
  → implementación (tdd-ddd-architect)
  → QA (qa-reviewer): criterios, responsive, temas, a11y
  → seguridad (security-champion)
  → documentación (documentation-sync): ADR + manual
  → publisher en modo local: rama + commit + diff, SIN push
  → el usuario prueba en local
  → publicación explícita: push + PR a dev (sin keyword de cierre)
  → merge a dev → issue cerrada por workflow o manualmente
  → el usuario promueve dev a main cuando toca
```

**Task file** (`tasks/task-issue-N.json`): título, descripción, issue, estado, criterios de aceptación, Definition of Done, plan, resultados de QA/seguridad, ADR y bloque `pr` solo cuando se publique. Se versiona en el repo.

**Estados:** `created` → `planned` → `implemented` → `validated` → `security-cleared` → `documented` → `review` → `published`. `blocked` cuando falte una decisión.

**Labels de estado:** `status: todo`, `status: in-progress`, `status: needs-review`, `status: blocked`, `status: done`.

### 4.4 Git, ramas y PRs

- `main`: versión estable; solo el usuario promueve desde `dev`.
- `dev`: integración; aquí se fusionan las PRs.
- Ramas de trabajo: `feature/issue-N-slug`, `fix/issue-N-slug`, `docs/issue-N-slug`, `chore/issue-N-slug`.
- Commits convencionales: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`, `content:`.
- PR pequeña, con resumen, issue relacionada, cambios, pruebas y capturas si hay UI. Sin keywords de cierre (`Closes #N`) porque el merge va a `dev`.
- Revisión: CI verde + QA + seguridad. El publisher no publica sin confirmación.
- `dev` se crea desde `main` al bootstrap del repositorio (issue M0-04).

### 4.5 Etiquetas e hitos

**Tipos:** `type: feature`, `type: bug`, `type: chore`, `type: docs`, `type: design`, `type: testing`, `type: refactor`, `type: content`.

**Áreas:** `area: agents`, `area: architecture`, `area: infra`, `area: data`, `area: auth`, `area: worlds`, `area: entities`, `area: graph`, `area: maps`, `area: writing`, `area: game`, `area: search`, `area: ui`, `area: docs`, `area: security`, `area: qa`.

**Estado:** `status: todo`, `status: in-progress`, `status: needs-review`, `status: blocked`, `status: done`.

**Prioridad:** `priority: p0` (bloqueante), `priority: p1` (alta), `priority: p2` (media), `priority: p3` (baja).

**Tamaño:** `size: s`, `size: m`, `size: l`, `size: xl`.

**Otros:** `ai` (lista para agentes), `needs-decision` (requiere decisión del usuario), `future` (backlog).

**Hitos:** `M0 · Proceso y fundaciones`, `M1 · Núcleo de datos y acceso`, `M2 · Mapas y grafo`, `M3 · Escritura`, `M4 · Juego creativo`, `M5 · Calidad y lanzamiento`, `Backlog`.

### 4.6 Definition of Ready / Done

**Ready:** issue con contexto, alcance, criterios de aceptación, dependencias, labels y decisión técnica si aplica.

**Done:**
- [ ] Criterios de aceptación cumplidos.
- [ ] Typecheck, lint, unit tests y build en verde.
- [ ] E2E del flujo crítico (si aplica).
- [ ] Responsive 360/768/1280 sin scroll horizontal.
- [ ] Dos temas comprobados y contraste AA.
- [ ] Accesibilidad (teclado, foco, axe) sin errores críticos.
- [ ] Manual actualizado si el cambio es visible.
- [ ] ADR si hay una decisión arquitectónica.
- [ ] Seguridad revisada (secretos, RLS, permisos, subidas).
- [ ] Datos exportables/recuperables si se añade un modelo nuevo.
- [ ] Sin servicios de pago ni dependencias injustificadas.
- [ ] Task file actualizado y PR revisada.

### 4.7 Estrategia de pruebas

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unidad | Vitest | Dados, relaciones, permisos, conteo de palabras, exportadores, validadores |
| Componentes | Testing Library | Formularios, fichas, tablas, diálogos, estados vacíos |
| Integración | Vitest + Supabase local | Server Actions, RLS, migraciones, búsqueda |
| E2E | Playwright | Login, CRUD de mundo/entidad, relaciones, grafo, mapa, escritura, exportación, juego |
| Accesibilidad | axe-core | Páginas y componentes críticos |
| Visual/responsive | Playwright | Capturas en 360/768/1280 y 2 temas |
| Rendimiento | Lighthouse CI | Presupuestos de LCP/CLS/INP y bundle |
| Seguridad | gitleaks, audit, tests RLS | Secretos, dependencias, aislamiento entre usuarios |

Los tests E2E corren contra un usuario de prueba y un mundo semilla. Los tests de RLS crean dos usuarios y verifican que ninguno puede leer ni escribir datos del otro.

### 4.8 Documentación

- `docs/plan-desarrollo.md`: este documento.
- `docs/registro-decisiones.md`: registro append-only de decisiones de producto y arquitectura.
- `docs/adr/`: decisiones arquitectónicas (contexto, decisión, consecuencias).
- `docs/manual-de-usuario.md`: manual funcional para cualquier usuario.
- `docs/arquitectura.md`: mapa de módulos y flujos (se puede generar a partir de los ADRs).
- `README.md`: arranque local, variables de entorno, scripts y despliegue.
- `CONTRIBUTING.md`: flujo, commits, ramas y calidad.
- Changelog por versión.

---

## 5. Roadmap

### 5.1 Fases y estimación

Las estimaciones son relativas y suponen trabajo a tiempo parcial con ayuda de agentes. No son fechas comprometidas.

| Fase | Objetivo | Issues | Esfuerzo orientativo | Resultado demostrable |
|---|---|---|---:|---|
| **M0 · Proceso y fundaciones** | Adaptar agentes/reglas, decidir arquitectura y dejar el esqueleto técnico | 12 | 14-18 sesiones | App desplegada en preview con login básico y diseño |
| **M1 · Núcleo de datos y acceso** | Mundos, fichas, relaciones, búsqueda, miembros y permisos | 7 | 24-32 sesiones | Se puede crear un mundo completo, compartirlo y navegarlo |
| **M2 · Mapas y grafo** | Visualizar el mundo y su geografía | 4 | 20-28 sesiones | Grafo interactivo + editor de mapas vectorial |
| **M3 · Escritura** | Escribir, versionar y exportar novelas | 4 | 24-32 sesiones | Manuscrito completo exportable a DOCX/PDF/EPUB |
| **M4 · Juego creativo** | Inspiración con dados, tablas y contenido ampliable | 4 | 12-16 sesiones | Generador de semillas de historia y packs editables |
| **M5 · Calidad y lanzamiento** | Manual, responsive, a11y, PWA, seguridad, backups y producción | 7 | 14-18 sesiones | Versión privada lista para uso real |

**Total:** 43 issues, ~108-144 sesiones. El **MVP utilizable** (M0-M3) se puede alcanzar en unas 14-20 semanas a tiempo parcial; el producto pulido completo, en 7-10 meses. Las fases M2 y M3 pueden solaparse parcialmente si se trabaja en paralelo, pero M1 es prerrequisito de ambas.

### 5.2 Dependencias principales

```text
M0-01/02 (agentes y reglas)
  └─ M0-03 (ADRs) ─ M0-08 (Supabase + datos) ─ M0-11 (keep-alive + continuidad)
  │                  └─ M0-10 (R2 + storage)
  └─ M0-04 (repo) ─ M0-05 (entorno/CI) ─ M0-06 (scaffold) ─ M0-07 (diseño) ─ M0-12 (i18n)
        └─ M1-01 (auth + allowlist) ─ M1-02 (mundos propios) ─ M1-07 (miembros/roles)
              └─ M1-03 (entidades) ─ M1-04 (relaciones)
                    ├─ M1-05 (búsqueda) ─ M1-06 (ajustes)
                    ├─ M2-01 (spike mapas) ─ M2-02 (editor) ─ M2-03 (marcadores)
                    ├─ M2-04 (grafo)
                    ├─ M3-01 (editor) ─ M3-02 (diálogos) ─ M3-03 (export) ─ M3-04 (versiones)
                    └─ M4-01 (dados) ─ M4-02 (contenido) ─ M4-03 (tablas) ─ M4-04 (packs)
                          └─ M5-01..07 (calidad y lanzamiento)
```

### 5.3 Issues

La tabla siguiente es el contrato de planificación. Cada fila se convierte en una issue de GitHub con su contexto, alcance, criterios de aceptación y dependencias. Los códigos (`M0-01`, etc.) se incluyen en el cuerpo de cada issue para mantener la trazabilidad con este documento.

#### M0 · Proceso y fundaciones

| Código | Título | Tipo | Área | Prioridad | Tamaño | Depende de |
|---|---|---|---|---|---|---|
| M0-01 | Auditar y adaptar los agentes de IA al proyecto | chore | agents | p0 | L | — |
| M0-02 | Revisar `AGENTS.md` y el flujo SDD | docs | agents | p0 | M | M0-01 |
| M0-03 | Crear los ADRs fundacionales | docs | architecture | p0 | M | M0-01, M0-02 |
| M0-04 | Configurar repositorio, ramas, etiquetas y plantillas | chore | infra | p0 | M | — |
| M0-05 | Configurar entorno de desarrollo y CI base | chore | infra | p0 | M | M0-04 |
| M0-06 | Scaffold de Next.js, TypeScript y Tailwind | chore | infra | p0 | M | M0-04, M0-05 |
| M0-07 | Sistema de diseño, temas y shell responsive | design | ui | p1 | L | M0-06 |
| M0-08 | Configurar Supabase y el modelo de datos inicial | chore | infra/data | p0 | L | M0-03, M0-06 |
| M0-09 | Documentación base del proyecto | docs | docs | p1 | S | M0-04 |
| M0-10 | Configurar Cloudflare R2 y el adaptador de almacenamiento | chore | infra | p0 | M | M0-03, M0-06 |
| M0-11 | Keep-alive y continuidad de Supabase | chore | infra | p0 | S | M0-04, M0-08 |
| M0-12 | Fundaciones de internacionalización | chore | ui | p1 | M | M0-06, M0-07 |

#### M1 · Núcleo de datos y acceso

| Código | Título | Tipo | Área | Prioridad | Tamaño | Depende de |
|---|---|---|---|---|---|---|
| M1-01 | Autenticación, allowlist y acceso a la app | feature | auth | p0 | L | M0-08 |
| M1-02 | CRUD de mundos propios y dashboard | feature | worlds | p0 | L | M0-07, M0-08, M1-01 |
| M1-03 | Entidades, fichas, plantillas y mundo de ejemplo | feature | entities | p0 | XL | M0-07, M0-08, M0-10, M1-02, M1-07 |
| M1-04 | Relaciones tipadas y backlinks | feature | entities | p0 | L | M1-03 |
| M1-05 | Búsqueda global y paleta de comandos | feature | search | p1 | L | M1-03, M1-04 |
| M1-06 | Ajustes de cuenta, preferencias y datos | feature | auth | p1 | M | M1-01 |
| M1-07 | Miembros, roles e invitaciones por mundo | feature | worlds | p0 | L | M1-01, M1-02 |

#### M2 · Mapas y grafo

| Código | Título | Tipo | Área | Prioridad | Tamaño | Depende de |
|---|---|---|---|---|---|---|
| M2-01 | Spike: validar MapLibre GL + Terra Draw y la exportación SVG | chore | maps | p1 | M | M0-06, M0-07 |
| M2-02 | Editor de mapas vectorial | feature | maps | p0 | XL | M1-02, M2-01 |
| M2-03 | Marcadores y vínculos mapa-entidad | feature | maps | p1 | L | M2-02, M1-03 |
| M2-04 | Vista de grafo interactiva | feature | graph | p0 | L | M1-04 |

#### M3 · Escritura

| Código | Título | Tipo | Área | Prioridad | Tamaño | Depende de |
|---|---|---|---|---|---|---|
| M3-01 | Editor de manuscritos y autoguardado | feature | writing | p0 | XL | M1-02, M0-07 |
| M3-02 | Herramientas de escritura y diálogos | feature | writing | p0 | L | M3-01 |
| M3-03 | Exportación e importación de manuscritos | feature | writing | p1 | L | M3-01 |
| M3-04 | Historial de versiones y papelera | feature | data | p1 | M | M3-01 |

#### M4 · Juego creativo

| Código | Título | Tipo | Área | Prioridad | Tamaño | Depende de |
|---|---|---|---|---|---|---|
| M4-01 | Motor de dados y tablas de inspiración | feature | game | p1 | L | M1-02 |
| M4-02 | Contenido inicial: contenedores, subgéneros, detonantes y tópicos | content | game | p1 | L | M4-01 |
| M4-03 | Tablas personalizadas y sesiones de inspiración | feature | game | p2 | M | M4-01 |
| M4-04 | Packs de contenido y ampliación del juego desde la app | feature | game | p2 | L | M4-01, M4-03 |

#### M5 · Calidad y lanzamiento

| Código | Título | Tipo | Área | Prioridad | Tamaño | Depende de |
|---|---|---|---|---|---|---|
| M5-01 | Manual de usuario y ayuda in-app | docs | docs | p0 | L | M1-02, M2-02, M3-01, M4-01 |
| M5-02 | Auditoría responsive y de accesibilidad | testing | qa | p0 | L | M0-07, M1-02, M2-02, M3-01 |
| M5-03 | Rendimiento y optimización | testing | qa | p1 | M | M2-02, M3-01 |
| M5-04 | PWA y experiencia móvil | feature | ui | p1 | L | M0-07, M3-01 |
| M5-05 | Revisión de seguridad y privacidad | chore | security | p0 | M | M1-01 a M4-04 |
| M5-06 | Backups, exportación/importación y recuperación | chore | infra | p0 | M | M0-08, M0-10, M0-11, M1-02 |
| M5-07 | Despliegue a producción, beta privada y lanzamiento | chore | infra | p0 | M | Todas |

#### Backlog (no se implementa en el MVP)

| Código | Título | Tipo | Área | Prioridad | Tamaño |
|---|---|---|---|---|---|
| B-01 | Colaboración en tiempo real | feature | entities | p3 | XL |
| B-02 | Wiki pública y enlaces de lectura compartidos | feature | infra | p3 | L |
| B-03 | Aplicación de escritorio con Tauri | feature | infra | p3 | XL |
| B-04 | Inspiración asistida por IA (opcional y con coste) | feature | game | p3 | L |
| B-05 | Internacionalización de la interfaz | feature | ui | p3 | M |

### 5.4 Hitos de valor

1. **"Mi mundo" (M1):** crear un mundo propio, 20 fichas y relaciones, compartirlo con un amigo con rol de lectura o edición y navegarlo. Es la base que hace útil la app.
2. **"Cartógrafo" (M2):** ver el grafo y dibujar un mapa con marcadores vinculados. Es el diferenciador visual.
3. **"Escritor" (M3):** escribir una novela con capítulos/escenas y exportarla. Es el segundo pilar del producto.
4. **"Inspiración" (M4):** generar semillas de historia con dados y tablas, y ampliar el contenido desde la propia app con tablas y packs. Es el módulo lúdico.
5. **"Listo" (M5):** manual, móvil, PWA, seguridad, backups y producción. Es la versión que se puede usar a diario.

Cada hito debe terminar con una demo funcional y una actualización del manual.

---

## 6. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Alcance demasiado amplio (mundos + mapas + novela + juego) | Alta | Alto | Fases con MVP; cada fase entrega valor; recortar funciones no esenciales; no abrir nuevas líneas hasta cerrar M1. |
| El editor de mapas es más complejo de lo previsto | Alta | Alto | Spike M2-01 antes de comprometer; alcance MVP de herramientas; plan B con SVG propio; exportación validada pronto. |
| Pérdida de datos de escritura | Media | Muy alto | Autosave local + servidor, versiones, backups, exportación; probar recuperación antes de usar la app en serio. |
| Límites o pausa de los free tiers | Media | Alto | R2 para assets (10 GB), keep-alive de Supabase, backup semanal, monitorización de uso y ruta de migración a Neon/R2; exportación de datos. |
| RLS mal configurada y fuga entre usuarios | Media | Muy alto | Tests automáticos de RLS con dos usuarios; revisión de seguridad; no confiar solo en el cliente. |
| Rendimiento del mapa/grafo en móvil | Media | Medio | Límites de features, simplificación, filtros, modo lectura en móvil, WebGL. |
| Complejidad de RSC/Server Actions | Media | Medio | Formación gradual, patrones claros, evitar over-engineering, tests de integración. |
| Dependencia de Vercel/Supabase | Baja | Medio | SQL estándar, StorageAdapter, exportación, ADR de migración. |
| Licencias de extensiones Pro (Tiptap) | Baja | Medio | Usar solo núcleo MIT; implementar historial/comentarios propios; revisar licencias de fuentes. |
| Correos de Auth no llegan | Media | Medio | Email/contraseña como método principal; Resend Free como SMTP; documentar. |
| Falta de tiempo/constancia | Media | Alto | Issues pequeñas, hitos semanales, Definition of Done, automatización de calidad. |
| Estética "genérica" o poco usable | Media | Medio | Agente ui-ux-designer, sistema de diseño, pruebas con usuario, 2 temas y responsive desde el inicio. |

---

## 7. Decisiones cerradas

Las ocho decisiones se cerraron el **12/11/2026**. El registro completo, con contexto y consecuencias, está en [`docs/registro-decisiones.md`](registro-decisiones.md).

| # | Tema | Decisión |
|---|---|---|
| 1 | Stack | Supabase Free + Vercel Hobby, con archivos en Cloudflare R2 Free y keep-alive/backups para Supabase. |
| 2 | Temas | Dos modos: Claro y Oscuro. |
| 3 | Mapas | Fondo raster opcional y georreferenciado; el mapa sigue siendo vectorial por defecto. |
| 4 | Acceso | Allowlist para la app; roles `owner`/`editor`/`viewer` por mundo; cada usuario autorizado puede crear sus propios mundos. |
| 5 | Idioma | Español en el MVP, con textos centralizados y preparación para inglés e italiano. |
| 6 | Dominio | Subdominio de Vercel en el MVP; dominio propio, opción futura. |
| 7 | Publicación | Revisión local primero; PR a `dev` cuando el usuario apruebe. |
| 8 | Juego | Contenido inicial de fantasía, ciencia ficción, terror y contemporáneo; ampliable desde la app con tablas y packs. |

No quedan decisiones abiertas que bloqueen el inicio del desarrollo. Las dudas de implementación se resolverán en ADRs y en las issues correspondientes.

---

## 8. Criterios de éxito

El proyecto se considerará exitoso cuando:

- Se puedan crear y mantener varios mundos sin pérdida de datos.
- Crear un mundo con 20 fichas y sus relaciones lleve menos de 10 minutos y sea comprensible sin manual.
- El grafo de 200 nodos cargue en menos de 2 segundos y sea navegable en escritorio y móvil.
- Un mapa con 500 elementos se pueda dibujar, guardar y exportar a SVG sin pérdida de calidad.
- Se puedan escribir 2.000 palabras sin conexión sin perder nada y exportarlas a DOCX.
- Las pantallas principales funcionen a 360, 768 y 1280 px, en los dos temas, sin scroll horizontal.
- Un test de RLS demuestre que un usuario no puede acceder a datos de otro y que un `viewer` no puede editar.
- Un usuario autorizado pueda crear su propio mundo y compartir otro con un amigo sin mezclar datos.
- La restauración de una copia de seguridad se haya probado con éxito.
- El coste mensual de infraestructura sea 0 € (sin dominio propio).
- El manual de usuario cubra todas las funciones visibles.

---

## Anexo A. Glosario

- **Mundo:** contenedor de nivel superior con fichas, mapas, manuscritos y contenido de juego.
- **Entidad/ficha:** cualquier elemento del mundo (personaje, lugar, cultura...).
- **Relación:** vínculo tipado entre dos entidades.
- **Grafo:** visualización de entidades y relaciones.
- **GeoJSON:** formato abierto de datos geográficos vectoriales.
- **Manuscrito:** obra de escritura, compuesta por libros, capítulos y escenas.
- **Semilla:** combinación guardada de resultados de dados/tablas.
- **RLS:** Row Level Security de PostgreSQL; permisos por fila.
- **ADR:** Architecture Decision Record.
- **Free tier:** plan gratuito de un servicio.

## Anexo B. Referencias

Consultadas el 11/11/2026:

- vvd.world — https://vvd.world/
- Next.js — https://nextjs.org/docs
- Supabase Pricing — https://supabase.com/pricing
- Supabase: pausa de proyectos Free — https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase Auth/RLS — https://supabase.com/docs
- Vercel Limits — https://vercel.com/docs/limits
- Cloudflare R2 Pricing — https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 S3 API — https://developers.cloudflare.com/r2/api/s3/
- Neon Pricing — https://neon.com/pricing
- MapLibre GL JS — https://maplibre.org/maplibre-gl-js/docs/
- Terra Draw — https://github.com/JamesLMilner/terra-draw
- React Flow — https://reactflow.dev/
- Tiptap — https://tiptap.dev/docs/editor/getting-started/overview
- Drizzle ORM — https://orm.drizzle.team/
- Playwright — https://playwright.dev/
- Serwist — https://serwist.pages.dev/

## Anexo C. Convención de estados de una issue

```text
status: todo → status: in-progress → status: needs-review → status: done
                      ↓
                status: blocked
```

- `todo`: lista para adoptar.
- `in-progress`: en implementación.
- `needs-review`: PR creada o cambio local pendiente de revisión.
- `blocked`: falta una decisión o hay un fallo repetido.
- `done`: fusionada en `dev` y verificada.

---

## Anexo D. Correspondencia con las issues de GitHub

Creadas el 11/11/2026 y actualizadas el 12/11/2026. La issue #1 es la planificación original; las **43 issues** siguientes implementan el plan (38 originales + 5 nuevas por las decisiones cerradas).

| Código | Issue | Título | Hito |
|---|---|---|---|
| M0-01 | [#2](https://github.com/gonzalitojh/world-craft/issues/2) | Auditar y adaptar los agentes de IA al proyecto | M0 |
| M0-02 | [#3](https://github.com/gonzalitojh/world-craft/issues/3) | Revisar AGENTS.md y el flujo SDD | M0 |
| M0-03 | [#4](https://github.com/gonzalitojh/world-craft/issues/4) | Crear los ADRs fundacionales | M0 |
| M0-04 | [#5](https://github.com/gonzalitojh/world-craft/issues/5) | Configurar repositorio, ramas, etiquetas y plantillas | M0 |
| M0-05 | [#6](https://github.com/gonzalitojh/world-craft/issues/6) | Configurar entorno de desarrollo y CI base | M0 |
| M0-06 | [#7](https://github.com/gonzalitojh/world-craft/issues/7) | Scaffold de Next.js, TypeScript y Tailwind | M0 |
| M0-07 | [#8](https://github.com/gonzalitojh/world-craft/issues/8) | Sistema de diseño, temas y shell responsive | M0 |
| M0-08 | [#9](https://github.com/gonzalitojh/world-craft/issues/9) | Configurar Supabase y el modelo de datos inicial | M0 |
| M0-09 | [#10](https://github.com/gonzalitojh/world-craft/issues/10) | Documentación base del proyecto | M0 |
| M0-10 | [#40](https://github.com/gonzalitojh/world-craft/issues/40) | Configurar Cloudflare R2 y el adaptador de almacenamiento | M0 |
| M0-11 | [#41](https://github.com/gonzalitojh/world-craft/issues/41) | Keep-alive y continuidad de Supabase | M0 |
| M0-12 | [#42](https://github.com/gonzalitojh/world-craft/issues/42) | Fundaciones de internacionalización | M0 |
| M1-01 | [#11](https://github.com/gonzalitojh/world-craft/issues/11) | Autenticación, allowlist y acceso a la app | M1 |
| M1-02 | [#12](https://github.com/gonzalitojh/world-craft/issues/12) | CRUD de mundos propios y dashboard | M1 |
| M1-03 | [#13](https://github.com/gonzalitojh/world-craft/issues/13) | Entidades, fichas, plantillas y mundo de ejemplo | M1 |
| M1-04 | [#14](https://github.com/gonzalitojh/world-craft/issues/14) | Relaciones tipadas y backlinks | M1 |
| M1-05 | [#15](https://github.com/gonzalitojh/world-craft/issues/15) | Búsqueda global y paleta de comandos | M1 |
| M1-06 | [#16](https://github.com/gonzalitojh/world-craft/issues/16) | Ajustes de cuenta, preferencias y datos | M1 |
| M1-07 | [#43](https://github.com/gonzalitojh/world-craft/issues/43) | Miembros, roles e invitaciones por mundo | M1 |
| M2-01 | [#17](https://github.com/gonzalitojh/world-craft/issues/17) | Spike: validar MapLibre GL + Terra Draw y la exportación SVG | M2 |
| M2-02 | [#18](https://github.com/gonzalitojh/world-craft/issues/18) | Editor de mapas vectorial | M2 |
| M2-03 | [#19](https://github.com/gonzalitojh/world-craft/issues/19) | Marcadores y vínculos mapa-entidad | M2 |
| M2-04 | [#20](https://github.com/gonzalitojh/world-craft/issues/20) | Vista de grafo interactiva | M2 |
| M3-01 | [#21](https://github.com/gonzalitojh/world-craft/issues/21) | Editor de manuscritos y autoguardado | M3 |
| M3-02 | [#22](https://github.com/gonzalitojh/world-craft/issues/22) | Herramientas de escritura y diálogos | M3 |
| M3-03 | [#23](https://github.com/gonzalitojh/world-craft/issues/23) | Exportación e importación de manuscritos | M3 |
| M3-04 | [#24](https://github.com/gonzalitojh/world-craft/issues/24) | Historial de versiones y papelera | M3 |
| M4-01 | [#25](https://github.com/gonzalitojh/world-craft/issues/25) | Motor de dados y tablas de inspiración | M4 |
| M4-02 | [#26](https://github.com/gonzalitojh/world-craft/issues/26) | Contenido inicial: contenedores, subgéneros, detonantes y tópicos | M4 |
| M4-03 | [#27](https://github.com/gonzalitojh/world-craft/issues/27) | Tablas personalizadas y sesiones de inspiración | M4 |
| M4-04 | [#44](https://github.com/gonzalitojh/world-craft/issues/44) | Packs de contenido y ampliación del juego desde la app | M4 |
| M5-01 | [#28](https://github.com/gonzalitojh/world-craft/issues/28) | Manual de usuario y ayuda in-app | M5 |
| M5-02 | [#29](https://github.com/gonzalitojh/world-craft/issues/29) | Auditoría responsive y de accesibilidad | M5 |
| M5-03 | [#30](https://github.com/gonzalitojh/world-craft/issues/30) | Rendimiento y optimización | M5 |
| M5-04 | [#31](https://github.com/gonzalitojh/world-craft/issues/31) | PWA y experiencia móvil | M5 |
| M5-05 | [#32](https://github.com/gonzalitojh/world-craft/issues/32) | Revisión de seguridad y privacidad | M5 |
| M5-06 | [#33](https://github.com/gonzalitojh/world-craft/issues/33) | Backups, exportación/importación y recuperación | M5 |
| M5-07 | [#34](https://github.com/gonzalitojh/world-craft/issues/34) | Despliegue a producción, beta privada y lanzamiento | M5 |
| B-01 | [#35](https://github.com/gonzalitojh/world-craft/issues/35) | Colaboración en tiempo real | Backlog |
| B-02 | [#36](https://github.com/gonzalitojh/world-craft/issues/36) | Wiki pública y enlaces de lectura compartidos | Backlog |
| B-03 | [#37](https://github.com/gonzalitojh/world-craft/issues/37) | Aplicación de escritorio con Tauri | Backlog |
| B-04 | [#38](https://github.com/gonzalitojh/world-craft/issues/38) | Inspiración asistida por IA (opcional y con coste) | Backlog |
| B-05 | [#39](https://github.com/gonzalitojh/world-craft/issues/39) | Internacionalización de la interfaz | Backlog |

*Fin del plan.*