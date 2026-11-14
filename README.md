# World Craft

World Craft es una aplicación privada para crear y mantener **mundos de ficción**:
fichas y entidades, relaciones, mapas, grafo de conocimiento, escritura de
manuscritos y juego creativo. Todo el contenido requiere sesión y permisos: no
hay contenido público por defecto. El código se publica bajo licencia MIT; los
datos de los mundos siguen siendo privados.

## Estado

**En construcción, fase M0 (fundaciones y proceso).** El repositorio ya tiene
entorno reproducible, TypeScript estricto, tests y CI (issue #6, M0-05). Todavía
no hay aplicación ejecutable: el scaffold de Next.js llega con la issue #7
(M0-06) y la primera funcionalidad visible, después.

## Requisitos

- **Node.js 22 LTS** (obligatorio: `engines.node` limita a `>=22.22.2 <23`).
  La línea 22 está fijada en `.nvmrc`.
- **pnpm vía Corepack.** No hace falta instalarlo aparte:

  ```bash
  corepack enable
  ```

  La versión exacta está fijada en `packageManager` (`pnpm@12.18.0`); Corepack
  la descarga la primera vez.
- Git.

En Windows, `corepack enable` escribe los shims en `C:\Program Files\nodejs`, así
que puede necesitar una consola de PowerShell **como administrador**. Si no
puedes o no quieres elevarla, instala los shims en tu perfil y añade esa carpeta
al PATH:

```powershell
corepack enable --install-directory "$env:LOCALAPPDATA\corepack-shims"
$env:Path = (Join-Path $env:LOCALAPPDATA 'corepack-shims') + ';' + $env:Path
```

Para que sea permanente, añade `%LOCALAPPDATA%\corepack-shims` al PATH del
usuario. Además, la política de ejecución de PowerShell puede bloquear
`pnpm.ps1`; en ese caso usa `pnpm.cmd` (por ejemplo `pnpm.cmd typecheck`).

## Arranque local

Desde un clon nuevo, en menos de 30 minutos:

```bash
# 1. Dependencias (con el lockfile congelado)
pnpm install

# 2. Variables de entorno locales (opcional hasta #7; nunca se versiona)
cp .env.example .env.local        # macOS / Linux / Git Bash
# Copy-Item .env.example .env.local  # PowerShell

# 3. Verificación
pnpm typecheck
pnpm lint
pnpm test
```

`.env.example` está versionado y no contiene secretos. `.env.local` y cualquier
otro `.env*` quedan fuera de git. El esquema de validación vive en
`src/lib/env.ts` y las claves de Supabase y R2 todavía son opcionales.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Compila `src` en modo watch (`tsc --watch`). |
| `pnpm build` | Compila `src` a `dist` con `tsc`. |
| `pnpm lint` | ESLint 10 sobre todo el repositorio. |
| `pnpm typecheck` | TypeScript estricto sin emitir. |
| `pnpm test` | Tests unitarios con Vitest. |
| `pnpm test:e2e` | Tests E2E con Playwright (smoke sin servidor). |
| `pnpm format` | Formatea con Prettier. |
| `pnpm format:check` | Comprueba el formato sin escribir. |

`dist/`, `coverage/`, `playwright-report/` y `test-results/` están ignorados por
git. La primera vez que se ejecute Playwright hay que descargar el navegador:

```bash
pnpm exec playwright install chromium
```

## Calidad y CI

- TypeScript estricto (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noUnusedLocals`/`Parameters`,
  `verbatimModuleSyntax`).
- ESLint 10 con flat config y Prettier sin reglas en conflicto.
- Vitest + Testing Library + jsdom para unidad y componentes; Playwright para
  E2E.
- GitHub Actions ejecuta `lint`, `typecheck`, `test` y `build` en cada PR y en
  cada push a `dev` y `main`. Son los **required checks** de la protección de
  ramas (ADR 0016); los rulesets que los exigen se aplican al publicar la issue
  #6 y hasta entonces las reglas activas no exigen checks. `e2e`, `gitleaks`
  (secretos) y `audit` (dependencias) también se ejecutan, sin bloquear.
- Dependabot revisa cada semana las dependencias npm y las acciones.

Las pruebas de producto llegarán con la aplicación; hoy solo hay tests de humo
del tooling y del esquema de entorno.

## Stack previsto

- [Next.js](https://nextjs.org/) App Router + React + TypeScript estricto.
- [Supabase](https://supabase.com/) PostgreSQL y Auth con allowlist.
- [Drizzle ORM](https://orm.drizzle.team/) + [Zod](https://zod.dev/).
- [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) para
  archivos, con bucket privado y URLs firmadas.
- [Vercel](https://vercel.com/) Hobby para el despliegue.

## Estructura del repositorio

- `src/`: código de la aplicación (por ahora, solo `src/lib/env.ts`).
- `tests/`: tests unitarios (`tests/unit`) y E2E (`tests/e2e`).
- `docs/`: plan, proceso, decisiones y ADRs.
- `tasks/`: task files del flujo SDD.
- `scripts/`: utilidades de mantenimiento del repositorio.
- `.github/`: CI, Dependabot y plantillas de issue y PR.
- `.opencode/`: agentes y configuración de OpenCode.

## Ramas

- `main`: versión estable. Solo la promueve el propietario desde `dev`.
- `dev`: rama de integración. Todas las Pull Requests se abren contra `dev`,
  nunca contra `main`.

## Documentación

- [AGENTS.md](AGENTS.md): reglas obligatorias y Definition of Done.
- [docs/proceso-sdd.md](docs/proceso-sdd.md): flujo SDD, puertas y publicación
  local-first.
- [docs/plan-desarrollo.md](docs/plan-desarrollo.md): plan aprobado y alcance.
- [docs/registro-decisiones.md](docs/registro-decisiones.md): registro de
  decisiones.
- [docs/adr/README.md](docs/adr/README.md): índice de ADRs.
- [CONTRIBUTING.md](CONTRIBUTING.md): ramas, commits, PRs y calidad.
- [SECURITY.md](SECURITY.md): cómo reportar una vulnerabilidad.
- [LICENSE](LICENSE): licencia MIT.
