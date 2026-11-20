# World Craft

World Craft es una **aplicación de escritorio para Windows** con la que crear y
mantener mundos de ficción: fichas y entidades, relaciones, mapas, grafo de
conocimiento, manuscritos y juego creativo. Todo el contenido vive en el equipo
de la persona usuaria: no hay cuentas, servidor remoto ni contenido público. El
código se publica bajo licencia MIT.

## Estado

**Fundaciones de escritorio con persistencia local e instalador.** El
repositorio contiene la base técnica de Electron con electron-vite, React y
TypeScript estricto, el IPC tipado, una base SQLite con migraciones,
comprobación de integridad y modo seguro, el sistema de diseño con su shell de
escritorio y un instalador NSIS por usuario con actualizaciones manuales.
`pnpm dev` abre una ventana segura con la barra lateral, el tema Claro/Oscuro
conmutable, el dashboard de mundos y el CRUD de mundos con actividad; `pnpm build`
compila los tres procesos en `out/` y `pnpm dist` genera
`release/world-craft-0.1.0-setup.exe`. **Todavía no hay una release pública**:
el instalador se genera y se prueba en local, y la publicación oficial, la
actualización real contra GitHub Releases y el resto de funciones de producto
(fichas, mapas y escritura) llegan con las fases siguientes.

El inventario de lo eliminado y las cuentas externas que hay que cerrar están en
[`docs/cambio-a-escritorio.md`](docs/cambio-a-escritorio.md). El plan aprobado,
en [`docs/plan-desarrollo.md`](docs/plan-desarrollo.md).

## Stack de escritorio

