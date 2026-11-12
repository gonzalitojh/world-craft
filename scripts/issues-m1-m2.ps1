. "$PSScriptRoot\issue-helper.ps1"

$issues = @(
    @{
        code = 'M1-01'
        title = 'Autenticación, allowlist y acceso a la app'
        milestone = 3
        labels = @('ai', 'type: feature', 'area: auth', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M1-01` · Fase M1 · Depende de: M0-08

## Contexto

Todo el contenido debe estar protegido. No hay registro público ni comunidad: solo el propietario y las personas autorizadas. La allowlist concede acceso a la **aplicación**, no a los mundos de otras personas.

## Alcance

- Integrar Supabase Auth con `@supabase/ssr` y refresco de sesión en middleware.
- Login con email/contraseña y enlace mágico; recuperación de contraseña.
- Registro cerrado mediante tabla `allowed_emails`.
- Cualquier usuario autorizado puede crear sus propios mundos; será su propietario.
- Canje de invitaciones a un mundo con rol `viewer` o `editor`, token de un solo uso, ligado al correo y con caducidad. La gestión completa de miembros se realiza en M1-07.
- Creación automática de perfil al primer acceso.
- Cierre de sesión y revocación de sesiones.
- Mensajes de error claros y rate limiting básico.

## Criterios de aceptación

- [ ] Un correo no autorizado no puede crear cuenta ni acceder.
- [ ] Rutas privadas redirigen a login si no hay sesión.
- [ ] Un usuario autorizado puede crear un mundo propio y no ve los mundos de otros.
- [ ] Canje de invitación → membresía → acceso al mundo funciona de extremo a extremo.
- [ ] Un `viewer` no puede editar; un `editor` sí.
- [ ] RLS impide acceder a mundos ajenos aunque se manipule la URL.
- [ ] Test E2E de login, logout, recuperación y canje de invitación.
- [ ] Manual actualizado.

## Notas

El SMTP integrado de Supabase puede bastar; si falla, configurar Resend Free. No abrir registro público. La separación entre acceso a la app y acceso a un mundo es una regla de seguridad, no solo de UI.
'@
    },
    @{
        code = 'M1-02'
        title = 'CRUD de mundos propios y dashboard'
        milestone = 3
        labels = @('ai', 'type: feature', 'area: worlds', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M1-02` · Fase M1 · Depende de: M0-07, M0-08, M1-01

## Contexto

El mundo es el contenedor de nivel superior. Sin esta pantalla no se puede usar nada más. Cada usuario autorizado puede crear sus propios mundos y ver también los que le compartan.

## Alcance

- Lista de mundos en los que el usuario es miembro (propios o compartidos), con tarjetas, portada, estado y progreso.
- Crear, editar, archivar, duplicar y eliminar (con confirmación). El creador es el `owner` del mundo.
- Campos: nombre, slug, resumen, descripción, portada, géneros, estado.
- Dashboard del mundo: contadores, actividad reciente, accesos rápidos y estado vacío.
- Navegación al mundo y selector de mundo.
- Aislamiento entre mundos y visibilidad según membresía; la gestión completa de roles llega en M1-07.

## Criterios de aceptación

- [ ] CRUD completo con validación y errores claros.
- [ ] Portada subida a R2 y recortada correctamente.
- [ ] Un mundo duplicado no comparte datos mutables.
- [ ] Archivar no borra y se puede restaurar.
- [ ] Un usuario invitado puede crear su propio mundo y no ve los mundos de otros.
- [ ] Responsive y dos temas.
- [ ] E2E de crear → editar → duplicar → archivar.
- [ ] Manual actualizado.

## Notas

El dashboard debe ser útil, no un escaparate de métricas vacías. La lista solo muestra mundos propios o compartidos; nunca mundos de terceros.
'@
    },
    @{
        code = 'M1-03'
        title = 'Entidades, fichas, plantillas y mundo de ejemplo'
        milestone = 3
        labels = @('ai', 'type: feature', 'area: entities', 'priority: p0', 'size: xl', 'status: todo')
        body = @'
Código de plan: `M1-03` · Fase M1 · Depende de: M0-07, M0-08, M0-10, M1-02, M1-07

## Contexto

Es el corazón de World Craft: fichas ricas para cualquier elemento del mundo.

## Alcance

- Tipos del sistema: personaje, lugar, ciudad, nación, cultura, raza/especie, organización, religión, deidad, magia, objeto, criatura, idioma, evento, conflicto, tecnología, flora/fauna y concepto.
- Tipos personalizados por mundo con icono, color y campos.
- CRUD de entidades con nombre, alias, resumen, descripción rica, imagen, galería, etiquetas, atributos y estado.
- Editor Tiptap básico con menciones y enlaces internos.
- Autoguardado y creación rápida.
- Lista/grid con filtros, orden y favoritos.
- Plantillas de entidad y un mundo de ejemplo sembrado.
- Papelera y restauración.

## Criterios de aceptación

- [ ] Se pueden crear los 18 tipos del sistema y tipos personalizados.
- [ ] Los campos personalizados se guardan y se validan.
- [ ] Imágenes subidas a R2, comprimidas y visibles en los dos temas.
- [ ] Autoguardado sin pérdidas al recargar.
- [ ] Búsqueda por nombre/alias desde la lista.
- [ ] Mundo de ejemplo reproducible.
- [ ] Responsive y accesible.
- [ ] E2E de crear ficha con imagen, editar y borrar/restaurar.
- [ ] Manual actualizado.

## Notas

Si la issue es demasiado grande, dividir en "tipos y CRUD" y "editor rico/plantillas" sin cambiar el alcance final.
'@
    },
    @{
        code = 'M1-04'
        title = 'Relaciones tipadas y backlinks'
        milestone = 3
        labels = @('ai', 'type: feature', 'area: entities', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M1-04` · Fase M1 · Depende de: M1-03

## Contexto

Las fichas aisladas no cuentan una historia. Las relaciones son la base del grafo y de la navegación.

## Alcance

- Tipos de relación del sistema y personalizados, con etiqueta directa e inversa.
- Crear, editar y eliminar relaciones desde una ficha o desde el grafo.
- Campos: origen, destino, tipo, etiqueta, notas, fuerza/importancia.
- Lista de relaciones en la ficha y backlinks en la entidad destino.
- Validación: sin autorrelaciones, sin duplicados exactos, sin entidades de otro mundo.
- Acciones rápidas y estados vacíos.

## Criterios de aceptación

- [ ] CRUD de relaciones con etiquetas inversas correctas.
- [ ] Backlinks visibles en ambas fichas.
- [ ] No se pueden crear relaciones entre mundos distintos.
- [ ] Eliminar una entidad elimina o marca sus relaciones de forma coherente.
- [ ] E2E de crear relación y navegar en ambos sentidos.
- [ ] Manual actualizado.

## Notas

El modelo debe soportar relaciones N:M y varios tipos entre el mismo par.
'@
    },
    @{
        code = 'M1-05'
        title = 'Búsqueda global y paleta de comandos'
        milestone = 3
        labels = @('ai', 'type: feature', 'area: search', 'priority: p1', 'size: l', 'status: todo')
        body = @'
Código de plan: `M1-05` · Fase M1 · Depende de: M1-03, M1-04

## Contexto

Cuando un mundo crece, encontrar una ficha rápido es esencial. La paleta también acelera la creación y navegación.

## Alcance

- Búsqueda full-text en español sobre entidades, relaciones, mapas, manuscritos y escenas.
- Búsqueda difusa por nombre/alias con `pg_trgm`.
- Filtros por mundo, tipo, etiqueta y estado.
- Resultados con resaltado, teclado y recientes.
- Paleta de comandos (`Ctrl/Cmd + K`): navegar, crear entidad, abrir mundo, cambiar tema.
- Favoritos y recientes.
- Índices y paginación para mantener latencia baja.

## Criterios de aceptación

- [ ] Búsqueda funcional con 5.000 entidades en menos de 300 ms.
- [ ] Resultados relevantes y sin duplicados.
- [ ] Paleta navegable solo con teclado.
- [ ] Filtros combinables y persistentes en la URL.
- [ ] Sin resultados: estado vacío útil.
- [ ] E2E de búsqueda y paleta.
- [ ] Manual actualizado.

## Notas

Empezar con Postgres FTS; no añadir un motor externo (Algolia/Meilisearch) para el MVP.
'@
    },
    @{
        code = 'M1-06'
        title = 'Ajustes de cuenta, preferencias y datos'
        milestone = 3
        labels = @('ai', 'type: feature', 'area: auth', 'priority: p1', 'size: m', 'status: todo')
        body = @'
Código de plan: `M1-06` · Fase M1 · Depende de: M1-01

## Contexto

El usuario necesita controlar su perfil, preferencias y datos personales.

## Alcance

- Perfil: nombre visible, avatar, email (solo lectura).
- Preferencias: tema claro/oscuro, tamaño de fuente del editor, reducir movimiento, idioma (español; estructura preparada para inglés/italiano).
- Gestión de sesiones y cierre de sesión global.
- Exportar datos de la cuenta (JSON).
- Eliminar cuenta con confirmación fuerte y periodo de gracia.
- Uso de almacenamiento y limpieza de assets huérfanos.

## Criterios de aceptación

- [ ] Preferencias persistidas y aplicadas al recargar.
- [ ] Exportación de cuenta descargable y completa.
- [ ] Borrado de cuenta elimina datos personales y memberships.
- [ ] Confirmaciones claras e irreversibles.
- [ ] Responsive y dos temas.
- [ ] E2E de cambiar preferencias y exportar.
- [ ] Manual actualizado.

## Notas

No incluir facturación ni planes; la app es personal y gratuita.
'@
    },
    @{
        code = 'M2-01'
        title = 'Spike: validar MapLibre GL + Terra Draw y la exportación SVG'
        milestone = 4
        labels = @('ai', 'type: chore', 'area: maps', 'priority: p1', 'size: m', 'status: todo')
        body = @'
Código de plan: `M2-01` · Fase M2 · Depende de: M0-06, M0-07

## Contexto

El editor de mapas es la función de mayor riesgo técnico. Antes de construirlo hay que validar que MapLibre + Terra Draw cubren dibujo vectorial, fondo raster, gestos y exportación SVG.

## Alcance

- Página de spike aislada con MapLibre + Terra Draw.
- Estilo de mapa fantástico (papel/tinta) sin tiles externos.
- Capas GeoJSON de polígonos, líneas y puntos; fondo raster georreferenciado.
- Modos de dibujo, selección y edición de vértices.
- Guardar/cargar un documento JSON.
- Exportar SVG vectorial y PNG; comprobar que el SVG conserva calidad.
- Prueba táctil en móvil y rendimiento con ~500 elementos.
- Documentar resultados y recomendación; actualizar ADR-006 si hace falta.

## Criterios de aceptación

- [ ] Demo funcional en una ruta interna.
- [ ] 500 polígonos con pan/zoom fluido en un portátil medio.
- [ ] SVG exportado se abre correctamente y no está rasterizado.
- [ ] Gestos táctiles básicos funcionan.
- [ ] Documento con riesgos, límites y plan B (SVG propio).
- [ ] Decisión validada por el usuario.

## Notas

Timebox: 2-3 sesiones. No convertir el spike en el editor final; solo validar.
'@
    },
    @{
        code = 'M2-02'
        title = 'Editor de mapas vectorial'
        milestone = 4
        labels = @('ai', 'type: feature', 'area: maps', 'priority: p0', 'size: xl', 'status: todo')
        body = @'
Código de plan: `M2-02` · Fase M2 · Depende de: M1-02, M2-01

## Contexto

Los mapas son el diferenciador visual de World Craft. Deben ser vectoriales, escalables y agradables de usar.

## Alcance

- CRUD de mapas por mundo (mundo, región, ciudad, interior).
- Editor con capas: terreno, agua, costas, rutas, regiones, puntos, etiquetas e iconos.
- Fondo raster opcional y georreferenciado para calcar mapas dibujados a mano.
- Herramientas: seleccionar, mover, editar vértices, dibujar polígono/línea/punto, texto, borrar, duplicar, deshacer/rehacer, snap, medir, escala y leyenda.
- Estilos por capa y por feature; visibilidad, bloqueo y orden Z.
- Guardar/cargar documento GeoJSON + estilos; miniaturas.
- Exportar SVG, PNG y GeoJSON; importar GeoJSON.
- Modo lectura y responsive (edición completa en escritorio; consulta y edición básica en móvil).

## Criterios de aceptación

- [ ] Crear un mapa con 5 capas y 100 elementos, guardarlo y recargarlo sin pérdida.
- [ ] Deshacer/rehacer coherente.
- [ ] Exportar SVG/PNG con calidad y escala correctas.
- [ ] Importar un GeoJSON válido y rechazar uno inválido.
- [ ] Sin scroll horizontal a 360/768/1280.
- [ ] Dos temas aplicados al estilo del mapa.
- [ ] E2E de crear, dibujar, guardar y exportar.
- [ ] Manual actualizado.

## Notas

Si M2-01 falla, esta issue se replantea con el plan B (SVG propio) antes de empezar.
'@
    },
    @{
        code = 'M2-03'
        title = 'Marcadores y vínculos mapa-entidad'
        milestone = 4
        labels = @('ai', 'type: feature', 'area: maps', 'priority: p1', 'size: l', 'status: todo')
        body = @'
Código de plan: `M2-03` · Fase M2 · Depende de: M2-02, M1-03

## Contexto

Un mapa es mucho más útil si sus lugares llevan a las fichas del mundo.

## Alcance

- Herramienta de marcador y vínculo a una entidad.
- Popup con nombre, tipo, imagen y enlace a la ficha.
- Backlinks en la entidad: "aparece en estos mapas".
- Filtros por tipo de entidad y capa.
- Galería de mapas del mundo y miniaturas.
- Enlace privado de solo lectura (token) para compartir un mapa con un amigo, si se aprueba.
- Accesibilidad de marcadores (foco, teclado, texto alternativo).

## Criterios de aceptación

- [ ] Crear marcador, vincular entidad y navegar en ambos sentidos.
- [ ] Los marcadores se mueven y eliminan de forma coherente.
- [ ] Filtros y capas afectan a los marcadores.
- [ ] Enlace de lectura respeta permisos y caducidad.
- [ ] Responsive y accesible.
- [ ] E2E de marcador → ficha → mapa.
- [ ] Manual actualizado.

## Notas

Los marcadores pueden ser features GeoJSON con `entityId` en propiedades.
'@
    },
    @{
        code = 'M2-04'
        title = 'Vista de grafo interactiva'
        milestone = 4
        labels = @('ai', 'type: feature', 'area: graph', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M2-04` · Fase M2 · Depende de: M1-04

## Contexto

El grafo permite descubrir conexiones que no se ven en una lista. Es una vista de navegación, no un adorno.

## Alcance

- React Flow con nodos personalizados (tipo, nombre, imagen, color).
- Aristás tipadas, etiquetas y dirección.
- Filtros por tipo de entidad y de relación.
- Búsqueda, foco en un nodo, expansión de vecinos y ocultar tipos.
- Layout automático con ELK.js y posiciones manuales guardadas.
- Minimapa, controles de zoom y exportar PNG/SVG.
- Panel lateral con ficha resumida y acción "abrir ficha".
- Rendimiento y accesibilidad (teclado, foco, textos alternativos).

## Criterios de aceptación

- [ ] Un grafo de 200 nodos y 400 aristas carga en menos de 2 s.
- [ ] Filtros, foco y expansión funcionan sin perder posición.
- [ ] Posiciones manuales persisten por usuario.
- [ ] Exportación legible.
- [ ] Navegación por teclado y contraste AA.
- [ ] Responsive; en móvil se puede consultar.
- [ ] E2E de abrir grafo, filtrar y abrir ficha.
- [ ] Manual actualizado.

## Notas

Si se superan ~1.000 nodos, añadir agrupación/carga bajo demanda; no introducir Sigma.js en el MVP.
'@
    }
)

if (-not $env:WC_SKIP_CREATE) { foreach ($issue in $issues) { New-WCIssue -Issue $issue } }
