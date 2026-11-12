. "$PSScriptRoot\issue-helper.ps1"

$issues = @(
    @{
        code = 'M3-01'
        title = 'Editor de manuscritos y autoguardado'
        milestone = 5
        labels = @('ai', 'type: feature', 'area: writing', 'priority: p0', 'size: xl', 'status: todo')
        body = @'
Código de plan: `M3-01` · Fase M3 · Depende de: M1-02, M0-07

## Contexto

El segundo pilar de World Craft es escribir. El editor debe ser fiable antes que tener muchas florituras: perder texto es inaceptable.

## Alcance

- Biblioteca de obras: novela, novella, relato y saga, con estado y objetivo.
- Estructura obra → libros/partes → capítulos → escenas.
- Editor Tiptap con formato básico, separadores de escena y notas.
- Lista de escenas con estado, POV, lugar y recuento de palabras.
- Autoguardado local (IndexedDB) y remoto con debounce y control de versión.
- Recuperación tras recarga, cierre o pérdida de red.
- Modo lectura/impresión y responsive.

## Criterios de aceptación

- [ ] Crear una obra con 3 libros, 10 capítulos y 30 escenas.
- [ ] Escribir 2.000 palabras y recargar sin perder nada.
- [ ] Escribir sin conexión y sincronizar al volver.
- [ ] Conflicto de versión detectado y resuelto sin sobrescribir a ciegas.
- [ ] Recuento de palabras correcto.
- [ ] Responsive y dos temas.
- [ ] E2E de escribir, recargar y recuperar.
- [ ] Manual actualizado.

## Notas

No implementar colaboración en tiempo real. El autoguardado y la recuperación son la prioridad.
'@
    },
    @{
        code = 'M3-02'
        title = 'Herramientas de escritura y diálogos'
        milestone = 5
        labels = @('ai', 'type: feature', 'area: writing', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M3-02` · Fase M3 · Depende de: M3-01

## Contexto

El usuario pidió expresamente herramientas dedicadas a la escritura de novelas, como los diálogos. No basta con un editor genérico.

## Alcance

- Modo diálogo: detectar rayas, asignar hablante, autocompletar personajes y resaltar interlocutores.
- Menciones a fichas de personaje/lugar con enlace.
- Modo concentración y modo máquina de escribir.
- Objetivos diarios/semanales, racha y estadísticas de sesión.
- Buscar y reemplazar.
- Corrector ortográfico nativo y diccionario personal.
- Notas de escena, POV, lugar y fecha de la historia.
- Atajos de teclado documentados.

## Criterios de aceptación

- [ ] Formatear un diálogo con hablante y mantenerlo al recargar.
- [ ] Autocompletar personajes del mundo actual.
- [ ] Modo concentración y máquina de escribir estables.
- [ ] Objetivos y estadísticas correctos.
- [ ] Buscar/reemplazar con confirmación y deshacer.
- [ ] Funciona en móvil.
- [ ] E2E del flujo de diálogo.
- [ ] Manual actualizado.

## Notas

El formato de diálogo debe ser flexible: novela española con raya, pero también guion y comillas.
'@
    },
    @{
        code = 'M3-03'
        title = 'Exportación e importación de manuscritos'
        milestone = 5
        labels = @('ai', 'type: feature', 'area: writing', 'priority: p1', 'size: l', 'status: todo')
        body = @'
Código de plan: `M3-03` · Fase M3 · Depende de: M3-01

## Contexto

El texto debe poder salir de la app con un formato de manuscrito profesional y volver a entrar sin perder estructura.

## Alcance

- Exportar a DOCX, PDF, EPUB y Markdown.
- Formato de manuscrito: portada, título, autor, capítulos, escenas, sangría, interlineado y numeración.
- Vista previa antes de exportar.
- Importar DOCX (`mammoth`) y Markdown conservando capítulos/escenas.
- Descarga directa y nombre de archivo correcto.
- Tests de exportación y round-trip.

## Criterios de aceptación

- [ ] Exportar una obra de 10 capítulos a DOCX, PDF, EPUB y Markdown.
- [ ] El DOCX se abre en Word/LibreOffice sin errores.
- [ ] El EPUB es válido y se abre en un lector.
- [ ] La importación recrea la estructura de capítulos/escenas.
- [ ] El round-trip Markdown conserva formato esencial.
- [ ] E2E de exportar e importar.
- [ ] Manual actualizado.

## Notas

Para PDF, empezar con impresión CSS o `@react-pdf/renderer`; no montar un servicio externo de pago.
'@
    },
    @{
        code = 'M3-04'
        title = 'Historial de versiones y papelera'
        milestone = 5
        labels = @('ai', 'type: feature', 'area: data', 'priority: p1', 'size: m', 'status: todo')
        body = @'
Código de plan: `M3-04` · Fase M3 · Depende de: M3-01

## Contexto

El autoguardado evita pérdidas, pero no protege de un borrado accidental o de una edición equivocada. Hacen falta versiones y papelera.

## Alcance

- Snapshots automáticos y manuales de escenas.
- Lista de versiones con fecha, autor, etiqueta y recuento de palabras.
- Vista de diferencias y restauración con confirmación.
- Papelera de entidades, mapas y escenas con restauración.
- Retención configurable y purga programada.
- Historial de cambios de entidades (al menos descripción).

## Criterios de aceptación

- [ ] Crear snapshot, editar, restaurar y recuperar el estado anterior.
- [ ] Papelera con restauración y borrado definitivo.
- [ ] Retención y purga documentadas.
- [ ] Permisos: solo owner/editor pueden restaurar.
- [ ] E2E de restaurar una escena.
- [ ] Manual actualizado.

## Notas

No contratar la extensión Pro de historial de Tiptap; implementar snapshots propios.
'@
    },
    @{
        code = 'M4-01'
        title = 'Motor de dados y tablas de inspiración'
        milestone = 6
        labels = @('ai', 'type: feature', 'area: game', 'priority: p1', 'size: l', 'status: todo')
        body = @'
Código de plan: `M4-01` · Fase M4 · Depende de: M1-02

## Contexto

El usuario quiere una herramienta de "juego" que proponga contenedores, subgéneros, detonantes y tópicos literarios mediante tiradas de dados.

## Alcance

- Notación de dados (`1d20`, `2d6+1`, ventaja/desventaja) y resultados.
- RNG con semilla para tiradas reproducibles.
- Tablas con pesos, etiquetas y categorías.
- Flujo de inspiración: una tirada por categoría, bloquear/rerolear, combinar y guardar.
- Historial de sesiones y semilla visible.
- Vinculación de una semilla a un mundo/proyecto.
- UI de mesa de juego, responsive y accesible.

## Criterios de aceptación

- [ ] Tiradas correctas y reproducibles con la misma semilla.
- [ ] Pesos respetados en una muestra grande.
- [ ] Flujo de inspiración completo con bloqueo/reroll.
- [ ] Sesión guardada y recuperable.
- [ ] Tests unitarios del motor y de los pesos.
- [ ] Responsive y dos temas.
- [ ] Manual actualizado.

## Notas

No usar servicios de IA en el MVP. El contenido es local y determinista.
'@
    },
    @{
        code = 'M4-02'
        title = 'Contenido inicial: contenedores, subgéneros, detonantes y tópicos'
        milestone = 6
        labels = @('ai', 'type: content', 'area: game', 'priority: p1', 'size: l', 'status: todo')
        body = @'
Código de plan: `M4-02` · Fase M4 · Depende de: M4-01

## Contexto

El motor no vale nada sin contenido de calidad. Hace falta una base editorial en español, variada y reutilizable.

## Alcance

- 40-60 entradas por categoría: contenedores, subgéneros, detonantes y tópicos literarios.
- Etiquetas de género/tono, pesos y variantes.
- Redacción original en español, sin copiar textos protegidos.
- Revisión editorial: claridad, variedad, estereotipos y nivel de edad.
- Seed reproducible y documentación de licencia/atribución.
- Mínimo 160 entradas totales.

## Criterios de aceptación

- [ ] 160+ entradas sin duplicados evidentes.
- [ ] Cada entrada tiene texto, etiquetas y peso.
- [ ] Variedad de géneros y tonos.
- [ ] Sin contenido plagiado ni marcas registradas.
- [ ] Seed aplicable y testeado.
- [ ] Revisión editorial registrada.

## Notas

El contenido inicial es el punto de partida: se puede ampliar desde la propia app con tablas y packs (M4-04), sin modificar código. El contenido debe inspirar, no sustituir la escritura.
'@
    },
    @{
        code = 'M4-03'
        title = 'Tablas personalizadas y sesiones de inspiración'
        milestone = 6
        labels = @('ai', 'type: feature', 'area: game', 'priority: p2', 'size: m', 'status: todo')
        body = @'
Código de plan: `M4-03` · Fase M4 · Depende de: M4-01

## Contexto

Cada autor tiene sus propias obsesiones. Poder crear tablas propias multiplica el valor del generador.

## Alcance

- CRUD de tablas y entradas personalizadas por mundo.
- Importar/exportar tablas en JSON.
- Validación de pesos y texto.
- Sesiones con notas, semilla y resultados.
- Historial filtrable y eliminación.
- Duplicar una tabla del sistema como punto de partida.

## Criterios de aceptación

- [ ] Crear una tabla, añadir entradas y usarla en una tirada.
- [ ] Import/export round-trip.
- [ ] Sesiones con notas y semilla.
- [ ] Validación y errores claros.
- [ ] E2E de tabla personalizada.
- [ ] Manual actualizado.

## Notas

Las tablas globales del sistema son de solo lectura; se duplican para editar. M4-04 añade packs de contenido y la ampliación del juego desde la app sin tocar código.
'@
    }
)

if (-not $env:WC_SKIP_CREATE) { foreach ($issue in $issues) { New-WCIssue -Issue $issue } }
