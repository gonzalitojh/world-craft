# Contribuir a World Craft

Este documento resume cómo se trabaja en el repositorio. El proceso canónico,
las puertas y la Definition of Done completa están en
[`docs/proceso-sdd.md`](docs/proceso-sdd.md) y [`AGENTS.md`](AGENTS.md); si hay
discrepancia, mandan esos documentos.

## Issue-first

- Toda funcionalidad, corrección o decisión nace de una issue.
- Cada issue usa una plantilla de `.github/ISSUE_TEMPLATE/` e incluye contexto,
  alcance, dependencias, criterios de aceptación verificables y una variante de
  modelo recomendada.
- Cada issue lleva exactamente un `type:`, un `status:`, un `priority:`, un
  `size:`, al menos un `area:`, un hito y exactamente un `variant: *`.
- Una issue, un task file: `tasks/task-issue-<N>.json`.
- Si falta una decisión, la issue se marca `needs-decision` y el trabajo se
  detiene hasta que se resuelva.

## Ramas

Formato: `<tipo>/issue-<N>-<slug>`, en kebab-case y con el número de la issue.

| Tipo | Uso |
|---|---|
| `feature` | Funcionalidad nueva. |
| `fix` | Corrección de un error. |
| `docs` | Documentación. |
| `chore` | Mantenimiento, configuración o infraestructura. |
| `refactor` | Reestructuración sin cambio funcional. |
| `test` | Pruebas y calidad. |

Las ramas se crean desde `dev` actualizado. Nunca se trabaja ni se hace push
directo sobre `main` o `dev`.

## Commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` funcionalidad nueva.
- `fix:` corrección de un error.
- `docs:` documentación.
- `chore:` mantenimiento, configuración o dependencias.
- `refactor:` reestructuración sin cambio funcional.
- `test:` pruebas.
- `style:` formato sin cambio de comportamiento.
- `content:` contenido editorial, plantillas o datos.

Ejemplo: `docs: documentar el flujo de publicación local-first`.

## Base de datos y migraciones

- El esquema tipado vive en `src/lib/db/schema/` y las migraciones en `drizzle/`.
  La cadena es única y lineal: no se crean carpetas paralelas.
- Cambiar el modelo: editar el esquema, `pnpm db:generate`, revisar el SQL y
  `pnpm db:check`.
- **Nunca se edita una migración aplicada.** Se corrige con otra migración hacia
  delante.
- **`drizzle-kit push` está prohibido:** no versiona, no es reversible y puede
  borrar políticas, triggers, funciones y privilegios.
- Lo que Drizzle no modela (RLS, triggers, funciones, privilegios, FKs hacia
  `auth.users`) se escribe en SQL custom revisado, con `search_path = ''` y
  `security definer` cuando corresponde.
- Toda migración nueva lleva su rollback documentado en `drizzle/rollback/`.
- El seed (`src/lib/db/seed/system-catalog.json`) es idempotente, no borra filas
  y se valida con Zod.
- Los scripts `db:*` y `test:db` solo se ejecutan contra el proyecto de Supabase
  de desarrollo, con `DIRECT_URL` en `.env.local`. Nunca contra producción y
  nunca con credenciales en el repositorio o en la CI.
- Una tabla nueva nace sin privilegios: hay que concederla por tabla y columna en
  `0006_grants.sql` (o en la migración que corresponda) y añadir su política.
- El modelo se documenta en
  [`docs/base-de-datos/esquema.md`](docs/base-de-datos/esquema.md) y su operación
  en [`docs/base-de-datos/operacion.md`](docs/base-de-datos/operacion.md); un
  cambio de modelo actualiza ambos.

## Pull Requests

- **Siempre contra `dev`**, nunca contra `main`.
- Se rellena `.github/pull_request_template.md`.
- **No se usan keywords de cierre** (`Closes #N`, `Fixes #N`): la issue se cierra
  al fusionar la PR, no al crearla.
- El publisher trabaja en modo **local-first**: prepara rama, commit y diff, y no
  hace push ni abre la PR sin confirmación explícita.
- La PR incluye resumen, cambios, pruebas ejecutadas y documentación afectada.
- Solo el propietario promueve `dev` a `main` cuando la versión es estable.

## Calidad y Definition of Done

Antes de dar una tarea por terminada se comprueba la Definition of Done de
[`AGENTS.md`](AGENTS.md):

- Criterios de aceptación cumplidos.
- Typecheck, lint, tests y build en verde cuando existan.
- QA y revisión de seguridad superadas.
- Responsive a ~360, ~768 y ~1280 px, sin scroll horizontal de página, si hay
  UI.
- Los dos temas (Claro y Oscuro) con contraste AA, si hay UI.
- Accesibilidad: teclado, foco visible, axe sin errores críticos y
  `prefers-reduced-motion`.
- Manual de usuario actualizado si el cambio es visible, y ADR si hay una
  decisión relevante.
- Task file actualizado con estados, QA, seguridad y documentación.

## Comandos de calidad

Requisitos: Node 22 LTS y pnpm vía Corepack (`corepack enable`). La primera vez,
instala las dependencias con `pnpm install`; Playwright necesita su navegador:

```bash
pnpm exec playwright install chromium
```

Antes de revisar una tarea, ejecuta en local los mismos checks que la CI:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm db:check
pnpm test:e2e
```

- `lint`, `typecheck`, `test` y `build` son **required checks**: una PR no se
  fusiona si fallan.
- `pnpm db:check` corre dentro del job de tests de la CI: valida el journal y los
  snapshots de Drizzle Kit sin credenciales. `pnpm test:db` (RLS) es local y
  necesita el proyecto de Supabase de desarrollo.
- `e2e`, `gitleaks` y `audit` también se ejecutan en la CI, sin bloquear.
- En PowerShell, si la política de ejecución bloquea `pnpm.ps1`, usa `pnpm.cmd`
  (`pnpm.cmd lint`, `pnpm.cmd typecheck`, etc.).
- Para corregir el formato: `pnpm format`. En Windows, `format:check` puede fallar
  por los finales de línea CRLF de archivos antiguos; no reformatees el
  repositorio entero: comprueba solo los archivos que has tocado.

## Seguridad y coste

- Prohibido incluir secretos, tokens, contraseñas, correos reales o URLs
  privadas. Los `.env*` no se versionan.
- Las cadenas de conexión (`DATABASE_URL`, `DIRECT_URL`) y
  `SUPABASE_SERVICE_ROLE_KEY` son secretos de servidor: no se pegan en issues,
  logs ni capturas, y los scripts las imprimen con la contraseña oculta.
- RLS es la última línea de defensa, no la única: las Server Actions vuelven a
  comprobar la membresía y el rol.
- No se añaden servicios de pago ni dependencias injustificadas: el coste
  objetivo es 0 €/mes.
- Las vulnerabilidades se reportan de forma privada según
  [`SECURITY.md`](SECURITY.md).

## Comandos básicos

```bash
git fetch origin --prune
git checkout -b docs/issue-<N>-<slug> origin/dev
git status --short
git diff
git add <archivo1> <archivo2>
git commit -m "docs: descripción breve"
```

Nunca se usa `git add .`: se añaden rutas explícitas. El push y la PR se hacen
solo tras una petición explícita de publicación.
