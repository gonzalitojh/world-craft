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

- El esquema vive con el código de persistencia (`src/main/db/schema/`) y las
  migraciones se versionan en `drizzle/`; la cadena es única y lineal.
- **Nunca se edita una migración aplicada.** Se corrige con otra migración hacia
  delante; el checksum SHA-256 detecta cualquier cambio.
- Las migraciones se generan con `pnpm db:generate` y se validan con
  `pnpm db:check`. La aplicación las aplica con un runner propio en una
  transacción, no con `drizzle-kit migrate` ni `drizzle-kit push`.
- Toda migración que pueda afectar a datos existentes crea antes una copia de
  seguridad verificable, se prueba sobre una base temporal y se ejecuta en una
  transacción.
- Las migraciones documentan su reversión o rollback en `drizzle/rollback/` y se
  prueban en la CI.
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
- Typecheck, lint, tests y build en verde.
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

```bash
pnpm dev              # ventana de Electron en desarrollo
pnpm build            # compila main, preload y renderer en out/
pnpm start            # previsualiza el build de producción
pnpm verify:build     # valida artefactos, CSP, migraciones y externalización
pnpm verify:native    # comprueba better-sqlite3 y sharp en Node y Electron
pnpm dist:dir         # carpeta desempaquetada en release/ (Windows)
pnpm dist             # instalador NSIS en release/ (Windows)
pnpm package:checksums # genera SHA256SUMS
pnpm verify:package   # valida asar, binarios nativos, licencias y manifiestos
pnpm clean            # borra out/ y otros artefactos locales
pnpm db:generate      # genera una migración
pnpm db:check         # valida el journal y las instantáneas
pnpm lint
pnpm typecheck
pnpm test             # unitarias + integración
pnpm test:unit
pnpm test:integration
pnpm format:check
```

`pnpm build` escribe `out/main/index.cjs`, `out/preload/index.cjs` y
`out/renderer/index.html`, y copia `drizzle/` a `out/main/drizzle`; **no genera
un instalador**. `pnpm start` compila y abre el build de producción (se puede
omitir la compilación con `--skipBuild`). `test:e2e` llegará con #70.

- `lint`, `typecheck` y `test` son **required checks**: una PR no se fusiona si
  fallan.
- El job `build` (`pnpm db:check`, `pnpm build` y `pnpm verify:build`) ya se
  ejecuta en la CI, pero no es required hasta la issue #69.
- El job `package` (`verify:native`, `dist`, `verify:build`,
  `package:checksums` y `verify:package --installer`) corre en `windows-latest`,
  **no es required hasta #69**, no publica y no sube artefactos.
- `pnpm verify:native` se ejecuta en el job `package`; también se puede lanzar a
  mano antes de tocar módulos nativos.
- `gitleaks` y `audit` también se ejecutan en la CI, sin bloquear.
- En PowerShell, si la política de ejecución bloquea `pnpm.ps1`, usa `pnpm.cmd`
  (por ejemplo `pnpm.cmd typecheck`).
- Para corregir el formato: `pnpm format`. En Windows, `format:check` puede fallar
  por finales de línea CRLF de archivos antiguos; comprueba solo los archivos que
  has tocado.

## Empaquetado local

- Los comandos `dist:dir`, `dist`, `package:checksums` y `verify:package` son
  **Windows-only**, escriben en `release/` y usan `--publish never`. `release/`
  está ignorada por git: no se añade al repositorio ni a la PR.
- **No se publica ni se sube nada sin una petición explícita del usuario.** El
  modo por defecto es local: rama, commit y diff. El instalador generado no se
  adjunta a la PR ni se publica desde una tarea normal.
- La instalación real se prueba a mano con
  `scripts/verify-install.ps1 -AcceptInstallTest`; instala, actualiza y
  desinstala en la máquina y compara hashes de `userData`.
- El job `package` de la CI no recibe `GH_TOKEN`, no publica y no sube
  artefactos. La release completa se hace en M5.
- La versión debe coincidir entre `package.json`, `APP_VERSION`, `latest.yml` y
  `ProductVersion`; el test de identidad lo comprueba.
- El instalador se distribuye sin firma (ADR 0015). No se añaden certificados de
  prueba ni claves al repositorio.

## Dependencias

- El renderer y el preload se compilan con Vite; React y las herramientas de
  build viven en `devDependencies`.
- Una dependencia que el proceso principal necesite en tiempo de ejecución y no
  se pueda empaquetar (por ejemplo, un módulo nativo) va en `dependencies` y se
  justifica con tamaño, licencia, mantenimiento, seguridad y alternativa
  gratuita.
- `better-sqlite3` se fija en una versión con Node-API y prebuild compartido
  entre Node y Electron; no se añade `electron-rebuild` salvo contingencia
  justificada. `pnpm verify:native` comprueba ambos runtimes.
- No se duplica funcionalidad ya disponible en el stack ni se añaden librerías
  propietarias o con licencias incompatibles.
- El lockfile se versiona y cualquier cambio de dependencias explica el motivo
  en la PR.

## Seguridad y coste

- Prohibido incluir secretos, tokens, contraseñas, correos reales o URLs
  privadas. Los `.env*` no se versionan.
- El renderer no accede a Node, al sistema de archivos ni a SQLite; todo pasa por
  la API tipada del preload.
- Todo canal IPC está en una allowlist y valida la entrada con Zod en el proceso
  principal.
- La capa `src/main/db/` no importa Electron: recibe rutas ya resueltas y se
  prueba sin el runtime de escritorio.
- No se carga contenido remoto en la ventana y la CSP es estricta en producción.
- No se añaden servicios de pago ni dependencias injustificadas: el coste
  objetivo es 0 €/mes.
- Las vulnerabilidades se reportan de forma privada según
  [`SECURITY.md`](SECURITY.md).

### Invariantes que no se relajan sin un ADR

- `contextIsolation`, `sandbox`, `nodeIntegration: false` y `webSecurity: true`
  en todas las ventanas; el renderer nunca recibe Node ni `ipcRenderer`.
- El preload solo expone funciones concretas del contrato de
  `src/shared/contracts/`; nunca un `invoke` genérico.
- CSP estricta en producción, sin `unsafe-eval` ni `unsafe-inline`; en
  desarrollo solo se permite loopback para Vite y su recarga en caliente.
- Nada de contenido remoto: se bloquean navegación, ventanas nuevas, webviews,
  descargas y peticiones HTTP(S)/WS remotas.
- `pnpm verify:build` debe seguir en verde: comprueba los artefactos, la CSP y
  la ausencia de URLs remotas.

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
