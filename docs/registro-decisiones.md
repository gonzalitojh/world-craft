# Registro de decisiones de World Craft

Registro append-only de las decisiones de producto y arquitectura tomadas durante la planificación y el desarrollo. Cada entrada indica la fecha, el contexto, la decisión, sus consecuencias y las issues afectadas. Las decisiones arquitectónicas se reflejan también en `docs/adr/`; este registro conserva el histórico de la conversación y del plan.

## 2026-11-12 — Cierre de las 8 decisiones del plan (issue #1)

**Contexto.** El 11/11/2026 se creó el plan `docs/plan-desarrollo.md` y las issues #2–#39. Quedaron ocho decisiones pendientes de validación del usuario. El 12/11/2026 el usuario las revisó y cerró todas.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-001 | Stack y free tiers | Mantener **Supabase Free + Vercel Hobby**, pero mover los archivos a **Cloudflare R2 Free**. Añadir keep-alive y backups para la pausa de Supabase. | Supabase sigue siendo la base de datos, Auth y RLS; R2 evita el límite de 1 GB de Storage y el egreso. Se añaden M0-10 (R2) y M0-11 (continuidad). |
| D-002 | Temas | Usar **dos temas**: Claro y Oscuro. Se descartan Blanco puro y Negro puro. | Se simplifican tokens, pruebas, capturas y reglas de `AGENTS.md`. Se actualizan M0-07, M5-02 y todas las issues que contenían referencias a cuatro temas. |
| D-003 | Mapas | Incluir **imagen raster de fondo opcional y georreferenciada** para calcar o completar mapas dibujados a mano. El mapa sigue siendo vectorial por defecto. | Se mantiene en el alcance de M2-01 y se explicita en M2-02. |
| D-004 | Acceso | La allowlist concede acceso a la **aplicación**; la pertenencia a un mundo concede acceso a ese mundo. Roles por mundo: `owner`, `editor` y `viewer`. Cualquier usuario autorizado puede **crear sus propios mundos**. | Se separa acceso a la app de membresía de mundos. Se añade M1-07 para gestionar miembros, roles e invitaciones; M1-01 y M1-02 se ajustan. |
| D-005 | Idioma | Español en el MVP, con **todos los textos centralizados** y estructura preparada para inglés e italiano. | Se añade M0-12 (fundaciones de i18n). B-05 queda para la traducción completa y `next-intl` cuando se decida. |
| D-006 | Dominio | Usar el **subdominio de Vercel** (`*.vercel.app`) en el MVP. El dominio propio queda como opción futura. | Se actualiza M5-07 y se elimina la decisión pendiente sobre dominio. |
| D-007 | Publicación | Revisar el plan en local primero. Cuando el usuario lo apruebe, publicarlo mediante **PR a `dev`**, nunca directamente a `main`. | El plan se revisó en local y se publica mediante PR a `dev`. El publisher mantiene el modo local-first para futuras tareas. |
| D-008 | Contenido de juego | Mantener la recomendación inicial (fantasía, ciencia ficción, terror y contemporáneo; 40–60 entradas por categoría) y permitir **ampliar el contenido desde la app, sin modificar código**. | Se añade M4-04 (packs de contenido y edición de tablas). M4-02 y M4-03 se ajustan para que el contenido sea ampliable. |

### Decisiones derivadas

- **Almacenamiento principal:** Cloudflare R2 Free (10 GB, 1M operaciones Class A, 10M Class B, egreso gratis), con bucket privado y URLs firmadas. Supabase Storage no se usa en producción.
- **Continuidad de Supabase:** healthcheck y monitor keep-alive (UptimeRobot Free o equivalente) para generar actividad; backup semanal con `pg_dump`; procedimiento de reactivación documentado. Los proyectos pausados conservan los datos y se pueden restaurar desde el panel (ventana de un año).
- **Matriz de temas:** dos modos, `light` y `dark`, con contraste WCAG AA.
- **Internacionalización:** mensajes centralizados y claves tipadas desde el inicio; `locale` en el perfil; fechas y números con `Intl`.
- **Acceso:** `allowed_emails` controla quién puede entrar; `world_members` controla qué puede hacer en cada mundo; el propietario de un mundo es su `owner`.
- **Contenido de juego:** el seed inicial es solo el punto de partida; las tablas personalizadas y los packs permiten ampliarlo desde la interfaz.

