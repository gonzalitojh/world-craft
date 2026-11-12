. "$PSScriptRoot\issue-helper.ps1"

$issues = @(
    @{
        code = 'M0-01'
        title = 'Auditar y adaptar los agentes de IA al proyecto'
        milestone = 2
        labels = @('ai', 'needs-decision', 'type: chore', 'area: agents', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M0-01` · Fase M0 · Depende de: —

## Contexto

Los agentes de `.opencode/agents/` están heredados de otro proyecto. Contienen referencias que aquí no existen (`scripts/gh-issue.sh`, `tasks/`, `.github/workflows/issues-done-on-dev.yml`, ADR-029, issues #44/#81/#128/#145 y la URL de otro repositorio) y asumen que el publisher sube cambios y abre PRs automáticamente. El usuario quiere probar en local antes de publicar.

## Alcance

- Auditar los 7 agentes actuales y decidir para cada uno: mantener, adaptar o eliminar.
- Reescribir `sdd-master` para el flujo de World Craft: etiquetas, hitos, task files y estados reales.
- Convertir `publisher` en **local-first**: preparar rama/commit y mostrar el diff, sin push ni PR salvo confirmación explícita.
- Quitar todas las referencias al proyecto anterior y a workflows/scripts inexistentes.
- Alinear las referencias con las decisiones cerradas: dos temas, R2 como almacenamiento, roles por mundo e i18n centralizada.
- Añadir un agente `ui-ux-designer` (o justificar por qué no) para cubrir diseño, responsive, temas y accesibilidad.
- Valorar si hace falta un agente de contenido (`content-curator`) o si basta con un skill.
- Documentar el equipo resultante en `docs/agentes.md`.

## Criterios de aceptación

- [ ] Tabla de auditoría con la decisión y los cambios de cada agente.
- [ ] Ningún agente referencia rutas, URLs, issues o workflows del proyecto anterior.
- [ ] El publisher no hace push ni PR sin confirmación; el flujo local está documentado.
- [ ] `sdd-master` funciona con las etiquetas y estados definidos en el plan.
- [ ] El agente de UI/UX está creado o su ausencia está justificada.
- [ ] El usuario valida la propuesta (label `needs-decision`).

## Notas

No se implementa producto en esta issue. El resultado es configuración de agentes y documentación.
'@
    },
    @{
        code = 'M0-02'
        title = 'Revisar AGENTS.md y el flujo SDD'
        milestone = 2
        labels = @('ai', 'needs-decision', 'type: docs', 'area: agents', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M0-02` · Fase M0 · Depende de: M0-01

## Contexto

`AGENTS.md` contiene reglas valiosas (PRs contra `dev`, responsividad, manual actualizado, temas) mezcladas con referencias a otra aplicación (`ocio/ocio.css`, ADR-064/066). Hay que conservar lo útil y adaptar el resto a World Craft, con dos temas (claro/oscuro).

## Alcance

- Actualizar `AGENTS.md` con las reglas de la sección 4.2 del plan.
- Reflejar las decisiones cerradas: dos temas, R2, allowlist + roles por mundo, i18n centralizada y publisher local-first.
- Definir Definition of Ready y Definition of Done.
- Adaptar el flujo SDD y el esquema de `tasks/task-issue-N.json`.
- Documentar el flujo local-first del publisher y el momento de publicación explícita.
- Crear una guía de etiquetas, estados e hitos.
- Incluir reglas de coste cero, portabilidad de datos, secretos, migraciones y accesibilidad.

## Criterios de aceptación

- [ ] `AGENTS.md` no menciona la aplicación anterior ni rutas que no existan.
- [ ] Se mantienen y adaptan las reglas de PR a `dev`, responsive, manual y dos temas.
- [ ] Hay Definition of Ready/Done comprobable.
- [ ] El flujo SDD termina en revisión local por defecto.
- [ ] Existe un task file de ejemplo válido.
- [ ] El usuario aprueba los cambios (label `needs-decision`).

## Notas

Debe coordinarse con M0-01: primero se adaptan los agentes, luego las reglas que los rigen.
'@
    },
    @{
        code = 'M0-03'
        title = 'Crear los ADRs fundacionales'
        milestone = 2
        labels = @('ai', 'needs-decision', 'type: docs', 'area: architecture', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M0-03` · Fase M0 · Depende de: M0-01, M0-02

## Contexto

El plan propone un stack y varias alternativas. Hay que registrar las decisiones en ADRs para que futuras iteraciones no las reviertan sin contexto.

## Alcance

Crear ADRs con contexto, opciones, decisión, consecuencias y alternativas descartadas:

- ADR-001: Next.js + React + TypeScript.
- ADR-002: Supabase Postgres + Drizzle + Zod.
- ADR-003: Supabase Auth, allowlist e invitaciones.
- ADR-004: Cloudflare R2 como almacenamiento principal, con `StorageAdapter`.
- ADR-005: Vercel Hobby.
- ADR-006: MapLibre + Terra Draw + GeoJSON.
- ADR-007: React Flow + ELK.js.
- ADR-008: Tiptap + exportadores.
- ADR-009: Testing, PWA y backups.
- ADR-010: Dos temas (claro/oscuro) y sistema de diseño.
- ADR-011: Acceso por allowlist, roles por mundo y mundos propios.
- ADR-012: Internacionalización centralizada y ruta a inglés/italiano.
- ADR-013: Continuidad de free tiers: R2, keep-alive y backups.

## Criterios de aceptación

- [ ] Carpeta `docs/adr/` con plantilla e índice.
- [ ] Un ADR por decisión, con alternativas y riesgos de free tier.
- [ ] Las decisiones coinciden con `docs/plan-desarrollo.md`.
- [ ] Se registran las decisiones cerradas del 12/11/2026 (R2, keep-alive, dos temas, roles, i18n, dominio).
- [ ] El usuario valida las decisiones (label `needs-decision`).

## Notas

Si se cambia una decisión, se crea un ADR nuevo que sustituye al anterior; no se reescribe el histórico.
'@
    },
    @{
        code = 'M0-04'
        title = 'Configurar repositorio, ramas, etiquetas y plantillas'
        milestone = 2
        labels = @('ai', 'type: chore', 'area: infra', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M0-04` · Fase M0 · Depende de: —

## Contexto

El repositorio solo tiene `main` y un commit inicial. El flujo exige `dev` como rama de integración, PRs contra `dev` y plantillas de issue/PR.

## Alcance

- Crear `dev` desde `main` y documentar la promoción `dev` → `main`.
- Configurar protección de `main` y `dev` (PR obligatoria, CI verde, sin force push).
- Crear plantillas de issue (feature, bug, chore, decisión) y de PR.
- Sincronizar la taxonomía de etiquetas del plan (script reproducible).
- Añadir `.gitignore`, `.editorconfig`, `.nvmrc`/`.node-version`, `README.md` y `CONTRIBUTING.md` mínimos.
- Decidir la licencia del código y la visibilidad del repositorio.
- Añadir `SECURITY.md`.

## Criterios de aceptación

- [ ] `dev` existe en local y en `origin`.
- [ ] `main` y `dev` están protegidas.
- [ ] Plantillas disponibles y probadas.
- [ ] Etiquetas creadas de forma idempotente.
- [ ] Documentación de ramas, commits y PRs.
- [ ] No hay secretos ni archivos de entorno en el repo.

## Notas

El repo es público; si se decide hacerlo privado, revisar el límite de minutos de GitHub Actions.
'@
    },
    @{
        code = 'M0-05'
        title = 'Configurar entorno de desarrollo y CI base'
        milestone = 2
        labels = @('ai', 'type: chore', 'area: infra', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M0-05` · Fase M0 · Depende de: M0-04

## Contexto

La máquina de desarrollo no tiene Node ni pnpm instalados. Hace falta un entorno reproducible y una CI que impida fusionar código roto.

## Alcance

- Instalar Node 22 LTS y pnpm (Corepack) y documentarlo.
- Configurar TypeScript estricto, ESLint y Prettier.
- Configurar Vitest, Testing Library y Playwright.
- Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format`.
- GitHub Actions: instalar, cachear, lint, typecheck, unit y build; E2E smoke opcional.
- Dependabot/Renovate, gitleaks y auditoría de dependencias.
- `.env.example` con validación Zod.

## Criterios de aceptación

- [ ] Un clon nuevo se arranca siguiendo el README en menos de 30 minutos.
- [ ] `pnpm lint`, `typecheck`, `test` y `build` funcionan en local.
- [ ] La CI se ejecuta en cada PR y falla si algo no pasa.
- [ ] gitleaks no detecta secretos.
- [ ] Funciona en Windows (máquina actual) y en Linux (CI).

## Notas

No añadir todavía tests de producto; solo el esqueleto y un test de humo.
'@
    },
    @{
        code = 'M0-06'
        title = 'Scaffold de Next.js, TypeScript y Tailwind'
        milestone = 2
        labels = @('ai', 'type: chore', 'area: infra', 'priority: p0', 'size: m', 'status: todo')
        body = @'
Código de plan: `M0-06` · Fase M0 · Depende de: M0-04, M0-05

## Contexto

Primera base ejecutable de la aplicación, sin funcionalidad de producto todavía.

## Alcance

- Crear la app Next.js con App Router, TypeScript estricto y Tailwind CSS.
- Inicializar shadcn/ui, Lucide y las fuentes.
- Estructura de carpetas por dominios (`src/modules`, `src/components`, `src/lib`).
- Aliases de importación y validación de variables de entorno con Zod.
- Páginas base: home, login placeholder, healthcheck, error, loading y not-found.
- Metadatos, favicon, manifest inicial y configuración de imágenes.
- Despliegue de preview en Vercel conectado al repo.

## Criterios de aceptación

- [ ] `pnpm dev` y `pnpm build` funcionan.
- [ ] Preview de Vercel generada desde una rama/PR.
- [ ] Estructura y convenciones documentadas en el README.
- [ ] Sin claves ni secretos en el cliente.
- [ ] Lighthouse inicial registrado como línea base.

## Notas

No implementar auth ni base de datos aquí; eso va en M0-08 y M1-01.
'@
    },
    @{
        code = 'M0-07'
        title = 'Sistema de diseño, temas y shell responsive'
        milestone = 2
        labels = @('ai', 'type: design', 'area: ui', 'priority: p1', 'size: l', 'status: todo')
        body = @'
Código de plan: `M0-07` · Fase M0 · Depende de: M0-06

## Contexto

La app debe ser "actual, bonita y fácil de usar", con dos temas (claro y oscuro) y responsividad real. Es más barato definir tokens y shell antes de construir pantallas.

## Alcance

- Tokens CSS para los dos temas (Claro y Oscuro).
- Tipografía (Fraunces + Inter + JetBrains Mono), escala, espaciado, radios y sombras.
- Componentes base: botón, input, textarea, select, card, dialog, drawer, tabs, toast, tooltip, badge, command.
- Shell: rail lateral, topbar, barra inferior móvil, breadcrumbs y estados vacíos.
- Selector de tema persistente y respeto a `prefers-reduced-motion`.
- Página de muestra del sistema de diseño (no Storybook necesariamente).
- Revisión de contraste AA en los dos temas.

## Criterios de aceptación

- [ ] Los dos temas se ven correctamente y cumplen contraste AA.
- [ ] Sin scroll horizontal a 360, 768 y 1280 px.
- [ ] Navegación por teclado y foco visible.
- [ ] Componentes documentados con ejemplos.
- [ ] Capturas de referencia en los dos temas.
- [ ] El agente `ui-ux-designer` revisa el resultado.

## Notas

La estética es "taller de cartógrafo": papel, tinta y cartografía; evitar dashboards genéricos.
'@
    },
    @{
        code = 'M0-08'
        title = 'Configurar Supabase y el modelo de datos inicial'
        milestone = 2
        labels = @('ai', 'type: chore', 'area: infra', 'priority: p0', 'size: l', 'status: todo')
        body = @'
Código de plan: `M0-08` · Fase M0 · Depende de: M0-03, M0-06

## Contexto

La app necesita persistencia real, autenticación y un modelo de datos seguro. El plan propone Supabase Free con Drizzle y RLS; los archivos van a Cloudflare R2 (M0-10).

## Alcance

- Crear proyectos Supabase de desarrollo y producción (o dev + rama).
- Configurar variables de entorno y conexión con pooler.
- Configurar Drizzle Kit y las migraciones iniciales.
- Implementar el esquema de la sección 3.3 del plan: perfiles, mundos, miembros, invitaciones, entidades, tipos, relaciones, etiquetas, assets, mapas, manuscritos, escenas, versiones, juego, packs y actividad.
- Políticas RLS base: allowlist para la app, `world_members` para acceso a mundos y roles `owner`/`editor`/`viewer`.
- Dejar la tabla `assets` y el contrato de `StorageAdapter` preparados para R2; el bucket se configura en M0-10.
- Seed de datos del sistema (tipos y relaciones del sistema).
- Documentar backups y límites del plan Free.

## Criterios de aceptación

- [ ] Migraciones aplican desde cero en local y en un proyecto limpio.
- [ ] RLS probada con owner, editor, viewer y usuario ajeno: aislamiento total.
- [ ] La tabla `assets` y el contrato de almacenamiento están listos para R2.
- [ ] Un usuario autorizado puede crear un mundo propio; la allowlist no da acceso a mundos ajenos.
- [ ] Seed reproducible.
- [ ] Esquema documentado y alineado con el plan.
- [ ] El service role solo se usa en servidor.

## Notas

No crear pantallas de producto; solo infraestructura, esquema y pruebas de acceso. La configuración de R2 y las subidas se completan en M0-10.
'@
    },
    @{
        code = 'M0-09'
        title = 'Documentación base del proyecto'
        milestone = 2
        labels = @('ai', 'type: docs', 'area: docs', 'priority: p1', 'size: s', 'status: todo')
        body = @'
Código de plan: `M0-09` · Fase M0 · Depende de: M0-04

## Contexto

El repositorio necesita documentación mínima para que el usuario y los agentes trabajen sin contexto oral.

## Alcance

- `README.md`: qué es World Craft, arranque local, scripts, variables y despliegue.
- `CONTRIBUTING.md`: ramas, commits, PRs, calidad y revisión.
- `docs/arquitectura.md`: módulos y flujos principales.
- `docs/registro-decisiones.md`: enlace al registro de decisiones y a las decisiones cerradas del 12/11/2026.
- `docs/adr/README.md`: índice de decisiones.
- `docs/manual-de-usuario.md`: esqueleto inicial (se completará en M5-01).
- `CHANGELOG.md` y plantilla de cambios.
- Enlaces al plan y a las issues.

## Criterios de aceptación

- [ ] Un colaborador nuevo entiende el proyecto y arranca la app con el README.
- [ ] Los enlaces internos funcionan.
- [ ] La documentación no contradice el plan ni los ADRs.
- [ ] El manual tiene estructura y aviso de "en construcción".

## Notas

La documentación se actualiza en cada PR que cambie el comportamiento visible.
'@
    }
)

if (-not $env:WC_SKIP_CREATE) { foreach ($issue in $issues) { New-WCIssue -Issue $issue } }
