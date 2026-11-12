. "$PSScriptRoot\issue-helper.ps1"

$issues = @(
    @{
        code = 'M0-10'
        title = 'Configurar Cloudflare R2 y el adaptador de almacenamiento'
        milestone = 2
        labels = @('ai', 'type: chore', 'area: infra', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M0-10` · Fase M0 · Depende de: M0-03, M0-06

## Contexto

Supabase Free limita Storage a 1 GB. Los mapas raster, portadas y galerías pueden superarlo. Cloudflare R2 Free ofrece 10 GB y egreso gratis; Supabase se queda como base de datos, Auth y RLS.

## Alcance

- Crear un bucket privado de R2 para producción y otro para desarrollo (o prefijos separados).
- Configurar el cliente S3 (AWS SDK v3) solo en servidor y variables de entorno validadas con Zod.
- Implementar `StorageAdapter`: `upload`, `getSignedUrl`, `delete`, `list`; adaptador local para tests.
- URLs firmadas de corta duración; comprobar la membresía del mundo antes de firmar.
- Validación de MIME, tamaño y dimensiones; conversión a WebP y miniaturas con `sharp`.
- Claves `world/{worldId}/{assetId}`; CORS restringido; lifecycle para temporales.
- Actualizar ADR-004 y `.env.example`.
- Documentar límites y coste.

## Criterios de aceptación

- [ ] Subida, descarga firmada y borrado funcionan en local y en preview.
- [ ] El bucket es privado: una URL sin firma no permite leer.
- [ ] Las URLs firmadas caducan y el servidor comprueba la membresía antes de generarlas.
- [ ] Un `viewer` no puede subir ni borrar; `editor` y `owner` sí.
- [ ] Imágenes de más de 10 MB o con MIME no permitido se rechazan.
- [ ] Tests del adaptador y del flujo de subida.
- [ ] Sin claves de R2 en el cliente ni en el repositorio.

## Notas

No migrar assets de Supabase Storage: aún no hay producción. La tabla `assets` se define en M0-08.
'@
    },
    @{
        code = 'M0-11'
        title = 'Keep-alive y continuidad de Supabase'
        milestone = 2
        labels = @('ai', 'type: chore', 'area: infra', 'priority: p0', 'size: s', 'status: todo')
        body = @'
Código de plan: `M0-11` · Fase M0 · Depende de: M0-04, M0-08

## Contexto

Supabase Free pausa los proyectos con poca actividad durante una semana. El usuario no entra a diario. Una pausa no borra los datos (hay una ventana de restauración de un año), pero rompe la app y obliga a reactivar a mano.

## Alcance

- Endpoint `/api/health` que haga una consulta real y barata a Supabase y devuelva 200 o 503.
- Monitor UptimeRobot Free cada 30-60 minutos sobre ese endpoint, con alerta por correo.
- Workflow de backup semanal independiente (el detalle se completa en M5-06).
- Documentar la reactivación, la ventana de restauración, los correos de aviso y la revisión de claves tras restaurar.
- Opcional: workflow `keepalive.yml` como respaldo, sabiendo que GitHub desactiva los schedules tras 60 días sin actividad en repos públicos.
- Añadir el estado de disponibilidad al README y al runbook.

## Criterios de aceptación

- [ ] `/api/health` responde y distingue Supabase disponible de Supabase pausado.
- [ ] Monitor configurado y probado; la alerta llega al correo.
- [ ] La actividad generada evita la pausa en una prueba de siete días.
- [ ] Runbook de reactivación probado en un proyecto de desarrollo.
- [ ] Documentado que la pausa conserva datos y que hay que revisar las claves tras restaurar.
- [ ] Sin secretos en logs.

## Notas

No usar el service role en el healthcheck. UptimeRobot es la opción principal; el workflow de GitHub Actions es un respaldo.
'@
    },
    @{
        code = 'M0-12'
        title = 'Fundaciones de internacionalización'
        milestone = 2
        labels = @('ai', 'type: chore', 'area: ui', 'priority: p1', 'size: m', 'status: todo')
        body = @'
Código de plan: `M0-12` · Fase M0 · Depende de: M0-06, M0-07

## Contexto

El MVP será en español, pero el usuario prevé inglés e italiano. Centralizar ahora evita refactorizar componentes después.

## Alcance

- `src/messages/es.ts` con claves tipadas y namespaces (common, auth, worlds, entities, maps, writing, game, settings, errors).
- `getMessages(locale)` y `LocaleProvider` para server y cliente; locale por defecto `es`.
- `locale` en el perfil o en `profiles.settings`, con persistencia.
- Fechas, números y tiempos relativos con `Intl`.
- Estructura para `en.ts` e `it.ts` sin cambios en componentes.
- Guía para añadir idiomas y test de claves faltantes.
- Sin traducir el contenido creado por el usuario.

## Criterios de aceptación

- [ ] Todos los textos de UI del MVP salen de `src/messages/es.ts`.
- [ ] Cambiar el locale no requiere tocar componentes.
- [ ] Fechas y números respetan el locale.
- [ ] Existe una guía para añadir un idioma.
- [ ] Tests de claves faltantes.
- [ ] No hay textos hardcodeados en las pantallas nuevas.

## Notas

`next-intl` puede añadirse en B-05; esta issue solo prepara la base sin dependencia prematura.
'@
    },
    @{
        code = 'M1-07'
        title = 'Miembros, roles e invitaciones por mundo'
        milestone = 3
        labels = @('ai', 'type: feature', 'area: worlds', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M1-07` · Fase M1 · Depende de: M1-01, M1-02

## Contexto

La allowlist da acceso a la app, pero no a los mundos de otras personas. El propietario debe poder invitar a un amigo como `viewer` o `editor`, cambiar su rol o retirar el acceso. Cualquier usuario autorizado puede crear sus propios mundos.

## Alcance

- Página de miembros del mundo: propietario, editores y lectores.
- Invitar por correo con rol `viewer` o `editor`; token de un solo uso, ligado al correo y con caducidad.
- Cambiar rol, revocar acceso y reenviar invitación.
- Reglas: el `owner` no se puede eliminar ni degradar sin transferir la propiedad; el `editor` no gestiona miembros ni borra el mundo; el `viewer` solo lee.
- RLS y Server Actions para la membresía.
- Registro de actividad de cambios de miembros.
- Estados vacíos y errores claros.
- Un usuario invitado puede crear su propio mundo y ser su `owner`.

## Criterios de aceptación

- [ ] El owner invita a un viewer y a un editor; ambos ven el mundo.
- [ ] El viewer no puede editar; el editor edita contenido pero no gestiona miembros.
- [ ] Revocar el acceso impide el acceso inmediato.
- [ ] Un usuario puede pertenecer a varios mundos con roles distintos.
- [ ] Un usuario invitado puede crear su propio mundo y no ve los de otros.
- [ ] Tests RLS con owner, editor, viewer y outsider.
- [ ] E2E de invitar, aceptar, cambiar rol y revocar.
- [ ] Manual actualizado.

## Notas

La aceptación de la invitación y el alta en la allowlist se apoyan en M1-01. No implementar transferencia de propiedad en el MVP salvo que sea imprescindible.
'@
    },
    @{
        code = 'M4-04'
        title = 'Packs de contenido y ampliación del juego desde la app'
        milestone = 6
        labels = @('ai', 'type: feature', 'area: game', 'priority: p2', 'size: l', 'status: todo')
        body = @'
Código de plan: `M4-04` · Fase M4 · Depende de: M4-01, M4-03

## Contexto

El usuario quiere ampliar el contenido del juego desde la propia app, sin modificar código. Las tablas personalizadas (M4-03) cubren parte; falta un sistema de packs y edición del contenido base.

## Alcance

- Duplicar tablas del sistema para editarlas y crear variantes.
- Editor de tablas y entradas con validación de pesos, texto y etiquetas.
- Packs de contenido: JSON con nombre, versión, autor, licencia, categorías y tablas; previsualizar, importar, exportar, activar y desactivar.
- Añadir entradas nuevas a las categorías existentes sin tocar el seed ni el código.
- Resolver conflictos por `key` y versión, conservando el pack original.
- Historial de importaciones y opción de deshacer.
- Documentar el formato de pack y su licencia.

## Criterios de aceptación

- [ ] Crear una tabla propia o duplicar una del sistema y usarla en una tirada.
- [ ] Importar un pack JSON válido y ver sus tablas disponibles.
- [ ] Exportar un pack y volver a importarlo sin pérdidas.
- [ ] Un pack inválido se rechaza con errores claros.
- [ ] Se pueden añadir entradas a una categoría existente sin modificar código.
- [ ] Desactivar un pack deja de mostrarlo pero no borra datos.
- [ ] Tests de import/export y E2E de pack.
- [ ] Manual actualizado.

## Notas

El seed de M4-02 sigue siendo la base editorial; los packs son la vía de ampliación. No usar IA ni servicios externos.
'@
    }
)

if (-not $env:WC_SKIP_CREATE) { foreach ($issue in $issues) { New-WCIssue -Issue $issue } }
