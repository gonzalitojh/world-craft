# ADR 0016 — Entorno de desarrollo, tooling y CI base

> **Nota de supersesión:** este ADR queda **supersedido por el
> [ADR 0017](0017-nextjs-scaffold-and-env-contract.md)** al integrarse Next.js
> en la issue #7. Se conserva el resto del contenido como histórico. El ADR
> 0017 mantiene expresamente las subdecisiones sobre Node 22, pnpm/Corepack, CI
> con cuatro required checks, gitleaks/`pnpm audit` y protección de ramas.

- **Estado:** supersedido por ADR 0017
- **Fecha de la decisión:** 2026-11-14
- **Fecha del documento:** 2026-11-14
- **Issue:** #6 (M0-05)
- **Decisiones del registro:** D-013, D-014
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0009, ADR 0013, ADR 0014, ADR 0015

## Contexto

Hasta la issue #5 el repositorio solo contenía documentación, scripts de
administración y plantillas: no había `package.json`, ni compilador, ni tests,
ni CI. La issue #6 debía dejar un entorno reproducible antes del scaffold de
Next.js (M0-06, issue #7) para que cualquier clon pudiera arrancarse en menos de
30 minutos y cada PR tuviera una verificación automática.

Las decisiones de partida ya estaban cerradas en el plan: Node 22 LTS, pnpm,
TypeScript estricto, Vitest + Testing Library + Playwright y gitleaks con
`pnpm audit` en CI (plan §4.7 y reglas 9, 10 y 12 de `AGENTS.md`). Faltaba
concretar versiones, scripts, jobs y required checks sin adelantar la
aplicación.

El usuario aprobó tres puntos el 14/11/2026: instalar Node 22 LTS con winget y
pnpm con Corepack; limitar el esqueleto a tooling TypeScript mínimo
(`src/lib/env.ts`, tests de humo, `build` con `tsc`, `dev` con `tsc --watch` y
un smoke de Playwright sin servidor) sin adelantar Next.js; y extender
`scripts/set-branch-protection.ps1` con los required checks ahora, aplicando
los rulesets al publicar y no antes, para no bloquear las PRs mientras la CI
todavía no existe en `dev`.

## Decisión

1. **Node y pnpm.** Node 22 LTS como única línea soportada: `.nvmrc` pide la
   línea `22` y la CI instala el último 22.x, sin fijar una versión exacta;
   `engines.node` fija el mínimo `>=22.22.2` (lo exige jsdom 31) y excluye 23+.
   pnpm vía Corepack con la versión fijada en `packageManager:
   pnpm@12.18.0`; el lockfile se versiona y la CI instala con
   `--frozen-lockfile`.
2. **TypeScript estricto.** `tsconfig.json` con `strict`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`,
   `isolatedModules`, `moduleResolution: Bundler` y `target: ES2022`.
   `typecheck` ejecuta `tsc --noEmit`; `tsconfig.build.json` emite a `dist`
   solo desde `src`; `build` compila una vez y `dev` compila en modo watch.
3. **ESLint y Prettier.** ESLint 10 con flat config (`eslint.config.mjs`),
   `@eslint/js` recommended, `typescript-eslint` recommended y
   `eslint-config-prettier` al final para que no haya reglas en conflicto.
   `eslint` se fija exacto a `10.14.0` porque `10.15.0` se publicó dentro de la
   ventana de antigüedad mínima de 24 h de pnpm 12; Dependabot lo subirá a la
   10.15.x cuando esa versión haya superado la ventana. Prettier con líneas de
   80 columnas, comillas simples y comas finales. Scripts `lint`, `format` y
   `format:check`.
4. **Pruebas.** Vitest 5 con entorno `node` por defecto y tests en
   `tests/unit/**/*.test.ts`; jsdom y `@testing-library/dom` se usan en un test
   con `// @vitest-environment jsdom`. Vitest 5 exige `vite` 8 como peer
   obligatorio, así que se declara como dependencia de desarrollo: es su motor
   de transformación, no una dependencia de producto. Playwright con un único
   smoke en `tests/e2e` que usa `page.setContent` y no levanta servidor: no hay
   aplicación hasta #7. No se escriben tests de producto.
5. **Variables de entorno.** `src/lib/env.ts` define el esquema Zod con
   `NODE_ENV` (`development` | `test` | `production`, por defecto
   `development`) y las claves futuras de Supabase, base de datos y R2 como
   opcionales. Las cadenas vacías se tratan como ausentes con `preprocess`. Se
   exportan el tipo `Env` y la función pura `parseEnv(source)`. `.env.example`
   documenta las claves con valores vacíos y es seguro versionarlo.
6. **CI en GitHub Actions.** `.github/workflows/ci.yml` se ejecuta en cada PR y
   en cada push a `dev` y `main`, con `permissions: contents: read` y
   `concurrency` con `cancel-in-progress`. La acción compuesta
   `.github/actions/setup` instala pnpm, Node desde `.nvmrc` y las dependencias
   congeladas. Jobs: `lint`, `typecheck`, `test` y `build` (required checks),
   más `e2e`, `gitleaks` y `audit` (no required).
7. **Seguridad de dependencias.** `gitleaks/gitleaks-action` fijada por SHA
   (`ff98106e… # v2.3.9`) con `fetch-depth: 0` y `GITHUB_TOKEN`;
   `pnpm audit --audit-level=high`, que audita también las dependencias de
   desarrollo (una crítica en el tooling es un riesgo del repositorio).
   Dependabot semanal para npm y GitHub Actions, agrupando minor y patch, con
   límite de 5 PRs abiertas y la etiqueta `type: chore`.
8. **Protección de ramas.** `scripts/set-branch-protection.ps1` acepta
   `-RequiredChecks` (por defecto `lint`, `typecheck`, `test`, `build`) y
   escribe la regla `required_status_checks` en `protect-dev` y `protect-main`
   con `strict_required_status_checks_policy = $false`. Los rulesets se aplican
   al publicar, cuando la CI ya está en `dev`.
9. **Esqueleto temporal.** Hasta #7 el único código de producto es
   `src/lib/env.ts`; no se añaden React, Next.js, Tailwind ni dependencias de
   producto.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| npm en lugar de pnpm | pnpm ya estaba aprobado en el plan; el lockfile estricto y la caché de pnpm aceleran la CI y evitan instalaciones divergentes. |
| Últimas versiones mayores sin fijar (TypeScript 7) | `typescript-eslint` declara compatibilidad con TypeScript `<6.1`; TypeScript 5.9 es la línea soportada. ESLint 10 sí se adopta porque el peer y la configuración son compatibles. |
| Vitest 3 | Su árbol de dependencias arrastraba `tinypool <=2.1.0`, con una vulnerabilidad **crítica** detectada por `pnpm audit`, y tampoco ahorraba una dependencia real: Vitest 5 usa Vite 8 como peer. |
| Vitest 4 | También exige `vite` como peer y no aporta nada frente a Vitest 5, que es la versión con el árbol auditado sin vulnerabilidades altas. |
| Tests E2E contra la aplicación desde #6 | No hay aplicación hasta #7; un smoke con `page.setContent` valida el tooling sin servidor ni base de datos. |
| Incluir `e2e` y `audit` como required checks | Un fallo de navegador o una vulnerabilidad nueva en una dependencia no imputable a la PR bloquearía la fusión; se revisan en QA y seguridad. |
| Aplicar los rulesets con checks antes de publicar la CI | Bloquearía todas las PRs, incluida la de esta issue, porque los checks no existirían todavía en `dev`. |

## Consecuencias

### Positivas

- Un clon nuevo se pone en marcha con `corepack enable`, `pnpm install` y
  `pnpm typecheck`, sin instalar nada más.
- Los cuatro checks required son rápidos (sin navegador ni servicios) y cubren
  tipos, estilo, tests y compilación.
- El esquema de entorno falla pronto y de forma explícita si un valor es
  inválido, y no exige claves que todavía no se usan.
- gitleaks y `pnpm audit` se ejecutan en cada PR y en cada push a `dev` y
  `main` sin bloquear por hallazgos no imputables.

### Negativas y riesgos

- Vitest 5 obliga a declarar `vite` 8 como dependencia de desarrollo. Es su
  motor de transformación y simplifica la configuración; se actualiza con
  Dependabot junto al resto del tooling.
- Queda una vulnerabilidad **moderada** en `minimatch` 10.2.6
  (GHSA-g3hv-75wg-m249), compartida por los árboles de `eslint` 10.14.0 y
  `typescript-eslint` 8.x, sin versión parcheada compatible todavía. No es HIGH,
  afecta solo al lint en desarrollo y se acepta como riesgo de tooling; se
  resolverá al actualizar esas dependencias. `pnpm audit --audit-level=high`
  sale en verde.
- `@playwright/test` y `eslint` se fijan a una versión exacta (`1.65.0` y
  `10.14.0`): sus parches inmediatamente posteriores (1.65.1 y 10.15.0) se
  publicaron dentro de la ventana de antigüedad mínima de 24 h de pnpm 12.
  Dependabot los subirá cuando esas versiones hayan superado la ventana.
- `.nvmrc` fija la línea 22.x y `engines` el mínimo `>=22.22.2 <23`: la CI
  instala el último 22.x, no una versión exacta, y se actualiza al ritmo de Node
  22. Si el último 22.x rompiera algo, se fijaría una versión concreta.
- Las actions se referencian por **SHA completo con la versión en comentario**
  (`actions/checkout@11d5960a… # v4.4.0`, etc.). Dependabot las mantiene y el
  pinning por SHA evita que un tag se mueva bajo los pies.
- `build` no limpia `dist/`: `tsc` sobrescribe lo que compila, pero un archivo
  eliminado de `src` seguiría en la salida. Se añadirá un script `clean` en #7.
- El esquema de entorno mezcla claves públicas (`SUPABASE_URL`,
  `SUPABASE_ANON_KEY`) y de servidor (`SUPABASE_SERVICE_ROLE_KEY`,
  `R2_SECRET_ACCESS_KEY`) en el mismo objeto. En #7 se separará por contextos o
  se marcará `server-only` para evitar importarlo desde cliente.
- `NODE_ENV` vacío cae en `development`. Es cómodo para tests y desarrollo local,
  pero se revisará cuando exista un arranque real y un entorno de despliegue.
- `Prettier` ignora Markdown y las plantillas previas (`.prettierignore`) para
  no reformatear documentación editorial ni mezclar cambios ajenos; el formato
  de esos archivos se revisa a mano.
- `e2e`, `gitleaks` y `audit` no son required porque el conjunto acordado en la
  issue #5 es `lint`, `typecheck`, `test` y `build`. Un fallo puede pasar
  desapercibido si no se revisa la pestaña de checks. Mitigación: la **puerta de
  seguridad debe revisar sus resultados** antes de publicar y la Definition of
  Done exige dejarlos verdes; el informe de Playwright queda como artefacto. El
  escaneo de secretos y la push protection del repositorio siguen activos como
  segunda línea.
- El esqueleto es deliberadamente mínimo y se tocará en #7 (Next.js); parte de
  la configuración (`tsconfig`, scripts, ESLint) se ampliará entonces.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | No aplica: no hay UI hasta #7. |
| Temas (Claro/Oscuro) | No aplica: no hay UI. |
| Accesibilidad | No aplica todavía; Playwright y axe se configurarán con la UI. |
| Seguridad y privacidad | Positivo: permisos mínimos en CI, gitleaks, auditoría de dependencias y `.env.example` sin secretos. |
| Coste | 0 €/mes: Actions ilimitado en repositorio público y herramientas de licencia libre. |
| Portabilidad de datos | No aplica: no hay modelo de datos todavía. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Minutos de GitHub Actions | Repositorio público: sin límite de minutos; 2.000 min/mes si pasara a privado | Jobs ligeros, caché de pnpm y `concurrency` que cancela ejecuciones antiguas. | Pestaña Actions y facturación de GitHub. |
| gitleaks-action sin licencia | Gratis para repositorios públicos; requiere licencia en organizaciones | El repositorio es público (ADR 0014); si cambia la visibilidad, se revisa el plan. | Workflow `gitleaks`. |
| Ruido de Dependabot | Hasta 5 PRs abiertas por ecosistema | Agrupación de minor y patch y revisión semanal. | Pestaña Pull requests. |
| Descarga de Chromium en cada ejecución | ~350 MB por job y minutos de CI | Solo el job `e2e`, con caché de Playwright opcional si crece el uso. | Workflow `e2e`. |
| Playwright fijado a 1.65.0 por la ventana de antigüedad de pnpm | Una versión parche reciente no se instala hasta pasadas 24 h | Se fija la última versión que ya superó la ventana; Dependabot la sube cuando corresponde. | `package.json` y Dependabot. |

No se añade ningún servicio de pago.

## Plan de revisión

Se revisa en M0-06 (issue #7) al añadir Next.js, porque cambian `build`,
`dev`, `tsconfig` y los ignores de ESLint y Prettier. Se revisa también al
subir de versión mayor de Node, al cambiar de gestor de paquetes, al añadir
servicios que exijan claves obligatorias o si los checks required resultan
lentos o inestables. Reabre la decisión una issue de `area: infra` o
`area: architecture`.

## Referencias

- Issue: [#6](https://github.com/gonzalitojh/world-craft/issues/6)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md) §3.7, §4.7 y §5.2
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-013 y D-014
- [`docs/proceso-sdd.md`](../proceso-sdd.md) §7.7
- [ADR 0009](0009-testing-pwa-backups.md), [ADR 0013](0013-free-tier-continuity.md) y [ADR 0014](0014-public-repo-mit-and-branch-protection.md)
- Documentación oficial de pnpm 12 (Corepack y política de antigüedad mínima
  de releases), ESLint 10 (flat config), Vitest, Playwright, gitleaks y
  Dependabot, consultada el 14/11/2026.