| Capa | Tecnología | Estado |
|---|---|---|
| Shell de escritorio | Electron + electron-vite | Implementado (scaffold) |
| Interfaz | React + TypeScript estricto + Vite | Implementado (scaffold) |
| Estilos | CSS propio con tokens en tres capas (paleta, semántica y escalas), sin Tailwind ni shadcn | Implementado (#65) |
| Base de datos | SQLite local con better-sqlite3 + Drizzle ORM | Implementado (#64) |
| Migraciones | Runner propio sobre el journal de Drizzle y copia previa | Implementado (#64) |
| Mundos | CRUD, dashboard y actividad sobre `worlds` y `activity_log` | Implementado (#72); portada con #115 |
| Tipos de entidad | 18 tipos del sistema, tipos personalizados y campos tipados en JSON | Implementado (#73); UI de fichas con #74 |
| Búsqueda | SQLite FTS5 | Disponible en el binario; esquema previsto (M1) |
| Archivos | Sistema de archivos local bajo `app.getPath('userData')` con protocolo `wc-asset://` | Implementado (#66); UI en M1 |
| Editor | Tiptap 3 | Previsto (M3) |
| Mapas y grafo | MapLibre GL JS + Terra Draw; React Flow + ELK.js | Previsto (M2) |
| Instalador | electron-builder 26.18.0 + NSIS por usuario | Implementado (#68); release pública en M5 |
| Actualizaciones | electron-updater 6.8.11 + GitHub Releases | Implementado (#68) como comprobación manual; auto-check y ajustes en M1, release real en M5 |

El renderer no accede a Node, al sistema de archivos ni a SQLite: usa una API
tipada expuesta por el preload. Los detalles están en
[`docs/arquitectura.md`](docs/arquitectura.md) y en los
[ADRs](docs/adr/README.md).

## Requisitos

- **Windows 10/11** para ejecutar la aplicación (el desarrollo también funciona
  en otras plataformas, pero el objetivo y las pruebas de ventana son Windows).
- **Node.js 22 LTS** (`engines.node` limita a `>=22.22.2 <23`; `.nvmrc` fija la
  línea 22).
- **pnpm vía Corepack:**

  ```bash
  corepack enable
  ```

  La versión exacta está fijada en `packageManager`.
- Git.

En Windows, si la política de ejecución bloquea `pnpm.ps1`, usa `pnpm.cmd`
(por ejemplo `pnpm.cmd typecheck`) o `corepack pnpm typecheck`.

## Arranque local

Instala las dependencias una vez y usa los scripts del `package.json`:

```bash
pnpm install
pnpm dev              # abre la ventana de Electron en desarrollo
pnpm build            # compila main, preload y renderer en out/
pnpm start            # previsualiza el build de producción
pnpm verify:build     # valida artefactos, CSP, migraciones y externalización
pnpm verify:native    # comprueba better-sqlite3 y sharp en Node y Electron
pnpm dist:dir         # genera una carpeta desempaquetada en release/ (Windows)
pnpm dist             # genera el instalador NSIS en release/ (Windows)
pnpm package:checksums # escribe SHA256SUMS para el instalador y latest.yml
pnpm verify:package   # valida asar, binarios nativos, licencias y manifiestos
pnpm clean            # borra out/ y otros artefactos locales
```

Los checks de calidad y de datos son:

```bash
pnpm lint
pnpm typecheck
pnpm test             # unitarias + componentes + integración
pnpm test:unit
pnpm test:components
pnpm test:integration
pnpm test:e2e         # compila y abre la app real con Playwright Electron (Windows)
pnpm db:generate      # genera una migración con Drizzle Kit
pnpm db:check         # valida el journal y las instantáneas
pnpm format           # corrige el formato
pnpm format:check     # comprueba el formato
```

`pnpm build` **no genera un instalador**: produce `out/main/index.cjs`,
`out/preload/index.cjs` y `out/renderer/index.html`, y copia `drizzle/` a
`out/main/drizzle`. Los comandos `dist:dir`, `dist`, `package:checksums` y
`verify:package` son **Windows-only**, escriben en `release/` (ignorada por git)
y usan `--publish never`: no publican ni suben artefactos. La instalación real se
puede probar a mano con `scripts/verify-install.ps1 -AcceptInstallTest`. La
release pública llega con M5.

## Seguridad del scaffold

- El renderer no accede a Node, al sistema de archivos ni a Electron. El preload
  congela y expone solo `window.worldCraft` (`appInfo`, `shell.openExternal`,
  `updates`, `worlds` y `entityTypes`); todo canal IPC está en una allowlist y
  valida la entrada con Zod.
- Una única instancia: abrir la aplicación de nuevo enfoca la ventana existente y
  no toca la base, el IPC ni el actualizador.
- `contextIsolation`, `sandbox`, `nodeIntegration: false`, `webSecurity: true` y
  `webviewTag: false`; DevTools están deshabilitadas en la versión empaquetada.
- CSP estricta de producción inyectada antes de los scripts y CSP de desarrollo
  limitada a loopback para Vite y su recarga en caliente.
- Navegación, redirecciones, ventanas nuevas, webviews y descargas bloqueadas;
  permisos denegados y peticiones remotas canceladas. `pnpm verify:build` lo
  comprueba sobre los artefactos.
- La base SQLite vive solo en `userData`, el renderer no la ve y `src/main/db/`
  no importa Electron. Un fallo de integridad, copia o migración deja la app en
  modo seguro sin conexión de escritura.
- El actualizador usa la partición `electron-updater` con caché desactivada, solo
  permite HTTPS a GitHub y sus descargas, elimina cabeceras de autenticación y
  staging, deniega permisos y no envía contenido del usuario. La instalación es
  por usuario y no requiere administrador.

## Privacidad y datos

- Los datos viven en `app.getPath('userData')`, **fuera** de la carpeta de
  instalación. Actualizar, reinstalar o desinstalar no los borra.
- No hay telemetría, analítica ni servicios de terceros.
- La aplicación funciona sin conexión. La red solo se usa para comprobar
  actualizaciones cuando la persona usuaria pulsa «Actualizaciones»; no hay
  comprobación automática ni descarga sin consentimiento, y no se envía el
  contenido de los mundos.
- Antes de una migración se crea una copia local verificable. Las copias
  automáticas diarias, semanales y mensuales, la retención y la restauración
  desde el aviso de modo seguro ya funcionan; la interfaz de Ajustes llega en M1.
- Los datos se podrán exportar e importar en formatos abiertos (JSON y assets) en
  las fases siguientes.

El detalle está en [`docs/persistencia.md`](docs/persistencia.md) y
[`docs/continuidad.md`](docs/continuidad.md).

## Estructura del repositorio

```text
src/
  main/           Proceso principal: ventana, ciclo de vida, IPC y persistencia
    assets/       Servicio de imágenes, protocolo wc-asset:// y purga recuperable
    backup/       Copias, manifiesto, rotación, programación y restauración
    db/           Rutas, conexión SQLite, esquema, migraciones, copia e integridad
    ipc/          Router tipado con allowlist y Zod
    messages/     Textos de los diálogos nativos
    security/     CSP, navegación, sesión y guards de red
    updates/      Máquina de estados, adaptador de electron-updater y red
    single-instance.ts  Lock de instancia única y foco de la ventana
  preload/        Puente congelado que solo expone window.worldCraft
  renderer/       React, mensajes, tema, shell, páginas y tokens de estilo
    updates/      Textos de estado y formatos del panel de actualizaciones
  shared/         Identidad y contratos sin Node, Electron ni React
drizzle/          Migraciones versionadas, journal y rollback de referencia
resources/        Iconos, installer.nsh y licencias para electron-builder
release/          Instalador, blockmap, latest.yml y SHA256SUMS (ignorada)
tests/unit/       Pruebas unitarias del scaffold, IPC, seguridad, datos, diseño,
                  empaquetado, actualizador e instancia única
tests/integration/ Pruebas con bases SQLite temporales y preservación
docs/             Plan, proceso, arquitectura, persistencia, diseño y ADRs
  adr/            Decisiones de arquitectura y producto
  base-de-datos/  Esquema SQLite y migraciones
  calidad/        Plan de pruebas
tasks/            Task files del flujo SDD
scripts/          check-build, check-native, verify-package, checksums, iconos,
                  licencias, verify-install y utilidades
.github/          CI, Dependabot y plantillas de issue y PR
.opencode/        Agentes y configuración de OpenCode
```

Las pantallas y los módulos de producto se añadirán dentro de `src/renderer/` y
`src/main/` con sus issues; todavía no existen `src/renderer/modules/`. Los
servicios de assets y de copias ya viven en `src/main/assets/` y
`src/main/backup/`, y el actualizador en `src/main/updates/`.

## Ramas

- `main`: versión estable. Solo la promueve el propietario desde `dev`.
- `dev`: rama de integración. Todas las Pull Requests se abren contra `dev`,
  nunca contra `main`.
- `local`: rama de pruebas del propietario cuando haga falta; no es una rama de
  integración.

## Documentación

- [`AGENTS.md`](AGENTS.md): reglas obligatorias y Definition of Done.
- [`docs/proceso-sdd.md`](docs/proceso-sdd.md): flujo SDD, puertas y publicación
  local-first.
- [`docs/plan-desarrollo.md`](docs/plan-desarrollo.md): plan aprobado y alcance.
- [`docs/arquitectura.md`](docs/arquitectura.md): procesos de Electron, IPC,
  datos y empaquetado.
- [`docs/persistencia.md`](docs/persistencia.md): SQLite, `userData`, assets,
  copias y restauración.
- [`docs/base-de-datos/esquema.md`](docs/base-de-datos/esquema.md) y
  [`docs/base-de-datos/migraciones.md`](docs/base-de-datos/migraciones.md):
  modelo y migraciones.
- [`docs/continuidad.md`](docs/continuidad.md): escenarios de pérdida y
  recuperación.
- [`docs/diseno/sistema-de-diseno.md`](docs/diseno/sistema-de-diseno.md): tokens,
  temas y componentes de escritorio.
- [`docs/internacionalizacion.md`](docs/internacionalizacion.md): catálogo
  tipado y formatos.
- [`docs/calidad/plan-de-pruebas.md`](docs/calidad/plan-de-pruebas.md): pruebas,
  datos, IPC, UI y rendimiento.
- [`docs/manual-de-usuario.md`](docs/manual-de-usuario.md): manual en
  construcción; las funciones aún no implementadas figuran como previstas.
- [`docs/cambio-a-escritorio.md`](docs/cambio-a-escritorio.md): inventario del
  pivote y cuentas a cerrar.
- [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md) y
  [`CHANGELOG.md`](CHANGELOG.md).
- [`LICENSE`](LICENSE): licencia MIT.