### Issues nuevas

- **M0-10** ([#40](https://github.com/gonzalitojh/world-craft/issues/40)) — Configurar Cloudflare R2 y el adaptador de almacenamiento.
- **M0-11** ([#41](https://github.com/gonzalitojh/world-craft/issues/41)) — Keep-alive y continuidad de Supabase.
- **M0-12** ([#42](https://github.com/gonzalitojh/world-craft/issues/42)) — Fundaciones de internacionalización.
- **M1-07** ([#43](https://github.com/gonzalitojh/world-craft/issues/43)) — Miembros, roles e invitaciones por mundo.
- **M4-04** ([#44](https://github.com/gonzalitojh/world-craft/issues/44)) — Packs de contenido y ampliación del juego desde la app.

Con estas cinco issues, el plan pasa de **38 a 43 issues**. Las issues #2–#39 se actualizaron con los textos nuevos y la issue #1 recibió un comentario con el resumen de las decisiones y perdió la etiqueta `needs-decision`.

### Publicación

El usuario revisó y aprobó el plan. El trabajo se publica mediante la **PR [#45](https://github.com/gonzalitojh/world-craft/pull/45) contra `dev`**; nunca se hace push directo a `main`. La rama `main` queda reservada para las versiones estables que promueva el usuario.

## 2026-11-12 — Aprobación del plan y publicación en `dev`

El usuario revisó el plan y lo aprobó. Se publica el trabajo mediante la PR [#45](https://github.com/gonzalitojh/world-craft/pull/45), con base en la rama de integración `dev`. A partir de este momento, `dev` es la rama de integración y `main` queda reservada para versiones estables.

## 2026-11-14 — ADRs fundacionales (issue #4, M0-03)

Se crean los 13 ADRs fundacionales en [`docs/adr/`](adr/README.md) para registrar las decisiones ya cerradas el 12/11/2026, sin introducir decisiones nuevas ni cambiar el alcance. El índice relaciona cada ADR con el plan y con las entradas D-001–D-008 de este registro.

| ADR | Tema | Plan | Registro |
|---|---|---|---|
| [0001](adr/0001-nextjs-app-router.md) | Next.js, React y TypeScript | §3.2 D1 | — |
| [0002](adr/0002-supabase-postgres-drizzle-zod.md) | Supabase Postgres, Drizzle y Zod | §3.2 D3–D4 | D-001 |
| [0003](adr/0003-supabase-auth-allowlist-invitations.md) | Supabase Auth, allowlist e invitaciones | §3.2 D5, §3.4 | D-004 |
| [0004](adr/0004-cloudflare-r2-storage-adapter.md) | Cloudflare R2 y `StorageAdapter` | §3.2 D6 | D-001 |
| [0005](adr/0005-vercel-hobby.md) | Vercel Hobby y dominio | §3.2 D7, §7 | D-006 |
| [0006](adr/0006-maplibre-terra-draw-geojson.md) | MapLibre, Terra Draw y GeoJSON | §3.2 D8 | D-003 |
| [0007](adr/0007-react-flow-elk.md) | React Flow y ELK.js | §3.2 D9 | — |
| [0008](adr/0008-tiptap-exporters.md) | Tiptap y exportadores | §3.2 D10 | — |
| [0009](adr/0009-testing-pwa-backups.md) | Testing, PWA y backups | §3.2 D12–D14, §4.7 | — |
| [0010](adr/0010-two-themes-design-system.md) | Dos temas y sistema de diseño | §3.2 D2 y D15 | D-002 |
| [0011](adr/0011-allowlist-world-roles-own-worlds.md) | Allowlist, roles y mundos propios | §3.4, §7 | D-004 |
| [0012](adr/0012-i18n-centralized-roadmap.md) | Internacionalización centralizada | §3.2 D16 | D-005 |
| [0013](adr/0013-free-tier-continuity.md) | Continuidad de free tiers | §3.7 | D-001 |

El usuario validó las decisiones y se retiró el label `needs-decision` de la issue #4. Cualquier cambio futuro de una decisión aceptada se hará con un ADR nuevo que superseda al anterior, sin reescribir el histórico.

## 2026-11-14 — Repositorio público y protección de ramas (issue #5, M0-04)

**Contexto.** El repositorio estaba privado en GitHub Free, plan que no permite rulesets ni protección de ramas en repositorios privados. El plan asume un repositorio público sin secretos para Actions ilimitado y coste 0 €/mes. Faltaba decidir la visibilidad, la licencia y cómo proteger `main` y `dev` sin pagar GitHub Pro.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-009 | Visibilidad y licencia | Hacer público el repositorio y usar **licencia MIT** con titular `gonzalitojh` y año 2026. Los commits futuros usan el correo `noreply` de GitHub; el historial anterior no se reescribe. | El código y el historial quedan públicos, incluido el correo de commits antiguos. Se habilitan rulesets, escaneo de secretos, push protection y Actions sin límite de minutos en repos públicos. Se registra en el ADR 0014. |
| D-010 | Protección de ramas | Crear los rulesets **`protect-dev`** y **`protect-main`**: PR obligatoria, sin force push ni borrado, 0 aprobaciones y resolución de hilos. Bypass del propietario **solo en `main`** para promover `dev` → `main`. Sin required status checks hasta la issue #6. | El flujo de PR contra `dev` se refuerza en GitHub y el propietario conserva la promoción a `main`. Los checks obligatorios llegan con CI (M0-05, issue #6). Las acciones administrativas del repositorio requieren confirmación explícita. Se registra en el ADR 0014. |

Estas decisiones se documentan en el [ADR 0014](adr/0014-public-repo-mit-and-branch-protection.md) y en [`docs/proceso-sdd.md`](proceso-sdd.md) §7.7.

## 2026-11-14 — Coste de contexto de las sesiones de agentes (tarea local)

**Contexto.** Una sesión `variant: low` sobre la issue #5 costó 0,30 $. El prefijo estable de cada sesión (system prompt, `AGENTS.md`, permisos y prompts de agentes) ronda los 10.700 tokens y se reenvía en cada turno y en cada paso de cada subagente; los subagentes además heredaban la variante de la sesión.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-011 | Caché y contexto | Activar `warming` 30 minutos, mantener la caché caliente sin cambiar de modelo ni variante a mitad de sesión, crear la skill `repo-map` y el mapa `.opencode/repo-map.md`, y omitir subagentes en tareas documentales o de proceso. | El prefijo se lee de caché (0,003 $/M frente a 0,15 $/M) y las tareas documentales pasan a un único contexto. Se añade una comprobación de coste a la Definition of Done. |
| D-012 | Variante por subagente | Fijar `deepseek/deepseek-flash#high` en `task-architect`, `tdd-ddd-architect`, `ui-ux-designer` y `security-champion`, y `#low` en `qa-reviewer`, `documentation-sync` y `publisher`. `sdd-master` sigue la variante de la sesión. **Actualizada por D-018:** el modelo pasa a `opencode/deepseek-v4.1-flash-free`. | El coste por puerta es predecible y no hereda `max`. Los subagentes ya no siguen la variante elegida en la sesión; un FAIL repetido sube la variante y se anota en el task file. |

Estas decisiones se documentan en el [ADR 0015](adr/0015-coste-contexto-cache-variante-fija.md).

## 2026-11-14 — Entorno de desarrollo y CI base (issue #6, M0-05)

**Contexto.** El repositorio solo tenía documentación, plantillas y scripts: no había `package.json`, ni compilador, ni tests, ni CI. Antes de crear el scaffold de Next.js (M0-06, issue #7) hacía falta un entorno reproducible, una verificación automática en cada PR y los checks obligatorios en los rulesets, sin adelantar la aplicación.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-013 | Entorno y tooling | Fijar **Node 22 LTS** (`.nvmrc` con `22`, `engines.node` `>=22.22.2 <23`) y **pnpm vía Corepack** con `packageManager: pnpm@12.18.0`. TypeScript estricto con `tsconfig.json` y `tsconfig.build.json`, **ESLint 10** flat con `typescript-eslint` y `eslint-config-prettier` (`eslint` fijado exacto a 10.14.0 por la ventana de 24 h de pnpm 12, pendiente de subida vía Dependabot), Prettier, **Vitest 5** con **Vite 8** como peer obligatorio, jsdom y Testing Library DOM, Playwright fijado a 1.65.0 con un smoke sin servidor y esquema Zod de entorno en `src/lib/env.ts` con `.env.example`. El único código de producto hasta #7 es ese módulo. | Un clon se arranca con `corepack enable` y `pnpm install`; `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format` y `format:check` funcionan en Windows y Linux. `vite` es el motor de transformación de Vitest, no una dependencia de producto. La versión exacta de Playwright y de `eslint` respeta la ventana de antigüedad de pnpm 12; Dependabot las sube cuando corresponde. La configuración se ampliará con Next.js en #7. |
| D-014 | CI y seguridad de dependencias | CI en GitHub Actions en cada PR y push a `dev`/`main`, con permisos `contents: read`, `concurrency` que cancela ejecuciones antiguas y una acción compuesta de setup. Jobs **`lint`, `typecheck`, `test` y `build` como required checks**; `e2e`, `gitleaks` y `audit` no bloqueantes. `gitleaks/gitleaks-action` fijada por SHA con la versión en comentario (`v2.3.9`), `pnpm audit --audit-level=high` (incluye las dependencias de desarrollo) y Dependabot semanal para npm y GitHub Actions agrupando minor y patch. `scripts/set-branch-protection.ps1` aplica los cuatro checks a `protect-dev` y `protect-main` con `strict_required_status_checks_policy = $false`. | La PR no se fusiona sin tipos, lint, tests y build en verde; los checks costosos o dependientes del entorno no bloquean. La auditoría ya no oculta las vulnerabilidades del tooling: queda una **moderada** en `minimatch` compartida por `eslint` y `typescript-eslint` sin parche compatible, aceptada como riesgo de desarrollo (ningún hallazgo HIGH). Los rulesets se aplican al publicar esta issue, no antes, para no bloquear PRs sin CI en `dev`. No se añade ningún servicio de pago. |

Estas decisiones se documentan en el [ADR 0016](adr/0016-entorno-tooling-ci.md) y en [`docs/proceso-sdd.md`](proceso-sdd.md) §7.7.

## 2026-11-14 — Scaffold de Next.js y contrato de entorno (issue #7, M0-06)

**Contexto.** El ADR 0016 dejó el tooling sin aplicación: `build` compilaba con `tsc` a `dist` y el esquema de entorno mezclaba claves públicas y de servidor. La issue #7 debía entregar la primera base ejecutable sin adelantar autenticación ni el sistema de diseño. Next.js 16 impone `jsx: "react-jsx"` y `eslint-config-next` aún no acepta ESLint 10, así que el scaffold se integró a mano respetando las versiones fijadas por la ventana de pnpm 12.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-015 | Scaffold y contrato de entorno | Integrar **Next.js 16.4.6 App Router + React 19.3.1** con TypeScript estricto y Tailwind CSS 4.3.5 CSS-first, sin `create-next-app`, sin `tsconfig.build.json` y con `jsx: "react-jsx"` (lo impone Next 16 y reescribe el `tsconfig`). Separar el entorno en `public-schema`/`public.ts` y `server-schema`/`server.ts` con `server-only`, de modo que `parsePublicEnv` solo copie claves `NEXT_PUBLIC_*`. Aplicar el tema por `prefers-color-scheme` con `data-theme` y sin toggle hasta M0-07, y usar `@next/eslint-plugin-next` + `eslint-plugin-react-hooks` al no ser compatible `eslint-config-next` con ESLint 10. | Un clon arranca con `pnpm dev` y las rutas `/`, `/login`, `/health`, `/api/health`, 404, error y loading ya existen con textos tipados. Una fuga de secretos al cliente rompe la compilación. Quedan como deuda aceptada la CSP con `nonce` y `Permissions-Policy` (M1-01), la ausencia de toggle de tema (M0-07) y el `server-schema.ts` sin `server-only` para poder testearlo. Esta entrada actualiza partes de D-013 (esquema de entorno y `tsconfig.build.json`); las subdecisiones de Node 22, pnpm/Corepack, CI, gitleaks/audit y protección de ramas del ADR 0016 se mantienen. |

Estas decisiones se documentan en el [ADR 0017](adr/0017-nextjs-scaffold-and-env-contract.md), que supersede al [ADR 0016](adr/0016-entorno-tooling-ci.md).

## 2026-11-15 — Sistema de diseño, temas y shell (issue #8, M0-07)

**Contexto.** El ADR 0010 había fijado dos temas y contraste AA, pero no cómo se
organizan los tokens, qué componentes base existen ni cómo se estructura el
shell responsive. El scaffold del ADR 0017 solo tenía una paleta cruda, unos
pocos tokens semánticos, un `Button` y un tema elegido por
`prefers-color-scheme` sin interruptor. Sin un sistema cerrado, cada pantalla
nueva inventaría colores, espaciados y navegación.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-016 | Sistema de diseño, componentes y shell | Organizar los tokens en **tres capas** (`palette.css` como única fuente de hex, `semantic.css` sin valores literales y `@theme inline` de Tailwind), con tests de capas y de contraste AA. Crear **doce componentes base** además del `Button`: nativos sin dependencia (`input`, `textarea`, `select` nativo, `field`, `card`, `badge`, `empty-state`), `dialog` y `drawer` sobre Radix Dialog (sin Vaul), `tabs` sobre Radix Tabs, `tooltip` sobre Radix Tooltip solo para botones de icono, `toast` propio con dos regiones `aria-live` (sin sonner ni Radix Toast) y `command` con `cmdk` cargado con `next/dynamic({ ssr: false })`. Aprobar las cuatro dependencias nuevas (`@radix-ui/react-dialog` 1.3.1, `@radix-ui/react-tabs` 1.2.1, `@radix-ui/react-tooltip` 1.4.1 y `cmdk` 1.1.1, MIT y React 19). Estructurar el shell con route groups `(public)` y `(workspace)`, rail colapsado entre 768 y 1023 px, completo desde 1024 px, topbar sticky, barra inferior con drawer «Más» por debajo de 768 px, migajas y estados vacíos, conservando URLs y landmarks. Persistir la preferencia Claro/Oscuro/Sistema en `localStorage` (`wc-theme`), aplicarla antes del primer pintado con un `<script>` en línea —no `next/script`, que llegaba tarde y producía parpadeo— y derivar `themeColor` y manifest de `theme-palette.ts`. Versionar cuatro capturas de viewport en `docs/diseno/capturas/`, regenerables con `pnpm design:captures`. | El sistema queda verificable: un color fuera de la paleta, un tema a medias o un contraste por debajo de AA rompen la suite de tokens. `/design-system` documenta fundamentos, componentes, patrones y accesibilidad con ejemplos reales. Las URLs y los landmarks existentes se conservan. Quedan como deuda aceptada la ausencia de sincronización de tema entre pestañas, los avisos fijos sobre la barra inferior en móvil, `format:check` sensible a CRLF en local, `error`/`loading` cubiertos solo en unitarias y las claves `common.*` sin uso. La textura de papel se aplaza a M1-02, los tokens de entidad a M1-03 y la CSP con `nonce`/hash a M1-01. Esta entrada desarrolla D-002 sin contradecirla. |

Estas decisiones se documentan en el [ADR 0018](adr/0018-design-system-tokens-and-shell.md) y en la guía práctica [`docs/diseno/sistema-de-diseno.md`](diseno/sistema-de-diseno.md). El manual de usuario todavía no existe: se creará como esqueleto en M0-09 (issue [#10](https://github.com/gonzalitojh/world-craft/issues/10)) y cubrirá navegación y estructura del shell, los temas Claro/Oscuro/Sistema y la paleta de comandos. Esta entrada no cambia `AGENTS.md`, `docs/proceso-sdd.md` ni el equipo de agentes.

## 2026-11-15 — Modelo de datos, migraciones y RLS (issue #9, M0-08)

**Contexto.** Los ADRs 0002 y 0011 habían fijado PostgreSQL, Drizzle, Zod y el
modelo de acceso, pero no existía el modelo ejecutable: ni tablas, ni
migraciones, ni políticas, ni forma de comprobar el aislamiento entre mundos. Sin
ese cierre, cada issue de M1 habría inventado nombres, índices y reglas, y el
requisito «el `owner` no puede perderse sin transferir» habría quedado solo en la
aplicación. El entorno impone tres condiciones: no hay Docker ni Supabase CLI, la
CI no puede tener credenciales de Supabase y el coste objetivo es 0 €/mes.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-017 | Esquema, migraciones y RLS | Mantener una **cadena única de siete migraciones** en `drizzle/` (una generada por Drizzle Kit y seis custom) con rollback documentado en `drizzle/rollback/`, prohibiendo `drizzle-kit push`. Modelar **24 tablas** con `world_id` directo en las de primer nivel y derivado con funciones `app.*_world_id` en las hijas. Aplicar RLS en las 24 tablas con funciones `security definer` en el esquema `app` no expuesto, `search_path = ''` y `(select auth.uid())` en las políticas. Dejar `allowed_emails` con RLS y **cero políticas y cero privilegios**. Garantizar un único `owner` con `worlds.owner_id`, un índice único parcial, dos triggers y `app.transfer_world_ownership` atómica. Revocar todo por defecto y conceder por tabla y columna (fail-closed), incluido `notify pgrst, 'reload schema'`. Separar `DATABASE_URL` (pooler transaccional, 6543) de `DIRECT_URL` (pooler de sesión, 5432) y validar ambas de forma perezosa y estricta. Sacar el catálogo del sistema (12 tipos de entidad y 15 de relación) a JSON con validación Zod y seed idempotente. Probar la RLS contra la base real con cuatro identidades y usuarios insertados en `auth.users`. Fijar el contrato `StorageAdapter` y las claves `world/{worldId}/{assetId}.{ext}` sin configurar R2. | El modelo es verificable con `db:verify` y `test:db`; una tabla nueva nace cerrada; `anon` no tiene `usage` sobre `public`; el cliente no puede reescribir `worlds.owner_id` ni `assets.path`; el build y la CI siguen sin credenciales. Quedan como deuda aceptada la verificación real de migraciones, seed y RLS (requiere que el propietario cree el proyecto Supabase de desarrollo y pegue las credenciales), la ausencia de copias automáticas (M5-06), la purga de papelera, el catálogo de juego del sistema (M4-04) y el fallo local de `format:check` por fin de línea CRLF en archivos no tocados, que en Linux no se reproduce. |

Estas decisiones se documentan en el [ADR 0019](adr/0019-database-schema-migrations-and-rls.md) y en las guías [`docs/base-de-datos/esquema.md`](base-de-datos/esquema.md) y [`docs/base-de-datos/operacion.md`](base-de-datos/operacion.md). El manual de usuario no cambia: la issue no añade interfaz ni textos visibles. Esta entrada no modifica `AGENTS.md`, `docs/proceso-sdd.md` ni el equipo de agentes.

## 2026-11-15 — Proveedor de modelos de los subagentes (cambio solicitado por el usuario)

**Contexto.** Los siete subagentes fijaban `deepseek/deepseek-flash` con la API key personal del usuario. El usuario cambió el frontmatter para usar el proveedor OpenCode y pidió conservar ese cambio en esta implementación y en las futuras. El identificador escrito inicialmente (`opencode/deepseek-flash`) no existe en el catálogo; el modelo gratuito disponible es `opencode/deepseek-v4.1-flash-free`.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-018 | Proveedor y modelo de los subagentes | Migrar los siete subagentes a `opencode/deepseek-v4.1-flash-free`, manteniendo las variantes fijas de D-012: `high` para `task-architect`, `tdd-ddd-architect`, `ui-ux-designer` y `security-champion`; `low` para `qa-reviewer`, `documentation-sync` y `publisher`. `sdd-master` sigue usando el modelo de la sesión. | No se usa la API key personal de DeepSeek y el coste directo del modelo es 0. El modelo depende de la disponibilidad del plan gratuito de OpenCode; si cambia el catálogo, se actualiza el frontmatter y esta entrada. La caché y las variantes siguen afectando a latencia y límites de uso. El frontmatter de los siete agentes y `docs/variantes-modelo.md` son la fuente de verdad operativa. |

Estas decisiones actualizan D-012 y la referencia de modelo del [ADR 0015](adr/0015-coste-contexto-cache-variante-fija.md); la política de variantes y caché se mantiene en [`docs/variantes-modelo.md`](variantes-modelo.md).
