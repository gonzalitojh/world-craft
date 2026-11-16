# World Craft

World Craft es una aplicación privada para crear y mantener **mundos de ficción**:
fichas y entidades, relaciones, mapas, grafo de conocimiento, escritura de
manuscritos y juego creativo. Todo el contenido requiere sesión y permisos: no
hay contenido público por defecto. El código se publica bajo licencia MIT; los
datos de los mundos siguen siendo privados.

## Estado

**En construcción, fase M0 (fundaciones y proceso).** El repositorio ya tiene
entorno reproducible, TypeScript estricto, tests y CI (issue #6, M0-05), una
aplicación Next.js ejecutable (issue #7, M0-06), el sistema de diseño con sus
temas y el shell responsive (issue #8, M0-07) y el modelo de datos definido para
PostgreSQL con Drizzle, RLS y seed (issue #9, M0-08): 24 tablas, siete
migraciones, políticas por mundo y pruebas de aislamiento, aplicadas al proyecto
Supabase de desarrollo. La documentación base (issue #10, M0-09) reúne la
arquitectura, el esqueleto del manual de usuario y el changelog.

Todavía **no hay producto**: no existe autenticación (M1-01), ni almacenamiento de
archivos (M0-10), ni contenido. `/login` es un placeholder, `/health` solo
comprueba que el despliegue responde y `/design-system` documenta la interfaz. El
modelo de datos está definido en el repositorio, pero ninguna pantalla lo usa
todavía.

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
| `/design-system` | Página viva del sistema de diseño: tokens, componentes, patrones, accesibilidad y capturas. |
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
| `pnpm test:db` | Tests de integración y RLS contra el proyecto de Supabase de desarrollo (`DIRECT_URL`). |
| `pnpm db:ping` | Comprueba la conexión, el rol `authenticated` y `auth.uid()`. |
| `pnpm db:generate` | Genera una migración a partir del diff de `src/lib/db/schema/`. |
| `pnpm db:migrate` | Aplica las migraciones pendientes (`DIRECT_URL`). |
| `pnpm db:seed` | Upsert idempotente del catálogo del sistema. |
| `pnpm db:verify` | Verifica tablas, enums, RLS, privilegios y seed aplicados. |
| `pnpm db:reset` | **Destructivo**: elimina `public`, `app` y `drizzle` del proyecto de desarrollo y recrea `public`. |
| `pnpm db:check` | Valida journal y snapshots de Drizzle Kit sin conexión. |
| `pnpm design:captures` | Regenera las capturas de referencia del sistema de diseño en `docs/diseno/capturas/`. |
| `pnpm format` | Formatea con Prettier. |
| `pnpm format:check` | Comprueba el formato sin escribir. |

`.next/`, `out/`, `coverage/`, `playwright-report/` y `test-results/` están
ignorados por git. La primera vez que se ejecute Playwright hay que descargar el
navegador:

```bash
pnpm exec playwright install chromium
```

## Base de datos

PostgreSQL en Supabase Free con Drizzle ORM. El modelo definido en el
repositorio son 24 tablas con RLS por mundo, siete migraciones versionadas y un
seed idempotente del catálogo del sistema (12 tipos de entidad y 15 de relación).
El proyecto de Supabase de desarrollo ya tiene el modelo aplicado y verificado;
las credenciales viven en `.env.local` y nunca se versionan.

- **Dos cadenas de conexión.** `DATABASE_URL` es el pooler transaccional (6543)
  del runtime, con `prepare: false`; `DIRECT_URL` es el pooler de sesión (5432)
  de migraciones, seed, reset y pruebas de RLS.
- **Scripts.** `pnpm db:ping`, `db:generate`, `db:migrate`, `db:seed`,
  `db:verify`, `db:reset` y `db:check`. Ninguno se ejecuta sin credenciales
  salvo `db:generate` y `db:check`.
- **Migraciones.** Cadena única en `drizzle/`; las aplicadas no se editan y
  `drizzle-kit push` está prohibido. Cada una tiene su rollback documentado en
  `drizzle/rollback/`.
- **Aislamiento.** RLS activa en las 24 tablas, `anon` sin privilegios y
  privilegios por tabla y columna: una tabla nueva nace cerrada.
- **Verificación.** `pnpm db:verify` comprueba el modelo aplicado y
  `pnpm test:db` prueba el aislamiento real con owner, editor, viewer y un
  usuario ajeno.

El diccionario, la matriz de RLS y los índices están en
[`docs/base-de-datos/esquema.md`](docs/base-de-datos/esquema.md); el arranque, las
migraciones, las copias y el runbook, en
[`docs/base-de-datos/operacion.md`](docs/base-de-datos/operacion.md).

## Estructura del repositorio

```text
src/
  app/            Rutas del App Router, layouts, metadatos y assets de la app
    (public)/     Portada, acceso, estado y sus layouts públicos
    (workspace)/  Espacio de trabajo (rail, topbar y barra inferior); hoy /design-system
    api/health/   Route handler JSON del healthcheck
  components/     Presentación reutilizable
    shell/        Topbar, rail, barra inferior, migajas y paleta de comandos
    theme/        Provider y selector de tema
    ui/           Componentes base del sistema de diseño
  lib/            Utilidades puras, entorno y helpers sin React
    db/           Esquema Drizzle, conexión privilegiada, sesión de usuario y seed
    env/          Esquemas de entorno público y de servidor
    storage/      Contrato StorageAdapter y claves de assets
  messages/       Textos de interfaz centralizados y tipados
  modules/        Módulos de dominio (fichas, mapas, manuscritos…)
  styles/         Tokens, base y movimiento del sistema de diseño
    tokens/       palette.css (única fuente de hex), scales.css y semantic.css
tests/
  unit/           Vitest + Testing Library
  db/             Integración y RLS contra el proyecto de Supabase de desarrollo
  e2e/            Playwright (rutas, responsive, temas, capturas y axe)
scripts/          Utilidades de mantenimiento del repositorio
  db/             ping, seed, reset y verify de la base de datos
drizzle/          Migraciones, journal y rollback documentado
docs/             Plan, proceso, decisiones, ADRs, diseño y base de datos
  base-de-datos/  Esquema, RLS y operación
  diseno/         Guía del sistema de diseño y capturas de referencia
tasks/            Task files del flujo SDD
.github/          CI, Dependabot y plantillas de issue y PR
.opencode/        Agentes y configuración de OpenCode
```

`src/modules/` está preparada pero todavía vacía: cada dominio tendrá su lógica
de negocio separada de la presentación. Los detalles están en
[`src/modules/README.md`](src/modules/README.md).

## Stack

- [Next.js 16](https://nextjs.org/) App Router + React 19 + TypeScript estricto.
- [Tailwind CSS 4](https://tailwindcss.com/) CSS-first, shadcn/ui, Radix Dialog,
  Tabs y Tooltip, `cmdk`, Lucide y `next/font` (Fraunces, Inter y JetBrains
  Mono).
- [Zod](https://zod.dev/) para validar entorno y datos.
- [Supabase](https://supabase.com/) (PostgreSQL 15+ con RLS) y
  [Drizzle ORM](https://orm.drizzle.team/) con el driver `postgres`; migraciones
  con Drizzle Kit.
- [Vitest](https://vitest.dev/), Testing Library, [Playwright](https://playwright.dev/)
  y axe.
- [Vercel](https://vercel.com/) Hobby para el despliegue.
- Previstos: Cloudflare R2 (contrato `StorageAdapter` ya definido), MapLibre +
  Terra Draw, React Flow + ELK y Tiptap 3.

## Convenciones

- **App Router y Server Components por defecto.** `'use client'` solo en
  componentes con estado, efectos o eventos (por ejemplo `error.tsx`).
- **TypeScript estricto:** `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noUnusedLocals`/`Parameters`,
  `verbatimModuleSyntax`. Sin `any` implícitos ni `@ts-ignore` sin justificar.
- **Alias `@/*`** hacia `src/*` en TypeScript y Vitest. Los imports relativos se
  reservan a archivos hermanos.
- **Tailwind CSS 4 CSS-first.** No hay `tailwind.config`. Los tokens viven en
  `src/styles/tokens/` y se importan desde `src/app/globals.css`:
  `palette.css` es la única fuente de colores literales, `semantic.css` asigna
  los papeles por tema y `scales.css` guarda tipografía, radios, medidas y
  movimiento. Los componentes usan utilidades semánticas (`bg-surface`,
  `text-foreground`, `border-border`, `text-muted-foreground`, `bg-accent`),
  nunca la paleta cruda `--craft-*` ni prefijos `dark:`. El detalle está en
  [`docs/diseno/sistema-de-diseno.md`](docs/diseno/sistema-de-diseno.md).
- **Componentes base.** `src/components/ui/` reúne botón, campos de formulario,
  tarjeta, etiqueta de estado, estado vacío, diálogo, panel, pestañas, aviso,
  globo de ayuda y paleta de comandos. Los primitivos interactivos usan Radix
  (Dialog, Tabs y Tooltip); los campos son nativos. `cmdk` se carga de forma
  diferida.
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
| `src/lib/env/server-schema.ts` | Variables públicas + `NODE_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`, Supabase, `DATABASE_URL`, `DIRECT_URL` y R2. | Servidor y tests. |
| `src/lib/env/server.ts` | `serverEnv`, marcado con `server-only`. | Solo servidor. |
| `src/lib/db/env.ts` | `DATABASE_URL` y `DIRECT_URL`: validación perezosa y estricta. | Servidor y scripts. |

`parsePublicEnv` copia únicamente claves públicas: aunque reciba el
`process.env` completo, el resultado no contiene secretos. Importar `server.ts`
desde un componente cliente rompe la compilación gracias a `server-only`.

`src/lib/site-url.ts` resuelve el origen del sitio en este orden:
`NEXT_PUBLIC_SITE_URL` → `https://${VERCEL_URL}` → `http://localhost:3000`.

Las claves de Supabase Auth son opcionales hasta que M1-01 las consuma; las de
Cloudflare R2, hasta M0-10. `DATABASE_URL` y `DIRECT_URL` ya las usan los scripts
`db:*` y `pnpm test:db`, y `.env.example` separa las variables públicas de las de
servidor.

## Temas

La aplicación tiene dos temas, **Claro y Oscuro**, y una tercera opción,
**Sistema**, que sigue `prefers-color-scheme`. El selector de la topbar es un
`<select>` nativo etiquetado; la preferencia se guarda en `localStorage` bajo
`wc-theme` y se mantiene entre visitas.

El arranque ocurre antes del primer pintado: un `<script>` en línea en el layout
raíz escribe `data-theme` y `data-theme-preference` en `<html>`, así que no hay
destello del tema claro en modo oscuro. No se usa `next/script` con
`beforeInteractive` porque en esta versión de Next el atributo llegaba tarde y
producía parpadeo; lo comprueba `tests/e2e/themes.spec.ts`. Sin JavaScript,
`:root` sirve el tema claro completo.

Las utilidades de Tailwind se generan con `@theme inline`, así que cambiar de
tema no recompila CSS ni exige variantes `dark:`. `themeColor` y el manifest no
admiten variables CSS y leen sus colores de `src/lib/theme-palette.ts`, que un
test compara con la paleta.

Al añadir componentes hay que comprobarlos en los dos temas, con contraste AA
(4.5:1 texto normal, 3:1 texto grande y elementos gráficos). Los tests E2E
recorren las pantallas en ambos temas y pasan axe.

## Navegación y shell

- **Escritorio (≥1024 px):** rail lateral completo con etiquetas y grupos.
- **Tablet (768–1023 px):** rail colapsado a iconos con globo de ayuda.
- **Móvil (<768 px):** barra inferior con tres destinos y «Más», que abre un
  panel con acceso, próximamente, licencia y estado.
- La topbar es `sticky`; el espacio de trabajo muestra migajas y la web pública,
  navegación horizontal o menú móvil.
- La paleta de comandos se abre con el botón de búsqueda o con
  `Ctrl`/`Cmd` + `K`.

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
- **Vitest** para esquemas de entorno, mensajes, utilidades, tokens y contraste,
  tema, navegación, healthcheck, componentes base, esquema de base de datos,
  catálogo del sistema y contrato de almacenamiento; **Playwright** para rutas,
  404, API, responsive, temas, sistema de diseño y accesibilidad con
  `@axe-core/playwright`. Las pruebas de RLS e integración viven en
  `tests/db/` y se ejecutan aparte con `pnpm test:db` contra la base real.
  `pnpm design:captures` regenera las imágenes de referencia.
- GitHub Actions ejecuta `lint`, `typecheck`, `test` y `build` en cada PR y en
  cada push a `dev` y `main`. Son los **required checks** de la protección de
  ramas ([ADR 0017](docs/adr/0017-nextjs-scaffold-and-env-contract.md), que
  mantiene esta subdecisión del ADR 0016). El job de tests ejecuta además
  `pnpm db:check`, que valida las migraciones sin credenciales. `e2e`,
  `gitleaks` (secretos) y `audit` (dependencias) también se ejecutan, sin
  bloquear.
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

- Sin autenticación ni almacenamiento de archivos: `/login` es un placeholder y
  no hay contenido. El esquema, las migraciones y las políticas de RLS están
  aplicados y verificados en el proyecto Supabase de desarrollo, pero ninguna
  pantalla los usa todavía.
- El proyecto Supabase de desarrollo y sus credenciales son una acción del
  propietario: sin ellas no se ejecutan `db:migrate`, `db:seed`, `db:verify` ni
  `test:db`.
- `pnpm format:check` falla en local en Windows por los finales de línea CRLF de
  archivos antiguos (`core.autocrlf=true`); el contenido sí cumple Prettier y en
  Linux no se reproduce.
- La textura de papel y los tokens de entidad llegan con M1-02 y M1-03. Motion
  no se instala: las animaciones son CSS.
- El tema no se sincroniza entre pestañas y los avisos pueden quedar sobre la
  barra inferior en móvil; ambas deudas están registradas en el
  [ADR 0018](docs/adr/0018-design-system-tokens-and-shell.md).
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
- [docs/arquitectura.md](docs/arquitectura.md): módulos, capas y flujos
  principales.
- [docs/manual-de-usuario.md](docs/manual-de-usuario.md): manual en
  construcción, con lo que ya se puede hacer y la estructura de las próximas
  fases.
- [docs/diseno/sistema-de-diseno.md](docs/diseno/sistema-de-diseno.md): guía
  práctica de tokens, componentes, shell y temas, con las capturas de
  referencia.
- [docs/base-de-datos/esquema.md](docs/base-de-datos/esquema.md): modelo de
  datos, enums, índices, búsqueda, triggers, RLS y privilegios.
- [docs/base-de-datos/operacion.md](docs/base-de-datos/operacion.md): arranque,
  migraciones, seed, reset, copias, límites y runbook.
- [CONTRIBUTING.md](CONTRIBUTING.md): ramas, commits, PRs y calidad.
- [CHANGELOG.md](CHANGELOG.md): cambios relevantes por versión.
- [SECURITY.md](SECURITY.md): cómo reportar una vulnerabilidad.
- [LICENSE](LICENSE): licencia MIT.
