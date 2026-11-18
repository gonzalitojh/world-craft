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

## Datos y migraciones

- El esquema vive con el código de persistencia y las migraciones se versionan
  en el repositorio; la cadena es única y lineal.
- **Nunca se edita una migración aplicada.** Se corrige con otra migración hacia
  delante.
- Toda migración que pueda afectar a datos existentes crea antes una copia de
  seguridad verificable, se prueba sobre una base temporal y se ejecuta en una
  transacción.
- Las migraciones documentan su reversión o rollback y se prueban en la CI.
- Los datos de usuario viven en `app.getPath('userData')`, nunca en el
  repositorio ni en la carpeta de instalación.
- Las operaciones destructivas exigen confirmación explícita y dejan una copia
  recuperable.
- Un cambio de modelo actualiza
  [`docs/base-de-datos/esquema.md`](docs/base-de-datos/esquema.md),
  [`docs/base-de-datos/migraciones.md`](docs/base-de-datos/migraciones.md) y la
  exportación/importación portable.

## Pull Requests

- **Siempre contra `dev`**, nunca contra `main`.
- Se rellena `.github/pull_request_template.md`.
- **No se usan keywords de cierre** (`Closes #N`, `Fixes #N`): la issue se cierra
  al fusionar la PR, no al crearla.
- El publisher trabaja en modo **local-first**: prepara rama, commit y diff, y no
  hace push ni abre la PR sin confirmación explícita.
- La PR incluye resumen, cambios, pruebas ejecutadas y documentación afectada.
- Solo el propietario promueve `dev` a `main` cuando la versión es estable.

## Changelog y documentación

- **Changelog.** [`CHANGELOG.md`](CHANGELOG.md) sigue Keep a Changelog y
  Semantic Versioning. Cada PR con un cambio relevante añade su entrada en
  «Sin publicar», dentro de `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`,
  `Corregido` o `Seguridad`.
- **Arquitectura.** [`docs/arquitectura.md`](docs/arquitectura.md) describe
  procesos, módulos, IPC, datos y empaquetado; se actualiza cuando cambian.
- **Persistencia.** [`docs/persistencia.md`](docs/persistencia.md) y
  [`docs/base-de-datos/`](docs/base-de-datos/esquema.md) se actualizan con
  cualquier cambio de datos, copias o recuperación.
- **Manual.** [`docs/manual-de-usuario.md`](docs/manual-de-usuario.md) se
  actualiza con cualquier cambio visible para la persona usuaria, en la misma
  tarea (regla 4 de `AGENTS.md`). Mientras una función no exista, figura como
  **prevista**.
- **ADRs.** Una decisión arquitectónica o de producto relevante se registra en
  [`docs/adr/`](docs/adr/README.md) y en
  [`docs/registro-decisiones.md`](docs/registro-decisiones.md).

## Calidad y Definition of Done

Antes de dar una tarea por terminada se comprueba la Definition of Done de
[`AGENTS.md`](AGENTS.md):

- Criterios de aceptación cumplidos.
- Typecheck, lint, tests y build en verde cuando existan.
- QA y revisión de seguridad superadas.
- Ventana comprobada a 1024, 1280 y 1600 px, sin scroll horizontal de página, si
  hay UI.
- Los dos temas (Claro y Oscuro) con contraste AA, si hay UI.
- Accesibilidad: teclado, foco visible, axe sin errores críticos y
  `prefers-reduced-motion`.
- Datos preservados: migración, reinicio y actualización no borran nada.
- Seguridad Electron revisada: aislamiento, IPC validado y CSP.
- Manual de usuario actualizado si el cambio es visible, y ADR si hay una
  decisión relevante.
- Task file actualizado con estados, QA, seguridad y documentación.

## Comandos de calidad

Requisitos: Node 22 LTS y pnpm vía Corepack (`corepack enable`). La primera vez,
instala las dependencias con `pnpm install`.

Mientras no exista el scaffold de Electron, los checks disponibles son:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

Cuando existan, se añadirán `pnpm build`, `pnpm test:e2e` y los comandos de
migración; no se documentan como disponibles antes de tiempo.

- `lint`, `typecheck` y `test` son **required checks**: una PR no se fusiona si
  fallan.
- `gitleaks` y `audit` también se ejecutan en la CI, sin bloquear.
- En PowerShell, si la política de ejecución bloquea `pnpm.ps1`, usa `pnpm.cmd`.
- Para corregir el formato: `pnpm format`. En Windows, `format:check` puede fallar
  por finales de línea CRLF de archivos antiguos; comprueba solo los archivos que
  has tocado.

## Seguridad y coste

- Prohibido incluir secretos, tokens, contraseñas, correos reales o URLs
  privadas. Los `.env*` no se versionan.
- El renderer no accede a Node, al sistema de archivos ni a SQLite; todo pasa por
  la API tipada del preload.
- Todo canal IPC está en una allowlist y valida la entrada con Zod.
- No se carga contenido remoto en la ventana y la CSP es estricta en producción.
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
