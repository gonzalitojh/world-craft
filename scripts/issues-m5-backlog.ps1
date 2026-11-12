. "$PSScriptRoot\issue-helper.ps1"

$issues = @(
    @{
        code = 'M5-01'
        title = 'Manual de usuario y ayuda in-app'
        milestone = 7
        labels = @('ai', 'type: docs', 'area: docs', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M5-01` · Fase M5 · Depende de: M1-02, M2-02, M3-01, M4-01

## Contexto

El manual es una regla del proyecto: cualquier cambio visible debe reflejarse en `docs/manual-de-usuario.md`. Ahora toca la pasada completa y la ayuda dentro de la app.

## Alcance

- Manual completo en español, no técnico, para cualquier usuario.
- Cubrir todos los módulos, estados, acciones, ajustes, búsqueda, atajos y frecuencias de actualización.
- Onboarding breve del primer mundo.
- Ayuda contextual (tooltips, enlaces "¿Cómo funciona?").
- FAQ y solución de problemas (proyecto pausado, recuperación, exportación).
- Capturas o GIFs actualizados.
- Enlace al manual desde la app y desde el README.

## Criterios de aceptación

- [ ] Todas las funciones visibles están documentadas.
- [ ] Se explican estados, permisos, exportación y recuperación.
- [ ] El manual no usa jerga innecesaria.
- [ ] Enlaces y capturas funcionan.
- [ ] Una persona ajena puede crear un mundo y escribir una escena siguiendo el manual.
- [ ] Revisión final con el usuario.

## Notas

El manual se actualiza en cada PR visible; esta issue hace la pasada completa, no sustituye esa obligación.
'@
    },
    @{
        code = 'M5-02'
        title = 'Auditoría responsive y de accesibilidad'
        milestone = 7
        labels = @('ai', 'type: testing', 'area: qa', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M5-02` · Fase M5 · Depende de: M0-07, M1-02, M2-02, M3-01

## Contexto

La web debe usarse mayoritariamente en PC, pero también en móvil. Las reglas exigen probar 360/768/1280 px, los dos temas y contenido largo realista.

## Alcance

- Auditoría en 320, 360, 768, 1280 y 1920 px.
- Comprobar `document.documentElement.scrollWidth <= window.innerWidth` en todas las rutas.
- Probar títulos, fechas, nombres, sinopsis y URLs largas.
- Revisar los dos temas y contrastes AA.
- axe-core en páginas y componentes críticos.
- Navegación por teclado, foco, lectores de pantalla y `prefers-reduced-motion`.
- Corregir los problemas encontrados y añadir tests de regresión.

## Criterios de aceptación

- [ ] Cero scroll horizontal de página en todos los anchos.
- [ ] Cero errores críticos de axe.
- [ ] Contraste AA en texto normal y componentes.
- [ ] Flujos principales completables solo con teclado.
- [ ] Capturas de referencia en 3 anchos y 2 temas.
- [ ] Tests Playwright de responsive y accesibilidad.
- [ ] Informe final con problemas y correcciones.

## Notas

No usar `overflow-x: hidden` como parche; corregir la causa raíz.
'@
    },
    @{
        code = 'M5-03'
        title = 'Rendimiento y optimización'
        milestone = 7
        labels = @('ai', 'type: testing', 'area: qa', 'priority: p1', 'size: m', 'status: todo')
        body = @'
Código de plan: `M5-03` · Fase M5 · Depende de: M2-02, M3-01

## Contexto

La app tiene vistas pesadas (mapa, grafo, editor). Sin presupuestos, el rendimiento se degrada sin que nadie lo note.

## Alcance

- Medir Lighthouse en las rutas principales (móvil y escritorio).
- Analizar bundle y cargas diferidas.
- Optimizar imágenes, fuentes y caché.
- Revisar índices, consultas N+1 y paginación.
- Virtualizar listas largas.
- Probar mapas de 500 elementos y grafos de 200 nodos.
- Definir presupuestos y añadir Lighthouse CI.

## Criterios de aceptación

- [ ] LCP < 2,5 s, INP < 200 ms y CLS < 0,1 en rutas principales (4G simulada).
- [ ] Presupuesto de JS por ruta documentado y cumplido.
- [ ] Mapa de 500 elementos y grafo de 200 nodos dentro de objetivos.
- [ ] Sin regresiones en CI.
- [ ] Informe con métricas antes/después.

## Notas

No optimizar prematuramente lo que aún no existe; esta issue se ejecuta con las pantallas reales.
'@
    },
    @{
        code = 'M5-04'
        title = 'PWA y experiencia móvil'
        milestone = 7
        labels = @('ai', 'type: feature', 'area: ui', 'priority: p1', 'size: l', 'status: todo')
        body = @'
Código de plan: `M5-04` · Fase M5 · Depende de: M0-07, M3-01

## Contexto

El usuario usará la web sobre todo en PC, pero quiere que funcione bien en móvil. Una PWA instalable evita tiendas de apps y mejora la experiencia.

## Alcance

- Manifest, iconos, splash y colores de tema.
- Service worker con Serwist: shell cacheada y assets.
- Lectura offline de fichas recientes.
- Borradores de escritura offline y sincronización.
- Instalación en Android/iOS y aviso no intrusivo.
- Navegación inferior, safe areas y gestos táctiles en mapa/grafo.
- Pruebas en dispositivos o emulación.

## Criterios de aceptación

- [ ] La app se instala como PWA en Android e iOS.
- [ ] El shell carga sin conexión y muestra estado offline.
- [ ] Se puede escribir un borrador offline y sincronizarlo.
- [ ] Sin scroll horizontal ni solapamientos en móvil.
- [ ] Iconos y splash correctos en los dos temas.
- [ ] E2E de offline básico.
- [ ] Manual actualizado.

## Notas

No cachear datos sensibles de otros usuarios; el service worker es por usuario/dispositivo.
'@
    },
    @{
        code = 'M5-05'
        title = 'Revisión de seguridad y privacidad'
        milestone = 7
        labels = @('ai', 'type: chore', 'area: security', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M5-05` · Fase M5 · Depende de: M1-01 a M4-03

## Contexto

La app guarda mundos y novelas privadas. Una fuga entre usuarios o un secreto expuesto sería grave.

## Alcance

- Suite de tests RLS con dos usuarios y todos los roles.
- Revisión de auth, sesiones, invitaciones y recuperación.
- Cabeceras CSP, HSTS, Referrer-Policy y Permissions-Policy.
- Validación de subidas y URLs firmadas.
- R2: bucket privado, CORS, claves S3 solo en servidor, caducidad de URLs y comprobación de membresía antes de firmar.
- Rate limiting en login, invitaciones y subidas.
- gitleaks y auditoría de dependencias.
- Borrado de cuenta y exportación de datos.
- Página de privacidad y runbook de incidentes.
- Checklist de seguridad OWASP adaptada.

## Criterios de aceptación

- [ ] Ningún hallazgo crítico o alto abierto.
- [ ] Tests RLS verdes para lectura y escritura.
- [ ] CSP sin `unsafe-inline` innecesario.
- [ ] Bucket R2 privado, URLs firmadas con caducidad y claves solo en servidor.
- [ ] Tests de roles owner/editor/viewer/outsider verdes.
- [ ] gitleaks limpio y dependencias sin vulnerabilidades graves.
- [ ] Borrado de cuenta verificado.
- [ ] Informe de seguridad y runbook.

## Notas

Coordinar con `security-champion`; no publicar detalles sensibles en issues públicas.
'@
    },
    @{
        code = 'M5-06'
        title = 'Backups, exportación/importación y recuperación'
        milestone = 7
        labels = @('ai', 'type: chore', 'area: infra', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M5-06` · Fase M5 · Depende de: M0-08, M0-10, M0-11, M1-02

## Contexto

El plan Free de Supabase no incluye backups automáticos y el proyecto se pausa por baja actividad. Los archivos viven en R2. La portabilidad y la recuperación son una promesa del producto.

## Alcance

- Exportar un mundo completo (JSON + assets de R2) e importarlo.
- Exportar la cuenta.
- Workflow semanal de `pg_dump` cifrado, artefacto de 90 días y copia opcional a R2.
- Monitor keep-alive y procedimiento de restauración si Supabase se pausa.
- Prueba de restauración documentada y ejecutada.
- Página de estado/uso de almacenamiento (Supabase y R2).
- Documentar límites y ruta de migración a Neon + R2.

## Criterios de aceptación

- [ ] Export/import round-trip de un mundo con imágenes y mapas.
- [ ] Backup semanal configurado y verificado.
- [ ] Restauración de base de datos y assets probada en un proyecto limpio.
- [ ] Procedimiento de reactivación de Supabase documentado y probado.
- [ ] Procedimiento documentado en el runbook.
- [ ] Sin pérdida de datos en la prueba.
- [ ] Manual actualizado.

## Notas

Cifrar el dump antes de subirlo; no incluir secretos ni claves en el artefacto. R2 es el almacenamiento principal, así que la copia de assets forma parte de la recuperación.
'@
    },
    @{
        code = 'M5-07'
        title = 'Despliegue a producción, beta privada y lanzamiento'
        milestone = 7
        labels = @('ai', 'type: chore', 'area: infra', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M5-07` · Fase M5 · Depende de: todas

## Contexto

Cierre del MVP: pasar de previews a una URL estable, con monitorización, backups y una beta con un amigo.

## Alcance

- Proyecto Supabase de producción separado del de desarrollo.
- Variables y secretos en Vercel y Cloudflare; comprobación de que no hay claves en cliente.
- Dominio: subdominio `*.vercel.app` (decisión D-006 del 12/11/2026). El dominio propio queda como opción futura.
- Sentry, analytics mínima y monitor de disponibilidad.
- Smoke tests post-despliegue.
- Beta privada con un amigo: acceso como `viewer` o `editor` a un mundo y posibilidad de crear su propio mundo.
- Checklist de lanzamiento, limitaciones conocidas y canal de feedback.
- Plan de rollback.

## Criterios de aceptación

- [ ] URL de producción estable y con HTTPS en el subdominio de Vercel.
- [ ] Login, mundo propio, mundo compartido, entidad, mapa, escritura y juego funcionan en producción.
- [ ] Backups y monitorización activos.
- [ ] Sin errores críticos en Sentry tras la beta.
- [ ] Manual y limitaciones publicados.
- [ ] Usuario y beta tester dan el visto bueno.
- [ ] Subdominio de Vercel configurado y documentado.

## Notas

No promover `dev` a `main` hasta que el usuario lo decida.
'@
    },
    @{
        code = 'B-01'
        title = 'Colaboración en tiempo real'
        milestone = 8
        labels = @('future', 'type: feature', 'area: entities', 'priority: p3', 'size: xl', 'status: todo')
        body = @'
Código de plan: `B-01` · Backlog

## Contexto

World Craft es personal en el MVP. En el futuro podría interesar editar un mundo entre varias personas a la vez.

## Alcance futuro

- Presencia y edición concurrente en fichas/escenas.
- Yjs o Supabase Realtime, con resolución de conflictos.
- Comentarios y menciones.
- Permisos por rol ya existentes.

## Criterios para retomarla

- [ ] El MVP está estable y el usuario lo pide.
- [ ] Se evalúa coste y límites de Realtime.
- [ ] Se decide si merece la pena frente a la complejidad.
'@
    },
    @{
        code = 'B-02'
        title = 'Wiki pública y enlaces de lectura compartidos'
        milestone = 8
        labels = @('future', 'type: feature', 'area: infra', 'priority: p3', 'size: l', 'status: todo')
        body = @'
Código de plan: `B-02` · Backlog

## Contexto

El usuario no quiere una comunidad, pero podría querer compartir un mundo o un mapa con lectores.

## Alcance futuro

- Enlaces de solo lectura con token y caducidad.
- Vista pública opcional por mundo.
- Personalización visual básica.
- Sin comentarios ni cuentas públicas.

## Criterios para retomarla

- [ ] El usuario confirma que quiere compartir.
- [ ] Se revisa privacidad y RLS.
- [ ] Se decide si es una wiki o solo lectura.
'@
    },
    @{
        code = 'B-03'
        title = 'Aplicación de escritorio con Tauri'
        milestone = 8
        labels = @('future', 'type: feature', 'area: infra', 'priority: p3', 'size: xl', 'status: todo')
        body = @'
Código de plan: `B-03` · Backlog

## Contexto

El usuario contempla una versión de escritorio en el futuro, pero ahora solo web.

## Alcance futuro

- Envolver la web con Tauri (más ligero que Electron).
- Acceso a archivos locales y atajos nativos.
- Sincronización con la nube o modo local.
- Actualizaciones automáticas.

## Criterios para retomarla

- [ ] La web está estable y se usa a diario.
- [ ] Se identifica una necesidad real de escritorio.
- [ ] Se evalúa el coste de mantenimiento.
'@
    },
    @{
        code = 'B-04'
        title = 'Inspiración asistida por IA (opcional y con coste)'
        milestone = 8
        labels = @('future', 'type: feature', 'area: game', 'priority: p3', 'size: l', 'status: todo')
        body = @'
Código de plan: `B-04` · Backlog

## Contexto

El MVP usa dados y tablas deterministas, sin coste. La IA podría generar variaciones, pero rompe la regla de coste cero y añade privacidad.

## Alcance futuro

- Proveedor opcional con clave del usuario.
- Generación de variaciones de semillas, no de texto final.
- Aviso claro de coste y privacidad.
- Posibilidad de desactivarlo por completo.

## Criterios para retomarla

- [ ] El usuario lo pide explícitamente.
- [ ] Hay un ADR que justifica el coste y el tratamiento de datos.
- [ ] No se envía contenido privado sin consentimiento.
'@
    },
    @{
        code = 'B-05'
        title = 'Internacionalización de la interfaz'
        milestone = 8
        labels = @('future', 'type: feature', 'area: ui', 'priority: p3', 'size: m', 'status: todo')
        body = @'
Código de plan: `B-05` · Backlog

## Contexto

El MVP será solo en español, pero las fundaciones de i18n se crean en M0-12: mensajes centralizados, claves tipadas y `locale` en el perfil.

## Alcance futuro

- Partir de los mensajes centralizados de M0-12.
- Añadir `next-intl` o equivalente.
- Traducir al inglés y, después, al italiano.
- Formatos de fecha/número por locale y selector de idioma.
- Revisar textos legales y de ayuda en cada idioma.

## Criterios para retomarla

- [ ] El usuario quiere publicar en otro idioma.
- [ ] Los textos están centralizados y no hay literales dispersos.
- [ ] Se prioriza inglés y después italiano.
'@
    }
)

if (-not $env:WC_SKIP_CREATE) { foreach ($issue in $issues) { New-WCIssue -Issue $issue } }
