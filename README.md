# World Craft

World Craft es una aplicación privada para crear y mantener **mundos de ficción**:
fichas y entidades, relaciones, mapas, grafo de conocimiento, escritura de
manuscritos y juego creativo. Todo el contenido requiere sesión y permisos: no
hay contenido público por defecto. El código se publica bajo licencia MIT; los
datos de los mundos siguen siendo privados.

## Estado

**En construcción, fase M0 (fundaciones y proceso).** El repositorio ya tiene
entorno reproducible, TypeScript estricto, tests y CI (issue #6, M0-05) y una
aplicación Next.js ejecutable (issue #7, M0-06): App Router, Tailwind CSS,
shadcn/ui mínimo, fuentes, páginas base y validación de entorno.

Todavía **no hay producto**: no existe autenticación (M1-01), ni base de datos
(M0-08), ni contenido. `/login` es un placeholder y `/health` solo comprueba que
el despliegue responde.

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
`pnpm.ps1`; en ese caso usa `pnpm.cmd` (por ejemplo `pnpm.cmd typecheck`) o
invócalo con `corepack pnpm typecheck`.

## Arranque local

Desde un clon nuevo, en menos de 30 minutos:

```bash
# 1. Dependencias (con el lockfile congelado)
pnpm install

# 2. Variables de entorno locales (opcionales; nunca se versiona el resultado)
cp .env.example .env.local        # macOS / Linux / Git Bash
# Copy-Item .env.example .env.local  # PowerShell

# 3. Servidor de desarrollo en http://localhost:3000
pnpm dev

# 4. Verificación antes de publicar
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm dev` levanta Next.js 16 con Turbopack. El servidor de producción se prueba
con `pnpm build` y después `pnpm start`.

Rutas disponibles en esta fase:

| Ruta | Qué muestra |
|---|---|
| `/` | Portada con el estado de la fase y tres pilares del producto. |
| `/login` | Placeholder de acceso: aviso y botón deshabilitado, sin formulario. |
| `/health` | Estado del despliegue: commit, hora de comprobación y endpoint. |
| `/api/health` | JSON `{ "status": "ok", "timestamp": "…" }` sin caché. |

`.env.example` está versionado y no contiene secretos. `.env.local` y cualquier
otro `.env*` quedan fuera de git.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo de Next.js (`next dev`). |
| `pnpm build` | Build de producción en `.next` (`next build`). |
| `pnpm start` | Sirve el build de producción. |
| `pnpm clean` | Borra `.next`, `dist`, `coverage`, `playwright-report` y `test-results`. |
| `pnpm lint` | ESLint 10 sobre todo el repositorio. |
| `pnpm typecheck` | TypeScript estricto sin emitir. |
| `pnpm test` | Tests unitarios y de componentes con Vitest. |
| `pnpm test:e2e` | Tests E2E con Playwright; levanta el servidor si hace falta. |
| `pnpm format` | Formatea con Prettier. |
| `pnpm format:check` | Comprueba el formato sin escribir. |

`.next/`, `out/`, `coverage/`, `playwright-report/` y `test-results/` están
ignorados por git. La primera vez que se ejecute Playwright hay que descargar el
navegador:

```bash
pnpm exec playwright install chromium
```

## Estructura del repositorio

```text
src/
  app/            Rutas del App Router, layouts, metadatos y assets de la app
    api/health/   Route handler JSON del healthcheck
  components/     Presentación reutilizable (ui/ para primitivas shadcn)
  lib/            Utilidades puras, entorno y helpers sin React
    env/          Esquemas de entorno público y de servidor
  messages/       Textos de interfaz centralizados y tipados
  modules/        Módulos de dominio (fichas, mapas, manuscritos…)
tests/
  unit/           Vitest + Testing Library
  e2e/            Playwright (rutas, responsive, temas y axe)
scripts/          Utilidades de mantenimiento del repositorio
docs/             Plan, proceso, decisiones y ADRs
tasks/            Task files del flujo SDD
.github/          CI, Dependabot y plantillas de issue y PR
.opencode/        Agentes y configuración de OpenCode
```

`src/modules/` está preparada pero todavía vacía: cada dominio tendrá su lógica
de negocio separada de la presentación. Los detalles están en
[`src/modules/README.md`](src/modules/README.md).

## Stack

- [Next.js 16](https://nextjs.org/) App Router + React 19 + TypeScript estricto.
- [Tailwind CSS 4](https://tailwindcss.com/) CSS-first, shadcn/ui, Radix, Lucide
  y `next/font` (Fraunces, Inter y JetBrains Mono).
- [Zod](https://zod.dev/) para validar entorno y datos.
- [Vitest](https://vitest.dev/), Testing Library, [Playwright](https://playwright.dev/)
  y axe.
- [Vercel](https://vercel.com/) Hobby para el despliegue.
- Previstos: [Supabase](https://supabase.com/) (PostgreSQL y Auth con allowlist),
  [Drizzle ORM](https://orm.drizzle.team/),
  [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/),
  MapLibre + Terra Draw, React Flow + ELK y Tiptap 3.

## Convenciones

- **App Router y Server Components por defecto.** `'use client'` solo en
  componentes con estado, efectos o eventos (por ejemplo `error.tsx`).
- **TypeScript estricto:** `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noUnusedLocals`/`Parameters`,
  `verbatimModuleSyntax`. Sin `any` implícitos ni `@ts-ignore` sin justificar.
- **Alias `@/*`** hacia `src/*` en TypeScript y Vitest. Los imports relativos se
  reservan a archivos hermanos.
- **Tailwind CSS 4 CSS-first.** Los tokens viven en `src/app/globals.css`; no
  hay `tailwind.config`. Los componentes usan utilidades semánticas
  (`bg-surface`, `text-foreground`, `border-border`, `text-muted-foreground`,
  `bg-accent`), nunca la paleta cruda `--craft-*` ni prefijos `dark:`.
- **shadcn/ui mínimo.** `components.json` y `src/lib/utils.ts` (`cn`) permiten
  añadir componentes con el CLI. Hoy solo hay `Button`, adaptado a los tokens.
  Lucide es la librería de iconos.
- **Textos centralizados.** Todo lo visible, incluidos los `aria-label`, vive en
  `src/messages/es.ts` y se lee con `t('clave.con.puntos')` o `getMessages()`.
  No se escriben cadenas de interfaz en los componentes (ADR 0012).
- **Lógica de negocio fuera de la presentación.** Los componentes no validan
  reglas de dominio: eso vive en `src/modules/` y en funciones puras de
  `src/lib/`.
- **Idioma.** Interfaz en español; identificadores, base de datos, ramas y
  labels en inglés; comentarios y documentación en español.

## Entorno público y de servidor

El entorno se valida con Zod y está separado en dos esquemas para que un
descuido no filtre secretos al navegador:

| Módulo | Contenido | Se puede importar desde |
|---|---|---|
| `src/lib/env/public-schema.ts` | Solo claves `NEXT_PUBLIC_*` y helpers. | Cualquier sitio, también cliente. |
| `src/lib/env/public.ts` | `publicEnv`, ya validado. | Cualquier sitio. |
| `src/lib/env/server-schema.ts` | Variables públicas + `NODE_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`, Supabase, `DATABASE_URL` y R2. | Servidor y tests. |
| `src/lib/env/server.ts` | `serverEnv`, marcado con `server-only`. | Solo servidor. |

`parsePublicEnv` copia únicamente claves públicas: aunque reciba el
`process.env` completo, el resultado no contiene secretos. Importar `server.ts`
desde un componente cliente rompe la compilación gracias a `server-only`.

`src/lib/site-url.ts` resuelve el origen del sitio en este orden:
`NEXT_PUBLIC_SITE_URL` → `https://${VERCEL_URL}` → `http://localhost:3000`.

Las claves de Supabase y R2 son opcionales hasta que sus módulos las consuman
(M0-08 y M0-10). `.env.example` separa las variables públicas de las de
servidor.

## Temas

La aplicación tiene dos temas, **Claro y Oscuro**, sin interruptor: el tema se
elige por `prefers-color-scheme` y se mantiene sincronizado si el sistema
cambia. Un script mínimo en el `body` fija `data-theme="light"` o `"dark"`
antes del primer pintado; sin JavaScript, `:root` sirve el tema claro completo.

`globals.css` define una paleta cruda única (`--craft-*`) y dos mapeos
semánticos: `:root, [data-theme="light"]` y `[data-theme="dark"]`. Las
utilidades de Tailwind se generan con `@theme inline`, así que cambiar de tema
no recompila CSS ni exige variantes `dark:`.

Al añadir componentes hay que comprobarlos en los dos temas, con contraste AA
(4.5:1 texto normal, 3:1 texto grande y elementos gráficos). Los tests E2E
recorren las cuatro pantallas en ambos temas y pasan axe.

## Accesibilidad y responsive

- Un solo `h1` por página, landmarks `header`/`main`/`footer` y enlace «Saltar
  al contenido» como primer elemento enfocable.
- Foco visible global (`outline` de 2 px con offset), navegación completa por
  teclado y sin `tabIndex` positivos.
- Los estados no se comunican solo con color (por ejemplo, el healthcheck usa
  icono `aria-hidden` + texto).
- `prefers-reduced-motion` anula animaciones y transiciones.
- Layout fluido sin scroll horizontal de página a 360, 768 y 1280 px; los tests
  E2E lo comprueban con contenido largo realista.

## Calidad y CI

- TypeScript estricto y ESLint 10 con `@next/eslint-plugin-next` y
  `eslint-plugin-react-hooks` (sin `eslint-config-next`, todavía incompatible
  con los peers de ESLint 10), más Prettier.
- **Vitest** para esquemas de entorno, mensajes, utilidades, healthcheck y el
  componente `Button`; **Playwright** para rutas, 404, API, responsive, temas y
  accesibilidad con `@axe-core/playwright`.
- GitHub Actions ejecuta `lint`, `typecheck`, `test` y `build` en cada PR y en
  cada push a `dev` y `main`. Son los **required checks** de la protección de
  ramas ([ADR 0017](docs/adr/0017-nextjs-scaffold-and-env-contract.md), que
  mantiene esta subdecisión del ADR 0016). `e2e`, `gitleaks` (secretos) y
  `audit` (dependencias) también se ejecutan, sin bloquear.
- CI define `NEXT_TELEMETRY_DISABLED=1`: el servidor de desarrollo y el build no
  envían telemetría.
- Dependabot revisa cada semana las dependencias npm y las acciones.

## Despliegue en Vercel

El despliegue usa Vercel Hobby (ADR 0005). El repositorio está listo para
conectarlo como proyecto:

1. Importar el repositorio en Vercel y dejar el framework autodetectado
   (Next.js), la raíz en la raíz del repositorio y la versión de Node tomada de
   `.nvmrc`.
2. Configurar las variables de entorno en el panel de Vercel: las públicas como
   `NEXT_PUBLIC_*` y las de servidor como variables normales (nunca con prefijo
   público).
3. Cada rama y cada PR genera una **preview** con su propio dominio; `main`
   queda para la versión estable.

### `vercel.json`

El proyecto de Vercel se creó cuando el repositorio solo tenía el tooling de
M0-05, que compilaba con `tsc` a `dist`. Esa configuración hacía que el
despliegue buscara una salida estática `dist` que `next build` ya no genera
(`STATIC_BUILD_NO_OUT_DIR`).

`vercel.json` fija `"framework": "nextjs"` de forma explícita para que la build
y la salida las gestione Next.js y el despliegue no dependa de ajustes
manuales del panel. No declara `outputDirectory` a propósito: con el framework
de Next.js, Vercel usa `.next` y detecta la salida por su cuenta.

El panel **no debe sobrescribir** el *Output Directory*: si en Project
Settings → Build & Development Settings sigue apareciendo `dist` (o cualquier
otra ruta), hay que vaciar ese campo para que mande el framework.

La preview desde una rama o PR se crea al publicar y conectar el proyecto; es
una acción del propietario en Vercel, no del repositorio.

## Limitaciones actuales

- Sin autenticación, base de datos, RLS ni almacenamiento: `/login` es un
  placeholder y no hay contenido.
- Sin sistema de diseño completo (M0-07): solo los tokens mínimos y un `Button`.
- Manifest inicial sin service worker; la PWA completa llega más adelante
  (ADR 0009).
- Sin CSP con nonce: se añadirá con la autenticación (M1-01).
- La línea base de Lighthouse está registrada en
  [`docs/calidad/linea-base-lighthouse.md`](docs/calidad/linea-base-lighthouse.md):
  se midió con el scaffold de esta fase y no fija umbrales.

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
